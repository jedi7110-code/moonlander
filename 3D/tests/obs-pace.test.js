import test from 'node:test';
import assert from 'node:assert/strict';
import {Brain} from '../../js/obs/brain.js?v=15';
import {CabinBrain} from '../src/obs/brain.js';
import {CrewMotion,Supplies,CatRoutine,getStation} from '../src/obs/state.js';
import {CABIN_PACE} from '../src/obs/pace.js';
import {BUNK_TRANSITION_DECAY} from '../src/obs/bunk-visit.js';

const setup=()=>{
  const care=new Supplies(),actor=new CrewMotion(),scene={time:{delayedCall(){}},sound:{add(){return{play(){},once(_event,fn){fn();},destroy(){}};}},obsUI:{hideWant(){},showWant(){},flashMonitor(){}}};
  return{care,actor,scene,brain:new CabinBrain(scene,actor,{care,random:()=>.8})};
};
test('3D slows clock and passive depletion without changing the original 2D pace',()=>{
  const {care,actor,scene,brain}=setup(),original=new Brain(scene,actor,{care});
  for(const b of [brain,original]){b.state='goingTo';Object.keys(b.needs).forEach(key=>b.needs[key]=80);b.update(10);}
  assert.equal(original.dayMs,240000);assert.equal(brain.dayMs,900000);
  assert.ok(Math.abs((80-brain.needs.hunger)-(80-original.needs.hunger)*CABIN_PACE.needDecay)<1e-10);
  assert.ok(Math.abs(brain.hour-(8+4/15))<1e-10);
});
test('satisfied needs do not spend supplies, but a manual meal still completes at normal speed',()=>{
  const {care,actor,brain}=setup();Object.keys(brain.needs).forEach(key=>brain.needs[key]=90);brain.exercise=90;
  brain._choose();assert.equal(brain.state,'idle');assert.equal(actor.busy,false);assert.equal(care.supplies.food,3);
  actor.floor=2;actor.y=870;actor.x=getStation('galley').x;
  brain._go(getStation('galley'));actor.update(.1);assert.equal(brain.performT,10);assert.equal(care.supplies.food,2);
  brain.update(10);assert.equal(brain.needs.hunger,100);assert.notEqual(brain.state,'performing');
});
test('cat appetite slows without stretching movement or sleep recovery',()=>{
  const {care}=setup(),cat=new CatRoutine(care);cat.hunger=80;cat.energy=20;cat.rest('sleep',20);cat.update(10);
  assert.ok(Math.abs(cat.hunger-77.84)<1e-10);assert.equal(cat.energy,50);assert.equal(cat.modeTime,10);
});
test('low physical needs shorten leisure and postpone exercise',()=>{
  const {brain}=setup();brain.needs.hunger=40;brain._startPerform(getStation('lounge'));assert.equal(brain.curDurSec,8);
  brain.update(2.4);brain._endPerform();brain.update(2.8);Object.keys(brain.needs).forEach(key=>brain.needs[key]=80);brain.needs.hygiene=20;brain.exercise=1;
  brain._choose();assert.equal(brain.actStation,'shower');
});
test('capsule boarding has a reduced depletion budget without speeding up the motion',()=>{
  const {brain}=setup();brain._startPerform(getStation('bunk'));
  const multiplier=brain._decayMul('hunger');brain.update(1);
  assert.equal(brain.bunkVisit.phase,'opening');assert.equal(brain.bunkVisit.age,0);
  brain.bunkVisit=null;assert.ok(Math.abs(multiplier/brain._decayMul('hunger')-BUNK_TRANSITION_DECAY)<1e-9);
});
test('a ten-minute autonomous routine can serve all basic needs without starvation',()=>{
  const results=[];
  for(const start of [35,50,80]){
    const {care,actor,brain}=setup();Object.keys(brain.needs).forEach(key=>brain.needs[key]=start);brain.exercise=start;
    // Isolate routine capacity from the independently tested random medical incidents.
    brain.health.nextIncident=Infinity;
    let lowest=100;const actions=new Set();
    for(let i=0;i<600*60;i++){
      care.update(1/60);actor.update(1/60);brain.update(1/60);
      lowest=Math.min(lowest,...Object.values(brain.needs));if(brain.actStation)actions.add(brain.actStation);
    }
    results.push({start,lowest});assert.ok(lowest>10,JSON.stringify(results));
    for(const id of ['galley','hydro','bunk','shower','toilet','gym'])assert.ok(actions.has(id),id);
  }
});
