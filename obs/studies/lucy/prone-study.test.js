import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {Vector3} from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {createLucy,animateLucy} from '../../src/obs/lucy.js';
import {createProneStudy,sampleProne,PRONE_DURATION} from './prone-study.js';

test('prone holds the alert lying pose and smoothly returns',()=>{
  assert.equal(sampleProne(0).weight,0);assert.equal(sampleProne(PRONE_DURATION).weight,0);
  for(const time of [2.8,4,8.5])assert.equal(sampleProne(time).weight,1);
});
test('prone geometry keeps contact, attached limbs and deterministic scrubbing',async()=>{
  const bytes=fs.readFileSync(new URL('../../public/assets/obs/lucy/lucy-cabin.glb',import.meta.url));
  const gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
  const cat=createLucy(gltf);animateLucy(cat,{dt:.1,time:0,mode:'idle',yaw:0});
  let sourceGeometry;cat.traverse(m=>{if(m.material?.name==='Lucy calico coat')sourceGeometry=m.geometry;});
  const sourceIndices=sourceGeometry.attributes.skinIndex.array.slice(),sourceWeights=sourceGeometry.attributes.skinWeight.array.slice();
  const prone=createProneStudy(cat);
  const coat=prone.coat,a=coat.geometry.attributes.position,p=new Vector3(),original=a.array.slice();
  let low=Infinity,maxStep=0,last=null,gap=0,worst;
  for(let frame=0;frame<=720;frame++){
    prone.update(frame/60);coat.skeleton.update();const points=[];
    for(let i=0;i<a.count;i++){
      const v=coat.getVertexPosition(i,p).applyMatrix4(coat.matrixWorld).clone();points.push(v);
      assert(v.toArray().every(Number.isFinite));if(v.y<low){low=v.y;worst={frame,i};}
      if(last)maxStep=Math.max(maxStep,v.distanceTo(last[i]));
    }last=points;
    for(const chain of cat.userData.ik.iks){const b=coat.skeleton.bones;gap=Math.max(gap,b[chain.target].getWorldPosition(p).distanceTo(b[chain.effector].getWorldPosition(new Vector3())));}
  }
  console.log({low,maxStep,gap,worst});
  assert(low>=-.0021);assert(maxStep<.02);assert(gap<.003);
  prone.update(4);coat.skeleton.update();
  const world=name=>cat.getObjectByName(name).getWorldPosition(new Vector3());
  assert(world('Bone004').y>world('pelvis').y+.08,'head remains raised above the resting hip');
  assert(world('pelvis').y<.14,'hips lower too, unlike the bow stretch');
  for(const side of ['L','R']){
    assert(world('paw3_'+side).z-world('paw1_'+side).z>.16,'forepaws extend ahead of shoulders');
    assert(world('leg2_'+side).z>world('leg1_'+side).z+.07,'hind knees fold forward');
    assert(world('paw2_'+side).y-world('paw3_'+side).y<.032,'forearm rests low along the floor');
    assert(Math.abs(world('leg3_'+side).y-world('feet_'+side).y)<1e-6,'hock-to-paw segment lies horizontally');
  }
  const underside=Array(6).fill(Infinity);
  for(let i=0;i<a.count;i++){
    const v=coat.getVertexPosition(i,p).applyMatrix4(coat.matrixWorld),bin=Math.floor((v.z+.15)/.045);
    if(Math.abs(v.x)<.025&&bin>=0&&bin<underside.length)underside[bin]=Math.min(underside[bin],v.y);
  }
  console.log({underside});
  assert(underside.every(y=>y<.021),'chest-to-abdomen underside settles close to the floor');
  assert(prone.torsoVertices.length>0);
  assert.notEqual(coat.geometry,sourceGeometry,'weight correction is isolated to the prone instance');
  assert.deepEqual(sourceGeometry.attributes.skinIndex.array,sourceIndices);
  assert.deepEqual(sourceGeometry.attributes.skinWeight.array,sourceWeights);
  const changed=new Set(prone.torsoVertices);
  for(let i=0;i<a.count;i++){
    let sum=0;for(let k=0;k<4;k++){
      sum+=coat.geometry.attributes.skinWeight.getComponent(i,k);
      if(!changed.has(i)){
        assert.equal(coat.geometry.attributes.skinWeight.getComponent(i,k),sourceWeights[4*i+k]);
        assert.equal(coat.geometry.attributes.skinIndex.getComponent(i,k),sourceIndices[4*i+k]);
      }
    }
    assert(Math.abs(sum-1)<1e-5,'skin weights stay normalized');
  }
  assert.equal(coat.morphTargetInfluences[coat.morphTargetDictionary.Blink],0,'eyes stay open');
  const saved=coat.skeleton.bones.map(b=>b.matrixWorld.elements.slice());
  prone.update(10);prone.update(4);coat.skeleton.bones.forEach((b,i)=>assert.deepEqual(b.matrixWorld.elements,saved[i]));
  prone.update(0);const start=coat.skeleton.bones.map(b=>b.matrixWorld.elements.slice());
  prone.update(PRONE_DURATION);coat.skeleton.bones.forEach((b,i)=>assert.deepEqual(b.matrixWorld.elements,start[i]));
  assert.deepEqual(a.array,original);
});
