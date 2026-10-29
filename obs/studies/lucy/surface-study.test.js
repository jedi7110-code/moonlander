import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {Vector3} from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {createLucy,animateLucy} from '../../src/obs/lucy.js';
const file=process.env.LUCY_SURFACE_STUDY_ASSET;
const options={skip:!file&&'Set LUCY_SURFACE_STUDY_ASSET to the finalized candidate'};
async function cat(){const b=fs.readFileSync(file);return createLucy(await new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),''),{random:()=>.5});}
function points(root){
  root.updateMatrixWorld(true);const result=[];
  root.traverse(m=>{if(!m.isSkinnedMesh)return;m.skeleton.update();for(let i=0;i<m.geometry.attributes.position.count;i++)result.push({source:new Vector3().fromBufferAttribute(m.geometry.attributes.position,i),p:m.getVertexPosition(i,new Vector3()).applyMatrix4(m.matrixWorld)});});
  return result;
}
test('surface study lowers the hind midfoot underside, keeps head and forepaws, and removes the shoulder ridge',options,async()=>{
  const root=await cat();animateLucy(root,{dt:.1,time:9,mode:'look',actionTime:9,remaining:100,yaw:0});
  const after=points(root);let count=0;
  root.traverse(m=>{for(const name of ['SitSurface','SitHocks']){
    const index=m.morphTargetDictionary?.[name];if(index===undefined)continue;
    assert.equal(m.morphTargetInfluences[index],1);m.morphTargetInfluences[index]=0;count++;
  }});
  assert(count>0);const before=points(root);
  const heel=before.map((row,i)=>({...row,i})).filter(({source,p})=>source.x>.016&&source.z<.055&&source.z>-.060&&source.y<.044&&p.z<-.105&&p.y<.085);
  assert(heel.length>10);
  const oldMin=Math.min(...heel.map(({p})=>p.y)),newMin=Math.min(...heel.map(({i})=>after[i].p.y));
  assert(oldMin>.014&&newMin<.005,`${oldMin} -> ${newMin}: ground the hock-side underside`);
  assert(Math.max(...heel.map(({i})=>after[i].p.y))-newMin>.009,'keep foot thickness');
  let shoulderShift=0;
  for(let i=0;i<after.length;i++){
    const {source,p}=before[i],q=after[i].p;
    assert(q.toArray().every(Number.isFinite)&&q.y>-.001);
    if(source.z>=.240||(source.z>.08&&source.y<.030))assert(q.distanceTo(p)<1e-6,'preserve face and forepaw contact');
    if(source.z>.06&&p.y>.15&&p.y<.32)shoulderShift=Math.max(shoulderShift,q.distanceTo(p));
  }
  assert(shoulderShift>.025&&shoulderShift<.055,'reshape the hanging junction, not just shade over it');
});
test('new surface correctives clear the ground during seated actions and release in standing',options,async()=>{
  const root=await cat();
  for(const mode of ['look','groom','play','idle']){
    root.userData.initialized=false;
    for(let i=0;i<=120;i++){
      animateLucy(root,{dt:.1,time:i*.1,mode,actionTime:i*.1,remaining:Math.max(0,12-i*.1),yaw:0});
      assert(points(root).every(({p})=>p.toArray().every(Number.isFinite)&&p.y>-.001),mode);
    }
    if(mode==='idle')root.traverse(m=>{for(const name of ['SitSurface','SitHocks']){const index=m.morphTargetDictionary?.[name];if(index!==undefined)assert.equal(m.morphTargetInfluences[index],0);}});
  }
});
