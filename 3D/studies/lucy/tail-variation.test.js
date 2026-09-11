import test from 'node:test';
import assert from 'node:assert/strict';
import {TailVariation} from './tail-variation.js';

const seeded=seed=>()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
test('tail holds a pose, then changes gradually to a different pose',()=>{
  const tail=new TailVariation(()=>0);tail.update(5);
  assert.deepEqual(tail.weights,[1,0,0]);tail.update(2.2);
  assert.ok(Math.abs(tail.weights[0]-.5)<1e-8);
  assert.ok(Math.abs(tail.weights[1]-.5)<1e-8);
  tail.update(1.2);assert.deepEqual(tail.weights,[0,1,0]);
});
test('random tail profiles stay normalized, continuous and include high and low',()=>{
  const tail=new TailVariation(seeded(1024)),seen=new Set();let previous=tail.weights.slice();
  for(let frame=0;frame<180*60;frame++){
    tail.update(1/60);seen.add(tail.index);
    assert.ok(Math.abs(tail.weights.reduce((a,b)=>a+b,0)-1)<1e-9);
    tail.weights.forEach((w,i)=>{assert.ok(w>=-1e-9&&w<=1+1e-9);assert.ok(Math.abs(w-previous[i])<.014);});
    previous=tail.weights.slice();
  }
  assert.equal(seen.size,3);
});
test('tail variation is time-based, reproducible and differs between seeds',()=>{
  const a=new TailVariation(seeded(72)),b=new TailVariation(seeded(72));
  a.update(110);for(let i=0;i<110*60;i++)b.update(1/60);
  assert.equal(a.index,b.index);a.weights.forEach((w,i)=>assert.ok(Math.abs(w-b.weights[i])<1e-8));
  const starts=new Set([1,10000,999999].map(seed=>new TailVariation(seeded(seed)).index));assert.ok(starts.size>1);
});
test('paused and invalid time steps leave the pose and timer unchanged',()=>{
  const tail=new TailVariation(()=>.99),before=JSON.stringify(tail);
  for(const dt of [0,-1,NaN,Infinity])tail.update(dt);
  assert.equal(JSON.stringify(tail),before);assert.deepEqual(tail.weights,[0,0,1]);
});
