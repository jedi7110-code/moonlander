import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {CCDIKSolver} from 'three/addons/animation/CCDIKSolver.js';
import {CAT_SCALE,CAT_PORT} from './layout.js';
import {restWeight} from './cat-rest.js';
import {TailVariation,TAIL_POSES} from '../../studies/lucy/tail-variation.js';

export const LUCY={modelScale:2.25,offsetZ:-.19,cycle:1.2,stride:.175,asset:'assets/obs/lucy/lucy-cabin.glb'};
export const LUCY_CLIPS=['Idle',...TAIL_POSES,'Sleep','Eat','Sit','Groom','Play','Crouch','Jump'];

function transitionIK(model){
  const meshes=[];model.traverse(mesh=>{if(mesh.isSkinnedMesh)meshes.push(mesh);});
  const original=meshes[0].skeleton,bones=original.bones.slice(),inverses=original.boneInverses.slice(),iks=[];
  const index=name=>bones.findIndex(bone=>bone.name===name);
  const bind=name=>new THREE.Vector3().setFromMatrixPosition(inverses[index(name)].clone().invert());
  for(const side of ['L','R'])for(const rear of [false,true]){
    const foot=(rear?'feet_':'paw3_')+side,lower=(rear?'leg3_':'paw2_')+side;
    const end=new THREE.Bone();end.name=`Lucy contact ${foot}`;
    end.position.y=bind(foot).distanceTo(bind(lower));bones[index(lower)].add(end);
    const effector=bones.length;bones.push(end);inverses.push(inverses[index(foot)].clone());
    const names=rear?['leg3_','leg2_','leg1_']:['paw2_','paw1_'];
    iks.push({target:index(foot),effector,links:names.map(name=>({index:index(name+side)})),iteration:16,maxAngle:.08});
  }
  const skeleton=new THREE.Skeleton(bones,inverses);meshes.forEach(mesh=>mesh.skeleton=skeleton);original.dispose();
  return new CCDIKSolver(meshes[0],iks);
}

export async function loadLucy(){
  return new GLTFLoader().loadAsync(`${import.meta.env.BASE_URL}${LUCY.asset}`);
}

export function disposeLucy(root){
  const s=root.userData;s.mixer.stopAllAction();s.mixer.uncacheRoot(s.model);s.ik.mesh.skeleton.dispose();
}

export function createLucy(gltf,{random=Math.random}={}){
  for(const name of LUCY_CLIPS)if(!gltf.animations.some(clip=>clip.name===name))throw new Error(`Lucy animation missing: ${name}`);
  const root=new THREE.Group();root.name='Lucy';root.scale.setScalar(CAT_SCALE);
  const model=gltf.scene;model.scale.setScalar(LUCY.modelScale);model.position.z=LUCY.offsetZ;root.add(model);
  // The wall clips only Lucy; do not share clipping state with ship materials.
  const wall=new THREE.Plane(new THREE.Vector3(0,0,1),-CAT_PORT.wallZ);
  model.traverse(mesh=>{
    if(!mesh.isMesh)return;
    mesh.castShadow=true;mesh.receiveShadow=true;mesh.frustumCulled=false;
    mesh.material=mesh.material.clone();mesh.material.envMapIntensity=.24;
    mesh.material.clippingPlanes=[wall];mesh.material.clipShadows=true;
  });
  const mixer=new THREE.AnimationMixer(model),actions={};
  for(const clip of gltf.animations){const action=mixer.clipAction(clip);action.play();action.setEffectiveWeight(0);actions[clip.name]=action;}
  actions.Idle.setEffectiveWeight(1);mixer.update(0);
  const ik=transitionIK(model);
  const ikBones=[...new Set(ik.iks.flatMap(chain=>chain.links.map(link=>ik.mesh.skeleton.bones[link.index])))];
  const tailBones=Array.from({length:5},(_,i)=>model.getObjectByName(`tail${i+1}`));
  const ikPose=[...ikBones,...tailBones].map(bone=>({bone,rotation:bone.quaternion.clone()}));
  const tailMotion=tailBones.map(bone=>({bone,rotation:bone.quaternion.clone()}));
  root.userData={model,mixer,actions,ik,ikPose,tailMotion,tailSettle:0,tail:new TailVariation(random),lastTime:null,walkAmount:0,initialized:false,weights:{Idle:1}};
  return root;
}

export function animateLucy(root,{time=0,dt=null,moving=false,facing=1,yaw=null,mode='look',walkDistance=0,passage=null,hop=null,actionTime=0,remaining=Infinity,playRelease=null}){
  const s=root.userData;
  dt=dt===null?(s.lastTime===null?0:THREE.MathUtils.clamp(time-s.lastTime,0,.1)):THREE.MathUtils.clamp(dt,0,.1);
  s.lastTime=time;
  if(s.initialized&&dt===0)return;
  const walking=moving&&!hop;
  s.walkAmount=THREE.MathUtils.lerp(s.walkAmount,walking?1:0,1-Math.exp(-dt/.12));
  if(!s.initialized)s.walkAmount=walking?1:0;
  if(walking)s.tail.update(dt);
  const weights=Object.fromEntries(LUCY_CLIPS.map(name=>[name,0]));
  const quiet=!moving&&!passage&&!hop;
  if(quiet){
    const clip={sleep:'Sleep',eat:'Eat',look:'Sit',groom:'Groom',play:'Play'}[mode];
    if(clip)weights[clip]=restWeight(actionTime,remaining,clip==='Sleep'?2.2:1.6);
    if(mode==='play'&&playRelease){
      const release=THREE.MathUtils.smoothstep(playRelease.age,0,1.2);
      weights.Sit=weights.Play*release;weights.Play*=1-release;
    }
  }
  if(passage)weights.Crouch=.55*passage.crouch;
  if(hop){
    const t=THREE.MathUtils.clamp(hop.age/hop.duration,0,1);
    if(hop.phase==='flight')weights.Jump=Math.sin(Math.PI*t);
    else weights.Crouch=Math.sin(Math.PI*t);
  }
  const activity=Object.values(weights).reduce((sum,w)=>sum+w,0),walk=s.walkAmount*(1-activity);
  TAIL_POSES.forEach((clip,i)=>weights[clip]=walk*s.tail.weights[i]);
  weights.Idle=Math.max(0,1-activity-walk);
  const travel=walkDistance/(root.scale.x*LUCY.modelScale);
  for(const [name,action]of Object.entries(s.actions)){
    action.setEffectiveWeight(weights[name]??0);
    action.time=TAIL_POSES.includes(name)?((travel/LUCY.stride*LUCY.cycle)%LUCY.cycle+LUCY.cycle)%LUCY.cycle:
      name==='Idle'?time%action.getClip().duration:
      name==='Play'&&playRelease?(actionTime-playRelease.age)%action.getClip().duration:
      actionTime%action.getClip().duration;
  }
  // AnimationMixer skips unchanged bindings, so undo last frame's IK before sampling.
  s.ikPose.forEach(({bone,rotation})=>bone.quaternion.copy(rotation));
  s.mixer.update(0);s.weights=weights;
  s.ikPose.forEach(({bone,rotation})=>rotation.copy(bone.quaternion));
  // Re-solve planted limbs after pose blending; leave approved locomotion untouched.
  if(activity>0){root.updateMatrixWorld(true);s.ik.update();}
  s.tailSettle=activity>0?1:s.tailSettle*Math.exp(-dt/.3);
  const tailBlend=THREE.MathUtils.lerp(1,1-Math.exp(-dt/.26),s.tailSettle);
  s.tailMotion.forEach(({bone,rotation})=>{
    if(s.initialized)rotation.slerp(bone.quaternion,tailBlend);else rotation.copy(bone.quaternion);
    bone.quaternion.copy(rotation);
  });
  const blink=Math.max(weights.Sleep,Math.pow(Math.max(0,Math.sin(time*1.1)),32)*.94);
  s.model.traverse(mesh=>{const index=mesh.morphTargetDictionary?.Blink;if(index!==undefined)mesh.morphTargetInfluences[index]=blink;});
  const direction=passage?.yaw??hop?.yaw??yaw??facing*Math.PI/2;
  if(!s.initialized)root.rotation.y=direction;
  else root.rotation.y+=Math.atan2(Math.sin(direction-root.rotation.y),Math.cos(direction-root.rotation.y))*(1-Math.exp(-dt*10));
  s.initialized=true;root.updateMatrixWorld(true);
}
