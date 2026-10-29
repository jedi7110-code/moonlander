import * as THREE from 'three';
import {LOUNGE_SEAT,LOUNGE_ACCESS,CABIN_AISLE,getStation} from './layout.js';
import {hingeAngles} from './gym.js';
import {applyAuthoredMiloTurn} from './milo-turn.js';
import {solveHingeArm} from './arm-ik.js';

export const LOUNGE_EXIT_SECONDS=8;
export const LOUNGE_ENTRY_SECONDS=8;
export const LOUNGE_TRANSITION_DECAY=.14;
export const loungeApproachX=()=>getStation('lounge').x+LOUNGE_ACCESS.sideX/.022;
export const loungeEntryAge=age=>LOUNGE_EXIT_SECONDS-THREE.MathUtils.clamp(age,0,LOUNGE_ENTRY_SECONDS);
export function applyLoungeEntry(root,entry){
  applyLoungeExit(root,{age:loungeEntryAge(entry.age),turnYaw:entry.startYaw??Math.PI/2});
  for(const prop of ['tablet','phones','toy'])root.userData.leisure[prop].visible=false;
}
const smooth=(t,a,b)=>THREE.MathUtils.smoothstep(t,a,b);
const ease=t=>{t=THREE.MathUtils.clamp(t,0,1);return t*t*t*(10+t*(-15+6*t));};
// Alternate the leading foot and the following foot. Each planted foot stays
// still while the other takes a short lateral step; neither crosses the other.
function passageSteps(age,start,end,count,from,to){
  const p=THREE.MathUtils.clamp((age-start)/(end-start),0,1)*count,index=Math.min(count-1,Math.floor(p)),u=p===count?1:p-index,s=ease(u);
  const first=to.x<from.x?-1:1,span=to.clone().sub(from).multiplyScalar(2/count);
  const feet=[-1,1].map(side=>{
    const order=side===first?0:1,done=Math.max(0,Math.ceil((index-order)/2)),swing=index%2===order;
    const position=from.clone().add(new THREE.Vector3(side*.1,.110,.013)).addScaledVector(span,done+(swing?s:0));
    if(swing)position.y+=.035*Math.sin(Math.PI*u)**2;
    return{side,position};
  });
  return{position:from.clone().addScaledVector(span,(index+s)/2),feet};
}
export function loungePassageFeet(age){
  const gap=new THREE.Vector3(0,0,LOUNGE_ACCESS.gapZ),side=new THREE.Vector3(LOUNGE_ACCESS.sideX,0,LOUNGE_ACCESS.gapZ);
  return age<=6.2?passageSteps(age,2.2,6.2,8,gap,side):passageSteps(age,6.2,7.2,2,side,new THREE.Vector3(LOUNGE_ACCESS.sideX,0,CABIN_AISLE.crewZ));
}
export function loungeExitPose(age){
  const rise=smooth(age,.8,2.2),step=smooth(age,2.2,7.2),passage=loungePassageFeet(age);
  return {age,stow:smooth(age,0,.8),rise,step,x:passage.position.x,
    depth:age<2.2?THREE.MathUtils.lerp(LOUNGE_SEAT.depth,LOUNGE_ACCESS.gapZ,rise)-.045*Math.sin(Math.PI*rise):passage.position.z,
    turn:smooth(age,7.2,LOUNGE_EXIT_SECONDS)};
}

export function applyLoungeExit(root,exit){
  root.userData.spineCurve=null;
  const {body,chest,head,arms,legs,leisure}=root.userData,{age,stow,rise,step,depth}=loungeExitPose(exit.age);
  const turn=smooth(age,7.2,LOUNGE_EXIT_SECONDS),turnYaw=exit.turnYaw??-Math.PI/2;
  root.rotation.y=.15*(1-rise)+turnYaw*turn;
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
    const relaxedHand=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),root.userData.bodySkin?side*Math.PI/2:0);
    if(age<.8){
      // Withdraw the fingers behind the edge before lowering the hands. A
      // joint-only blend lowers them straight through a close tabletop.
      const upper=arm.quaternion.clone(),lower=upper.clone().multiply(elbow.quaternion),rotation=lower.clone().multiply(hand.quaternion);
      const start=hand.position.clone().applyQuaternion(lower).add(elbow.position.clone().applyQuaternion(upper)).add(arm.position);
      const endLower=settle.clone().multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(-.55,0,0)));
      const end=hand.position.clone().applyQuaternion(endLower).add(elbow.position.clone().applyQuaternion(settle)).add(arm.position);
      const target=start.clone().lerp(end,smooth(age,.3,.8));target.z=THREE.MathUtils.lerp(start.z,end.z,smooth(age,0,.3));target.y+=.04*Math.sin(Math.PI*smooth(age,0,.8));
      const pole=elbow.position.clone().applyQuaternion(upper).lerp(elbow.position.clone().applyQuaternion(settle),stow);
      const pose=solveHingeArm(rig,target,pole);arm.quaternion.copy(pose.upper);elbow.quaternion.copy(pose.lower);
      hand.quaternion.copy(pose.upper).multiply(pose.lower).invert().multiply(rotation.slerp(endLower.clone().multiply(relaxedHand),stow));
    }else{
      arm.quaternion.copy(settle);elbow.rotation.set(-.55*(1-rise)-.08*rise,0,0);hand.quaternion.copy(relaxedHand);
    }
  }
  const lean=Math.sin(Math.PI*smooth(age,.65,2.2))*.17,pivot=1.0;
  body.position.x=0;body.position.z=0;
  body.position.y=(LOUNGE_SEAT.top-(.988-.134))*(1-rise);
  chest.rotation.x=lean;chest.position.set(0,pivot*(1-Math.cos(lean)),-pivot*Math.sin(lean));
  head.position.set(0,pivot+(1.637-pivot)*Math.cos(lean)+.009*Math.sin(lean),(1.637-pivot)*Math.sin(lean)-.009*Math.cos(lean));
  head.rotation.x=THREE.MathUtils.lerp(head.rotation.x,-lean*.3,stow);
  for(const {leg,knee,boot,side}of legs){
    const tuck=smooth(age,side<0?.05:.4,side<0?.35:.7),ankleZ=THREE.MathUtils.lerp(.503,LOUNGE_ACCESS.gapZ+.013,tuck);
    const ankleY=THREE.MathUtils.lerp(.113,.110,tuck)+.018*Math.sin(Math.PI*tuck)**2;
    const angles=hingeAngles(ankleY-body.position.y-leg.position.y,ankleZ-depth,.435,Math.hypot(.425,.013));
    leg.rotation.set(angles.upper,0,0);knee.rotation.x=angles.lower+Math.atan2(.013,.425);
    boot.rotation.x=-(leg.rotation.x+knee.rotation.x);
  }
  if(age>=2.2&&age<=7.2){
    const passage=loungePassageFeet(age),targets=passage.feet.map(foot=>({...foot,position:foot.position.clone().sub(passage.position)}));
    // Lower the pelvis just enough to keep both real leg lengths reachable.
    body.position.y=0;
    for(const {leg,knee,boot,side}of legs){
      const target=targets.find(f=>f.side===side).position,length=knee.position.length()+boot.position.length()-.00001;
      body.position.y=Math.min(body.position.y,target.y+Math.sqrt(Math.max(.01,length*length-(target.x-leg.position.x)**2-target.z**2))-leg.position.y);
    }
    for(const {leg,knee,boot,side}of legs){
      const target=targets.find(f=>f.side===side).position,dx=target.x-leg.position.x,dy=target.y-body.position.y-leg.position.y;
      const angles=hingeAngles(-Math.hypot(dx,dy),target.z,knee.position.length(),boot.position.length());
      leg.quaternion.setFromAxisAngle(new THREE.Vector3(0,0,1),Math.atan2(dx,-dy)).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(angles.upper,0,0)));
      knee.rotation.set(angles.lower+Math.atan2(.013,.425),0,0);boot.quaternion.copy(leg.quaternion).multiply(knee.quaternion).invert();
    }
  }
  if(age>=7.2)applyAuthoredMiloTurn(root,0,turnYaw,turn,{upperBody:false});
  return loungeExitPose(age);
}
