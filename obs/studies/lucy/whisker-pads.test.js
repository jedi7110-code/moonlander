import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {Vector3} from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {createLucy,animateLucy} from '../../src/obs/lucy.js';
import {addLucyWhiskerPads,whiskerPadOffset} from './whisker-pads.js';

test('whisker cushions have two symmetric lobes, not an enlarged jaw or nose',()=>{
  for(const p of [[0,.1668,.270],[.01,.15,.27],[.01,.185,.26],[.035,.17,.25],[.01,.17,.23]])
    assert(whiskerPadOffset(...p).every(v=>v===0));
  const left=whiskerPadOffset(.0105,.1668,.268),right=whiskerPadOffset(-.0105,.1668,.268);
  assert(left[0]>.002 && left[2]>.004);
  assert.equal(left[0],-right[0]);assert.equal(left[1],right[1]);assert.equal(left[2],right[2]);
});

test('muzzle morph preserves original mesh, eyes, nose and rig, and remains active in sleep',{
  skip:!process.env.LUCY_SLEEP_BASE_ASSET,
},async()=>{
  const bytes=fs.readFileSync(process.env.LUCY_SLEEP_BASE_ASSET);
  const gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
  const cat=createLucy(gltf,{random:()=>.5}),originals=[];
  cat.traverse(m=>{if(m.isMesh) originals.push([m,m.geometry,m.geometry.attributes.position.array.slice()]);});
  addLucyWhiskerPads(cat);addLucyWhiskerPads(cat);
  let moved=0,whiskers=0;
  for(const [mesh,geometry,positions] of originals){
    assert.deepEqual(mesh.geometry.attributes.position.array,positions);
    const affected=['Lucy calico coat','Whiskers'].includes(mesh.material.name);
    if(!affected){assert.equal(mesh.geometry,geometry);continue;}
    const index=mesh.morphTargetDictionary.WhiskerPads;
    assert.equal(mesh.geometry.morphAttributes.position.length,geometry.morphAttributes.position.length+1);
    assert.equal(mesh.morphTargetInfluences[index],1);
    const a=mesh.geometry.attributes.position,d=mesh.geometry.morphAttributes.position[index];
    const dn=mesh.geometry.morphAttributes.normal[index];
    for(let i=0;i<a.count;i++){
      const change=new Vector3().fromBufferAttribute(d,i);
      if(mesh.material.name==='Lucy calico coat'){
        if(a.getY(i)<=.157||a.getY(i)>=.18||a.getZ(i)<=.243||Math.abs(a.getX(i))<=.0015)assert.equal(change.lengthSq(),0);
        assert(change.z>=0&&change.z<=.004401);
      }else if(Math.abs(a.getX(i))>=.056)assert.equal(change.lengthSq(),0,'whisker tips stay unchanged');
      const normal=new Vector3().fromBufferAttribute(mesh.geometry.attributes.normal,i).add(new Vector3().fromBufferAttribute(dn,i));
      assert(normal.toArray().every(Number.isFinite));assert(Math.abs(normal.length()-1)<1e-5);
      if(change.length()>.0001){if(mesh.material.name==='Lucy calico coat')moved++;else whiskers++;}
    }
  }
  assert(moved>60 && whiskers>20);
  animateLucy(cat,{dt:.1,time:2.7,actionTime:2.7,mode:'sleep',remaining:100,yaw:0});
  for(const [mesh] of originals)if(mesh.morphTargetDictionary.WhiskerPads!==undefined)
    assert.equal(mesh.morphTargetInfluences[mesh.morphTargetDictionary.WhiskerPads],1);
});

test('all eight whisker roots emerge from the inflated pads, below the nose',{
  skip:!process.env.LUCY_SLEEP_BASE_ASSET,
},async()=>{
  const bytes=fs.readFileSync(process.env.LUCY_SLEEP_BASE_ASSET);
  const gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
  const cat=createLucy(gltf,{random:()=>.5});addLucyWhiskerPads(cat);
  let whiskers;cat.traverse(m=>{if(m.material?.name==='Whiskers')whiskers=m;});
  const anchors=whiskers.userData.whiskerRoots;assert.equal(anchors.length,8);
  for(const anchor of anchors){
    const [x,y,z]=anchor.target;assert(y>=.164&&y<=.170001);assert(Math.abs(x)>.012&&Math.abs(x)<.014);
    assert(Math.abs(z-anchor.surfaceZ+.00012)<1e-8);
    const unique=new Map(),a=whiskers.geometry.attributes.position;
    for(const i of anchor.indices)unique.set([a.getX(i),a.getY(i),a.getZ(i)].join(','),i);
    const center=new Vector3();
    for(const i of unique.values()){
      const p=new Vector3().fromBufferAttribute(a,i);
      for(const name of ['FaceRefine','WhiskerPads'])p.add(new Vector3().fromBufferAttribute(whiskers.geometry.morphAttributes.position[whiskers.morphTargetDictionary[name]],i));
      center.add(p);
    }
    center.divideScalar(unique.size);assert(center.distanceTo(new Vector3(...anchor.target))<1e-7);
  }
  for(const mode of ['look','groom','eat','play','sleep']){
    animateLucy(cat,{dt:.1,time:9,actionTime:9,mode,remaining:100,yaw:0});whiskers.skeleton.update();
    for(const anchor of anchors)for(const i of anchor.indices){
      assert(whiskers.getVertexPosition(i,new Vector3()).toArray().every(Number.isFinite));
    }
    assert.equal(whiskers.morphTargetInfluences[whiskers.morphTargetDictionary.WhiskerPads],1);
  }
});
