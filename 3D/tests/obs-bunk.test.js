import test from 'node:test';
import assert from 'node:assert/strict';
import {Box3,MeshStandardMaterial,Vector3} from 'three';
import {createMilo,animateMilo} from '../src/obs/characters.js';
import {BUNK_BED,reclineProgress} from '../src/obs/recline.js';
import {MED_BED} from '../src/obs/medical.js';

const character=()=>createMilo(new Proxy({},{get:()=>new MeshStandardMaterial()}));
const pose=(root,action,time,duration=9)=>{
  animateMilo(root,{action,moving:false,climbing:false,facing:1,time,actionTime:time,actionDuration:duration});
  root.updateMatrixWorld(true);
};

test('sleep uses the examination pose, with only the support height changed',()=>{
  const sleeper=character(),patient=character();
  for(const time of [0,.25,1,2,4.5,7,8,9]){
    pose(sleeper,'bunk',time);pose(patient,'medical',time);
    const a=sleeper.userData,b=patient.userData,progress=reclineProgress(time,9);
    assert.deepEqual(a.body.rotation.toArray(),b.body.rotation.toArray());
    assert.deepEqual(sleeper.rotation.toArray(),patient.rotation.toArray());
    assert.ok(Math.abs(b.body.position.y-a.body.position.y-(MED_BED.top-BUNK_BED.top)*progress)<1e-10);
    for(const key of ['arms','legs'])for(let i=0;i<2;i++)for(const joint of key==='arms'?['arm','elbow']:['leg','knee','boot']){
      assert.deepEqual(a[key][i][joint].rotation.toArray(),b[key][i][joint].rotation.toArray());
    }
  }
});

test('the sleeper faces up, fits along the bunk, and rests at blanket height',()=>{
  const milo=character();pose(milo,'bunk',4.5);milo.position.z=BUNK_BED.depth;milo.updateMatrixWorld(true);
  const {body,head,hips}=milo.userData;
  const front=body.localToWorld(new Vector3(0,1,1)).sub(body.localToWorld(new Vector3(0,1,0)));
  assert.ok(front.y>.999);assert.ok(Math.abs(front.z)<1e-10);
  const bounds=new Box3().setFromObject(milo);
  assert.ok(bounds.min.x>=-BUNK_BED.length/2);assert.ok(bounds.max.x<=BUNK_BED.length/2);
  assert.ok(bounds.min.z>=BUNK_BED.depth-BUNK_BED.width/2);assert.ok(bounds.max.z<=BUNK_BED.depth+BUNK_BED.width/2);
  const hipBounds=new Box3().setFromObject(hips);assert.ok(Math.abs(hipBounds.min.y-BUNK_BED.top)<.005);
  assert.ok(head.getWorldPosition(new Vector3()).x<-.6,'head rests at the pillow end');
  assert.equal(body.rotation.z,0);
});

test('sleep lowers and rises continuously, then walking resets every pose transform',()=>{
  assert.equal(reclineProgress(0,9),0);assert.equal(reclineProgress(2,9),1);assert.equal(reclineProgress(7,9),1);assert.equal(reclineProgress(9,9),0);
  assert.equal(reclineProgress(20,36),1);assert.equal(reclineProgress(36,36),0);
  const milo=character();let previous=null;
  for(let frame=0;frame<=9*60;frame++){
    pose(milo,'bunk',frame/60);const hips=milo.userData.hips.getWorldPosition(new Vector3());
    if(previous)assert.ok(hips.distanceTo(previous)<.015);previous=hips;
  }
  pose(milo,'bunk',4.5);
  animateMilo(milo,{action:null,moving:true,climbing:false,facing:1,time:10});
  assert.deepEqual(milo.userData.body.rotation.toArray().slice(0,3),[0,0,0]);
  assert.equal(milo.userData.body.position.x,0);assert.equal(milo.userData.body.position.z,0);
  assert.equal(milo.visible,true);assert.equal(milo.userData.mug.visible,false);
});
