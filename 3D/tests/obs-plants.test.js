import test from 'node:test';
import assert from 'node:assert/strict';
import {PlantBed} from '../src/obs/plant-state.js';
import {CabinBrain} from '../src/obs/brain.js';
import {Supplies,CrewMotion,getStation} from '../src/obs/state.js';
import {MeshStandardMaterial,Box3,Vector3} from 'three';
import {createPlantRack,animatePlants} from '../src/obs/plants.js';
import {CONDENSATE,CONDENSATE_INTERVALS,sampleCondensate} from '../src/obs/condensate.js';
import {CabinAudio} from '../src/obs/audio.js';

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
test('Milo carries the harvest to the kitchen before putting it down or accepting another trip',()=>{
  const {care,actor,brain}=setup();care.supplies.food=0;brain.plants.update(1000);
  brain._go(getStation('plant'));actor.update(.1);brain.update(9);
  assert.equal(brain.harvestDelivery.phase,'pickup');assert.equal(brain.kitchenGreens,0);
  const hunger=brain.needs.hunger,stock=care.supplies.food;
  brain.update(0);assert.equal(brain.harvestDelivery.age,0);
  brain.update(1.4);assert.equal(brain.harvestDelivery.phase,'carrying');assert.ok(actor.busy);
  brain._go(getStation('console'));
  assert.equal(brain.harvestDelivery.phase,'carrying','a queued request does not abandon the vegetables');
  for(let i=0;i<300&&brain.harvestDelivery;i++){actor.update(1/30);brain.update(1/30);}
  assert.equal(brain.harvestDelivery,null);assert.equal(brain.kitchenGreens,3);
  assert.equal(care.supplies.food,stock,'delivery does not consume a meal or credit food twice');
  assert.ok(brain.needs.hunger<=hunger,'putting down vegetables does not trigger eating');
  assert.equal(brain.actStation,'console','the deferred request resumes after release');
});
test('empty or full-store harvests do not create a delivery',()=>{
  for(const mature of [false,true]){
    const {actor,brain}=setup();if(mature)brain.plants.update(1000);
    brain._go(getStation('plant'));actor.update(.1);brain.update(9);
    assert.equal(brain.harvestDelivery,null);assert.equal(brain.kitchenGreens,0);
  }
});
test('recovery fixtures stay inside the service bay and the sight tube carries moving condensate',()=>{
  const material=new MeshStandardMaterial(),m=new Proxy({},{get:()=>material});let rack;
  globalThis.document={createElement(){return{getContext(){return{fillRect(){},fillText(){},measureText(text){return{width:text.length*20};}};}};}};
  try{rack=createPlantRack(m,0);}finally{delete globalThis.document;}
  for(const name of ['Humidity recovery hood','Condensate tray','Condensate sight tube','Replaceable filter cartridge','Enclosed UV treatment','Nutrient conductivity sensor','Nutrient reservoir'])assert.ok(rack.root.getObjectByName(name),name);
  const bounds=new Box3().setFromObject(rack.root);assert.ok(bounds.max.x<2.6);assert.ok(bounds.max.y<2.7);
  assert.equal(rack.rows.length,3);
  for(const [i,row]of rack.rows.entries()){
    assert.ok(row.growLight.isRectAreaLight&&row.growLight.intensity>0);
    assert.ok(row.growLight.width>2,'the light spans the full vegetable row');
    assert.ok(row.growLight.position.y>row.plants[0].position.y+.3);
    assert.ok(new Vector3(0,0,-1).applyQuaternion(row.growLight.quaternion).y<-.99,'grow lights face down onto leaves');
    assert.ok(rack.root.getObjectByName(`Grow light diffuser ${i+1}`));
  }
  const bed=new PlantBed(),{condensate}=rack.recovery;
  animatePlants(rack,bed,1);assert.equal(rack.recovery.rotor.rotation.z,-3.2);
  const water=new Box3().setFromObject(condensate.reservoir),height=CONDENSATE.top-CONDENSATE.bottom;
  assert.ok(Math.abs((water.max.y-water.min.y)/height-1/3)<1e-6,'water already fills the lower third');
  for(let t=0;t<50;t+=.017){
    animatePlants(rack,bed,t);
    if(condensate.drop.visible)assert.ok(condensate.drop.position.y>CONDENSATE.level&&condensate.drop.position.y<CONDENSATE.nozzle);
    assert.equal(condensate.surface.position.y,CONDENSATE.level,'mean water level stays fixed');
  }
  animatePlants(rack,bed,2.42);
  const last={position:condensate.drop.position.toArray(),surface:Array.from(condensate.surface.geometry.attributes.position.array)};
  animatePlants(rack,bed,2.42);
  assert.deepEqual(condensate.drop.position.toArray(),last.position);
  assert.deepEqual(Array.from(condensate.surface.geometry.attributes.position.array),last.surface,'pausing freezes the ripple as well');
});
test('condensate forms one drop, accelerates into the water, and settles between irregular drips',()=>{
  const impacts=[];let last=-1,fall=[],idle=0;
  for(let t=0;t<48;t+=.005){
    const state=sampleCondensate(t);
    if(state.impactIndex>last){impacts.push(t);last=state.impactIndex;}
    if(state.phase==='falling'&&impacts.length===0)fall.push(state.y);
    if(!state.visible&&state.rippleAge<0)idle++;
    assert.ok(state.radius<=.006,'a small droplet, not the former 5 cm bead');
    if(state.phase==='falling')assert.ok(state.visible&&state.rippleAge<0);
    if(state.rippleAge>=0)assert.equal(state.visible,false,'impact happens after the falling drop disappears');
  }
  assert.ok(fall.length>20&&fall[0]-fall[1]<fall.at(-2)-fall.at(-1),'the detached drop accelerates');
  const intervals=impacts.slice(1).map((time,i)=>time-impacts[i]);
  assert.ok(intervals.every(seconds=>seconds>3&&seconds<4.7));
  assert.ok(Math.max(...intervals)-Math.min(...intervals)>.8,'dripping is not metronomic');
  assert.ok(idle>0,'the surface rests before another drop forms');
  const loop=CONDENSATE_INTERVALS.reduce((sum,seconds)=>sum+seconds,0),first=sampleCondensate(0),next=sampleCondensate(loop);
  assert.equal(next.phase,first.phase);assert.equal(next.y,first.y);
});
test('water sounds follow visible impacts once, with no replay on unmute or a time jump',()=>{
  const audio=new CabinAudio(),played=[];
  audio.waterDrop=(index)=>{if(audio.enabled)played.push(index);};
  for(let time=0;time<7;time+=1/60)audio.update(1/60,false,0,time);
  assert.deepEqual(played,[]);
  audio.enabled=true;
  for(let time=7;time<11;time+=1/60)audio.update(1/60,false,0,time);
  assert.deepEqual(played,[2]);
  audio.update(1/60,false,0,11);audio.update(0,false,0,11);
  assert.deepEqual(played,[2]);
  audio.update(1/60,false,0,30);
  assert.deepEqual(played,[2],'a jump does not play old impacts');
});
test('growth and harvest do not silently subtract potable water reserves',()=>{
  const bed=new PlantBed(),care=new Supplies(),water=care.supplies.water;
  bed.update(1000);care.supplies.food=0;bed.harvest(care);assert.equal(care.supplies.water,water);
});
