import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {CabinPlaybackSession,bindCabinAudioGestures,silentWav} from '../src/obs/audio-unlock.js';

function environment(navigator={userAgent:'iPhone CriOS/140',platform:'iPhone'}){
  const nodes=[],revoked=[],blobs=[];
  const document={body:{appendChild(node){nodes.push(node);}},createElement(tag){
    assert.equal(tag,'audio');
    return{paused:true,attributes:{},plays:0,pauses:0,setAttribute(key,value){this.attributes[key]=value;},
      play(){this.plays++;this.paused=false;return Promise.resolve();},
      pause(){this.pauses++;this.paused=true;},remove(){this.removed=true;}};
  }};
  const url={createObjectURL(blob){blobs.push(blob);return'blob:local-silence';},revokeObjectURL(value){revoked.push(value);}};
  return{nodes,revoked,blobs,session:new CabinPlaybackSession({navigator,document,url})};
}
test('silent unlock media is valid one-second PCM and contains no audible samples',()=>{
  const bytes=silentWav(),data=new DataView(bytes.buffer);
  assert.equal(new TextDecoder().decode(bytes.subarray(0,4)),'RIFF');
  assert.equal(data.getUint32(4,true),bytes.length-8);
  assert.equal(data.getUint16(22,true),1);assert.equal(data.getUint32(24,true),8000);
  assert.equal(data.getUint32(40,true),16000);assert.ok(bytes.subarray(44).every(value=>value===0));
});
test('supported AudioSession uses playback only while active and does not allocate fallback media',()=>{
  let type='ambient',writes=0;
  const audioSession={get type(){return type;},set type(value){type=value;writes++;}};
  const h=environment({audioSession,userAgent:'iPhone'});
  assert.equal(type,'ambient');h.session.start();h.session.start();
  assert.equal(type,'playback');assert.equal(writes,1);assert.equal(h.nodes.length,0);
  h.session.pause();assert.equal(type,'ambient');h.session.start();assert.equal(type,'playback');
  h.session.dispose();assert.equal(type,'ambient');h.session.start();assert.equal(type,'ambient');
});
test('session cleanup never overrides a newer audio session type owned elsewhere',()=>{
  const audioSession={type:'auto'},h=environment({audioSession});
  h.session.start();audioSession.type='play-and-record';h.session.dispose();
  assert.equal(audioSession.type,'play-and-record');
});
test('iPhone Chrome fallback is one silent inline element, paused on mute/background and released',()=>{
  const h=environment();h.session.start();h.session.start();
  assert.equal(h.nodes.length,1);assert.equal(h.blobs.length,1);
  const media=h.nodes[0];assert.equal(media.plays,1);assert.equal(media.loop,true);
  assert.equal(media.volume,.001);assert.equal(media.hidden,true);
  assert.ok(Object.hasOwn(media.attributes,'playsinline'));assert.equal(media.attributes['aria-hidden'],'true');
  h.session.pause();assert.equal(media.paused,true);h.session.start();assert.equal(media.plays,2);
  h.session.dispose();assert.equal(media.paused,true);assert.equal(media.removed,true);
  assert.deepEqual(h.revoked,['blob:local-silence']);h.session.start();assert.equal(h.nodes.length,1);
});
test('a rejected media play retries on the next gesture without leaking a new element or URL',async()=>{
  const h=environment();h.session.start();const media=h.nodes[0];
  h.session.pause();media.play=function(){this.plays++;return Promise.reject(new Error('NotAllowedError'));};
  h.session.start();await Promise.resolve();h.session.start();await Promise.resolve();
  assert.equal(media.plays,3);assert.equal(h.nodes.length,1);assert.equal(h.blobs.length,1);h.session.dispose();
});
test('iPad desktop UA and an unsupported session setter use fallback; Android and desktop do not',()=>{
  for(const navigator of [{userAgent:'Macintosh',platform:'MacIntel',maxTouchPoints:5},
    {userAgent:'iPhone',audioSession:{get type(){return'auto';},set type(_value){throw new Error('unsupported');}}}]){
    const h=environment(navigator);h.session.start();assert.equal(h.nodes.length,1);h.session.dispose();
  }
  for(const navigator of [{userAgent:'Android Chrome'},{userAgent:'Macintosh',platform:'MacIntel',maxTouchPoints:0}]){
    const h=environment(navigator);h.session.start();assert.equal(h.nodes.length,0);h.session.dispose();
  }
});
test('capture gesture handlers retry iOS touchend without intercepting taps or the mute button',()=>{
  const listeners=new Map(),target={addEventListener(name,fn,options){assert.deepEqual(options,{capture:true,passive:true});listeners.set(name,fn);},
    removeEventListener(name,fn,capture){assert.equal(capture,true);assert.equal(fn,listeners.get(name));listeners.delete(name);}};
  let calls=0,errors=0;
  const audio={unlock(){calls++;if(calls===3)throw new Error('Web Audio unavailable');}};
  const unbind=bindCabinAudioGestures(audio,{target,ignore:event=>event.mute,onError:()=>errors++});
  const event={preventDefault(){assert.fail('must not block touch');},stopPropagation(){assert.fail('must not block controls');}};
  listeners.get('pointerdown')(event);listeners.get('touchend')(event);listeners.get('click')(event);
  listeners.get('click')({...event,mute:true});listeners.get('keydown')({...event,repeat:true});
  listeners.get('pointerdown')({...event,button:2});
  assert.equal(calls,3);assert.equal(errors,1);unbind();assert.equal(listeners.size,0);
});
test('OBS starts enabled, preloads without resuming, and binds page restoration and cleanup',async()=>{
  const main=await readFile(new URL('../src/obs/main.js',import.meta.url),'utf8');
  const html=await readFile(new URL('../src/obs.html',import.meta.url),'utf8');
  assert.match(main,/new CabinAudio\(\{enabled:true\}\)/);
  assert.match(main,/audio\.prepare\(\);void audio\.load\(\)/);
  assert.match(main,/bindCabinAudioGestures\(audio/);
  assert.match(main,/addEventListener\('pageshow',visibilityChanged\)/);
  assert.match(main,/pagehide',event=>\{audio\.pause\(true\);if\(!event\.persisted\)\{unbindAudioGestures\(\)/);
  assert.match(html,/id="obs-sound"[^>]+aria-pressed="true"[^>]*><i data-lucide="volume-2"/);
});
