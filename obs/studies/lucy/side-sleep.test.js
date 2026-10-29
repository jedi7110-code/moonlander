import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { createLucy, animateLucy } from '../../src/obs/lucy.js';
import { layLucyOnSide, addSideSleepBreathing } from './side-sleep.js';
import { restSleepingRightForepaw } from './sleep-forepaw.js';
import { addLucyPawPads } from './paw-pads.js';
const base = process.env.LUCY_SLEEP_BASE_ASSET;
const donor = process.env.LUCY_SIDE_SLEEP_ASSET;
async function load(path) {
  const b = fs.readFileSync(path);
  return new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength), '');
}
test('side sleeping preserves the coat and bone lengths while grounding the contact pose', {skip: !(base && donor)}, async () => {
  const gltf = await load(base), sleep = (await load(donor)).animations.find(c => c.name === 'Sleep');
  assert(sleep);
  const originals = gltf.animations.slice();
  gltf.animations = gltf.animations.map(c => c.name === 'Sleep' ? sleep : c);
  originals.forEach((c, i) => {if(c.name !== 'Sleep') assert.equal(gltf.animations[i], c);});
  const root = createLucy(gltf, {random: () => .5});
  let coat;
  root.traverse(m => {if(m.material?.name === 'Lucy calico coat') coat = m;});
  const originalPositions = coat.geometry.attributes.position.array.slice();
  animateLucy(root, {dt: .1, time: 2.7, actionTime: 2.7, mode: 'sleep', remaining: 100, yaw: 0});
  const jointPositions = coat.skeleton.bones.filter(b => !b.name.includes('control')).map(b => [b, b.position.clone()]);
  layLucyOnSide(root);
  addLucyPawPads(root); // Repeated attachment must not double the pads.
  const pads=[];root.traverse(m=>{if(m.name.startsWith('Lucy paw pad ')) pads.push(m);});
  assert.equal(pads.length,20,'one central and four toe pads on each of four soles');
  for(const pad of pads) {
    assert(pad.isSkinnedMesh);
    assert.equal(pad.skeleton,coat.skeleton);
    assert.equal(pad.morphTargetInfluences,coat.morphTargetInfluences,'pads follow the same surface morphs');
    assert.equal(pad.material.color.getHex(),0xc98c91);
    const a=pad.geometry.attributes;
    for(let i=0;i<a.position.count;i++) {
      const weight=[0,1,2,3].reduce((s,k)=>s+a.skinWeight.array[i*4+k],0);
      assert(Math.abs(weight-1)<1e-6);
      assert(a.position.getY(i)<.025,'all pink patches are on the soles, not the tops of the feet');
      const p=pad.getVertexPosition(i,new Vector3()).applyMatrix4(pad.matrixWorld);
      assert(p.toArray().every(Number.isFinite));
      assert(p.y>=-.002,'pads must not undo the floor contact correction');
    }
    assert(a.normal.getY(0)<0,'the pad surface faces out of the sole');
  }
  for(const [bone, position] of jointPositions) assert(bone.position.equals(position), `${bone.name}: joint lengths are not shortened`);
  for(const label of ['L','R']) {
    const lid=root.getObjectByName('Sleeping eyelid '+label);
    assert(lid?.isSkinnedMesh && lid.visible, 'each eye has a filled lid surface');
    const a=lid.geometry.attributes, edges=new Map(),index=lid.geometry.index;
    for(let i=0;i<index.count;i+=3){
      const tri=[index.getX(i),index.getX(i+1),index.getX(i+2)];
      for(let j=0;j<3;j++){
        const key=[tri[j],tri[(j+1)%3]].sort((a,b)=>a-b).join(',');
        edges.set(key,(edges.get(key)??0)+1);
      }
    }
    assert.equal([...edges.values()].filter(count=>count===1).length,64,'only the outer rim is open; no holes inside the lid');
    for(let i=0;i<a.position.count;i++){
      assert.equal(lid.skeleton.bones[a.skinIndex.getX(i)].name,'Bone004');
      assert.equal(a.skinWeight.getX(i),1);
      assert(new Vector3().fromBufferAttribute(a.position,i).toArray().every(Number.isFinite));
      assert(Math.abs(new Vector3().fromBufferAttribute(a.normal,i).length()-1)<1e-5);
    }
  }
  root.traverse(mesh=>{
    if(['Hazel iris','Pupils and eye margin'].includes(mesh.material?.name)) assert.equal(mesh.visible,false);
  });
  const minima = {};
  root.traverse(m => {
    if(!m.isSkinnedMesh) return;
    m.skeleton.update();
    for(let i = 0; i < m.geometry.attributes.position.count; i++) {
      const source = new Vector3().fromBufferAttribute(m.geometry.attributes.position, i);
      const p = m.getVertexPosition(i, new Vector3()).applyMatrix4(m.matrixWorld);
      assert(p.toArray().every(Number.isFinite));
      const key = m === coat ? (source.z > .22 ? 'head' : source.z < -.05 ? 'tail' : source.y > .1 ? 'body' : 'feet') : m.material.name;
      minima[key] = Math.min(minima[key] ?? Infinity, p.y);
    }
  });
  console.log('Side-sleep floor clearances:', minima);
  assert.deepEqual(coat.geometry.attributes.position.array, originalPositions);
  assert(Math.abs(root.rotation.z - Math.PI / 2) < .16, 'only a small change to the side roll');
  for(const key of ['body', 'head', 'feet', 'tail']) assert(minima[key] >= -.002, key);
  assert(minima.body < 0, 'supporting skin is within 2 mm of the real floor');
  assert(minima.head < .005, 'head is lowered rather than held up');
  assert(minima.feet < .005, 'lower paws rest on the supporting plane');
  const regional = {chest:Infinity, abdomen:Infinity, hip:Infinity};
  for(let i=0;i<coat.geometry.attributes.position.count;i++) {
    const source = new Vector3().fromBufferAttribute(coat.geometry.attributes.position,i);
    if(source.y<=.130 || source.z<=-.060 || source.z>=.225) continue;
    const key=source.z>.110?'chest':source.z>.020?'abdomen':'hip';
    const p=coat.getVertexPosition(i,new Vector3()).applyMatrix4(coat.matrixWorld);
    regional[key]=Math.min(regional[key],p.y+.002);
  }
  console.log('Actual torso regional floor gaps:',regional);
  assert(regional.chest<.007 && regional.hip<.007, 'both rib cage and hip support the pose, not just a single lowest point');
  assert(regional.abdomen<.015, 'the waist gap is less than half the former 28 mm clearance');
  const sourceGeometry = coat.geometry;
  const breathe = addSideSleepBreathing(root);
  assert.notEqual(coat.geometry, sourceGeometry);
  breathe(1.9);
  let moved = 0;
  for(let i = 0; i < originalPositions.length; i += 3) {
    const delta = coat.geometry.attributes.position.array[i] - originalPositions[i];
    assert(delta >= -1e-8 && delta < .0014, 'subtle outward breath only');
    if(originalPositions[i] <= -.020) assert.equal(delta, 0, 'supporting flank stays fixed');
    if(delta > .00001) moved++;
  }
  assert(moved > 100);
  breathe(3.8);
  assert.deepEqual(coat.geometry.attributes.position.array, originalPositions);
  assert.deepEqual(sourceGeometry.attributes.position.array, originalPositions);
  const permitted = new Set(['paw2_R','paw3_R','paw_control_R','Lucy contact paw3_R']);
  const fixed = coat.skeleton.bones.filter(b=>!permitted.has(b.name)).map(b=>[b,b.matrixWorld.clone()]);
  const rootMatrix = root.matrixWorld.clone();
  restSleepingRightForepaw(root);
  assert.deepEqual(root.matrixWorld.elements,rootMatrix.elements,'do not lower the whole cat to ground one paw');
  for(const [bone,matrix] of fixed) assert.deepEqual(bone.matrixWorld.elements,matrix.elements,`${bone.name} stays fixed`);
  coat.skeleton.update();
  const paw = root.getObjectByName('paw3_R'), pawIndex = coat.skeleton.bones.indexOf(paw);
  const a = coat.geometry.attributes;let toe = Infinity, toeVertices = 0;
  for(let i=0;i<a.position.count;i++) {
    let weight = 0;
    for(let k=0;k<4;k++) if(a.skinIndex.array[i*4+k] === pawIndex) weight += a.skinWeight.array[i*4+k];
    const p = coat.getVertexPosition(i,new Vector3()).applyMatrix4(coat.matrixWorld);
    assert(p.y >= -.002,'right-paw adjustment must not push any coat below the floor');
    if(weight>.001 && a.position.getZ(i)>.157) {toe=Math.min(toe,p.y);toeVertices++;}
  }
  assert(toeVertices>20);
  assert(toe+.002<.0015,'right front toe rests within 1.5 mm of the floor');
  assert(paw.getWorldPosition(new Vector3()).distanceTo(root.getObjectByName('Lucy contact paw3_R').getWorldPosition(new Vector3()))<.00001,'the wrist stays attached');
  assert.deepEqual(coat.geometry.attributes.position.array,originalPositions);
});
