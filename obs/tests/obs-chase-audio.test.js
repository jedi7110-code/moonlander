import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {CabinSoundEvents} from '../src/obs/sound-events.js';
import {CABIN_SOUNDS} from '../src/obs/sound-library.js';
import {CatRoutine,Supplies} from '../src/obs/state.js';
import {CAT_PORT,DECK,FLOORS} from '../src/obs/layout.js';

const vocalIds=new Set(['catChirp','mouseSqueak1','mouseSqueak2']);
function fixture({floor=2,facing=1,fps=60}={}){
  let draws=0,time=0;
  const cat=new CatRoutine(new Supplies(),{turns:true,mouseChase:true,random:()=>{draws++;return .5;}});
  Object.assign(cat.motion,{floor,x:facing===1?510:1000,y:FLOORS[floor].y,z:CAT_PORT.walkZ,onSofa:false,elevation:0,heading:facing*Math.PI/2,facing,turn:null});
  Object.assign(cat,{mode:'idle',modeTime:0,remaining:100,hunger:90,energy:90});
  const events=[],audio={enabled:true,ready:true,play(id,options){
    if(vocalIds.has(id)&&this.enabled&&this.ready)events.push({id,...options,time,catPhase:cat.mouseChase.pose?.phase,mouse:{...cat.mouseChase.mouse},motion:{...cat.motion}});
  },setLoop(){},tone(){}};
  const driver=new CabinSoundEvents(audio),state={cat,actor:{x:700,y:650},brain:{},care:{phase:'idle'}};
  const h={cat,route:cat.mouseChase,events,audio,driver,state,dt:1/fps,draws:()=>draws,
    step(dt=1/fps){cat.update(dt);time+=dt;h.driver.update(dt,state);},
    until(predicate){for(let i=0;i<fps*45&&!predicate();i++)h.step();assert.ok(predicate(),'reached requested chase phase');},
    finish(){h.until(()=>!h.route.sim.active);}};
  driver.update(h.dt,state);
  return h;
}

test('real OBS chases emit one cat call and up to two separated mouse calls across decks, directions and frame rates',()=>{
  for(const fps of [30,60,120])for(const floor of [0,1,2])for(const facing of [-1,1]){
    const h=fixture({fps,floor,facing});h.route.appear(h.cat,floor);h.finish();
    assert.ok(h.events.length>=2&&h.events.length<=3,`${fps} fps / deck ${floor} / facing ${facing}`);
    assert.deepEqual(h.events.map(e=>e.id),['catChirp','mouseSqueak1','mouseSqueak2'].slice(0,h.events.length));
    assert.equal(h.events[0].catPhase,'notice');
    for(const event of h.events){
      assert.equal(event.rate,undefined,'native rate, no pitch randomization or stretching');
      assert.equal(event.mouse.visible,true);
      assert.ok(Object.values(event.position).every(Number.isFinite));
      if(event.id==='catChirp')assert.deepEqual(event.position,{x:(event.motion.x-700)*.022,y:(870-event.motion.y)*.016+.3,z:event.motion.z});
      else{
        assert.equal(event.mouse.phase,'run');
        assert.deepEqual(event.position,{x:event.mouse.x,y:(870-FLOORS[floor].y)*.016+.08,z:event.mouse.z});
      }
    }
    assert.ok(h.events[1].time-h.events[0].time>=.6);
    if(h.events[2])assert.ok(h.events[2].time-h.events[1].time>=2.1);
    const count=h.events.length;
    for(let i=0;i<120;i++)h.driver.update(h.dt,h.state);
    assert.equal(h.events.length,count,'renders/frozen poses cannot emit twice');
  }
});

test('opening overtake uses the same chase cues after the mouse clears Lucy',()=>{
  const h=fixture({floor:DECK.HABITATION});h.cat.mode='walk';
  assert.equal(h.route.appearOpening(h.cat),true);h.finish();
  assert.deepEqual(h.events.map(e=>e.id),['catChirp','mouseSqueak1','mouseSqueak2']);
});

test('mouse-only crossings, sleeping cats and cancelled pursuits stay silent',()=>{
  for(const setup of [h=>h.route.appear(h.cat,0),h=>{h.cat.bunkWake={};h.route.appear(h.cat,2);},h=>{h.route.appear(h.cat,2);h.route.cancel(h.cat);}]){
    const h=fixture();setup(h);
    // Drive the route directly so unrelated needs do not wake/summon the cat.
    for(let t=0;t<45;t+=h.dt){h.route.update(h.dt,h.cat);h.driver.update(h.dt,h.state);}
    assert.equal(h.events.length,0);
  }
  const h=fixture();h.route.appear(h.cat,2);h.until(()=>h.events.length===1);h.route.cancel(h.cat);h.finish();
  assert.deepEqual(h.events.map(e=>e.id),['catChirp'],'no later squeaks after cancellation');
});

test('muted or unloaded calls are consumed, pause is silent, and the next crossing can speak again',()=>{
  for(const key of ['enabled','ready']){
    const h=fixture();h.audio[key]=false;h.route.appear(h.cat,2);
    h.until(()=>h.route.sim.mouse.phase==='hidden');
    h.audio[key]=true;h.finish();assert.equal(h.events.length,0);
    // A new event on the same route object must reset the one-shot guards.
    Object.assign(h.cat.motion,{x:510,heading:Math.PI/2,facing:1,turn:null});
    Object.assign(h.cat,{mode:'idle',remaining:100});h.route.appear(h.cat,2);
    for(let i=0;i<120;i++)h.driver.update(0,h.state);
    assert.equal(h.events.length,0);h.finish();assert.ok(h.events.length>=2&&h.events.length<=3);
  }
});

test('late attachment, seeks and large simulation jumps do not replay chase calls',()=>{
  for(const change of [h=>h.driver=new CabinSoundEvents(h.audio),h=>h.step(.8),h=>{h.route.sim.mouse.age=0;h.route.sim.mouse.phaseTime=0;h.driver.update(h.dt,h.state);}]){
    const h=fixture();h.route.appear(h.cat,2);h.until(()=>h.events.length===1);h.events.length=0;
    change(h);h.finish();assert.equal(h.events.length,0);
  }
});

test('chase audio is read-only and never consumes the behaviour random stream',()=>{
  const h=fixture();h.route.appear(h.cat,2);h.until(()=>h.events.length===1);
  const draws=h.draws(),mouse={...h.route.mouse},pose={...h.route.pose};
  for(let i=0;i<100;i++)h.driver.update(h.dt,h.state);
  assert.equal(h.draws(),draws);assert.deepEqual(h.route.mouse,mouse);assert.deepEqual(h.route.pose,pose);
});

test('three short faded voices are CC0-backed, low gain, original-speed and under 61 KB total',async()=>{
  let bytes=0;const clips=[];
  const credits=await readFile(new URL('../public/assets/obs/audio/CREDITS.md',import.meta.url),'utf8');
  for(const id of vocalIds){
    const definition=CABIN_SOUNDS[id],file=await readFile(new URL('../public/assets/obs/audio/'+definition.file,import.meta.url));
    bytes+=file.length;clips.push(file);
    assert.equal(definition.loop,undefined);assert.equal(definition.rate,undefined);assert.ok(definition.gain<=.18);
    assert.equal(file.readInt16LE(44),0);assert.equal(file.readInt16LE(file.length-2),0);
    assert.ok((file.length-44)/44100<.7);assert.ok(credits.includes(definition.file));
  }
  assert.ok(bytes<61000);assert.notDeepEqual(clips[1],clips[2]);
  assert.match(credits,/Zabuhailo/);assert.match(credits,/dreamstobecome/);
  const source=await readFile(new URL('../src/cabin-audio-study.js',import.meta.url),'utf8');
  const page=await readFile(new URL('../src/cabin-audio-study.html',import.meta.url),'utf8');
  assert.match(page,/<option value="mouseChase">/);assert.match(source,/cat\.mouseChase\.appear\(cat,2\)/);
  assert.match(source,/s\.cat\.update\(dt\)/);
});
