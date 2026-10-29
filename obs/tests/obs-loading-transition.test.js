import test from 'node:test';
import assert from 'node:assert/strict';
import {closeLoadingScreen} from '../src/obs/loading-transition.js';

test('the cabin stays covered until both the collapsing frame and the glow finish',async()=>{
  let endFrame,endGlow,flushed=false;
  const classes=new Set(),root={hidden:false,
    classList:{add:name=>classes.add(name),remove:name=>classes.delete(name)},
    ownerDocument:{defaultView:{getComputedStyle:()=>{flushed=true;return {animationName:'cabin-signal-reveal'};}}},
    getAnimations:options=>{assert.equal(flushed,true);assert.equal(options.subtree,true);return [
      {finished:new Promise(resolve=>{endFrame=resolve;})},
      {finished:new Promise(resolve=>{endGlow=resolve;})},
    ];},
  };
  const closing=closeLoadingScreen(root);
  assert.equal(classes.has('is-switching'),true);assert.equal(root.hidden,false);
  endFrame();await Promise.resolve();assert.equal(root.hidden,false);
  endGlow();await closing;
  assert.equal(root.hidden,true);assert.equal(classes.has('is-switching'),false);
});

test('cancelled animations and missing loaders do not block entry',async()=>{
  const root={hidden:false,classList:{add(){},remove(){}},getAnimations:()=>[{finished:Promise.reject(new Error('cancelled'))}]};
  await closeLoadingScreen(root);assert.equal(root.hidden,true);
  await closeLoadingScreen(root);await closeLoadingScreen(null);
});
