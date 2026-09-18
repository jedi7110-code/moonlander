import * as THREE from 'three';
import {ball,rod} from './materials.js';
import {armHingeAngles} from './gym.js';
import {relaxMiloHand} from './milo-hands.js';
import {setCupHandFit,setMealHandFit} from './cup-hand-fit.js';
import {reachMeal} from './meal-pose.js';
import {CABIN_AISLE,HYDRO_TRAY} from './layout.js';

const clamp=THREE.MathUtils.clamp,lerp=THREE.MathUtils.lerp;
const smooth=value=>{const t=clamp(value,0,1);return t*t*(3-2*t);};
const v=(x,y,z)=>new THREE.Vector3(x,y,z);
// Thumb up, palm toward the handle, fingers continuing along the forearm.
// The old downward palm required a near right-angle bend at the wrist.
const cupHand=new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI/2,Math.PI/2,0));
export const CUP_GRIP=Object.freeze([.118,.003,-.070]);
const cupRim=v(0,.067,-.043),cupGrip=v(...CUP_GRIP);
export const DINING_APPROACH=.32;
// Leave room for the torso and the lifted cup in front of the dispenser taps.
// Reach to the tray with the arm instead of bringing the body against the cabinet.
export const diningApproach=action=>action==='hydro'?CABIN_AISLE.crewZ-HYDRO_TRAY.standZ:DINING_APPROACH;

export function cupGripPose(progress){
  const lift=smooth((progress-.14)/.18)*(1-smooth((progress-.73)/.17));
  const tilt=.94*smooth((progress-.33)/.13)*(1-smooth((progress-.62)/.11));
  // As the cup rises, move the wrist below the handle instead of folding the
  // hand backwards against the forearm. Keep the grip centred on the handle.
  const roll=new THREE.Quaternion().setFromAxisAngle(v(1,0,0),-lift*(1.7-tilt));
  return{lift,tilt,position:cupGrip.clone().sub(v(.098,.003,0)).applyQuaternion(roll).add(v(.098,.003,0)),rotation:roll.multiply(cupHand)};
}

export function mouthPosition(head){
  // Lip landmark on the head scan, in metres relative to the neck joint.
  return v(-.006,.02475,.1254+(head.userData.faceForward??0)).applyQuaternion(head.quaternion).add(head.position);
}

function lathe(parent,material,profile,name){
  const mesh=new THREE.Mesh(new THREE.LatheGeometry(profile.map(([r,y])=>new THREE.Vector2(r,y)),48),material);
  mesh.name=name;mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;
}

export function createDiningProps(body,m){
  const mug=new THREE.Group(),bowl=new THREE.Group(),spoon=new THREE.Group();
  const steel=new THREE.MeshStandardMaterial({color:0xc0c8c7,roughness:.32,metalness:.48});
  mug.name='Drinking cup';bowl.name='Meal bowl';spoon.name='Meal spoon';
  for(const prop of [mug,bowl,spoon]){body.add(prop);prop.visible=false;}
  lathe(mug,m.white,[[0,-.064],[.032,-.064],[.039,-.056],[.046,.059],[.045,.067],[.041,.068],[.039,.057],[.033,-.052],[0,-.052]],'Hollow enamel cup');
  const handle=new THREE.Mesh(new THREE.TorusGeometry(.032,.006,12,32),m.white);
  handle.position.set(.066,.003,0);handle.scale.y=1.18;mug.add(handle);
  const water=ball(mug,m.water??m.metal,0,-.026,0,.033,.002,.033);water.name='Cup liquid surface';
  lathe(bowl,steel,[[0,-.042],[.061,-.042],[.080,-.025],[.102,.034],[.108,.041],[.107,.047],[.102,.047],[.096,.035],[.074,-.023],[0,-.031]],'Open meal bowl');
  const mealMaterial=new THREE.MeshStandardMaterial({color:0xad8649,roughness:.92});
  const meal=ball(bowl,mealMaterial,0,.017,0,.088,.015,.088);
  for(let i=0;i<18;i++){
    const angle=i*2.39996,r=.073*Math.sqrt((i+.5)/18);
    ball(meal,mealMaterial,Math.cos(angle)*r/.088,.8,Math.sin(angle)*r/.088,.08,.25,.10);
  }
  // The spoon origin is the bowl of the spoon, so it can meet the lips directly.
  const spoonBowl=lathe(spoon,steel,[[0,-.004],[.010,-.004],[.018,.001],[.020,.006],[.018,.007],[.010,0],[0,0]],'Spoon bowl');spoonBowl.scale.z=1.45;
  rod(spoon,steel,[0,.002,.019],[0,.006,.148],.004);
  const bite=ball(spoon,mealMaterial,0,.007,0,.015,.006,.021);
  return{mug,bowl,spoon,bite,meal,water};
}

function pointOn(prop,point){return point.clone().applyQuaternion(prop.quaternion).add(prop.position);}

export function placeHand(rig,target,rotation,grip){
  const {arm,elbow,hand}=rig,angles=armHingeAngles(rig,target);
  arm.rotation.set(angles.upper,angles.yaw,0,'YXZ');elbow.rotation.set(angles.lower,0,0);
  hand.quaternion.copy(arm.quaternion).multiply(elbow.quaternion).invert().multiply(rotation);
  for(const [i,finger] of (rig.fingers??[]).entries()){
    finger.rotation.x=-grip*(.45+i*.04);
    finger.userData.links[0].rotation.x=-grip*.95;
    finger.userData.links[1].rotation.x=-grip*.7;
  }
  if(rig.thumb)rig.thumb.rotation.z=rig.side*.35*grip;
}

function mixPoint(points,phase){
  for(let i=1;i<points.length;i++)if(phase<=points[i][0]){
    const [a,p]=points[i-1],[b,q]=points[i];return p.clone().lerp(q,smooth((phase-a)/(b-a)));
  }
  return points.at(-1)[1].clone();
}

export function diningPhase(time,duration){
  const p=clamp(time/Math.max(duration,.1),0,1);
  return{progress:clamp((p-.27)/.46,0,1),hold:smooth((p-.15)/.12)*(1-smooth((p-.73)/.12)),reach:smooth(p/.15)*(1-smooth((p-.85)/.15)),approach:smooth(p/.10)*(1-smooth((p-.90)/.10))};
}

function dockProp(root,prop,dock,hold,defaultPosition){
  const position=defaultPosition.clone(),rotation=new THREE.Quaternion();
  if(dock){
    root.userData.body.updateWorldMatrix(true,false);dock.updateWorldMatrix(true,false);
    position.copy(root.userData.body.worldToLocal(dock.getWorldPosition(new THREE.Vector3())));
    root.userData.body.getWorldQuaternion(rotation).invert().multiply(dock.getWorldQuaternion(new THREE.Quaternion()));
  }
  prop.position.lerpVectors(position,prop.position.clone(),hold);
  prop.quaternion.slerpQuaternions(rotation,prop.quaternion.clone(),hold);
}

function reachCup(root,mug,reach,grasp){
  const rig=root.userData.arms[1],{arm,elbow,hand,fingers,thumb}=rig;
  setCupHandFit(root,reach);
  relaxMiloHand(rig);
  if(reach===0)return;
  root.updateWorldMatrix(true,true);
  const rest=root.userData.body.worldToLocal(hand.getWorldPosition(new THREE.Vector3()));
  const upper=arm.quaternion.clone(),lower=elbow.quaternion.clone();
  const neutral=hand.quaternion.clone(),shoulder=arm.position.clone(),target=pointOn(mug,grasp.position);
  const contactAngles=armHingeAngles(rig,target);
  const contactArm=new THREE.Quaternion().setFromEuler(new THREE.Euler(contactAngles.upper,contactAngles.yaw,0,'YXZ'));
  const contactElbow=new THREE.Quaternion().setFromAxisAngle(v(1,0,0),contactAngles.lower);
  const wrist=contactArm.multiply(contactElbow).invert().multiply(mug.quaternion).multiply(grasp.rotation);
  arm.position.copy(shoulder);
  // Lift the hand over the tray lip before reaching inward. Reversing this
  // same arc also keeps the fingers above the tray when releasing the cup.
  const reachTarget=rest.lerp(target,reach);
  reachTarget.y+=.24*Math.sin(Math.PI*reach);
  reachTarget.z-=.18*Math.sin(Math.PI*reach);
  const angles=armHingeAngles(rig,reachTarget);
  arm.rotation.set(angles.upper,angles.yaw,0,'YXZ');elbow.rotation.set(angles.lower,0,0);
  // Blend the arm's orientation too: solving the resting wrist position alone
  // can rotate the elbow plane abruptly on the very first reaching frame.
  arm.quaternion.copy(upper.slerp(arm.quaternion,reach));
  elbow.quaternion.copy(lower.slerp(elbow.quaternion,reach));
  // Carry the open hand with the forearm first, then orient it to the handle.
  // Interpolating an absolute palm angle made the wrist lead the arm and kink.
  hand.quaternion.copy(neutral).slerp(wrist,smooth((reach-.45)/.55));
  // Close only as the fingers arrive, without a jump when the cup is lifted.
  const grip=smooth((reach-.72)/.28);
  for(const [i,finger]of fingers.entries()){
    finger.rotation.x=lerp(finger.rotation.x,.62+i*.035,grip);
    finger.userData.links[0].rotation.x=lerp(finger.userData.links[0].rotation.x,1.10,grip);
    finger.userData.links[1].rotation.x=lerp(finger.userData.links[1].rotation.x,.65,grip);
  }
  thumb.rotation.set(lerp(.16,.42,grip),0,rig.side*lerp(.10,.24,grip));
  thumb.userData.ip.rotation.x=lerp(.28,.60,grip);
}

export function applyDiningPose(root,action,time,duration=action==='galley'?6:5,docks=null){
  const {head,dining}=root.userData,{mug,bowl,spoon,bite,meal,water}=dining;
  const {progress,hold,reach}=diningPhase(time,duration),ready=1;
  head.rotation.set(.10*(1-ready),0,0);
  const mouth=mouthPosition(head);
  if(action==='hydro'){
    mug.visible=true;
    const grasp=cupGripPose(progress),{lift,tilt}=grasp;
    head.rotation.x=-.045*(tilt/.94);
    const lip=mouthPosition(head),rest=v(.17,lerp(.96,1.26,ready),lerp(.10,.35,ready));
    mug.rotation.set(-tilt,0,0);
    const contact=lip.clone().add(v(0,-.002,.006)).sub(cupRim.clone().applyQuaternion(mug.quaternion));
    mug.position.copy(rest).lerp(contact,lift);
    dockProp(root,mug,docks?.mug,hold,v(.17,1.134,.40));
    reachCup(root,mug,reach,grasp);
    water.visible=tilt<.35;water.position.y=-.026-.015*smooth((progress-.42)/.2);
    if(head.userData.setMouthMotion)head.userData.setMouthMotion(0,tilt>.6?.22:0);
    return;
  }
  bowl.visible=true;spoon.visible=true;
  bowl.position.set(-.095,lerp(1.04,1.215,ready),lerp(.16,.285,ready));bowl.rotation.set(0,0,.025);
  const cycle=clamp((progress-.13)/.74,0,1)*2,phase=cycle===2?1:cycle%1;
  const scoop=bowl.position.clone().add(v(.025,.028,.009));
  const lifted=scoop.clone().add(v(.038,.10,.035)),atMouth=mouth.clone().add(v(0,.002,.014)),withdrawn=atMouth.clone().add(v(.065,-.085,.15));
  const tip=mixPoint([[0,scoop],[.17,lifted],[.43,atMouth],[.54,atMouth],[.76,withdrawn],[1,scoop]],phase);
  const rest=v(.16,1,.08);spoon.position.copy(rest).lerp(tip,ready);spoon.rotation.set(-.1*(1-smooth(phase/.25)),0,-.06*(1-ready));
  dockProp(root,bowl,docks?.bowl,hold,v(-.095,1.077,.30));
  dockProp(root,spoon,docks?.spoon,hold,v(.17,1.039,.18));
  // Lift the handle through a reachable arc while rotating it away from the worktop.
  spoon.position.y+=Math.sin(Math.PI*hold)*.08;
  setMealHandFit(root,reach);
  reachMeal(root,0,bowl,reach);
  reachMeal(root,1,spoon,reach);
  bite.visible=hold===1&&progress>.13&&progress<.87&&phase>.10&&phase<.50;
  meal.position.y=.017-.006*Math.min(2,Math.floor(cycle+.5));
  const eating=ready*smooth((phase-.30)/.1)*(1-smooth((phase-.54)/.06));
  const chewing=ready*(phase>.57?Math.sin((phase-.57)*Math.PI*10)**2*.35:0);
  if(head.userData.setMouthMotion)head.userData.setMouthMotion(eating,chewing);
}

export function resetDiningPose(root){
  const {dining,head}=root.userData;
  for(const prop of [dining.mug,dining.bowl,dining.spoon])prop.visible=false;
  if(head.userData.setMouthMotion)head.userData.setMouthMotion(0,0);
}
