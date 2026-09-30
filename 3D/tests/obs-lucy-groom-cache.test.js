import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {createCabinLucy,animateCabinLucy,decodeGroomCache,disposeCabinLucy} from '../src/obs/lucy-cabin.js';

const directory=new URL('../public/assets/obs/lucy/',import.meta.url);
const read=name=>fs.readFileSync(new URL(name,directory));
const bytes=buffer=>buffer.buffer.slice(buffer.byteOffset,buffer.byteOffset+buffer.byteLength);
const poses=JSON.parse(read('lucy-approved.json'));
const groomCache=()=>decodeGroomCache(bytes(read('lucy-groom.bin')),poses.groom);
async function create(cache){
  const gltf=await new GLTFLoader().parseAsync(bytes(read('lucy-cabin.glb')),'');
  return createCabinLucy({gltf,poses,cache},{random:()=>.5});
}
const groom=(root,time)=>animateCabinLucy(root,{dt:1/60,time,mode:'groom',actionTime:time,remaining:100,yaw:0});

test('grooming before the deferred cache arrives keeps the live coat; attaching it later matches the eager result exactly',async()=>{
  const deferred=await create(null),eager=await create(groomCache());
  const d=deferred.userData.cabin,e=eager.userData.cabin;
  assert.equal(d.groom.cache,null);assert.ok(e.groom.cache);
  groom(deferred,3);groom(eager,3);
  assert.equal(d.surface.source.visible,true,'the live coat stays visible without a cache');
  assert.equal(d.surface.display.visible,false,'no uncorrected playback surface is shown');
  assert.equal(e.surface.display.visible,true);
  d.groom.setCache(groomCache());
  groom(deferred,3.5);groom(eager,3.5);
  assert.equal(d.surface.display.visible,true);assert.equal(d.surface.source.visible,false);
  assert.deepEqual(Array.from(d.surface.display.geometry.attributes.position.array),Array.from(e.surface.display.geometry.attributes.position.array));
  assert.deepEqual(Array.from(d.surface.display.geometry.attributes.normal.array),Array.from(e.surface.display.geometry.attributes.normal.array));
  disposeCabinLucy(deferred);disposeCabinLucy(eager);
});

test('the cat routine never rests to groom while the correction cache is unavailable, in either decision path',async()=>{
  const {CatRoutine,Supplies}=await import('../src/obs/state.js');
  const seeded=seed=>()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  const restsAfterWalking=new Set(),direct=new Set();
  for(let seed=1;seed<=200;seed++){
    const cat=new CatRoutine(new Supplies(),{random:seeded(seed)});cat.groomAvailable=false;
    cat.groomNeed=100;cat.energy=100;cat.hunger=100;cat.remaining=0;cat.choose();
    assert.notEqual(cat.mode,'groom',`seed ${seed} chose grooming directly`);direct.add(cat.mode);
    if(cat.mode!=='walk')continue;
    for(let t=0;t<180&&cat.mode==='walk';t+=1/30){cat.update(1/30);assert.notEqual(cat.mode,'groom',`seed ${seed} groomed after walking`);}
    if(cat.mode!=='walk')restsAfterWalking.add(cat.mode);
  }
  assert.ok(direct.size>=3,'the direct choice still varies');
  assert.ok(restsAfterWalking.size>=1,'at least one walk reached its destination and rested');
  assert.ok(!restsAfterWalking.has('groom'));
  const available=new CatRoutine(new Supplies(),{random:seeded(3)});available.groomNeed=100;available.energy=100;available.hunger=100;
  const modes=new Set();for(let seed=1;seed<=200;seed++){const cat=new CatRoutine(new Supplies(),{random:seeded(seed)});cat.groomNeed=100;cat.energy=100;cat.hunger=100;cat.remaining=0;cat.choose();modes.add(cat.mode);}
  assert.ok(modes.has('groom'),'grooming is still chosen once the cache is available');
});

test('an empty bowl on arrival falls back to looking, not grooming, while the cache is unavailable',async()=>{
  const {CatRoutine,Supplies}=await import('../src/obs/state.js');
  const run=groomAvailable=>{
    const care=new Supplies();care.supplies.catfood=0;care.catBowl=0;
    const cat=new CatRoutine(care,{random:()=>.5});cat.groomAvailable=groomAvailable;cat.hunger=50;
    cat.fetch();
    for(let t=0;t<240&&cat.mode!=='look'&&cat.mode!=='groom';t+=1/30)cat.update(1/30);
    return cat.mode;
  };
  assert.equal(run(true),'groom','the fallback path is exercised: with the cache the cat grooms beside the empty bowl');
  assert.equal(run(false),'look');
});
