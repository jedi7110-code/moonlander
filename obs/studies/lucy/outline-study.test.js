import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {Vector3} from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {createLucy,animateLucy} from '../../src/obs/lucy.js';
const file=process.env.LUCY_OUTLINE_STUDY_ASSET;
test('drawn outline broadens the neck root, narrows hips and replaces rejected flank inflation',{
  skip:!file&&'Set LUCY_OUTLINE_STUDY_ASSET to the red-line candidate',
},async()=>{
  const b=fs.readFileSync(file),gltf=await new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');
  const cat=createLucy(gltf,{random:()=>.5});
  animateLucy(cat,{dt:.1,time:9,mode:'look',actionTime:9,remaining:100,yaw:0});
  const before=[],after=[];
  cat.traverse(mesh=>{
    if(!mesh.isSkinnedMesh)return;
    assert.equal(mesh.morphTargetDictionary.SitFlanks,undefined,'remove the rejected inflation');
    const index=mesh.morphTargetDictionary.SitOutline;assert.notEqual(index,undefined);
    assert.equal(mesh.morphTargetInfluences[index],1);mesh.skeleton.update();
    const a=mesh.geometry.attributes.position,points=[];
    for(let i=0;i<a.count;i++)points.push(mesh.getVertexPosition(i,new Vector3()).applyMatrix4(mesh.matrixWorld));
    mesh.morphTargetInfluences[index]=0;
    for(let i=0;i<a.count;i++){
      const p=mesh.getVertexPosition(i,new Vector3()).applyMatrix4(mesh.matrixWorld),q=points[i];
      assert(q.toArray().every(Number.isFinite)&&q.y>-.001);
      assert(Math.abs(q.y-p.y)<1e-6&&Math.abs(q.z-p.z)<1e-6,'horizontal silhouette only');
      if(a.getZ(i)>.205||p.y<.025||p.z>.110)assert(q.distanceTo(p)<1e-6,`protect face and planted forepaws: ${JSON.stringify({i,source:[a.getX(i),a.getY(i),a.getZ(i)],p:p.toArray(),delta:q.clone().sub(p).toArray()})}`);
      if(mesh.material.name==='Lucy calico coat'&&a.getZ(i)>-.06&&a.getZ(i)<.19&&a.getY(i)>.065){before.push(p);after.push(q);}
    }
  });
  const width=(points,y)=>Math.max(...points.filter(p=>Math.abs(p.y-y)<.009).map(p=>Math.abs(p.x)));
  assert(width(after,.30)>width(before,.30)+.006,'fill the upper neck-root indentation');
  assert(width(after,.10)<width(before,.10)-.015,'draw the protruding hip inward');
  for(const [y,target] of [[.06,.075],[.10,.087],[.14,.094],[.18,.094],[.22,.084],[.26,.067],[.30,.063],[.32,.055]]){
    assert(Math.abs(width(after,y)-target)<.010,`red-line half width at ${y}: ${width(after,y)} vs ${target}`);
  }
  cat.userData.initialized=false;
  animateLucy(cat,{dt:.1,time:1,mode:'idle',actionTime:0,remaining:100,yaw:0});
  cat.traverse(m=>{const i=m.morphTargetDictionary?.SitOutline;if(i!==undefined)assert.equal(m.morphTargetInfluences[i],0);});
});
