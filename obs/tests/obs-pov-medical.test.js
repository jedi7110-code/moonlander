import test from 'node:test';
import assert from 'node:assert/strict';
import {MeshStandardMaterial,PerspectiveCamera,Vector3,Quaternion} from 'three';
import {medicalView} from '../studies/pov/medical-view.js';
import {medicalDuration,MED_BED} from '../src/obs/medical.js';
import {createMilo,animateMilo} from '../src/obs/characters.js';
import {HeadLookRig} from '../studies/pov/look.js';
import {StableFirstPersonCamera} from '../studies/pov/comfort.js';

test('treatment locks the lying head without closing eyes and releases on leaving the couch',()=>{
  const duration=medicalDuration(),brain={state:'performing',cur:{id:'medical'},curDurSec:duration,performT:duration};
  assert.equal(medicalView(brain).locked,false);
  brain.performT=duration-MED_BED.transition-1;
  assert.deepEqual(medicalView(brain),{active:true,locked:true,recline:1});
  assert.equal(medicalView(brain,'cat').active,false);
  brain.reclineExit={id:'medical',actionDuration:duration,entryTime:MED_BED.transition,age:0};
  assert.equal(medicalView(brain).locked,true);
  brain.reclineExit.age=MED_BED.transition;
  assert.equal(medicalView(brain).locked,false);
  brain.reclineExit=null;brain.state='idle';assert.equal(medicalView(brain).active,false);
});

test('the medical camera follows the authored head pose and ignores look input while lying',()=>{
  const material=new MeshStandardMaterial(),root=createMilo(new Proxy({},{get:()=>material}));
  const neutral=new Vector3(0,1.73,.12),rig=new HeadLookRig(root.userData.head,root.userData.body,root.userData.head.worldToLocal(neutral.clone()));
  const camera=new PerspectiveCamera(),comfort=new StableFirstPersonCamera(root,neutral),duration=medicalDuration();let first;
  for(const [yaw,pitch]of [[0,0],[1,.6],[-1,-.8]]){
    rig.restore();animateMilo(root,{moving:false,climbing:false,action:'medical',facing:1,time:20,actionTime:MED_BED.transition+1,actionDuration:duration});
    rig.apply(0,0);
    comfort.update(camera,{eye:rig.eyePosition(),yaw,pitch,dt:1/60,recline:1,attachedOrientation:rig.orientation()});
    if(first)assert.ok(camera.quaternion.angleTo(first)<1e-7);first=camera.quaternion.clone();
    const actual=rig.orientation().multiply(new Quaternion().setFromAxisAngle(new Vector3(0,1,0),Math.PI));
    assert.ok(camera.quaternion.angleTo(actual)<1e-7);
  }
});
