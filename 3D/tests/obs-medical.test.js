import test from 'node:test';
import assert from 'node:assert/strict';
import {MeshStandardMaterial,Box3,Vector3} from 'three';
import {MEDICAL,getStation} from '../src/obs/layout.js';
import {getStation as originalStation} from '../../js/obs/layout.js?v=15';
import {CrewMotion,Supplies,currentAction} from '../src/obs/state.js';
import {CabinBrain} from '../src/obs/brain.js';
import {createMilo,animateMilo} from '../src/obs/characters.js';
import {createMedicalBay,animateMedical,medicalReadings,medicalRecline,MED_BED} from '../src/obs/medical.js';

function setup(){
  const actor=new CrewMotion({floor:1,x:MEDICAL.x}),care=new Supplies(),results=[];
  const brain=new CabinBrain({obsUI:{hideWant(){},medicalResult(report){results.push(report);}}},actor,{care});
  return{actor,care,brain,results};
}
test('medical is confined to the 3D cabin and occupies the area left of the inner hatch',()=>{
  assert.equal(originalStation('medical'),undefined);assert.equal(getStation('medical').floor,1);
  assert.ok(MEDICAL.x<getStation('innerHatch').x);assert.equal(MEDICAL.need,null);
});
test('a completed check produces one report, without curing needs or consuming food',()=>{
  const {actor,care,brain,results}=setup();brain._go(MEDICAL);actor.update(1/60);
  assert.equal(currentAction(brain),'medical');assert.equal(results.length,0);
  const start={...brain.needs};brain.update(0);assert.equal(brain.performT,14);
  for(let i=0;i<14*60+1;i++)brain.update(1/60);
  assert.equal(results.length,1);assert.deepEqual(brain.lastMedicalReport,results[0]);
  assert.notEqual(currentAction(brain),'medical');assert.deepEqual(care.supplies,care.capacity);
  for(const key of Object.keys(start))assert.ok(brain.needs[key]<start[key]);
});
test('medical chat starts a check; cancelling it cannot create a result',()=>{
  const {actor,brain,results}=setup();
  for(const text of ['医療区画へ','健診して','medical bay','checkup']){
    brain.handleChat(text);assert.equal(brain.actStation,'medical');actor.update(1/60);brain.update(3);
    brain._go(getStation('eva'));brain.update(20);assert.equal(results.length,0);
  }
  assert.equal(brain.lastMedicalReport,null);
});
test('readings reflect game fatigue and hydration, not random per-frame values',()=>{
  const well={energy:80,thirst:70},tired={energy:20,thirst:70},dry={energy:80,thirst:20};
  assert.equal(medicalReadings(well).advice,'routine');assert.equal(medicalReadings(tired).advice,'rest');
  assert.equal(medicalReadings(dry).advice,'water');assert.ok(medicalReadings(tired).pulse>medicalReadings(well).pulse);
  assert.deepEqual(medicalReadings(well),medicalReadings(well));
});
test('couch stays clear of the passage, patient faces upward, and pose resets after leaving',()=>{
  const material=new MeshStandardMaterial(),m=new Proxy({},{get:()=>material}),milo=createMilo(m);let bay;
  const ctx={fillRect(){},fillText(){},measureText(text){return{width:text.length*parseFloat(this.font.slice(4))*.6};},beginPath(){},moveTo(){},lineTo(){},stroke(){}};
  globalThis.document={createElement(){return{getContext(){return ctx;}};}};
  try{bay=createMedicalBay(m,3.392);}finally{delete globalThis.document;}
  const bounds=new Box3().setFromObject(bay.root);
  assert.ok(bounds.max.x<6.7);assert.ok(bounds.min.x>1.2);assert.ok(bounds.max.y<3.392+3.0);
  assert.ok(new Box3().setFromObject(bay.bed).max.z<.48);
  assert.equal(medicalRecline(0),0);assert.equal(medicalRecline(7),1);assert.equal(medicalRecline(14),0);
  for(const time of [0,.3,1,2,6,12,13,14]){
    animateMilo(milo,{action:'medical',moving:false,time,actionTime:time});milo.updateMatrixWorld(true);
    assert.ok(Number.isFinite(milo.userData.body.position.y));
    if(time===6){
      const body=milo.userData.body,up=body.localToWorld(new Vector3(0,1,1)).sub(body.localToWorld(new Vector3(0,1,0)));
      assert.ok(up.y>.99);assert.ok(Math.abs(up.x)<1e-10);
      const hips=body.localToWorld(new Vector3(0,.988,0));assert.ok(Math.abs(hips.y-(MED_BED.top+.12))<1e-10);
    }
  }
  animateMilo(milo,{action:null,moving:true,facing:-1,time:15});
  assert.equal(milo.userData.body.rotation.x,0);assert.equal(milo.userData.body.position.z,0);
  animateMedical(bay,0,false,null);assert.equal(bay.display.frame,'STANDBYnull');
  const readings=medicalReadings({energy:80,thirst:80});animateMedical(bay,5,true,readings);
  const version=bay.display.texture.version;animateMedical(bay,5,true,readings);assert.equal(bay.display.texture.version,version);
  animateMedical(bay,5.2,true,readings);assert.ok(bay.display.texture.version>version);
  animateMedical(bay,6,false,null);assert.equal(bay.display.frame,'STANDBYnull');
  animateMedical(bay,14,false,readings);assert.ok(bay.display.frame.startsWith('LAST CHECK'));
});
