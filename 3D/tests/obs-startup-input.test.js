import test from 'node:test';
import assert from 'node:assert/strict';
import {bindStartupLightingInput} from '../src/obs/startup-input.js';
import {CabinStartupLighting} from '../src/obs/startup-lighting.js';

function setup(){
  const canvas=new EventTarget(),effect=new CabinStartupLighting([],{waitForActivation:true});let activations=0;
  canvas.getBoundingClientRect=()=>({left:0,right:400,top:0,bottom:300});
  const unbind=bindStartupLightingInput(canvas,()=>{if(effect.activate())activations++;});
  const send=(type,props={})=>canvas.dispatchEvent(Object.assign(new Event(type),{pointerId:1,button:0,isPrimary:true,clientX:100,clientY:100,...props}));
  const close=()=>{unbind();effect.dispose();};
  return{canvas,effect,send,unbind,close,activations:()=>activations};
}

test('canvas click/tap and keyboard Enter activate once without consuming existing controls',()=>{
  for(const pointerType of ['mouse','touch','pen']){
    const s=setup();let normalActions=0;s.canvas.addEventListener('pointerup',()=>normalActions++);
    s.send('pointerdown',{pointerType});s.effect.update(600);assert.equal(s.effect.time,0);
    s.send('pointerup',{pointerType,clientX:102});assert.equal(s.effect.waiting,false);assert.equal(s.activations(),1);assert.equal(normalActions,1);
    s.effect.update(.5);const time=s.effect.time;
    s.send('pointerdown');s.send('pointerup');assert.equal(s.activations(),1);assert.equal(s.effect.time,time);
    s.close();
  }
  const s=setup();s.send('keydown',{key:'Enter'});assert.equal(s.activations(),1);s.close();
});

test('camera looking, wheel, drag, cancelled gestures, multi-touch and nonprimary buttons never power up',()=>{
  const gestures=[
    [['pointermove',{clientX:200}],['wheel',{deltaY:-100}],['click']],
    [['pointerdown'],['pointermove',{clientX:120}],['pointermove',{clientX:100}],['pointerup']],
    [['pointerdown'],['pointerup',{clientY:140}]],
    [['pointerdown'],['pointerup',{clientX:-1}]],
    [['pointerdown'],['pointercancel'],['pointerup']],
    [['pointerdown'],['lostpointercapture'],['pointerup']],
    [['pointerdown'],['pointerdown',{pointerId:2,isPrimary:false}],['pointerup',{pointerId:2,isPrimary:false}],['pointerup']],
    [['pointerdown',{button:2}],['pointerup',{button:2}]],
    [['pointerdown',{isPrimary:false}],['pointerup',{isPrimary:false}]],
    [['keydown',{key:'Enter',repeat:true}],['keydown',{key:'Enter',ctrlKey:true}],['keydown',{key:' '}]],
  ];
  for(const gesture of gestures){
    const s=setup();for(const [type,props]of gesture)s.send(type,props);
    s.effect.update(60);assert.equal(s.effect.waiting,true,JSON.stringify(gesture));assert.equal(s.activations(),0);
    s.send('pointerdown');s.send('pointerup');assert.equal(s.activations(),1,'a fresh tap works after a rejected gesture');s.close();
  }
});

test('listeners are released on teardown',()=>{
  const s=setup();s.send('pointerdown');s.unbind();s.send('pointerup');s.send('pointerdown');s.send('pointerup');s.send('keydown',{key:'Enter'});
  assert.equal(s.activations(),0);s.close();
});
