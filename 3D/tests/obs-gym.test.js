import test from 'node:test';
import assert from 'node:assert/strict';
import {MeshStandardMaterial,Vector3} from 'three';
import {CabinBrain} from '../src/obs/brain.js';
import {CrewMotion,Supplies,currentAction,getStation} from '../src/obs/state.js';
import {getStation as originalStation} from '../../js/obs/layout.js?v=15';
import {createMilo,animateMilo} from '../src/obs/characters.js';
import {BIKE,createGym,animateGym,pedalPosition} from '../src/obs/gym.js';
import {CABIN_PACE} from '../src/obs/pace.js';
import {GymVisit,GYM_MOUNT_SECONDS} from '../src/obs/gym-visit.js';

function setup(){const actor=new CrewMotion({floor:2,x:840}),care=new Supplies(),brain=new CabinBrain({obsUI:{hideWant(){}}},actor,{care});return{actor,brain,care};}
test('the gym is a 3D-only station and leaves the six original needs intact',()=>{
  const {brain}=setup();assert.equal(originalStation('gym'),undefined);assert.equal(getStation('gym').floor,2);
  assert.equal(Object.keys(brain.needs).length,6);assert.equal(Object.keys(brain.statusNeeds).length,8);
  const before=brain.exercise;brain.state='goingTo';brain.update(20);assert.equal(brain.exercise,before-4*CABIN_PACE.needDecay);
  for(const value of Object.values(brain.statusNeeds))assert.ok(Number.isFinite(value));
});
test('exercise deficiency causes an autonomous visit without overriding urgent physical needs',()=>{
  const {brain}=setup();brain.exercise=20;brain._choose();assert.equal(brain.actStation,'gym');
  brain._toIdle();brain.needs.thirst=10;brain._choose();assert.equal(brain.actStation,'hydro');
  brain._toIdle();brain.needs.thirst=70;brain.needs.energy=15;brain._choose();assert.equal(brain.actStation,'bunk');
});
test('cycling replenishes exercise but consumes energy, water and hygiene',()=>{
  const {brain,actor}=setup();brain.exercise=20;brain._go(getStation('gym'));actor.update(1/60);
  assert.equal(currentAction(brain),'gym');brain.health.nextIncident=Infinity;
  const mounting=brain.exercise;brain.update(GYM_MOUNT_SECONDS);assert.ok(brain.exercise<mounting);
  const before={...brain.needs};
  for(let i=0;i<8*60;i++)brain.update(1/60);
  assert.ok(brain.exercise>=69);
  for(const [key,rate]of [['energy',.6],['thirst',.35],['hygiene',.55]])assert.ok(brain.needs[key]<before[key]-8*rate);
  assert.equal(brain.needs.exercise,undefined);
  brain._go(getStation('galley'));const stopped=brain.exercise;brain.update(1);assert.ok(brain.exercise<stopped);
});

test('mount, coast and dismount finish before the latest walking order is executed',()=>{
  const {brain,actor}=setup();brain.health.nextIncident=Infinity;brain._go(getStation('gym'));actor.update(1/60);
  brain.update(1);brain._go(getStation('hydro'));brain._go(getStation('galley'));
  assert.equal(brain.state,'leavingGym');assert.equal(actor.busy,false);
  brain.update(3);assert.equal(actor.busy,false);assert.equal(currentAction(brain),'gym');
  brain.update(4);assert.equal(brain.gymVisit,null);assert.equal(brain.actStation,'galley');assert.ok(actor.busy);
});

test('pedals start and stop smoothly, stay parked, and freeze on zero time',()=>{
  const visit=new GymVisit();visit.update(GYM_MOUNT_SECONDS);assert.equal(visit.pedalTime,0);
  visit.update(.01);assert.ok(visit.pedalTime<.00001);visit.update(2);
  const start=visit.pedalTime;visit.requestExit();visit.update(.6);const mid=visit.pedalTime;
  visit.update(.6);const end=visit.pedalTime;assert.ok(mid-start>end-mid);
  visit.update(1);assert.equal(visit.pedalTime,end);const pose=visit.pose;visit.update(0);assert.deepEqual(visit.pose,pose);
  const next=new GymVisit({pedalTime:end});assert.equal(next.pedalTime,end);
});

test('gym transitions keep limbs continuous and cycling contacts stay on the equipment',()=>{
  const material=new MeshStandardMaterial(),root=createMilo(new Proxy({},{get:()=>material})),visit=new GymVisit();visit.startYaw=Math.PI/2;
  let previous=null;
  for(let i=0;i<=720;i++){
    if(i===420)visit.requestExit();
    const pose=visit.pose;root.position.z=pose.depth;
    animateMilo(root,{action:'gym',moving:false,facing:1,time:i/60,actionTime:i/60,gymVisit:visit});root.updateMatrixWorld(true);
    const nodes=[root.userData.hips,root.userData.head,...root.userData.legs.map(r=>r.boot),...root.userData.arms.map(r=>r.hand)];
    const positions=nodes.map(n=>n.getWorldPosition(new Vector3()));
    if(previous)for(let j=0;j<positions.length;j++)assert.ok(positions[j].distanceTo(previous[j])<.045,`joint ${j} at ${i/60}: ${positions[j].distanceTo(previous[j])}`);
    previous=positions;
    for(const {boot,side}of root.userData.legs){
      const sole=boot.localToWorld(new Vector3(0,-.107,.024));assert.ok(sole.y>-.008,`floor at ${i/60}: ${sole.y}`);
      if(visit.phase==='cycle'){
        const pedal=pedalPosition(visit.pedalTime,side),target=new Vector3(pedal.z,pedal.y+.0175,BIKE.depth-pedal.x);
        assert.ok(sole.distanceTo(target)<1e-5);
      }
    }
    visit.update(1/60);
  }
});
test('exercise chat routes to the gym and preserves already dispatched supply orders',()=>{
  const {brain,care}=setup();care.take('food');care.request();care.transmit();care.update(3);
  for(const text of ['運動して','ジムへ','筋トレしよう','exercise please','workout']){
    brain.handleChat(text);assert.equal(brain.actStation,'gym');assert.equal(care.phase,'inbound');
  }
});
test('an autonomous workout completes and returns to the regular needs loop',()=>{
  const {brain,actor}=setup();brain.exercise=15;let exercised=false;
  for(let i=0;i<25*60;i++){actor.update(1/60);brain.update(1/60);if(currentAction(brain)==='gym')exercised=true;}
  assert.equal(exercised,true);assert.ok(brain.exercise>95);assert.notEqual(currentAction(brain),'gym');
  for(const value of Object.values(brain.statusNeeds))assert.ok(Number.isFinite(value));
});
test('forward pedaling pushes down at the front and advances over the top',()=>{
  const front=pedalPosition(0,1),next=pedalPosition(.01,1);
  assert.ok(front.z>BIKE.crankZ);assert.ok(next.y<front.y);
  const rear=pedalPosition(0,-1),rearNext=pedalPosition(.01,-1);assert.ok(rearNext.y>rear.y);
  const topTime=Math.PI*1.5/BIKE.cadence,top=pedalPosition(topTime,1),topNext=pedalPosition(topTime+.01,1);
  assert.ok(top.y>BIKE.crankY);assert.ok(topNext.z>top.z);
});
test('feet remain on the pedals and hands on the handlebar throughout a full cycle',()=>{
  const material=new MeshStandardMaterial(),m=new Proxy({},{get:()=>material});
  const milo=createMilo(m);let gym;
  globalThis.document={createElement(){return{getContext(){return{fillRect(){},fillText(){},measureText(text){return{width:text.length*parseFloat(this.font.slice(4))*.6};}};}};}};
  try{gym=createGym(m,0);}finally{delete globalThis.document;}
  milo.position.z=BIKE.depth;
  for(let i=0;i<=90;i++){
    const time=i/90*Math.PI*2/BIKE.cadence;
    animateMilo(milo,{action:'gym',moving:false,climbing:false,facing:1,time,actionTime:time});animateGym(gym,time);
    milo.updateMatrixWorld(true);gym.root.updateMatrixWorld(true);
    for(const {boot,side}of milo.userData.legs){
      const foot=boot.localToWorld(new Vector3(0,-.107,.024)),pedal=pedalPosition(time,side);
      const target=gym.root.localToWorld(new Vector3(pedal.x,pedal.y+.0175,pedal.z));assert.ok(foot.distanceTo(target)<1e-6,`Foot offset: ${foot.distanceTo(target)}`);
      const actualPedal=gym.cranks.find(crank=>crank.side===side).pedal.localToWorld(new Vector3(0,.0175,0));
      assert.ok(foot.distanceTo(actualPedal)<1e-6);
    }
    for(const {hand,side}of milo.userData.arms){
      const palm=hand.localToWorld(new Vector3(0,-.045,.007)),target=gym.root.localToWorld(new Vector3(side*.207,BIKE.gripY,BIKE.gripZ));
      assert.ok(palm.distanceTo(target)<1e-6,`Hand offset: ${palm.distanceTo(target)}`);
    }
  }
  assert.ok(gym.flywheel.rotation.x>0);
  const before=milo.userData.legs.map(({leg})=>leg.rotation.x);animateMilo(milo,{action:'gym',moving:false,time:2,actionTime:2});assert.notDeepEqual(milo.userData.legs.map(({leg})=>leg.rotation.x),before);
  animateMilo(milo,{action:null,moving:true,facing:1,time:3});
  assert.ok(Math.abs(milo.userData.chest.rotation.x)<.04);assert.ok(Math.abs(milo.userData.head.position.y-1.637)<.002);
  for(const {arm,hand}of milo.userData.arms){assert.equal(arm.position.y,1.488);assert.equal(arm.position.z,0);assert.equal(hand.rotation.x,0);}
  for(const {leg,side}of milo.userData.legs)assert.equal(leg.position.x,side*.100);
});
