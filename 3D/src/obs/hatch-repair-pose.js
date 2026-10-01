import * as THREE from 'three';
import {placeHand} from './dining.js';
import {relaxMiloHand} from './milo-hands.js';
import {setRepairHandFit} from './cup-hand-fit.js';
import {applyAuthoredMiloTurn} from './milo-turn.js';
import {applyMocapWalk,miloWalkData} from './mocap-walk.js';
import {HATCH_SERVICE_POINT} from './eva.js';
import {HATCH_REPAIR_PHASES} from './hatch-repair.js';
export {HATCH_SERVICE_POINT} from './eva.js';

const v=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);
// The handle lies across the palm, with the shaft leaving beside the thumb.
// A shaft parallel to the straight fingers cannot form a cylindrical grip.
export const REPAIR_TOOL_GRIP=Object.freeze({x:.009,y:-.080,z:-.020,radius:.012,length:.096});
export const REPAIR_TOOL_TIP=new THREE.Vector3(.17,REPAIR_TOOL_GRIP.y,REPAIR_TOOL_GRIP.z);
const smooth=t=>{t=THREE.MathUtils.clamp(t,0,1);return t*t*(3-2*t);};

export function hatchRepairGripWeight(visit){
  if(visit.pose.tool)return 1;
  // Close before the tool is visible, and open only after it has been stowed.
  if(visit.phase==='inspect')return smooth((visit.age-(HATCH_REPAIR_PHASES.inspect-.45))/.45);
  if(visit.phase==='verify')return 1-smooth(visit.age/.45);
  return 0;
}

export function applyHatchRepairGrip(root,weight){
  const rig=root.userData.arms[0];
  setRepairHandFit(root,weight);
  if(!weight)return;
  const mix=(a,b)=>THREE.MathUtils.lerp(a,b,weight);
  for(const [i,finger]of rig.fingers.entries()){
    // Fit each imported finger's length: one uniform fist drives the shorter
    // index/little fingertips through the handle. Positive flexion is inward.
    finger.rotation.set(mix(finger.rotation.x,[.20,.25,.25,.10][i]),0,0);
    finger.userData.links[0].rotation.x=mix(finger.userData.links[0].rotation.x,[.30,.90,.90,.50][i]);
    finger.userData.links[1].rotation.x=mix(finger.userData.links[1].rotation.x,[.40,.55,.55,.70][i]);
  }
  const {thumb,side}=rig;
  // Oppose the thumb and lay its pad along the shaft-side end of the handle.
  thumb.position.lerp(v(-side*.009,-.045,.033),weight);
  thumb.rotation.set(mix(thumb.rotation.x,0),0,mix(thumb.rotation.z,-side*1.05));
  thumb.userData.ip.rotation.x=mix(thumb.userData.ip.rotation.x,.55);
}

export function attachHatchRepairTool(root){
  const tool=new THREE.Group();tool.name='Hatch repair screwdriver';tool.visible=false;
  root.userData.arms[0].hand.add(tool);root.userData.repairTool=tool;
  const grip=new THREE.Mesh(new THREE.CylinderGeometry(REPAIR_TOOL_GRIP.radius,REPAIR_TOOL_GRIP.radius,REPAIR_TOOL_GRIP.length,12),new THREE.MeshStandardMaterial({color:0x966942,roughness:.78}));
  grip.name='Repair screwdriver handle';grip.rotation.z=-Math.PI/2;
  grip.position.set(REPAIR_TOOL_GRIP.x,REPAIR_TOOL_GRIP.y,REPAIR_TOOL_GRIP.z);tool.add(grip);
  const shaftLength=REPAIR_TOOL_TIP.x-(REPAIR_TOOL_GRIP.x+REPAIR_TOOL_GRIP.length/2);
  const shaft=new THREE.Mesh(new THREE.CylinderGeometry(.0035,.0035,shaftLength,8),new THREE.MeshStandardMaterial({color:0xa6aca6,metalness:.65,roughness:.4}));
  shaft.name='Repair screwdriver shaft';shaft.rotation.z=-Math.PI/2;
  shaft.position.set(REPAIR_TOOL_TIP.x-shaftLength/2,REPAIR_TOOL_GRIP.y,REPAIR_TOOL_GRIP.z);tool.add(shaft);
}

export function applyHatchRepairPose(root,visit){
  visit.startYaw??=root.rotation.y;
  const pose=visit.pose,{body,head,arms,legs,repairTool}=root.userData;
  root.position.z=pose.depth;root.rotation.y=pose.yaw;body.position.set(0,0,0);head.rotation.set(0,0,0);
  for(const arm of arms)relaxMiloHand(arm);
  if(pose.moving){
    const joints=legs.flatMap(({leg,knee,boot})=>[leg,knee,boot]).concat(arms.flatMap(({arm,elbow,hand})=>[arm,elbow,hand]));
    const rest=joints.map(joint=>joint.quaternion.clone());
    applyMocapWalk(root,miloWalkData,pose.walkDistance/miloWalkData.cycleDistance*miloWalkData.duration);
    joints.forEach((joint,i)=>joint.quaternion.slerpQuaternions(rest[i],joint.quaternion.clone(),pose.walkWeight));body.position.multiplyScalar(pose.walkWeight);
  }
  if(pose.turn)applyAuthoredMiloTurn(root,pose.turn.from,pose.turn.to,pose.turn.progress,{upperBody:false});
  const weight=pose.reach;
  head.rotation.x=.17*weight;
  repairTool.visible=pose.tool&&weight>.01;
  if(!weight){applyHatchRepairGrip(root,hatchRepairGripWeight(visit));return;}
  root.updateWorldMatrix(true,true);
  const right=arms[0],left=arms[1];
  const target=body.worldToLocal(v(HATCH_SERVICE_POINT.x,root.position.y+HATCH_SERVICE_POINT.y,HATCH_SERVICE_POINT.z));
  // Approach from below with the knuckles above the wrist; keeping the idle
  // palm upright here would fold the working wrist back against the forearm.
  const rotation=new THREE.Quaternion().setFromAxisAngle(v(0,0,1),(pose.tool?Math.PI:0)+pose.twist).multiply(new THREE.Quaternion().setFromAxisAngle(pose.tool?v(0,1,0):v(1,0,0),-Math.PI/2));
  const tip=pose.tool?REPAIR_TOOL_TIP:v(0,-.15,.025);
  const wrist=target.sub(tip.clone().multiply(right.hand.scale).applyQuaternion(rotation));
  const rest=body.worldToLocal(right.hand.getWorldPosition(v())),restQ=right.hand.getWorldQuaternion(new THREE.Quaternion()).premultiply(body.getWorldQuaternion(new THREE.Quaternion()).invert());
  placeHand(right,rest.lerp(wrist,weight),restQ.slerp(rotation,weight),0);
  relaxMiloHand(right);applyHatchRepairGrip(root,hatchRepairGripWeight(visit));
  const brace=body.worldToLocal(v(HATCH_SERVICE_POINT.x-.045,root.position.y+1.44,HATCH_SERVICE_POINT.z-.38));
  const leftRest=body.worldToLocal(left.hand.getWorldPosition(v()));
  const leftQ=left.hand.getWorldQuaternion(new THREE.Quaternion()).premultiply(body.getWorldQuaternion(new THREE.Quaternion()).invert());
  placeHand(left,leftRest.lerp(brace,weight*.6),leftQ.slerp(new THREE.Quaternion().setFromAxisAngle(v(1,0,0),-1.1),weight*.6),.12*weight);
}
