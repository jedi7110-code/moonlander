import test from 'node:test';
import assert from 'node:assert/strict';
import {CabinBrain} from '../src/obs/brain.js';
import {Brain} from '../../js/obs/brain.js?v=15';
import {CrewMotion,CatRoutine,Supplies} from '../src/obs/state.js';

const seeded=seed=>()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
test('Milo starts with independently varied safe needs while the 2D defaults stay unchanged',()=>{
  const actions=new Set(),starts=new Set();
  for(let seed=1;seed<=120;seed++){
    const actor=new CrewMotion(),care=new Supplies(),brain=new CabinBrain({obsUI:{hideWant(){}}},actor,{care,random:seeded(seed)});
    for(const value of [...Object.values(brain.needs),brain.exercise])assert.ok(value>=35&&value<=90);
    starts.add(JSON.stringify(brain.needs));brain._choose();actions.add(brain.actStation);
  }
  assert.equal(starts.size,120);assert.ok(actions.size>=5);
  const original=new Brain({},new CrewMotion(),{care:new Supplies()});assert.equal(original.needs.hunger,72);
});
test('cats start on the sofa, but later choices, durations and destinations vary',()=>{
  const modes=new Set(),destinations=new Set(),durations=new Set();
  for(let seed=1;seed<=200;seed++){
    const cat=new CatRoutine(new Supplies(),{random:seeded(seed)});
    assert.equal(cat.mode,'sleep');assert.equal(cat.motion.onSofa,true);
    durations.add(cat.remaining);cat.remaining=0;cat.choose();modes.add(cat.mode);
    if(cat.mode==='walk')destinations.add(JSON.stringify(cat.motion.destination));
  }
  assert.deepEqual([...modes].sort(),['fetch','groom','look','sleep','walk']);assert.ok(destinations.size>=4);assert.ok(durations.size>100);
});
test('cat needs respond to activities, pause freezes them, and severe hunger overrides chance',()=>{
  const care=new Supplies(),cat=new CatRoutine(care,{random:seeded(40)});
  cat.hunger=80;cat.energy=30;cat.rest('sleep',20);cat.update(2);assert.equal(cat.energy,36);
  cat.groomNeed=60;cat.rest('groom',20);cat.update(2);assert.equal(cat.groomNeed,52);
  const snapshot=JSON.stringify(cat);cat.update(0);assert.equal(JSON.stringify(cat),snapshot);
  cat.hunger=20;cat.update(.1);assert.equal(cat.pendingMove.kind,'fetch');cat.update(1.3);assert.equal(cat.mode,'fetch');
});
test('empty reserves never select feeding and seeded runs are reproducible without per-frame random draws',()=>{
  const care=new Supplies();care.supplies.catfood=0;
  for(let seed=1;seed<=60;seed++){
    const a=new CatRoutine(care,{random:seeded(seed)}),b=new CatRoutine(care,{random:seeded(seed)});a.hunger=b.hunger=0;
    a.choose();b.choose();assert.notEqual(a.mode,'fetch');assert.equal(a.mode,b.mode);assert.deepEqual(a.motion.destination,b.motion.destination);
  }
});
