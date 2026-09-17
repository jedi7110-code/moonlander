import test from 'node:test';
import assert from 'node:assert/strict';
import {BathroomVisit} from '../src/obs/bathroom.js';
import {CabinBrain} from '../src/obs/brain.js';
import {CrewMotion,Supplies,getStation} from '../src/obs/state.js';
import {Box3,Group,MeshStandardMaterial} from 'three';
import {createBathroom,FLOOR_Y} from '../src/obs/ship.js';
import {animateVerticalShutter} from '../src/obs/shutter.js';

const scene={time:{delayedCall(){}},obsUI:{hideWant(){}}};
const setup=id=>{
 const actor=new CrewMotion({floor:getStation(id).floor,x:getStation(id).x});
 const care=new Supplies(),brain=new CabinBrain(scene,actor,{care,name:'MILO'});brain.health.nextEventIn=Infinity;
 return{actor,brain,care,tick(seconds){for(let i=0;i<seconds*120;i++){actor.update(1/120);brain.update(1/120);}}};
};
for(const id of ['shower','toilet'])test(`${id}: the vertical shutter clears passage and retracts behind a fixed ceiling lip`,()=>{
 const material=new MeshStandardMaterial(),m=new Proxy({},{get:()=>material}),fixed=new Group(),animated=new Group(),floor=FLOOR_Y[0];
 const ctx={fillRect(){},fillText(){},measureText(text){return{width:text.length*parseFloat(this.font.slice(4))*.6};}};
 globalThis.document={createElement:()=>({getContext:()=>ctx})};
 let fixture;try{fixture=createBathroom(fixed,animated,m,-7,floor,id);}finally{delete globalThis.document;}
 const {door}=fixture,initial=door.position.clone(),visit=new BathroomVisit(id),bounds=new Box3();let exited=false;
 for(let frame=0;!visit.done&&frame<1200;frame++){
  const pose=visit.pose;animateVerticalShutter(door,pose.opening);animated.updateMatrixWorld(true);
  assert.equal(door.position.x,initial.x);assert.equal(door.position.z,initial.z);
  assert.deepEqual(door.rotation.toArray().slice(0,3),[0,0,0]);
  bounds.setFromObject(door);
  if(pose.moving)assert.ok(bounds.min.y>floor+2.48,'the whole panel must clear the opening before entry or exit');
  door.traverse(part=>{if(!part.isMesh)return;assert.equal(part.material.clippingPlanes[0].constant,floor+2.48);assert.equal(part.material.clipShadows,true);assert.notEqual(part.material,material);});
  if(visit.phase==='use'&&!exited){visit.requestExit();exited=true;}
  visit.update(1/120);
 }
 assert.ok(visit.done&&exited);animateVerticalShutter(door,visit.pose.opening);assert.equal(door.position.y,floor);
 assert.equal(material.clippingPlanes,null,'fixed walls keep their unclipped materials');
 for(const root of [fixed,animated])root.traverse(part=>part.geometry?.dispose());material.dispose();
});
for(const id of ['shower','toilet'])test(`${id}: opens, enters, shuts, uses, exits and shuts without teleporting`,()=>{
 let started=0,ended=0;const visit=new BathroomVisit(id,{entered:()=>started++,exited:()=>ended++}),phases=[];
 let previous=.78;
 for(let i=0;i<120*4;i++){
  visit.update(1/120);const pose=visit.pose;
  if(phases.at(-1)!==visit.phase)phases.push(visit.phase);
  assert.ok(Math.abs(pose.depth-previous)<.02);previous=pose.depth;
  if(pose.moving)assert.equal(pose.opening,1);
 }
 assert.equal(started,1);assert.equal(visit.phase,'use');assert.equal(visit.pose.opening,0);
 visit.update(0);assert.equal(visit.phase,'use');visit.requestExit();
 for(let i=0;i<120*4;i++)visit.update(1/120);
 assert.equal(ended,1);assert.equal(visit.pose.depth,.78);assert.equal(visit.pose.opening,0);
 assert.deepEqual(phases,['reach','open','enter','close','use']);
});
test('using the bathroom starts only once its door is closed; a new order waits for exit',()=>{
 const {actor,brain,tick}=setup('shower');brain._go(getStation('shower'));tick(1);
 assert.equal(brain.state,'enteringBathroom');assert.equal(brain.recoverNeed,null);
 tick(3);assert.equal(brain.state,'performing');assert.equal(brain.bathroom.phase,'use');
 brain._go(getStation('hydro'));assert.equal(actor.busy,false);const y=actor.y;
 tick(1);assert.equal(actor.y,y);assert.equal(brain.actStation,'shower');
 tick(3);assert.equal(brain.bathroom,null);assert.equal(brain.actStation,'hydro');assert.equal(actor.busy,true);
});
test('an order during entry does not interrupt passage through the door',()=>{
 const {brain,tick}=setup('toilet');brain._go(getStation('toilet'));tick(1.5);
 const depth=brain.bathroom.pose.depth;brain._go(getStation('galley'));assert.equal(brain.bathroom.pose.depth,depth);
 brain._go(getStation('hydro'));tick(6.5);assert.equal(brain.bathroom,null);assert.equal(brain.actStation,'hydro');
});
test('dining finishes returning its utensils before a new order starts',()=>{
 const {brain,care,tick}=setup('galley');brain._go(getStation('galley'));tick(1);
 const count=care.supplies.food;brain._go(getStation('hydro'));assert.equal(brain.actStation,'galley');
 tick(2);assert.equal(brain.actStation,'galley');assert.equal(care.supplies.food,count);
 tick(7.2);assert.equal(brain.actStation,'hydro');
});
