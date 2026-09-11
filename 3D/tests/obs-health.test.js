import test from 'node:test';
import assert from 'node:assert/strict';
import {MeshStandardMaterial} from 'three';
import {CrewHealth} from '../src/obs/health.js';
import {CabinBrain} from '../src/obs/brain.js';
import {CrewMotion,Supplies,currentAction,getStation,FLOORS} from '../src/obs/state.js';
import {MEDICAL} from '../src/obs/layout.js';
import {medicalReadings,medicalRecline,medicalDuration,MED_BED} from '../src/obs/medical.js';
import {createMilo,animateMilo} from '../src/obs/characters.js';

const needs={energy:80,thirst:80,hunger:80,hygiene:80};
function setup(){
  const events=[],reports=[],actor=new CrewMotion({floor:1,x:MEDICAL.x}),care=new Supplies();
  const brain=new CabinBrain({time:{delayedCall(){}},obsUI:{hideWant(){},healthEvent(e){events.push(e);},medicalResult(r){reports.push(r);}}},actor,{care});
  brain.wantCoolT=10000;
  return{brain,actor,care,events,reports};
}
function advance(brain,seconds,actor=null){for(let i=0;i<Math.ceil(seconds*60);i++){actor?.update(1/60);brain.update(1/60);}}

test('health starts well, has an incident grace period, and does not progress on a zero tick',()=>{
  const health=new CrewHealth({random:()=>0});
  assert.equal(health.value,100);assert.equal(health.stage,'healthy');assert.equal(health.duration,14);
  for(let i=0;i<149;i++)health.update(1,{needs,activity:'eva'});
  assert.equal(health.condition,null);
  const before=JSON.stringify(health);health.update(0,{needs});assert.equal(JSON.stringify(health),before);
  health.update(1,{needs,activity:'eva'});
  assert.equal(health.condition.kind,'injury');assert.equal(health.condition.source,'fitting');
  assert.equal(health.startCondition('fever'),false);assert.equal(health.startCondition('unknown'),false);
});
test('rest and medical activity are protected; persistent poor needs can cause fever',()=>{
  for(const activity of ['bunk','medical','toilet','shower']){
    const health=new CrewHealth({random:()=>0});health.cooldown=0;health.nextIncident=0;
    health.update(50,{needs:{...needs,hygiene:5},activity});assert.equal(health.condition,null);
  }
  const health=new CrewHealth();health.cooldown=0;health.nextIncident=Infinity;
  health.update(44,{needs:{...needs,hygiene:5}});assert.equal(health.condition,null);
  health.update(1,{needs:{...needs,hygiene:5}});assert.equal(health.condition.kind,'fever');
});
test('untreated symptoms worsen, emit each warning once and never kill the crew',()=>{
  const events=[],health=new CrewHealth({onEvent:event=>events.push(event)});health.startCondition('fever');
  const initialSpeed=health.speedFactor;
  for(let i=0;i<1000;i++)health.update(1,{needs});
  assert.equal(health.value,5);assert.equal(health.stage,'critical');assert.ok(health.speedFactor<initialSpeed);
  assert.deepEqual(events.map(e=>e.type+':'+e.stage),['onset:warning','worsened:urgent','worsened:critical']);
});
test('treatment must finish, cancellation keeps the condition and completion gives a cooldown',()=>{
  const health=new CrewHealth({random:()=>0});health.startCondition('injury');health.beginTreatment();
  health.update(5,{needs});assert.equal(health.finishTreatment(),false);health.cancelTreatment();
  assert.equal(health.condition.kind,'injury');assert.equal(health.treatment,null);
  health.beginTreatment();health.update(health.duration,{needs});assert.equal(health.finishTreatment(),true);
  assert.equal(health.needsCare,false);assert.ok(health.value>=88);assert.equal(health.bandageTime,180);
  assert.equal(health.finishTreatment(),false);assert.equal(health.speedFactor,1);
  health.update(179,{needs:{...needs,hygiene:0},activity:'eva'});assert.equal(health.condition,null);
});
test('extended treatment stays reclined after the old 14-second checkup limit; fever readings settle',()=>{
  const health=new CrewHealth();health.startCondition('fever');health.value=29;health.beginTreatment();
  assert.equal(health.treatment.duration,36);assert.equal(medicalRecline(20,36),1);
  const duration=medicalDuration(36);
  assert.ok(Math.abs(medicalRecline(duration-6.55,duration)-.5)<1e-10);assert.equal(medicalRecline(duration-1,duration),0);assert.equal(medicalRecline(duration,duration),0);
  const hot=medicalReadings(needs,health);health.update(20,{needs});const cooler=medicalReadings(needs,health);
  assert.ok(cooler.temperature<hot.temperature);assert.ok(cooler.pulse<hot.pulse);
});
test('medical commands are idempotent and a full treatment produces one result without replenishing supplies or needs',()=>{
  const {brain,actor,care,events,reports}=setup();brain.health.startCondition('injury');
  brain.handleChat('治療して');actor.update(1/60);assert.equal(currentAction(brain),'medical');
  advance(brain,5);const elapsed=brain.health.treatment.elapsed,version=actor.commandVersion;
  brain.handleChat('医療区画へ');assert.equal(actor.commandVersion,version);assert.equal(brain.health.treatment.elapsed,elapsed);
  assert.equal(elapsed,0,'boarding must not count toward treatment');
  const before={...brain.needs};advance(brain,brain.performT+.1);
  assert.equal(brain.health.needsCare,false);assert.equal(reports.length,1);assert.equal(reports[0].treated,true);
  assert.equal(events.filter(e=>e.type==='recovered').length,1);assert.deepEqual(care.supplies,care.capacity);
  for(const key in before)assert.ok(brain.needs[key]<=before[key]);
});
test('interrupted medical treatment is not reported as complete and resumes with a new course',()=>{
  const {brain,actor,reports}=setup();brain.health.startCondition('fever');brain._go(MEDICAL);actor.update(1/60);
  advance(brain,5);brain._go(getStation('hydro'));assert.equal(brain.health.treatment,null);
  assert.equal(brain.health.needsCare,true);assert.equal(reports.length,0);
  brain._go(MEDICAL);brain.update(brain.reclineExit.duration);actor.update(1/60);assert.equal(brain.health.treatment.elapsed,0);
});
test('urgent illness refuses chess and prioritizes care; critical illness refuses other orders',()=>{
  const {brain,care}=setup();brain.health.startCondition('fever');brain.health.value=54;
  assert.equal(brain.requestGame(),false);assert.equal(brain.gamePending,false);assert.equal(brain.actStation,'medical');
  brain.health.value=29;
  for(const id of ['bunk','console','galley','gym']){assert.equal(brain._go(getStation(id)),false);assert.equal(brain.actStation,'medical');}
  care.take('food');assert.equal(brain.requestSupplies(),false);assert.equal(care.delivery,null);
  assert.equal(brain.requestCommand(),false);assert.equal(brain.actStation,'medical');
  brain.handleChat('水を飲んで');assert.equal(brain.actStation,'medical');
});
test('a gym injury stops exercise, and critical care does not cancel an already dispatched shipment',()=>{
  const {brain,actor,care}=setup();const gym=getStation('gym');actor.floor=gym.floor;actor.y=FLOORS[gym.floor].y;actor.x=gym.x;
  brain._go(gym);actor.update(1/60);assert.equal(currentAction(brain),'gym');
  care.take('food');care.request();care.transmit();care.update(3);assert.equal(care.phase,'inbound');
  brain.health.startCondition('injury');brain.update(1/60);
  assert.equal(brain.state,'leavingGym');assert.equal(actor.busy,false);
  for(let i=0;i<8*60;i++)brain.update(1/60);
  assert.equal(brain.actStation,'medical');assert.equal(care.phase,'inbound');
  assert.equal(brain.health.treatment,null);
});
test('autonomous care reaches the bay from another deck and slowed movement returns to normal',()=>{
  const {brain,actor}=setup();brain.health.startCondition('fever');brain.health.value=29;
  actor.floor=2;actor.y=FLOORS[2].y;actor.x=300;brain.update(1/60);
  assert.equal(brain.actStation,'medical');assert.ok(actor.walkSpeed<brain.baseWalkSpeed);
  advance(brain,100,actor);assert.equal(brain.health.needsCare,false);assert.equal(actor.walkSpeed,brain.baseWalkSpeed);
});
test('chess freezes symptoms and condition age',()=>{
  const {brain}=setup();brain.health.startCondition('injury');brain.state='playingGame';
  const before=JSON.stringify(brain.health);brain.update(20);assert.equal(JSON.stringify(brain.health),before);
});
test('a repeated healthy chess request is not mistaken for illness',()=>{
  const {brain}=setup();brain.requestGame();assert.equal(brain.gamePending,true);
  assert.doesNotMatch(brain.handleChat('チェス'),/手当|treatment/i);
  assert.equal(brain.gamePending,true);assert.equal(brain.actStation,'lounge');
});
test('injury posture and bandage are removed when no longer applicable',()=>{
  const material=new MeshStandardMaterial(),milo=createMilo(new Proxy({},{get:()=>material})),health=new CrewHealth();
  const options={moving:false,climbing:false,facing:1,action:null,time:0,health};
  health.startCondition('injury');animateMilo(milo,options);assert.equal(milo.userData.arms[0].elbow.rotation.x,-1.3);
  assert.equal(milo.userData.bandage.visible,false);health.beginTreatment();health.update(24,{needs});health.finishTreatment();
  animateMilo(milo,options);assert.equal(milo.userData.bandage.visible,true);assert.equal(milo.userData.arms[0].elbow.rotation.x,-.08);
  health.bandageTime=0;animateMilo(milo,options);assert.equal(milo.userData.bandage.visible,false);
});
