import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {Vector3} from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {createCabinLucy,animateCabinLucy,decodeGroomCache,disposeCabinLucy} from '../src/obs/lucy-cabin.js';
import {createLucyToon} from '../src/obs/lucy-toon.js';

test('cat ink follows animated, prone and baked grooming surfaces without changing the rig',async()=>{
  const directory=new URL('../public/assets/obs/lucy/',import.meta.url);
  const read=name=>fs.readFileSync(new URL(name,directory));
  const buffer=name=>{const b=read(name);return b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength);};
  const gltf=await new GLTFLoader().parseAsync(buffer('lucy-cabin.glb'),'');
  const poses=JSON.parse(read('lucy-approved.json'));
  const cat=createCabinLucy({gltf,poses,cache:decodeGroomCache(buffer('lucy-groom.bin'),poses.groom)},{random:()=>.5});
  cat.position.set(2,3,.8);
  const before=[];cat.traverse(m=>{if(m.isMesh)before.push({mesh:m,material:m.material});});
  const toon=createLucyToon(cat),c=cat.userData.cabin;
  assert(c.coat.material.isMeshToonMaterial);
  assert.equal(c.coat.material,c.surface.display.material,'baked groom uses the same coat shading');
  const a=new Vector3(),b=new Vector3();
  for(const mode of ['look','walk','prone','stretch','sleep','groom']){
    cat.userData.initialized=false;
    animateCabinLucy(cat,{dt:.1,time:4.3,actionTime:4.3,remaining:100,mode,moving:mode==='walk',walkDistance:.3,yaw:.8});
    toon.update(1200,800);cat.updateMatrixWorld(true);
    const active=[];cat.traverse(m=>{if(m.name==='Lucy toon outline'&&m.visible)active.push(m);});
    assert.equal(active.length,1,mode+' must have exactly one visible ink surface');
    const ink=active[0],source=c.surface.display.visible?c.surface.display:c.coat;
    source.skeleton?.update();
    for(const i of [0,101,Math.floor(source.geometry.attributes.position.count/2)]){
      source.getVertexPosition(i,a).applyMatrix4(source.matrixWorld);
      ink.getVertexPosition(i,b).applyMatrix4(ink.matrixWorld);
      assert(a.distanceTo(b)<1e-8,mode+' ink must follow the posed surface');
    }
    assert.equal(ink.material.clippingPlanes,source.material.clippingPlanes,'wall clips color and ink together');
    const hits=[];ink.raycast(null,hits);assert.equal(hits.length,0,'ink must not intercept clicks');
  }
  const originalGeometry=c.baseGeometry;
  let geometryDisposed=false,skeletonDisposed=false;
  originalGeometry.addEventListener('dispose',()=>geometryDisposed=true);
  const skeleton=c.coat.skeleton,dispose=skeleton.dispose;
  skeleton.dispose=()=>{skeletonDisposed=true;};
  toon.dispose();
  assert(!geometryDisposed&&!skeletonDisposed,'removing the style must keep the animation resources');
  assert(!cat.getObjectByName('Lucy toon outline'));
  before.forEach(({mesh,material})=>assert.equal(mesh.material,material));
  skeleton.dispose=dispose;disposeCabinLucy(cat);
});
