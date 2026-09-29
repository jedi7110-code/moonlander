import * as THREE from 'three';
import {placeHand} from './dining.js';
import {relaxMiloHand} from './milo-hands.js';
import {applyAuthoredMiloTurn} from './milo-turn.js';
import {applyMocapWalk,miloWalkData} from './mocap-walk.js';

const v=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);
export const HATCH_SERVICE_POINT={x:12.656,y:1.26,z:.06};
export const REPAIR_TOOL_TIP=new THREE.Vector3(0,-.245,.025);

export function attachHatchRepairTool(root){
  const tool=new THREE.Group();tool.name='Hatch repair screwdriver';tool.visible=false;
  root.userData.arms[0].hand.add(tool);root.userData.repairTool=tool;
  const grip=new THREE.Mesh(new THREE.CylinderGeometry(.018,.018,.082,8),new THREE.MeshStandardMaterial({color:0x966942,roughness:.78}));
  grip.position.set(0,-.089,.025);tool.add(grip);
  const shaft=new THREE.Mesh(new THREE.CylinderGeometry(.0035,.0035,.115,6),new THREE.MeshStandardMaterial({color:0xa6aca6,metalness:.65,roughness:.4}));
  shaft.position.set(0,-.1875,.025);tool.add(shaft);
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
  if(!weight)return;
  root.updateWorldMatrix(true,true);
  const right=arms[0],left=arms[1];
  const target=body.worldToLocal(v(HATCH_SERVICE_POINT.x,root.position.y+HATCH_SERVICE_POINT.y,HATCH_SERVICE_POINT.z));
  const rotation=new THREE.Quaternion().setFromAxisAngle(v(0,0,1),pose.twist).multiply(new THREE.Quaternion().setFromAxisAngle(v(1,0,0),-Math.PI/2));
  const tip=pose.tool?REPAIR_TOOL_TIP:v(0,-.15,.025);
  const wrist=target.sub(tip.clone().multiply(right.hand.scale).applyQuaternion(rotation));
  const rest=body.worldToLocal(right.hand.getWorldPosition(v())),restQ=right.hand.getWorldQuaternion(new THREE.Quaternion()).premultiply(body.getWorldQuaternion(new THREE.Quaternion()).invert());
  placeHand(right,rest.lerp(wrist,weight),restQ.slerp(rotation,weight),pose.tool?weight:.15*weight);
  const brace=body.worldToLocal(v(HATCH_SERVICE_POINT.x-.045,root.position.y+1.44,-.29));
  const leftRest=body.worldToLocal(left.hand.getWorldPosition(v()));
  const leftQ=left.hand.getWorldQuaternion(new THREE.Quaternion()).premultiply(body.getWorldQuaternion(new THREE.Quaternion()).invert());
  placeHand(left,leftRest.lerp(brace,weight*.6),leftQ.slerp(new THREE.Quaternion().setFromAxisAngle(v(1,0,0),-1.1),weight*.6),.12*weight);
}
