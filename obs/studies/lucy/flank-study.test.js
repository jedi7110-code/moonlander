import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {Vector3} from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {createLucy,animateLucy} from '../../src/obs/lucy.js';
const file=process.env.LUCY_FLANK_STUDY_ASSET;
test('seated flanks gain width below the shoulder without moving face, forelegs or feet',{
  skip:!file&&'Set LUCY_FLANK_STUDY_ASSET to the candidate GLB',
},async()=>{
  const b=fs.readFileSync(file),gltf=await new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');
  const cat=createLucy(gltf,{random:()=>.5});
  animateLucy(cat,{dt:.1,time:9,mode:'look',actionTime:9,remaining:100,yaw:0});
  let changed=0,maxExpansion=0;
  cat.traverse(mesh=>{
    if(!mesh.isSkinnedMesh)return;
    mesh.skeleton.update();
    const index=mesh.morphTargetDictionary.SitFlanks;
    assert.notEqual(index,undefined);assert.equal(mesh.morphTargetInfluences[index],1);
    const after=Array.from({length:mesh.geometry.attributes.position.count},(_,i)=>mesh.getVertexPosition(i,new Vector3()).applyMatrix4(mesh.matrixWorld));
    mesh.morphTargetInfluences[index]=0;
    for(let i=0;i<after.length;i++){
      const p=mesh.getVertexPosition(i,new Vector3()).applyMatrix4(mesh.matrixWorld),q=after[i];
      const sourceZ=mesh.geometry.attributes.position.getZ(i);
      assert(q.toArray().every(Number.isFinite)&&q.y>-.001);
      if(p.y>.315||p.y<.08||sourceZ>=.130)assert(q.distanceTo(p)<1e-6,'preserve upper shoulder, head and limbs');
      if(p.y>.15&&p.y<.25){
        const expansion=Math.abs(q.x)-Math.abs(p.x);
        maxExpansion=Math.max(maxExpansion,expansion);if(expansion>.012)changed++;
      }
      assert(Math.abs(q.y-p.y)<1e-6,'do not lift or drop the abdomen');
    }
  });
  assert(changed>50&&maxExpansion>.020&&maxExpansion<.030);
  cat.userData.initialized=false;
  animateLucy(cat,{dt:.1,time:1,mode:'idle',actionTime:0,remaining:100,yaw:0});
  cat.traverse(mesh=>{const index=mesh.morphTargetDictionary?.SitFlanks;if(index!==undefined)assert.equal(mesh.morphTargetInfluences[index],0);});
});
