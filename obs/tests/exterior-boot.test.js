import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const bootSource=await readFile(new URL('../src/obs/boot.js',import.meta.url),'utf8');
const policy=new URL('../src/obs/exterior-cinema-policy.js',import.meta.url);

async function bootFixture(t,{search='',historyState=null}={}){
  const previous={document:globalThis.document,location:globalThis.location,history:globalThis.history,requestAnimationFrame:globalThis.requestAnimationFrame,testOpeningBoot:globalThis.testOpeningBoot};
  const events=[];let play,intro,enter,loaded;
  const playing=new Promise(resolve=>{play=resolve;}),finished=new Promise(resolve=>{intro=resolve;}),mainLoaded=new Promise(resolve=>{loaded=resolve;});
  const progress=[];
  const entry=new Promise(resolve=>{enter=resolve;});
  const ui={show(options){assert.equal(options.waitForEntry,true);events.push('opening');},hostProgress(value){progress.push(value);},whenEntryRequested(){return entry;},whenPlaying(){return playing;},whenLogoResolved(){return finished;}};
  globalThis.requestAnimationFrame=callback=>setImmediate(callback);
  globalThis.testOpeningBoot={exteriorCinema:ui,loadCabin(){events.push('cabin module');loaded();}};
  globalThis.history={state:historyState,replaceState(state){this.state=state;events.push('remember cabin');}};
  globalThis.location={search};globalThis.document={documentElement:{dataset:{}},
    head:{append(){events.push('network preload');}},getElementById:id=>id==='cabin-preloads'?{content:{cloneNode(){return{};}}}:{hidden:false}};
  t.after(()=>{for(const [key,value]of Object.entries(previous)){if(value===undefined)delete globalThis[key];else globalThis[key]=value;}});
  const source=bootSource
    .replace("import {exteriorCinema} from './exterior-session.js';",'const {exteriorCinema,loadCabin}=globalThis.testOpeningBoot;')
    .replace("'./exterior-cinema-policy.js'",JSON.stringify(policy.href))
    .replace("import {CABIN_SOUNDS,CABIN_AUDIO_BASE} from './sound-library.js';",'const CABIN_SOUNDS={},CABIN_AUDIO_BASE="/obs/assets/obs/audio/";')
    .replace("await import('./main.js');",'await loadCabin();');
  await import(`data:text/javascript,${encodeURIComponent(source+`\n// search=${search} history=${JSON.stringify(historyState)}`)}`);
  return{events,play,intro,enter,mainLoaded,progress};
}
test('opening playback and the logo never start cabin fetches or assembly; only entry does',async t=>{
  const f=await bootFixture(t,{historyState:{existing:'preserved'}});assert.deepEqual(f.events,['opening']);
  f.play();f.intro();await new Promise(resolve=>setImmediate(resolve));assert.deepEqual(f.events,['opening']);
  assert.equal(document.documentElement.dataset.cabinLoadStartedMs,undefined);
  assert.equal(document.documentElement.dataset.cabinBuildStartedMs,undefined);
  assert.deepEqual(f.progress,[]);
  assert.deepEqual(history.state,{existing:'preserved'});
  f.enter();await f.mainLoaded;assert.deepEqual(f.events,['opening','remember cabin','network preload','cabin module']);
  assert.deepEqual(history.state,{existing:'preserved',obsCabinEntered:true});
  assert.ok(Number(document.documentElement.dataset.cabinBuildStartedMs)>=Number(document.documentElement.dataset.cabinLoadStartedMs));
  assert.deepEqual(f.progress,[.12]);
});
test('opening bypass loads the cabin immediately without waiting for film signals',async t=>{
  const f=await bootFixture(t,{search:'?opening=0'});await f.mainLoaded;assert.deepEqual(f.events,['network preload','cabin module']);
});

test('reloading an entry that already connected to the cabin skips the opening',async t=>{
  const f=await bootFixture(t,{historyState:{obsCabinEntered:true}});
  await f.mainLoaded;
  assert.deepEqual(f.events,['network preload','cabin module']);
});
