import {Vector3,MathUtils} from 'three';
import {applyLoungeConversation} from './lounge-conversation.js';
import {applySeatedLegSpread} from './seated-pose.js';
import {solveHingeArm} from './arm-ik.js';
import {relaxMiloHand} from './milo-hands.js';

const joints=rig=>[rig.arm,rig.elbow,rig.hand,...rig.fingers.flatMap(f=>[f,...f.userData.links]),rig.thumb,rig.thumb.userData.ip];
const capture=arms=>arms.map(rig=>joints(rig).map(joint=>joint.quaternion.clone()));

// Build three authored arm poses once. Re-solving a thigh contact every frame
// while the leg straightens can switch the elbow plane and flap the forearm.
export function prepareLoungeRise(root,exit){
  if(root.userData.loungeRise?.exit===exit)return;
  const {arms,legs,head,chest}=root.userData;
  const lower=legs.flatMap(({leg,knee,boot})=>[leg,knee,boot]),saved=lower.map(joint=>joint.quaternion.clone());
  applySeatedLegSpread(root);
  applyLoungeConversation(root,exit.conversation??{age:0,weight:0});
  const start=capture(arms),headStart=head.rotation.clone(),chestYaw=chest.rotation.y;
  const palms=legs.map(({leg})=>leg.quaternion.clone());
  for(const [i,rig]of arms.entries()){
    const pose=solveHingeArm(rig,new Vector3(rig.side*.31,1.12,.18),new Vector3(rig.side*.10,-.7,-.20));
    rig.arm.quaternion.copy(pose.upper);rig.elbow.quaternion.copy(pose.lower);
    rig.hand.quaternion.copy(pose.upper).multiply(pose.lower).invert().multiply(palms[i]);
    relaxMiloHand(rig);
  }
  const release=capture(arms);
  for(const rig of arms){
    rig.arm.rotation.set(-.05,0,rig.side*.025);rig.elbow.rotation.set(-.08,0,0);
    rig.hand.rotation.set(0,root.userData.bodySkin?rig.side*Math.PI/2:0,0);relaxMiloHand(rig);
  }
  root.userData.loungeRise={exit,start,release,standing:capture(arms),headStart,chestYaw};
  lower.forEach((joint,i)=>joint.quaternion.copy(saved[i]));
}

export function applyLoungeRise(root,exit){
  const pose=root.userData.loungeRise,age=exit.age;
  const from=age<.8?pose.start:pose.release,to=age<.8?pose.release:pose.standing;
  const blend=age<.8?MathUtils.smoothstep(age,0,.8):MathUtils.smoothstep(age,.8,2.2);
  root.userData.arms.forEach((rig,i)=>joints(rig).forEach((joint,j)=>joint.quaternion.slerpQuaternions(from[i][j],to[i][j],blend)));
  const settle=MathUtils.smoothstep(age,0,1.2),head=root.userData.head;
  root.userData.chest.rotation.y=pose.chestYaw*(1-MathUtils.smoothstep(age,0,.8));
  head.rotation.x=MathUtils.lerp(pose.headStart.x,head.rotation.x,settle);
  head.rotation.y=pose.headStart.y*(1-settle);head.rotation.z=pose.headStart.z*(1-settle);
}
