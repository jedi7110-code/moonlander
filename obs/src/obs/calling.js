import {MathUtils} from 'three';

export function callingWeight(age){
  if(age===null)return 0;
  return MathUtils.smoothstep(age,.45,1.85)*(1-MathUtils.smoothstep(age,2.25,3.65));
}

export function applyCallingPose(root,age,dt){
  const {arms,head}=root.userData;
  // One quiet invitation, with a soft release even when the player interrupts it.
  const weight=MathUtils.damp(root.userData.callingWeight??0,callingWeight(age),10,dt);
  root.userData.callingWeight=weight<.0001?0:weight;
  if(weight<.0001)return;
  const {arm,elbow,hand,fingers,thumb}=arms.find(limb=>limb.side===1);
  arm.rotation.x=MathUtils.lerp(arm.rotation.x,-.38,weight);
  arm.rotation.z=MathUtils.lerp(arm.rotation.z,.13,weight);
  elbow.rotation.x=MathUtils.lerp(elbow.rotation.x,-2.05,weight);
  hand.rotation.x=MathUtils.lerp(hand.rotation.x,-.15,weight);
  hand.rotation.y=MathUtils.lerp(hand.rotation.y,-.25,weight);
  for(const finger of fingers){
    finger.rotation.x=MathUtils.lerp(finger.rotation.x,.18,weight);
    for(const link of finger.userData.links)link.rotation.x=MathUtils.lerp(link.rotation.x,.12,weight);
  }
  thumb.rotation.z=MathUtils.lerp(thumb.rotation.z,-.12,weight);
  head.rotation.x=MathUtils.lerp(head.rotation.x,.025,weight);
}
