import test from 'node:test';
import assert from 'node:assert/strict';
import {MeshStandardMaterial} from 'three';
import {CrewHealth} from '../src/obs/health.js';
import {CabinBrain} from '../src/obs/brain.js';
import {CrewMotion,Supplies,currentAction,getStation,FLOORS} from '../src/obs/state.js';
import {MEDICAL} from '../src/obs/layout.js';
import {medicalReadings,medicalRecline,medicalDuration,MED_BED} from '../src/obs/medical.js';
import {BED_ENTRY_SECONDS} from '../src/obs/bed-entry.js';
import {createMilo,animateMilo} from '../src/obs/characters.js';
import {GYM_MOUNT_SECONDS,GYM_BRAKE_SECONDS,GYM_DISMOUNT_SECONDS} from '../src/obs/gym-visit.js';

const needs={energy:80,thirst:80,hunger:80,hygiene:80};
function setup(){
  const events=[],reports=[],actor=new CrewMotion({floor:MEDICAL.floor,x:MEDICAL.x}),care=new Supplies();
  const brain=new CabinBrain({time:{delayedCall(){}},obsUI:{hideWant(){},healthEvent(e){events.push(e);},medicalResult(r){reports.push(r);}}},actor,{care});
  brain.wantCoolT=10000;
  return{brain,actor,care,events,reports};
}
function advance(brain,seconds,actor=null){for(let i=0;i<Math.ceil(seconds*60);i++){actor?.update(1/60);brain.update(1/60);}}

test('health starts well, waits at least 30 running minutes, and does not progress on a zero tick',()=>{
  const health=new CrewHealth({random:()=>0});
  assert.equal(health.value,100);assert.equal(health.stage,'healthy');assert.equal(health.duration,14);
  for(let i=0;i<1799;i++)health.update(1,{needs,activity:'eva'});
  assert.equal(health.condition,null);
  const before=JSON.stringify(health);health.update(0,{needs});assert.equal(JSON.stringify(health),before);
  health.update(1,{needs,activity:'eva'});
  assert.equal(health.condition.kind,'injury');assert.equal(health.condition.source,'fitting');
  assert.equal(health.startCondition('fever'),false);assert.equal(health.startCondition('unknown'),false);
});
test('rest and medical activity discard fatigue and overdue incident opportunities',()=>{
  for(const activity of ['bunk','medical','toilet','shower']){
    const health=new CrewHealth({random:()=>0});
    health.update(300,{needs:{...needs,hygiene:5}}); // Enter rest with sustained exposure.
    health.update(3600,{needs:{...needs,hygiene:5},activity});assert.equal(health.condition,null);
    assert.equal(health.exposure,0);assert.ok(health.nextIncident>=health.clock+1800);
    health.update(1,{needs:{...needs,hygiene:5},activity:'eva'});assert.equal(health.condition,null);
  }
});
test('persistent poor needs raise fever risk only at the infrequent check, never guarantee it',()=>{
  for(const roll of [.4,.99]){
    const health=new CrewHealth({random:()=>0});health.random=()=>roll;
    health.update(1799,{needs:{...needs,hygiene:5}});assert.equal(health.condition,null);
    health.update(1,{needs:{...needs,hygiene:5}});
    if(roll===.4){assert.equal(health.condition.kind,'fever');assert.equal(health.condition.source,'fatigue');}
    else{assert.equal(health.condition,null);assert.ok(health.nextIncident>=health.clock+1800);}
  }
  const rested=new CrewHealth({random:()=>0});rested.random=()=>.4;
  rested.update(300,{needs:{...needs,hygiene:5}});rested.update(1500,{needs});
  assert.equal(rested.condition,null,'resolved fatigue must not raise a later fever roll');
});
test('fitting, climbing, exercise and tired walking have a low injury chance rather than a guaranteed accident',()=>{
  for(const context of [{activity:'eva'},{activity:'airlock'},{activity:'innerHatch'},{climbing:true},{activity:'gym'},
    {moving:true,needs:{...needs,energy:45}},{moving:true,needs:{...needs,energy:10}}]){
    const health=new CrewHealth({random:()=>0});let rolls=0;
    health.random=()=>{rolls++;return .99;};
    health.update(1800,{needs,...context});assert.equal(health.condition,null);
    assert.ok(health.nextIncident>=health.clock+1800&&health.nextIncident<=health.clock+3600);
    const checked=rolls;
    for(let i=0;i<60*60;i++)health.update(1/60,{needs,...context});
    assert.equal(health.condition,null);assert.equal(rolls,checked,'a failed roll must not retry each frame');
    health.random=()=>0;health.update(health.nextIncident-health.clock,{needs,...context});
    assert.equal(health.condition.kind,'injury');
    assert.equal(health.condition.source,['eva','airlock','innerHatch'].includes(context.activity)?'fitting':'stumble');
  }
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
  health.update(1199,{needs:{...needs,hygiene:0,energy:0},activity:'eva'});assert.equal(health.condition,null);
  assert.equal(health.exposure,0);assert.ok(health.cooldown>0);
  health.update(1,{needs:{...needs,hygiene:0,energy:0},activity:'gym'});
  assert.equal(health.condition,null);assert.equal(health.cooldown,0);assert.equal(health.exposure,0);
  health.update(1,{needs:{...needs,hygiene:0,energy:0},climbing:true});assert.equal(health.condition,null);
  assert.equal(health.exposure,1,'only time after the recovery grace may accumulate fatigue');
});
test('long sessions have occasional incidents with the same outcome at different frame rates',()=>{
  function simulate(seed,step=1,seconds=8*3600){
    const onsets=[],recoveries=[];
    const health=new CrewHealth({
      random:()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/2**32;},
      onEvent:event=>{
        if(event.type==='onset')onsets.push({time:health.clock,kind:event.kind,source:event.source});
        if(event.type==='recovered')recoveries.push(health.clock);
      }
    });
    for(let i=0;i<Math.round(seconds/step);i++){
      health.update(step,{needs,activity:health.treatment?'medical':'gym'});
      if(health.condition&&!health.treatment)health.beginTreatment();
      if(health.treatment)health.finishTreatment();
    }
    for(let i=1;i<onsets.length;i++)assert.ok(onsets[i].time-recoveries[i-1]>=20*60);
    return onsets;
  }
  let total=0;
  for(let seed=1;seed<=32;seed++)total+=simulate(Math.imul(seed,0x9e3779b9)>>>0).length;
  const perHour=total/(32*8);
  assert.ok(perHour>.2&&perHour<.8,`normal activity should stay occasional, got ${perHour} incidents/hour`);
  const slow=simulate(0x714f32a1,1/30,2*3600),fast=simulate(0x714f32a1,1/120,2*3600);
  assert.ok(slow.length>0);assert.deepEqual(slow.map(({kind,source})=>({kind,source})),fast.map(({kind,source})=>({kind,source})));
  for(let i=0;i<slow.length;i++)assert.ok(Math.abs(slow[i].time-fast[i].time)<1,'frame rate must not create extra incident rolls');
});
test('extended treatment stays reclined after the old 14-second checkup limit; fever readings settle',()=>{
  const health=new CrewHealth();health.startCondition('fever');health.value=29;health.beginTreatment();
  assert.equal(health.treatment.duration,36);assert.equal(medicalRecline(20,36),1);
  const duration=medicalDuration(36);
  const entryMidpoint=MED_BED.transition-2-BED_ENTRY_SECONDS/2;
  assert.ok(Math.abs(medicalRecline(duration-entryMidpoint,duration)-.5)<1e-10);assert.equal(medicalRecline(duration-1,duration),0);assert.equal(medicalRecline(duration,duration),0);
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
  for(let i=0;i<(GYM_MOUNT_SECONDS+GYM_BRAKE_SECONDS+GYM_DISMOUNT_SECONDS+.1)*60;i++)brain.update(1/60);
  assert.equal(brain.actStation,'medical');assert.equal(care.phase,'inbound');
  assert.equal(brain.health.treatment,null);
});
test('autonomous care reaches the bay from another deck and slowed movement returns to normal',()=>{
  const {brain,actor}=setup();brain.health.startCondition('fever');brain.health.value=29;
  actor.floor=2;actor.y=FLOORS[2].y;actor.x=300;brain.update(1/60);
  assert.equal(brain.actStation,'medical');assert.ok(actor.walkSpeed<brain.baseWalkSpeed);
  advance(brain,140,actor);assert.equal(brain.health.needsCare,false);assert.equal(actor.walkSpeed,brain.baseWalkSpeed);
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
