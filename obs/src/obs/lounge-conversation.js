import {MathUtils} from 'three';
import {getStation,LOUNGE_SEAT} from './layout.js';
import {loungeExitPose,loungeExitPoseAge,loungeEntryPoseAge,LOUNGE_COMPANION_ACCESS} from './lounge-exit.js';

export const LOUNGE_COMPANION_GAP=1.20;
export const loungeActorX=worldX=>700+worldX/.022;
export function loungeCompanionAvailable(peer){
  return Boolean(peer?.active&&peer.floor===1&&['sit','relax'].includes(peer.step?.kind));
}
// Rendering and traffic must use exactly the same seat and transition path.
export function loungeWorldPose(brain){
  const entry=brain.loungeEntry,exit=brain.loungeExit;
  const companion=brain.loungeCompanion;
  const access=companion?LOUNGE_COMPANION_ACCESS:undefined;
  const pose=entry?loungeExitPose(loungeEntryPoseAge(entry),access):exit?loungeExitPose(loungeExitPoseAge(exit),access):{x:0,depth:LOUNGE_SEAT.depth};
  return{x:(companion?.seatX??(getStation('lounge').x-700)*.022)+pose.x,z:pose.depth};
}
export function conversationTurn(age,role='milo'){
  const phase=((age%10)+10)%10,local=phase-(role==='curtis'?5:0);
  return MathUtils.smoothstep(local,.2,1)*(1-MathUtils.smoothstep(local,3.6,4.6));
}
export function applyLoungeConversation(root,{age,weight,role='milo'}){
  const {chest,head,arms,leisure}=root.userData,side=role==='curtis'?1:-1;
  const talking=conversationTurn(age,role),listening=conversationTurn(age,role==='curtis'?'milo':'curtis');
  const gesture=talking*(.55+.45*Math.sin(age*2.3)**2),w=MathUtils.clamp(weight,0,1);
  root.rotation.y=MathUtils.lerp(.15,side*.32,w);
  chest.rotation.y=side*.10*w;
  head.rotation.y=MathUtils.lerp(head.rotation.y,side*(.57+.04*Math.sin(age*.6)),w);
  head.rotation.x=(-.025+.045*listening*Math.sin(age*3.1))*w;
  head.rotation.z=side*.018*listening*w;
  for(const {arm,elbow,hand,side:armSide}of arms){
    const active=armSide===side?gesture:0;
    // Hands rest on the thighs between short, alternating speaking gestures.
    arm.rotation.set(MathUtils.lerp(role==='curtis'?-.15:-.34,-.20,w)-.26*active*w,side*.035*w,armSide*(MathUtils.lerp(role==='curtis'?.08:.025,.06,w)+.06*active*w));
    elbow.rotation.set(MathUtils.lerp(role==='curtis'?-.65:-.55,-.68,w)-.50*active*w,0,0);
    hand.rotation.set(.10-.13*active*w,root.userData.bodySkin?armSide*Math.PI/2:0,armSide*.08*active*w);
  }
  for(const key of ['tablet','phones','toy'])leisure[key].visible=false;
}
