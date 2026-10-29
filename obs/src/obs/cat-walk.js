import {MathUtils} from 'three';
import {hingeAngles} from './gym.js';

export const CAT_WALK={stride:.50,stance:.62,lift:.066,pawHeight:.036};
export const CAT_LIMBS={
  front:{upper:.160,lower:.180,distal:.042,height:.398,z:.20,bend:-1},
  rear:{upper:.175,lower:.170,distal:.108,height:.377,z:-.265,bend:1}
};
const smooth=t=>t*t*(3-2*t);

export function catFootfall(distance,side,rear){
  // Four separate contacts: left hind, left fore, right hind, right fore.
  const offset=(side===1?.5:0)+(rear?0:.25);
  const phase=((distance/CAT_WALK.stride-offset)%1+1)%1;
  const {stride,stance,lift}=CAT_WALK,reach=stride*stance/2;
  let z=reach-stride*phase,y=0,curl=0;
  if(phase>stance){
    const t=(phase-stance)/(1-stance),s=smooth(t);
    z=-reach+2*reach*s-stride*(1-stance)*(2*t*t*t-3*t*t+t);
    y=lift*Math.sin(Math.PI*t)**2;
    curl=.24*Math.sin(Math.PI*t)**2;
  }
  return{phase,planted:phase<=stance,y:CAT_WALK.pawHeight+y,z:(rear?-.215:.205)+z,curl};
}

export function placeCatPaw(leg,x,y,z,weight=1){
  const {hip,knee,ankle,foot,anatomy,body,rear}=leg;
  const dx=x-hip.position.x,dy=y-hip.position.y,dz=z-hip.position.z;
  const roll=Math.atan2(dx,-dy),vertical=-Math.hypot(dx,dy);
  // The elevated hind hock leads into a long metatarsus; the fore wrist is short.
  const distalPitch=rear?-.42:-.10;
  const angles=hingeAngles(vertical+anatomy.distal*Math.cos(distalPitch),dz+anatomy.distal*Math.sin(distalPitch),anatomy.upper,anatomy.lower,anatomy.bend);
  hip.rotation.set(MathUtils.lerp(hip.rotation.x,angles.upper,weight),0,roll*weight,'ZXY');
  knee.rotation.set(MathUtils.lerp(knee.rotation.x,angles.lower,weight),0,0);
  ankle.rotation.set(MathUtils.lerp(ankle.rotation.x,distalPitch-angles.upper-angles.lower,weight),0,0);
  foot.quaternion.copy(body.quaternion).multiply(hip.quaternion).multiply(knee.quaternion).multiply(ankle.quaternion).invert();
}

export function applyCatLegPose(root,{distance,moving,resting}){
  const {body,legs}=root.userData;
  for(const leg of legs){
    const target=moving?catFootfall(distance,leg.side,leg.rear):{y:CAT_WALK.pawHeight,z:leg.rear?-.215:.205};
    if(resting)target.z=MathUtils.lerp(target.z,leg.rear?-.15:.23,Number(resting));
    const shoulderSlide=!leg.rear&&moving?target.z-.205:0;
    leg.hip.position.set(leg.side*.101,leg.anatomy.height-Math.abs(shoulderSlide)*.10,leg.anatomy.z+shoulderSlide*.20);
    const y=(target.y-body.position.y)/body.scale.y;
    placeCatPaw(leg,leg.side*.101,y,target.z/body.scale.z);
    if(target.curl)leg.foot.rotateX(target.curl);
  }
}
