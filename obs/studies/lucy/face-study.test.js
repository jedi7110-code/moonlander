import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {createLucy,animateLucy} from '../../src/obs/lucy.js';

const file=process.env.LUCY_FACE_STUDY_ASSET;
test('face study narrows head and eye spacing together, preserving body and blink height',{
  skip:!file&&'Set LUCY_FACE_STUDY_ASSET to the candidate GLB',
},async()=>{
  const bytes=fs.readFileSync(file);
  const gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
  const cat=createLucy(gltf,{random:()=>.5});let coat=0,eyes=0;
  animateLucy(cat,{dt:.1,time:9,mode:'look',actionTime:9,remaining:100,yaw:0});
  cat.traverse(mesh=>{
    if(!mesh.isSkinnedMesh)return;
    const index=mesh.morphTargetDictionary.FaceRefine;
    assert.notEqual(index,undefined);
    assert.equal(mesh.morphTargetInfluences[index],1);
    const base=mesh.geometry.attributes.position,delta=mesh.geometry.morphAttributes.position[index];
    let oldWidth=0,newWidth=0,oldEyes=0,newEyes=0;
    for(let i=0;i<base.count;i++){
      const x=base.getX(i),y=base.getY(i),z=base.getZ(i),dx=delta.getX(i);
      assert(Number.isFinite(dx));
      assert(Math.abs(delta.getY(i))<1e-7&&Math.abs(delta.getZ(i))<1e-7,'height and depth are unchanged');
      if(z<=.170||y<=.125)assert.equal(dx,0,'body remains unchanged');
      if(z>.215&&y>.165&&y<.230){oldWidth=Math.max(oldWidth,Math.abs(x));newWidth=Math.max(newWidth,Math.abs(x+dx));}
      oldEyes+=Math.abs(x);newEyes+=Math.abs(x+dx);
    }
    if(mesh.material.name==='Lucy calico coat'){
      assert(newWidth/oldWidth>.87&&newWidth/oldWidth<.94);coat++;
    }
    if(mesh.material.name==='Hazel iris'){
      assert(newEyes/oldEyes>.80&&newEyes/oldEyes<.92);eyes++;
    }
  });
  assert(coat&&eyes);
  animateLucy(cat,{dt:.1,time:3,mode:'sleep',actionTime:3,remaining:100,yaw:0});
  cat.traverse(mesh=>{
    if(!mesh.morphTargetDictionary)return;
    assert.equal(mesh.morphTargetInfluences[mesh.morphTargetDictionary.FaceRefine],1);
    assert.equal(mesh.morphTargetInfluences[mesh.morphTargetDictionary.Blink],1);
  });
});
