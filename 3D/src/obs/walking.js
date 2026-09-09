import * as THREE from 'three';
import {hingeAngles} from './gym.js';

export const WALK={cycleDistance:1.04,stance:.60,front:.312,clearance:.135,floor:.006};
const smooth=t=>{t=THREE.MathUtils.clamp(t,0,1);return t*t*(3-2*t);};

export function walkingFoot(distance,side){
  const phase=((distance/WALK.cycleDistance+(side<0?.5:0))%1+1)%1;
  const planted=phase<WALK.stance;
  let z,pitch,lift=0;
  if(planted){
    z=WALK.front-WALK.cycleDistance*phase;
    pitch=-.20*(1-smooth(phase/.09))+.36*smooth((phase-.45)/.15);
  }else{
    const t=(phase-WALK.stance)/(1-WALK.stance),t2=t*t,t3=t2*t;
    const start=WALK.front-WALK.cycleDistance*WALK.stance,tangent=-WALK.cycleDistance*(1-WALK.stance);
    z=(2*t3-3*t2+1)*start+(t3-2*t2+t)*tangent+(-2*t3+3*t2)*WALK.front+(t3-t2)*tangent;
    lift=WALK.clearance*Math.sin(t*Math.PI)**2;
    pitch=.36-.56*smooth(t);
  }
  // Roll around the heel/toe contact without dragging the planted sole along the floor.
  const pivotZ=pitch<0?-.106:.154,pivotY=-.107;
  const y=WALK.floor+lift-(Math.cos(pitch)*pivotY-Math.sin(pitch)*pivotZ);
  z+=pivotZ-(Math.sin(pitch)*pivotY+Math.cos(pitch)*pivotZ);
  return{phase,planted,y,z,pitch,lift,pivotZ};
}

export function applyWalkingPose(root,distance){
  const {body,chest,head,arms,legs}=root.userData,phase=distance/WALK.cycleDistance*Math.PI*2;
  body.position.y=-.030+.025*Math.cos(phase*2-Math.PI*1.2);
  chest.rotation.set(.025,-.035*Math.sin(phase),.012*Math.sin(phase));
  head.rotation.set(-.015,-.022*Math.sin(phase),-.006*Math.sin(phase));
  // Keep the base of the scanned neck attached while the chest leans and turns.
  chest.updateMatrix();
  head.position.set(0,1.607,0).applyMatrix4(chest.matrix)
    .sub(new THREE.Vector3(0,-.030,.009).applyQuaternion(head.quaternion));
  for(const {leg,knee,boot,side} of legs){
    const foot=walkingFoot(distance,side);
    const angles=hingeAngles(foot.y-body.position.y-leg.position.y,foot.z,.435,Math.hypot(.425,.013));
    leg.rotation.set(angles.upper,0,0);knee.rotation.set(angles.lower+Math.atan2(.013,.425),0,0);
    boot.rotation.set(foot.pitch-leg.rotation.x-knee.rotation.x,0,0);
  }
  for(const {arm,elbow,hand,side}of arms){
    const swing=Math.cos(phase+(side<0?Math.PI:0));
    arm.rotation.x=.27*swing-.04;elbow.rotation.x=-.19-.08*(1-swing);
    hand.rotation.y=side*Math.PI/2;
  }
}
