// Reproducible handoff of the accepted studies; no runtime surface solving.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {Quaternion,Vector3} from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {createLucy,animateLucy} from '../../src/obs/lucy.js';
import {addLucyWhiskerPads} from './whisker-pads.js';
import {createGroomSurface} from './groom-surface.js';
import {prepareGroomPlayback} from './groom-playback.js';
import {layLucyOnSide} from './side-sleep.js';
import {createSleepTailTap} from './sleep-tail-tap.js';
import {createJumpStudy} from './jump-study.js';
import {createStretchStudy,STRETCH_DURATION} from './stretch-study.js';
import {createProneStudy,PRONE_DURATION} from './prone-study.js';
const study=path.dirname(fileURLToPath(import.meta.url));
const out=path.resolve(study,'../../public/assets/obs/lucy');
function input(file){const local=path.join(study,file);if(fs.existsSync(local))return local;
  if(file==='local/review/outline-study.glb')return path.join(out,'lucy-cabin.glb');
  if(file==='local/review/sleep/lucy-cabin.glb')return path.join(study,'assets/sleep-side.glb');
  return local;
}
async function load(file){const b=fs.readFileSync(input(file));return new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');}
const base=await load('local/review/outline-study.glb'),donor=await load('local/review/sleep/lucy-cabin.glb');
const cat=createLucy(base,{random:()=>.5});addLucyWhiskerPads(cat);
const surface=createGroomSurface(cat),{cache}=await prepareGroomPlayback(cat,surface);
fs.mkdirSync(out,{recursive:true});
const header=new Uint32Array([0x4c554359,1,cache.steps,cache.indices.length]);
fs.writeFileSync(path.join(out,'lucy-groom.bin'),Buffer.concat([
  Buffer.from(header.buffer),Buffer.from(cache.indices.buffer),...cache.frames.map(f=>Buffer.from(f.buffer,f.byteOffset,f.byteLength)),
]));
surface.dispose();
function pose(root){const bones={};root.traverse(b=>{if(b.isBone&&!b.name.startsWith('Lucy contact'))bones[b.name]={p:b.position.toArray(),q:b.quaternion.toArray()};});return bones;}
const sleepAsset=await load('local/review/outline-study.glb');
sleepAsset.animations=sleepAsset.animations.map(c=>c.name==='Sleep'?donor.animations.find(d=>d.name==='Sleep'):c);
const sleep=createLucy(sleepAsset,{random:()=>.5});
animateLucy(sleep,{dt:.1,time:2.7,actionTime:2.7,mode:'sleep',remaining:100,yaw:0});
layLucyOnSide(sleep,{floorY:0});const tail=createSleepTailTap(sleep,{floorY:0});tail.update(0);
const sleeping={bones:pose(sleep),position:sleep.position.clone().divideScalar(sleep.scale.x).toArray(),quaternion:sleep.quaternion.toArray()};
tail.update(4.3);sleeping.tailRaised=sleep.getObjectByName('tail4').quaternion.toArray();
const jumpAsset=await load('local/review/outline-study.glb'),jumpCat=createLucy(jumpAsset,{random:()=>.5});
animateLucy(jumpCat,{dt:.1,time:0,actionTime:0,mode:'idle',yaw:0});const jump=createJumpStudy(jumpCat,{floorY:0});
const jumping=[],smooth=(a,b,t)=>{const u=Math.max(0,Math.min(1,(t-a)/(b-a)));return u*u*(3-2*u);};
for(let frame=0;frame<=180;frame++){
  const t=frame/60,sample=jump.update(t);
  // Ship motion owns the trajectory. Remove study travel and the airborne
  // height only, retaining takeoff, forepaw-first landing and absorption.
  const height=Math.max(0,sample.lift)*smooth(.66,.95,t)*(1-smooth(1.25,1.56,t));
  const offset=new Vector3(0,height,sample.travel);
  for(const name of ['CONTROLLER','leg3_control_L','leg3_control_R','paw_control_L','paw_control_R']){
    const b=jumpCat.getObjectByName(name),world=b.getWorldPosition(new Vector3()).sub(offset);
    b.position.copy(b.parent.worldToLocal(world));jumpCat.updateMatrixWorld(true);
  }
  jumping.push(pose(jumpCat));
}
const rests={};
for(const [name,create,duration]of [['stretch',createStretchStudy,STRETCH_DURATION],['prone',createProneStudy,PRONE_DURATION]]){
  const model=createLucy(await load('local/review/outline-study.glb'),{random:()=>.5});addLucyWhiskerPads(model);
  animateLucy(model,{dt:.1,time:0,mode:'idle',yaw:0});const rig=create(model,{floorY:0}),frames=[],eyes=[];
  for(let frame=0;frame<=duration*60;frame++){const sample=rig.update(frame/60);frames.push(pose(model));eyes.push(sample.eyes??0);}
  const data=rests[name]={duration,fps:60,frames,eyes};
  if(name==='prone')data.skin={indices:Array.from(rig.coat.geometry.attributes.skinIndex.array),weights:Array.from(rig.coat.geometry.attributes.skinWeight.array)};
  if(name==='stretch')data.lids=Object.fromEntries(rig.lids.map(m=>[m.name,{positions:Array.from(m.geometry.attributes.position.array),normals:Array.from(m.geometry.attributes.normal.array)}]));
}
const data={version:2,groom:{duration:cache.duration,vertices:surface.source.geometry.attributes.position.count},sleep:sleeping,jump:{fps:60,frames:jumping},rests};
fs.writeFileSync(path.join(out,'lucy-approved.json'),JSON.stringify(data));
if(input('local/review/outline-study.glb')!==path.join(out,'lucy-cabin.glb'))fs.copyFileSync(input('local/review/outline-study.glb'),path.join(out,'lucy-cabin.glb'));
console.log({output:out,groomFrames:cache.frames.length,correctedVertices:cache.indices.length,jumpFrames:jumping.length});
