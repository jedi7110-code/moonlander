import * as THREE from 'three';
import {solveHingeArm} from './arm-ik.js';

// Externally rotate each thigh around its hip-to-ankle axis. The knees open
// without sliding the feet, stretching a limb or adding a sideways knee hinge.
export function applySeatedLegSpread(root,weight=1){
  for(const {leg,knee,boot,side}of root.userData.legs){
    const ankle=boot.position.clone().applyQuaternion(knee.quaternion).add(knee.position).applyQuaternion(leg.quaternion);
    const spread=new THREE.Quaternion().setFromAxisAngle(ankle.normalize(),-side*.42*weight);
    leg.quaternion.premultiply(spread);
    const toeOut=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),side*.12*weight);
    boot.quaternion.copy(leg.quaternion).multiply(knee.quaternion).invert().multiply(toeOut);
  }
}

// Place the whole palm on the matching thigh, following the actual hip and
// knee rotations. Fixed arm angles leave downward fingers inside the trousers.
export function applyThighHands(root,weight=1,handWeights=null){
  const {arms,legs}=root.userData;
  for(const [index,rig]of arms.entries()){
    const w=THREE.MathUtils.clamp(weight*(handWeights?.[index]??1),0,1);if(w<=0)continue;
    const thigh=legs.find(leg=>leg.side===rig.side).leg;
    const normal=new THREE.Vector3(0,0,1).applyQuaternion(thigh.quaternion);
    const rest=new THREE.Vector3(0,-.20,.154).applyQuaternion(thigh.quaternion).add(thigh.position);
    const lower=rig.arm.quaternion.clone().multiply(rig.elbow.quaternion);
    const wrist=rig.hand.position.clone().applyQuaternion(lower).add(rig.elbow.position.clone().applyQuaternion(rig.arm.quaternion)).add(rig.arm.position);
    const rotation=lower.clone().multiply(rig.hand.quaternion).slerp(thigh.quaternion,w);
    wrist.lerp(rest,w).addScaledVector(normal,.018*Math.sin(Math.PI*w));
    const pose=solveHingeArm(rig,wrist,new THREE.Vector3(rig.side*.10,-.7,-.20));
    rig.arm.quaternion.copy(pose.upper);rig.elbow.quaternion.copy(pose.lower);
    rig.hand.quaternion.copy(pose.upper).multiply(pose.lower).invert().multiply(rotation);
    for(const finger of rig.fingers){
      finger.rotation.x=THREE.MathUtils.lerp(finger.rotation.x,0,w);
      for(const link of finger.userData.links)link.rotation.x=THREE.MathUtils.lerp(link.rotation.x,0,w);
    }
    rig.thumb.rotation.x=THREE.MathUtils.lerp(rig.thumb.rotation.x,.10,w);
    rig.thumb.rotation.z=THREE.MathUtils.lerp(rig.thumb.rotation.z,rig.side*.08,w);
    rig.thumb.userData.ip.rotation.x=THREE.MathUtils.lerp(rig.thumb.userData.ip.rotation.x,.10,w);
  }
}
