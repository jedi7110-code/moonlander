import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {Vector3} from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {createLucy,animateLucy} from '../../src/obs/lucy.js';

// The unapproved study is deliberately separate from the shipped GLB.
const file=process.env.LUCY_SHOULDER_STUDY_ASSET;
const options={skip:!file&&'Set LUCY_SHOULDER_STUDY_ASSET to the candidate GLB'};
async function load(){
  const bytes=fs.readFileSync(file);
  return new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
}
function points(cat){
  cat.updateMatrixWorld(true);
  const rows=[];
  cat.traverse(mesh=>{
    if(!mesh.isSkinnedMesh)return;
    mesh.skeleton.update();
    for(let i=0;i<mesh.geometry.attributes.position.count;i++){
      rows.push({source:new Vector3().fromBufferAttribute(mesh.geometry.attributes.position,i),
        p:mesh.getVertexPosition(i,new Vector3()).applyMatrix4(mesh.matrixWorld)});
    }
  });
  return rows;
}

test('study narrows the seated shoulders without flattening the central ruff or moving the feet',options,async()=>{
  const cat=createLucy(await load(),{random:()=>.5});
  animateLucy(cat,{dt:.1,time:9,mode:'look',actionTime:9,remaining:100,yaw:0});
  const after=points(cat);let morphs=0;
  cat.traverse(mesh=>{
    const index=mesh.morphTargetDictionary?.SitShoulders;
    if(index===undefined)return;
    assert.equal(mesh.morphTargetInfluences[index],1);morphs++;
    mesh.morphTargetInfluences[index]=0;
  });
  assert(morphs>0);
  const before=points(cat);
  const width=rows=>Math.max(...rows.filter(({p})=>p.y>.24&&p.y<.30).map(({p})=>Math.abs(p.x)));
  assert(width(after)<width(before)*.85,'upper shoulder width must visibly decrease');
  for(let i=0;i<after.length;i++){
    const {source,p}=after[i],old=before[i].p;
    assert(p.toArray().every(Number.isFinite));
    assert(p.y>-.001,'no foot penetration');
    if(old.y<.10||source.z>.230||Math.abs(source.x)<.009){
      assert(p.distanceTo(old)<1e-6,'protect head, low feet and central throat/chest');
    }
  }
});

test('shoulder correction releases for standing and stays finite throughout seated movement',options,async()=>{
  const cat=createLucy(await load(),{random:()=>.5});
  for(const mode of ['look','groom','play','idle']){
    cat.userData.initialized=false;
    for(let i=0;i<=100;i++){
      animateLucy(cat,{dt:.1,time:i*.1,mode,actionTime:i*.1,remaining:100,yaw:0});
      const rows=points(cat);
      assert(rows.every(({p})=>p.toArray().every(Number.isFinite)&&p.y>-.001),mode);
    }
    if(mode==='idle')cat.traverse(mesh=>{
      const index=mesh.morphTargetDictionary?.SitShoulders;
      if(index!==undefined)assert.equal(mesh.morphTargetInfluences[index],0);
    });
  }
});
