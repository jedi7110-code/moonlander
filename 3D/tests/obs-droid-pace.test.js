import test from 'node:test';
import assert from 'node:assert/strict';
import {DroidRoutine,DROID_PACE,DROID_JOBS} from '../src/obs/droid-routine.js';
import {Supplies} from '../src/obs/state.js';
import {PlantBed} from '../src/obs/plant-state.js';
import {planDroidTurn} from '../src/obs/droid-turn.js';

test('travel, pivots and hand actions run at 1.6x without speeding up the ship clock',()=>{
  const care=new Supplies(),brain={plants:new PlantBed()},routine=new DroidRoutine({care,brain,actor:{x:1040},cat:{mode:'sleep'}});
  routine.request('laundry');
  for(const s of routine.steps){
    if(s.kind==='walk')assert.ok(Math.abs(Math.hypot(s.to.x-s.from.x,s.to.y-s.from.y,s.to.z-s.from.z)/s.duration-.58*DROID_PACE)<1e-8);
    if(s.turn)assert.equal(s.duration,planDroidTurn(s.turn.from,s.turn.to).duration/DROID_PACE);
    if(s.kind==='work')assert.equal(s.actionRate,DROID_PACE);
  }
  const wash=routine.steps.find(s=>s.action==='wash');assert.equal(wash.duration,15);
  const load=routine.steps.find(s=>s.action==='laundry-load');assert.equal(load.duration,2.5);
  while(routine.step!==load)routine.update(1/60);
  routine.update(.5);assert.ok(Math.abs(routine.pose.age-routine.age*DROID_PACE)<1e-9);assert.equal(routine.pose.duration,4);
  const time=routine.time;routine.update(1);assert.ok(Math.abs(routine.time-time-1)<1e-8);
});

test('all jobs shorten the moving/working schedule while retaining single inventory events',()=>{
  for(const job of Object.keys(DROID_JOBS)){
    const care=new Supplies(),brain={plants:new PlantBed()};
    care.lastDelivery=1;care.supplies.food=1;brain.plants.rows.forEach(row=>row.growth=1);
    const routine=new DroidRoutine({care,brain,actor:{x:1040},cat:{mode:'sleep'}});assert.ok(routine.request(job));
    const work=routine.steps.filter(s=>s.kind==='work');
    assert.ok(work.length);assert.ok(work.every(s=>s.duration>0&&s.actionRate===DROID_PACE));
    for(let i=0;i<18000&&!routine.docked;i++)routine.update(1/30);
    assert.ok(routine.docked);assert.equal(routine.completed[job],1);
  }
});
