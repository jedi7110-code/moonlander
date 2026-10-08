import test from 'node:test';
import assert from 'node:assert/strict';
import {Box3,MeshStandardMaterial,Vector3} from 'three';
import {createMilo,animateMilo} from '../src/obs/characters.js';
import {BUNK_BED,reclineProgress} from '../src/obs/recline.js';
import {MED_BED,medicalDuration} from '../src/obs/medical.js';
import {BunkVisit} from '../src/obs/bunk-visit.js';
import {CabinBrain,OPENING_SLEEP_SECONDS} from '../src/obs/brain.js';
import {CrewMotion,Supplies,CatRoutine,getStation,advanceCabinTraffic} from '../src/obs/state.js';
import {CabinStartupLighting} from '../src/obs/startup-lighting.js';

const character=()=>createMilo(new Proxy({},{get:()=>new MeshStandardMaterial()}));
const pose=(root,action,time,duration=9)=>{
  animateMilo(root,{action,moving:false,climbing:false,facing:1,time,actionTime:time,actionDuration:duration});
  root.updateMatrixWorld(true);
};

test('sleep and examination retain the same supported torso and legs while sleep rests the hands on the abdomen',()=>{
  const sleeper=character(),patient=character(),visit=new BunkVisit();visit.update(30);
  animateMilo(sleeper,{action:'bunk',moving:false,time:0,bunkVisit:visit});pose(patient,'medical',17,medicalDuration());
  const a=sleeper.userData,b=patient.userData;
  assert.deepEqual(a.body.rotation.toArray(),b.body.rotation.toArray());
  assert.deepEqual(sleeper.rotation.toArray(),patient.rotation.toArray());
  assert.ok(Math.abs(b.body.position.y-a.body.position.y-(MED_BED.examTop-BUNK_BED.top))<1e-10);
  for(let i=0;i<2;i++)for(const joint of ['leg','knee','boot']){
    const aa=a.legs[i][joint].rotation,bb=b.legs[i][joint].rotation;
    for(const axis of ['x','y','z'])assert.ok(Math.abs(aa[axis]-bb[axis])<1e-9);
  }
  sleeper.updateMatrixWorld(true);
  for(const {hand,elbow,side}of a.arms){
    const palm=a.body.worldToLocal(hand.localToWorld(new Vector3(0,-.05,0)));
    assert.ok(Math.abs(palm.x)<.13&&palm.y>1.10&&palm.y<1.27,'both palms rest over the abdomen');
    assert.ok(palm.z>.12&&palm.z<.16,'hands sit close to the shirt, without hanging beside the body');
    const fingers=new Vector3(0,-1,0).transformDirection(hand.matrixWorld);
    const inward=new Vector3(-side,0,0).transformDirection(a.body.matrixWorld);
    assert.ok(fingers.dot(inward)>.9,'fingers point inward across the abdomen');
    assert.ok(Math.abs(elbow.rotation.x)>.8,'the elbows bend comfortably');
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
  const fresh=character();animateMilo(fresh,{action:null,moving:true,climbing:false,facing:1,time:10});
  assert.deepEqual(milo.userData.body.quaternion.toArray(),fresh.userData.body.quaternion.toArray());
  assert.deepEqual(milo.userData.body.position.toArray(),fresh.userData.body.position.toArray());
  assert.equal(milo.visible,true);assert.equal(milo.userData.mug.visible,false);
});

test('opening sleep starts both rested without refilling other needs or resetting ordinary sleep',()=>{
  for(const value of [0,.25,.5,.99]){
    const care=new Supplies(),actor=new CrewMotion(),cat=new CatRoutine(care,{random:()=>value});
    const brain=new CabinBrain({obsUI:{hideWant(){}}},actor,{care,random:()=>value});brain.catRoutine=cat;
    const needs={...brain.needs},exercise=brain.exercise;
    const catNeeds={hunger:cat.hunger,groomNeed:cat.groomNeed,curiosity:cat.curiosity};
    assert.equal(brain.beginWakeUp({waitForActivation:true}),true);
    assert.deepEqual(brain.needs,{...needs,energy:100});assert.equal(brain.statusNeeds.energy,100);
    assert.equal(cat.energy,100);assert.equal(brain.exercise,exercise);
    assert.deepEqual({hunger:cat.hunger,groomNeed:cat.groomNeed,curiosity:cat.curiosity},catNeeds);
    brain.update(60);cat.update(60,actor);
    assert.equal(brain.needs.energy,100);assert.equal(cat.energy,100,'dark standby does not drain rested sleepers');
    brain.needs.energy=80;assert.equal(brain.beginWakeUp(),false);assert.equal(brain.needs.energy,80,'duplicate opening is not an energy refill');
    const ordinary=new CatRoutine(care,{random:()=>value});ordinary.energy=30;ordinary.rest('sleep',20);
    assert.equal(ordinary.energy,30);ordinary.update(2);assert.equal(ordinary.energy,36,'normal sleep still recovers gradually');
  }
});

test('the cabin opens with Milo and Lucy asleep together, then wakes and releases both',()=>{
  const actor=new CrewMotion(),care=new Supplies(),cat=new CatRoutine(care,{random:()=>.5,turns:true});
  const brain=new CabinBrain({obsUI:{hideWant(){}}},actor,{care,random:()=>.5});brain.catRoutine=cat;
  assert.equal(brain.beginWakeUp(),true);assert.equal(brain.bunkVisit.phase,'sleeping');assert.equal(cat.mode,'sleep');
  assert.equal(actor.floor,getStation('bunk').floor);assert.equal(actor.x,getStation('bunk').x);assert.ok(cat.bunkWake);
  brain.update(OPENING_SLEEP_SECONDS-.1);assert.equal(brain.bunkVisit.phase,'sleeping');
  brain.update(.2);assert.equal(brain.bunkVisit.phase,'waking');
  for(let i=0;i<1800&&brain.bunkVisit;i++){cat.update(1/60,actor);brain.update(1/60);}
  assert.equal(brain.bunkVisit,null);assert.equal(brain.openingWake,null);assert.equal(cat.bunkWake,null);assert.equal(brain.state,'idle');assert.equal(cat.mode,'walk');
});

test('click standby keeps both asleep while ship time advances, and lighting activation releases one normal wake-up',()=>{
  const actor=new CrewMotion(),care=new Supplies(),cat=new CatRoutine(care,{random:()=>.5,turns:true,mouseChase:true});
  const brain=new CabinBrain({obsUI:{hideWant(){}}},actor,{care,random:()=>.5});brain.catRoutine=cat;
  brain.beginWakeUp({waitForActivation:true});
  const lights=new CabinStartupLighting([],{waitForActivation:true});
  const clock=brain.clock,needs={...brain.statusNeeds},x=actor.x,catX=cat.motion.x,pose=brain.bunkVisit.pose;
  const step=dt=>{care.update(dt);advanceCabinTraffic(actor,cat,dt);brain.update(dt);lights.update(dt);};
  for(let i=0;i<60*60;i++)step(1/60);
  assert.ok(Math.abs(brain.clock-(clock+60000)%brain.dayMs)<.001,'ship clock keeps running');
  assert.ok(brain.environment.clock>59);assert.ok(brain.plants.rows[0].growth>.9);
  assert.equal(brain.openingWake.age,0);assert.equal(brain.openingWake.waiting,true);
  assert.equal(brain.bunkVisit.phase,'sleeping');assert.deepEqual(brain.bunkVisit.pose,pose);
  assert.equal(cat.mode,'sleep');assert.equal(cat.motion.x,catX);assert.equal(actor.x,x);
  assert.equal(cat.motion.busy,false);assert.equal(actor.busy,false);assert.equal(cat.mouseChase.controlled,false);
  assert.deepEqual(brain.statusNeeds,needs);assert.equal(lights.time,0);
  // Even a very long dark wait must not force either sleeper into an activity.
  step(3600);assert.equal(brain.bunkVisit.phase,'sleeping');assert.equal(cat.mode,'sleep');assert.deepEqual(brain.statusNeeds,needs);
  assert.equal(lights.activate(),true);assert.equal(brain.releaseOpeningSleep(),true);
  assert.equal(brain.bunkVisit.phase,'waking');assert.equal(brain.bunkVisit.age,0);
  step(1);const age=brain.bunkVisit.age;
  assert.equal(lights.activate(),false);assert.equal(brain.releaseOpeningSleep(),false);assert.equal(brain.bunkVisit.age,age);
  // Avoid an unrelated maintenance fault, accumulated during the long wait.
  brain.environment.fault=null;brain.environment.nextFault=Infinity;
  for(let i=0;i<1800&&brain.bunkVisit;i++)step(1/60);
  assert.equal(brain.openingWake,null);assert.equal(brain.bunkVisit,null);assert.equal(cat.bunkWake,null);
  assert.equal(cat.mode,'walk');assert.equal(lights.done,true);lights.dispose();
});

test('orders received during opening standby wait until the sleepers are released',()=>{
  const actor=new CrewMotion(),care=new Supplies(),cat=new CatRoutine(care,{random:()=>.5});
  const brain=new CabinBrain({obsUI:{hideWant(){}}},actor,{care,random:()=>.5});brain.catRoutine=cat;
  brain.beginWakeUp({waitForActivation:true});brain._go(getStation('hydro'));brain._endPerform();
  brain.update(60);cat.update(60,actor);
  assert.equal(brain.bunkVisit.phase,'sleeping');assert.equal(brain.bunkVisit.exitRequested,false);assert.equal(cat.mode,'sleep');assert.equal(actor.busy,false);
  brain.releaseOpeningSleep();
  for(let i=0;i<1800&&brain.bunkVisit;i++){cat.update(1/60,actor);brain.update(1/60);}
  assert.equal(brain.actStation,'hydro');assert.equal(actor.busy,true);
});

test('Lucy leaves after landing, before Milo finishes rising, without a heading snap or a second release',()=>{
  const actor=new CrewMotion(),care=new Supplies(),cat=new CatRoutine(care,{random:()=>.5,turns:true});
  const brain=new CabinBrain({obsUI:{hideWant(){}}},actor,{care,random:()=>.5});brain.catRoutine=cat;brain.beginWakeUp();
  const startX=cat.motion.x;let released=false,walkedAhead=false,lastYaw=cat.poseYaw;
  for(let i=0;i<1800&&brain.bunkVisit;i++){
    const visit=brain.bunkVisit;
    if(cat.bunkWake&&['sleeping','waking','leaving'].includes(visit.phase))assert.equal(cat.motion.x,startX,'no horizontal departure before landing');
    const held=cat.bunkWake;cat.update(0,actor);assert.equal(cat.bunkWake,held,'pause must not release the cat');
    cat.update(1/60,actor);
    if(held&&!cat.bunkWake){
      released=true;assert.equal(visit.phase,'rising');assert(visit.age>=.45&&visit.age<.48);
      assert.equal(cat.mode,'walk');assert(cat.motion.busy);assert.equal(cat.bunkHop,null);
    }
    if(visit.phase==='rising'&&cat.motion.x>startX+1)walkedAhead=true;
    const yaw=cat.poseYaw;assert(Math.abs(Math.atan2(Math.sin(yaw-lastYaw),Math.cos(yaw-lastYaw)))<.08,'turn continuously from the landing direction');lastYaw=yaw;
    brain.update(1/60);
  }
  assert(released&&walkedAhead,'Lucy must already be walking while Milo is rising');
  const destination=cat.motion.destination,version=cat.motion.commandVersion;
  cat.finishBunkWake();assert.equal(cat.motion.destination,destination);assert.equal(cat.motion.commandVersion,version);
  assert(cat.motion.x>startX+100);
});
