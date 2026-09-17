// Reproducible review of the same transfer used by the cabin.
import {animateMilo} from '../../src/obs/characters.js';
import {animateGym} from '../../src/obs/gym.js';
import {BIKE,GYM_TRANSFER_SECONDS,GYM_POSE_END,GYM_LEFT_SIDE,sampleGymTransfer} from '../../src/obs/gym-pose.js';

export const GYM_STUDY_MOUNT_SECONDS=GYM_TRANSFER_SECONDS;
export const GYM_STUDY_DISMOUNT_SECONDS=GYM_TRANSFER_SECONDS;
const SEATED_HOLD=1,STANDING_HOLD=1;
export const GYM_STUDY_DURATION=GYM_STUDY_MOUNT_SECONDS+SEATED_HOLD+GYM_STUDY_DISMOUNT_SECONDS+STANDING_HOLD;
export const STUDY_LEFT_SIDE=GYM_LEFT_SIDE;
export const sampleLeftStep=sampleGymTransfer;
export function sampleGymStudyTime(seconds){
  const t=Math.max(0,Math.min(GYM_STUDY_DURATION,seconds));
  if(t<GYM_STUDY_MOUNT_SECONDS)return {phase:'mount',poseTime:GYM_POSE_END*t/GYM_STUDY_MOUNT_SECONDS};
  const start=GYM_STUDY_MOUNT_SECONDS+SEATED_HOLD;
  if(t<start)return {phase:'seated',poseTime:GYM_POSE_END};
  if(t<start+GYM_STUDY_DISMOUNT_SECONDS)return {phase:'dismount',poseTime:GYM_POSE_END*(1-(t-start)/GYM_STUDY_DISMOUNT_SECONDS)};
  return {phase:'standing',poseTime:0};
}
export function applyGymStudy(gym,milo,seconds){
  const timeline=sampleGymStudyTime(seconds),time=timeline.poseTime;
  milo.position.set(0,0,BIKE.depth);milo.rotation.y=Math.PI/2;
  const visit={startYaw:Math.PI/2,pose:{turn:1,transferTime:time,pedalTime:0}};
  animateMilo(milo,{action:'gym',moving:false,facing:1,time:0,dt:0,gymVisit:visit});
  animateGym(gym,0);
  if(timeline.phase==='standing')return '降車完了・停止（確認用）';
  if(timeline.phase==='seated')return '着席・両足をステップに置いて保持';
  if(timeline.phase==='dismount')return time>8.8?'サドルから腰を上げる':time>6?'左足で支え、右足から床へ戻す':time>1?'右足で支え、左足を車輪の上から戻す':'両足で立ち、ハンドルから手を離す';
  return sampleGymTransfer(time).stage;
}
