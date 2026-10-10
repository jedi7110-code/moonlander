import * as THREE from 'three';
import {solveHingeArm} from './arm-ik.js';
import {relaxMiloHand} from './milo-hands.js';
import {setRepairHandFit} from './cup-hand-fit.js';
import {applyAuthoredMiloTurn} from './milo-turn.js';
import {applyMocapWalk,miloWalkData} from './mocap-walk.js';
import {HATCH_SERVICE_POINT} from './eva.js';
export {HATCH_SERVICE_POINT} from './eva.js';

const v=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);
// Canonical cylinder coordinates; the tool group mounts it diagonally across
// the palm, with the shaft leaving beside the thumb.
export const REPAIR_TOOL_GRIP=Object.freeze({x:.009,y:-.080,z:-.020,radius:.012,length:.096});
// A power grip lies diagonally across the palm. The old transverse mounting
// forced a 70–98 degree wrist bend just to point the shaft at the lock.
export const REPAIR_TOOL_ROLL=-.65;
const toolRotation=new THREE.Quaternion().setFromAxisAngle(v(0,0,1),REPAIR_TOOL_ROLL);
const gripCenter=v(REPAIR_TOOL_GRIP.x,REPAIR_TOOL_GRIP.y,REPAIR_TOOL_GRIP.z);
export const REPAIR_TOOL_TIP=v(.17,REPAIR_TOOL_GRIP.y,REPAIR_TOOL_GRIP.z).sub(gripCenter).applyQuaternion(toolRotation).add(gripCenter);
const smooth=t=>{t=THREE.MathUtils.clamp(t,0,1);return t*t*(3-2*t);};

export function hatchRepairGripWeight(visit){
  return visit.pose.grip;
}

export function applyHatchRepairGrip(root,weight){
  const rig=root.userData.arms[0];
  setRepairHandFit(root,weight);
  if(!weight)return;
  const mix=(a,b)=>THREE.MathUtils.lerp(a,b,weight);
  for(const [i,finger]of rig.fingers.entries()){
    // Fit each imported finger's length: one uniform fist drives the shorter
    // index/little fingertips through the handle. Positive flexion is inward.
    finger.rotation.set(mix(finger.rotation.x,[.69372,1.07734,.66226,.75798][i]),mix(finger.rotation.y,[-.22539,.23065,.25,.13728][i]),mix(finger.rotation.z,[-.08470,-.15,-.15,.09447][i]));
    finger.userData.links[0].rotation.x=mix(finger.userData.links[0].rotation.x,[.55,.57905,.87286,1.55][i]);
    finger.userData.links[1].rotation.x=mix(finger.userData.links[1].rotation.x,[.63902,.70,.70,.70][i]);
  }
  const {thumb,side}=rig;
  // Oppose at the CMC joint; moving the thumb base stretches its webbing.
  thumb.rotation.set(mix(thumb.rotation.x,-.29669),mix(thumb.rotation.y,.01593),mix(thumb.rotation.z,-side*.71));
  thumb.userData.ip.rotation.x=mix(thumb.userData.ip.rotation.x,.54022);
}

export function attachHatchRepairTool(root){
  const tool=new THREE.Group();tool.name='Hatch repair screwdriver';tool.visible=false;
  tool.quaternion.copy(toolRotation);tool.position.copy(gripCenter).sub(gripCenter.clone().applyQuaternion(toolRotation));
  root.userData.arms[0].hand.add(tool);root.userData.repairTool=tool;
  const grip=new THREE.Mesh(new THREE.CylinderGeometry(REPAIR_TOOL_GRIP.radius,REPAIR_TOOL_GRIP.radius,REPAIR_TOOL_GRIP.length,12),new THREE.MeshStandardMaterial({color:0x966942,roughness:.78}));
  grip.name='Repair screwdriver handle';grip.rotation.z=-Math.PI/2;
  grip.position.set(REPAIR_TOOL_GRIP.x,REPAIR_TOOL_GRIP.y,REPAIR_TOOL_GRIP.z);tool.add(grip);
  const shaftLength=.17-(REPAIR_TOOL_GRIP.x+REPAIR_TOOL_GRIP.length/2);
  const shaft=new THREE.Mesh(new THREE.CylinderGeometry(.0035,.0035,shaftLength,8),new THREE.MeshStandardMaterial({color:0xa6aca6,metalness:.65,roughness:.4}));
  shaft.name='Repair screwdriver shaft';shaft.rotation.z=-Math.PI/2;
  shaft.position.set(.17-shaftLength/2,REPAIR_TOOL_GRIP.y,REPAIR_TOOL_GRIP.z);tool.add(shaft);
}

function placeRepairHand(rig,target,rotation,weight,tool){
  const {arm,elbow,hand,side}=rig;
  const restPole=elbow.position.clone().applyQuaternion(arm.quaternion);
  // Keep the elbow below the shoulder and outside the ribs. The grip rolls
  // with the forearm, so the hand can face inward without raising the shoulder.
  const delta=target.clone().sub(arm.position),max=elbow.position.length()+hand.position.length()-.001;
  if(delta.length()>max)target.copy(arm.position).add(delta.setLength(max));
  const axis=target.clone().sub(arm.position).normalize();
  let pole;
  if(tool){
    // Sweep the elbow around the shoulder-to-wrist axis on the outside. Blending
    // two 3D poles can cross that axis and reverse the elbow in a single frame.
    const from=restPole.clone().addScaledVector(axis,-restPole.dot(axis)).normalize();
    const to=v(side*.80,-.10,-.10);to.addScaledVector(axis,-to.dot(axis)).normalize();
    const across=axis.clone().cross(from).normalize();if(across.x*side<0)across.negate();
    let angle=Math.atan2(to.dot(across),to.dot(from));if(angle<0)angle+=2*Math.PI;
    pole=from.multiplyScalar(Math.cos(angle*weight)).addScaledVector(across,Math.sin(angle*weight));
  }else pole=restPole.lerp(v(side*.10,-1,-.10),smooth(weight/.5));
  if(pole.clone().addScaledVector(axis,-pole.dot(axis)).length()<.005)pole.x+=side*.1;
  const solved=solveHingeArm(rig,target,pole);
  arm.quaternion.copy(solved.upper);elbow.quaternion.copy(solved.lower);
  hand.quaternion.copy(arm.quaternion).multiply(elbow.quaternion).invert().multiply(rotation);
  // Preserve forearm roll, limiting only the bend while lifting/withdrawing.
  const along=hand.position.clone().normalize(),direction=v(0,-1,0).applyQuaternion(hand.quaternion);
  const bend=along.angleTo(direction),limit=.72;
  if(bend>limit){
    const correction=new THREE.Quaternion().setFromUnitVectors(direction,along);
    correction.slerp(new THREE.Quaternion(),limit/bend);
    hand.quaternion.premultiply(correction);
  }
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
  repairTool.visible=pose.tool&&weight>.01&&pose.grip>.98;
  if(!weight){applyHatchRepairGrip(root,hatchRepairGripWeight(visit));return;}
  root.updateWorldMatrix(true,true);
  const right=arms[0];
  const target=body.worldToLocal(v(HATCH_SERVICE_POINT.x,root.position.y+HATCH_SERVICE_POINT.y,HATCH_SERVICE_POINT.z));
  // Lift on a fixed branch, with the knuckles following the forearm. Keep the
  // shaft normal to the hatch while rolling the grip gently around its axis.
  const rotation=new THREE.Quaternion().setFromAxisAngle(v(0,0,1),pose.tool ? 1.05 : 0).multiply(new THREE.Quaternion().setFromAxisAngle(pose.tool?v(0,1,0):v(1,0,0),-Math.PI/2));
  if(pose.tool)rotation.multiply(toolRotation.clone().invert());
  const workingRotation=rotation.clone().premultiply(new THREE.Quaternion().setFromAxisAngle(v(0,0,1),pose.twist));
  const tip=pose.tool?REPAIR_TOOL_TIP:v(0,-.15,.025);
  const wrist=target.sub(tip.clone().multiply(right.hand.scale).applyQuaternion(workingRotation));
  const rest=body.worldToLocal(right.hand.getWorldPosition(v())),restQ=right.hand.getWorldQuaternion(new THREE.Quaternion()).premultiply(body.getWorldQuaternion(new THREE.Quaternion()).invert());
  // Blend the fixed lifting branch first, then add the small tool roll. Slerping
  // directly toward a moving half-turn can flip its path at zero twist.
  const handRotation=restQ.slerp(rotation,weight).premultiply(new THREE.Quaternion().setFromAxisAngle(v(0,0,1),pose.twist*weight));
  placeRepairHand(right,rest.lerp(wrist,weight),handRotation,weight,pose.tool);
  relaxMiloHand(right);applyHatchRepairGrip(root,hatchRepairGripWeight(visit));
  // The free hand rests beside the body. The old partial "brace" stopped short
  // of the hatch and left its wrist hanging in midair throughout the repair.
}
