import {Group,Quaternion,Vector3} from 'three';
import {loadLucy,createLucy,animateLucy,disposeLucy} from './lucy.js';
import {restWeight} from './cat-rest.js';
import {addLucyWhiskerPads} from '../../studies/lucy/whisker-pads.js';
import {addLucyPupilShape} from '../../studies/lucy/pupil-study.js';
import {addLucyPawPads} from '../../studies/lucy/paw-pads.js';
import {addSleepingEyelids} from '../../studies/lucy/sleep-eyelids.js';
import {addSideSleepBreathing} from '../../studies/lucy/side-sleep.js';
import {sleepTailLift} from '../../studies/lucy/sleep-tail-tap.js';
import {createGroomSurface} from '../../studies/lucy/groom-surface.js';
import {createGroomPlayback} from '../../studies/lucy/groom-playback.js';
import {createLucyTurnRig} from './lucy-turn.js';
import {approvedRestTime} from './cat-approved-rest.js';

const smooth=(a,b,t)=>{const u=Math.max(0,Math.min(1,(t-a)/(b-a)));return u*u*(3-2*u);};
export function decodeGroomCache(buffer,metadata){
  const h=new Uint32Array(buffer,0,4),steps=h[2],count=h[3];
  if(h[0]!==0x4c554359||h[1]!==1||buffer.byteLength!==16+count*4+(steps+1)*count*24)throw new Error('Invalid Lucy grooming cache');
  return {duration:metadata.duration,steps,indices:new Int32Array(buffer,16,count),
    frames:Array.from({length:steps+1},(_,i)=>new Float32Array(buffer,16+count*4+i*count*24,count*6))};
}
export async function loadCabinLucy(){
  const base=`${import.meta.env.BASE_URL}assets/obs/lucy/`;
  const version='20260915-approved-2';
  const read=async(name,method)=>{const response=await fetch(`${base}${name}?v=${version}`);if(!response.ok)throw new Error(`Lucy ${name}: ${response.status}`);return response[method]();};
  const [gltf,poses,binary]=await Promise.all([loadLucy(version),read('lucy-approved.json','json'),read('lucy-groom.bin','arrayBuffer')]);
  return {gltf,poses,cache:decodeGroomCache(binary,poses.groom)};
}
export function createCabinLucy({gltf,poses,cache},options){
  const root=createLucy(gltf,options),s=root.userData;
  addLucyWhiskerPads(root);addLucyPupilShape(root);addLucyPawPads(root);addSleepingEyelids(root);
  const breathe=addSideSleepBreathing(root);
  const poseRoot=new Group();poseRoot.name='Lucy approved pose';root.add(poseRoot);poseRoot.add(s.model);
  const sourceMeshes=[];root.traverse(m=>{if(m.isMesh)sourceMeshes.push(m);});
  const eyes=sourceMeshes.filter(m=>['Hazel iris','Pupils and eye margin'].includes(m.material.name));
  const lids=sourceMeshes.filter(m=>m.name.startsWith('Sleeping eyelid'));
  eyes.forEach(m=>m.visible=true);lids.forEach(m=>m.visible=false);
  const coat=sourceMeshes.find(m=>m.isSkinnedMesh&&m.material.name==='Lucy calico coat');
  if(coat.geometry.attributes.position.count!==poses.groom.vertices)throw new Error('Lucy surface/cache mismatch');
  const clip=coat.material.clippingPlanes;
  for(const m of sourceMeshes){m.material.clippingPlanes=clip;m.material.clipShadows=true;m.castShadow=true;m.receiveShadow=true;}
  const surface=createGroomSurface(root),groom=createGroomPlayback(surface,cache);
  const bones=[];root.traverse(b=>{if(b.isBone&&!b.name.startsWith('Lucy contact'))bones.push({b,p:b.position.clone(),q:b.quaternion.clone()});});
  const baseGeometry=coat.geometry,proneGeometry=baseGeometry.clone();
  if(poses.rests?.prone?.skin){proneGeometry.attributes.skinIndex.array.set(poses.rests.prone.skin.indices);proneGeometry.attributes.skinWeight.array.set(poses.rests.prone.skin.weights);}
  const lidGeometry=lids.map(mesh=>{const base=mesh.geometry,stretch=base.clone(),data=poses.rests?.stretch?.lids[mesh.name];
    if(data){stretch.attributes.position.array.set(data.positions);stretch.attributes.normal.array.set(data.normals);}
    return {mesh,base,stretch};
  });
  s.cabin={poses,poseRoot,bones,eyes,lids,lidGeometry,coat,baseGeometry,proneGeometry,breathe,groom,surface,turnRig:createLucyTurnRig(root),point:new Vector3(),q:new Quaternion(),p:new Vector3()};
  return root;
}

export function animateCabinLucy(root,options={}){
  const s=root.userData,c=s.cabin,{dt=null,actionTime=0,time=0,remaining=Infinity,hop=null,turn=null}=options;
  if(dt===0&&s.initialized)return;
  c.poseRoot.position.set(0,0,0);c.poseRoot.quaternion.identity();
  c.bones.forEach(({b,p,q})=>{b.position.copy(p);b.quaternion.copy(q);});
  c.breathe(0);
  const quiet=!options.moving&&!options.passage&&!hop&&!turn;
  const sleep=quiet&&options.mode==='sleep'?restWeight(actionTime,remaining,2.2):0;
  const rest=quiet?c.poses.rests?.[options.mode]:null;
  c.coat.geometry=rest&&options.mode==='prone'?c.proneGeometry:c.baseGeometry;
  c.lidGeometry.forEach(({mesh,base,stretch})=>mesh.geometry=rest&&options.mode==='stretch'?stretch:base);
  // The ship owns root translation and elevation; the approved jump controls
  // the limbs and trunk only. Do not run the old tucked-jump clip over it.
  animateLucy(root,turn?{...options,moving:false,mode:'idle',hop:null,yaw:turn.yaw}:hop?{...options,moving:false,mode:'idle',hop:null,yaw:hop.yaw}:rest?{...options,mode:'idle'}:options);
  c.bones.forEach(({b,p,q})=>{p.copy(b.position);q.copy(b.quaternion);});
  if(hop){
    const t=Math.max(0,Math.min(1,hop.age/hop.duration));
    const at=hop.phase==='prepare'?.66*t:hop.phase==='flight'?.66+.90*t:1.56+1.44*t;
    const frame=at*c.poses.jump.fps,index=Math.min(c.poses.jump.frames.length-2,Math.floor(frame));
    const blend=Math.min(1,frame-index),left=c.poses.jump.frames[index],right=c.poses.jump.frames[index+1];
    const weight=1-smooth(2.12,3,at);
    for(const {b} of c.bones){
      const a=left[b.name],d=right[b.name];if(!a||!d)continue;
      c.p.fromArray(a.p).lerp(c.point.fromArray(d.p),blend);b.position.lerp(c.p,weight);
      c.q.fromArray(a.q).slerp(new Quaternion().fromArray(d.q),blend);b.quaternion.slerp(c.q,weight);
    }
    s.weights=Object.fromEntries(Object.keys(s.weights).map(name=>[name,name==='Jump'?weight:name==='Idle'?1-weight:0]));
  }
  if(sleep>0){
    for(const {b} of c.bones){const target=c.poses.sleep.bones[b.name];if(!target)continue;
      b.position.lerp(c.p.fromArray(target.p),sleep);c.q.fromArray(target.q);
      if(b.name==='tail4')c.q.slerp(new Quaternion().fromArray(c.poses.sleep.tailRaised),sleepTailLift(actionTime)/.24);
      b.quaternion.slerp(c.q,sleep);
    }
    c.poseRoot.position.fromArray(c.poses.sleep.position).multiplyScalar(sleep);
    c.poseRoot.quaternion.slerp(c.q.fromArray(c.poses.sleep.quaternion),sleep);
    c.breathe(actionTime,sleep);
    root.updateMatrixWorld(true);c.coat.skeleton.update();
    let low=Infinity;const floor=root.getWorldPosition(c.p).y;
    for(let i=0;i<c.coat.geometry.attributes.position.count;i++)low=Math.min(low,c.coat.getVertexPosition(i,c.point).applyMatrix4(c.coat.matrixWorld).y);
    c.poseRoot.position.y+=Math.max(0,floor+.0005-low)/root.scale.y;
  }
  let closed=sleep>=.985;
  if(rest){
    const frame=approvedRestTime(options.mode,actionTime,remaining)*rest.fps,index=Math.min(rest.frames.length-2,Math.floor(frame));
    const blend=Math.min(1,frame-index),left=rest.frames[index],right=rest.frames[index+1];
    for(const {b}of c.bones){const a=left[b.name],d=right[b.name];if(!a||!d)continue;
      b.position.fromArray(a.p).lerp(c.point.fromArray(d.p),blend);b.quaternion.fromArray(a.q).slerp(c.q.fromArray(d.q),blend);
    }
    const eye=rest.eyes[index]*(1-blend)+rest.eyes[index+1]*blend;closed=eye>=.985;
    root.traverse(m=>{if(m.morphTargetDictionary?.Blink!==undefined)m.morphTargetInfluences[m.morphTargetDictionary.Blink]=closed?0:eye;});
  }
  c.eyes.forEach(m=>m.visible=!closed);c.lids.forEach(m=>m.visible=closed);
  if(turn)c.turnRig.update(turn,{restore:false});
  root.updateMatrixWorld(true);
  c.groom.update((s.weights.Groom??0)>0,actionTime,{weight:s.weights.Groom??0});
}
export function disposeCabinLucy(root){const c=root.userData.cabin;c.surface.dispose();c.proneGeometry.dispose();c.lidGeometry.forEach(g=>g.stretch.dispose());disposeLucy(root);}
