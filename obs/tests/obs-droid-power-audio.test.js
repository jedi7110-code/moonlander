import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,stat} from 'node:fs/promises';
import {CabinSoundEvents} from '../src/obs/sound-events.js';
import {DroidRoutine,DROID_HOME} from '../src/obs/droid-routine.js';
import {DROID_STARTUP_SECONDS} from '../src/obs/droid-startup.js';
import {CABIN_SOUNDS,DROID_POWER_SOUND_IDS} from '../src/obs/sound-library.js';

function fixture(){
  const calls=[],loads=[],voices=[],audio={enabled:true,ready:true,
    play(id,options){if(!this.enabled||!this.ready)return null;const voice={id,stopping:false};calls.push({id,...options});voices.push(voice);return voice;},
    stopVoice(voice){voice.stopping=true;},loadDeferred(id){loads.push(id);}};
  const driver=new CabinSoundEvents(audio),droid=new DroidRoutine({care:{lastDelivery:null}});
  droid.restUntil=Infinity;
  return {audio,calls,loads,voices,driver,droid,tick(dt=1/60){driver.droidPower(dt,droid);}};
}

test('real robot wake and sleep each start one natural-speed cue at 30, 60 and 120 fps',()=>{
  for(const fps of [30,60,120]){
    const f=fixture();f.droid.job='audio-test';f.droid.add('hold',.2);
    f.droid.add('wake',DROID_STARTUP_SECONDS);f.droid.add('hold',.2);f.droid.add('sleep',2);f.droid.add('hold',1.2);
    f.tick(1/fps);
    for(let i=0;i<fps*8;i++){f.droid.update(1/fps);f.tick(1/fps);}
    assert.deepEqual(f.calls.map(call=>call.id),DROID_POWER_SOUND_IDS);
    assert.deepEqual(f.loads,DROID_POWER_SOUND_IDS);
    assert.deepEqual(f.calls[0].position,{x:DROID_HOME.x,y:DROID_HOME.y+.65,z:DROID_HOME.z});
    assert.ok(f.calls.every(call=>call.rate===undefined&&call.loop===undefined));
    assert.equal(f.voices.at(-1).stopping,false,'natural decay is not cut when a sleep pose settles');
  }
});

test('initial snapshots, mute, missing buffers, seeks and repeated frames do not replay power cues',()=>{
  for(const kind of ['wake','sleep']){
    const mid=fixture();mid.droid.job='test';mid.droid.add(kind,3.2);mid.droid.age=1;mid.tick();mid.droid.age+=1/60;mid.tick();assert.equal(mid.calls.length,0);
    for(const blocked of ['enabled','ready']){
      const f=fixture();f.tick();f.audio[blocked]=false;f.droid.job='test';f.droid.add(kind,3.2);f.tick();
      f.audio[blocked]=true;f.droid.age=.02;f.tick();assert.equal(f.calls.length,0,'missed starts are consumed');
    }
    const f=fixture();f.tick();f.droid.job='test';f.droid.add(kind,3.2);f.tick();assert.equal(f.calls.length,1);
    for(let i=0;i<20;i++)f.tick();assert.equal(f.calls.length,1);
    f.audio.stopVoice(f.voices[0]);f.droid.age=.01;f.tick();assert.equal(f.calls.length,1,'pause/resume does not restart');
    f.droid.age=2;f.tick();f.droid.age=0;f.tick();assert.equal(f.calls.length,1,'seeking backwards does not retrigger');
  }
});

test('waiting holds an armed cue, cancellation and robot removal stop it, new phases may play',()=>{
  const f=fixture();f.tick();f.droid.job='test';f.droid.add('wake',3.2);f.droid.waiting=true;
  f.tick();f.tick();assert.equal(f.calls.length,0);
  f.droid.waiting=false;f.droid.age=.01;f.tick();assert.equal(f.calls.length,1);
  f.droid.steps=[];f.tick();assert.equal(f.voices[0].stopping,true);
  f.droid.add('sleep',2);f.droid.age=0;f.tick();assert.equal(f.calls.length,2);
  f.driver.droidPower(1/60,null);assert.equal(f.voices[1].stopping,true);
});

test('supplied MP3s are compact and gain-matched, and load only after the cabin starts',async()=>{
  let bytes=0;
  for(const id of DROID_POWER_SOUND_IDS){
    const definition=CABIN_SOUNDS[id],url=new URL('../public/assets/obs/audio/'+definition.file,import.meta.url);
    const data=await readFile(url);bytes+=(await stat(url)).size;
    assert.equal(data.toString('ascii',0,3),'ID3');assert.equal(definition.duration,3);
    assert.equal(definition.gain,.24);assert.equal(definition.loop,undefined);assert.equal(definition.rate,undefined);
    assert.equal(definition.license,'ユーザー提供素材');
  }
  assert.ok(bytes<55000,`${bytes} bytes`);
  const main=await readFile(new URL('../src/obs/main.js',import.meta.url),'utf8');
  assert.match(main,/defer:\['coffeeMachine',\.\.\.LOUNGE_VOICE_IDS,\.\.\.DROID_POWER_SOUND_IDS,\.\.\.DROID_HUM_SOUND_IDS\]/);
  const credits=await readFile(new URL('../public/assets/obs/audio/CREDITS.md',import.meta.url),'utf8');
  assert.match(credits,/droid-startup\.mp3/);assert.match(credits,/droid-sleep\.mp3/);
});
