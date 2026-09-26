import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Group,Matrix4,MeshStandardMaterial,Vector3} from 'three';
import {createMilo,animateMilo} from '../src/obs/characters.js';
import {loadMiloBody} from '../src/obs/milo-body.js';
import {attachElbowStudy} from '../studies/milo/elbow-deformation.js';

const data=JSON.parse(await readFile(new URL('../public/assets/obs/milo/body.json',import.meta.url)));
await loadMiloBody('data:application/json;base64,'+Buffer.from(JSON.stringify(data)).toString('base64'));
function character(elbowStyle='legacy'){return createMilo(new Proxy({},{get:(o,k)=>o[k]??=new MeshStandardMaterial()}),new Group(),{elbowStyle});}
function pose(root,angle,raised=0,spread=.13){
  animateMilo(root,{time:0,moving:false,action:null});root.rotation.set(0,0,0);
  for(const rig of root.userData.arms){rig.arm.rotation.set(raised,0,rig.side*spread);rig.elbow.rotation.set(-angle*Math.PI/180,0,0);}
  root.userData.updateWristTwists();root.updateMatrixWorld(true);root.userData.bodySkin.skeleton.update();
}
function points(root){const skin=root.userData.bodySkin;return Array.from({length:skin.geometry.attributes.position.count},(_,i)=>skin.applyBoneTransform(i,new Vector3().fromBufferAttribute(skin.geometry.attributes.position,i)));}
const face=(p,[a,b,c])=>new Vector3().subVectors(p[b],p[a]).cross(new Vector3().subVectors(p[c],p[a]));
function skinNormal(skin,i){
  const a=skin.geometry.attributes,base=new Vector3().fromBufferAttribute(a.normal,i),result=new Vector3(),matrix=new Matrix4();
  for(let k=0;k<4;k++){
    const j=a.skinIndex.array[i*4+k],weight=a.skinWeight.array[i*4+k];
    if(!weight)continue;
    matrix.multiplyMatrices(skin.skeleton.bones[j].matrixWorld,skin.skeleton.boneInverses[j]);
    result.addScaledVector(base.clone().transformDirection(matrix),weight);
  }
  return result.normalize();
}
test('the study keeps the original body, tattoo UVs and bind pose intact',()=>{
  const original=character(),root=character(),skin=root.userData.bodySkin,before=skin.geometry,sourcePositions=before.attributes.position.array.slice();
  const study=attachElbowStudy(root);assert.ok(study.changed>500);
  pose(original,0,0,0);pose(root,0,0,0);
  const a=points(original),b=points(root);
  assert.ok(a.every((point,i)=>point.distanceTo(b[i])<2e-6),'rebinding the hinge must preserve the rest surface');
  assert.deepEqual(before.attributes.position.array,sourcePositions,'do not mutate the original mesh');
  assert.deepEqual(skin.geometry.index.array,before.index.array,'retain the single connected surface and triangle count');
  for(const name of ['uv','tattooUv','tattooMask','armRegion'])assert.deepEqual(skin.geometry.attributes[name].array,before.attributes[name].array);
  pose(root,140);pose(root,0);
  assert.deepEqual(skin.geometry.attributes.position.array,sourcePositions,'return exactly from deep flexion without cumulative drift');
  const weights=skin.geometry.attributes.skinWeight;
  for(let i=0;i<weights.count;i++)assert.ok(Math.abs(weights.getX(i)+weights.getY(i)+weights.getZ(i)+weights.getW(i)-1)<1e-6);
  study.dispose();assert.equal(skin.geometry,before);assert.equal(skin.skeleton.bones.length,47);
  pose(root,0,0,0);const restored=points(root);assert.ok(a.every((point,i)=>point.distanceTo(restored[i])<2e-6));
});
test('both elbow surfaces remain oriented and retain area throughout flexion',()=>{
  const root=character(),study=attachElbowStudy(root),skin=root.userData.bodySkin,attrs=skin.geometry.attributes;
  pose(root,0);const rest=points(root),triangles=[];
  for(let k=0;k<data.indices.length;k+=3){const ids=data.indices.slice(k,k+3);if(ids.every(i=>attrs.armRegion.getX(i)>.95&&attrs.position.getY(i)>1.10&&attrs.position.getY(i)<1.255))triangles.push(ids);}
  assert.ok(triangles.length>1000);
  for(const raised of [0,-1.7])for(let angle=0;angle<=140;angle+=10){
    pose(root,angle,raised);const p=points(root),normals=new Map();
    for(const ids of triangles){
      const normal=face(p,ids),areaRatio=normal.length()/face(rest,ids).length();
      assert.ok(areaRatio>.10,`collapsed elbow triangle at ${angle} degrees: ${ids}, ratio=${areaRatio}`);
      for(const i of ids)if(!normals.has(i))normals.set(i,skinNormal(skin,i));
      const outward=ids.reduce((n,i)=>n.add(normals.get(i)),new Vector3());
      assert.ok(normal.dot(outward)>0,`inside-out elbow triangle at ${angle} degrees: ${ids}`);
    }
  }
  study.dispose();
});
test('outer elbow skin no longer stretches into the old long, rounded bend',()=>{
  const roots=[character(),character()];attachElbowStudy(roots[1]);roots.forEach(root=>pose(root,0));
  const rest=roots.map(points),attrs=roots[0].userData.bodySkin.geometry.attributes,outside=[];
  for(let k=0;k<data.indices.length;k+=3){const ids=data.indices.slice(k,k+3);if(ids.every(i=>attrs.armRegion.getX(i)>.95&&attrs.position.getY(i)>1.10&&attrs.position.getY(i)<1.255&&attrs.position.getZ(i)<-.075))outside.push(ids);}
  const area=p=>outside.reduce((sum,ids)=>sum+face(p,ids).length(),0);
  roots.forEach(root=>pose(root,90));const stretch=roots.map((root,i)=>area(points(root))/area(rest[i]));
  assert.ok(stretch[1]<stretch[0]*.86,'the supported hinge reduces excessive stretching of the outer elbow');
  const rig=roots[1].userData.arms[0],before=rig.hand.getWorldPosition(new Vector3());
  for(let i=0;i<100;i++)roots[1].userData.updateWristTwists();roots[1].updateMatrixWorld(true);
  assert.ok(before.distanceTo(rig.hand.getWorldPosition(new Vector3()))<1e-8,'updating the skin cannot accumulate wrist offsets');
});
