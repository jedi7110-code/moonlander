import * as THREE from 'three';
import {hingeAngles} from './gym.js';

const smooth=(t,a,b)=>THREE.MathUtils.smoothstep(t,a,b);
const lerp=THREE.MathUtils.lerp;

export function applyBedTransferPose(root,pose,{top,walkDepth,standingDepth,seatDepth},startYaw=0){
  const {body,head,arms,legs}=root.userData;
  const {seat,recline,turn,depth,phase,approach}=pose;
  const lay=smooth(recline,.25,1),angle=-Math.PI/2*lay,c=Math.cos(angle),s=Math.sin(angle);
  const support=Math.hypot(.134*c,.119*s),hipY=lerp(.988,top+support,seat);
  root.rotation.y=phase==='approaching'?startYaw+Math.atan2(Math.sin(-startYaw),Math.cos(-startYaw))*approach:Math.PI/2*turn;
  // Keep the pelvis supported while turning, lifting the feet and lowering the torso.
  body.rotation.set(angle,0,0);body.position.set(0,hipY-c*.988,-s*.988);
  head.rotation.set(-.05*seat*(1-lay),0,0);
  for(const {arm,elbow,hand,side}of arms){
    arm.rotation.set(lerp(.08*seat,-.1,lay),0,side*lerp(.025,.07,seat)*(1-lay));
    elbow.rotation.set(lerp(-.12,-.18,lay),0,0);hand.rotation.y=side*Math.PI/2*(1-seat);
  }
  for(const {leg,knee,boot,side}of legs){
    let ankleY,ankleZ,footPitch;
    if(['approaching','departing'].includes(phase)){
      const step=smooth(pose.age,side<0?0:.38,side<0?.62:1);
      const from=phase==='approaching'?walkDepth:standingDepth;
      const to=phase==='approaching'?standingDepth:walkDepth;
      ankleY=.110+Math.sin(Math.PI*step)*(from===to?0:.04);ankleZ=lerp(from,to,step)+.013-depth;footPitch=0;
    }else if(recline>0){
      const lift=smooth(recline,0,.32);
      ankleY=lerp(.110,top+.165,lift);
      ankleY=lerp(ankleY,top+.119+.013,smooth(recline,.78,1));
      ankleZ=lerp(standingDepth+.013-seatDepth,.80,lift);
      ankleZ=lerp(ankleZ,.878,smooth(recline,.48,1));
      footPitch=-Math.PI/2*smooth(recline,.6,1);
    }else{
      ankleY=.110;ankleZ=standingDepth+.013-depth;footPitch=0;
    }
    const y=ankleY-body.position.y,z=ankleZ-body.position.z;
    const angles=hingeAngles(c*y+s*z-leg.position.y,-s*y+c*z,.435,Math.hypot(.425,.013));
    leg.rotation.set(angles.upper,0,0);knee.rotation.set(angles.lower+Math.atan2(.013,.425),0,0);
    boot.rotation.set(footPitch-angle-leg.rotation.x-knee.rotation.x,0,0);
  }
  root.position.z=depth;
}
