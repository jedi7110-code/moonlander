import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {Vector3} from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {createLucy,animateLucy} from '../../src/obs/lucy.js';
import {createGroomSurface} from './groom-surface.js';
const file=process.env.LUCY_GROOM_STUDY_ASSET;
const options={skip:!file&&'Set LUCY_GROOM_STUDY_ASSET to the outline candidate'};
async function setup(){
  const b=fs.readFileSync(file),root=createLucy(await new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),''),{random:()=>.5});
  return {root,surface:createGroomSurface(root)};
}
const pose=(root,t,mode='groom')=>animateLucy(root,{dt:.1,time:t,actionTime:t,mode,remaining:100,yaw:0});
test('posed grooming correction is local, bounded and leaves source assets intact',options,async()=>{
  const {root,surface}=await setup(),a=surface.source.geometry.attributes;
  const saved=a.position.array.slice(),colors=a.color.array.slice();
  let changed=0;
  for(const t of [1.6,2.2,3.7,4.6,5.8,7,8.4,9.4]){
    pose(root,t);const report=surface.update(true,{skinFit:false});
    assert(report.maxShift<=.022001&&report.maxShift>.001);
    const p=new Vector3(),q=new Vector3(),v=new Vector3();
    for(let i=0;i<a.position.count;i++){
      surface.source.getVertexPosition(i,p);q.fromBufferAttribute(surface.display.geometry.attributes.position,i);v.fromBufferAttribute(a.position,i);
      assert(q.toArray().every(Number.isFinite));
      const d=p.distanceTo(q);assert(d<.022001);
      if(v.z>=.235||v.z<=.085||v.y<=.050||v.y>=.200)assert(d<1e-7,'pin face, hips and lower limbs');
      if(d>.001)changed++;
      const n=new Vector3().fromBufferAttribute(surface.display.geometry.attributes.normal,i);
      assert(n.toArray().every(Number.isFinite)&&Math.abs(n.length()-1)<1e-5,'valid shading normal');
    }
  }
  assert(changed>100);
  assert.deepEqual(a.position.array,saved);assert.deepEqual(a.color.array,colors);
  for(const mode of ['look','idle','play']){
    root.userData.initialized=false;pose(root,9,mode);assert.equal(surface.update().weight,0);
    assert.equal(surface.source.visible,true);assert.equal(surface.display.visible,false);
  }
  surface.dispose();assert.equal(surface.display.parent,null);assert(surface.source.visible);
});
test('grooming correction reduces local surface bending at raised-paw poses',options,async()=>{
  const {root,surface}=await setup(),a=surface.source.geometry.attributes,idx=surface.source.geometry.index;
  const adjacency=Array.from({length:a.position.count},()=>new Set());
  for(let i=0;i<idx.count;i+=3){const tri=[0,1,2].map(k=>idx.getX(i+k));for(const x of tri)for(const y of tri)if(x!==y)adjacency[x].add(y);}
  function bending(points){
    let sum=0;
    for(let i=0;i<points.length;i++){
      const v=new Vector3().fromBufferAttribute(a.position,i);
      if(v.z<.135||v.z>.205||v.y<.085||v.y>.175||!adjacency[i].size)continue;
      const mean=new Vector3();for(const j of adjacency[i])mean.add(points[j]);mean.divideScalar(adjacency[i].size);
      sum+=mean.distanceToSquared(points[i]);
    }
    return sum;
  }
  for(const t of [2.2,3.7,4.6]){
    pose(root,t);surface.update(true,{skinFit:false});
    const before=Array.from({length:a.position.count},(_,i)=>surface.source.getVertexPosition(i,new Vector3()));
    const after=before.map((_,i)=>new Vector3().fromBufferAttribute(surface.display.geometry.attributes.position,i));
    assert(bending(after)<bending(before)*.85,`${t}: reduce local folds`);
  }
});
test('lower breast retracts with the solved paw lift without changing planted feet or sitting',options,async()=>{
  const {root,surface}=await setup(),a=surface.source.geometry.attributes;
  let raised=0,lowered=0;
  for(const t of [1.6,2.2,3.7,4.6,5.8,7,8.4,9.4]){
    pose(root,t);surface.update(true,{skinFit:false});
    const before=surface.display.geometry.attributes.position.array.slice();
    const report=surface.update();
    if(t===3.7)raised=report.leftLift;if(t===7)lowered=report.leftLift;
    assert(report.maxShift<=.060001);
    let retraction=0,vertices=0;
    for(let i=0;i<a.position.count;i++){
      const v=new Vector3().fromBufferAttribute(a.position,i),p=new Vector3().fromArray(before,i*3);
      const q=new Vector3().fromBufferAttribute(surface.display.geometry.attributes.position,i);
      assert(q.toArray().every(Number.isFinite));
      if(v.y<=.050||v.z>=.235||v.z<=.045)assert(p.distanceTo(q)<1e-7,'keep feet, face and hindquarters');
      if(v.z>.080&&v.z<.110&&v.y>.075&&v.y<.105&&v.x>0){retraction+=p.z-q.z;vertices++;}
    }
    if(t===3.7){assert(vertices>20);assert(retraction/vertices>.006,'remove the pendant breast volume');}
  }
  assert(raised>.9&&lowered<.1,`lift follows actual pose: ${raised} / ${lowered}`);
  root.userData.initialized=false;pose(root,9,'look');assert.equal(surface.update().weight,0);assert(surface.source.visible);
});
