import test from 'node:test';
import assert from 'node:assert/strict';
import {MeshStandardMaterial,Vector3} from 'three';
import {createMilo,animateMilo} from '../src/obs/characters.js';
import {callingWeight} from '../src/obs/calling.js';

const character=()=>createMilo(new Proxy({},{get:()=>new MeshStandardMaterial()}));
const pose=(root,age,extra={})=>animateMilo(root,{moving:false,climbing:false,facing:1,action:null,time:age??4,callingTime:age,...extra});

test('the invitation raises one hand once, then rests for the remaining call',()=>{
  const root=character(),[resting,raised]=root.userData.arms;
  root.rotation.y=Math.PI;
  let previous=null,maxHandHeight=0;
  for(let frame=0;frame<16*60;frame++){
    const age=frame/60;pose(root,age);root.updateMatrixWorld(true);
    const wrist=raised.hand.getWorldPosition(new Vector3());
    maxHandHeight=Math.max(maxHandHeight,wrist.y);
    assert.equal(resting.arm.rotation.x,-.05);assert.equal(resting.elbow.rotation.x,-.08);
    if(previous)assert.ok(wrist.distanceTo(previous)<.018,'no abrupt arm raises or drops');
    previous=wrist;
    for(const {leg,knee}of root.userData.legs){assert.equal(leg.rotation.x,0);assert.equal(knee.rotation.x,0);}
    if(age>=5){assert.equal(raised.arm.rotation.x,-.05);assert.equal(raised.elbow.rotation.x,-.08);}
  }
  assert.ok(maxHandHeight>1.36&&maxHandHeight<1.50,'hand stays at chest height, below the face');
});

test('calling turns directly toward the console from either approach and stays there',()=>{
  for(const facing of [-1,1]){
    const root=character();root.rotation.y=facing*Math.PI/2;
    let previous=root.rotation.y;
    for(let frame=0;frame<16*60;frame++){
      pose(root,frame/60,{facing});
      const yaw=root.rotation.y;
      assert.ok((yaw-previous)*facing>=-1e-12,'turn toward the rear wall, not toward the viewer');
      assert.ok(Math.abs(yaw-previous)<.20,'no abrupt turn');previous=yaw;
    }
    assert.ok(Math.abs(Math.cos(root.rotation.y)+1)<1e-9);
    pose(root,null,{facing});assert.equal(root.rotation.y,previous,'keep facing the console after the call');
  }
});

test('gesture easing starts and ends at rest without repeated pulses',()=>{
  assert.equal(callingWeight(null),0);assert.equal(callingWeight(0),0);assert.equal(callingWeight(2.05),1);
  for(const age of [3.65,4,8,15])assert.equal(callingWeight(age),0);
  for(const boundary of [.45,1.85,2.25,3.65])assert.ok(Math.abs(callingWeight(boundary-.0001)-callingWeight(boundary+.0001))<.000001);
});

test('acknowledging mid-gesture lowers the arm gradually and releases it for walking',()=>{
  const root=character();
  for(let frame=0;frame<100;frame++)pose(root,frame/60);
  const before=root.userData.arms[1].elbow.rotation.x;
  pose(root,null);const after=root.userData.arms[1].elbow.rotation.x;
  assert.ok(after>before&&after-before<.32,'the hand does not instantly drop on acknowledgment');
  for(let frame=0;frame<90;frame++)pose(root,null,{moving:true,walkDistance:frame*.015});
  assert.equal(root.userData.callingWeight,0);
  const fresh=character();pose(fresh,null,{moving:true,walkDistance:89*.015});
  for(let i=0;i<2;i++)assert.deepEqual(root.userData.arms[i].arm.rotation.toArray(),fresh.userData.arms[i].arm.rotation.toArray());
});

test('pause freezes the gesture and unrelated activities never trigger it',()=>{
  const root=character();
  for(let frame=0;frame<95;frame++)pose(root,frame/60);
  const weight=root.userData.callingWeight;pose(root,1.6,{dt:0});assert.equal(root.userData.callingWeight,weight);
  for(const extra of [{moving:true},{action:'hydro'},{action:'lounge'}]){
    const fresh=character();pose(fresh,1.6,extra);assert.equal(fresh.userData.callingWeight,0);
  }
});
