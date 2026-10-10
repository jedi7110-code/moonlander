import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {CabinAudio} from '../src/obs/audio.js';
import {CabinSoundEvents} from '../src/obs/sound-events.js';
import {CABIN_SOUNDS} from '../src/obs/sound-library.js';
import {BathroomVisit} from '../src/obs/bathroom.js';
import {BunkVisit,BUNK_PHASE_SECONDS} from '../src/obs/bunk-visit.js';
import {CatMotion,CatRoutine,CrewMotion,Supplies} from '../src/obs/state.js';
import {CAT_PORT,CAT_BOWL,FLOORS,PLANT,LADDER_X,WASTE_INCINERATOR,getStation} from '../src/obs/layout.js';
import {KIBBLE_STREAM,KIBBLE_CONTACT_DELAY} from '../src/obs/kibble-timing.js';
import {planDroidTurn} from '../src/obs/droid-turn.js';
import {DroidRoutine,DROID_PACE} from '../src/obs/droid-routine.js';
import {DROID_GAIT,DROID_WALK_CYCLE_DISTANCE,LADDER_PACE} from '../src/obs/pace.js';
import {sampleDroidServicePose} from '../src/obs/droid-service.js';
import {CabinEnvironment} from '../src/obs/environment.js';
import {diningPhase,mealSpoonPhase} from '../src/obs/dining-timing.js';
import {GroomingVisit,GROOMING_VISIT_SECONDS} from '../src/obs/grooming-visit.js';

function context(){
  const parameter=()=>({value:0,setValueAtTime(v){this.value=v;},setTargetAtTime(v){this.value=v;},exponentialRampToValueAtTime(v){this.value=v;},cancelScheduledValues(){}});
  const ctx={state:'suspended',currentTime:0,sampleRate:22050,created:[],destination:{},async resume(){this.state='running';},async close(){this.state='closed';},async decodeAudioData(){return{duration:1};},createBuffer:(_channels,length)=>({getChannelData:()=>new Float32Array(length)})};
  const node=()=>({gain:parameter(),pan:parameter(),frequency:parameter(),playbackRate:parameter(),connect(to){return to;},disconnect(){this.disconnected=true;},start(){this.started=true;},stop(){this.stopped=true;}});
  for(const method of ['createGain','createOscillator','createBufferSource','createBiquadFilter','createStereoPanner'])ctx[method]=()=>{const n=node();ctx.created.push(n);return n;};
  return ctx;
}
const response=()=>({ok:true,arrayBuffer:async()=>new ArrayBuffer(8)});
const soundCount=Object.keys(CABIN_SOUNDS).length;
test('warning follows the current hatch fault through repair, mute, pause, late loading and recovery',async()=>{
  const ctx=context(),audio=new CabinAudio({createContext:()=>ctx,fetchAudio:async()=>response(),ambience:false});
  const h=harness();h.driver=new CabinSoundEvents(audio);
  const environment=new CabinEnvironment();h.state.brain.environment=environment;
  const tick=()=>h.driver.update(1/60,h.state),key='hatch-alarm';
  try{
    await audio.toggle();await audio.load();tick();assert.equal(audio.loops.has(key),false);
    const buffer=audio.buffers.get('hatchAlarm');buffer.duration=CABIN_SOUNDS.hatchAlarm.duration;audio.buffers.delete('hatchAlarm');
    environment.triggerFault();tick();assert.equal(audio.loops.has(key),false,'late loading queues no sources');
    audio.buffers.set('hatchAlarm',buffer);tick();const voice=audio.loops.get(key);assert.ok(voice);
    assert.equal(audio.loopTime(key),0);
    ctx.currentTime=12.3;assert.ok(Math.abs(audio.loopTime(key)-.3)<1e-9,'the audio clock stays on the same phase after repeated cycles');
    assert.equal(voice.source.loop,true);assert.equal(voice.source.playbackRate.value,1);assert.equal(voice.position,null,'alarm is heard throughout the cabin');
    const nodes=ctx.created.length;
    for(const stage of ['inspect','repair','verify']){environment.setStage(environment.fault.serial,stage);for(let i=0;i<120;i++)tick();}
    assert.equal(audio.loops.get(key),voice);assert.equal(ctx.created.length,nodes,'one source for the entire fault');
    audio.pause(true);tick();assert.equal(audio.loops.has(key),false);assert.equal(voice.stopping,true);
    assert.equal(audio.loopTime(key),null,'paused audio supplies no stale timing');
    voice.source.onended();audio.pause(false);tick();const resumed=audio.loops.get(key);assert.ok(resumed);
    assert.equal(audio.loopTime(key),0,'resuming creates a fresh shared phase');
    await audio.toggle();tick();assert.equal(audio.loops.has(key),false);assert.equal(resumed.stopping,true);resumed.source.onended();
    await audio.toggle();tick();assert.ok(audio.loops.has(key));
    assert.equal(environment.resolve(environment.fault.serial+1),false);tick();assert.ok(audio.loops.has(key),'an unverified recovery cannot silence the alarm');
    const final=audio.loops.get(key);environment.resolve(environment.fault.serial);tick();assert.equal(audio.loops.has(key),false);assert.equal(final.stopping,true);
    assert.equal(audio.loopTime(key),null,'recovery detaches the stopped alarm clock');
    audio.pause(true);audio.pause(false);tick();assert.equal(audio.loops.has(key),false,'restored faults do not replay');
  }finally{audio.dispose();}
});
test('default-on OBS may preload while locked, then a first gesture resumes and primes once',async()=>{
  const ctx=context();let resumes=0,starts=0;
  ctx.resume=async()=>{resumes++;ctx.state='running';};
  const audio=new CabinAudio({enabled:true,ambience:false,createContext:()=>ctx,fetchAudio:async()=>response(),
    playbackSession:{start(){starts++;},pause(){},dispose(){}}});
  audio.prepare();await audio.load();
  assert.equal(audio.enabled,true);assert.equal(audio.audible,false);assert.equal(audio.master.gain.value,0);
  assert.equal(resumes,0);assert.equal(starts,0);assert.equal(audio.play('powerOn'),null);
  audio.pause(true);audio.pause(false);assert.equal(resumes,0,'returning before a first gesture cannot auto-play');
  const before=ctx.created.length;audio.unlock();
  assert.equal(resumes,1);assert.equal(audio.audible,true);assert.equal(audio.master.gain.value,.55);
  assert.equal(ctx.created.length,before+1,'one silent prime only');
  audio.unlock();audio.unlock();assert.equal(ctx.created.length,before+1);assert.equal(resumes,1);
  assert.ok(audio.play('powerOn'));audio.dispose();
});
test('a pending iPhone resume cannot hang the toggle, mute, loading or next-gesture retry',async()=>{
  const ctx=context();let resumes=0;
  ctx.resume=()=>{resumes++;return new Promise(()=>{});};
  const audio=new CabinAudio({createContext:()=>ctx,fetchAudio:async()=>response(),ambience:false});
  assert.equal(await audio.toggle(),true);await audio.load();
  assert.equal(audio.stats.loaded,soundCount);assert.equal(resumes,1);assert.equal(audio.audible,false);
  assert.equal(await audio.toggle(),false);audio.unlock();assert.equal(resumes,1,'muted gestures never enable sound');
  assert.equal(await audio.toggle(),true);assert.equal(resumes,2);
  ctx.resume=async()=>{resumes++;ctx.state='running';};audio.unlock();assert.equal(audio.audible,true);
  assert.equal(resumes,3);audio.dispose();
});
test('interrupted audio resumes on foreground or next touch but never replays old one-shots',async()=>{
  const ctx=context();let resumes=0,paused=0;
  ctx.resume=async()=>{resumes++;ctx.state='running';};
  const audio=new CabinAudio({createContext:()=>ctx,fetchAudio:async()=>response(),ambience:false,
    playbackSession:{start(){},pause(){paused++;},dispose(){}}});
  await audio.toggle();await audio.load();ctx.state='interrupted';
  assert.equal(audio.play('bedPiston'),null);
  audio.pause(true);assert.equal(paused,1);audio.pause(false);
  assert.equal(resumes,2);assert.equal(audio.audible,true);assert.equal(audio.voices.size,0);
  ctx.state='interrupted';audio.unlock();assert.equal(resumes,3);
  await audio.toggle();audio.pause(true);audio.pause(false);audio.unlock();
  assert.equal(resumes,3);assert.equal(audio.enabled,false);assert.equal(audio.master.gain.value,0);audio.dispose();
});
test('a rejected resume is handled and can retry without changing the enabled preference',async()=>{
  const ctx=context(),errors=[];ctx.resume=()=>Promise.reject(new Error('NotAllowedError'));
  const audio=new CabinAudio({createContext:()=>ctx,fetchAudio:async()=>response(),ambience:false});
  audio.onError=error=>errors.push(error.message);await audio.toggle();await Promise.resolve();
  assert.deepEqual(errors,['NotAllowedError']);assert.equal(audio.enabled,true);
  ctx.resume=async()=>{ctx.state='running';};audio.unlock();assert.equal(audio.audible,true);audio.dispose();
});
test('local assets are compact mono PCM, finite, non-silent, bounded and loop seams are smooth',async()=>{
  let total=0;
  const credits=await readFile(new URL('../public/assets/obs/audio/CREDITS.md',import.meta.url),'utf8');
  for(const definition of Object.values(CABIN_SOUNDS)){
    const url=new URL('../public/assets/obs/audio/'+definition.file,import.meta.url),file=await readFile(url);total+=(await stat(url)).size;
    assert.equal(file.toString('ascii',0,4),'RIFF');assert.equal(file.readUInt16LE(22),1);assert.equal(file.readUInt32LE(24),22050);
    assert.equal(file.readUInt16LE(34),16);assert.equal(file.length-44,file.readUInt32LE(40));assert.ok(credits.includes(definition.file));
    const data=Array.from({length:(file.length-44)/2},(_,i)=>file.readInt16LE(44+i*2)/32768);
    const peak=Math.max(...data.map(Math.abs));assert.ok(peak>.3&&peak<.36);
    if(definition.loop)assert.ok(Math.abs(data[0]-data.at(-1))<.15,`${definition.file} seam`);
  }
  assert.ok(total<1800000,`ships ${total} bytes, including the compact cutlery and two 88 KB grooming loops, not entire source packs`);
});
test('bed piston and slide are short faded recordings, without live loops or filters',async()=>{
  const ctx=context(),audio=new CabinAudio({createContext:()=>ctx,fetchAudio:async()=>response(),ambience:false});
  try{
    await audio.toggle();await audio.load();let total=0;
    for(const [id,duration,gain]of [['bedPiston',.52,.18],['bedSlide',1.4,.30]]){
      const definition=CABIN_SOUNDS[id],file=await readFile(new URL('../public/assets/obs/audio/'+definition.file,import.meta.url));total+=file.length;
      const data=Array.from({length:(file.length-44)/2},(_,i)=>file.readInt16LE(44+i*2)/32768);
      assert.equal(data.length/22050,duration);assert.equal(definition.duration,duration);
      assert.equal(definition.gain,gain);assert.equal(definition.loop,undefined);
      assert.equal(data[0],0);assert.equal(data.at(-1),0);
      const rms=(start,end)=>{const s=data.slice(Math.round(start*22050),Math.round(end*22050));return Math.sqrt(s.reduce((sum,v)=>sum+v*v,0)/s.length);};
      const body=rms(duration*.25,duration*.7);
      assert.ok(body>.02,'a sliding texture, not a click');
      assert.ok(rms(0,.01)<body*.2,'gentle attack without the source clack');
      assert.ok(rms(duration-.015,duration)<body*.1,'settles quietly at the end');
      const nodes=ctx.created.length,voice=audio.play(id);
      assert.ok(voice);assert.equal(voice.source.loop,false);assert.equal(ctx.created.length-nodes,3);
      voice.source.onended();
    }
    assert.ok(total<85000,'native-speed lid plus the unchanged tray stay below 85 KB');
    const close=audio.play('bedPiston');
    assert.equal(close.source.playbackRate.value,1,'direct preview uses the original speed');
  }finally{audio.dispose();}
});
test('lock and appliance lid use separate, quiet single-contact edits without the delayed second click',async()=>{
  const clips=[];
  for(const [id,duration,gain]of [['latch',.16,.20],['applianceLid',.22,.24]]){
    const definition=CABIN_SOUNDS[id],file=await readFile(new URL('../public/assets/obs/audio/'+definition.file,import.meta.url));
    clips.push(file);
    assert.equal((file.length-44)/2/22050,duration);
    assert.equal(definition.gain,gain);assert.equal(definition.rate,undefined);assert.equal(definition.loop,undefined);
    assert.equal(file.readInt16LE(44),0);assert.equal(file.readInt16LE(file.length-2),0);
    const data=Array.from({length:(file.length-44)/2},(_,i)=>file.readInt16LE(44+i*2)/32768);
    const energy=data=>data.reduce((sum,s)=>sum+s*s,0)/data.length;
    assert.ok(energy(data.slice(-Math.round(.02*22050)))<energy(data.slice(0,Math.round(.12*22050)))*.2,'the contact settles rather than rebounding');
  }
  assert.notDeepEqual(clips[0],clips[1]);
  assert.ok(clips[0].length+clips[1].length<20000,'two shorter contacts cost less than the old shared sample');
});
test('bed lid uses the selected gas strut at original speed without stretching or padding',async()=>{
  const file=await readFile(new URL('../public/assets/obs/audio/bed-piston.wav',import.meta.url));
  const data=Array.from({length:(file.length-44)/2},(_,i)=>file.readInt16LE(44+i*2)/32768);
  // Two cascaded low-passes estimate bass energy without a test dependency.
  const alpha=1-Math.exp(-2*Math.PI*600/22050);let low1=0,low2=0,bass=0,total=0;
  for(const value of data){low1+=alpha*(value-low1);low2+=alpha*(low1-low2);bass+=low2*low2;total+=value*value;}
  assert.ok(bass/total<.04,'no dominant sub-600 Hz piston rumble');
  assert.ok(CABIN_SOUNDS.bedPiston.gain<=.18,'lid stays below half the old playback gain');
  const source=await readFile(new URL('../studies/audio/pack-bed-piston.mjs',import.meta.url),'utf8');
  const lidFilter=source.match(/const filter=lid\?`([^`]+)`/)?.[1];
  assert.ok(lidFilter);assert.match(lidFilter,/highpass=f=180,lowpass=f=6500/);
  assert.doesNotMatch(lidFilter,/atempo|asetrate|apad|aloop/);
  assert.match(source,/cutStart=lid\?1\.74:start,cutDuration=lid\?\.52:sourceDuration/);
  assert.match(source,/c8959326b07b18ccbb1d5d3d859afe0a53ae8a6c5990c485842efd925e1bcf59/);
  assert.equal(CABIN_SOUNDS.bedPiston.license,'Pixabay Content License');
  const credits=await readFile(new URL('../public/assets/obs/audio/CREDITS.md',import.meta.url),'utf8');
  assert.match(credits,/Gavin Mogensen \/ Fronbondi_Skegs/);
  assert.match(credits,/not CC0/);
});
test('bed lid omits the former voice-like onset and eases into the sliding sound',async()=>{
  const file=await readFile(new URL('../public/assets/obs/audio/bed-piston.wav',import.meta.url));
  const data=Array.from({length:(file.length-44)/2},(_,i)=>file.readInt16LE(44+i*2)/32768);
  const rms=(start,end)=>{const s=data.slice(Math.round(start*22050),Math.round(end*22050));return Math.sqrt(s.reduce((sum,v)=>sum+v*v,0)/s.length);};
  // This guards the soft attack, not perceptual speech detection.
  assert.ok(rms(0,.015)<rms(.1,.35)*.25,'onset remains quiet relative to the sliding body');
  const source=await readFile(new URL('../studies/audio/pack-bed-piston.mjs',import.meta.url),'utf8');
  assert.match(source,/\['bed-piston',\.52,\.045,\.065\]/);
});
test('bed lid is one native-length stroke and leaves the tray recording unchanged',async()=>{
  const file=await readFile(new URL('../public/assets/obs/audio/bed-piston.wav',import.meta.url));
  const data=Array.from({length:(file.length-44)/2},(_,i)=>file.readInt16LE(44+i*2)/32768);
  assert.equal(data.length/22050,.52,'no 2.4-second stretched or tiled replacement');
  assert.equal(file.length,22976);
  const levels=[];
  for(let start=.1;start<.4;start+=.05){
    const samples=data.slice(Math.round(start*22050),Math.round((start+.05)*22050));
    levels.push(Math.sqrt(samples.reduce((sum,v)=>sum+v*v,0)/samples.length));
  }
  assert.ok(Math.max(...levels)/Math.min(...levels)<2,'steady middle without repeated bursts or gaps');
  const tray=await readFile(new URL('../public/assets/obs/audio/bed-slide.wav',import.meta.url));
  assert.equal(createHash('sha256').update(tray).digest('hex'),'11a30896cc8694902e18a05d704239393464f98d7d76739ccbd775968d53d29f','tray sound unchanged');
});
test('explicit activation loads each local clip once with bounded concurrency, mute never fetches',async()=>{
  let calls=0,inFlight=0,max=0;const ctx=context();
  const audio=new CabinAudio({createContext:()=>ctx,fetchAudio:async(url)=>{assert.match(url,/^\/3D\/assets\/obs\/audio\/[\w-]+\.wav$/);calls++;max=Math.max(max,++inFlight);await new Promise(resolve=>setImmediate(resolve));inFlight--;return response();}});
  audio.play('doorOpen');assert.equal(calls,0);
  audio.pause(true);await audio.toggle();assert.equal(audio.master.gain.value,0,'pause before context creation survives activation');
  await audio.load();assert.equal(calls,soundCount);assert.ok(max<=3);assert.equal(audio.stats.loaded,soundCount);
  await audio.toggle();await audio.toggle();await audio.load();assert.equal(calls,soundCount);
  audio.dispose();
});
test('ambient updates follow camera focus but never synthesize pitched water drops, including after unmute',async()=>{
  const ctx=context(),audio=new CabinAudio({createContext:()=>ctx,fetchAudio:async()=>response()});
  await audio.toggle();await audio.load();const initialNodes=ctx.created.length;
  const plantFan={x:(PLANT.x-700)*.022+2.03,y:(870-FLOORS[PLANT.floor].y)*.016+2.18,z:-.65};
  for(const focus of [0,.5,1]){
    audio.setListener({...plantFan,overview:true,focus});
    for(let frame=0;frame<3600;frame++){ctx.currentTime+=1/60;audio.update();}
    assert.equal(audio.fanGain.gain.value,.012+.028*(.18*(1-focus)+.55*focus));
    assert.equal(audio.ambientGain.gain.value,.4+.25*focus);
    assert.equal(ctx.created.length,initialNodes,'no per-drop oscillators, gains or buffers');
  }
  const near=audio.fanGain.gain.value;
  audio.setListener({x:plantFan.x+20});assert.ok(audio.fanGain.gain.value<near,'camera leaving the rack reduces its fan, regardless of Milo');
  await audio.toggle();ctx.currentTime+=300;audio.update();
  await audio.toggle();audio.update();assert.equal(ctx.created.length,initialNodes);
  assert.equal(audio.stats.active,0);
  audio.tone(740,.07,.009);assert.ok(ctx.created.length>initialNodes,'notification tones are retained');
  audio.dispose();
});
test('hatches contain only one short air burst, with no trailing motor',async()=>{
  const clips=[];
  for(const id of ['doorOpen','doorClose']){
    const definition=CABIN_SOUNDS[id];assert.match(definition.file,/-air-motor\.wav$/);
    const file=await readFile(new URL('../public/assets/obs/audio/'+definition.file,import.meta.url));clips.push(file);
    const samples=Array.from({length:(file.length-44)/2},(_,i)=>file.readInt16LE(44+i*2)/32768);
    const duration=samples.length/22050;assert.equal(duration,.38);
    assert.equal(definition.loop,undefined);assert.equal(definition.rate,undefined);
    assert.match(definition.description,/バシュッだけ/);
    assert.equal(samples[0],0);assert.equal(samples.at(-1),0);
    const energy=(start,end)=>{let sum=0,delta=0,count=0;for(let i=Math.round(start*22050)+1;i<end*22050;i++){sum+=samples[i]**2;delta+=(samples[i]-samples[i-1])**2;count++;}return{rms:Math.sqrt(sum/count),brightness:Math.sqrt(delta/sum)};};
    const air=energy(.02,.10),tail=energy(.32,.38);
    assert.ok(air.rms>.03,'air release is present immediately, not a delayed hiss');
    assert.ok(tail.rms<air.rms*.12,'burst decays promptly instead of carrying a motor tail');
  }
  assert.deepEqual(clips[0],clips[1],'both actions use the requested air burst without different motors');
  assert.equal(CABIN_SOUNDS.doorOpen.gain,.65);assert.equal(CABIN_SOUNDS.doorClose.gain,.58);
  const packer=await readFile(new URL('../studies/audio/pack-cabin-audio.mjs',import.meta.url),'utf8');
  assert.doesNotMatch(packer,/spaceEngineLow|motorOffset|layer\(motor/,'regeneration cannot restore the removed motor');
});

test('power-on uses a short labelled glitch edit with two faded starter fragments and a quiet tail',async()=>{
  const definition=CABIN_SOUNDS.powerOn;
  assert.equal(definition.file,'power-on-glitch.wav');assert.ok(definition.gain<=.24);
  assert.match(definition.license,/ユーザー提供/);assert.doesNotMatch(definition.license,/CC0/);
  const file=await readFile(new URL('../public/assets/obs/audio/'+definition.file,import.meta.url));
  assert.ok(file.length<50000,'only the tiny edit ships, not the 12 second source');
  const data=Array.from({length:(file.length-44)/2},(_,i)=>file.readInt16LE(44+i*2)/32768);
  assert.ok(Math.abs(data.length/22050-1.05)<.001);
  assert.equal(data[0],0);assert.equal(data.at(-1),0);
  const rms=(start,end)=>{const s=data.slice(Math.round(start*22050),Math.round(end*22050));return Math.sqrt(s.reduce((sum,v)=>sum+v*v,0)/s.length);};
  assert.ok(rms(.015,.09)>.01,'first electrical starter');
  assert.ok(rms(.265,.32)>.01,'second starter follows the second lamp flash');
  assert.equal(rms(.13,.24),0);assert.equal(rms(.39,.44),0,'no pitched ping between fragments');
  assert.ok(rms(.55,.75)>.001,'subdued source texture while the lights settle');
  assert.ok(rms(.98,1.05)<rms(.55,.75)*.2,'the final fragment fades away');
  const ctx=context(),audio=new CabinAudio({createContext:()=>ctx,fetchAudio:async()=>response(),ambience:false});
  try{
    await audio.toggle();await audio.load();const before=ctx.created.length;
    const voice=audio.play('powerOn');assert.ok(voice);assert.equal(voice.source.loop,false);
    assert.equal(ctx.created.length-before,3,'one buffer voice, gain and panner; no live filters or oscillators');
  }finally{audio.dispose();}
});
test('boot steps preserve separate recorded contacts and a natural metal-floor tail',async()=>{
  const clips=[];
  for(const id of ['step1','step2','step3']){
    const definition=CABIN_SOUNDS[id];assert.match(definition.file,/^step-metal-boots-[123]\.wav$/);
    const file=await readFile(new URL('../public/assets/obs/audio/'+definition.file,import.meta.url));clips.push(file);
    const samples=Array.from({length:(file.length-44)/2},(_,i)=>file.readInt16LE(44+i*2)/32768);
    assert.ok(samples.length/22050>.45,'keep the recorded decay instead of an 80 ms click');
    assert.ok(samples.length/22050<.6,'do not include the next footfall');
    assert.equal(samples[0],0);assert.equal(samples.at(-1),0);
    const energy=(start,end)=>{const segment=samples.slice(Math.floor(start*22050),Math.floor(end*22050));return Math.sqrt(segment.reduce((sum,x)=>sum+x*x,0)/segment.length);};
    assert.ok(energy(0,.18)>energy(.30,.45)*3,'contact should settle naturally');
    assert.ok(energy(.15,.30)>.001,'metal-floor decay is retained');
  }
  for(let i=0;i<clips.length;i++)for(let j=i+1;j<clips.length;j++)assert.notDeepEqual(clips[i],clips[j]);
});
test('rubber sole clips are three distinct short, faded contacts separate from human boots',async()=>{
  const clips=[];
  for(const id of ['rubberStep1','rubberStep2','rubberStep3']){
    const definition=CABIN_SOUNDS[id];assert.match(definition.file,/^step-rubber-[123]\.wav$/);
    assert.ok(definition.gain<=.30);
    const file=await readFile(new URL('../public/assets/obs/audio/'+definition.file,import.meta.url));clips.push(file);
    const duration=(file.length-44)/2/22050;assert.ok(duration>.3&&duration<.5);
    assert.equal(file.readInt16LE(44),0);assert.equal(file.readInt16LE(file.length-2),0);
  }
  for(let i=0;i<clips.length;i++)for(let j=i+1;j<clips.length;j++)assert.notDeepEqual(clips[i],clips[j]);
});
test('Milo ladder clips retain three real boot contacts with softer highs and decay shorter than the next rung',async()=>{
  const clips=[],ctx=context(),audio=new CabinAudio({createContext:()=>ctx,fetchAudio:async()=>response(),ambience:false});
  await audio.toggle();await audio.load();
  for(let n=1;n<=3;n++){
    const id=`ladderStep${n}`,definition=CABIN_SOUNDS[id];assert.equal(definition.file,`step-ladder-boots-${n}.wav`);
    assert.ok(definition.gain<=.13);assert.equal(definition.rate,.88);
    const file=await readFile(new URL('../public/assets/obs/audio/'+definition.file,import.meta.url));clips.push(file);
    const samples=Array.from({length:(file.length-44)/2},(_,i)=>file.readInt16LE(44+i*2)/32768);
    assert.equal(samples.length/22050,.30);assert.ok(samples.length/22050/definition.rate<.28/(38*LADDER_PACE*.016));
    assert.equal(samples[0],0);assert.equal(samples.at(-1),0);
    const source=await readFile(new URL(`../public/assets/obs/audio/step-metal-boots-${n}.wav`,import.meta.url));
    const original=samples.map((_,i)=>source.readInt16LE(44+i*2)/32768);
    const brightness=data=>{let energy=0,delta=0;for(let i=1;i<data.length;i++){energy+=data[i]**2;delta+=(data[i]-data[i-1])**2;}return Math.sqrt(delta/energy);};
    assert.ok(brightness(samples)<brightness(original)*.99,'remove the sharp treble, not just lower its volume');
    assert.ok(samples.slice(3308,5513).some(v=>Math.abs(v)>.003),'retain a short real decay rather than a dry click');
    const voice=audio.play(id);assert.equal(voice.source.playbackRate.value,.88);voice.source.onended();
  }
  for(let i=0;i<clips.length;i++)for(let j=i+1;j<clips.length;j++)assert.notDeepEqual(clips[i],clips[j]);
  audio.dispose();
});
test('boot playback is quieter and lower pitched in both direct previews and walking, without retuning other sounds',async()=>{
  const ctx=context(),audio=new CabinAudio({createContext:()=>ctx,fetchAudio:async()=>response(),ambience:false});
  await audio.toggle();await audio.load();
  for(const [id,gain]of [['step1',.20],['step2',.185],['step3',.20]]){
    const preview=audio.play(id),walking=audio.play(id,{rate:1});
    assert.equal(preview.volume,gain);assert.equal(walking.volume,gain);
    assert.equal(preview.source.playbackRate.value,.84);assert.equal(walking.source.playbackRate.value,.84);
    preview.source.onended();walking.source.onended();
  }
  for(const [id,gain]of [['rubberStep1',.30],['rubberStep2',.28],['rubberStep3',.30],['metal',.20]]){
    const voice=audio.play(id);assert.equal(voice.volume,gain);assert.equal(voice.source.playbackRate.value,1);
    voice.source.onended();
  }
  audio.dispose();
});
test('joint motor is a quiet faded 200 ms one-shot instead of an engine loop',async()=>{
  const definition=CABIN_SOUNDS.servo;
  assert.equal(definition.loop,undefined);assert.ok(definition.gain<=.06);
  assert.equal(definition.file,'servo-stroke.wav');
  const file=await readFile(new URL('../public/assets/obs/audio/'+definition.file,import.meta.url));
  assert.equal((file.length-44)/2/22050,.20);
  assert.equal(file.readInt16LE(44),0);assert.equal(file.readInt16LE(file.length-2),0);
});
test('late loading does not replay one-shots; a failed file cannot break other sounds',async()=>{
  const ctx=context();let release;const wait=new Promise(resolve=>release=resolve);
  const audio=new CabinAudio({createContext:()=>ctx,fetchAudio:async(url)=>{await wait;return url.endsWith('latch.wav')?{ok:false,status:404}:response();}});
  await audio.toggle();assert.equal(audio.play('doorOpen'),null);release();await audio.load();
  assert.equal(audio.stats.active,0);assert.equal(audio.stats.failed,1);assert.equal(audio.stats.loaded,soundCount-1);
  assert.ok(audio.play('doorOpen'));audio.dispose();
});
test('loops reuse sources and stop on pause/mute; one-shots and live voices have hard limits',async()=>{
  const ctx=context(),audio=new CabinAudio({createContext:()=>ctx,fetchAudio:async()=>response()});await audio.toggle();await audio.load();
  for(let i=0;i<100;i++)audio.setLoop('wash','washer',true,{position:{x:0,y:3,z:0}});
  assert.equal(audio.stats.active,1);assert.equal(audio.stats.loops,1);
  for(let i=0;i<30;i++)audio.play(Object.keys(CABIN_SOUNDS)[i%soundCount]);assert.ok(audio.stats.active<=12);
  audio.pause(true);assert.equal(audio.stats.loops,0);assert.equal(audio.play('latch'),null);
  for(const voice of [...audio.voices]){assert.ok(voice.stopping);voice.source.onended();}
  assert.equal(audio.stats.active,0);audio.pause(false);assert.ok(audio.play('latch'));audio.dispose();
});
test('listener attenuates distant rooms and pans correctly without expensive spatial nodes',()=>{
  const audio=new CabinAudio();audio.setListener({x:0,y:0,z:0,rightX:1,rightY:0,rightZ:0,overview:false});
  assert.ok(audio.spatial({x:2,y:0,z:0}).pan>0);assert.ok(audio.spatial({x:-2,y:0,z:0}).pan<0);
  assert.ok(audio.spatial({x:0,y:3.5,z:0}).gain<.15);assert.ok(audio.spatial({x:20,y:0,z:0}).gain<.1);
  audio.setListener({rightX:-1});assert.ok(audio.spatial({x:2,y:0,z:0}).pan<0);
});
function cameraView(fitHeight=15){
  return{camera:{matrixWorld:{elements:[1,0,0,0,0,1,0,0,0,0,1,0,4,9,40,1]}},view:{center:{x:0,y:3.4,z:0},viewHeight:fitHeight,fitHeight,targetHeight:2,mode:'all'}};
}
test('wide views are quiet; manual and follow zoom lift nearby sounds smoothly and suppress distant decks',()=>{
  for(const fitHeight of [15,60])for(const mode of ['all','manual','milo','cat','droid']){
    const audio=new CabinAudio(),{camera,view}=cameraView(fitHeight);view.mode=mode;
    const near={x:0,y:3.4,z:1},far={x:20,y:3.4,z:1},otherDeck={x:0,y:6.9,z:1};
    audio.setViewListener(camera,view);
    assert.equal(audio.focus,0,'use rendered framing, never targetHeight or a mode name');
    assert.equal(audio.spatial(near).gain,.18);assert.equal(audio.spatial(far).gain,.18);
    let previousNear=.18,previousFar=.18;
    for(let i=1;i<=120;i++){
      view.viewHeight=fitHeight/(1+3*i/120);audio.setViewListener(camera,view);
      const nearby=audio.spatial(near).gain,distant=audio.spatial(far).gain;
      assert.ok(nearby>=previousNear&&nearby<=.55);assert.ok(nearby-previousNear<.01,'no jump at a zoom threshold');
      assert.ok(distant<=previousFar);previousNear=nearby;previousFar=distant;
    }
    assert.equal(audio.spatial(near).gain,.55);assert.ok(audio.spatial(otherDeck).gain<.08);
    assert.deepEqual([audio.listener.x,audio.listener.y,audio.listener.z],[0,3.4,1],'zoom listener stays inside the cabin, not 40 m behind the camera');
    view.viewHeight=fitHeight*1.25;audio.setViewListener(camera,view);assert.equal(audio.spatial(near).gain,.18,'zooming out restores the quiet wide mix');
  }
});
test('first-person and XR use the real camera position and orientation, independent of overview zoom',()=>{
  const audio=new CabinAudio(),{camera,view}=cameraView();
  camera.matrixWorld.elements[0]=-1;camera.matrixWorld.elements[12]=2;camera.matrixWorld.elements[13]=4;camera.matrixWorld.elements[14]=.8;
  audio.setViewListener(camera,view,true);
  assert.equal(audio.focus,1);assert.equal(audio.listener.overview,false);
  assert.deepEqual([audio.listener.x,audio.listener.y,audio.listener.z],[2,4,.8]);
  assert.equal(audio.spatial({x:2,y:4,z:.8}).gain,.55);assert.ok(audio.spatial({x:4,y:4,z:.8}).pan<0);
});
test('camera focus changes active loop and one-shot gains without restarting or allocating audio nodes',async()=>{
  const ctx=context(),audio=new CabinAudio({createContext:()=>ctx,fetchAudio:async()=>response()}),{camera,view}=cameraView();
  await audio.toggle();await audio.load();audio.setViewListener(camera,view);
  audio.setLoop('wash','washer',true,{position:{x:0,y:3.4,z:1}});
  const loop=audio.loops.get('wash'),step=audio.play('rubberStep1',{position:{x:0,y:3.4,z:1}}),initialNodes=ctx.created.length;
  assert.equal(loop.gain.gain.value,loop.volume*.18);assert.equal(step.gain.gain.value,step.volume*.18);
  view.viewHeight=view.fitHeight/4;audio.setViewListener(camera,view);
  assert.equal(loop.gain.gain.value,loop.volume*.55);assert.equal(step.gain.gain.value,step.volume*.55);
  assert.equal(audio.loops.get('wash'),loop);assert.equal(ctx.created.length,initialNodes);
  view.center.x=20;audio.setViewListener(camera,view);
  assert.ok(loop.gain.gain.value<loop.volume*.05);assert.equal(ctx.created.length,initialNodes);
  audio.pause(true);audio.setViewListener(camera,view);assert.equal(audio.master.gain.value,0);assert.equal(audio.loops.size,0);
  audio.dispose();
});
function harness(options){
  const events=[],loops=new Map(),audio={enabled:true,play(id,options){if(this.enabled)events.push({id,...options});},setLoop(key,id,active,options){loops.set(key,{id,active,...options});},tone(){}};
  const state={actor:{x:700,y:650,floor:1,walkDistance:0,queue:[],busy:false},brain:{},care:{phase:'idle'},airlock:{opening:0}};
  return{audio,events,loops,state,driver:new CabinSoundEvents(audio,options)};
}
function bedHarness(){
  const h=harness(),play=h.audio.play;h.stops=[];
  h.audio.play=function(id,options){play.call(this,id,options);return this.enabled?{id}:null;};
  h.audio.stopVoice=voice=>h.stops.push(voice);
  return h;
}
function mealHarness(duration=10){
  const h=harness(),station=getStation('galley');
  Object.assign(h.state.actor,{x:station.x,y:FLOORS[station.floor].y,floor:station.floor});
  Object.assign(h.state.brain,{state:'performing',cur:station,curDurSec:duration,performT:duration});
  h.tick=(age,dt=1/60)=>{h.state.brain.performT=duration-age;h.driver.update(dt,h.state);};
  return h;
}
test('real grooming visit runs each motor only in its visible phase at 30, 60 and 120 fps',()=>{
  for(const fps of [30,60,120]){
    const h=harness(),visit=h.state.brain.grooming=new GroomingVisit(1),dt=1/fps;
    const phases=new Set(),changes=[],previous={clipper:false,shaver:false};
    for(let frame=0;frame<=GROOMING_VISIT_SECONDS*fps;frame++){
      if(frame)visit.update(dt);h.driver.update(dt,h.state);
      const clipper=h.loops.get('grooming-clipper'),shaver=h.loops.get('grooming-shaver');
      assert.equal(clipper.active,['cutRight','transfer','cutLeft'].includes(visit.pose.phase));
      assert.equal(shaver.active,visit.pose.phase==='shave');assert.ok(!(clipper.active&&shaver.active));
      if(clipper.active)phases.add(visit.pose.phase);
      for(const [tool,loop]of [['clipper',clipper],['shaver',shaver]]){
        if(previous[tool]!==loop.active)changes.push({tool,active:loop.active,age:visit.age});previous[tool]=loop.active;
        if(loop.active){
          const station=getStation('grooming'),pose=visit.pose;
          assert.equal(loop.id,tool);assert.equal(loop.position.x,(station.x-700)*.022+pose.x);
          assert.equal(loop.position.y,(870-FLOORS[station.floor].y)*.016+pose.floor+1.55);
          assert.equal(loop.position.z,pose.z);
        }
      }
    }
    assert.deepEqual([...phases],['cutRight','transfer','cutLeft'],'motor continues through the hand transfer');
    assert.deepEqual(changes.map(({tool,active})=>[tool,active]),[['clipper',true],['clipper',false],['shaver',true],['shaver',false]]);
    for(const [i,expected]of [11,29,37,47].entries())assert.ok(Math.abs(changes[i].age-expected)<=dt+1e-7,'entry turn and slower tool return are reflected in timing');
    assert.equal(h.events.length,0,'no one-shot buzz per stroke');
  }
});
test('grooming interruption, removal, movement and completion stop both motors',()=>{
  const h=harness(),visit=h.state.brain.grooming=new GroomingVisit(1);
  const tick=()=>{h.driver.update(1/60,h.state);return[h.loops.get('grooming-clipper').active,h.loops.get('grooming-shaver').active];};
  visit.age=13;assert.deepEqual(tick(),[true,false]);
  h.state.actor.busy=true;assert.deepEqual(tick(),[false,false]);h.state.actor.busy=false;
  assert.deepEqual(tick(),[true,false]);
  h.state.actor.climbing=true;assert.deepEqual(tick(),[false,false]);h.state.actor.climbing=false;
  h.state.brain.grooming=null;assert.deepEqual(tick(),[false,false]);
  h.state.brain.grooming=visit;visit.age=39;assert.deepEqual(tick(),[false,true]);
  visit.age=GROOMING_VISIT_SECONDS;assert.deepEqual(tick(),[false,false]);
  h.state.brain.grooming=new GroomingVisit(1);assert.deepEqual(tick(),[false,false],'a new visit cannot inherit the last running motor');
});
test('grooming loops reuse voices and respect pause, mute, loading and cancellation',async()=>{
  const ctx=context(),audio=new CabinAudio({createContext:()=>ctx,fetchAudio:async()=>response(),ambience:false});
  const h=harness(),visit=h.state.brain.grooming=new GroomingVisit(1);h.driver=new CabinSoundEvents(audio);
  const tick=()=>h.driver.update(1/60,h.state);
  try{
    await audio.toggle();await audio.load();visit.age=13;tick();
    const key='grooming-clipper',voice=audio.loops.get(key),nodes=ctx.created.length;assert.ok(voice);
    assert.equal(voice.source.loop,true);assert.equal(voice.source.playbackRate.value,1);
    for(let i=0;i<240;i++){visit.update(1/60);tick();}
    assert.equal(audio.loops.get(key),voice);assert.equal(ctx.created.length,nodes,'one motor source through strokes and transfer');
    audio.pause(true);tick();assert.equal(audio.loops.has(key),false);assert.ok(voice.stopping);voice.source.onended();
    audio.pause(false);tick();const resumed=audio.loops.get(key);assert.ok(resumed);
    await audio.toggle();tick();assert.equal(audio.loops.has(key),false);resumed.source.onended();
    visit.age=31;await audio.toggle();tick();assert.equal(audio.loops.has(key),false,'unmute after tool return cannot restart the clipper');
    const buffer=audio.buffers.get('shaver');audio.buffers.delete('shaver');visit.age=39;tick();
    assert.equal(audio.loops.has('grooming-shaver'),false);audio.buffers.set('shaver',buffer);tick();
    const shaving=audio.loops.get('grooming-shaver');assert.ok(shaving,'late loading can join the currently running motor');
    for(let i=0;i<120;i++)tick();assert.equal(audio.loops.get('grooming-shaver'),shaving);
    h.state.brain.grooming=null;tick();assert.equal(audio.loops.size,0);assert.ok(shaving.stopping);
  }finally{audio.dispose();}
});
test('grooming recordings are distinct two-second native-speed loops with quiet gains',async()=>{
  const hashes=new Set();let total=0;
  for(const id of ['clipper','shaver']){
    const definition=CABIN_SOUNDS[id],file=await readFile(new URL('../public/assets/obs/audio/'+definition.file,import.meta.url));
    total+=file.length;hashes.add(createHash('sha256').update(file).digest('hex'));
    assert.equal((file.length-44)/2/22050,2);assert.equal(definition.loop,true);assert.equal(definition.rate,undefined);
    assert.ok(definition.gain<=.12&&definition.gain>=.10);
    assert.ok(Math.abs(file.readInt16LE(44)-file.readInt16LE(file.length-2))/32768<.1,'no click at the loop join');
  }
  assert.equal(hashes.size,2);assert.equal(total,176488);
});
test('meal contacts follow the visible two-spoonful cycle at every frame rate and duration',()=>{
  for(const fps of [30,60,120])for(const duration of [6,10,20]){
    const h=mealHarness(duration),times=[],dt=1/fps;h.tick(0,dt);
    for(let frame=1;frame<=duration*fps;frame++){
      const age=frame/fps,before=h.events.length;h.tick(age,dt);
      if(h.events.length>before){
        times.push(age);const {phase}=mealSpoonPhase(diningPhase(age,duration).progress);
        const phaseTolerance=2*dt/(duration*.46*.74)+1e-8;
        assert.ok(phase<=phaseTolerance||phase>=1-phaseTolerance,'spoon is at the bowl within one frame, never at the mouth');
      }
      h.tick(age,dt);assert.equal(h.events.length,times.length,'repeated render/state snapshots are silent');
    }
    assert.deepEqual(h.events.map(e=>e.id),['cutlery1','cutlery2','cutlery3']);
    for(const [i,progress]of [.13,.50,.87].entries()){
      const expected=duration*(.27+.46*progress);
      assert.ok(times[i]>=expected-1e-8&&times[i]-expected<=dt+1e-8,'contact matches the animation clock');
    }
    for(const event of h.events){
      assert.ok(Math.abs(event.position.x-((h.state.actor.x-700)*.022+.095))<1e-9);
      assert.ok(Math.abs(event.position.y-((870-h.state.actor.y)*.016+1.243))<1e-9);
      assert.ok(Math.abs(event.position.z-.175)<1e-9,'sound is at the held bowl');
    }
    assert.ok(![...h.loops.values()].some(loop=>loop.id.startsWith('cutlery')),'no repeating dining loop');
  }
});
test('joining, seeking, walking, drinking and interrupted meals never replay contacts',()=>{
  const h=mealHarness(),first=10*(.27+.46*.13),second=10*(.27+.46*.50),last=10*(.27+.46*.87);
  h.tick(second+.01);assert.equal(h.events.length,0,'first snapshot halfway through a meal is silent');
  h.tick(last+.01,.5);assert.equal(h.events.length,0,'a long frame skips old contacts');
  h.tick(0);h.tick(first-.01);h.tick(first+.01,.02);assert.equal(h.events.length,1,'normal motion resumes after seeking');
  h.tick(first+.01,0);assert.equal(h.events.length,1,'pause does not advance contact history');
  h.state.actor.busy=true;h.tick(second-.01);h.tick(second+.01,.02);
  h.state.actor.busy=false;h.tick(second+.02);assert.equal(h.events.length,1,'walking and resuming add no delayed contact');
  h.state.brain.state='idle';h.tick(last-.01);h.state.brain.state='performing';h.tick(last+.01,.02);
  assert.equal(h.events.length,1,'cancelled/restarted meals cannot reuse an old phase');
  h.state.brain.cur=getStation('hydro');h.tick(0);h.tick(first-.01);h.tick(first+.01,.02);
  assert.equal(h.events.length,1,'drinking has no utensil sound');
});
test('muted or not-yet-loaded cutlery contacts are consumed and future contacts still work',async()=>{
  const ctx=context(),audio=new CabinAudio({createContext:()=>ctx,fetchAudio:async()=>response(),ambience:false});
  const h=mealHarness();h.driver=new CabinSoundEvents(audio);
  const cross=(progress)=>{const age=10*(.27+.46*progress);h.tick(age-.01);h.tick(age+.01,.02);};
  try{
    await audio.toggle();await audio.load();h.tick(0);
    const buffer=audio.buffers.get('cutlery1');audio.buffers.delete('cutlery1');cross(.13);
    const before=ctx.created.length;audio.buffers.set('cutlery1',buffer);h.tick(3.5);
    assert.equal(ctx.created.length,before,'late loading cannot replay the scoop');
    await audio.toggle();cross(.50);await audio.toggle();h.tick(5.2);
    assert.equal(ctx.created.length,before,'unmuting cannot replay the return');
    cross(.87);assert.ok(ctx.created.length>before,'the next visible contact is audible');
    assert.equal(audio.voices.size,1);
  }finally{audio.dispose();}
});
test('cutlery ships three distinct compact native-speed one-shots at restrained gains',async()=>{
  const hashes=new Set();let total=0;
  for(let i=1;i<=3;i++){
    const definition=CABIN_SOUNDS[`cutlery${i}`],file=await readFile(new URL('../public/assets/obs/audio/'+definition.file,import.meta.url));
    total+=file.length;hashes.add(createHash('sha256').update(file).digest('hex'));
    assert.equal(definition.loop,undefined);assert.equal(definition.rate,undefined);
    assert.ok(definition.gain>=.10&&definition.gain<=.14);
    const duration=(file.length-44)/2/22050;assert.ok(duration>=.26&&duration<=.37);
    assert.equal(file.readInt16LE(44),0);assert.equal(file.readInt16LE(file.length-2),0);
  }
  assert.equal(hashes.size,3);assert.ok(total<45000);
});
test('lid playback stays at original speed for every phase and custom animation duration',()=>{
  for(const phase of ['opening','closing','waking','sealing']){
    for(const seconds of [1,2.4,2.7,5]){
      const h=bedHarness(),dt=1/60;
      h.driver.update(dt,h.state);
      const visit=h.state.brain.bunkVisit={phase,age:0,seconds:{[phase]:seconds}};
      h.driver.update(dt,h.state);
      assert.equal(h.events.length,1);
      assert.equal(h.events[0].id,'bedPiston');
      assert.equal(h.events[0].rate,1,`${phase} (${seconds}s) must not stretch the recording`);
      for(let frame=0;frame<Math.ceil(seconds/dt);frame++){
        visit.age+=dt;h.driver.update(dt,h.state);
      }
      assert.equal(h.events.length,1,'a long phase never fills time by repeating the stroke');
    }
  }
});
test('real bed entry and exit trigger each piston/slide once at 30, 60 and 120 fps, with sleeping silent',()=>{
  for(const fps of [30,60,120]){
    const h=bedHarness(),dt=1/fps,visit=new BunkVisit(),phases=[];
    h.driver.update(dt,h.state);h.state.brain.bunkVisit=visit;
    let woke=false;
    for(let frame=0;frame<fps*90&&visit.phase!=='done';frame++){
      if(visit.phase==='sleeping'&&!woke){
        const count=h.events.length;
        for(let i=0;i<fps*2;i++){visit.update(dt);h.driver.update(dt,h.state);}
        assert.equal(h.events.length,count,'sleeping does not emit or loop');
        visit.requestExit();woke=true;
      }
      visit.update(dt);const before=h.events.length;h.driver.update(dt,h.state);
      if(h.events.length>before){
        phases.push(visit.phase);
        const event=h.events.at(-1),s=getStation('bunk');
        if(event.id==='bedPiston')assert.equal(event.rate,1,'all lid phases retain natural playback speed');
        else assert.equal(CABIN_SOUNDS[event.id].duration/event.rate,BUNK_PHASE_SECONDS[visit.phase]);
        assert.deepEqual(event.position,{x:(s.x-700)*.022,y:(870-FLOORS[s.floor].y)*.016+.7,z:-.26});
      }
      const count=h.events.length;h.driver.update(0,h.state);h.driver.update(dt,h.state);
      assert.equal(h.events.length,count,'same pose cannot replay a stroke');
    }
    assert.equal(visit.phase,'done');
    assert.deepEqual(phases,['opening','extending','entering','closing','waking','leaving','retracting','sealing']);
    assert.equal(h.stops.length,8,'each finished phase releases its voice');
    assert.equal(h.driver.bedVoice,null);assert.equal(h.events.some(e=>e.id==='latch'||e.id==='servo'),false);
  }
});
test('opening sleep is silent until the lid wakes, and muted or late-loaded bed strokes never replay',()=>{
  const h=bedHarness(),dt=1/60,visit=new BunkVisit({startAsleep:true});h.state.brain.bunkVisit=visit;
  for(let i=0;i<120;i++)h.driver.update(dt,h.state);
  assert.equal(h.events.length,0);visit.requestExit();visit.update(dt);h.driver.update(dt,h.state);
  assert.deepEqual(h.events.map(e=>e.id),['bedPiston']);
  h.audio.enabled=false;
  for(let i=0;i<180;i++){visit.update(dt);h.driver.update(dt,h.state);}
  h.audio.enabled=true;h.driver.update(dt,h.state);
  assert.equal(h.events.length,1,'unmute cannot replay a slide that already started');
  for(let i=0;i<60;i++){visit.update(dt);h.driver.update(dt,h.state);}
  assert.equal(h.events.length,1);
  // A failed/not-yet-decoded play is consumed exactly like a muted stroke.
  const late=bedHarness();late.driver.update(dt,late.state);
  late.state.brain.bunkVisit={phase:'opening',age:0};let calls=0;
  late.audio.play=()=>{calls++;return null;};late.driver.update(dt,late.state);
  for(let i=0;i<90;i++){late.state.brain.bunkVisit.age+=dt;late.driver.update(dt,late.state);}
  assert.equal(calls,1);
});
test('bed sound stops on cancellation, replacement, seek or removal without catching up',()=>{
  for(const change of [
    h=>h.state.brain.bunkVisit=null,
    h=>h.state.brain.bunkVisit={phase:'opening',age:1},
    h=>h.state.brain.bunkVisit.phase='sleeping',
    h=>h.state.brain.bunkVisit.age=0,
  ]){
    const h=bedHarness(),dt=1/60;h.driver.update(dt,h.state);
    h.state.brain.bunkVisit={phase:'opening',age:0};h.driver.update(dt,h.state);
    h.state.brain.bunkVisit.age=.2;h.driver.update(dt,h.state);change(h);h.driver.update(dt,h.state);
    assert.equal(h.events.length,1);assert.equal(h.stops.length,1);assert.equal(h.driver.bedVoice,null);
  }
  const h=bedHarness();h.driver.update(1/60,h.state);
  h.state.brain.bunkVisit={phase:'waking',age:0};h.driver.update(1/60,h.state);
  h.state.brain.bunkVisit={phase:'sealing',age:0};h.driver.update(10,h.state);
  assert.equal(h.events.length,1);assert.equal(h.stops.length,1);
  const cancelled=bedHarness(),visit=new BunkVisit();cancelled.state.brain.bunkVisit=visit;
  cancelled.driver.update(1/60,cancelled.state);visit.requestExit();
  for(let i=0;i<180;i++){visit.update(1/60);cancelled.driver.update(1/60,cancelled.state);}
  assert.equal(cancelled.events.length,0,'cancelling during approach does not move the lid');
});
test('bed preview uses the real BunkVisit timeline and the shared sound driver',async()=>{
  const page=await readFile(new URL('../src/cabin-audio-study.html',import.meta.url),'utf8');
  const source=await readFile(new URL('../src/cabin-audio-study.js',import.meta.url),'utf8');
  assert.match(page,/<option value="bed">/);assert.match(source,/new BunkVisit\(\{startAsleep:true\}\)/);
  assert.match(source,/bunkVisit\.update\(dt\)/);assert.match(source,/r\.driver\.update\(dt,s\)/);
});
function hungryFixture(random=()=>0){
  const h=harness({random});
  h.state.cat={mode:'look',hunger:35,motion:{x:800,y:650,z:-.7,elevation:.45}};
  h.meows=()=>h.events.filter(event=>event.id==='catMeow');
  return h;
}
test('hungry cat cries quietly at sparse randomized intervals from her actual position',()=>{
  const intervals=[0,1,.5,0];let draws=0;
  const h=hungryFixture(()=>intervals[draws++]);
  const before=structuredClone(h.state.cat);
  h.driver.update(.1,h.state);h.driver.update(7.9,h.state);assert.equal(h.meows().length,0);
  h.driver.update(.1,h.state);assert.equal(h.meows().length,1);
  assert.deepEqual(h.meows()[0].position,{x:2.1999999999999997,y:(870-650)*.016+.45+.3,z:-.7});
  h.driver.update(89.9,h.state);assert.equal(h.meows().length,1);
  h.driver.update(.1,h.state);assert.equal(h.meows().length,2);
  h.driver.update(67.4,h.state);assert.equal(h.meows().length,2);
  h.driver.update(.1,h.state);assert.equal(h.meows().length,3);
  assert.equal(draws,4,'only draw when scheduling, not every frame');
  assert.deepEqual(h.state.cat,before,'audio is read-only');
});
test('full, sleeping, eating, grooming, hidden or occupied cats stay silent and cannot queue a cry',()=>{
  for(const block of [
    cat=>cat.hunger=35.01,cat=>cat.hunger=100,cat=>cat.hunger=undefined,
    ...['sleep','eat','groom','stretch','play','joinPlay'].map(mode=>cat=>cat.mode=mode),
    cat=>cat.bunkWake={},cat=>cat.mouseChase={controlled:true},
    cat=>cat.motion.hidden=true,cat=>cat.motion.portal={phase:'transit',from:0,to:1},cat=>cat.motion.hop={},
  ]){
    const h=hungryFixture(),ready=structuredClone(h.state.cat);
    h.driver.update(.1,h.state);h.driver.update(7,h.state);block(h.state.cat);
    for(let i=0;i<120;i++)h.driver.update(1,h.state);
    assert.equal(h.meows().length,0);
    Object.assign(h.state.cat,ready,{bunkWake:null,mouseChase:null});
    h.driver.update(.1,h.state);h.driver.update(7.9,h.state);assert.equal(h.meows().length,0,'resume is not an overdue call');
    h.driver.update(.1,h.state);assert.equal(h.meows().length,1);
  }
});
test('brief activity changes or hunger threshold crossings cannot shorten the 45 second cooldown',()=>{
  for(const toggle of [cat=>cat.mode='sleep',cat=>cat.hunger=36]){
    const h=hungryFixture();h.driver.update(.1,h.state);h.driver.update(8,h.state);assert.equal(h.meows().length,1);
    toggle(h.state.cat);h.driver.update(1,h.state);h.state.cat.mode='look';h.state.cat.hunger=30;
    h.driver.update(1,h.state);h.driver.update(42.9,h.state);assert.equal(h.meows().length,1);
    h.driver.update(.1,h.state);assert.equal(h.meows().length,2);
  }
});
test('cat calls freeze on pause and advance silently during mute without catch-up bursts',()=>{
  const h=hungryFixture();h.driver.update(.1,h.state);
  for(let i=0;i<100;i++)h.driver.update(0,h.state);
  assert.equal(h.meows().length,0);
  h.audio.enabled=false;h.driver.update(8,h.state);h.driver.update(45,h.state);
  h.audio.enabled=true;h.driver.update(.1,h.state);assert.equal(h.meows().length,0);
  h.driver.update(44.9,h.state);assert.equal(h.meows().length,1);
  h.driver.update(600,h.state);assert.equal(h.meows().length,2,'at most one event after a large step');
  h.driver.update(.1,h.state);assert.equal(h.meows().length,2);
  h.state.cat=null;h.driver.update(60,h.state);assert.equal(h.meows().length,2);
});
test('real Lucy feeding resets fullness and silences calls without audio changing her behaviour random stream',()=>{
  const care=new Supplies();let catDraws=0;
  const cat=new CatRoutine(care,{random:()=>{catDraws++;return .5;}}),h=hungryFixture();h.state.cat=cat;
  cat.hunger=20;cat.rest('look',120);const draws=catDraws;
  h.driver.update(.1,h.state);h.driver.update(8,h.state);assert.equal(h.meows().length,1);assert.equal(catDraws,draws);
  cat.fetch();
  for(let frame=0;frame<7200&&cat.mode!=='eat';frame++){cat.update(1/60);h.driver.update(1/60,h.state);}
  assert.equal(cat.mode,'eat');assert.ok(cat.hunger>99);const calls=h.meows().length;
  for(let i=0;i<120;i++)h.driver.update(1,h.state);
  assert.equal(h.meows().length,calls,'satiated Lucy never calls for food');
});
test('cat voice is a short complete faded recording at low gain and original pitch, shared with the study',async()=>{
  const definition=CABIN_SOUNDS.catMeow;
  assert.equal(definition.file,'cat-meow.wav');assert.equal(definition.loop,undefined);assert.ok(definition.gain<=.14);
  const file=await readFile(new URL('../public/assets/obs/audio/'+definition.file,import.meta.url));
  const duration=(file.length-44)/2/22050;assert.ok(duration>1.5&&duration<1.6);assert.ok(file.length<70000);
  assert.equal(file.readInt16LE(44),0);assert.equal(file.readInt16LE(file.length-2),0);
  const audio=new CabinAudio({createContext:context,fetchAudio:async()=>response(),ambience:false});
  await audio.toggle();await audio.load();
  const voice=audio.play('catMeow');assert.equal(voice.volume,.14);assert.equal(voice.source.playbackRate.value,1);
  audio.dispose();
});
test('doors trigger only on movement changes and latch on closure, never while stationary or after unmute',()=>{
  const h=harness();h.driver.update(1/60,h.state);
  for(const opening of [.1,.2,.8,1,1,1,.8,.4,0,0]){h.state.airlock.opening=opening;h.driver.update(1/60,h.state);}
  assert.deepEqual(h.events.map(e=>e.id),['doorOpen','doorClose','latch']);
  h.audio.enabled=false;for(const opening of [.5,1,1]){h.state.airlock.opening=opening;h.driver.update(1/60,h.state);}
  h.audio.enabled=true;h.driver.update(1/60,h.state);assert.equal(h.events.length,3);
});
test('cat elevator doors sound once per movement at the correct entrance and destination on every route',()=>{
  for(const from of [0,1,2])for(const to of [0,1,2]){
    if(from===to)continue;
    const h=harness(),motion=new CatMotion({floor:from,x:CAT_PORT.x});h.state.cat={motion};
    h.driver.update(1/60,h.state);motion.goTo({floor:to,x:CAT_PORT.x+30});
    for(let frame=0;frame<3600&&motion.busy;frame++){
      motion.update(1/60);h.driver.update(1/60,h.state);
      const count=h.events.length;h.driver.update(0,h.state);assert.equal(h.events.length,count,'pause must not emit');
    }
    assert.equal(motion.busy,false);
    assert.deepEqual(h.events.map(e=>e.id),['doorOpen','doorClose','latch','doorOpen','doorClose','latch'],`${from} -> ${to}`);
    for(const [index,event]of h.events.entries()){
      const level=index<3?from:to;
      assert.deepEqual(event.position,{x:(CAT_PORT.x-700)*.022,y:(870-FLOORS[level].y)*.016+.045+CAT_PORT.height/2,z:CAT_PORT.wallZ+.055});
      assert.equal(event.volume,event.id==='latch'?.40*.65:.40,'small doors are quieter than the cabin hatch');
    }
    for(let i=0;i<120;i++)h.driver.update(1/60,h.state);
    assert.equal(h.events.length,6,'no sound after the passage is complete');
  }
});
test('cat elevator doors stay silent while stationary and do not replay a muted passage',()=>{
  const h=harness(),portal={from:1,to:0,phase:'open',age:0,duration:CAT_PORT.doorSeconds};h.state.cat={motion:{portal}};
  h.driver.update(1/60,h.state);portal.age=.2;h.driver.update(1/60,h.state);assert.equal(h.events.length,1);
  for(let i=0;i<120;i++)h.driver.update(1/60,h.state);
  assert.equal(h.events.length,1);
  h.audio.enabled=false;
  for(const phase of ['enter','close','transit','reopen','exit','shut','turnOut']){
    portal.phase=phase;
    for(let frame=0;frame<=42;frame++){portal.age=frame/60;h.driver.update(1/60,h.state);}
  }
  h.state.cat.motion.portal=null;h.driver.update(1/60,h.state);
  h.audio.enabled=true;h.driver.update(1/60,h.state);assert.equal(h.events.length,1);
});
test('real bathroom phases gate shower water and a single toilet flush on departure',()=>{
  for(const id of ['shower','toilet']){
    const h=harness(),visit=new BathroomVisit(id);h.state.brain.bathroom=visit;h.driver.update(1/60,h.state);
    for(let i=0;i<400;i++){visit.update(1/60);h.driver.update(1/60,h.state);}
    assert.equal(visit.phase,'use');assert.equal(h.loops.get('shower').active,id==='shower');
    for(let i=0;i<120;i++)h.driver.update(1/60,h.state);
    assert.equal(h.events.filter(e=>e.id==='flush').length,0);
    visit.requestExit();for(let i=0;i<360;i++){visit.update(1/60);h.driver.update(1/60,h.state);}
    assert.equal(h.loops.get('shower').active,false);assert.equal(h.events.filter(e=>e.id==='flush').length,id==='toilet'?1:0);
  }
});
test('footfalls follow distance, stop at waits, ignore teleports and vary their samples',()=>{
  const h=harness(),actor=h.state.actor;h.driver.update(1/60,h.state);actor.busy=true;
  for(let i=0;i<100;i++){actor.walkDistance+=1;h.driver.update(1/60,h.state);}
  const ids=h.events.map(e=>e.id);assert.ok(ids.length>=3);assert.equal(new Set(ids).size,3);
  assert.ok(h.events.every(event=>event.rate===1),'walking uses the same base tuning as the direct sound preview');
  const count=h.events.length;actor.waitingForDroid=true;for(let i=0;i<100;i++)h.driver.update(1/60,h.state);assert.equal(h.events.length,count);
  actor.waitingForDroid=false;actor.walkDistance+=1000;h.driver.update(1/60,h.state);assert.equal(h.events.length,count);
});
test('droid rubber footfalls, Milo ladder contacts and cargo impacts stay separate',()=>{
  const h=harness(),droid={position:{x:0,y:3,z:0},step:{kind:'walk'},walkDistance:0,age:0,time:0,washingUntil:0};h.state.droid=droid;
  h.driver.update(1/60,h.state);
  for(let i=0;i<100;i++){droid.walkDistance+=.03;h.driver.update(1/60,h.state);}
  assert.ok(h.events.length>=6);assert.equal(new Set(h.events.map(e=>e.id)).size,3);
  assert.ok(h.events.every(e=>/^rubberStep[123]$/.test(e.id)&&e.rate===1));
  const count=h.events.length;droid.waiting=true;
  for(let i=0;i<100;i++){droid.walkDistance+=.03;h.driver.update(1/60,h.state);}
  droid.waiting=false;droid.walkDistance+=100;h.driver.update(1/60,h.state);
  assert.equal(h.events.length,count,'no steps while blocked or after a teleport');
  droid.step=null;for(let i=0;i<10;i++)h.driver.update(1/60,h.state);
  assert.equal(h.events.length,count,'standing still is silent');
  h.state.actor.climbing=true;
  for(let i=0;i<30;i++){h.state.actor.y-=2;h.driver.update(1/60,h.state);}
  assert.ok(h.events.length>count);assert.ok(h.events.slice(count).every(e=>/^ladderStep[123]$/.test(e.id)));
  h.state.actor.climbing=false;droid.step={kind:'work',action:'cargo-place',duration:2};droid.age=0;h.driver.update(1/60,h.state);
  const beforeCargo=h.events.length;droid.age=1.01;h.driver.update(1/60,h.state);
  assert.equal(h.events.length,beforeCargo+1);assert.equal(h.events.at(-1).id,'metal');
  droid.step={kind:'walk'};h.driver.update(1/60,h.state);assert.equal(h.events.length,beforeCargo+1,'no second contact at the next job');
});
test('cargo contact is a short faded recording with subdued treble and no pitch processing',async()=>{
  const definition=CABIN_SOUNDS.metal,file=await readFile(new URL('../public/assets/obs/audio/'+definition.file,import.meta.url));
  const samples=Array.from({length:(file.length-44)/2},(_,i)=>file.readInt16LE(44+i*2)/32768);
  assert.equal(samples.length/22050,.30);assert.equal(samples[0],0);assert.equal(samples.at(-1),0);
  assert.equal(definition.gain,.20);assert.equal(definition.rate,undefined);assert.equal(definition.loop,undefined);
  assert.match(definition.label,/ハードケース/);
  const rms=data=>Math.sqrt(data.reduce((sum,s)=>sum+s*s,0)/data.length);
  assert.ok(rms(samples.slice(0,2205))>.03,'retain the physical contact');
  assert.ok(rms(samples.slice(-441))<rms(samples.slice(0,2205))*.1,'tail settles without another hit');
  let energy=0,delta=0;
  for(let i=1;i<samples.length;i++){energy+=samples[i]**2;delta+=(samples[i]-samples[i-1])**2;}
  assert.ok(Math.sqrt(delta/energy)<.5,'contact is not a sharp, ringing generic clang');
  const credits=await readFile(new URL('../public/assets/obs/audio/CREDITS.md',import.meta.url),'utf8');
  assert.match(credits,/Nox_Sound/);assert.match(credits,/2\.555–2\.855/);
});
test('cargo lands once at shelf contact, not on serving food or leaving the placement step',()=>{
  for(const fps of [30,60,120]){
    const h=harness(),dt=1/fps,droid=new DroidRoutine({care:{lastDelivery:null}});h.state.droid=droid;droid.job='cargo';
    droid.act('cargo-place',2.8);h.driver.update(dt,h.state);
    while(droid.step){
      droid.update(dt);const before=h.events.length;h.driver.update(dt,h.state);
      if(h.events.length>before){assert.equal(droid.step?.action,'cargo-place');assert.ok(droid.age>droid.step.duration*.5);assert.ok(droid.age<=droid.step.duration*.5+dt+1e-8);}
      const count=h.events.length;h.driver.update(dt,h.state);assert.equal(h.events.length,count);
    }
    assert.deepEqual(h.events.map(e=>e.id),['metal']);assert.equal(h.events[0].volume,.45);
    for(const action of ['greens-place','cook-serve']){
      droid.act(action,2);while(droid.step){droid.update(dt);h.driver.update(dt,h.state);}
    }
    assert.equal(h.events.length,1,'lightweight food is not a heavy case');
  }
});
test('cargo contacts stay quiet after muted, late or missing snapshots',()=>{
  const h=harness(),droid={position:{x:0,y:3,z:0},step:{kind:'work',action:'cargo-place',duration:2},age:0};h.state.droid=droid;
  h.driver.update(1/60,h.state);h.audio.enabled=false;droid.age=1.1;h.driver.update(1/60,h.state);
  h.audio.enabled=true;h.driver.update(1/60,h.state);assert.equal(h.events.length,0);
  droid.step={kind:'work',action:'cargo-place',duration:2};droid.age=0;h.driver.update(1/60,h.state);
  droid.age=1.1;h.driver.update(.5,h.state);h.driver.update(1/60,h.state);assert.equal(h.events.length,0);
  droid.step={kind:'work',action:'cargo-place',duration:2};droid.age=0;h.driver.update(1/60,h.state);
  h.state.droid=null;h.driver.update(1/60,h.state);droid.age=1.1;h.state.droid=droid;h.driver.update(1/60,h.state);
  assert.equal(h.events.length,0);
});
test('the three supply cases keep one quieter contact each, without duplicate landings',()=>{
  for(const fps of [30,60,120]){
    const h=harness(),dt=1/fps;h.state.care={phase:'unloading',delivery:{age:0}};h.driver.update(dt,h.state);
    for(let frame=1;frame<=fps*2.5;frame++){
      h.state.care.delivery.age=frame*dt;h.driver.update(dt,h.state);
      const count=h.events.length;h.driver.update(dt,h.state);assert.equal(h.events.length,count);
    }
    const contacts=h.events.filter(e=>e.id==='metal');assert.equal(contacts.length,3);
    assert.ok(contacts.every(e=>e.volume===.85));
  }
});
test('live Milo ascent and descent play the dedicated contacts, with silence while waiting and no duplicate updates',()=>{
  for(const [from,to]of [[1,0],[0,1]]){
    const h=harness(),actor=new CrewMotion({floor:from,x:LADDER_X});h.state.actor=actor;
    h.driver.update(1/60,h.state);actor.goTo({floor:to,x:LADDER_X});
    let waited=false;
    for(let frame=0;frame<2400&&actor.busy;frame++){
      actor.update(1/60);h.driver.update(1/60,h.state);
      const count=h.events.length;
      if(actor.climbing&&!waited){
        for(let i=0;i<60;i++)h.driver.update(1/60,h.state);
        assert.equal(h.events.length,count,'no impacts while height is held');waited=true;
      }
      h.driver.update(0,h.state);h.driver.update(1/60,h.state);
      assert.equal(h.events.length,count,'the same simulation position never emits twice');
    }
    assert.equal(actor.busy,false);assert.equal(actor.floor,to);
    const rungs=h.events.filter(e=>e.id.startsWith('ladderStep'));
    assert.ok(rungs.length>=8&&rungs.length<=14);assert.equal(new Set(rungs.map(e=>e.id)).size,3);
    assert.ok(rungs.every(e=>e.rate===1&&e.volume===1),'fixed preview tuning without random pitch wobble');
    assert.ok(h.events.every(e=>e.id!=='metal'),'no generic cargo clang on the ladder');
  }
});
test('every droid walking sound matches one rendered foot landing at 30, 60 and 120 fps',()=>{
  for(const fps of [30,60,120]){
    const h=harness(),dt=1/fps,speed=DROID_GAIT.speed*DROID_PACE;
    const droid={position:{x:0,y:3,z:0},step:{kind:'walk',duration:20},walkDistance:0,age:0,time:0,washingUntil:0};h.state.droid=droid;
    const feet=()=>sampleDroidServicePose({walking:true,walkDistance:droid.walkDistance,age:droid.age,duration:20,rest:0}).feet;
    let previous=feet(),landings=0;const times=[];
    h.driver.update(dt,h.state);
    for(let frame=1;frame<=fps*10;frame++){
      droid.age=frame*dt;droid.walkDistance=droid.age*speed;
      const current=feet(),contacts=current.filter((foot,i)=>previous[i][1]>.099+1e-8&&foot[1]<=.099+1e-8).length;
      const before=h.events.length;h.driver.update(dt,h.state);
      assert.equal(h.events.length-before,contacts,`${fps} fps / frame ${frame}: sound only on swing-to-stance`);
      if(contacts)times.push(droid.age);
      landings+=contacts;previous=current;
      h.driver.update(dt,h.state);assert.equal(h.events.length,before+contacts,'repeated update cannot duplicate a contact');
    }
    assert.equal(landings,22,'10 seconds contains 22 visible landings, not 27 fixed-distance beats');
    assert.equal(h.events.length,landings);assert.equal(new Set(h.events.map(e=>e.id)).size,3);
    const interval=DROID_WALK_CYCLE_DISTANCE/2/speed;
    for(let i=1;i<times.length;i++)assert.ok(Math.abs(times[i]-times[i-1]-interval)<=dt+1e-8);
  }
});
test('droid walk/resume, muted motion and distance discontinuities never add or replay footsteps',()=>{
  const h=harness(),droid={position:{x:0,y:3,z:0},step:{kind:'walk'},walkDistance:.1,age:0,time:0,washingUntil:0,waiting:true};h.state.droid=droid;
  const update=distance=>{droid.walkDistance=distance;h.driver.update(1/60,h.state);};
  update(.1);droid.waiting=false;update(.11);update(.12);assert.equal(h.events.length,0,'starting to walk is not a landing');
  update(.40);update(.41);assert.equal(h.events.length,1);
  droid.waiting=true;update(.41);droid.waiting=false;update(.42);assert.equal(h.events.length,1,'resume does not add a sound');
  update(.81);update(.82);assert.equal(h.events.length,2,'next real contact is retained');
  h.audio.enabled=false;update(1.20);update(1.23);h.audio.enabled=true;update(1.24);assert.equal(h.events.length,2,'unmute never replays a past contact');
  update(1.25);update(2.0);update(102);update(0);assert.equal(h.events.length,2,'short/long forward jumps and resets are silent');
  update(.40);update(.41);assert.equal(h.events.length,3,'normal gait resumes after a reset');
  h.state.droid=null;h.driver.update(1/60,h.state);h.state.droid=droid;update(.82);
  assert.equal(h.events.length,3,'a returning droid cannot reuse stale contact history');
});
test('droid pivot strokes follow pairs of planted steps, leaving gaps and never looping or replaying waits',()=>{
  const h=harness(),turn=planDroidTurn(0,Math.PI);turn.duration/=DROID_PACE;
  const droid={position:{x:0,y:3,z:0},step:{kind:'turn',turn,duration:turn.duration},age:0,time:0,washingUntil:0};h.state.droid=droid;
  h.driver.update(1/60,h.state);const times=[];
  for(let i=1;i<=Math.ceil(turn.duration*60);i++){
    const before=h.events.length;droid.age=Math.min(turn.duration,i/60);h.driver.update(1/60,h.state);
    if(h.events.length>before)times.push(droid.age);
  }
  assert.equal(times.length,turn.steps/2);assert.ok(h.events.every(e=>e.id==='servo'));
  for(let i=1;i<times.length;i++)assert.ok(times[i]-times[i-1]>.35,'silence between 200 ms strokes');
  assert.ok(![...h.loops.values()].some(loop=>loop.id==='servo'),'no repeating motor source');
  const count=h.events.length;for(let i=0;i<120;i++)h.driver.update(1/60,h.state);assert.equal(h.events.length,count);
  droid.step={kind:'turn',turn,duration:turn.duration};droid.age=0;h.driver.update(1/60,h.state);
  droid.waiting=true;droid.age=.8;h.driver.update(1/60,h.state);droid.waiting=false;h.driver.update(1/60,h.state);
  assert.equal(h.events.length,count,'waiting does not queue strokes');
  h.audio.enabled=false;droid.age=1.3;h.driver.update(1/60,h.state);h.audio.enabled=true;h.driver.update(1/60,h.state);
  assert.equal(h.events.length,count,'unmute does not replay past motion');
});
test('droid ladder strokes follow height in both directions and stop when age advances without motion',()=>{
  for(const direction of [-1,1]){
    const h=harness(),droid={position:{x:0,y:3,z:.34},step:{kind:'climb',from:{y:3},duration:6},age:0,time:0,washingUntil:0};h.state.droid=droid;
    h.driver.update(1/60,h.state);
    for(let i=1;i<=180;i++){droid.age=i/60;droid.position.y=3+direction*droid.age*.40*DROID_PACE;h.driver.update(1/60,h.state);}
    assert.ok(h.events.length>=5&&h.events.length<=8);assert.ok(h.events.every(e=>e.id==='servo'));
    const count=h.events.length;
    for(let i=0;i<120;i++){droid.age+=1/60;h.driver.update(1/60,h.state);}
    assert.equal(h.events.length,count,'a stationary ladder hold has no motor sound');
    assert.ok(![...h.loops.values()].some(loop=>loop.id==='servo'));
  }
});
test('appliances respect their real operating flags and no state transition is emitted twice',()=>{
  const h=harness(),droid={position:{x:0,y:3,z:0},step:{kind:'work',action:'washer-start',duration:2},age:0,time:0,washingUntil:0,washerOpening:1};h.state.droid=droid;
  h.driver.update(1/60,h.state);assert.equal(h.loops.get('washer').active,false);
  droid.washingUntil=5;droid.time=1;h.driver.update(1/60,h.state);assert.equal(h.loops.get('washer').active,true);
  droid.time=6;h.driver.update(1/60,h.state);assert.equal(h.loops.get('washer').active,false);
  droid.step={kind:'work',action:'washer-close'};droid.washerOpening=.5;h.driver.update(1/60,h.state);assert.equal(h.events.length,0);
  droid.step=null;droid.washerOpening=0;h.driver.update(1/60,h.state);h.driver.update(1/60,h.state);
  assert.deepEqual(h.events.map(e=>e.id),['applianceLid'],'closure still sounds with no following step, without a second lock impact');
});
test('real appliance hinges unlock once and contact only at full closure, at 30, 60 and 120 fps',()=>{
  for(const fps of [30,60,120])for(const [prefix,property]of [['washer','washerOpening'],['waste','incineratorOpen']]){
    const h=harness(),dt=1/fps,droid=new DroidRoutine({care:{lastDelivery:null}});h.state.droid=droid;
    droid.job='laundry';
    const duration=prefix==='washer'?1.8:.9;
    droid.act(prefix+'-open',duration);droid.add('hold',.5);droid.act(prefix+'-close',duration);
    h.driver.update(dt,h.state);
    for(let frame=0;frame<fps*5&&droid.step;frame++){
      droid.update(dt);const before=h.events.length;h.driver.update(dt,h.state);
      for(const event of h.events.slice(before)){
        if(event.id==='latch')assert.ok(droid[property]>0&&droid[property]<.03,'unlock at the start of actual hinge motion');
        else{assert.equal(event.id,'applianceLid');assert.equal(droid[property],0,'impact only at the end of closure');}
      }
      const count=h.events.length;h.driver.update(dt,h.state);assert.equal(h.events.length,count,'a repeated snapshot is silent');
    }
    assert.equal(droid.step,null);assert.deepEqual(h.events.map(e=>e.id),['latch','applianceLid']);
    const lid=h.events[1];
    assert.equal(lid.position.x,prefix==='washer'?-2.34:WASTE_INCINERATOR.x,'contact comes from the appliance, not the droid');
    assert.equal(lid.volume,prefix==='washer'?1:.75);
    for(let i=0;i<fps;i++)h.driver.update(dt,h.state);
    assert.equal(h.events.length,2,'closed and stationary is silent');
  }
});
test('appliance closures never catch up after mute, late frames, missing state or droid replacement',()=>{
  const h=harness(),droid={position:{x:0,y:3,z:0},step:null,washerOpening:0};h.state.droid=droid;
  const update=(opening,dt=1/60)=>{droid.washerOpening=opening;h.driver.update(dt,h.state);};
  update(0);h.audio.enabled=false;update(.01);update(1);update(.5);update(0);
  h.audio.enabled=true;update(0);assert.equal(h.events.length,0);
  update(1,.5);update(0,.5);update(0);assert.equal(h.events.length,0,'no late-frame replay');
  update(undefined);update(1);assert.equal(h.events.length,0,'joining mid-stroke does not unlock again');
  h.state.droid=null;h.driver.update(1/60,h.state);update(0);
  h.state.droid=droid;update(0);assert.equal(h.events.length,0,'removed and returning droids cannot produce stale contact');
  update(1);h.state.droid={...droid,washerOpening:0};h.driver.update(1/60,h.state);
  assert.deepEqual(h.events.map(e=>e.id),['latch'],'a replacement closed state is not a real closure');
});
test('the study exposes separate lock and lid auditions and uses the live hinge routine',async()=>{
  const html=await readFile(new URL('../src/cabin-audio-study.html',import.meta.url),'utf8');
  const js=await readFile(new URL('../src/cabin-audio-study.js',import.meta.url),'utf8');
  assert.match(html,/value="washerDoor"/);assert.match(js,/new DroidRoutine/);
  assert.match(js,/droid\.act\('washer-open',1\.8\)/);assert.match(js,/droid\.act\('washer-close',1\.8\)/);
  assert.match(CABIN_SOUNDS.latch.label,/ロック/);assert.match(CABIN_SOUNDS.applianceLid.label,/洗濯機/);
});
test('the approved bag clip and gain stay untouched alongside a compact recorded kibble stream',async()=>{
  const bag=await readFile(new URL('../public/assets/obs/audio/bag.wav',import.meta.url));
  assert.equal(createHash('sha256').update(bag).digest('hex'),'d0db374e8a080505e1d93b308c26fd8453cea1f2606c0cdaf4ab65573683786f');
  assert.equal(CABIN_SOUNDS.bag.gain,.24);assert.equal(CABIN_SOUNDS.bag.loop,undefined);
  const definition=CABIN_SOUNDS.kibblePour,file=await readFile(new URL('../public/assets/obs/audio/'+definition.file,import.meta.url));
  assert.equal(file.length,132344);assert.equal((file.length-44)/2/22050,3);
  assert.equal(definition.loop,true);assert.equal(definition.gain,.23);assert.equal(definition.rate,undefined);
  assert.notDeepEqual(file,bag);
});
test('real food pouring adds bowl rattle only during grain arrivals and preserves all five bag rustles',()=>{
  for(const fps of [30,60,120]){
    const h=harness(),dt=1/fps,droid=new DroidRoutine({care:{lastDelivery:null}});h.state.droid=droid;
    droid.job='feed';droid.carriedFood=true;droid.act('food-pour',6);h.driver.update(dt,h.state);
    let first=null,last=null,activeBefore=false,starts=0,stops=0;
    while(droid.step){
      droid.update(dt);h.driver.update(dt,h.state);
      const loop=h.loops.get('kibble-pour'),age=droid.age*DROID_PACE;
      const expected=Boolean(droid.step&&age>=KIBBLE_STREAM.start+KIBBLE_CONTACT_DELAY&&age<6-KIBBLE_STREAM.finishLead+KIBBLE_CONTACT_DELAY);
      assert.equal(loop.active,expected);
      if(loop.active){first??=droid.time;last=droid.time;assert.equal(loop.id,'kibblePour');
        assert.deepEqual(loop.position,{x:(CAT_BOWL.x-700)*.022,y:(870-FLOORS[CAT_BOWL.floor].y)*.016+CAT_BOWL.foodHeight,z:CAT_BOWL.depth});}
      if(loop.active&&!activeBefore)starts++;if(!loop.active&&activeBefore)stops++;activeBefore=loop.active;
    }
    assert.equal(starts,1);assert.equal(stops,1);
    assert.ok(Math.abs(first-(KIBBLE_STREAM.start+KIBBLE_CONTACT_DELAY)/DROID_PACE)<=dt+1e-8);
    assert.ok(Math.abs(last-(6-KIBBLE_STREAM.finishLead+KIBBLE_CONTACT_DELAY)/DROID_PACE)<=dt+1e-8);
    const bags=h.events.filter(e=>e.id==='bag');assert.equal(bags.length,5);assert.ok(bags.every(e=>e.volume===.7));
    assert.equal(h.events.some(e=>e.id==='kibblePour'),false,'grains are a single stream, not repeated one-shots');
  }
});
test('kibble stream stops on waiting, missing food, end of pour and droid removal',()=>{
  const h=harness(),droid={position:{x:0,y:0,z:0},step:{kind:'work',action:'food-pour',duration:6},age:2,carriedFood:true};h.state.droid=droid;
  const active=()=>{h.driver.update(1/60,h.state);return h.loops.get('kibble-pour').active;};
  assert.equal(active(),true);droid.waiting=true;assert.equal(active(),false);
  droid.waiting=false;assert.equal(active(),true);droid.carriedFood=false;assert.equal(active(),false);
  droid.carriedFood=true;droid.age=5.5;assert.equal(active(),false);
  droid.age=2;assert.equal(active(),true);droid.step=null;assert.equal(active(),false);
  h.state.droid=null;assert.equal(active(),false);
});
test('kibble and bag share the bounded mixer with one reused stream and stop together on mute or pause',async()=>{
  const ctx=context(),audio=new CabinAudio({createContext:()=>ctx,fetchAudio:async()=>response(),ambience:false});
  try{
    await audio.toggle();await audio.load();
    const before=ctx.created.length;audio.setLoop('kibble-pour','kibblePour',true);
    const stream=audio.loops.get('kibble-pour');assert.ok(stream);assert.equal(stream.source.loop,true);
    assert.equal(ctx.created.length-before,3,'one buffer, gain and panner, no filter or per-grain source');
    for(let i=0;i<300;i++)audio.setLoop('kibble-pour','kibblePour',true);
    assert.equal(audio.loops.get('kibble-pour'),stream);assert.equal(ctx.created.length-before,3);
    const bag=audio.play('bag');assert.ok(bag);assert.equal(audio.voices.size,2);
    audio.pause(true);assert.equal(stream.stopping,true);assert.equal(bag.stopping,true);assert.equal(audio.loops.size,0);
    stream.source.onended();bag.source.onended();audio.pause(false);
    audio.setLoop('kibble-pour','kibblePour',true);const resumed=audio.loops.get('kibble-pour');assert.ok(resumed);
    await audio.toggle();assert.equal(audio.loops.size,0);assert.equal(resumed.stopping,true);
    audio.setLoop('kibble-pour','kibblePour',false);resumed.source.onended();await audio.toggle();
    assert.equal(audio.voices.size,0,'finished muted pours do not replay');
  }finally{audio.dispose();}
});
test('the feed study runs the real routine at OBS pace and offers a separate kibble audition',async()=>{
  const html=await readFile(new URL('../src/cabin-audio-study.html',import.meta.url),'utf8');
  const js=await readFile(new URL('../src/cabin-audio-study.js',import.meta.url),'utf8');
  assert.match(html,/猫餌の袋 ＋ カリカリを皿へ/);assert.match(js,/droid\.act\('food-pour',6/);
  assert.match(js,/\['washerDoor','feed','simmer'\]\.includes\(r\.kind\)\)s\.droid\.update\(dt\)/);
  assert.match(CABIN_SOUNDS.kibblePour.label,/カリカリを皿へ/);
});
test('simmer is a compact native-speed recording with a quiet gain and a continuous loop join',async()=>{
  const definition=CABIN_SOUNDS.simmer,file=await readFile(new URL('../public/assets/obs/audio/'+definition.file,import.meta.url));
  assert.equal(file.length,176444);assert.equal((file.length-44)/44100,4);
  assert.equal(definition.gain,.18);assert.equal(definition.loop,true);assert.equal(definition.rate,undefined);
  const data=Array.from({length:(file.length-44)/2},(_,i)=>file.readInt16LE(44+i*2)/32768);
  const energy=samples=>Math.sqrt(samples.reduce((sum,value)=>sum+value*value,0)/samples.length);
  const head=energy(data.slice(0,2205)),tail=energy(data.slice(-2205)),body=energy(data);
  assert.ok(head>body*.2&&tail>body*.2,'no silence baked into the loop boundary');
  assert.ok(Math.abs(data[0]-data.at(-1))<.05,'no click at the join');
  const credits=await readFile(new URL('../public/assets/obs/audio/CREDITS.md',import.meta.url),'utf8');
  assert.match(credits,/small-broth-in-a-pot-s0492\.html/);
  const packer=await readFile(new URL('../studies/audio/pack-cabin-audio.mjs',import.meta.url),'utf8');
  assert.match(packer,/\['pot-simmer','pot-simmer\.mp3',2,4\.12,true,false,'highpass=f=90,lowpass=f=5000'\]/);
});
test('the real cooking plan simmers once at the pot, only during stirring at 30, 60 and 120 fps',()=>{
  for(const fps of [30,60,120]){
    const h=harness(),dt=1/fps;h.state.care=new Supplies();
    const droid=h.state.droid=new DroidRoutine({care:h.state.care,brain:h.state.brain,actor:h.state.actor});
    droid.job='cook';droid.position={x:-9.75,y:0,z:.66,floor:2,yaw:Math.PI};droid.plan={...droid.position};droid.planCooking();
    h.driver.update(dt,h.state);
    let previous=false,starts=0,stops=0,seconds=0;const phases=new Set();
    for(let frame=0;frame<fps*90&&droid.step;frame++){
      droid.update(dt);h.driver.update(dt,h.state);
      const action=droid.step?.action,loop=h.loops.get('pot-simmer');phases.add(action);
      assert.equal(loop.active,action==='cook-stir'&&!droid.waiting);
      if(loop.active){
        seconds+=dt;assert.equal(loop.id,'simmer');
        assert.deepEqual(loop.position,{x:-10.56,y:1.075+.23,z:-.17});
        assert.notEqual(loop.position.x,droid.position.x,'the pot, not the robot, is the source');
        if(!previous)starts++;
      }else if(previous)stops++;
      previous=loop.active;
    }
    assert.equal(droid.step,null);assert.equal(starts,1);assert.equal(stops,1);
    assert.ok(Math.abs(seconds-16/DROID_PACE)<=dt+1e-6);
    for(const phase of ['cook-chop','cook-stir','cook-serve','cook-cleanup'])assert.ok(phases.has(phase));
    assert.ok(h.events.some(event=>event.id==='chop'),'existing chopping remains');
    assert.equal(h.events.some(event=>event.id==='simmer'),false,'not a one-shot per stir');
  }
});
test('waiting, serving, cancellation and missing droids cannot leave the simmer running',()=>{
  const h=harness(),droid={position:{x:-10.25,y:0,z:.66},step:{kind:'work',action:'cook-stir',duration:10},age:1};
  h.state.droid=droid;
  const active=()=>{h.driver.update(1/60,h.state);return h.loops.get('pot-simmer').active;};
  assert.equal(active(),true);droid.waiting=true;assert.equal(active(),false);
  droid.waiting=false;assert.equal(active(),true);
  for(const action of ['cook-chop','cook-serve','cook-cleanup','food-pour']){droid.step.action=action;assert.equal(active(),false);}
  droid.step.action='cook-stir';assert.equal(active(),true);droid.step=null;assert.equal(active(),false);
  h.state.droid=null;assert.equal(active(),false);
});
test('simmer reuses one voice and stops on mute or pause without restarting a completed phase',async()=>{
  const ctx=context(),audio=new CabinAudio({createContext:()=>ctx,fetchAudio:async()=>response(),ambience:false});
  const h=harness();h.driver=new CabinSoundEvents(audio);
  h.state.droid={position:{x:-10.25,y:0,z:.66},step:{kind:'work',action:'cook-stir',duration:10},age:1};
  try{
    await audio.toggle();await audio.load();const before=ctx.created.length;
    h.driver.update(1/60,h.state);const voice=audio.loops.get('pot-simmer');assert.ok(voice);
    assert.equal(voice.source.loop,true);assert.equal(voice.source.playbackRate.value,1);
    for(let i=0;i<600;i++)h.driver.update(1/60,h.state);
    assert.equal(audio.loops.get('pot-simmer'),voice);assert.equal(ctx.created.length-before,3);
    audio.pause(true);h.driver.update(1/60,h.state);assert.equal(audio.loops.size,0);assert.equal(voice.stopping,true);
    voice.source.onended();audio.pause(false);h.driver.update(1/60,h.state);
    const resumed=audio.loops.get('pot-simmer');assert.ok(resumed);
    await audio.toggle();resumed.source.onended();assert.equal(audio.loops.size,0);
    h.state.droid.step.action='cook-serve';h.driver.update(1/60,h.state);
    await audio.toggle();h.driver.update(1/60,h.state);assert.equal(audio.loops.size,0);
  }finally{audio.dispose();}
});
test('simmer study previews actual stir and serve phases instead of a synthetic timer',async()=>{
  const page=await readFile(new URL('../src/cabin-audio-study.html',import.meta.url),'utf8');
  const source=await readFile(new URL('../src/cabin-audio-study.js',import.meta.url),'utf8');
  assert.match(page,/<option value="simmer">/);assert.match(source,/droid\.act\('cook-stir',16\);droid\.act\('cook-serve',3\)/);
  assert.match(source,/\['washerDoor','feed','simmer'\]\.includes\(r\.kind\)\)s\.droid\.update\(dt\)/);
});
test('disposal during an in-flight download aborts and cannot repopulate the cache',async()=>{
  let release;const pending=new Promise(resolve=>release=resolve),ctx=context();
  const audio=new CabinAudio({createContext:()=>ctx,fetchAudio:async()=>{await pending;return response();}});await audio.toggle();audio.dispose();release();await audio.loading;
  assert.equal(audio.stats.loaded,0);assert.equal(ctx.state,'closed');assert.equal(await audio.toggle(),false);
});
