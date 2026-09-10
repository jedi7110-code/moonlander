import test from 'node:test';
import assert from 'node:assert/strict';
import {Supplies,CrewMotion,getStation,currentAction} from '../src/obs/state.js';
import {CabinBrain} from '../src/obs/brain.js';
import {cargoPose,hatchOpening,animateDelivery,HATCH_TRAVEL} from '../src/obs/delivery.js';
import {Group,MeshBasicMaterial} from 'three';

function crew(options={}){
  const care=new Supplies(),actor=new CrewMotion(options),scene={obsUI:{hideWant(){}},time:{delayedCall(){}}};
  const brain=new CabinBrain(scene,actor,{care});
  return{care,actor,brain,advance(seconds){for(let i=0;i<seconds*60;i++){care.update(1/60);actor.update(1/60);brain.update(1/60);}}};
}
test('meals and drinks go directly to the facility and consume only on arrival',()=>{
  for(const [id,type]of [['galley','food'],['hydro','water']]){
    const {care,actor,brain,advance}=crew({floor:getStation(id).floor,x:getStation(id).x+50});
    const before={...care.supplies};brain._go(getStation(id));
    assert.deepEqual(actor.queue,[{type:'walk',x:getStation(id).x}]);assert.deepEqual(care.supplies,before);
    advance(1);assert.equal(currentAction(brain),id);
    assert.equal(care.supplies[type],before[type]-1);
  }
});
test('interrupted walks never consume stock',()=>{
  const {care,brain,advance}=crew({floor:2,x:700});brain._go(getStation('galley'));advance(1);brain._go(getStation('bunk'));
  assert.equal(care.supplies.food,3);
});
test('the order must be transmitted at the console before delivery begins',()=>{
  const {care,brain,actor,advance}=crew({floor:1,x:354});care.take('food');
  assert.equal(brain.requestSupplies(),true);assert.equal(brain.requestSupplies(),false);
  assert.equal(care.phase,'queued');care.update(500);assert.equal(care.phase,'queued');
  advance(1.1);assert.equal(actor.x,300);assert.equal(care.phase,'transmitting');assert.equal(currentAction(brain),'console');
  advance(3);assert.equal(care.phase,'inbound');assert.equal(care.supplies.food,2);
});
test('a bulk shipment replenishes once, only after landing',()=>{
  const care=new Supplies(),phases=[];let receipts=0;care.onPhase=p=>phases.push(p);care.onDeliver=()=>receipts++;
  care.take('food');care.take('water');care.take('catfood');care.request();care.transmit();
  care.update(15);assert.equal(care.phase,'unloading');care.update(2);assert.equal(care.supplies.food,2);
  care.update(.11);assert.deepEqual(care.supplies,care.capacity);assert.equal(receipts,1);
  care.update(50);assert.equal(care.phase,'idle');assert.equal(receipts,1);assert.deepEqual(phases,['queued','transmitting','inbound','unloading','complete']);
  assert.equal(care.request(),false);
});
test('depleted reserves including cat food trigger one autonomous console order',()=>{
  for(const type of ['food','water','catfood']){
    const {care,brain,advance}=crew();while(care.take(type)){}
    brain.update(1/60);assert.equal(brain.state,'goingToSupplyConsole');assert.equal(brain.actStation,'console');
    advance(20);assert.equal(care.deliveryCount,1);assert.equal(care.depleted,false);
  }
});
test('retargeting cancels an unsent order but not a dispatched shipment',()=>{
  const {care,brain,advance}=crew({floor:1,x:300});care.take('food');brain.requestSupplies();advance(.1);
  assert.equal(care.phase,'transmitting');brain._go(getStation('bunk'));assert.equal(care.phase,'idle');
  brain.requestSupplies();advance(3.5);assert.equal(care.phase,'inbound');brain._go(getStation('galley'));
  assert.equal(care.phase,'inbound');advance(15);assert.equal(care.lastDelivery,2);
});
test('stock disappearing en route never grants a free meal',()=>{
  const {care,brain,advance}=crew({floor:2,x:330});brain.needs.hunger=25;brain._go(getStation('galley'));
  while(care.take('food')){}advance(1);
  assert.ok(brain.needs.hunger<25);assert.equal(brain.state,'goingToSupplyConsole');
});
test('chat supply orders share the same state machine',()=>{
  const {care,brain}=crew();care.take('water');brain.handleChat('物資の配送をお願い');
  assert.equal(care.phase,'queued');assert.equal(brain.actStation,'console');brain.handleChat('resupply please');assert.equal(care.deliveryCount,1);
});
test('out-of-stock chat requests order a shipment instead of suggesting instant supply keys',()=>{
  const {care,brain}=crew();while(care.take('water')){}
  const reply=brain.handleChat('水をください');assert.equal(care.phase,'queued');assert.equal(brain.actStation,'console');
  assert.doesNotMatch(reply,/キー|key|パネル|panel/);brain.handleChat('水をください');assert.equal(care.deliveryCount,1);
});
test('cargo lands on the tray without clipping and the door closes after unloading',()=>{
  for(let i=0;i<3;i++){
    assert.equal(cargoPose(0,i).visible,false);
    for(let age=0;age<4;age+=.02){const pose=cargoPose(age,i);assert.ok(pose.y>=0);assert.ok(Number.isFinite(pose.y+pose.z+pose.tilt));}
    assert.equal(cargoPose(2.1,i).y,0);
  }
  assert.equal(hatchOpening(0),0);assert.equal(hatchOpening(1),1);assert.equal(hatchOpening(4),0);
  assert.equal(hatchOpening(.32),1);
  const ship={hatchDoor:new Group(),hatchLamp:new MeshBasicMaterial(),cargo:[new Group(),new Group(),new Group()]};
  const care=new Supplies();animateDelivery(ship,care);assert.ok(ship.cargo.every(g=>!g.visible));
  care.take('water');care.request();care.transmit();care.update(16.4);animateDelivery(ship,care);
  const first=ship.cargo.map(g=>g.position.toArray());animateDelivery(ship,care);assert.deepEqual(ship.cargo.map(g=>g.position.toArray()),first);
  care.update(3);animateDelivery(ship,care);assert.ok(ship.cargo.every(g=>g.visible&&g.position.y===.675));assert.equal(Math.abs(ship.hatchDoor.rotation.y),0);assert.equal(ship.hatchDoor.position.y,0);
});
test('supply shutter slides upward without swinging and preserves its mounting position',()=>{
  const ship={hatchDoor:new Group(),hatchLamp:new MeshBasicMaterial(),cargo:[]};ship.hatchDoor.position.set(4,2,-.43);ship.hatchDoor.userData.closedY=2;
  const care={phase:'unloading',delivery:{age:0}};
  for(const age of [0,.08,.16,.32,.65,2,2.8,3.25,4]){
    care.delivery.age=age;animateDelivery(ship,care);
    assert.equal(ship.hatchDoor.position.x,4);assert.equal(ship.hatchDoor.position.z,-.43);
    assert.equal(ship.hatchDoor.rotation.y,0);assert.equal(ship.hatchDoor.position.y,2+HATCH_TRAVEL*hatchOpening(age));
  }
  for(let i=0;i<3;i++){const pose=cargoPose(.65+i*.18,i);assert.ok(Math.abs((i-1)*.70+pose.x)+.305<.85);assert.ok(.675+pose.y+.715<2.15);}
});
