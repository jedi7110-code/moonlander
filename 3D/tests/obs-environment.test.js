import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as THREE from 'three';
import {CabinEnvironment,environmentDisplay,HATCH_FAULT_INTERVAL} from '../src/obs/environment.js';
import {HatchRepairVisit,HATCH_REPAIR_PHASES,HATCH_REPAIR_DEPTH} from '../src/obs/hatch-repair.js';
import {HATCH_SERVICE_POINT,REPAIR_TOOL_TIP} from '../src/obs/hatch-repair-pose.js';
import {CabinBrain} from '../src/obs/brain.js';
import {CrewMotion,Supplies,currentAction} from '../src/obs/state.js';
import {getStation,CABIN_AISLE} from '../src/obs/layout.js';
import {AirlockPassage} from '../src/obs/airlock.js';
import {createMilo,animateMilo} from '../src/obs/characters.js';
import {loadMiloBody} from '../src/obs/milo-body.js';
import {createLounge} from '../src/obs/ship.js';
import {createEVAHatch,animateHatchFault} from '../src/obs/eva.js';

test('environment readings drift continuously in a narrow range and freeze without running time',()=>{
  const environment=new CabinEnvironment({random:()=>.5});
  const initial=environmentDisplay(environment);
  assert.equal(initial.temperature,'21.4°C');assert.equal(initial.pressure,'101.3 kPa');
  environment.update(15);const changed=environmentDisplay(environment);
  assert.notEqual(changed.temperature,initial.temperature);assert.notEqual(changed.pressure,initial.pressure);
  for(const dt of [0,-1,NaN,Infinity])environment.update(dt);
  assert.deepEqual(environmentDisplay(environment),changed);
  let previous={temperature:environment.temperature,pressure:environment.pressure};
  for(let i=0;i<3600;i++){
    environment.update(1);
    assert.ok(environment.temperature>20.8&&environment.temperature<22);
    assert.ok(environment.pressure>101&&environment.pressure<101.6);
    assert.ok(Math.abs(previous.temperature-environment.temperature)<.02);
    assert.ok(Math.abs(previous.pressure-environment.pressure)<.01);
    previous={temperature:environment.temperature,pressure:environment.pressure};
  }
});

test('faults wait running minutes, persist until repaired and cannot immediately repeat',()=>{
  const events=[],environment=new CabinEnvironment({random:()=>0,onEvent:event=>events.push(event)});
  environment.update(HATCH_FAULT_INTERVAL.min-1);assert.equal(environment.fault,null);
  environment.update(1);const serial=environment.fault.serial;
  assert.equal(environmentDisplay(environment).state,'abnormal');
  assert.equal(environmentDisplay(environment).label,'船内環境 異常');
  assert.equal(environmentDisplay(environment,'en').label,'LIFE SUPPORT ALERT');
  environment.update(3600);assert.equal(environment.fault.serial,serial);assert.equal(events.length,1);
  assert.equal(environment.resolve(serial+1),false);assert.ok(environment.fault);
  assert.equal(environment.resolve(serial),true);assert.equal(environmentDisplay(environment).state,'normal');
  environment.update(HATCH_FAULT_INTERVAL.min-1);assert.equal(environment.fault,null);
  environment.update(1);assert.equal(environment.fault.serial,serial+1);
});

function setup(floor=2,x=700){
  const actor=new CrewMotion({floor,x}),care=new Supplies(),events=[];
  const brain=new CabinBrain({time:{delayedCall(){}},obsUI:{hideWant(){},environmentEvent:event=>events.push(event)}},actor,{care,random:()=>.5});
  brain.wantCoolT=10000;brain.health.nextIncident=1e9;brain.exercise=90;
  Object.keys(brain.needs).forEach(key=>brain.needs[key]=95);
  return{actor,brain,care,events,gate:new AirlockPassage()};
}
function advance(state,seconds,check=()=>{}){
  for(let i=0;i<Math.round(seconds*60);i++){
    state.gate.update(1/60,state.actor);
    if(!state.actor.waitingForHatch)state.actor.update(1/60);
    state.brain.update(1/60);check();
  }
}

test('Milo travels through the inner hatch, inspects, repairs and verifies before the alert clears',()=>{
  const state=setup(),{brain,actor,events}=state,phases=new Set();
  brain.environment.triggerFault();brain._choose();assert.equal(brain.actStation,'airlock');
  let visited=false;
  advance(state,80,()=>{
    if(brain.hatchRepair){
      visited=true;phases.add(brain.hatchRepair.phase);assert.equal(currentAction(brain),'airlock');
      assert.equal(actor.x,getStation('airlock').x);assert.equal(actor.floor,getStation('airlock').floor);
      if(!brain.hatchRepair.repaired)assert.ok(brain.environment.fault);
    }
  });
  assert.ok(visited);for(const phase of ['inspect','repair','verify','return'])assert.ok(phases.has(phase),phase);
  assert.equal(brain.environment.fault,null);assert.equal(brain.hatchRepair,null);
  assert.equal(events.filter(event=>event.type==='restored').length,1);
  assert.ok(brain.environment.nextFault-brain.environment.clock>600);
});

test('an interrupted repair withdraws, returns to the aisle and leaves the fault active',()=>{
  const station=getStation('airlock'),state=setup(station.floor,station.x),{brain,actor,events}=state;
  brain.environment.triggerFault();brain._go(station);actor.update(.1);advance(state,12);
  assert.equal(brain.hatchRepair.phase,'repair');
  const age=brain.hatchRepair.age,clock=brain.environment.clock;brain.update(0);
  assert.equal(brain.environment.clock,clock);assert.equal(brain.hatchRepair.age,age);
  brain._go(getStation('hydro'));assert.equal(brain.hatchRepair.phase,'release');assert.equal(actor.busy,false);
  advance(state,6.1);assert.ok(brain.environment.fault);assert.equal(brain.hatchRepair,null);
  assert.equal(brain.actStation,'hydro');assert.equal(events.filter(event=>event.type==='restored').length,0);
});

test('urgent care and critically low needs precede maintenance; lounge games freeze the environment',()=>{
  const {brain}=setup();brain.environment.triggerFault();brain.health.startCondition('fever');brain.health.value=25;
  brain._choose();assert.equal(brain.actStation,'medical');
  const {brain:hungry}=setup();hungry.environment.triggerFault();hungry.needs.thirst=5;hungry._choose();assert.equal(hungry.actStation,'hydro');
  const {brain:gaming}=setup();gaming.state='playingGame';gaming.update(2000);assert.equal(gaming.environment.clock,0);assert.equal(gaming.environment.fault,null);
});

test('all repair phases and early cancellation keep continuous positions and return to the walking lane',()=>{
  const total=Object.values(HATCH_REPAIR_PHASES).reduce((sum,value)=>sum+value,0);
  for(const interruptAt of [Infinity,.3,3,7,12,20]){
    const visit=new HatchRepairVisit(1);visit.startYaw=-Math.PI/2;let previous=visit.pose;
    for(let time=0;time<total+1;time+=1/60){
      if(time>=interruptAt)visit.requestExit();visit.update(1/60);const pose=visit.pose;
      assert.ok(Math.abs(pose.depth-previous.depth)<.014);
      assert.ok(Math.abs(pose.yaw-previous.yaw)<.05);
      assert.ok(Math.abs(pose.reach-previous.reach)<.04);
      if(pose.reach>0)assert.equal(pose.depth,HATCH_REPAIR_DEPTH);
      previous=pose;
    }
    assert.ok(visit.done);assert.equal(visit.pose.depth,CABIN_AISLE.crewZ);
    assert.equal(visit.repaired,interruptAt===Infinity);
  }
});

await loadMiloBody(`data:application/json;base64,${(await readFile(new URL('../public/assets/obs/milo/body.json',import.meta.url))).toString('base64')}`);
const materials=()=>new Proxy({},{get:(o,k)=>o[k]??=new THREE.MeshStandardMaterial()});
test('the repair tool meets the actual service screw while the outer door stays sealed',()=>{
  const m=materials(),root=createMilo(m),station=getStation('airlock'),visit=new HatchRepairVisit(1);
  root.position.set((station.x-700)*.022,0,CABIN_AISLE.crewZ);root.rotation.y=Math.PI/2;
  let hatch;
  globalThis.document={createElement(){return{getContext(){return{fillRect(){},fillText(){},measureText(text){return{width:text.length*parseFloat(this.font.slice(4))*.6};}};}};}};
  try{hatch=createEVAHatch(m,0,false);}finally{delete globalThis.document;}
  hatch.updateMatrixWorld(true);
  const screw=hatch.getObjectByName('EVA lock service screw'),point=new THREE.Vector3(0,.014,0).applyMatrix4(screw.matrixWorld);
  assert.ok(point.distanceTo(new THREE.Vector3(...Object.values(HATCH_SERVICE_POINT)))<1e-6);
  const environment=new CabinEnvironment();environment.triggerFault();animateHatchFault(hatch.userData.signal,environment);
  assert.equal(hatch.userData.signal.color.getHex(),0xff6254);assert.equal(hatch.userData.door.position.z,0);
  let contacts=0;
  for(let time=0;time<30;time+=1/30){
    animateMilo(root,{moving:false,climbing:false,facing:1,action:'airlock',time,dt:1/30,hatchRepair:visit});
    if(visit.phase==='repair'&&visit.pose.reach>.999){
      root.updateMatrixWorld(true);
      const tip=root.userData.arms[0].hand.localToWorld(REPAIR_TOOL_TIP.clone());
      assert.ok(tip.distanceTo(point)<.008,`tool contact gap ${tip.distanceTo(point)} at ${time}`);contacts++;
    }
    visit.update(1/30);
  }
  assert.ok(contacts>100);assert.equal(root.userData.repairTool.visible,false);
});

test('the approved reclined sofa extends rearward while retaining its lower seating contact',()=>{
  const sofa=createLounge(materials());sofa.updateMatrixWorld(true);
  const back=new THREE.Box3().setFromObject(sofa.getObjectByName('Sofa backrest'));
  assert.ok(back.min.z<-.80,'the reclined upper back moves toward the wall');
  assert.ok(Math.abs(back.max.z-(-.34))<.006,'the lower contact stays beside the existing seated position');
});
