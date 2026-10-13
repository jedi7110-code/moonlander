import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const bootSource=await readFile(new URL('../src/obs/boot.js',import.meta.url),'utf8');

async function bootFixture(t,opening){
  const previous={document:globalThis.document,location:globalThis.location,testOpeningBoot:globalThis.testOpeningBoot};
  const events=[];let play,intro,loaded;
  const playing=new Promise(resolve=>{play=resolve;}),finished=new Promise(resolve=>{intro=resolve;}),mainLoaded=new Promise(resolve=>{loaded=resolve;});
  const ui={show(){events.push('opening');},whenPlaying(){return playing;},whenLogoResolved(){return finished;}};
  globalThis.testOpeningBoot={exteriorCinema:ui,shouldPlayExteriorOpening:()=>opening,loadCabin(){events.push('cabin module');loaded();}};
  globalThis.location={search:''};globalThis.document={documentElement:{dataset:{}},
    head:{append(){events.push('network preload');}},getElementById:id=>id==='cabin-preloads'?{content:{cloneNode(){return{};}}}:{hidden:false}};
  t.after(()=>{for(const [key,value]of Object.entries(previous)){if(value===undefined)delete globalThis[key];else globalThis[key]=value;}});
  const source=bootSource
    .replace("import {exteriorCinema} from './exterior-session.js';",'const {exteriorCinema,shouldPlayExteriorOpening,loadCabin}=globalThis.testOpeningBoot;')
    .replace("import {shouldPlayExteriorOpening} from './exterior-cinema-policy.js';",'')
    .replace("await import('./main.js');",'await loadCabin();');
  await import(`data:text/javascript,${encodeURIComponent(source+`\n// opening=${opening}`)}`);
  return{events,play,intro,mainLoaded};
}
test('real boot starts network preloads after playback and delays cabin module evaluation until the full logo is presented',async t=>{
  const f=await bootFixture(t,true);assert.deepEqual(f.events,['opening']);
  f.play();await Promise.resolve();await Promise.resolve();assert.deepEqual(f.events,['opening','network preload']);
  assert.equal(document.documentElement.dataset.cabinBuildStartedMs,undefined);
  f.intro();await f.mainLoaded;assert.deepEqual(f.events,['opening','network preload','cabin module']);
  assert.ok(Number(document.documentElement.dataset.cabinBuildStartedMs)>=Number(document.documentElement.dataset.cabinLoadStartedMs));
});
test('opening bypass loads the cabin immediately without waiting for film signals',async t=>{
  const f=await bootFixture(t,false);await f.mainLoaded;assert.deepEqual(f.events,['network preload','cabin module']);
});
