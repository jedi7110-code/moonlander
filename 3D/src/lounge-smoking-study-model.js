import {MathUtils} from 'three';
import {createMilo,animateMilo} from './obs/characters.js';
import {createLounge,positionX} from './obs/ship.js';
import {getStation,LOUNGE_SEAT} from './obs/layout.js';
import {LOUNGE_ENTRY_SECONDS,LOUNGE_EXIT_SECONDS,loungeEntryAge,loungeExitPose} from './obs/lounge-exit.js';
import {SmokingVisit,LOUNGE_SMOKING_SECONDS} from './obs/smoking-visit.js';
import {updateTableLeisureProps} from './obs/lounge-table-props.js';
import {seekSmokingSmoke} from './obs/smoking-props.js';

const finish=LOUNGE_ENTRY_SECONDS+LOUNGE_SMOKING_SECONDS;
export const LOUNGE_SMOKING_STUDY_DURATION=finish+LOUNGE_EXIT_SECONDS;
export const LOUNGE_SMOKING_STUDY_PHASES=[
  {id:'enter',label:'入る',time:0},
  {id:'sit',label:'座る',time:LOUNGE_ENTRY_SECONDS-2.2},
  {id:'light',label:'火をつける',time:LOUNGE_ENTRY_SECONDS+3.4},
  {id:'smoke',label:'吸う',time:LOUNGE_ENTRY_SECONDS+9.8},
  {id:'ash',label:'灰を落とす',time:LOUNGE_ENTRY_SECONDS+13.6},
  {id:'extinguish',label:'火を消す',time:LOUNGE_ENTRY_SECONDS+23.7},
  {id:'stand',label:'立ち上がる',time:finish},
  {id:'leave',label:'出る',time:finish+2.2},
];

export function sampleLoungeSmokingStudy(time){
  const t=MathUtils.clamp(Number.isFinite(time)?time:0,0,LOUNGE_SMOKING_STUDY_DURATION);
  const entry=t<LOUNGE_ENTRY_SECONDS?{age:t,startYaw:Math.PI/2}:null;
  const exit=t>=finish?{age:t-finish}:null;
  const visit=!entry&&!exit?new SmokingVisit({seated:true}):null;
  visit?.update(t-LOUNGE_ENTRY_SECONDS);
  const passage=entry?loungeExitPose(loungeEntryAge(t)):exit?loungeExitPose(exit.age):{x:0,depth:LOUNGE_SEAT.depth};
  return{time:t,entry,exit,visit,passage,phase:[...LOUNGE_SMOKING_STUDY_PHASES].reverse().find(p=>t>=p.time)};
}

export function createLoungeSmokingStudyActors(m,head){
  const milo=createMilo(m,head),furniture=createLounge(m);
  furniture.position.x=-positionX(getStation('lounge').x);
  furniture.updateMatrixWorld(true);
  return{milo,furniture};
}

export function applyLoungeSmokingStudy(actors,time,{dt=0,resetSmoke=dt===0}={}){
  const {milo,furniture}=actors,sample=sampleLoungeSmokingStudy(time);
  if(resetSmoke){
    seekSmokingSmoke(milo,sample.time,{
      signalAt:t=>sampleLoungeSmokingStudy(t).visit?.pose.gesture,
      poseAt:t=>applyLoungeSmokingStudy(actors,t,{dt:0,resetSmoke:false}),
    });
  }
  milo.position.set(sample.passage.x,0,sample.passage.depth);milo.rotation.set(0,.15,0);
  animateMilo(milo,{moving:false,climbing:false,facing:1,dt,time:sample.time,action:'lounge',
    actionTime:Math.max(0,sample.time-LOUNGE_ENTRY_SECONDS),actionDuration:LOUNGE_SMOKING_SECONDS,
    leisure:sample.visit?'smoking':null,loungeEntry:sample.entry,loungeExit:sample.exit,
    smokingVisit:sample.visit,loungeDocks:furniture.userData.loungeProps});
  updateTableLeisureProps(furniture.userData.loungeProps,milo.userData.leisure);
  milo.updateMatrixWorld(true);furniture.updateMatrixWorld(true);
  return sample;
}
