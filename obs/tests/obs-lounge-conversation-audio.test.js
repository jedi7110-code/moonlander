import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {loungeVoiceSequence,LoungeConversationAudio} from '../src/obs/lounge-conversation-audio.js';
import {CABIN_SOUNDS,LOUNGE_VOICE_IDS} from '../src/obs/sound-library.js';

function harness(){
  const calls=[],loads=[],audio={enabled:true,playable:true,
    loadDeferred(id){loads.push(id);return Promise.resolve(true);},
    play(id,options){if(!this.playable)return null;const voice={id,stopping:false};calls.push({voice,id,...options});return voice;},
    stopVoice(voice){voice.stopping=true;},positionVoice(){}};
  const brain={state:'goingTo',leisure:'conversation',performT:32,loungeCompanion:{age:0,seatX:7.25,peer:{active:true,step:{kind:'relax'},position:{x:6.05,y:3.392}}}};
  const driver=new LoungeConversationAudio(audio,{random:()=>.25});
  const tick=(age,dt=1/60)=>{brain.loungeCompanion.age=age;brain.performT=32-age;driver.update(dt,brain);};
  return{audio,brain,driver,calls,loads,tick};
}

test('random combinations fit long and short seated visits, leave pauses and never repeat adjacent clips',()=>{
  const firsts=new Set();
  for(const duration of [8,32,90])for(let seed=1;seed<=100;seed++){
    let state=seed;const random=()=>((state=(Math.imul(state,1664525)+1013904223)>>>0)/4294967296);
    const clips=loungeVoiceSequence(duration,random,'loungeVoice1');firsts.add(clips[0].id);
    assert.notEqual(clips[0].id,'loungeVoice1');
    for(let i=0;i<clips.length;i++){
      const clip=clips[i];assert.ok(clip.start>=.65&&clip.end<=duration-.25);
      assert.ok(clip.end>clip.start&&clip.end-clip.start<=CABIN_SOUNDS[clip.id].duration+1e-8);
      if(i){assert.notEqual(clip.id,clips[i-1].id);assert.ok(clip.start-clips[i-1].end>=.30-1e-8);}
    }
  }
  // Also sample the full range of initial draws, rather than only nearby LCG seeds.
  for(const draw of [0,.2,.4,.6,.8,.99])firsts.add(loungeVoiceSequence(32,()=>draw)[0].id);
  assert.equal(firsts.size,6);
});

test('the voice files load once on the approach, but sound waits until both crew members are seated',()=>{
  const h=harness();h.driver.update(1/60,{});assert.equal(h.loads.length,0);
  for(let i=0;i<20;i++)h.tick(0);assert.deepEqual(h.loads,LOUNGE_VOICE_IDS);assert.equal(h.calls.length,0);
  h.brain.state='enteringLounge';h.tick(1);assert.equal(h.calls.length,0);
  h.brain.state='performing';h.tick(.5);assert.equal(h.calls.length,0);
  h.tick(.7);assert.equal(h.calls.length,1);assert.ok(Math.abs(h.calls[0].offset-.05)<1e-8);
  assert.deepEqual(h.calls[0].position,{x:6.65,y:4.692,z:.06});
  for(let i=0;i<20;i++)h.tick(.7);assert.equal(h.calls.length,1,'rendered/repeated snapshots never emit duplicates');
});

test('mute, pause and late decoding join only the current clip offset without a backlog',()=>{
  const h=harness();h.brain.state='performing';h.audio.playable=false;h.tick(.7);assert.equal(h.calls.length,0);
  h.audio.playable=true;h.tick(3);assert.equal(h.calls.length,1);assert.ok(Math.abs(h.calls[0].offset-2.35)<1e-8);
  const first=h.driver.voice;h.audio.stopVoice(first);h.audio.playable=false;h.tick(4);assert.equal(h.calls.length,1);
  h.audio.playable=true;h.tick(5);assert.equal(h.calls.length,2);assert.ok(Math.abs(h.calls[1].offset-4.35)<1e-8);
  const snapshot=h.calls.length;h.driver.update(0,h.brain);assert.equal(h.calls.length,snapshot);
  h.audio.stopVoice(h.driver.voice);h.tick(5);assert.equal(h.calls.at(-1).offset,4.35,'unpause resumes from the paused source position');
});

test('only one clip plays at a time, tail gain fades, and either participant leaving stops playback',()=>{
  for(const interrupt of ['milo','curtis']){
    const h=harness();h.brain.state='performing';h.tick(.7);const first=h.driver.voice,clip=h.driver.clip;
    h.tick(clip.end-.15);assert.ok(h.driver.voice.volume<=CABIN_SOUNDS[clip.id].gain*.51);
    h.tick(clip.end+.01);assert.equal(first.stopping,true);assert.equal(h.driver.voice,null);
    h.tick(h.driver.clips[1].start+.01);assert.equal(h.calls.length,2);
    const second=h.driver.voice;
    if(interrupt==='milo')h.brain.state='leavingLounge';else h.brain.loungeCompanion.peer.step.kind='stand';
    h.tick(h.brain.loungeCompanion.age+.01);assert.equal(second.stopping,true);assert.equal(h.driver.voice,null);
  }
});

test('a naturally ended source cannot replay the same clip when the simulation falls behind real audio',()=>{
  const h=harness();h.brain.state='performing';h.tick(.7);h.driver.voice.ended=true;h.tick(4);
  assert.equal(h.calls.length,1);assert.equal(h.driver.voice,null);
  h.tick(h.driver.clips[1].start+.01);assert.equal(h.calls.length,2);
});

test('all six runtime recordings are small MP3s, retain their exact source clocks and stay out of startup',async()=>{
  let total=0;
  for(const [index,id]of LOUNGE_VOICE_IDS.entries()){
    const definition=CABIN_SOUNDS[id],data=await readFile(new URL('../public/assets/obs/audio/'+definition.file,import.meta.url));total+=data.length;
    assert.ok(definition.file.endsWith('.mp3'));assert.equal(data.toString('ascii',0,3),'ID3');
    assert.equal(definition.duration,[10,8.4,5,5,5,5][index]);assert.ok(data.length<definition.duration*8500);
    assert.equal(definition.gain,.40);assert.notEqual(definition.loop,true);
  }
  assert.ok(total<350_000,'all six clips together stay under 350 KB');
  const main=await readFile(new URL('../src/obs/main.js',import.meta.url),'utf8');assert.match(main,/defer:\['coffeeMachine',\.\.\.LOUNGE_VOICE_IDS\]/);
});
