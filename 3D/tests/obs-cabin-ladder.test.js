import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {MeshStandardMaterial,Vector3} from 'three';
import {createMilo,animateMilo} from '../src/obs/characters.js';
import {loadMiloBody} from '../src/obs/milo-body.js';
import {applyCabinLadder,CABIN_LADDER} from '../src/obs/cabin-ladder.js';
import {LADDER,LADDER_WRIST_OFFSET} from '../src/obs/ladder-pose.js';
import {createAccessLadder} from '../src/obs/ship.js';
import {CrewMotion} from '../src/obs/state.js';
import {LADDER_PACE} from '../src/obs/pace.js';
import {FLOORS,LADDER_X} from '../src/obs/layout.js';
await loadMiloBody(`data:application/json;base64,${(await readFile(new URL('../public/assets/obs/milo/body.json',import.meta.url))).toString('base64')}`);
const create=()=>createMilo(new Proxy({},{get:()=>new MeshStandardMaterial()}));
test('ascent and descent run twenty percent faster without speeding up walking',()=>{
  assert.equal(LADDER_PACE,1.2);
  for(const [from,to]of [[2,0],[0,2]]){
    const actor=new CrewMotion({floor:from,x:LADDER_X}),start=actor.y;
    actor.goTo({floor:to,x:LADDER_X});actor.update(1);
    assert.ok(Math.abs(Math.abs(actor.y-start)-38*1.2)<1e-8);
    assert.equal(Math.sign(actor.y-start),Math.sign(FLOORS[to].y-start));
    assert.equal(actor.walkSpeed,54);
  }
  assert.equal(new CrewMotion({climbSpeed:10}).climbSpeed,10);
});
function pose(root,height,startHeight=0,endHeight=6.784){
  root.position.set(0,height,.78);animateMilo(root,{time:0,moving:false});
  const sample=applyCabinLadder(root,{height,startHeight,endHeight,startYaw:Math.PI/2,endYaw:-Math.PI/2});
  root.updateMatrixWorld(true);root.userData.bodySkin.skeleton.update();return sample;
}

test('shared ladder motion grips the actual cabin rung plane and spacing in both directions',()=>{
  const ladder=createAccessLadder(new Proxy({},{get:()=>new MeshStandardMaterial()}));
  const rungs=[];ladder.traverse(o=>{if(o.name==='Ladder rung')rungs.push(o);});
  ladder.updateMatrixWorld(true);
  const first=rungs[0].getWorldPosition(new Vector3()),second=rungs[1].getWorldPosition(new Vector3());
  assert.ok(Math.abs(first.y-CABIN_LADDER.rungBase)<1e-8);
  assert.ok(Math.abs(first.z-CABIN_LADDER.depth)<1e-8);
  assert.ok(Math.abs(second.y-first.y-LADDER.spacing)<1e-8);
  for(const [start,end]of [[0,6.784],[6.784,0]]){
    const root=create();
    for(let i=0;i<=120;i++){
      const height=.5+(6.784-1)*(start<end?i:120-i)/120,sample=pose(root,height,start,end);
      assert.equal(sample.weight,1);assert.ok(sample.contacts.filter(c=>!c.moving).length>=3);
      for(const c of sample.contacts){
        const target=root.localToWorld(c.point.clone());
        if(!c.moving){assert.ok(Math.abs(target.z-first.z)<1e-8);assert.ok(Math.abs((target.y-first.y)/LADDER.spacing-Math.round((target.y-first.y)/LADDER.spacing))<1e-8);}
        if(c.hand){
          const hand=root.userData.arms.find(a=>a.side===c.side).hand;
          const wrist=root.localToWorld(c.point.clone().add(LADDER_WRIST_OFFSET));
          assert.ok(hand.getWorldPosition(new Vector3()).distanceTo(wrist)<.001);
        }else{
          const boot=root.userData.legs.find(a=>a.side===c.side).boot;
          target.y+=LADDER.radius;
          assert.ok(boot.localToWorld(new Vector3(0,-.107,.12)).distanceTo(target)<.001);
        }
      }
    }
  }
});

test('first cabin grip correction is independent of world height and facing',()=>{
  const root=create(),fresh=create();pose(root,4.12);pose(root,2.36);pose(fresh,2.36);
  const a=root.userData.bodySkin.geometry.attributes.position.array,b=fresh.userData.bodySkin.geometry.attributes.position.array;
  for(let i=0;i<a.length;i++)assert.ok(Math.abs(a[i]-b[i])<2e-6,'transformed grip must not distort the hand');
});

test('deck transfers stay continuous and ladder mesh resets on seated, tablet and medical poses',()=>{
  const root=create(),original=root.userData.bodySkin.geometry;
  for(const [start,end]of [[0,3.392],[3.392,0]]){
    let previous;
    const frames=Math.ceil(Math.abs(end-start)/(new CrewMotion().climbSpeed*.016)*120);
    for(let i=0;i<=frames;i++){
      const height=start+(end-start)*i/frames;pose(root,height,start,end);
      const points=[root.userData.head,...root.userData.arms.map(a=>a.hand),...root.userData.legs.map(l=>l.boot)].map(n=>n.getWorldPosition(new Vector3()));
      if(previous)points.forEach((p,j)=>assert.ok(p.distanceTo(previous[j])<.05,`no teleport at a deck transfer: ${start}->${end}, frame ${i}, joint ${j}, delta ${p.distanceTo(previous[j])}`));
      previous=points;
    }
    assert.ok(Math.abs(root.position.z-.78)<1e-8);
  }
  for(const action of ['lounge','medical',null]){
    pose(root,1.7);animateMilo(root,{action,time:12,moving:false});
    assert.equal(root.userData.bodySkin.geometry,original);
  }
  pose(root,1.7);animateMilo(root,{action:'lounge',leisure:'tablet',time:3,moving:false});
  assert.equal(root.userData.tabletHandFit.original,original);
});
