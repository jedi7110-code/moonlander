import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {loadMiloBody} from '../src/obs/milo-body.js';
import {createMilo} from '../src/obs/characters.js';
import {headGeometry,MILO_HEAD_FORWARD} from '../src/obs/head.js';
import {createVanity,createGroomingTools,prepareGroomingMotion,sampleGrooming,TOOL_GRIP,VANITY,GROOMING_DURATION} from '../studies/milo/grooming-model.js';
import {growthCycleAtDay,studyDate} from '../studies/milo/growth-model.js';

await loadMiloBody(`data:application/json;base64,${(await readFile(new URL('../public/assets/obs/milo/body.json',import.meta.url))).toString('base64')}`);
const bytes=await readFile(new URL('../public/assets/obs/head/LeePerrySmith.glb',import.meta.url));
const gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
const makeMaterials=()=>new Proxy({},{get:(o,k)=>o[k]??=new THREE.MeshStandardMaterial()});
function fixture(){
  const m=makeMaterials(),metals={shell:m.dark,alloy:m.metal},head=new THREE.Group();head.scale.setScalar(.055);head.userData.faceForward=MILO_HEAD_FORWARD;
  const face=new THREE.Mesh(headGeometry(gltf.scene.getObjectByName('LeePerrySmith').geometry,MILO_HEAD_FORWARD/.055),m.skin);face.name='Milo scanned head';head.add(face);
  const root=createMilo(m,head),station=createVanity(m,metals),tools=createGroomingTools(root.userData.body,m,metals),motion=prepareGroomingMotion(root,station,tools);
  return{root,station,tools,motion};
}

// Index triangle projections in Y/Z, then cast +X against only that cell.
// This tests the deformed skin against actual surfaces without millions of
// full-mesh Raycaster scans. A nearest outward-facing exit means "inside".
function insideSurface(geometry,cell,tolerance){
  const p=geometry.attributes.position,idx=geometry.index,cells=new Map(),count=idx?.count??p.count;
  for(let i=0;i<count;i+=3){
    const ids=[0,1,2].map(k=>idx?idx.getX(i+k):i+k),a=new THREE.Vector3().fromBufferAttribute(p,ids[0]),b=new THREE.Vector3().fromBufferAttribute(p,ids[1]),c=new THREE.Vector3().fromBufferAttribute(p,ids[2]);
    const dy1=b.y-a.y,dz1=b.z-a.z,dy2=c.y-a.y,dz2=c.z-a.z,den=dy1*dz2-dz1*dy2;
    if(Math.abs(den)<1e-12)continue;
    const triangle={a,dx1:b.x-a.x,dx2:c.x-a.x,dy1,dz1,dy2,dz2,den};
    for(let y=Math.floor(Math.min(a.y,b.y,c.y)/cell);y<=Math.floor(Math.max(a.y,b.y,c.y)/cell);y++)for(let z=Math.floor(Math.min(a.z,b.z,c.z)/cell);z<=Math.floor(Math.max(a.z,b.z,c.z)/cell);z++){
      const key=y+','+z;if(!cells.has(key))cells.set(key,[]);cells.get(key).push(triangle);
    }
  }
  return point=>{
    const triangles=cells.get(Math.floor(point.y/cell)+','+Math.floor(point.z/cell));if(!triangles)return false;
    let nearest=Infinity,outward=false,leftNearest=Infinity,leftOutward=false;
    for(const f of triangles){
      const dy=point.y-f.a.y,dz=point.z-f.a.z,b=(dy*f.dz2-dz*f.dy2)/f.den,c=(f.dy1*dz-f.dz1*dy)/f.den;
      if(b<0||c<0||b+c>1)continue;
      const distance=f.a.x+b*f.dx1+c*f.dx2-point.x;
      if(distance>=0&&distance<nearest){nearest=distance;outward=f.den>0;}
      if(distance<=0&&-distance<leftNearest){leftNearest=-distance;leftOutward=f.den<0;}
    }
    return outward&&leftOutward&&nearest>tolerance&&leftNearest>tolerance;
  };
}

test('DAY 16 and DAY 31 reset appearance without resetting the calendar',()=>{
  assert.equal(growthCycleAtDay(15).progress,1);
  assert.equal(growthCycleAtDay(16).progress,0);assert.equal(growthCycleAtDay(16).cycle,2);
  assert.equal(growthCycleAtDay(17).day,2);assert.equal(growthCycleAtDay(30).progress,1);
  assert.equal(growthCycleAtDay(31).progress,0);assert.equal(growthCycleAtDay(31).resetDay,31);
  assert.equal(studyDate('2026-09-24',16),'2026-10-09');assert.equal(studyDate('2026-09-24',31),'2026-10-24');
});

test('hair is cut first, beard is shaved afterwards, and both remain reset on exit',()=>{
  assert.deepEqual([sampleGrooming(0).hair,sampleGrooming(0).beard],[1,1]);
  assert.ok(sampleGrooming(15).hair<1);assert.equal(sampleGrooming(15).beard,1);
  assert.equal(sampleGrooming(15).hair,sampleGrooming(21).hair,'haircut pauses during the handover');
  assert.equal(sampleGrooming(29).hair,0);assert.equal(sampleGrooming(29).beard,1);
  assert.ok(sampleGrooming(38).beard>0&&sampleGrooming(38).beard<1);
  assert.deepEqual([sampleGrooming(46).hair,sampleGrooming(46).beard],[0,0]);
  assert.equal(sampleGrooming(GROOMING_DURATION).done,true);
});

test('tools stay in the palm throughout use and return to their charging docks',()=>{
  const {root,station,tools,motion}=fixture();let maxGripError=0;
  for(let time=0;time<=GROOMING_DURATION;time+=.05){
    const state=motion.update(time),t=state.motionTime;root.updateMatrixWorld(true);station.root.updateMatrixWorld(true);
    assert.equal(root.position.y,VANITY.floor);
    const contacts=[];
    if(t>=7&&t<=17.5)contacts.push([0,'clipper',-.032*THREE.MathUtils.smoothstep(t,15,16.5)]);
    if(t>=17.5&&t<=28.3)contacts.push([1,'clipper',.055*(1-THREE.MathUtils.smoothstep(t,18.5,19))]);
    if(t>=31&&t<=44.3)contacts.push([0,'shaver',0]);
    for(const [side,name,offset] of contacts){
      const rig=root.userData.arms[side],contact=rig.hand.localToWorld(TOOL_GRIP.clone()),tool=tools[name].localToWorld(new THREE.Vector3(0,offset,0));
      const error=contact.distanceTo(tool);maxGripError=Math.max(maxGripError,error);
      assert.ok(error<.002,`${name} loses hand contact at ${t.toFixed(2)}s: ${error.toFixed(5)}m`);
      const bend=rig.hand.position.clone().normalize().angleTo(new THREE.Vector3(0,-1,0).applyQuaternion(rig.hand.quaternion));
      assert.ok(bend<.06,`wrist folds backwards at ${t.toFixed(2)}s: ${bend}`);
    }
    for(const rig of root.userData.arms){
      if(!state.moving)assert.ok(rig.arm.position.distanceTo(new THREE.Vector3(rig.side*.207,1.488,0))<1e-8,`shoulder remains attached at ${t}: ${rig.arm.position.toArray()}`);
      for(const joint of [rig.arm,rig.elbow,rig.hand])assert.ok(joint.quaternion.toArray().every(Number.isFinite));
    }
    if(state.phase==='leave')for(const id of ['clipper','shaver']){
      assert.ok(tools[id].getWorldPosition(new THREE.Vector3()).distanceTo(station.docks[id].getWorldPosition(new THREE.Vector3()))<1e-7);
    }
  }
  assert.ok(maxGripError<.002);motion.dispose();
});

test('seeking and replaying produce the same pose with no stale arm or tool transforms',()=>{
  const {root,tools,motion}=fixture();
  const sample=()=>[...root.userData.arms.flatMap(rig=>[rig.arm,rig.elbow,rig.hand]),tools.clipper,tools.shaver].map(node=>[...node.position.toArray(),...node.quaternion.toArray()]);
  motion.update(14);const original=sample();motion.update(46);motion.update(0);motion.update(14);
  assert.deepEqual(sample(),original);motion.dispose();
});

test('both arms keep a single elbow hinge and move continuously through pickup, handover and return',()=>{
  const {root,motion}=fixture();let previous=null;
  for(let frame=330;frame<=2820;frame++){
    const t=frame/60;motion.update(t);
    const rotations=root.userData.arms.flatMap(rig=>{
      assert.ok(Math.abs(rig.elbow.rotation.y)<1e-8&&Math.abs(rig.elbow.rotation.z)<1e-8,'elbow bends about one axis');
      assert.ok(rig.elbow.rotation.x<0&&rig.elbow.rotation.x>-2.8,`elbow flexion at ${t}`);
      return [rig.arm,rig.elbow,rig.hand].map(j=>j.quaternion.clone());
    });
    if(previous)rotations.forEach((q,i)=>assert.ok(q.angleTo(previous[i])<.15,`joint ${i} snaps at ${t.toFixed(3)}s by ${q.angleTo(previous[i])}`));
    previous=rotations;
  }
  motion.update(17.5);root.updateMatrixWorld(true);
  const hands=root.userData.arms.map(r=>r.hand.localToWorld(TOOL_GRIP.clone()));
  assert.ok(hands[0].distanceTo(hands[1])>.08,'hands grasp different parts of the handle during transfer');
  motion.dispose();
});

test('actual skinned arms and hands remain outside the torso and scanned head throughout grooming',()=>{
  const {root,motion}=fixture(),{body,head,bodySkin:skin}=root.userData;
  const face=head.getObjectByName('Milo scanned head'),source=skin.geometry.attributes,vertices=[],torsoPositions=[];
  const point=new THREE.Vector3(),headPoint=new THREE.Vector3();
  motion.update(0);root.updateMatrixWorld(true);skin.skeleton.update();
  for(let i=0;i<source.position.count;i++)if(source.armRegion.getX(i)>.95&&source.position.getY(i)<1.34)vertices.push(i);
  const index=skin.geometry.index;
  for(let i=0;i<index.count;i+=3){
    const ids=[0,1,2].map(k=>index.getX(i+k));
    if(ids.some(id=>source.armRegion.getX(id)>.15))continue;
    for(const id of ids)torsoPositions.push(...body.worldToLocal(skin.localToWorld(skin.applyBoneTransform(id,point.fromBufferAttribute(source.position,id)))).toArray());
  }
  const torsoGeometry=new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(torsoPositions,3));
  const insideTorso=insideSurface(torsoGeometry,.012,.0005),insideHead=insideSurface(face.geometry,.20,.009);
  const frames=Array.from({length:209},(_,i)=>5.5+i*.2).filter(t=>t<=47);frames.push(11.08,23.83,33.633,39.833,45.9);
  for(const t of frames){
    motion.update(t);root.updateMatrixWorld(true);skin.skeleton.update();
    const bodyMatrix=body.matrixWorld.clone().invert().multiply(skin.matrixWorld),headMatrix=face.matrixWorld.clone().invert().multiply(skin.matrixWorld);
    for(const id of vertices){
      skin.applyBoneTransform(id,point.fromBufferAttribute(skin.geometry.attributes.position,id));headPoint.copy(point).applyMatrix4(headMatrix);point.applyMatrix4(bodyMatrix);
      assert.ok(!insideTorso(point),`arm/hand vertex ${id} enters torso at ${t.toFixed(3)}s: ${point.toArray()}, bind ${source.position.getY(id)}`);
      assert.ok(!insideHead(headPoint),`arm/hand vertex ${id} enters head at ${t.toFixed(3)}s`);
    }
  }
  torsoGeometry.dispose();motion.dispose();
});
