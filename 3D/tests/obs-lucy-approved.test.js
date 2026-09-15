import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {Vector3} from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {createCabinLucy,animateCabinLucy,decodeGroomCache,disposeCabinLucy} from '../src/obs/lucy-cabin.js';
import {LOUNGE_SEAT} from '../src/obs/layout.js';
import {createCatTurn,sampleCatTurn} from '../src/obs/cat-turn.js';
import {createLucy,animateLucy} from '../src/obs/lucy.js';
import {addLucyWhiskerPads} from '../studies/lucy/whisker-pads.js';
import {createStretchStudy} from '../studies/lucy/stretch-study.js';
import {createProneStudy} from '../studies/lucy/prone-study.js';
const directory=new URL('../public/assets/obs/lucy/',import.meta.url);
async function create(){
  const read=name=>fs.readFileSync(new URL(name,directory)),bytes=read('lucy-cabin.glb'),binary=read('lucy-groom.bin');
  const gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
  const poses=JSON.parse(read('lucy-approved.json'));
  return createCabinLucy({gltf,poses,cache:decodeGroomCache(binary.buffer.slice(binary.byteOffset,binary.byteOffset+binary.byteLength),poses.groom)},{random:()=>.5});
}
function bounds(root){
  const points=[],p=new Vector3();root.updateMatrixWorld(true);
  root.traverse(m=>{if(!m.isMesh||!m.visible||m.material.name!=='Lucy calico coat')return;
    m.skeleton?.update();for(let i=0;i<m.geometry.attributes.position.count;i++)points.push(m.getVertexPosition(i,p).applyMatrix4(m.matrixWorld).clone());
  });return points;
}
test('stepping turns keep their skin above the floor and move continuously',async()=>{
  const cat=await create();cat.position.set(2,3,.8);
  for(const angle of [Math.PI/4,Math.PI/2,Math.PI,-Math.PI]){
    cat.userData.initialized=false;const turn=createCatTurn(0,angle);let last=null,low=Infinity,maxStep=0;
    for(let frame=0;frame<=Math.ceil(turn.duration*60);frame++){
      turn.age=Math.min(turn.duration,frame/60);
      animateCabinLucy(cat,{dt:1/60,time:frame/60,mode:'look',actionTime:0,turn:sampleCatTurn(turn)});
      const points=bounds(cat);low=Math.min(low,...points.map(p=>p.y));
      if(last)points.forEach((p,i)=>maxStep=Math.max(maxStep,p.distanceTo(last[i])));last=points;
      assert(points.every(p=>p.toArray().every(Number.isFinite)));
    }
    console.log('turn',{angle,low,maxStep});
    assert(low>2.997,`floor penetration: ${low}`);
    assert(maxStep<.04,`turn pops: ${maxStep}`);
  }
  disposeCabinLucy(cat);
});
test('standing and turning join without a pose jump',async()=>{
  const cat=await create(),turn=createCatTurn(0,Math.PI);
  for(const age of [0,turn.duration]){
    turn.age=age;
    animateCabinLucy(cat,{dt:1/60,time:0,mode:'idle',yaw:sampleCatTurn(turn).yaw});
    cat.rotation.y=sampleCatTurn(turn).yaw;
    const standing=bounds(cat);
    animateCabinLucy(cat,{dt:1/60,time:0,mode:'idle',turn:sampleCatTurn(turn)});
    const distance=Math.max(...bounds(cat).map((p,i)=>p.distanceTo(standing[i])));
    console.log('turn seam',age,distance);assert(distance<.04);
  }
  disposeCabinLucy(cat);
});
test('accepted appearance and lightweight grooming are connected to cabin poses',async()=>{
  const cat=await create();cat.position.set(2,3,.8);
  let coat=cat.userData.cabin.coat;
  for(const name of ['FaceRefine','SitShoulders','SitSurface','SitHocks','SitOutline','WhiskerPads'])assert(name in coat.morphTargetDictionary,name);
  assert(cat.getObjectByName('Lucy paw pad front L central'));
  let pupil;cat.traverse(m=>{if(m.material?.name==='Pupils and eye margin')pupil=m;});assert(pupil.morphTargetDictionary.PupilOval!==undefined);
  let low=Infinity,maxStep=0,last;
  for(const mode of ['look','groom','sleep','eat','walk']){
    cat.userData.initialized=false;last=null;
    for(let frame=0;frame<=60;frame++){
      const age=frame*.2;
      animateCabinLucy(cat,{time:age,dt:.1,actionTime:age,remaining:Math.max(0,12-age),mode,moving:mode==='walk',walkDistance:age*.1,yaw:Math.PI/2});
      const points=bounds(cat);const min=Math.min(...points.map(p=>p.y));low=Math.min(low,min);
      assert(points.every(p=>p.toArray().every(Number.isFinite)),mode);
      assert(min>2.997,`${mode} penetrates support at ${age}: ${min}`);
      if(last&&points.length===last.length)points.forEach((p,i)=>maxStep=Math.max(maxStep,p.distanceTo(last[i])));last=points;
    }
  }
  console.log({low,maxStep});
  animateCabinLucy(cat,{time:20,dt:.1,mode:'sleep',actionTime:4.3,remaining:100,yaw:0});
  assert(cat.userData.cabin.lids.every(m=>m.visible));assert(cat.userData.cabin.eyes.every(m=>!m.visible));
  const sleepBounds=bounds(cat);assert(Math.max(...sleepBounds.map(p=>p.y))-Math.min(...sleepBounds.map(p=>p.y))<.32,'accepted side-sleep silhouette');
  const old=cat.userData.cabin.poseRoot.matrix.elements.slice();
  animateCabinLucy(cat,{dt:0,mode:'look',actionTime:0,remaining:100});assert.deepEqual(cat.userData.cabin.poseRoot.matrix.elements,old);
  animateCabinLucy(cat,{time:21,dt:.1,mode:'look',actionTime:4,remaining:100});assert(cat.userData.cabin.eyes.every(m=>m.visible));
  assert(cat.userData.cabin.surface.source.visible);assert(!cat.userData.cabin.surface.display.visible);
  disposeCabinLucy(cat);
});
test('cabin jump preserves extended feet and supports both sofa trajectories',async()=>{
  const cat=await create();
  for(const up of [true,false])for(const phase of ['prepare','flight','land'])for(let i=0;i<=20;i++){
    const t=i/20,seat=LOUNGE_SEAT.top;cat.position.y=phase==='flight'?(up?seat*t:seat*(1-t))+4*(up?.30:.20)*t*(1-t):phase==='prepare'?(up?0:seat):(up?seat:0);
    animateCabinLucy(cat,{dt:.02,time:t,mode:'walk',moving:true,hop:{up,phase,age:t,duration:1,yaw:0}});
    assert(bounds(cat).every(p=>Number.isFinite(p.y)&&p.y>-.004),`${up} ${phase} ${t}: below deck`);
    if(phase!=='flight')assert(bounds(cat).every(p=>p.y>cat.position.y-.003),`${up} ${phase}: penetrates its supporting floor/cushion`);
  }
  disposeCabinLucy(cat);
});
test('all eight rest headings preserve the accepted pose and floor contact',async()=>{
  const cat=await create();cat.position.set(2,3,.8);
  for(const mode of ['look','groom','sleep','stretch','prone'])for(let i=0;i<8;i++){
    const yaw=i*Math.PI/4;cat.userData.initialized=false;
    animateCabinLucy(cat,{dt:.1,time:4.3,actionTime:4.3,remaining:100,mode,yaw});
    assert.equal(cat.rotation.y,yaw,'explicit front-facing zero must not fall back to travel heading');
    const points=bounds(cat),low=Math.min(...points.map(p=>p.y));
    assert(points.every(p=>p.toArray().every(Number.isFinite)),`${mode} ${i}: finite surface`);
    assert(low>2.997&&low<3.01,`${mode} ${i}: support contact ${low}`);
    assert.equal(cat.userData.cabin.lids.every(m=>m.visible),['sleep','stretch'].includes(mode));
  }
  disposeCabinLucy(cat);
});
test('cabin stretch and prone match the approved studies and leave other actions intact',async()=>{
  const cat=await create();
  for(const [mode,make,duration]of [['stretch',createStretchStudy,8],['prone',createProneStudy,12]]){
    const bytes=fs.readFileSync(new URL('lucy-cabin.glb',directory));
    const gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
    const study=createLucy(gltf,{random:()=>.5});addLucyWhiskerPads(study);animateLucy(study,{dt:.1,time:0,mode:'idle',yaw:0});
    const rig=make(study,{floorY:0});
    for(const t of [0,.25,1.1,1.5,2.6,4,duration-1,duration]){
      rig.update(t);const reference=bounds(study);
      cat.rotation.set(0,0,0);
      animateCabinLucy(cat,{dt:1/60,time:t,actionTime:t,remaining:duration-t,mode,yaw:0});
      const actual=bounds(cat);assert.equal(actual.length,reference.length);
      const error=Math.max(...actual.map((p,i)=>p.distanceTo(reference[i])));
      assert(error<.0001,`${mode} ${t}: differs from approved study by ${error}`);
      assert(actual.every(p=>p.y>=-.0001),'accepted pose stays above its supporting floor');
    }
    for(let frame=0;frame<=duration*60;frame++){
      const t=frame/60;animateCabinLucy(cat,{dt:1/60,time:t,actionTime:t,remaining:duration-t,mode,yaw:Math.PI/2});
      assert(bounds(cat).every(p=>p.y>=-.0001&&p.toArray().every(Number.isFinite)),`${mode} contact at ${t}`);
    }
    animateCabinLucy(cat,{dt:.1,time:20,mode:'look',actionTime:4,remaining:100,yaw:0});
    assert.equal(cat.userData.cabin.coat.geometry,cat.userData.cabin.baseGeometry);
    assert(cat.userData.cabin.eyes.every(m=>m.visible));
  }
  disposeCabinLucy(cat);
});
