import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {Vector3} from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {createLucy,animateLucy} from '../../src/obs/lucy.js';
import {layLucyOnSide} from './side-sleep.js';
import {createSleepTailTap,sleepTailLift} from './sleep-tail-tap.js';
const base=process.env.LUCY_SLEEP_BASE_ASSET,donor=process.env.LUCY_SIDE_SLEEP_ASSET;
async function load(path){const b=fs.readFileSync(path);return new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');}

test('sleeping tail gives two small taps with long quiet pauses',()=>{
  assert.equal(sleepTailLift(0),0);
  assert.equal(sleepTailLift(4),0);
  assert(Math.abs(sleepTailLift(4.30)-.24)<1e-9);
  assert.equal(sleepTailLift(4.65),0);
  assert(Math.abs(sleepTailLift(5.02)-.17)<1e-9);
  for(const t of [5.4,9,16,19,28,36,47])assert.equal(sleepTailLift(t),0);
  assert(Math.abs(sleepTailLift(52.3)-sleepTailLift(4.3))<1e-10);
});

test('tip taps the floor without moving the body or deforming source vertices',{skip:!(base&&donor)},async()=>{
  const gltf=await load(base),sleep=(await load(donor)).animations.find(c=>c.name==='Sleep');
  gltf.animations=gltf.animations.map(c=>c.name==='Sleep'?sleep:c);
  const root=createLucy(gltf,{random:()=>.5});
  animateLucy(root,{dt:.1,time:2.7,actionTime:2.7,mode:'sleep',remaining:100,yaw:0});layLucyOnSide(root);
  let coat;root.traverse(m=>{if(m.material?.name==='Lucy calico coat')coat=m;});
  const original=coat.geometry.attributes.position.array.slice();
  const bones=coat.skeleton.bones.filter(b=>b.name!=='tail4'&&b.name!=='tail5');
  const matrices=bones.map(b=>b.matrixWorld.clone());
  const tap=createSleepTailTap(root);
  let low=Infinity,high=-Infinity;
  for(let step=0;step<=150;step++){
    const time=3.8+step*.012;tap.update(time);coat.skeleton.update();
    let minimum=Infinity;
    for(const i of tap.vertices){
      const p=coat.getVertexPosition(i,new Vector3()).applyMatrix4(coat.matrixWorld);
      assert(p.toArray().every(Number.isFinite));assert(p.y>=tap.contactY-1e-6,'tail skin stays above floor');
      minimum=Math.min(minimum,p.y);
    }
    low=Math.min(low,minimum);high=Math.max(high,minimum);
    bones.forEach((b,i)=>assert.deepEqual(b.matrixWorld.elements,matrices[i].elements,'do not move head, torso, feet or tail base'));
  }
  assert(Math.abs(low-tap.contactY)<1e-6,'tail actually returns to floor');
  assert(high-low>.003&&high-low<.045,'small visible lift');
  assert.deepEqual(coat.geometry.attributes.position.array,original);
  tap.update(9);const resting=root.getObjectByName('tail4').quaternion.clone();
  tap.update(17.3);tap.update(19);assert.deepEqual(root.getObjectByName('tail4').quaternion.toArray(),resting.toArray(),'no accumulating drift');
  console.log({contactAngle:tap.contactAngle,minHeight:low,maxHeight:high});
  tap.dispose();
});
