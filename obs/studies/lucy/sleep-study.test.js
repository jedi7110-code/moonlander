import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {Box3,Vector3} from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {createLucy,animateLucy} from '../../src/obs/lucy.js';
import {createSleepSurface} from './sleep-surface.js';
const base=process.env.LUCY_SLEEP_BASE_ASSET,donor=process.env.LUCY_SLEEP_STUDY_ASSET;
const options={skip:!(base&&donor)&&'Set LUCY_SLEEP_BASE_ASSET and LUCY_SLEEP_STUDY_ASSET'};
async function load(path){const b=fs.readFileSync(path);return new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');}
async function setup(candidate){
  const gltf=await load(base),original=gltf.animations.slice();
  if(candidate){const sleep=(await load(donor)).animations.find(c=>c.name==='Sleep');assert(sleep);gltf.animations=gltf.animations.map(c=>c.name==='Sleep'?sleep:c);}
  for(let i=0;i<original.length;i++)if(original[i].name!=='Sleep')assert.equal(gltf.animations[i],original[i]);
  const root=createLucy(gltf,{random:()=>.5});return {root,surface:candidate?createSleepSurface(root):null};
}
function pose(root,t){animateLucy(root,{dt:.1,time:t,actionTime:t,remaining:100,mode:'sleep',yaw:0});}
test('curled sleeping folds the footprint and brings the head toward the haunches',options,async()=>{
  const ratios=[],distances=[];
  for(const candidate of [false,true]){
    const {root,surface}=await setup(candidate);pose(root,2.7);surface?.update();root.updateMatrixWorld(true);
    const box=new Box3();root.traverse(m=>{if(!m.isMesh||!m.visible||m.material.name!=='Lucy calico coat')return;if(m.isSkinnedMesh)m.skeleton.update();
      for(let i=0;i<m.geometry.attributes.position.count;i++){
        const source=new Vector3().fromBufferAttribute((surface?.source??m).geometry.attributes.position,i);if(source.z<-.04)continue;
        box.expandByPoint(m.getVertexPosition(i,new Vector3()).applyMatrix4(m.matrixWorld));
      }
    });
    const size=box.getSize(new Vector3());ratios.push(Math.min(size.x,size.z)/Math.max(size.x,size.z));
    const head=root.getObjectByName('Bone004').getWorldPosition(new Vector3()),hip=root.getObjectByName('pelvis').getWorldPosition(new Vector3());head.y=hip.y=0;distances.push(head.distanceTo(hip));
  }
  assert(ratios[1]>ratios[0]*1.35,`round footprint ${ratios}`);
  assert(distances[1]<distances[0]*.8,`head tucked ${distances}`);
});
test('sleep surface stays connected, grounded and finite while preserving the source and other modes',options,async()=>{
  const {root,surface}=await setup(true),a=surface.source.geometry.attributes,saved=a.position.array.slice();
  for(const t of [2.2,2.7,3.3,4,4.7,5.2]){
    pose(root,t);surface.update();root.updateMatrixWorld(true);
    const p=new Vector3(),q=new Vector3(),v=new Vector3();
    for(let i=0;i<a.position.count;i++){
      q.fromBufferAttribute(surface.display.geometry.attributes.position,i);assert(q.toArray().every(Number.isFinite));
      p.copy(q).applyMatrix4(surface.display.matrixWorld);assert(p.y>=.002-1e-5,'supporting plane');
      v.fromBufferAttribute(a.position,i);if(v.z>=.225){surface.source.getVertexPosition(i,p);assert(p.distanceTo(q)<1e-7,'keep face geometry');}
      const normal=new Vector3().fromBufferAttribute(surface.display.geometry.attributes.normal,i);assert(Math.abs(normal.length()-1)<1e-5);
    }
  }
  assert.deepEqual(a.position.array,saved);
  for(const mode of ['look','groom','idle']){root.userData.initialized=false;animateLucy(root,{dt:.1,time:9,actionTime:9,mode,remaining:100,yaw:0});surface.update();assert(surface.source.visible&&!surface.display.visible);}
  surface.dispose();assert.equal(surface.display.parent,null);
});
