import {MathUtils} from 'three';
import {animateMilo} from '../../src/obs/characters.js';
import {BunkVisit} from '../../src/obs/bunk-visit.js';
import {medicalTransferPose,medicalDuration} from '../../src/obs/medical.js';
import {BED_ENTRY_SECONDS} from '../../src/obs/bed-entry.js';

export const ENTRY_STUDY={bunk:{start:6.95,end:14.05},medical:{start:5.05,end:10.05}};
export const SEQUENTIAL_SECONDS=BED_ENTRY_SECONDS;
const extra=SEQUENTIAL_SECONDS-3;

// The improved column runs the same timeline and pose as OBS. Keep the old
// simultaneous transfer available only as an explicit comparison.
export function sampleBedEntry(kind,time,sequential=true){
  const config=ENTRY_STUDY[kind],age=time-config.start;
  const actionDuration=medicalDuration()-(sequential?0:extra*2);
  let visit=null,pose;
  if(kind==='bunk'){visit=new BunkVisit({sequential});visit.startYaw=0;visit.update(time);pose=visit.pose;}
  else pose=medicalTransferPose(time,actionDuration,{sequential});
  const u=MathUtils.clamp(age/SEQUENTIAL_SECONDS,0,1),active=sequential&&age>=0&&age<=SEQUENTIAL_SECONDS;
  const stages={approaching:'ベッドに近づく',opening:'カバーを開ける',extending:'トレーを引き出す',sitting:'腰を下ろす',settled:'座面で支える',elevating:'治療台を上げる',raised:'座面で支える',lowering:'両足を持ち上げる',entering:'ベッドを戻す',closing:'カバーを閉じる',sleeping:'横になる',deploying:'診察位置へ',examining:'診察位置'};
  const stage=active?(u<.22?'左足を持ち上げる':u<.42?'左足を先に乗せる':u<.66?'右足を持ち上げる':u<.84?'右足を乗せる':'上体をゆっくり倒す'):stages[pose.phase]??pose.phase;
  return {kind,time,sourceTime:time,visit,pose,u,active,stage,sequential,actionDuration,duration:config.end+(sequential?extra:0)+.6};
}

export function applyBedEntry(root,sample){
  const {kind,sourceTime,visit,actionDuration,sequential}=sample;
  root.userData.medicalStartYaw=0;
  animateMilo(root,{moving:false,facing:1,action:kind==='bunk'?'bunk':'medical',time:0,actionTime:sourceTime,actionDuration,bunkVisit:visit,sequentialBedEntry:sequential});
}
