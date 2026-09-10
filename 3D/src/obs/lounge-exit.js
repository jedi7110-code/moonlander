import * as THREE from 'three';
import {LOUNGE_SEAT} from './layout.js';
import {hingeAngles} from './gym.js';

export const LOUNGE_EXIT_SECONDS=2.8;
const smooth=(t,a,b)=>THREE.MathUtils.smoothstep(t,a,b);
export function loungeExitPose(age){
  const rise=smooth(age,.8,2),step=smooth(age,2,2.8);
  return {age,stow:smooth(age,0,.8),rise,step,depth:THREE.MathUtils.lerp(LOUNGE_SEAT.depth,.49,rise)+.29*step};
}

export function applyLoungeExit(root,exit){
  const {body,chest,head,arms,legs,leisure}=root.userData,{age,stow,rise,step,depth}=loungeExitPose(exit.age);
  // Finish handling belongings before shifting weight off the cushion.
  for(const key of ['tablet','phones','toy']){
    const prop=leisure[key];if(!prop.visible)continue;
    prop.position.lerp(new THREE.Vector3(.35,.86,-.03),stow);
    prop.quaternion.slerp(new THREE.Quaternion(),stow);
    if(stow===1)prop.visible=false;
  }
  for(const rig of arms){
    const {arm,elbow,hand,side}=rig;
    const settle=new THREE.Quaternion().setFromEuler(new THREE.Euler(-.34*(1-rise)-.05*rise,0,side*.025));
    arm.quaternion.slerp(settle,stow);elbow.rotation.x=THREE.MathUtils.lerp(elbow.rotation.x,-.55*(1-rise)-.08*rise,stow);
    hand.quaternion.slerp(new THREE.Quaternion(),stow);
  }
  const lean=Math.sin(Math.PI*smooth(age,.65,2))*.17,pivot=1.0;
  body.position.y=(LOUNGE_SEAT.top-(.988-.134))*(1-rise);
  chest.rotation.x=lean;chest.position.set(0,pivot*(1-Math.cos(lean)),-pivot*Math.sin(lean));
  head.position.set(0,pivot+(1.637-pivot)*Math.cos(lean)+.009*Math.sin(lean),(1.637-pivot)*Math.sin(lean)-.009*Math.cos(lean));
  head.rotation.x=THREE.MathUtils.lerp(head.rotation.x,-lean*.3,stow);
  for(const {leg,knee,boot,side}of legs){
    const stride=smooth(age,side<0?2:2.25,side<0?2.5:2.8);
    const lift=Math.sin(Math.PI*stride)*.045;
    const ankleZ=.503+.29*stride;
    const angles=hingeAngles(.107+lift-body.position.y-leg.position.y,ankleZ-depth,.435,Math.hypot(.425,.013));
    leg.rotation.set(angles.upper,0,0);knee.rotation.x=angles.lower+Math.atan2(.013,.425);
    boot.rotation.x=-(leg.rotation.x+knee.rotation.x);
  }
  return{depth,step};
}
