import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {CabinSoundEvents} from '../src/obs/sound-events.js';
import {CURTIS_COFFEE} from '../src/obs/curtis-coffee.js';
import {CABIN_SOUNDS} from '../src/obs/sound-library.js';

function coffeeAudio(){
  const calls=[],voices=[],audio={enabled:true,
    play(id,options){if(!this.enabled)return null;const voice={stopping:false};calls.push({id,...options});voices.push(voice);return voice;},
    stopVoice(voice){voice.stopping=true;}};
  const driver=new CabinSoundEvents(audio),visitor={active:true,age:0,step:{kind:'coffee'}};
  return{audio,calls,voices,driver,visitor,tick(age,seconds=1/60){visitor.age=age;driver.curtisCoffee(seconds,visitor);}};
}

test('A starts once at button contact and stops twenty seconds later at every normal frame rate',()=>{
  for(const fps of [30,60,120]){
    const state=coffeeAudio();
    for(let frame=0;frame<=Math.ceil(CURTIS_COFFEE.duration*fps);frame++)state.tick(frame/fps,1/fps);
    assert.equal(state.calls.length,1);assert.equal(state.calls[0].id,'coffeeMachine');
    assert.ok(state.calls[0].offset>=0&&state.calls[0].offset<1/fps+1e-8);
    assert.deepEqual(state.calls[0].position,{x:10.135,y:4.6,z:-.9});assert.equal(state.voices[0].stopping,true);
    assert.equal(CABIN_SOUNDS.coffeeMachine.gain,.18);
  }
});
test('the machine stops when extraction finishes and stays silent through drinking and returning the cup',()=>{
  const state=coffeeAudio();state.tick(CURTIS_COFFEE.button);state.tick(CURTIS_COFFEE.pourEnd-1/60);
  const count=state.calls.length,voice=state.voices.at(-1);assert.equal(voice.stopping,false);
  state.tick(CURTIS_COFFEE.pourEnd);assert.equal(voice.stopping,true);
  for(let age=CURTIS_COFFEE.drinkStart;age<=CURTIS_COFFEE.duration;age+=1/60)state.tick(age);
  assert.equal(state.calls.length,count);
});
test('pause, mute, seeks and cancellation resume only the current source position and never replay a finished operation',()=>{
  const state=coffeeAudio();state.tick(5);assert.ok(Math.abs(state.calls[0].offset-1.4)<1e-8);
  state.audio.stopVoice(state.voices[0]);state.audio.enabled=false;state.tick(6);assert.equal(state.calls.length,1);
  state.audio.enabled=true;state.tick(6+1/60);assert.ok(Math.abs(state.calls.at(-1).offset-(6+1/60-3.6))<1e-8);
  state.tick(15);assert.equal(state.voices[1].stopping,true);assert.equal(state.calls.at(-1).offset,11.4);
  state.tick(8);assert.equal(state.calls.at(-1).offset,4.4);
  state.visitor.active=false;state.tick(8.1);assert.equal(state.voices.at(-1).stopping,true);
  const count=state.calls.length;state.visitor.active=true;state.tick(CURTIS_COFFEE.duration);assert.equal(state.calls.length,count);
});
test('the shipped coffee clip is exactly the selected A prefix, without stretching or a loop seam',async()=>{
  const sample=await readFile(new URL('../studies/audio/coffee-samples/A-nespresso-extraction.wav',import.meta.url));
  const clip=await readFile(new URL('../public/assets/obs/audio/coffee-machine-a-20s.wav',import.meta.url));
  const chunk=sample.indexOf(Buffer.from('data')),source=sample.subarray(chunk+8);
  assert.equal(clip.length,882044);assert.equal(clip.readUInt32LE(40),20*22050*2);
  assert.deepEqual(clip.subarray(44,44+Math.floor(19.92*22050)*2),source.subarray(0,Math.floor(19.92*22050)*2));
  assert.equal(clip.readInt16LE(clip.length-2),0);
});
