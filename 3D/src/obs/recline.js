import * as THREE from 'three';
import {getStation} from './layout.js';

export const BUNK_BED={depth:-.26,top:.59,length:2.3,width:1.19,transition:2,duration:getStation('bunk').dur/1000};
export const BUNK_TRAY={travel:.64,walkDepth:.78,standingDepth:1.25,seatDepth:.82};

export function reclineProgress(time,duration,transition=2){
  const t=THREE.MathUtils.clamp(Math.min(time,duration-time)/transition,0,1);
  return t*t*(3-2*t);
}

export const RECLINE_EXIT_SECONDS=2;
export function reclineExitProgress(exit){return exit.progress*(1-THREE.MathUtils.smoothstep(exit.age,0,RECLINE_EXIT_SECONDS));}

export function applyReclinedPose(root,progress,top){
  const angle=-Math.PI/2*progress,hip=.988;
  const {body,head,arms,legs}=root.userData;
  root.rotation.y=Math.PI/2;
  // Pivot at the hips, keeping the back on the support instead of rotating about the feet.
  body.rotation.x=angle;
  const seated=THREE.MathUtils.smoothstep(progress,0,.3);
  body.position.set(0,hip+(top+.12-hip)*seated-Math.cos(angle)*hip,-Math.sin(angle)*hip);
  head.rotation.set(0,0,0);
  for(const {arm,elbow}of arms){arm.rotation.x=-.1;elbow.rotation.x=-.18;}
  const sitting=Math.sin(progress*Math.PI);
  for(const {leg,knee,boot}of legs){leg.rotation.x=-1.25*sitting;knee.rotation.x=1.4*sitting;boot.rotation.x=-.15*sitting;}
}
