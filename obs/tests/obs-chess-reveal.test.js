import test from 'node:test';
import assert from 'node:assert/strict';
import {CHESS_REVEAL,sampleChessReveal} from '../src/obs/chess-reveal.js';

test('the entrance fills each layer left to right before advancing from the feet to the crown',()=>{
  const maximum=1.6,layers=new Set();let previous=0;
  assert.equal(sampleChessReveal(-1,maximum).cursor,-CHESS_REVEAL.halfWidth);
  for(let frame=0;frame<=CHESS_REVEAL.duration*60;frame++){
    const sample=sampleChessReveal(frame/60,maximum);layers.add(sample.layer);
    assert.ok(sample.baseHeight>=previous&&sample.height<=maximum);previous=sample.baseHeight;
    assert.ok(Math.abs(sample.baseHeight/maximum*CHESS_REVEAL.layers-sample.layer)<1e-9);
  }
  assert.equal(layers.size,CHESS_REVEAL.layers+1,'a normal display presents every thin layer');
  const complete=sampleChessReveal(CHESS_REVEAL.duration,maximum);
  assert.equal(complete.done,true);assert.equal(complete.baseHeight,maximum);
  assert.equal(sampleChessReveal(999,maximum).height,maximum);
  const pass=CHESS_REVEAL.duration/CHESS_REVEAL.layers;
  for(let layer=0;layer<CHESS_REVEAL.layers;layer++){
    const left=sampleChessReveal((layer+.1)*pass,maximum),right=sampleChessReveal((layer+.9)*pass,maximum);
    assert.equal(left.layer,right.layer);assert.equal(left.height,right.height);
    assert.ok(left.cursor<0&&right.cursor>0,'the active layer extends across both halves');
    const next=sampleChessReveal((layer+1)*pass,maximum);
    assert.ok(Math.abs(next.baseHeight-left.height)<1e-9,'the completed layer remains fully visible');
  }
});
test('sampling backwards, repeats and different frame rates preserve the same build height at the same time',()=>{
  for(const maximum of [.8,1.2,1.7])for(const time of [0,.1,.5,.9,1.5,1.8]){
    const expected=sampleChessReveal(time,maximum);
    sampleChessReveal(time+.3,maximum);sampleChessReveal(0,maximum);
    assert.deepEqual(sampleChessReveal(time,maximum),expected);
  }
  const before=sampleChessReveal(.91,1.6),after=sampleChessReveal(.95,1.6);
  assert.equal(before.layer,after.layer);assert.ok(before.cursor<after.cursor);
  assert.equal(sampleChessReveal(NaN,1.6).baseHeight,0);
});
