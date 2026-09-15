import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {createLucy,animateLucy} from '../../src/obs/lucy.js';
import {addLucyPupilShape,pupilShells} from './pupil-study.js';
import {addSleepingEyelids} from './sleep-eyelids.js';

test('oval pupils widen without moving eyes, sockets, blink or sleeping lids',{
  skip:!process.env.LUCY_SLEEP_BASE_ASSET,
},async()=>{
  const b=fs.readFileSync(process.env.LUCY_SLEEP_BASE_ASSET);
  const gltf=await new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');
  const cat=createLucy(gltf,{random:()=>.5}),originals=[];
  cat.traverse(m=>{if(m.isMesh)originals.push([m,m.geometry]);});
  addLucyPupilShape(cat);addLucyPupilShape(cat);
  let eye;
  for(const [mesh,old] of originals){
    if(mesh.material.name!=='Pupils and eye margin'){assert.equal(mesh.geometry,old);continue;}
    eye=mesh;
    assert.deepEqual(mesh.geometry.attributes.position.array,old.attributes.position.array);
    const slot=mesh.morphTargetDictionary.PupilOval,d=mesh.geometry.morphAttributes.position[slot];
    assert.equal(mesh.geometry.morphAttributes.position.length,old.morphAttributes.position.length+1);
    assert.equal(mesh.morphTargetInfluences[slot],1);
    for(let k=0;k<slot;k++)assert.deepEqual(mesh.geometry.morphAttributes.position[k].array,old.morphAttributes.position[k].array);
    const shells=pupilShells(old),selected=new Set(shells.flatMap(s=>s.indices));assert.equal(shells.length,2);
    for(let i=0;i<d.count;i++){
      assert.equal(d.getY(i),0);assert.equal(d.getZ(i),0);
      if(!selected.has(i))assert.equal(d.getX(i),0,'eye margins stay unchanged');
    }
    for(const shell of shells){
      const xs=shell.indices.map(i=>old.attributes.position.getX(i)+d.getX(i));
      const lo=Math.min(...xs),hi=Math.max(...xs);
      assert(Math.abs((lo+hi)/2-shell.center)<1e-8);
      assert(Math.abs((hi-lo)/shell.width-2.2)<1e-5);
      assert(hi-lo<.0065,'iris remains visible around each pupil');
    }
  }
  assert(eye);
  for(const mode of ['idle','look','groom','eat','play','sleep']){
    animateLucy(cat,{dt:.1,time:9,actionTime:9,mode,remaining:100,yaw:0});
    assert.equal(eye.morphTargetInfluences[eye.morphTargetDictionary.PupilOval],1);
  }
  addSleepingEyelids(cat);assert.equal(eye.visible,false,'sleep still hides the entire open eye');
});
