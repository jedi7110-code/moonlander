import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {MeshStandardMaterial,Vector3} from 'three';
import {loadMiloBody} from '../src/obs/milo-body.js';
import {createMilo,animateMilo} from '../src/obs/characters.js';
import {updateMiloWatch} from '../src/obs/milo-watch.js';
import {applyMocapWalk} from '../src/obs/mocap-walk.js';
const bytes=await readFile(new URL('../public/assets/obs/milo/body.json',import.meta.url));
await loadMiloBody(`data:application/json;base64,${bytes.toString('base64')}`);
const clip=JSON.parse(await readFile(new URL('../src/obs/milo-walk-cycle.json',import.meta.url)));
const character=()=>createMilo(new Proxy({},{get:(o,k)=>o[k]??=new MeshStandardMaterial()}));
test('Milo wears one fitted GMT watch on the left wrist, with four independent hands',()=>{
  const root=character(),w=root.userData.watch;assert.equal(w.side,-1);
  assert.equal(w.parent,root.userData.bodySkin.skeleton.bones.find(b=>b.name==='Milo skin L_wrist2').parent);
  assert.equal(w.group.parent,w.parent);
  assert.equal(w.group.position.y,.004,'the case sits at the wrist, 15 mm closer to the hand');
  const caseGroup=w.group.getObjectByName('GMT case 42 mm');
  const twelve=new Vector3(0,1,0).applyQuaternion(caseGroup.quaternion);
  assert.ok(twelve.distanceTo(new Vector3(-1,0,0))<1e-9,'the dial is reversed 180 degrees without rotating the fitted strap');
  for(const needle of [w.hour,w.minute,w.second,w.gmt])assert.equal(needle.parent,caseGroup,'all hands turn with the dial');
  const housing=w.group.getObjectByName('Unified steel watch housing');
  assert.equal(housing.parent,caseGroup);
  housing.geometry.computeBoundingBox();
  assert.ok(housing.geometry.boundingBox.max.x>=.0239,'the crown is retained in the combined housing');
  const face=w.group.getObjectByName('GMT dial and bezel image');
  assert.equal(face.parent,caseGroup);assert.equal(face.geometry.parameters.radius,.0217);
  assert.equal(w.group.getObjectByName('24-hour bezel'),undefined,'no separate bezel draw remains');
  const meshes=[];w.group.traverse(part=>{if(part.isMesh)meshes.push(part);});
  assert.equal(meshes.length,7,'one strap, one housing, one face, and four moving hands');
  for(const part of meshes)assert.ok([...part.geometry.attributes.position.array].every(Number.isFinite));
  assert.equal(w.group.getObjectByName('Fitted graphite watch strap').parent,w.group);
  for(const ring of w.radii){assert.equal(ring.length,64);assert.ok(ring.every(r=>r>.014&&r<.065));assert.ok(Math.max(...ring)-Math.min(...ring)>.008,'strap must follow the wrist, not a cylinder');}
  assert.equal(new Set([w.hour,w.minute,w.second,w.gmt]).size,4);
  const second=w.second.rotation.z,hour=w.hour.rotation.z,gmt=w.gmt.rotation.z;
  updateMiloWatch(root,.125);
  assert.ok(Math.abs(w.second.rotation.z-second+Math.PI*2*.125/60)<1e-9,'seconds hand sweeps continuously');
  assert.ok(Math.abs((w.hour.rotation.z-hour)/(w.gmt.rotation.z-gmt)-2)<1e-6,'GMT hand rotates once per 24 hours');
});
test('the watch follows the enlarged left wrist throughout measured walking and other poses',()=>{
  const root=character(),w=root.userData.watch,local=w.group.position.clone();let first,last;
  for(let i=0;i<24;i++){
    animateMilo(root,{time:i/24,moving:false,climbing:false,facing:1});applyMocapWalk(root,clip,i/24*clip.duration);root.updateMatrixWorld(true);
    const point=w.group.getWorldPosition(new Vector3());assert.ok(point.toArray().every(Number.isFinite));assert.ok(point.y>.6&&point.y<1.3);
    assert.ok(point.distanceTo(w.parent.localToWorld(local.clone()))<1e-9);
    first??=point;last=point;
  }
  assert.ok(first.distanceTo(last)>.005);
  for(const extra of [{climbing:true,moving:true},{action:'console'},{action:'gym'},{action:'medical'}]){
    animateMilo(root,{time:2,moving:false,climbing:false,facing:1,actionTime:2,actionDuration:8,...extra});root.updateMatrixWorld(true);
    assert.ok(w.group.getWorldPosition(new Vector3()).toArray().every(Number.isFinite));assert.equal(w.group.parent,w.parent);
  }
  for(const {hand}of root.userData.arms)assert.deepEqual(hand.scale.toArray(),[1.16,1.05,1.08].map(v=>v*1.08));
});
