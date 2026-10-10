import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as THREE from 'three';
import {createLoungeTable} from '../src/obs/ship.js';
import {LOUNGE_TABLE,LOUNGE_ASHTRAY,LOUNGE_SEAT} from '../src/obs/layout.js';
import {SmokingVisit,LOUNGE_SMOKING_SECONDS} from '../src/obs/smoking-visit.js';
import {CabinBrain} from '../src/obs/brain.js';
import {CrewMotion,Supplies,getStation,currentAction} from '../src/obs/state.js';
import {createMilo,animateMilo} from '../src/obs/characters.js';
import {loadMiloBody} from '../src/obs/milo-body.js';
import {CIGARETTE} from '../src/obs/smoking-props.js';
import {mouthPosition} from '../src/obs/dining.js';

await loadMiloBody(`data:application/json;base64,${(await readFile(new URL('../public/assets/obs/milo/body.json',import.meta.url))).toString('base64')}`);
const v=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);
function finishes(){return new Proxy({},{get:(o,k)=>o[k]??=new THREE.MeshStandardMaterial()});}
function setup(){
  const station=getStation('lounge'),actor=new CrewMotion({floor:station.floor,x:station.x}),care=new Supplies();
  const brain=new CabinBrain({obsUI:{hideWant(){}}},actor,{care,random:()=>.2});
  brain.health.nextIncident=1e6;brain.wantCoolT=10000;brain.exercise=90;
  Object.keys(brain.needs).forEach(k=>brain.needs[k]=90);return{brain,actor};
}
function advance({actor,brain},seconds){for(let i=0;i<Math.ceil(seconds*60);i++){actor.update(1/60);brain.update(1/60);}}

test('small ceramic ashtray rests directly in front of the pad toward the seat, with a recessed well and no overlap with other table items',()=>{
  const table=createLoungeTable(finishes()),docks=table.userData.loungeProps;table.updateMatrixWorld(true);
  const ash=new THREE.Box3().setFromObject(docks.ashtray);
  assert.ok(Math.abs(ash.min.y-LOUNGE_ASHTRAY.y)<1e-7);
  assert.ok(ash.max.z<LOUNGE_TABLE.depth/2&&ash.max.x<LOUNGE_TABLE.width/2);
  for(const key of ['tablet','phones','toy']){
    assert.equal(ash.intersectsBox(new THREE.Box3().setFromObject(docks[key])),false,key);
  }
  assert.ok(ash.max.z<new THREE.Box3().setFromObject(docks.phones).min.z,'ashtray is on the seat side of the headphones');
  assert.ok(ash.getSize(v()).x<.16,'ashtray stays smaller than the pad');
  const centerDistance=key=>ash.getCenter(v()).distanceTo(new THREE.Box3().setFromObject(docks[key]).getCenter(v()));
  assert.ok(centerDistance('tablet')<.36&&centerDistance('tablet')<centerDistance('phones'),'ashtray stays close to the pad');
  assert.ok(Math.abs(ash.getCenter(v()).x-docks.tablet.position.x)<.01,'ashtray lines up with the pad');
  assert.ok(ash.max.z<new THREE.Box3().setFromObject(docks.tablet).min.z,'ashtray is in front of the pad on the body side');
  const center=docks.ashtray.localToWorld(v(0,.1,0));
  const hit=new THREE.Raycaster(center,v(0,-1,0)).intersectObject(docks.ashtray,true)[0];
  assert.ok(hit.point.y<ash.max.y-.01,'well is lower than the rim');
});

test('reference ash flick uses a palm-down curved pinch and keeps the tilted cigarette above the bowl',()=>{
  const m=finishes(),root=createMilo(m),table=createLoungeTable(m);
  root.position.set((getStation('lounge').x-700)*.022,0,LOUNGE_SEAT.depth);root.rotation.y=.15;
  table.position.set(LOUNGE_TABLE.x,0,LOUNGE_TABLE.z);table.updateMatrixWorld(true);
  const docks=table.userData.loungeProps,ash=docks.ashtray.getWorldPosition(v());ash.y+=LOUNGE_ASHTRAY.wellY;
  const right=root.userData.arms[0],cigarette=root.userData.smokingProps.cigarette;
  const thumbAngles=[];
  for(let time=13.3;time<=14;time+=1/60){
    const visit=new SmokingVisit({seated:true});visit.update(time);
    animateMilo(root,{action:'lounge',leisure:'smoking',moving:false,time,actionTime:time,dt:0,smokingVisit:visit,loungeDocks:docks});
    root.updateMatrixWorld(true);
    const tip=cigarette.localToWorld(v(0,0,CIGARETTE.length)),direction=tip.clone().sub(cigarette.getWorldPosition(v())).normalize();
    const palm=v(0,0,-1).applyQuaternion(right.hand.getWorldQuaternion(new THREE.Quaternion()));
    assert.ok(palm.y<-.65,'knuckles face up and palm faces the bowl');
    assert.ok(direction.y<-.45&&direction.y>-.95,'cigarette slopes down rather than being held vertically');
    assert.ok(tip.y-ash.y>.02&&tip.y-ash.y<.05,'ash is flicked above the well, without stubbing out');
    assert.ok(Math.hypot(tip.x-ash.x,tip.z-ash.z)<.02,'ash falls inside the small bowl');
    const pinch=right.fingers[2].userData.links[0].getWorldPosition(v()).add(right.fingers[3].userData.links[0].getWorldPosition(v())).multiplyScalar(.5);
    assert.ok(cigarette.localToWorld(v(0,0,CIGARETTE.heldAt)).distanceTo(pinch)<.012,'paper stays between the bent fingers');
    assert.ok(right.fingers[3].rotation.x>.5&&right.fingers[3].userData.links[0].rotation.x>.4,'index finger stays curved around the filter');
    thumbAngles.push(right.thumb.userData.ip.rotation.x);
  }
  assert.ok(Math.max(...thumbAngles)-Math.min(...thumbAngles)>.3,'thumb supplies the flick instead of shaking the whole wrist');
});

test('lounge smoke starts after seating, freezes on pause and extinguishes before a deferred game',()=>{
  const state=setup(),{brain,actor}=state;
  assert.match(brain.handleChat('ラウンジで一服'),/ラウンジの灰皿/);actor.update(.1);
  for(let i=0;i<1000&&actor.busy;i++){actor.update(1/60);brain.update(1/60);}
  assert.ok(brain.loungeEntry);
  assert.equal(brain.smokingVisit,null,'no cigarette while entering');advance(state,8);
  assert.equal(brain.smokingVisit?.seated,true);assert.equal(currentAction(brain),'lounge');
  advance(state,7);const visit=brain.smokingVisit,age=visit.age,health=brain.health.value;
  brain.update(0);assert.equal(visit.age,age);assert.equal(brain.health.value,health);
  brain.requestGame('chess');assert.equal(visit.phase,'extinguish');assert.equal(brain.gamePending,false);
  advance(state,2);assert.equal(actor.busy,false);assert.ok(visit.pose.gesture.lit===false);
  advance(state,1.9);assert.equal(brain.smokingVisit,null);assert.ok(brain.loungeExit);
  assert.equal(brain.gamePending,false);advance(state,8.1);
  assert.equal(brain.gameKind,'chess');assert.ok(!brain.smokingVisit);
});

test('lounge smoke completes and restores its timer, while medical care blocks it',()=>{
  const state=setup(),{brain}=state;brain.nextLeisure='smoking';brain._startPerform(getStation('lounge'),true);
  advance(state,LOUNGE_SMOKING_SECONDS+.02);
  assert.equal(brain.smokingVisit,null);assert.ok(brain.loungeExit);assert.equal(brain.loungeStow,undefined);
  assert.ok(brain.smokingClock.remaining>=480);
  const {brain:b}=setup();b.health.startCondition('fever');b.handleChat('ラウンジでタバコ');
  assert.equal(b.actStation,'medical');assert.equal(b.smokingVisit,null);
});

test('seated smoking keeps feet supported, cigarette at the mouth and extinguishes inside the table ashtray',()=>{
  const m=finishes(),root=createMilo(m),table=createLoungeTable(m),visit=new SmokingVisit({seated:true});
  root.position.set((getStation('lounge').x-700)*.022,3.392,LOUNGE_SEAT.depth);root.rotation.y=.15;
  table.position.set(LOUNGE_TABLE.x,3.392,LOUNGE_TABLE.z);table.updateMatrixWorld(true);
  root.userData.head.userData.faceForward=.025;
  const docks=table.userData.loungeProps,ash=docks.ashtray.getWorldPosition(v());ash.y+=LOUNGE_ASHTRAY.wellY;
  let inhaled=0,extinguished=0,planted;
  for(let time=0;time<LOUNGE_SMOKING_SECONDS;time+=1/30){
    animateMilo(root,{action:'lounge',leisure:'smoking',moving:false,time,actionTime:time,dt:1/30,smokingVisit:visit,loungeDocks:docks});
    root.updateMatrixWorld(true);const {body,head,legs,smokingProps:props}=root.userData;
    planted??=legs.map(({boot})=>boot.getWorldPosition(v()));
    legs.forEach(({boot},i)=>assert.ok(boot.getWorldPosition(v()).distanceTo(planted[i])<.003,'leaning must not slide the feet'));
    for(const leg of legs){
      const bottom=new THREE.Box3().setFromObject(leg.boot).min.y;
      assert.ok(Math.abs(bottom-root.position.y)<.02,`foot unsupported at ${time}: ${bottom-root.position.y}`);
    }
    if(visit.pose.gesture.inhale){inhaled++;assert.ok(props.cigarette.getWorldPosition(v()).distanceTo(body.localToWorld(mouthPosition(head)))<.015);}
    if(visit.phase==='extinguish'&&visit.age>1.4&&visit.age<2.2){
      extinguished++;const tip=props.cigarette.localToWorld(v(0,0,CIGARETTE.length));
      assert.ok(tip.distanceTo(ash)<.027,`tip misses dish by ${tip.distanceTo(ash)}`);
    }
    visit.update(1/30);
  }
  assert.ok(inhaled>120&&extinguished>15);
});
