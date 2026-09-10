import test from 'node:test';
import assert from 'node:assert/strict';
import {PlantBed} from '../src/obs/plant-state.js';
import {CabinBrain} from '../src/obs/brain.js';
import {Supplies,CrewMotion,getStation} from '../src/obs/state.js';
import {MeshStandardMaterial,Box3} from 'three';
import {createPlantRack,animatePlants} from '../src/obs/plants.js';

test('three beds grow at staggered rates and stop at maturity',()=>{
  const bed=new PlantBed();bed.update(70);assert.equal(bed.ready,1);
  const before=bed.rows.map(row=>row.growth);bed.update(0);assert.deepEqual(bed.rows.map(row=>row.growth),before);
  bed.update(1000);assert.equal(bed.ready,3);assert.ok(bed.rows.every(row=>row.growth===1));
});
test('harvest fills only available storage and keeps excess crops on the rack',()=>{
  const bed=new PlantBed(),care=new Supplies();bed.update(1000);
  assert.equal(bed.harvest(care),0);assert.equal(bed.ready,3);
  care.take('food');assert.equal(bed.harvest(care),1);assert.equal(care.supplies.food,care.capacity.food);assert.equal(bed.ready,2);
  assert.equal(bed.rows[0].growth,.05);assert.equal(bed.harvest(care),0);
  care.supplies.food=0;assert.equal(bed.harvest(care),2);assert.equal(care.supplies.food,2);
});
test('tending cannot be spammed and a harvested bed regrows',()=>{
  const bed=new PlantBed(),care=new Supplies();bed.tend();const growth=bed.rows[0].growth;bed.tend();assert.equal(bed.rows[0].growth,growth);
  bed.update(1000);care.supplies.food=0;bed.harvest(care);assert.equal(bed.ready,0);
  bed.update(300);assert.equal(bed.ready,3);
});
function setup(){
  const care=new Supplies(),actor=new CrewMotion({floor:2,x:385}),results=[];
  const brain=new CabinBrain({obsUI:{hideWant(){},plantResult(count){results.push(count);}}},actor,{care,random:()=>.8});
  return{care,actor,brain,results};
}
test('harvesting requires arrival and completion; interrupted work grants no food',()=>{
  const {care,actor,brain,results}=setup();care.supplies.food=0;brain.plants.update(1000);
  brain._go(getStation('plant'));assert.equal(care.supplies.food,0);actor.update(.1);brain.update(3);assert.equal(care.supplies.food,0);
  brain._go(getStation('lounge'));assert.equal(care.supplies.food,0);assert.equal(brain.plants.ready,3);
  actor.x=385;actor.floor=2;actor.y=870;brain._go(getStation('plant'));actor.update(.1);
  brain.update(9);assert.equal(care.supplies.food,3);assert.deepEqual(results,[3]);assert.equal(brain.plants.ready,0);
});
test('autonomous harvest respects urgent needs and chat can request plant care',()=>{
  const {care,brain}=setup();care.take('food');brain.plants.update(1000);brain._choose();assert.equal(brain.actStation,'plant');
  brain._toIdle();brain.needs.thirst=8;brain._choose();assert.equal(brain.actStation,'hydro');
  brain.handleChat('野菜を収穫して');assert.equal(brain.actStation,'plant');
});
test('recovery fixtures stay inside the service bay and the sight tube carries moving condensate',()=>{
  const material=new MeshStandardMaterial(),m=new Proxy({},{get:()=>material});let rack;
  globalThis.document={createElement(){return{getContext(){return{fillRect(){},fillText(){},measureText(text){return{width:text.length*20};}};}};}};
  try{rack=createPlantRack(m,0);}finally{delete globalThis.document;}
  for(const name of ['Humidity recovery hood','Condensate tray','Condensate sight tube','Replaceable filter cartridge','Enclosed UV treatment','Nutrient conductivity sensor','Nutrient reservoir'])assert.ok(rack.root.getObjectByName(name),name);
  const bounds=new Box3().setFromObject(rack.root);assert.ok(bounds.max.x<2.6);assert.ok(bounds.max.y<2.7);
  const bed=new PlantBed();animatePlants(rack,bed,0);const start=rack.recovery.drops[0].position.y;
  animatePlants(rack,bed,1);assert.ok(rack.recovery.drops[0].position.y<start);assert.equal(rack.recovery.rotor.rotation.z,-3.2);
  for(let t=0;t<20;t+=.1){animatePlants(rack,bed,t);for(const drop of rack.recovery.drops)assert.ok(drop.position.y>=.55&&drop.position.y<=.83);}
  animatePlants(rack,bed,19.9);const last=rack.recovery.drops.map(drop=>drop.position.y);animatePlants(rack,bed,19.9);
  assert.deepEqual(rack.recovery.drops.map(drop=>drop.position.y),last);
});
test('growth and harvest do not silently subtract potable water reserves',()=>{
  const bed=new PlantBed(),care=new Supplies(),water=care.supplies.water;
  bed.update(1000);care.supplies.food=0;bed.harvest(care);assert.equal(care.supplies.water,water);
});
