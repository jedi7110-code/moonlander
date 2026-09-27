import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {MeshStandardMaterial,Vector3} from 'three';
import {createMilo,animateMilo} from '../src/obs/characters.js';
import {loadMiloBody} from '../src/obs/milo-body.js';
import {applyCabinLadder,CABIN_LADDER} from '../src/obs/cabin-ladder.js';
import {LADDER,LADDER_WRIST_OFFSET} from '../src/obs/ladder-pose.js';
import {createAccessLadder,positionY} from '../src/obs/ship.js';
import {CrewMotion} from '../src/obs/state.js';
import {LADDER_PACE,LADDER_ENTRY,LADDER_LANDING} from '../src/obs/pace.js';
import {FLOORS,LADDER_X} from '../src/obs/layout.js';
await loadMiloBody(`data:application/json;base64,${(await readFile(new URL('../public/assets/obs/milo/body.json',import.meta.url))).toString('base64')}`);
const create=()=>createMilo(new Proxy({},{get:()=>new MeshStandardMaterial()}));
test('ascent and descent run twenty percent faster without speeding up walking',()=>{
  assert.equal(LADDER_PACE,1.2);
  for(const [from,to]of [[2,0],[0,2]]){
    const actor=new CrewMotion({floor:from,x:LADDER_X}),start=actor.y;
    actor.goTo({floor:to,x:LADDER_X});actor.update(LADDER_ENTRY.seconds);
    assert.ok(Math.abs(Math.abs(actor.y-start)*.016-LADDER_ENTRY.miloHeight)<1e-8);
    const mounted=actor.y;actor.update(1);
    assert.ok(Math.abs(Math.abs(actor.y-mounted)-38*1.2)<1e-8);
    assert.equal(Math.sign(actor.y-start),Math.sign(FLOORS[to].y-start));
    assert.equal(actor.walkSpeed,54);
  }
  assert.equal(new CrewMotion({climbSpeed:10}).climbSpeed,10);
});

test('mounting keeps soles on the deck until both hands grip, then transfers one foot at a time',()=>{
  const root=create();
  for(const [start,end,depth]of [[0,3.392,.78],[3.392,0,1.34],[3.392,6.784,1.34],[6.784,0,1.34]]){
    for(let i=0;i<120;i++){
      const u=i/120,height=start+Math.sign(end-start)*CABIN_LADDER.transfer*u;
      root.position.set(0,height,depth);animateMilo(root,{time:0,moving:false});
      const {entry}=applyCabinLadder(root,{height,startHeight:start,endHeight:end,startYaw:Math.PI,endYaw:Math.PI,startDepth:depth});root.updateMatrixWorld(true);
      assert.ok(entry.reachError<1e-6,`legs retain their lengths at ${start}->${end}, ${u}`);
      for(const rig of root.userData.legs){
        const sole=rig.boot.localToWorld(new Vector3(0,-.107,.12)),target=entry.feet.find(f=>f.side===rig.side);
        assert.ok(sole.distanceTo(target.point)<1e-5,'actual sole meets its support');
        if(u<=.4||rig.side===1&&u<=.62){
          assert.ok(Math.abs(sole.y-start-.003)<1e-5,'foot remains on the floor until its turn');
          assert.ok(Math.abs(sole.z-depth+.133)<1e-5,'planted foot does not slide into the opening');
        }
        if(rig.side===-1&&u>=.61&&u<=.81){
          const rung=(sole.y-LADDER.radius-CABIN_LADDER.rungBase)/LADDER.spacing;
          assert.ok(Math.abs(rung-Math.round(rung))<1e-5&&Math.abs(sole.z-CABIN_LADDER.depth)<1e-5,'first foot supports weight on a real rung');
        }
      }
      if(u>=.38)for(const c of entry.contacts){
        const wrist=root.userData.arms.find(a=>a.side===c.side).hand.getWorldPosition(new Vector3());
        const target=root.localToWorld(c.point.clone().add(LADDER_WRIST_OFFSET));
        assert.ok(wrist.distanceTo(target)<.001,`hand remains on its intended rung at ${start}->${end}, ${u}: ${wrist.distanceTo(target)}`);
      }
    }
  }
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
    const actor=new CrewMotion({floor:start===0?2:1,x:LADDER_X});actor.goTo({floor:end===0?2:1,x:LADDER_X});
    for(let i=0;i<2400;i++){
      const height=positionY(actor.y);pose(root,height,start,end);
      const points=[root.userData.head,...root.userData.arms.map(a=>a.hand),...root.userData.legs.map(l=>l.boot)].map(n=>n.getWorldPosition(new Vector3()));
      if(previous)points.forEach((p,j)=>assert.ok(p.distanceTo(previous[j])<.05,`no teleport at a deck transfer: ${start}->${end}, frame ${i}, joint ${j}, delta ${p.distanceTo(previous[j])}`));
      previous=points;
      if(Math.abs(height-end)<1e-9)break;
      actor.update(1/120);
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

test('descending onto either deck steps straight backwards with planted feet and held hands',()=>{
  const root=create();
  for(const [end,depth]of [[0,.78],[3.392,1.34]]){
  let planted=null,firstAt=null,secondAt=null;
  for(let i=0;i<=200;i++){
    const u=i/200,height=end+CABIN_LADDER.transfer*(1-u);
    root.position.set(0,height,.78);animateMilo(root,{time:0,moving:false});
    const {landing}=applyCabinLadder(root,{height,startHeight:6.784,endHeight:end,startYaw:Math.PI,endYaw:-Math.PI/2,endDepth:depth});root.updateMatrixWorld(true);
    assert.ok(landing&&landing.reachError<1e-6,'both legs can reach without stretching');
    const soles=root.userData.legs.map(r=>({side:r.side,p:r.boot.localToWorld(new Vector3(0,-.107,.12))}));
    const first=soles.find(f=>f.side===1).p,second=soles.find(f=>f.side===-1).p;
    for(const {side,p}of soles){
      assert.ok(p.y>=end+.003-1e-6,'no floor penetration');
      assert.ok(Math.abs(p.x+side*.1)<1e-6,'step backwards, without a sideways drift');
      assert.ok(p.distanceTo(landing.feet.find(f=>f.side===side).point)<1e-6,'actual boot meets the target');
    }
    if(u>=.14&&u<=.39){
      const rung=(second.y-CABIN_LADDER.rungBase-LADDER.radius)/LADDER.spacing;
      assert.ok(Math.abs(rung-Math.round(rung))<1e-6&&Math.abs(second.z-.03)<1e-6,'following foot supports weight on a real rung');
    }
    if(u>=.38){planted??=first.clone();assert.ok(first.distanceTo(planted)<1e-6,'planted foot must not slide while the second descends');}
    if(firstAt===null&&first.y<end+.00301)firstAt=u;
    if(secondAt===null&&second.y<end+.00301)secondAt=u;
    if(u>=.21&&u<=.62)for(const c of landing.contacts){
      const hand=root.userData.arms.find(a=>a.side===c.side).hand;
      const target=root.localToWorld(c.point.clone().add(LADDER_WRIST_OFFSET));
      assert.ok(hand.getWorldPosition(new Vector3()).distanceTo(target)<.001,'hold the ladder until both feet have landed');
      const grip=root.localToWorld(c.point.clone());
      assert.ok(Math.abs(grip.z-CABIN_LADDER.depth)<1e-6,'body movement does not drag the hands off the ladder');
    }
    assert.equal(root.rotation.y,Math.PI,'do not turn away before landing');
  }
  assert.ok(secondAt-firstAt>.2,'two distinct footfalls with a supported weight transfer');
  assert.ok(Math.abs(planted.z-(depth-.133))<1e-6,'land on the bridge behind the opening');
  }
});

test('bottom landing uses the same planted-foot pose when paused or scrubbed backwards',()=>{
  const root=create(),fresh=create();
  for(const u of [.8,.2,.6,.45])pose(root,CABIN_LADDER.transfer*(1-u),3.392,0);
  pose(fresh,CABIN_LADDER.transfer*.55,3.392,0);
  for(let i=0;i<2;i++)assert.ok(root.userData.legs[i].boot.getWorldPosition(new Vector3()).distanceTo(fresh.userData.legs[i].boot.getWorldPosition(new Vector3()))<1e-8);
  const actor=new CrewMotion({floor:1,x:LADDER_X});actor.y=FLOORS[2].y-CABIN_LADDER.transfer/.016;
  actor.goTo({floor:2,x:LADDER_X});const before=actor.y;actor.update(.1);
  assert.ok(Math.abs(actor.y-before-LADDER_LANDING.height/.016/LADDER_LANDING.seconds*.1)<1e-8,'the final transfer takes three seconds');
});
