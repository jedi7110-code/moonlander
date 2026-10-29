import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Scene,Group,Mesh,BoxGeometry,MeshStandardMaterial,DataTexture,PerspectiveCamera} from 'three';
import {visibleInScene,runDeferredPreparation} from '../src/obs/deferred-preparation.js';
import {runPreparationSteps,createPreparationScheduler} from '../src/obs/background-preparation.js';
import {ObservationView} from '../src/obs/view.js';

test('deferred jobs yield after the first frame, wait for a usable view, and keep authored order',async()=>{
  let frames=0;
  const work=[];
  const done=await runDeferredPreparation([
    async nextFrame=>{work.push(['rig',frames]);await nextFrame();work.push(['rig-ready',frames]);},
    ()=>work.push(['programs',frames]),
  ],{nextFrame:async()=>{frames++;},canPrepare:()=>frames>=3});
  assert.equal(done,true);
  assert.deepEqual(work,[['rig',3],['rig-ready',4],['programs',5]]);
});

test('startup can use an eight-millisecond, one-frame budget without changing the two-frame film scheduler',async()=>{
  for(const [budgetMs,frameCount] of [[8,1],[4,2]]){
    let time=0,frames=0;
    const nextFrame=createPreparationScheduler({budgetMs,frameCount,now:()=>time,requestFrame:callback=>{frames++;callback();}});
    time=budgetMs-1;await nextFrame();assert.equal(frames,0);
    time=budgetMs;await nextFrame();assert.equal(frames,frameCount);
    time+=budgetMs-1;await nextFrame();assert.equal(frames,frameCount);
    time++;await nextFrame();assert.equal(frames,frameCount*2);
  }
});

test('closing a view cancels pending work and closes a partially built generator',async()=>{
  let cancelled=false,released=false,later=false;
  function* steps(){try{yield;yield;}finally{released=true;}}
  const done=await runDeferredPreparation([
    nextFrame=>runPreparationSteps(steps(),{nextFrame}),
    ()=>{later=true;},
  ],{cancelled:()=>cancelled,nextFrame:async()=>{if(released===false&&cancelled===false)cancelled=true;}});
  assert.equal(done,false);assert.equal(later,false);
  cancelled=false;
  const running=await runDeferredPreparation([
    nextFrame=>runPreparationSteps(steps(),{nextFrame:async()=>{cancelled=true;await nextFrame();}}),
  ],{cancelled:()=>cancelled,nextFrame:async()=>{}});
  assert.equal(running,false);assert.equal(released,true);
});

test('optional errors remain observable rather than reporting successful preparation',async()=>{
  await assert.rejects(runDeferredPreparation([()=>{throw Error('failed');}],{nextFrame:async()=>{}}),/failed/);
});

function compilationView(){
  const scene=new Scene(),geometry=new BoxGeometry(),visibleMap=new DataTexture(),hiddenMap=new DataTexture();
  const visible=new Mesh(geometry,new MeshStandardMaterial({map:visibleMap}));
  const hidden=new Mesh(geometry,new MeshStandardMaterial({map:hiddenMap})),parent=new Group();parent.visible=false;parent.add(hidden);
  scene.add(visible,parent);
  const compiled=[],uploads=[],target={live:true};let current=target;
  const renderer={getRenderTarget:()=>current,setRenderTarget:value=>{current=value;},
    compileAsync:async object=>{compiled.push(object);},initTexture:texture=>uploads.push(texture)};
  const view={scene,renderer,camera:new PerspectiveCamera(),shadowDepthProbes:()=>[],
    primeClipping:(count,temporary)=>{renderer.setRenderTarget(temporary);}};
  return{view,visible,hidden,parent,compiled,uploads,target,dispose(){geometry.dispose();visible.material.dispose();hidden.material.dispose();visibleMap.dispose();hiddenMap.dispose();}};
}

test('startup skips invisible ancestors; post-start preparation uploads the remainder without reuploading live textures',async()=>{
  const state=compilationView();
  try{
    assert.equal(visibleInScene(state.visible),true);assert.equal(visibleInScene(state.hidden),false);
    const nextFrame=async()=>assert.equal(state.view.renderer.getRenderTarget(),state.target,'live target is restored before yielding');
    await ObservationView.prototype.compilePrograms.call(state.view,{visibleOnly:true,nextFrame});
    assert.deepEqual(state.compiled,[state.visible]);assert.equal(state.uploads.length,1);
    state.compiled.length=0;
    await ObservationView.prototype.compilePrograms.call(state.view,{nextFrame});
    assert.deepEqual(state.compiled,[state.hidden]);assert.equal(state.uploads.length,2);
    assert.equal(state.view.renderer.getRenderTarget(),state.target);
  }finally{state.dispose();}
});

test('compilation failures restore the live render target',async()=>{
  const state=compilationView();
  try{
    state.view.renderer.compileAsync=()=>{throw Error('GPU unavailable');};
    await assert.rejects(ObservationView.prototype.compilePrograms.call(state.view,{visibleOnly:true}),/GPU unavailable/);
    assert.equal(state.view.renderer.getRenderTarget(),state.target);
  }finally{state.dispose();}
});

test('OBS starts optional preparation after its loop is live and gates the opening chase on its rig',async()=>{
  const main=await readFile(new URL('../src/obs/main.js',import.meta.url),'utf8');
  assert.ok(main.indexOf('runDeferredPreparation([',main.indexOf('async function start()'))>main.indexOf('view.renderer.setAnimationLoop(tick)'));
  assert.match(main,/deferOptional:true/);
  assert.match(main,/view\.catRun&&openingMousePending/);
  assert.match(main,/compilePrograms\(\{visibleOnly:true,nextFrame:nextStartupFrame,onProgress:[^}]*\}\)/);
  assert.doesNotMatch(main,/await view\.warmDraws\(/);
});
