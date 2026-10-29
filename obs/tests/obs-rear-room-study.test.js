import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as THREE from 'three';
import {loadMiloBody} from '../src/obs/milo-body.js';
import {createMilo} from '../src/obs/characters.js';
import {REAR_JOBS,VISIT_DURATION,RearRoomVisits,sampleRearVisit,prepareRearRoomMotion} from '../studies/milo/rear-room-model.js';

test('visits finish before the randomized interval, alternate rooms, and retain elapsed time',()=>{
  const visits=new RearRoomVisits(()=>.5);visits.advance(52);
  assert.equal(visits.waiting,true);assert.equal(visits.wait,180);assert.equal(visits.completed,1);
  visits.advance(179);assert.equal(visits.room,'operations');assert.equal(visits.wait,1);
  visits.advance(3);assert.equal(visits.room,'stores');assert.equal(visits.time,2);assert.equal(visits.waiting,false);
  const snapshot=JSON.stringify(visits);visits.advance(0);assert.equal(JSON.stringify(visits),snapshot);
  visits.advance(230);assert.equal(visits.room,'operations');assert.equal(visits.time,0);assert.equal(visits.completed,2);
  for(const random of [0,1]){const v=new RearRoomVisits(()=>random);v.advance(52);assert.ok(v.wait>=120&&v.wait<=240);}
});

test('the crew walks through the aperture, clears furniture, then retraces the passage',()=>{
  for(const id of Object.keys(REAR_JOBS)){
    let previous=sampleRearVisit(id,0);
    for(let t=.02;t<=VISIT_DURATION;t+=.02){
      const current=sampleRearVisit(id,t),{position:p}=current;
      assert.equal(p.y,.11);assert.ok(p.toArray().every(Number.isFinite));
      assert.ok(p.distanceTo(previous.position)<.035,'no teleport during turns or door crossing');
      assert.ok(current.walkDistance>=previous.walkDistance-1e-8);
      if(p.z<-.9&&p.z>-2.6)assert.ok(Math.abs(p.x)<.15,'body clears both octagonal frames');
      if(p.z< -2.6)assert.ok(p.x>-.56&&p.x<.05,'body stays between side shelves and bench');
      previous=current;
    }
    const start=sampleRearVisit(id,0),end=sampleRearVisit(id,52);
    assert.ok(start.position.distanceTo(end.position)<1e-8);assert.equal(end.done,true);
    for(const t of [17,25,32])assert.equal(sampleRearVisit(id,t).moving,false);
  }
});

await loadMiloBody(`data:application/json;base64,${(await readFile(new URL('../public/assets/obs/milo/body.json',import.meta.url))).toString('base64')}`);
const m=new Proxy({},{get:(o,k)=>o[k]??=new THREE.MeshStandardMaterial()});
const milo=createMilo(m,new THREE.Group()),motion=prepareRearRoomMotion(milo);
test('the pointing finger reaches the actual equipment while elbows and wrists stay clear of the ribs',()=>{
  for(const room of Object.keys(REAR_JOBS))for(let t=15;t<=35;t+=.05){
    const state=motion.update(room,t),{body,arms}=milo.userData,rig=arms[0];
    assert.ok(Math.abs(rig.elbow.rotation.y)<1e-7&&Math.abs(rig.elbow.rotation.z)<1e-7);
    for(const r of arms)for(const joint of [r.arm,r.elbow,r.hand])assert.ok(joint.quaternion.toArray().every(Number.isFinite));
    if(state.reach>.999){
      const fingertip=rig.hand.localToWorld(state.contact.clone());
      assert.ok(fingertip.distanceTo(state.target)<.002,`${room} fingertip misses target at ${t}: ${fingertip.distanceTo(state.target)}`);
      const elbow=body.worldToLocal(rig.elbow.getWorldPosition(new THREE.Vector3()));
      assert.ok((elbow.x/.24)**2+(elbow.z/.18)**2>1,'working elbow stays outside the torso, including arm thickness');
      const wrist=body.worldToLocal(rig.hand.getWorldPosition(new THREE.Vector3()));
      assert.ok(wrist.z>.18,'working hand stays ahead of the chest');
    }
  }
});

test('seeking gives the same pose and reaches move without joint snaps',()=>{
  const snapshot=()=>milo.userData.arms.flatMap(r=>[r.arm,r.elbow,r.hand].flatMap(j=>j.quaternion.toArray()));
  for(const room of Object.keys(REAR_JOBS)){
    motion.update(room,18);const expected=snapshot();motion.update(room,49);motion.update(room,0);motion.update(room,18);assert.deepEqual(snapshot(),expected);
    let last=null;
    for(let frame=14*60;frame<=35*60;frame++){
      motion.update(room,frame/60);const rotations=milo.userData.arms.flatMap(r=>[r.arm,r.elbow,r.hand].map(j=>j.quaternion.clone()));
      if(last)rotations.forEach((q,i)=>assert.ok(q.angleTo(last[i])<.10,`${room} joint ${i} jumps at ${frame/60}`));last=rotations;
    }
  }
});
