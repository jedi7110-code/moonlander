import test from 'node:test';
import assert from 'node:assert/strict';
import {chunkFiles,prefetchSequence} from '../src/obs/prefetch-plan.js';

const manifest={
  'obs/boot.js':{file:'assets/obs-1.js',isEntry:true,imports:['_ui.js'],dynamicImports:['obs/main.js']},
  'obs.html':{file:'assets/obs-0.js',isEntry:true,imports:['_ui.js','_polyfill.js']},
  '_polyfill.js':{file:'assets/polyfill-9.js'},
  'obs/main.js':{file:'assets/main-2.js',isDynamicEntry:true,css:['assets/main-2.css'],imports:['obs.html','_three.js','_ui.js','_view.js']},
  '_three.js':{file:'assets/three-3.js'},
  '_ui.js':{file:'assets/ui-4.js',css:['assets/ui-4.css']},
  '_view.js':{file:'assets/view-5.js',imports:['_three.js','_missing.js']},
};

test('the cabin entry resolves to its chunk, stylesheets and static imports once each, without the boot entry',()=>{
  assert.deepEqual(chunkFiles(manifest,'obs/main.js'),['assets/main-2.js','assets/main-2.css','assets/three-3.js','assets/ui-4.js','assets/ui-4.css','assets/view-5.js']);
  assert.deepEqual(chunkFiles({'src/obs/main.js':{file:'assets/m.js'}},'obs/main.js'),['assets/m.js'],'root-relative keys match by suffix');
  assert.deepEqual(chunkFiles({},'obs/main.js'),[]);
});

test('the sequence fetches one low-priority request at a time and stops after the request in flight',async()=>{
  const calls=[],progress=[];let inFlight=0,maxInFlight=0,stopped=false;
  const request=async(url,init)=>{
    calls.push([url,init.priority,init.cache]);inFlight++;maxInFlight=Math.max(maxInFlight,inFlight);
    await new Promise(resolve=>setTimeout(resolve,1));inFlight--;
    if(url==='b')stopped=true;
    return {ok:url!=='c',arrayBuffer:async()=>new ArrayBuffer(url==='a'?3:1)};
  };
  const summary=await prefetchSequence({urls:['a','b','c','d'],fetch:request,cache:'reload',isStopped:()=>stopped,onProgress:(url,done,total)=>progress.push([url,done,total])});
  assert.deepEqual(calls,[['a','low','reload'],['b','low','reload']]);
  assert.equal(maxInFlight,1);
  assert.deepEqual(progress,[['a',0,4],['b',1,4]]);
  assert.deepEqual(summary,{files:2,total:4,bytes:4,failed:[],stopped:true});
  const failing=await prefetchSequence({urls:['c','x'],fetch:async url=>{if(url==='x')throw new Error('offline');return {ok:false,arrayBuffer:async()=>new ArrayBuffer(0)};}});
  assert.deepEqual(failing,{files:2,total:2,bytes:0,failed:['c','x'],stopped:false});
});
