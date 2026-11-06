import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,stat} from 'node:fs/promises';
import {DroidWorkAudio,droidIsWorking} from '../src/obs/droid-work-audio.js';
import {CABIN_SOUNDS,DROID_HUM_SOUND_IDS} from '../src/obs/sound-library.js';

function fixture(random=()=>.25){
  const calls=[],loads=[],voices=[];
  const audio={enabled:true,audible:true,
    play(id,options){if(!this.enabled||!this.audible)return null;const voice={id,position:{...options.position}};voices.push(voice);calls.push({id,time:driver.time,options,voice});return voice;},
    loadDeferred(id){loads.push(id);},stopVoice(voice){voice.stopping=true;},positionVoice(){}};
  const driver=new DroidWorkAudio(audio,{random});
  const droid={position:{x:-10,y:0,z:.6},step:{kind:'work',action:'scrub-shower',duration:300},age:0};
  const advance=(seconds,dt=.05)=>{for(let t=0;t<seconds-1e-8;t+=dt){if(droid.step)droid.age+=dt;driver.update(dt,droid);}};
  return {audio,driver,droid,calls,loads,voices,advance};
}

test('random finite melodies have long quiet gaps, no overlap or adjacent repeats',()=>{
  const firsts=new Set();
  for(const draw of [0,.5,.99]){
    const f=fixture(()=>draw);f.advance(3.1);firsts.add(f.calls[0].id);
    assert.ok(f.calls[0].time>=1&&f.calls[0].time<=3.1);
  }
  assert.deepEqual(firsts,new Set(DROID_HUM_SOUND_IDS));
  let seed=17;const f=fixture(()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296));
  f.advance(280);
  assert.ok(f.calls.length>=5&&f.calls.length<=12);
  assert.deepEqual(f.loads,DROID_HUM_SOUND_IDS);
  for(let i=1;i<f.calls.length;i++){
    const prior=f.calls[i-1],current=f.calls[i],gap=current.time-prior.time-CABIN_SOUNDS[prior.id].duration;
    assert.notEqual(current.id,prior.id);assert.ok(gap>=18-.001&&gap<=40.1,`${gap}s gap`);
  }
  assert.ok(f.calls.every(call=>call.options.loop===undefined&&call.options.rate===undefined));
  assert.deepEqual(f.calls[0].options.position,{x:-10,y:1.45,z:.6});
});

test('only real unblocked work hums; travel, charging, wake, sleep and mechanical doors are silent',()=>{
  const f=fixture();f.advance(2);const voice=f.voices[0];assert.ok(voice);
  for(const kind of ['walk','turn','climb','hold','wake','sleep',null]){
    const droid={...f.droid,step:kind?{kind,action:'cook-stir'}:null};assert.equal(droidIsWorking(droid),false);
  }
  for(const action of ['scrub-toilet','scrub-shower','cook-chop','cook-stir','cook-serve','laundry-fold','wash','harvest','food-pour'])
    assert.equal(droidIsWorking({...f.droid,step:{kind:'work',action}}),true);
  for(const action of ['door-open','door-close','washer-open','washer-close','washer-start','waste-open','waste-close'])
    assert.equal(droidIsWorking({...f.droid,step:{kind:'work',action}}),false);
  f.droid.step={kind:'walk',duration:20};f.droid.age=0;f.advance(5);
  assert.equal(voice.stopping,true);assert.equal(f.calls.length,1);
  f.droid.step={kind:'work',action:'cook-stir',duration:100};f.droid.waiting=true;f.droid.age=0;f.advance(40);
  assert.equal(f.calls.length,1);
  f.driver.update(.05,null);assert.equal(f.driver.voice,null);
});

test('melodies fit the remaining task and short work never chops up a song',()=>{
  const f=fixture(()=>.99);f.droid.step.duration=9;f.advance(3.1);
  assert.equal(f.calls.length,1);assert.equal(f.calls[0].id,'droidHum3','the five-second melody fits when eight-second clips do not');
  const short=fixture();short.droid.step.duration=4;short.advance(4);assert.equal(short.calls.length,0);
});

test('pause, mute, unloaded audio and seeks cannot emit a backlog or resume an interrupted melody',()=>{
  const f=fixture();f.advance(2);const count=f.calls.length,voice=f.voices[0],time=f.driver.time;
  f.audio.stopVoice(voice);for(let i=0;i<10;i++)f.driver.update(0,f.droid);
  assert.equal(f.driver.time,time);f.advance(.1);assert.equal(f.calls.length,count);
  f.audio.enabled=false;f.advance(70);assert.equal(f.calls.length,count);
  f.audio.enabled=true;f.advance(.1);assert.equal(f.calls.length,count);
  f.droid.age=0;f.driver.update(.05,f.droid);assert.equal(f.driver.voice,null);f.advance(1);assert.equal(f.calls.length,count);
  const locked=fixture();locked.audio.audible=false;locked.advance(5);assert.equal(locked.calls.length,0);
  locked.audio.audible=true;locked.advance(.1);assert.equal(locked.calls.length,0);
  const absent=fixture();absent.driver.update(.05,undefined);absent.driver.update(.05,undefined);assert.equal(absent.calls.length,0);
});

test('work songs are three small, quiet MP3s and are deferred outside initial loading',async()=>{
  let bytes=0;
  for(const id of DROID_HUM_SOUND_IDS){
    const definition=CABIN_SOUNDS[id],file=new URL('../public/assets/obs/audio/'+definition.file,import.meta.url);
    const data=await readFile(file);bytes+=(await stat(file)).size;
    assert.equal(data.toString('ascii',0,3),'ID3');assert.ok(definition.gain<CABIN_SOUNDS.droidStartup.gain);
    assert.ok([5,8].includes(definition.duration));assert.equal(definition.loop,undefined);
    assert.equal(definition.license,'ユーザー提供素材');
  }
  assert.ok(bytes<175000);
  const main=await readFile(new URL('../src/obs/main.js',import.meta.url),'utf8');
  assert.match(main,/defer:\['coffeeMachine',\.\.\.LOUNGE_VOICE_IDS,\.\.\.DROID_POWER_SOUND_IDS,\.\.\.DROID_HUM_SOUND_IDS\]/);
});
