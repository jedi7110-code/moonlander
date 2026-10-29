import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {MeshStandardMaterial,Vector3} from 'three';
import {createMilo,animateMilo} from '../src/obs/characters.js';
import {loadMiloBody} from '../src/obs/milo-body.js';
import {applyCabinLadder,updateCabinClimb,CABIN_LADDER} from '../src/obs/cabin-ladder.js';
import {crewWalkway} from '../src/obs/cabin-walkway.js';
import {CrewMotion} from '../src/obs/state.js';
import {FLOORS,LADDER_X} from '../src/obs/layout.js';
import {positionY} from '../src/obs/ship.js';
import {LADDER} from '../src/obs/ladder-pose.js';

await loadMiloBody(`data:application/json;base64,${(await readFile(new URL('../public/assets/obs/milo/body.json',import.meta.url))).toString('base64')}`);
function scene(floor){
  const actor=new CrewMotion({floor,x:LADDER_X}),root=createMilo(new Proxy({},{get:()=>new MeshStandardMaterial()}));
  let route=null;
  function render(){
    const height=positionY(actor.y),walkway=crewWalkway(0,actor.floor,actor.facing),segment=actor.climbing?actor.queue[0]:null;
    root.position.set(0,height,walkway.z);
    route=updateCabinClimb(route,segment?{height,startHeight:positionY(FLOORS[actor.floor].y),startYaw:root.rotation.y,startDepth:walkway.z,
      endHeight:positionY(segment.y),endYaw:(Math.sign(actor.queue[1]?.x-actor.x)||actor.facing)*Math.PI/2,endDepth:crewWalkway(0,segment.floor).z}:null);
    animateMilo(root,{time:0,moving:actor.busy&&!actor.climbing,dt:0});
    const sample=route?applyCabinLadder(root,route):null;
    root.updateMatrixWorld(true);
    const points=[root.userData.head,...root.userData.arms.map(a=>a.hand),...root.userData.legs.map(l=>l.boot)].map(n=>n.getWorldPosition(new Vector3()));
    return {sample,points,route};
  }
  return {actor,root,render};
}
function travel(actor,metres){
  const start=actor.y;
  for(let i=0;i<3000&&Math.abs(actor.y-start)*.016<metres;i++)actor.update(1/120);
  assert.ok(Math.abs(actor.y-start)*.016>=metres,'reaches the test height');
}
function rungContacts(root,sample){
  for(const contact of sample.contacts.filter(c=>!c.moving)){
    const point=root.localToWorld(contact.point.clone());
    const rung=(point.y-CABIN_LADDER.rungBase)/LADDER.spacing;
    assert.ok(Math.abs(rung-Math.round(rung))<1e-7,'a held limb stays on a physical rung, not sliding with a frozen body');
  }
}

for(const [from,to,back]of [[0,2,0],[1,2,0],[1,0,1],[2,0,2],[0,2,1]]){
  test(`mid-ladder retarget ${from}->${to}->${back} keeps the height-driven gait and reaches the new destination`,()=>{
    const {actor,root,render}=scene(from);let obsolete=0,arrived=0;
    actor.goTo({floor:to,x:LADDER_X-80},()=>obsolete++);render();
    travel(actor,1.2);const before=render(),height=actor.y;
    actor.goTo({floor:back,x:LADDER_X+80},()=>arrived++);
    assert.equal(actor.y,height);assert.equal(actor.climbing,true);
    const after=render();
    after.points.forEach((point,i)=>assert.ok(point.distanceTo(before.points[i])<1e-7,'retargeting must not snap the visible pose'));
    rungContacts(root,after.sample);
    const rotations=root.userData.arms.map(a=>a.arm.quaternion.clone());
    travel(actor,.13);const moving=render();rungContacts(root,moving.sample);
    assert.ok(root.userData.arms.some((a,i)=>a.arm.quaternion.angleTo(rotations[i])>.02),'hands and arms must animate as the body moves');
    for(let i=0;i<6000&&actor.busy;i++)actor.update(1/120);
    assert.equal(actor.busy,false);assert.equal(actor.floor,back);assert.equal(actor.x,LADDER_X+80);
    assert.equal(obsolete,0);assert.equal(arrived,1);assert.equal(render().route,null);
  });
}

test('repeated ladder reversals and same-floor retargets preserve pose, pause and rung contacts',()=>{
  const {actor,root,render}=scene(0);
  actor.goTo({floor:2,x:LADDER_X-80});render();travel(actor,1.4);render();
  for(const floor of [0,0,2,0,2,1,0]){
    const before=render();actor.goTo({floor,x:LADDER_X+80});const after=render();
    after.points.forEach((point,i)=>assert.ok(point.distanceTo(before.points[i])<1e-7));
    actor.update(0);const paused=render();assert.deepEqual(paused.points,after.points);
    travel(actor,.11);rungContacts(root,render().sample);
  }
});

test('reversing during the deck transfer retraces the supported pose without a snap',()=>{
  for(const [from,to]of [[0,2],[2,0]])for(const progress of [.1,.35,.65,.95]){
    const {actor,render}=scene(from);
    actor.goTo({floor:to,x:LADDER_X-80});render();travel(actor,CABIN_LADDER.transfer*progress);
    const before=render();actor.goTo({floor:from,x:LADDER_X+80});const after=render();
    // The head may lead the reversed turn; hands and boots must retain contact.
    after.points.slice(1).forEach((point,i)=>assert.ok(point.distanceTo(before.points[i+1])<1e-7,`transfer ${from}->${to}, ${progress}, joint ${i} snaps by ${point.distanceTo(before.points[i+1])}`));
  }
});
