import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {Vector3} from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {createLucy,animateLucy,disposeLucy} from '../../src/obs/lucy.js';
import {addLucyWhiskerPads} from './whisker-pads.js';
import {addLucyPawPads} from './paw-pads.js';
import {sampleStretch,createStretchStudy,STRETCH_DURATION} from './stretch-study.js';
import {forepawSlide} from './forepaw-slide.js';

test('stretch and prone share a flat, symmetric front-paw path',()=>{
  for(let step=0;step<=100;step++){
    const w=step/100;
    for(const distance of [.142,.195]){
      const left=forepawSlide({side:'L',origin:new Vector3(.05,.02,.1),clearance:-.001},w,distance);
      const right=forepawSlide({side:'R',origin:new Vector3(-.05,.02,.1),clearance:-.001},w,distance);
      assert.equal(left.y,.019);assert.equal(right.y,.019);
      assert.equal(left.x,-right.x);assert.equal(left.z,right.z);
      assert(Math.abs((left.z-.1)/distance-w)<1e-12);
    }
  }
});

test('stretch slowly reaches, holds with closed eyes, then returns to standing',()=>{
  for(const t of [0,STRETCH_DURATION]){
    assert.equal(sampleStretch(t).weight,0);assert.equal(sampleStretch(t).eyes,0);
  }
  for(const t of [2.1,3,4.7]){
    const p=sampleStretch(t);assert.equal(p.weight,1);assert.equal(p.eyes,1);
    assert.equal(p.left,1);assert.equal(p.right,1);
  }
  assert.equal(sampleStretch(1).left,sampleStretch(1).right,'both paws slide together, like prone');
  assert.equal(sampleStretch(1.5).pull,0);
  assert(sampleStretch(.20).headPull>0,'head starts first');
  assert.equal(sampleStretch(.20).neckPull,0);
  assert.equal(sampleStretch(.20).weight,0);
  assert.equal(sampleStretch(.20).pull,0);
  assert(sampleStretch(.5).headPull>sampleStretch(.5).neckPull,'neck follows the head');
  assert.equal(sampleStretch(1.5).headPull,1);
  assert.equal(sampleStretch(1.5).neckPull,1);
  assert.equal(sampleStretch(2.6).pull,1);
  for(let t=1.5;t<=5.6;t+=.05)assert.equal(sampleStretch(t).weight,1,'no paw slide while pulling or releasing');
  assert(sampleStretch(5.5).pull>0&&sampleStretch(5.5).pull<1);
  assert(sampleStretch(6).weight>0&&sampleStretch(6).weight<1);
  assert.equal(sampleStretch(5.5).eyes,1,'keep eyes closed until returning');
});

test('stretch rig keeps its skin above the floor and all limbs attached throughout the cycle',{
  skip:!process.env.LUCY_SLEEP_BASE_ASSET,
},async()=>{
  const bytes=fs.readFileSync(process.env.LUCY_SLEEP_BASE_ASSET);
  const gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
  const cat=createLucy(gltf,{random:()=>.5});addLucyWhiskerPads(cat);addLucyPawPads(cat);
  animateLucy(cat,{dt:.1,time:0,mode:'idle',yaw:0});const stretch=createStretchStudy(cat);
  let coat;cat.traverse(m=>{if(m.material?.name==='Lucy calico coat')coat=m;});
  const a=coat.geometry.attributes.position,original=a.array.slice(),point=new Vector3();
  // Shoulder roots glide and the neck retracts; limb and head bone lengths do not change.
  const lengths=coat.skeleton.bones.filter(b=>!b.name.includes('control')&&b.name!=='CONTROLLER'&&!['Bone002','Bone004'].includes(b.name)&&!/^paw1_[LR]$/.test(b.name)).map(b=>[b,b.position.clone()]);
  const world=name=>cat.getObjectByName(name).getWorldPosition(new Vector3());
  let low=Infinity,gap=0,maxStep=0,last,planted;
  for(let frame=0;frame<=480;frame++){
    stretch.update(frame/60);coat.skeleton.update();const points=[];
    for(let i=0;i<a.count;i++){
      const p=coat.getVertexPosition(i,point).applyMatrix4(coat.matrixWorld).clone();
      assert(p.toArray().every(Number.isFinite));low=Math.min(low,p.y);
      if(last)maxStep=Math.max(maxStep,p.distanceTo(last[i]));points.push(p);
    }
    last=points;
    for(const chain of cat.userData.ik.iks){
      const b=coat.skeleton.bones;gap=Math.max(gap,world(b[chain.target].name).distanceTo(world(b[chain.effector].name)));
    }
    for(const [b,p]of lengths)assert(b.position.equals(p),b.name+' retains bone length');
    for(const f of stretch.feet)if(f.rear)assert(world(f.bone.name).distanceTo(f.origin.clone().add(new Vector3(0,f.clearance,0)))<.00001,'hind feet remain planted');
    for(const f of stretch.feet)if(!f.rear){
      const sole=Math.min(...f.vertices.map(i=>points[i].y));
      assert(Math.abs(sole+.0015)<.002,`front paw must slide on the floor at frame ${frame}: ${sole}`);
    }
    if(frame===90)planted=stretch.feet.map(f=>world(f.bone.name));
    if(frame>=90&&frame<=336)stretch.feet.forEach((f,i)=>{
      const at=world(f.bone.name);
      assert(Math.hypot(at.x-planted[i].x,at.z-planted[i].z)<1e-6,'all paw contact positions stay fixed during the pull');
    });
  }
  assert(low>=-.00201,`coat floor clearance: ${low}`);
  assert(gap<.002,`limb endpoint gap: ${gap}`);
  assert(maxStep<.012,`60 fps continuity: ${maxStep}`);
  stretch.update(3);coat.skeleton.update();
  assert(world('pelvis').y-world('paw1_L').y>.17,'hips stay high above the shoulders');
  assert(world('Bone004').y<.21,'head remains below the hips');
  const pulledHip=world('pelvis');
  stretch.update(1.5);
  for(const [name,pulled]of [['pelvis',pulledHip]]){
    assert(pulled.y>world(name).y+.008,name+' draws upward');
    assert(pulled.z<world(name).z-.005,name+' draws backward');
  }
  stretch.update(0);
  const earlyHead=world('Bone004'),earlyNeck=world('Bone002'),earlyHip=world('pelvis');
  stretch.update(.25);
  assert(world('Bone004').z<earlyHead.z-.0005,'head visibly moves backward before the body');
  assert(world('Bone002').distanceTo(earlyNeck)<1e-8,'neck has not started at the head lead');
  assert(world('pelvis').distanceTo(earlyHip)<1e-8,'hips have not started at the head lead');
  stretch.update(3);coat.skeleton.update();
  for(const side of ['L','R']){
    assert(world('paw3_'+side).z-world('paw1_'+side).z>.20,'forelegs extend forward');
    const shoulder=world('paw1_'+side),elbow=world('paw2_'+side),wrist=world('Lucy contact paw3_'+side);
    assert(elbow.clone().sub(shoulder).normalize().dot(wrist.clone().sub(elbow).normalize())>.999,'arm stays straight, not folded backward');
    const line=shoulder.clone().lerp(wrist,(elbow.z-shoulder.z)/(wrist.z-shoulder.z));
    assert(elbow.y<=line.y+1e-6,'elbow never kinks above the straight arm');
    const foot=stretch.feet.find(f=>f.side===side&&!f.rear);
    const sole=Math.min(...foot.vertices.map(i=>coat.getVertexPosition(i,point).applyMatrix4(coat.matrixWorld).y));
    assert(Math.abs(sole+.0015)<.001,'front soles settle flat on the floor');
  }
  assert(stretch.lids.every(m=>m.visible));assert(stretch.eyes.every(m=>!m.visible));
  for(const lid of stretch.lids)for(const name of ['position','normal'])
    assert(lid.geometry.attributes[name].array.every(Number.isFinite),'closed eyelid surface stays finite');
  assert.equal(coat.morphTargetInfluences[coat.morphTargetDictionary.Blink],0,'closed cap must not overlap the collapsed blink surface');
  const saved=coat.skeleton.bones.map(b=>b.matrixWorld.elements.slice());
  stretch.update(7);assert(stretch.lids.every(m=>!m.visible));assert(stretch.eyes.every(m=>m.visible));
  stretch.update(3);coat.skeleton.bones.forEach((b,i)=>assert.deepEqual(b.matrixWorld.elements,saved[i],'backward scrubbing is deterministic'));
  stretch.update(0);const start=coat.skeleton.bones.map(b=>b.matrixWorld.elements.slice());
  stretch.update(8);coat.skeleton.bones.forEach((b,i)=>assert.deepEqual(b.matrixWorld.elements,start[i],'seamless loop endpoints'));
  assert.deepEqual(a.array,original,'no skin projection or geometry replacement');
  disposeLucy(cat);
});
