import {MathUtils} from 'three';
import {createMilo,animateMilo} from '../../src/obs/characters.js';
import {createLounge,positionX} from '../../src/obs/ship.js';
import {getStation,LOUNGE_SEAT} from '../../src/obs/layout.js';
import {LOUNGE_ENTRY_SECONDS,LOUNGE_EXIT_SECONDS,loungeEntryAge,loungeExitPose} from '../../src/obs/lounge-exit.js';
import {LOUNGE_STOW_SECONDS} from '../../src/obs/lounge-handling.js';
import {updateTableLeisureProps} from '../../src/obs/lounge-table-props.js';

export const LOUNGE_STUDY_ITEMS={tablet:'パッド端末',music:'ヘッドホン',cat:'猫じゃらし'};
const useSeconds=7,putStart=LOUNGE_ENTRY_SECONDS+useSeconds,standStart=putStart+LOUNGE_STOW_SECONDS;
export const LOUNGE_STUDY_PHASES=[
  {id:'enter',label:'横歩きで入る',time:0},
  {id:'sit',label:'座る',time:LOUNGE_ENTRY_SECONDS-2.2},
  {id:'take',label:'手に取る',time:LOUNGE_ENTRY_SECONDS},
  {id:'use',label:'使う',time:LOUNGE_ENTRY_SECONDS+4.25},
  {id:'put',label:'元へ戻す',time:putStart},
  {id:'stand',label:'立ち上がる',time:standStart},
  {id:'leave',label:'横歩きで出る',time:standStart+2.2},
];
export const LOUNGE_STUDY_DURATION=standStart+LOUNGE_EXIT_SECONDS;

export function sampleLoungeStudy(item,time){
  const kind=Object.hasOwn(LOUNGE_STUDY_ITEMS,item)?item:'tablet';
  const t=MathUtils.clamp(Number.isFinite(time)?time:0,0,LOUNGE_STUDY_DURATION);
  const entry=t<LOUNGE_ENTRY_SECONDS?{age:t,startYaw:Math.PI/2}:null;
  const exit=t>=standStart?{age:t-standStart}:null;
  const stow=t>=putStart&&!exit?{age:t-putStart,leisure:kind,actionTime:useSeconds}:null;
  const phase=[...LOUNGE_STUDY_PHASES].reverse().find(p=>t>=p.time);
  const passage=entry?loungeExitPose(loungeEntryAge(entry.age)):exit?loungeExitPose(exit.age):{x:0,depth:LOUNGE_SEAT.depth};
  return{time:t,phase,leisure:exit?null:kind,actionTime:MathUtils.clamp(t-LOUNGE_ENTRY_SECONDS,0,useSeconds),
    x:passage.x,depth:passage.depth,
    entry,stow,exit};
}

export function createLoungeStudyActors(materials,head){
  const milo=createMilo(materials,head),furniture=createLounge(materials);
  furniture.position.x=-positionX(getStation('lounge').x);
  return{milo,furniture};
}

export function applyLoungeStudy({milo,furniture},item,time){
  const sample=sampleLoungeStudy(item,time);
  milo.position.set(sample.x,0,sample.depth);milo.rotation.set(0,.15,0);
  animateMilo(milo,{moving:false,climbing:false,facing:1,dt:0,time:sample.time,action:'lounge',
    actionTime:sample.actionTime,actionDuration:40,leisure:sample.leisure,catReady:true,
    loungeEntry:sample.entry,loungeStow:sample.stow,loungeExit:sample.exit,loungeDocks:furniture.userData.loungeProps});
  updateTableLeisureProps(furniture.userData.loungeProps,milo.userData.leisure);
  milo.updateMatrixWorld(true);furniture.updateMatrixWorld(true);
  return sample;
}
