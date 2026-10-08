import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,stat} from 'node:fs/promises';
import {CabinAudio} from '../src/obs/audio.js';
import {CabinSoundEvents} from '../src/obs/sound-events.js';
import {CABIN_SOUNDS} from '../src/obs/sound-library.js';
import {BathroomVisit} from '../src/obs/bathroom.js';
import {CatMotion,CatRoutine,CrewMotion,Supplies} from '../src/obs/state.js';
import {CAT_PORT,FLOORS,PLANT,LADDER_X} from '../src/obs/layout.js';
import {planDroidTurn} from '../src/obs/droid-turn.js';
import {DROID_PACE} from '../src/obs/droid-routine.js';
import {DROID_GAIT,DROID_WALK_CYCLE_DISTANCE,LADDER_PACE} from '../src/obs/pace.js';
import {sampleDroidServicePose} from '../src/obs/droid-service.js';

function context(){
  const parameter=()=>({value:0,setValueAtTime(v){this.value=v;},setTargetAtTime(v){this.value=v;},exponentialRampToValueAtTime(v){this.value=v;},cancelScheduledValues(){}});
  const ctx={state:'suspended',currentTime:0,sampleRate:22050,created:[],destination:{},async resume(){this.state='running';},async close(){this.state='closed';},async decodeAudioData(){return{duration:1};},createBuffer:(_channels,length)=>({getChannelData:()=>new Float32Array(length)})};
  const node=()=>({gain:parameter(),pan:parameter(),frequency:parameter(),playbackRate:parameter(),connect(to){return to;},disconnect(){this.disconnected=true;},start(){this.started=true;},stop(){this.stopped=true;}});
  for(const method of ['createGain','createOscillator','createBufferSource','createBiquadFilter','createStereoPanner'])ctx[method]=()=>{const n=node();ctx.created.push(n);return n;};
  return ctx;
}
const response=()=>({ok:true,arrayBuffer:async()=>new ArrayBuffer(8)});
const soundCount=Object.keys(CABIN_SOUNDS).length;
test('CC0 assets are compact mono PCM, finite, non-silent, bounded and loop seams are smooth',async()=>{
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
  assert.ok(total<1000000,`ships ${total} bytes, not entire source packs`);
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
test('hatches start with an air burst followed by a low motor, in one click-free buffer',async()=>{
  const clips=[];
  for(const id of ['doorOpen','doorClose']){
    const definition=CABIN_SOUNDS[id];assert.match(definition.file,/-air-motor\.wav$/);
    const file=await readFile(new URL('../public/assets/obs/audio/'+definition.file,import.meta.url));clips.push(file);
    const samples=Array.from({length:(file.length-44)/2},(_,i)=>file.readInt16LE(44+i*2)/32768);
    const duration=samples.length/22050;assert.ok(duration>=1&&duration<=1.2);
    assert.equal(samples[0],0);assert.equal(samples.at(-1),0);
    const energy=(start,end)=>{let sum=0,delta=0,count=0;for(let i=Math.round(start*22050)+1;i<end*22050;i++){sum+=samples[i]**2;delta+=(samples[i]-samples[i-1])**2;count++;}return{rms:Math.sqrt(sum/count),brightness:Math.sqrt(delta/sum)};};
    const air=energy(.02,.10),motor=energy(.40,.70);
    assert.ok(air.rms>.03,'air release is present immediately, not a delayed hiss');
    assert.ok(motor.rms>.035,'audible motor follows the air');
    assert.ok(air.brightness>motor.brightness*4,'broadband air precedes the low drive');
  }
  assert.notDeepEqual(clips[0],clips[1],'opening and heavier closing are distinct mixes');
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
  for(const [id,gain]of [['rubberStep1',.30],['rubberStep2',.28],['rubberStep3',.30],['metal',.28]]){
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
  const events=[],loops=new Map(),audio={enabled:true,play(id,options){if(this.enabled)events.push({id,...options});},setLoop(key,id,active){loops.set(key,{id,active});},tone(){}};
  const state={actor:{x:700,y:650,floor:1,walkDistance:0,queue:[],busy:false},brain:{},care:{phase:'idle'},airlock:{opening:0}};
  return{audio,events,loops,state,driver:new CabinSoundEvents(audio,options)};
}
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
  h.state.actor.climbing=false;droid.step={kind:'work',action:'cargo-place'};h.driver.update(1/60,h.state);
  const beforeCargo=h.events.length;droid.step={kind:'walk'};h.driver.update(1/60,h.state);
  assert.equal(h.events.length,beforeCargo+1);assert.equal(h.events.at(-1).id,'metal');
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
  const h=harness(),droid={position:{x:0,y:3,z:0},step:{kind:'work',action:'washer-start',duration:2},age:0,time:0,washingUntil:0};h.state.droid=droid;
  h.driver.update(1/60,h.state);assert.equal(h.loops.get('washer').active,false);
  droid.washingUntil=5;droid.time=1;h.driver.update(1/60,h.state);assert.equal(h.loops.get('washer').active,true);
  droid.time=6;h.driver.update(1/60,h.state);assert.equal(h.loops.get('washer').active,false);
  droid.step={kind:'work',action:'washer-close'};h.driver.update(1/60,h.state);assert.equal(h.events.filter(e=>e.id==='latch').length,0);
  droid.step={kind:'walk'};h.driver.update(1/60,h.state);h.driver.update(1/60,h.state);assert.equal(h.events.filter(e=>e.id==='latch').length,1);
});
test('disposal during an in-flight download aborts and cannot repopulate the cache',async()=>{
  let release;const pending=new Promise(resolve=>release=resolve),ctx=context();
  const audio=new CabinAudio({createContext:()=>ctx,fetchAudio:async()=>{await pending;return response();}});await audio.toggle();audio.dispose();release();await audio.loading;
  assert.equal(audio.stats.loaded,0);assert.equal(ctx.state,'closed');assert.equal(await audio.toggle(),false);
});
