import test from 'node:test';
import assert from 'node:assert/strict';
import {MeshStandardMaterial,Raycaster,Vector3} from 'three';
import {AISupervision,supervisionTelemetry} from '../src/obs/ai-supervision.js';
import {createAIServiceRack} from '../src/obs/ai-service-rack.js';
import {batchStatic} from '../src/obs/materials.js';
import {CabinStartupLighting} from '../src/obs/startup-lighting.js';
import {CabinEnvironment} from '../src/obs/environment.js';
import {BathroomVisit} from '../src/obs/bathroom.js';
import {FLOORS} from '../src/obs/layout.js';

function createRack(){
  const original=globalThis.document;
  globalThis.document={createElement:()=>{
    const labels=[],ctx=new Proxy({measureText:value=>({width:String(value).length*12}),fillText(value){labels.push(String(value));}},{get:(obj,key)=>obj[key]??(()=>{})});
    return{width:0,height:0,labels,getContext:()=>ctx};
  }};
  const materials=new Proxy({},{get:(obj,key)=>obj[key]??=(new MeshStandardMaterial({name:key}))});
  try{return createAIServiceRack(materials);}finally{if(original===undefined)delete globalThis.document;else globalThis.document=original;}
}

test('the three tracks follow actual cabin coordinates, including motion between decks',()=>{
  const actor={x:700,y:FLOORS[0].y,floor:0,busy:true},catRoutine={mode:'sleep',hunger:74,energy:63,motion:{x:1035,y:FLOORS[1].y,floor:1}};
  const brain={state:'goingTo',cur:{id:'shower'},needs:{hunger:42,thirst:51,energy:68},health:{value:96,stage:'recovering'}};
  const droid={docked:false,job:'laundry',position:{x:-2,y:0,floor:2}};
  const state={actor,brain,catRoutine,droid};let data=supervisionTelemetry(state);
  assert.equal(data.tracks.length,3);assert.equal(data.tracks[0].x,0);assert.equal(data.tracks[0].deck,0);
  assert.ok(Math.abs(data.tracks[1].x-7.37)<1e-8);assert.equal(data.tracks[1].deck,1);
  assert.equal(data.tracks[2].x,-2);assert.equal(data.tracks[2].deck,2);
  assert.equal(data.crewStatus,'TRANSIT > SHOWER');assert.equal(data.droidStatus,'LAUNDRY');
  assert.deepEqual(data.crew,{food:42,water:51,rest:68,health:96});assert.deepEqual(data.cat,{food:74,rest:63});
  actor.climbing=true;actor.y=(FLOORS[0].y+FLOORS[1].y)/2;data=supervisionTelemetry(state);
  assert.ok(Math.abs(data.tracks[0].deck-.5)<1e-8);assert.equal(data.crewStatus,'IN TRANSIT / SHAFT');
  assert.equal(supervisionTelemetry().tracks.length,0,'no invented occupants before connection');
});

test('a closed occupied bathroom stays occupied and real hatch repairs clear the alert',()=>{
  const environment=new CabinEnvironment({random:()=>.5}),bathroom=new BathroomVisit('shower');
  bathroom.update(20);assert.equal(bathroom.phase,'use');
  const brain={environment,bathroom,health:{value:100,stage:'healthy',needsCare:false}},state={brain,airlock:{opening:.5}};
  assert.equal(supervisionTelemetry(state).rooms.shower,'OCCUPIED');assert.equal(supervisionTelemetry(state).rooms.inner,'MOVING');
  environment.triggerFault();environment.setStage(environment.fault.serial,'repair');
  const fault=supervisionTelemetry(state);assert.equal(fault.alarms,1);assert.equal(fault.faultStage,'repair');
  environment.resolve(environment.fault.serial);assert.equal(supervisionTelemetry(state).alarms,0);
  brain.bathroom=null;assert.equal(supervisionTelemetry(state).rooms.shower,'CLOSED');
});

test('the journal records actual transitions once, bounds history and freezes with cabin time',()=>{
  const screens=new AISupervision(),environment=new CabinEnvironment({random:()=>.5}),brain={environment,hour:9.5,state:'idle'};
  const state={brain};screens.update(state);assert.equal(screens.events.length,1);
  for(let i=0;i<100;i++)assert.equal(screens.update(state),false);
  environment.update(1);screens.update(state);assert.equal(screens.events.length,1,'time passing is not an event');
  brain.state='goingTo';brain.cur={id:'galley'};environment.update(1);screens.update(state);
  assert.equal(screens.events.at(-1).message,'TRANSIT > GALLEY');assert.equal(screens.events.at(-1).time,'09:30');
  const count=screens.events.length;screens.update(state);assert.equal(screens.events.length,count);
  for(let i=0;i<80;i++){brain.state=i%2?'goingTo':'idle';environment.update(1);screens.update(state);}
  assert.equal(screens.events.length,24);
  environment.clock=0;screens.update(state);assert.equal(screens.events.length,1,'new session discards old events');
});

test('repair tracking and alarm journal identify the inner hatch, not the EVA exit',()=>{
  const screens=new AISupervision(),environment=new CabinEnvironment();
  const brain={environment,state:'idle'},state={brain};screens.update(state);
  environment.triggerFault();environment.update(1);screens.update(state);
  assert.deepEqual(screens.events.at(-1),{time:'08:00',source:'INNER LOCK',message:'DETECTED',alert:true});
  brain.cur={id:'innerHatch'};brain.hatchRepair={phase:'repair'};brain.state='repairingHatch';
  assert.equal(supervisionTelemetry(state).crewStatus,'INNER HATCH / REPAIR');
  environment.resolve(environment.fault.serial);environment.update(1);screens.update(state);
  assert.deepEqual(screens.events.at(-1),{time:'08:00',source:'INNER LOCK',message:'SEALED',alert:false});
});

test('rack bezels leave four distinct correctly proportioned displays visible ahead of the backplate',()=>{
  const {root,screens}=createRack();root.updateMatrixWorld(true);
  assert.equal(screens.displays.length,4);
  const headers=['HABITAT / POSITION TRACKING','OCCUPANTS / CARE STATUS','ENVIRONMENT / INTERLOCKS','SUPERVISOR / EVENT JOURNAL'];
  for(let i=0;i<4;i++){
    const display=root.getObjectByName(`AI supervision display ${i+1}`),canvas=screens.displays[i].canvas;
    assert.ok(canvas.labels.some(text=>text.includes(headers[i])));assert.ok(Math.abs(canvas.width/canvas.height-1.16/.27)<.008);
    const ray=new Raycaster(new Vector3(0,2.05-i*.42,1),new Vector3(0,0,-1));
    assert.equal(ray.intersectObject(root,true)[0].object,display,'glass remains visible through the opening');
    assert.equal(display.material.userData.cabinAlwaysPowered,true);
  }
  const batch=batchStatic(root),lighting=new CabinStartupLighting([batch]);lighting.update(.5);
  const versions=screens.displays.map(d=>d.texture.version);screens.update({clock:1});
  screens.displays.forEach((d,i)=>{assert.equal(d.texture.version,versions[i]+1);assert.ok(batch.children.some(mesh=>mesh.material.map===d.texture));});
  lighting.dispose();
});

test('unchanged displays avoid texture uploads while the live position and pressure screens update independently',()=>{
  const {screens}=createRack(),environment={clock:0,temperature:21.4,pressure:101.3};
  const state={brain:{environment,hour:9.5,state:'idle'},actor:{x:700,y:FLOORS[0].y,floor:0}};
  screens.update(state);const versions=screens.displays.map(display=>display.texture.version);
  for(let i=0;i<20;i++){environment.clock+=.5;screens.update(state);}
  assert.deepEqual(screens.displays.map(display=>display.texture.version),versions);
  state.actor.x+=50;environment.clock+=.5;screens.update(state);
  assert.deepEqual(screens.displays.map(display=>display.texture.version),versions.map((v,i)=>v+Number(i===0)));
  environment.pressure=100.9;environment.clock+=.5;screens.update(state);
  assert.deepEqual(screens.displays.map(display=>display.texture.version),versions.map((v,i)=>v+Number(i===0||i===2)));
});

test('the lightweight cover has real apertures with the baked harness recessed behind it',()=>{
  const {root}=createRack(),parts=[];root.traverse(obj=>parts.push(obj));
  assert.equal(parts.filter(obj=>obj.name.startsWith('Supervisor server')).length,2);
  const bay=root.getObjectByName('AI rack / wired service bay'),wiring=bay.getObjectByName('Baked service wiring'),cover=bay.getObjectByName('Perforated wiring cover');
  assert.equal(wiring.geometry.type,'PlaneGeometry');assert.ok(cover.position.z-wiring.position.z>=.1);
  root.updateMatrixWorld(true);
  const ray=new Raycaster(new Vector3(-.56,.435-.0885,1),new Vector3(0,0,-1));
  assert.equal(ray.intersectObject(bay,true)[0].object,wiring,'a punched opening shows the wiring behind the cover');
  ray.ray.origin.set(0,.435,1);assert.equal(ray.intersectObject(bay,true)[0].object,cover,'metal closes the gaps between openings');
  let triangles=0;bay.traverse(obj=>{if(obj.isMesh)triangles+=(obj.geometry.index?.count??obj.geometry.attributes.position.count)/3;});
  assert.ok(triangles<1000,`${triangles} triangles should remain below the service-bay budget`);
  assert.ok(!parts.some(obj=>obj.geometry?.type==='TubeGeometry'||obj.geometry?.type==='TorusGeometry'));
  assert.ok(!parts.some(obj=>obj.name==='Supervisor I-O circuit board'));assert.equal(parts.filter(obj=>obj.isLight).length,0);
  for(const obj of parts)if(obj.isMesh)assert.ok(Array.from(obj.geometry.attributes.position.array).every(Number.isFinite));
});
