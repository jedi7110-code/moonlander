import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as THREE from 'three';
import {SmokingClock,SmokingVisit,SMOKING_SECONDS} from '../src/obs/smoking-visit.js';
import {ASHTRAY,CABIN_AISLE} from '../src/obs/layout.js';
import {CabinBrain} from '../src/obs/brain.js';
import {CrewMotion,Supplies,getStation,currentAction} from '../src/obs/state.js';
import {loadMiloBody} from '../src/obs/milo-body.js';
import {createMilo,animateMilo} from '../src/obs/characters.js';
import {CIGARETTE,LIGHTER_TIP} from '../src/obs/smoking-props.js';
import {mouthPosition} from '../src/obs/dining.js';
import {createMiloToon} from '../src/obs/milo-toon.js';
import {CrewHealth} from '../src/obs/health.js';

await loadMiloBody(`data:application/json;base64,${(await readFile(new URL('../public/assets/obs/milo/body.json',import.meta.url))).toString('base64')}`);
const v=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);
function setup(){
  const station=getStation('smoking'),actor=new CrewMotion({floor:station.floor,x:station.x}),care=new Supplies();
  const brain=new CabinBrain({time:{delayedCall(){}},obsUI:{hideWant(){}}},actor,{care,random:()=>.8});
  brain.wantCoolT=10000;brain.health.nextIncident=1e6;brain.plants.rows.forEach(row=>row.growth=.05);
  Object.keys(brain.needs).forEach(key=>brain.needs[key]=90);brain.exercise=90;return{actor,brain};
}
function advance({actor,brain},seconds){for(let i=0;i<Math.ceil(seconds*60);i++){actor.update(1/60);brain.update(1/60);}}
function model(){
  const m=new Proxy({},{get:(o,k)=>o[k]??=new THREE.MeshStandardMaterial()}),root=createMilo(m);
  root.userData.head.userData.faceForward=.025;
  root.position.set(ASHTRAY.x+ASHTRAY.standOffsetX,3.392,CABIN_AISLE.crewZ);return root;
}
const pose=(root,visit,time,dt=0)=>animateMilo(root,{moving:false,climbing:false,facing:-1,action:'smoking',time,dt,smokingVisit:visit});

test('smoke breaks use running minutes, do not reroll per frame and never chain',()=>{
  let calls=0;const clock=new SmokingClock(()=>{calls++;return .5;});
  assert.equal(clock.remaining,690);
  for(let i=0;i<600;i++)clock.update(1);
  assert.equal(calls,1);assert.equal(clock.due,false);
  for(const dt of [0,-1,NaN,Infinity])clock.update(dt);
  clock.update(1000,true);assert.equal(clock.remaining,90);
  clock.update(90);assert.equal(clock.due,true);clock.reset();assert.equal(clock.remaining,690);assert.equal(calls,2);
});

test('autonomy waits for the interval and prioritizes depleted needs and medical care',()=>{
  const {brain}=setup();brain._choose();assert.notEqual(brain.actStation,'smoking');
  brain.smokingClock.update(900);brain._choose();assert.equal(brain.actStation,'smoking');
  for(const need of ['hunger','thirst','energy','hygiene','bladder']){
    const {brain:b}=setup();b.smokingClock.update(900);b.needs[need]=20;b._choose();assert.notEqual(b.actStation,'smoking',need);
  }
  const {brain:b}=setup();b.smokingClock.update(900);b.health.startCondition('fever');b._choose();assert.notEqual(b.actStation,'smoking');
  assert.equal(b._go(getStation('smoking')),false);assert.equal(b.actStation,'medical');
});

test('manual requests, pause, completion and action dispatch use the live brain',()=>{
  const state=setup(),{brain,actor}=state;
  assert.match(brain.handleChat('一服して'),/灰皿/);actor.update(.1);
  assert.equal(currentAction(brain),'smoking');const visit=brain.smokingVisit;
  brain.handleChat('一服して');assert.equal(brain.smokingVisit,visit);
  advance(state,10);const age=visit.age;brain.update(0);assert.equal(visit.age,age);
  advance(state,SMOKING_SECONDS-10);assert.equal(brain.smokingVisit,null);assert.equal(brain.state,'idle');assert.ok(brain.smokingClock.remaining>=480);
  brain.state='playingGame';const remaining=brain.smokingClock.remaining;brain.update(30);assert.equal(brain.smokingClock.remaining,remaining);
});

test('another order waits for extinguishing and a complete walk back into the aisle',()=>{
  const state=setup(),{brain,actor}=state;brain._go(getStation('smoking'));actor.update(.1);advance(state,16);
  const visit=brain.smokingVisit;brain._go(getStation('hydro'));
  assert.equal(visit.phase,'extinguish');assert.equal(actor.busy,false);assert.equal(visit.pose.gesture.cigarette,true);
  advance(state,2.4);assert.equal(actor.busy,false);assert.equal(visit.pose.gesture.cigarette,false);
  advance(state,8.1);assert.equal(brain.smokingVisit,null);assert.equal(visit.pose.depth,CABIN_AISLE.crewZ);assert.equal(brain.actStation,'hydro');assert.equal(actor.busy,true);
});

test('smoking time counts only after lighting, across frame boundaries and interrupted visits',()=>{
  for(const dt of [1/60,.37,SMOKING_SECONDS+10]){
    const visit=new SmokingVisit();let smoked=0;
    while(!visit.done)smoked+=visit.update(dt);
    assert.ok(Math.abs(smoked-18.55)<1e-8);
    assert.equal(visit.update(10),0);
  }
  const early=new SmokingVisit();early.requestExit();assert.equal(early.update(SMOKING_SECONDS),0);
  const visit=new SmokingVisit();assert.equal(visit.update(9),0);
  assert.ok(Math.abs(visit.update(1)-.75)<1e-8);
  for(const dt of [0,-1,NaN,Infinity])assert.equal(visit.update(dt),0);
  visit.requestExit();assert.equal(visit.update(SMOKING_SECONDS),0);
});

test('a live smoke break raises enjoyment and lowers health only while smoking, and pauses freeze both',()=>{
  const state=setup(),{brain,actor}=state;brain.needs.fun=50;
  brain._go(getStation('smoking'));actor.update(.1);advance(state,9);
  assert.equal(brain.health.value,100);assert.ok(brain.needs.fun<50);
  const beforeSmoking=brain.needs.fun;advance(state,2);const fun=brain.needs.fun,health=brain.health.value;
  assert.ok(fun>beforeSmoking);assert.ok(health<100);assert.equal(brain.health.smoking,true);
  brain.update(0);assert.equal(brain.needs.fun,fun);assert.equal(brain.health.value,health);
  brain.state='playingGame';brain.update(30);assert.equal(brain.needs.fun,fun);assert.equal(brain.health.value,health);
  brain.state='smoking';brain._go(getStation('hydro'));advance(state,2);
  assert.ok(brain.needs.fun<fun);assert.ok(brain.health.value>health);assert.equal(brain.health.smoking,false);
});

test('smoking health cost is not cancelled by passive recovery, and status values stay bounded',()=>{
  const needs={energy:90,thirst:90,hunger:90,hygiene:90},health=new CrewHealth();health.nextIncident=1e6;
  health.update(5,{needs,smokingTime:5});assert.equal(health.value,98);
  health.update(1,{needs});assert.ok(Math.abs(health.value-98.16)<1e-8);
  health.value=5;health.update(10,{needs,smokingTime:10});assert.equal(health.value,5);
  const state=setup(),{brain,actor}=state;brain.needs.fun=100;
  brain._go(getStation('smoking'));actor.update(.1);advance(state,20);
  assert.ok(brain.needs.fun<=100);assert.ok(brain.needs.fun>99);assert.ok(brain.health.value>=5&&brain.health.value<100);
});

test('a completed cigarette leaves higher enjoyment and lower health than before the break',()=>{
  const state=setup(),{brain,actor}=state;brain.needs.fun=50;
  brain._go(getStation('smoking'));actor.update(.1);advance(state,SMOKING_SECONDS+.05);
  assert.equal(brain.smokingVisit,null);assert.ok(brain.needs.fun>50);assert.ok(brain.health.value<100);
});

test('entry, exit and cancellation never jump through the shelf or teleport into the aisle',()=>{
  for(const cancelAt of [Infinity,.2,3,8,17]){
    const visit=new SmokingVisit();visit.startYaw=-Math.PI/2;let previous=visit.pose;
    for(let time=0;time<SMOKING_SECONDS+.1;time+=1/60){
      if(time>=cancelAt)visit.requestExit();visit.update(1/60);const p=visit.pose;
      assert.ok(Math.abs(p.depth-previous.depth)<.014);assert.ok(Math.abs(p.yaw-previous.yaw)<.05);
      assert.ok(p.depth>=ASHTRAY.standZ-1e-9);if(p.gesture?.lit)assert.equal(p.depth,ASHTRAY.standZ);previous=p;
    }
    assert.ok(visit.done);assert.equal(visit.pose.depth,CABIN_AISLE.crewZ);assert.ok(Math.abs(Math.sin(visit.pose.yaw-visit.startYaw))<1e-9);
  }
});

test('the skinned rig keeps cigarette contact, wrists within range and stubs out inside the ashtray',()=>{
  const root=model(),visit=new SmokingVisit();visit.startYaw=-Math.PI/2;
  let inhaled=0,extinguished=0,flames=0;
  for(let time=0;time<SMOKING_SECONDS;time+=1/30){
    pose(root,visit,time,1/30);const p=visit.pose,{body,head,arms,smokingProps:props}=root.userData;
    if(p.gesture){
      for(const rig of arms){
        const bend=rig.hand.position.clone().normalize().angleTo(v(0,-1,0).applyQuaternion(rig.hand.quaternion));
        assert.ok(bend<.80,`wrist ${rig.side} at ${time}: ${bend}`);
        assert.ok(rig.arm.position.distanceTo(v(rig.side*.207,1.488,0))<.012,'shoulder remains attached');
      }
      if(p.gesture.inhale){inhaled++;assert.ok(props.cigarette.getWorldPosition(v()).distanceTo(body.localToWorld(mouthPosition(head)))<.008);}
      if(p.gesture.flame){flames++;assert.ok(arms[1].hand.localToWorld(LIGHTER_TIP.clone()).distanceTo(props.cigarette.localToWorld(v(0,0,CIGARETTE.length)))<.018);}
      if(p.phase==='extinguish'&&visit.age>1.4&&visit.age<2.2){
        extinguished++;const tip=props.cigarette.localToWorld(v(0,0,CIGARETTE.length));
        assert.ok(Math.hypot(tip.x-ASHTRAY.x,tip.z-ASHTRAY.z)<.025);assert.ok(Math.abs(tip.y-root.position.y-ASHTRAY.y)<.027);
      }
    }
    visit.update(1/30);
  }
  assert.ok(inhaled>120&&extinguished>15&&flames>10);
  assert.equal(root.userData.smokingProps.cigarette.visible,false);
});

test('toon ember works, smoke freezes on pause and all particles fade after leaving',()=>{
  const root=model(),toon=createMiloToon(root),visit=new SmokingVisit();visit.startYaw=-Math.PI/2;visit.update(15.8);
  for(let i=0;i<60;i++)pose(root,visit,15.8,1/60);
  const props=root.userData.smokingProps;
  assert.ok(props.ember.material.emissiveIntensity>2);assert.ok(props.particles.some(p=>p.sprite.visible));assert.equal(props.particles.length,24);
  const before=props.particles.map(p=>[p.age,...p.sprite.position.toArray()]);pose(root,visit,15.8,0);assert.deepEqual(props.particles.map(p=>[p.age,...p.sprite.position.toArray()]),before);
  for(let i=0;i<180;i++)animateMilo(root,{moving:false,climbing:false,facing:1,time:i/60,dt:1/60});
  assert.ok(props.particles.every(p=>!p.sprite.visible));assert.equal(props.cigarette.visible,false);assert.equal(props.lighter.visible,false);toon.dispose();
});
