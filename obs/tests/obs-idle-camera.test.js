import test from 'node:test';
import assert from 'node:assert/strict';
import {IdleCamera,IDLE_CAMERA_WAIT_MS,IDLE_CAMERA_FOLLOW_MS} from '../src/obs/idle-camera.js';

function setup(random=()=>0){
  let now=0;
  const modes=[],view={mode:'all',zoom:1,setMode(mode){this.mode=mode;this.zoom=1;modes.push(mode);camera.modeChanged();}};
  const camera=new IdleCamera(view,{now:()=>now,random});
  const advance=(ms,options)=>{now+=ms;camera.update(now,options);};
  return{camera,view,modes,advance};
}

test('two minutes idle selects either subject and two minutes following returns to wide',()=>{
  assert.equal(IDLE_CAMERA_WAIT_MS,120000);assert.equal(IDLE_CAMERA_FOLLOW_MS,120000);
  for(const [random,subject]of [[.1,'milo'],[.9,'cat']]){
    const {camera,view,modes,advance}=setup(()=>random);
    advance(119999);assert.equal(view.mode,'all');
    advance(1);assert.equal(view.mode,subject);assert.equal(camera.automaticMode,subject);
    advance(119999);assert.equal(view.mode,subject);
    advance(1);assert.equal(view.mode,'all');assert.equal(camera.automaticMode,null);
    advance(119999);assert.equal(view.mode,'all');
    advance(1);assert.deepEqual(modes,[subject,'all',subject]);
  }
});

test('new activity postpones idle zoom, interrupts automatic follow, and starts a fresh wait',()=>{
  const {camera,view,advance}=setup();
  advance(119999);camera.activity();advance(119999);assert.equal(view.mode,'all');
  advance(1);assert.equal(view.mode,'milo');
  advance(1000);camera.activity();assert.equal(view.mode,'all');
  advance(119999);assert.equal(view.mode,'all');
  advance(1);assert.equal(view.mode,'milo');
});

test('manual follow, pan and wide-mode zoom remain under user control',()=>{
  const {camera,view,advance}=setup();
  for(const mode of ['milo','cat','manual']){
    view.setMode(mode);advance(600000);camera.activity();assert.equal(view.mode,mode);
  }
  view.setMode('all');view.zoom=1.3;advance(600000);assert.equal(view.mode,'all');assert.equal(view.zoom,1.3);
  view.setMode('all');advance(119999);assert.equal(view.mode,'all');advance(1);assert.equal(view.mode,'milo');
  // Explicitly selecting the same subject takes ownership from auto-follow.
  view.setMode('milo');advance(600000);camera.activity();assert.equal(view.mode,'milo');
});

test('paused, hidden, game or text-entry states cancel auto-follow and require fresh idle time',()=>{
  const {camera,view,advance}=setup();
  advance(120000,{blocked:true});assert.equal(view.mode,'all');
  advance(119999);assert.equal(view.mode,'all');advance(1);assert.equal(view.mode,'milo');
  advance(100,{blocked:true});assert.equal(view.mode,'all');assert.equal(camera.automaticMode,null);
  advance(600000,{blocked:true});advance(119999);assert.equal(view.mode,'all');advance(1);assert.equal(view.mode,'milo');
  view.setMode('cat');advance(600000,{blocked:true});assert.equal(view.mode,'cat');
});

test('long frame gaps use wall time but do not skip the wide interval or run multiple switches',()=>{
  const {view,modes,advance}=setup();
  advance(600000);assert.equal(view.mode,'milo');assert.deepEqual(modes,['milo']);
  advance(600000);assert.equal(view.mode,'all');assert.deepEqual(modes,['milo','all']);
  advance(119999);assert.equal(view.mode,'all');
});

function inputTarget(){
  const target=new EventTarget();target.defaultView=new EventTarget();
  const send=(type,props={})=>target.dispatchEvent(Object.assign(new Event(type),props));
  return{target,send};
}

test('page-wide mouse, touch, scroll and keyboard activity interrupt auto-follow and listeners clean up',()=>{
  const {camera,view,advance}=setup(),{target,send}=inputTarget(),unbind=camera.bindActivity(target);
  for(const type of ['pointermove','pointerdown','wheel','keydown','focusin','visibilitychange']){
    advance(120000);assert.equal(view.mode,'milo');
    send(type,{pointerId:1});assert.equal(view.mode,'all');
    if(type==='pointerdown')send('pointerup',{pointerId:1});
  }
  advance(120000);target.defaultView.dispatchEvent(new Event('blur'));assert.equal(view.mode,'all');
  unbind();advance(120000);send('pointermove');target.defaultView.dispatchEvent(new Event('blur'));assert.equal(view.mode,'milo');
});

test('a held pointer prevents zoom until release and cancellation clears the hold',()=>{
  const {camera,view,advance}=setup(),{target,send}=inputTarget(),unbind=camera.bindActivity(target);
  send('pointerdown',{pointerId:1});advance(600000);assert.equal(view.mode,'all');
  send('pointerup',{pointerId:1});advance(119999);assert.equal(view.mode,'all');advance(1);assert.equal(view.mode,'milo');
  send('pointerdown',{pointerId:1});send('pointerdown',{pointerId:2});send('pointerup',{pointerId:1});
  advance(600000);assert.equal(view.mode,'all');send('pointercancel',{pointerId:2});
  advance(120000);assert.equal(view.mode,'milo');unbind();
});
