import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {BufferGeometry,BufferGeometryLoader,Float32BufferAttribute,Mesh,Vector3} from 'three';
import {headGeometry} from '../src/obs/head.js';
import {trimSuppliedNape} from '../src/obs/supplied-hair.js';
import {growthAtDay,studyDate,addHairGrowthTargets,setHairGrowth,createGrowingBeard,beardCoverage} from '../studies/milo/growth-model.js';

test('growth is continuous from unchanged DAY 1 and capped at DAY 15',()=>{
  assert.deepEqual(growthAtDay(1),{day:1,progress:0,beardMm:0});
  let previous=growthAtDay(1);
  for(let day=1.1;day<=15;day+=.1){const current=growthAtDay(day);assert.ok(current.progress>previous.progress);assert.ok(current.beardMm>previous.beardMm);previous=current;}
  assert.equal(growthAtDay(8).progress,.5);assert.equal(growthAtDay(15).progress,1);
  assert.deepEqual(growthAtDay(-1),growthAtDay(1));assert.deepEqual(growthAtDay(30),growthAtDay(15));
  assert.deepEqual(growthAtDay('invalid'),growthAtDay(1));
});

test('the date advances across month, year and leap-day boundaries without local timezone drift',()=>{
  assert.equal(studyDate('2026-09-24',1),'2026-09-24');assert.equal(studyDate('2026-09-24',15),'2026-10-08');
  assert.equal(studyDate('2026-12-31',2),'2027-01-01');assert.equal(studyDate('2028-02-28',2),'2028-02-29');
  assert.equal(studyDate('2026-02-28',2),'2026-03-01');assert.equal(studyDate('2026-02-30',1),null);
  assert.equal(studyDate('2026-09-24',4.9),'2026-09-27');
});

test('hair follows the existing bent strand with fixed roots, rather than scaling or inflating',()=>{
  // A card grows upward, then bends forward. Root V=1, tip V=0.
  const geometry=new BufferGeometry();
  geometry.setAttribute('position',new Float32BufferAttribute([-.1,0,0,.1,0,0,-.1,1,0,.1,1,0,-.1,1,1,.1,1,1],3));
  geometry.setAttribute('uv',new Float32BufferAttribute([0,1,1,1,0,.5,1,.5,0,0,1,0],2));
  geometry.setIndex([0,1,2,1,3,2,2,3,4,3,5,4]);geometry.computeVertexNormals();
  addHairGrowthTargets(geometry);const mesh=new Mesh(geometry);
  const sample=(i,progress)=>{
    setHairGrowth(mesh,progress);const p=new Vector3().fromBufferAttribute(geometry.attributes.position,i),result=p.clone();
    mesh.morphTargetInfluences.forEach((weight,j)=>result.addScaledVector(new Vector3().fromBufferAttribute(geometry.morphAttributes.position[j],i).sub(p),weight));
    return result;
  };
  for(const progress of [0,.2,.5,.8,1]){
    assert.ok(sample(0,progress).distanceTo(new Vector3(-.1,0,0))<1e-7);
    assert.ok(sample(1,progress).distanceTo(new Vector3(.1,0,0))<1e-7);
  }
  assert.ok(sample(4,0).distanceTo(new Vector3(-.1,.28,0))<1e-6);
  assert.ok(sample(4,(.5-.14)/.86).distanceTo(new Vector3(-.1,1,0))<1e-6);
  assert.ok(sample(4,1).distanceTo(new Vector3(-.1,1,1))<1e-6);
  geometry.dispose();mesh.material.dispose();
});

test('DAY 15 exactly retains the approved supplied model and survives backwards scrubbing',async()=>{
  const data=JSON.parse(await readFile(new URL('../public/assets/obs/head/supplied-hair/hair-solid.json',import.meta.url),'utf8'));
  const source=new BufferGeometryLoader().parse(data),geometry=trimSuppliedNape(source);
  const original=Object.fromEntries(['position','normal','uv'].map(key=>[key,geometry.attributes[key].array.slice()]));
  addHairGrowthTargets(geometry);const mesh=new Mesh(geometry);
  for(const [key,values]of Object.entries(original))assert.deepEqual(geometry.attributes[key].array,values);
  for(const targets of Object.values(geometry.morphAttributes))for(const target of targets)for(const value of target.array)assert.ok(Number.isFinite(value));
  setHairGrowth(mesh,.36);const first=mesh.morphTargetInfluences.slice();
  setHairGrowth(mesh,.83);setHairGrowth(mesh,.36);assert.deepEqual(mesh.morphTargetInfluences,first);
  setHairGrowth(mesh,1);assert.ok(mesh.morphTargetInfluences.every(value=>value===0),'DAY 15 renders the untouched original geometry');
  const max=mesh.geometry.morphAttributes.position[0].array.reduce((v,n,i)=>Math.max(v,Math.abs(n-original.position[i])),0);
  assert.ok(max>.1,'the transition changes strand length');
  source.dispose();geometry.dispose();mesh.material.dispose();
});

test('the accepted beard avoids eyes and lips and leaves the face mesh unchanged',async()=>{
  const data=await readFile(new URL('../public/assets/obs/head/LeePerrySmith.glb',import.meta.url));
  const gltf=await new GLTFLoader().parseAsync(data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength),'');
  const scalp=headGeometry(gltf.scene.getObjectByName('LeePerrySmith').geometry),before=scalp.attributes.position.array.slice();
  assert.equal(beardCoverage(0,1.7,2.2),0);assert.equal(beardCoverage(-.11,.44,2.2),0);
  const beard=createGrowingBeard(scalp);assert.equal(beard.mesh.visible,false);assert.ok(beard.mesh.geometry.attributes.position.count>0);
  beard.setProgress(1);assert.equal(beard.mesh.visible,true);beard.setProgress(0);assert.equal(beard.mesh.visible,false);
  assert.deepEqual(scalp.attributes.position.array,before);
  scalp.dispose();beard.mesh.geometry.dispose();beard.mesh.material.dispose();
});
