import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Vector3,Box3,MeshStandardMaterial} from 'three';
import {createExteriorMothership} from '../src/obs/exterior-mothership.js';
import {createExteriorShip} from '../src/obs/ship-exterior.js';
import {applyExteriorProbePose,sampleExteriorProbeFlight} from '../src/obs/exterior-probe-flight.js';
import {buildShip,buildShipInBackground} from '../src/obs/ship.js';
import {disposeSurfaceFixture} from './helpers/cabin-surface-fixture.js';

test('background cabin assembly yields between stages and preserves the cabin and interaction targets',async()=>{
  const previous=globalThis.document;
  const ctx=new Proxy({measureText:text=>({width:text.length*8}),createLinearGradient:()=>({addColorStop(){}})},{get:(object,key)=>key in object?object[key]:()=>{}});
  globalThis.document={createElement:()=>({getContext:()=>ctx})};
  const materials=new Map(),source=new Proxy({},{get:(_,key)=>{if(!materials.has(key))materials.set(key,new MeshStandardMaterial({name:String(key)}));return materials.get(key);}});
  let immediate,paced,yields=0;
  const snapshot=ship=>{
    const groups=[ship.staticMesh,ship.animated].map(root=>{
      root.updateMatrixWorld(true);const counts={meshes:0,vertices:0};
      root.traverse(object=>{if(object.isMesh){counts.meshes++;counts.vertices+=object.geometry.attributes.position.count;}});
      const box=new Box3().setFromObject(root);return{...counts,bounds:[...box.min.toArray(),...box.max.toArray()]};
    });
    return{groups,targets:ship.targets.map(target=>({station:target.userData.station,position:target.position.toArray()}))};
  };
  try{
    immediate=buildShip(source,{mergeStatic:false});
    paced=await buildShipInBackground(source,{mergeStatic:false,nextFrame:async()=>{yields++;}});
    assert.ok(yields>=15,'room construction gives the opening repeated chances to draw');
    assert.deepEqual(snapshot(paced),snapshot(immediate));
  }finally{
    if(immediate)disposeSurfaceFixture(immediate);if(paced)disposeSurfaceFixture(paced);
    if(previous===undefined)delete globalThis.document;else globalThis.document=previous;
  }
});

test('the mother ship can render without a probe, then attaches it once at the current core scale',async()=>{
  const mother=createExteriorMothership(),complete=createExteriorShip();
  try{
    mother.setCoreScale(2.6);complete.setAngle(.5);complete.setCoreScale(2.6);
    mother.setWear(false);mother.setAngle(.5);
    assert.equal(mother.dockedLander,null);assert.equal(mother.probeThrusters,null);
    assert.doesNotThrow(()=>applyExteriorProbePose(mother,sampleExteriorProbeFlight(0)));
    const first=mother.prepareProbe(),second=mother.prepareProbe();assert.equal(first,second);
    await first;
    assert.ok(mother.dockedLander&&mother.probeThrusters);
    assert.deepEqual(mother.probeDock.position,complete.probeDock.position);
    assert.ok(mother.dimensions.distanceTo(complete.dimensions)<1e-9,'staging preserves the complete model bounds');
    const probe=mother.dockedLander;await mother.prepareProbe();assert.equal(mother.dockedLander,probe);
    assert.equal(mother.root.children.filter(child=>child===mother.probeDock).length,1);
    mother.setCoreScale(1.6);complete.setCoreScale(1.6);assert.deepEqual(mother.probeDock.position,complete.probeDock.position);
    applyExteriorProbePose(mother,sampleExteriorProbeFlight(14));
    assert.ok(mother.dockedLander.position.distanceTo(new Vector3(...sampleExteriorProbeFlight(14).position))<1e-9);
  }finally{mother.dispose();complete.dispose();}
});
test('closing while the probe module is pending cannot attach resources after disposal',async()=>{
  const ship=createExteriorMothership(),waiting=ship.prepareProbe();ship.dispose();await waiting;
  assert.equal(ship.dockedLander,null);
});

test('opening static imports exclude cabin constructors and the probe, and cabin preload hints are inert',async()=>{
  const entry=new URL('../src/ship-exterior-cinema.js',import.meta.url),visited=new Set();
  async function visit(url){
    if(visited.has(url.pathname))return;visited.add(url.pathname);
    const source=await readFile(url,'utf8');
    for(const match of source.matchAll(/(?:import|export)\s+[^;]*?\s+from\s+['"](\.[^'"]+)['"]/g)){
      const dependency=new URL(match[1],url);if(dependency.pathname.endsWith('.js'))await visit(dependency);
    }
  }
  await visit(entry);
  for(const suffix of ['/obs/main.js','/obs/view.js','/obs/ship.js','/obs/characters.js','/obs/head.js','/js/models.js','/obs/exterior-probe.js'])
    assert.ok(![...visited].some(path=>path.endsWith(suffix)),`${suffix} must load after playback`);
  const html=await readFile(new URL('../src/obs.html',import.meta.url),'utf8');
  const template=html.match(/<template id="cabin-preloads">([\s\S]*?)<\/template>/);
  assert.ok(template&&template[1].includes('lucy-cabin.glb'));
  assert.ok(!html.replace(template[0],'').includes('rel="preload"'),'the HTML scanner cannot start cabin fetches before playback');
});
