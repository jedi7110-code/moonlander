import test from 'node:test';
import assert from 'node:assert/strict';
import {createLoadingGauge} from '../src/obs/loading-gauge.js';

function fakeRoot(){
  const attributes={'aria-hidden':'true'},vars={};
  const gauge={setAttribute(name,value){attributes[name]=value;},removeAttribute(name){delete attributes[name];}};
  return {attributes,vars,root:{querySelector:selector=>selector==='.loading-gauge'?gauge:null,style:{setProperty(name,value){vars[name]=value;}}}};
}

test('the gauge exposes a progressbar that only advances and clamps to the full bar',()=>{
  const f=fakeRoot(),gauge=createLoadingGauge(f.root);
  assert.equal(f.attributes['aria-hidden'],undefined);assert.equal(f.attributes.role,'progressbar');assert.equal(f.attributes['aria-valuenow'],'0');
  assert.equal(gauge.set(.12),.12);assert.equal(f.vars['--cabin-load-progress'],'0.1200');assert.equal(f.attributes['aria-valuenow'],'12');
  assert.equal(gauge.set(.05),.12,'a smaller value never moves the bar back');
  assert.equal(gauge.set(NaN),.12);assert.equal(gauge.set(1.4),1);assert.equal(f.attributes['aria-valuenow'],'100');
});

test('a span maps a sub-phase onto its milestones and tolerates out-of-range fractions',()=>{
  const f=fakeRoot(),gauge=createLoadingGauge(f.root),compile=gauge.span(.72,.92);
  assert.equal(compile(-1),.72);assert.ok(Math.abs(compile(.5)-.82)<1e-9);assert.equal(compile(2),.92);
  assert.equal(gauge.value,.92);assert.equal(f.vars['--cabin-load-progress'],'0.9200');
});

test('a document without the gauge markup still records progress safely',()=>{
  const gauge=createLoadingGauge(null);
  assert.equal(gauge.set(.5),.5);assert.equal(gauge.value,.5);
  assert.equal(createLoadingGauge({querySelector:()=>null}).span(0,1)(.3),.3);
});

test('completion waits for the final transition and a fully painted frame before releasing the loader',async()=>{
  const f=fakeRoot(),frames=[];let finishTransition,flushed=false,done=false;
  const transition=new Promise(resolve=>{finishTransition=resolve;});
  const fill={getAnimations(){assert.equal(flushed,true);return [{finished:transition}];}};
  f.root.ownerDocument={defaultView:{getComputedStyle(element){assert.equal(element,fill);flushed=true;return {transform:'matrix(0.96, 0, 0, 1, 0, 0)'};}}};
  const query=f.root.querySelector;f.root.querySelector=selector=>selector==='.loading-gauge-fill'?fill:query(selector);
  const gauge=createLoadingGauge(f.root);gauge.set(.96);
  const ready=gauge.finish({nextFrame:()=>new Promise(resolve=>frames.push(resolve))}).then(()=>{done=true;});
  assert.equal(f.attributes['aria-valuenow'],'100');assert.equal(done,false);assert.equal(frames.length,0);
  finishTransition();await new Promise(resolve=>setImmediate(resolve));
  assert.equal(done,false);assert.equal(frames.length,1);
  frames.shift()();await Promise.resolve();assert.equal(done,false);
  frames.shift()();await ready;assert.equal(done,true);
});

test('completion still presents a full frame with reduced motion or a cancelled transition',async()=>{
  for(const animations of [[],[{finished:Promise.reject(new Error('transition cancelled'))}]]){
    const f=fakeRoot();let frames=0;
    const query=f.root.querySelector;f.root.querySelector=selector=>selector==='.loading-gauge-fill'?{getAnimations:()=>animations}:query(selector);
    const gauge=createLoadingGauge(f.root);
    await gauge.finish({nextFrame:async()=>{frames++;}});
    assert.equal(gauge.value,1);assert.equal(frames,2);
  }
  const gauge=createLoadingGauge(null);await gauge.finish();assert.equal(gauge.value,1);
});
