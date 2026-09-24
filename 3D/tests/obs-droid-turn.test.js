import test from 'node:test';
import assert from 'node:assert/strict';
import {Group,Vector3,Quaternion} from 'three';
import {createDroid,DROID_SPEC} from '../src/obs/droid-model.js';
import {DroidRoutine} from '../src/obs/droid-routine.js';
import {sampleDroidServicePose} from '../src/obs/droid-service.js';
import {planDroidTurn,sampleDroidTurn} from '../src/obs/droid-turn.js';
import {Supplies} from '../src/obs/state.js';
import {PlantBed} from '../src/obs/plant-state.js';

test('pivot steps lift alternating feet while planted soles retain their world position and heading',()=>{
  const droid=createDroid({detail:'obs'}),navigation=new Group();navigation.add(droid.root);navigation.position.set(2,3,-1);
  try{
    for(const delta of [Math.PI/2,-Math.PI/2,Math.PI,-Math.PI,.18]){
      const turn=planDroidTurn(2.9,2.9+delta),previous=[null,null],lifted=[0,0];
      for(let frame=0;frame<=turn.steps*40;frame++){
        const age=turn.duration*frame/(turn.steps*40),pivot=sampleDroidTurn(turn,age);
        const pose=sampleDroidServicePose({turn,age,duration:turn.duration,rest:0});
        droid.update(age,'service',pose);navigation.rotation.y=pivot.yaw;navigation.updateMatrixWorld(true);
        let supports=0;
        for(const [i,leg]of droid.legs.entries()){
          const point=leg.foot.getWorldPosition(new Vector3()),rotation=leg.foot.getWorldQuaternion(new Quaternion());
          const grounded=Math.abs(point.y-3.099)<1e-7;
          if(grounded){
            supports++;
            if(previous[i]?.grounded){
              assert.ok(point.distanceTo(previous[i].point)<1e-7,'planted sole must not skate during body rotation');
              assert.ok(rotation.angleTo(previous[i].rotation)<1e-6,'planted sole must not spin with the body');
            }
          }else if(point.y>3.13)lifted[i]++;
          assert.ok(point.y>=3.099-1e-7,'foot must not penetrate the deck');
          for(const [part,length,next]of [[leg.upper,DROID_SPEC.upperLeg,leg.middle],[leg.middle,DROID_SPEC.middleLeg,leg.lower],[leg.lower,DROID_SPEC.lowerLeg,leg.foot]]){
            assert.ok(part.localToWorld(new Vector3(0,-length,0)).distanceTo(next.getWorldPosition(new Vector3()))<1e-6,'rigid leg links remain attached');
          }
          previous[i]={point,rotation,grounded};
        }
        assert.ok(supports>=1,'at least one foot supports the turning body');
      }
      assert.ok(lifted.every(n=>n>0),'both feet step rather than using a stationary pivot');
      const end=sampleDroidTurn(turn,turn.duration);
      assert.ok(Math.abs(end.yaw-turn.to)<1e-10);
      for(const [i,side]of [-1,1].entries()){
        assert.ok(new Vector3(...end.feet[i]).distanceTo(new Vector3(side*.137,.099,.045))<1e-9);
        assert.ok(Math.abs(end.footYaws[i])<1e-10);
      }
    }
  }finally{droid.dispose();}
});

test('the live routine carries walking footprints into a turn and finishes before the next walk',()=>{
  const care=new Supplies(),brain={plants:new PlantBed(),actStation:null};
  const routine=new DroidRoutine({care,brain,actor:{x:1040,climbing:false},cat:{mode:'sleep'}});
  assert.ok(routine.request('feed'));
  for(let i=0;i<1000&&routine.step.kind!=='turn';i++)routine.update(.01);
  assert.equal(routine.step.kind,'turn');
  const turn=routine.step.turn,entry=turn.entryWalk;
  assert.ok(entry,'arrival footprints must be captured');
  const walk=sampleDroidServicePose({walking:true,walkDistance:entry.distance,age:entry.age,duration:entry.age,rest:0});
  const start=sampleDroidServicePose(routine.pose);
  assert.ok(Math.abs(routine.position.yaw-turn.from)<1e-10);
  start.feet.forEach((point,i)=>assert.ok(new Vector3(...point).distanceTo(new Vector3(...walk.feet[i]))<1e-9,'no foot jump on arrival'));
  const before=routine.pose;routine.update(0);assert.deepEqual(routine.pose,before);
  while(routine.step.kind==='turn'){
    assert.ok(Math.abs(routine.position.yaw-sampleDroidTurn(turn,routine.age).yaw)<1e-10);
    routine.update(.01);
  }
  assert.equal(routine.step.kind,'walk');assert.ok(Math.abs(routine.position.yaw-turn.to)<1e-10);
  const next=sampleDroidServicePose(routine.pose);
  next.feet.forEach((point,i)=>assert.ok(new Vector3(...point).distanceTo(new Vector3(i? .137:-.137,.099,.045))<1e-9,'next walk starts from the planted turn finish'));
});
