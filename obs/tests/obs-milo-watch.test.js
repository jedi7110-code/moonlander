import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {BoxGeometry,LessDepth,Mesh,MeshStandardMaterial,PerspectiveCamera,Raycaster,Vector2,Vector3} from 'three';
import {loadMiloBody} from '../src/obs/milo-body.js';
import {createMilo,animateMilo} from '../src/obs/characters.js';
import {updateMiloWatch} from '../src/obs/milo-watch.js';
import {applyMocapWalk} from '../src/obs/mocap-walk.js';
import {CabinBrain} from '../src/obs/brain.js';
import {CrewMotion,Supplies} from '../src/obs/state.js';
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
  assert.equal(meshes.length,7,'one strap, one housing, one face, and four hands');
  for(const part of meshes)assert.ok([...part.geometry.attributes.position.array].every(Number.isFinite));
  assert.equal(w.group.getObjectByName('Fitted graphite watch strap').parent,w.group);
  for(const ring of w.radii){assert.equal(ring.length,64);assert.ok(ring.every(r=>r>.014&&r<.065));assert.ok(Math.max(...ring)-Math.min(...ring)>.008,'strap must follow the wrist, not a cylinder');}
  assert.equal(new Set([w.hour,w.minute,w.second,w.gmt]).size,4);
  assert.equal(w.second.rotation.z,0,'seconds hand is fixed at twelve');
});

test('watch hands match the ship HUD minute, including noon and midnight, without moving seconds',()=>{
  const root=character(),w=root.userData.watch;
  const brain=new CabinBrain({time:{delayedCall(){}},obsUI:{hideWant(){}}},new CrewMotion(),{care:new Supplies(),random:()=>.8});
  for(const hour of [0,8,8+17/60,10.5,11.99999,12,15.25,23.99999,24,24.5]){
    brain.clock=hour/24*brain.dayMs;
    const minutes=Math.floor(brain.hour*60),tau=Math.PI*2;
    animateMilo(root,{moving:false,time:987,actionTime:2,shipHour:brain.hour});
    assert.ok(Math.abs(w.hour.rotation.z+(minutes%720)/720*tau)<1e-10);
    assert.ok(Math.abs(w.minute.rotation.z+(minutes%60)/60*tau)<1e-10);
    assert.ok(Math.abs(w.gmt.rotation.z+minutes/1440*tau)<1e-10,'24-hour hand also reads ship time, with no timezone offset');
    assert.equal(w.second.rotation.z,0);
  }
});

test('the dial stack stays visible at OBS depth precision and remains hidden by foreground objects',()=>{
  const root=character(),watch=root.userData.watch;updateMiloWatch(root,0);
  const casing=watch.group.getObjectByName('GMT case 42 mm');
  casing.removeFromParent();casing.position.set(0,0,0);casing.rotation.set(0,0,0);casing.updateMatrixWorld(true);
  const parts=[];casing.traverse(part=>{if(part.isMesh)parts.push(part);});
  const camera=new PerspectiveCamera(24,1,.1,150),ray=new Raycaster(),levels=2**24-1;
  const cover=new Mesh(new BoxGeometry(.06,.06,.001),new MeshStandardMaterial());
  cover.position.z=.03;cover.updateMatrixWorld(true);
  function visibleAt(x,y,occluded=false){
    const pixel=new Vector3(x,y,.0084).project(camera);ray.setFromCamera(new Vector2(pixel.x,pixel.y),camera);
    const nearest=new Map();
    for(const hit of ray.intersectObjects(occluded?[...parts,cover]:parts,false))if(!nearest.has(hit.object))nearest.set(hit.object,hit);
    const draws=[...nearest.values()].sort((a,b)=>a.object.renderOrder-b.object.renderOrder||a.object.material.id-b.object.material.id||a.distance-b.distance);
    let depth=levels,visible=null;
    for(const hit of draws){
      const material=hit.object.material,z=Math.round((hit.point.clone().project(camera).z*.5+.5)*levels);
      const passes=material.depthFunc===LessDepth?z<depth:z<=depth;
      if(material.depthTest&&!passes)continue;
      visible=hit.object;if(material.depthWrite)depth=z;
    }
    return visible;
  }
  for(const distance of [39.997,39.999,40,40.0001,40.0002,40.001,40.003]){
    camera.position.set(0,0,distance);camera.lookAt(0,0,0);camera.updateMatrixWorld(true);
    assert.equal(visibleAt(.012,0)?.name,'GMT dial and bezel image','the metal cap must not cover the dial');
    assert.equal(visibleAt(0,.004)?.name,'Fixed seconds blade','overlapping needles retain their physical stacking order');
    assert.equal(visibleAt(0,0)?.name,'Unified steel watch housing','the pinion remains above the hands');
    assert.equal(visibleAt(0,.004,true),cover,'the watch cannot show through a foreground arm or object');
  }
  cover.geometry.dispose();cover.material.dispose();root.userData.bodySkin.skeleton.dispose();
});

test('animation resets, sub-minute ticks and pause leave the displayed watch time unchanged',async()=>{
  const root=character(),w=root.userData.watch;
  const angles=()=>[w.hour,w.minute,w.second,w.gmt].map(hand=>hand.rotation.z);
  updateMiloWatch(root,8.5);const expected=angles();
  for(const action of [null,'hydro','galley','medical','gym'])for(const time of [0,3,123]){
    animateMilo(root,{moving:false,action,time,actionTime:time,shipHour:8.5001,dt:0});
    assert.deepEqual(angles(),expected);
  }
  updateMiloWatch(root,8+31/60+.0001);
  assert.ok(Math.abs(w.minute.rotation.z-expected[1]+Math.PI*2/60)<1e-10);
  assert.ok(Math.abs((w.hour.rotation.z-expected[0])/(w.gmt.rotation.z-expected[3])-2)<1e-9);
  assert.equal(w.second.rotation.z,0);
  const source=await readFile(new URL('../src/obs/view.js',import.meta.url),'utf8');
  assert.match(source,/shipHour:brain.hour/,'the production view forwards the same clock as the HUD');
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
