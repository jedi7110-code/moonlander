import * as THREE from 'three';
import {LADDER,applyLadderPose} from './ladder-pose.js';
import {CABIN_AISLE} from './layout.js';

export const CABIN_LADDER={rungBase:.12,depth:.03,transfer:.42};
export const ladderTimeAtHeight=height=>(height-CABIN_LADDER.rungBase)/(2*LADDER.spacing)*LADDER.duration;

// Absolute height locks held hands/feet to the physical rungs in either direction,
// including pause and mid-shaft retargeting. Only the deck transfers blend out.
export function applyCabinLadder(root,{height,startHeight,endHeight,startYaw,endYaw}){
  const from=Math.abs(height-startHeight),to=Math.abs(endHeight-height);
  const weight=THREE.MathUtils.smoothstep(Math.min(from,to),0,CABIN_LADDER.transfer);
  const {body,head,arms,legs}=root.userData;
  const nodes=[body,head,...arms.flatMap(a=>[a.arm,a.elbow,a.hand,...a.fingers.flatMap(f=>[f,...f.userData.links]),a.thumb,a.thumb.userData.ip]),...legs.flatMap(l=>[l.leg,l.knee,l.boot])];
  const rest=nodes.map(node=>({position:node.position.clone(),rotation:node.quaternion.clone()}));
  root.position.z=THREE.MathUtils.lerp(CABIN_AISLE.crewZ,CABIN_LADDER.depth+LADDER.depth,weight);
  const yaw=from<to?startYaw:endYaw;
  root.rotation.y=yaw+Math.atan2(Math.sin(Math.PI-yaw),Math.cos(Math.PI-yaw))*weight;
  // Hold the adjacent climbing pose during the transfer. Changing gait phase
  // while interpolating from idle can switch a shoulder's shortest rotation arc.
  const poseHeight=THREE.MathUtils.clamp(height,Math.min(startHeight,endHeight)+CABIN_LADDER.transfer,Math.max(startHeight,endHeight)-CABIN_LADDER.transfer);
  const sample=applyLadderPose(root,ladderTimeAtHeight(poseHeight));
  nodes.forEach((node,i)=>{node.position.lerpVectors(rest[i].position,node.position.clone(),weight);node.quaternion.slerpQuaternions(rest[i].rotation,node.quaternion.clone(),weight);});
  root.userData.updateWristTwists?.();
  return {...sample,weight};
}
