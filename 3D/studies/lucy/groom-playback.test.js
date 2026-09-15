import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {performance} from 'node:perf_hooks';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {createLucy,animateLucy} from '../../src/obs/lucy.js';
import {createGroomSurface} from './groom-surface.js';
import {prepareGroomPlayback} from './groom-playback.js';
import {addLucyWhiskerPads} from './whisker-pads.js';
const asset=process.env.LUCY_GROOM_STUDY_ASSET;

test('cached grooming preserves the approved surface and updates live poses without the iterative solver',{
  skip:!asset,
},async()=>{
  const b=fs.readFileSync(asset),g=await new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');
  const root=createLucy(g,{random:()=>.5});addLucyWhiskerPads(root);
  const surface=createGroomSurface(root),original=surface.source.geometry.attributes.position.array.slice();
  const playback=await prepareGroomPlayback(root,surface),duration=playback.cache.duration;
  const pose=t=>animateLucy(root,{dt:1/60,time:t+2*duration,actionTime:t+2*duration,mode:'groom',remaining:100,yaw:0});
  let maxPositionError=0,maxNormalError=0;
  const slow=[],fast=[];
  for(const t of [0,.51,1.615,2.213,3.717,4.607,5.817,7.013,8.411,9.397]){
    pose(t);let start=performance.now();surface.update();slow.push(performance.now()-start);
    const p=surface.display.geometry.attributes.position.array.slice(),n=surface.display.geometry.attributes.normal.array.slice();
    start=performance.now();playback.update(true,t);fast.push(performance.now()-start);
    const actual=surface.display.geometry.attributes;
    for(let i=0;i<original.length;i+=3){
      const distance=Math.hypot(...[0,1,2].map(k=>actual.position.array[i+k]-p[i+k]));
      maxPositionError=Math.max(maxPositionError,distance);
      maxNormalError=Math.max(maxNormalError,Math.hypot(...[0,1,2].map(k=>actual.normal.array[i+k]-n[i+k])));
      if(!surface.correctionMask[i/3])assert(distance<1e-6,'face, feet and tail remain in the current live pose');
      assert(Math.abs(Math.hypot(...actual.normal.array.slice(i,i+3))-1)<1e-5);
    }
  }
  console.log({maxPositionError,maxNormalError});
  assert(maxPositionError<.0006,'interpolation retains the approved breast/axilla volume');
  assert(maxNormalError<.10,'interpolated shading follows the original surface');
  const solver=surface.update;surface.update=()=>{throw new Error('expensive solver called during playback');};
  for(let frame=0;frame<120;frame++){pose(frame/60);const start=performance.now();playback.update(true,frame/60);fast.push(performance.now()-start);}
  pose(3.7);playback.update(true,3.7);const saved=surface.display.geometry.attributes.position.array.slice();
  pose(8.4);playback.update(true,8.4);pose(3.7);playback.update(true,3.7);
  // Tail settling is live/stateful; the cached correction itself has no seek history.
  for(const i of playback.cache.indices)for(let k=0;k<3;k++)assert(Math.abs(surface.display.geometry.attributes.position.array[i*3+k]-saved[i*3+k])<1e-6);
  assert.equal(playback.cache.frames.at(-1),playback.cache.frames[0],'loop correction is continuous');
  playback.update(false,0);assert(surface.source.visible);assert(!surface.display.visible);
  assert.deepEqual(surface.source.geometry.attributes.position.array,original);
  const median=values=>values.sort((a,b)=>a-b)[Math.floor(values.length/2)];
  const slowMs=median(slow),fastMs=median(fast);console.log({solverMedianMs:slowMs,playbackMedianMs:fastMs});
  assert(fastMs<slowMs*.4,'playback must avoid the previous frame-time bottleneck');
  surface.update=solver;surface.dispose();
});
