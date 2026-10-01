import {Vector3,Quaternion,Euler,MathUtils} from 'three';
import {HatchRepairVisit,HATCH_REPAIR_PHASES,HATCH_REPAIR_LABELS} from './obs/hatch-repair.js';
import {animateMilo} from './obs/characters.js';
import {getStation,CABIN_AISLE} from './obs/layout.js';
import {HATCH_SERVICE_POINT,REPAIR_TOOL_TIP} from './obs/hatch-repair-pose.js';

let elapsed=0;
export const REPAIR_STUDY_PHASES=Object.entries(HATCH_REPAIR_PHASES).map(([id,duration])=>{
  const start=elapsed;elapsed+=duration;return{id,start,end:elapsed,duration,label:HATCH_REPAIR_LABELS[id][0]};
});
export const REPAIR_STUDY_DURATION=elapsed;
export const REPAIR_STUDY_DEFAULTS=Object.freeze({amplitude:.28,frequency:3.2/(2*Math.PI),reachSeconds:1.4,stabilizeEntry:false});
export const REPAIR_STUDY_GENTLE=Object.freeze({amplitude:.12,frequency:.28,reachSeconds:2,stabilizeEntry:true});
export const repairRange=id=>REPAIR_STUDY_PHASES.find(phase=>phase.id===id)??{start:0,end:elapsed};
const smooth=t=>{t=MathUtils.clamp(t,0,1);return t*t*(3-2*t);};

// Seek by sampling the real OBS phase machine, not by replaying frames. The
// optional tuning is local to this study: OBS keeps its existing motion.
export function sampleRepairStudy(time,tuning=null){
  const visit=new HatchRepairVisit(1);visit.startYaw=Math.PI/2;
  visit.update(MathUtils.clamp(Number.isFinite(time)?time:0,0,elapsed));
  const pose=visit.pose;
  if(tuning&&visit.phase==='repair'){
    const seconds=MathUtils.clamp(tuning.reachSeconds??1.4,.5,3);
    pose.reach=smooth(visit.age/seconds)*(1-smooth((visit.age-(HATCH_REPAIR_PHASES.repair-seconds))/seconds));
    pose.twist=Math.sin(visit.age*2*Math.PI*(tuning.frequency??REPAIR_STUDY_DEFAULTS.frequency))*(tuning.amplitude??.28)*pose.reach;
  }
  return{...visit,pose,done:visit.done};
}

export function poseRepairStudy(root,time,tuning=null){
  const station=getStation('innerHatch'),visit=sampleRepairStudy(time,tuning);
  root.position.set((station.x-700)*.022,0,CABIN_AISLE.crewZ);root.rotation.set(0,Math.PI/2,0);
  animateMilo(root,{moving:false,climbing:false,facing:1,action:'innerHatch',time,dt:0,hatchRepair:visit});
  if(tuning?.stabilizeEntry&&visit.pose.reach>0){
    // The wrist target moves continuously, but its near-straight-arm IK plane
    // jumps ~32 degrees as soon as reach becomes nonzero. Fade the solved arm
    // orientation in from the actual neutral rig, keeping the wrist orientation.
    const blend=smooth(visit.pose.reach/.3),bodyQ=root.userData.body.getWorldQuaternion(new Quaternion());
    for(const {arm,elbow,hand,side}of root.userData.arms){
      const wristQ=hand.getWorldQuaternion(new Quaternion()).premultiply(bodyQ.clone().invert());
      arm.quaternion.slerpQuaternions(new Quaternion().setFromEuler(new Euler(-.05,0,side*.025)),arm.quaternion.clone(),blend);
      elbow.quaternion.slerpQuaternions(new Quaternion().setFromEuler(new Euler(-.08,0,0)),elbow.quaternion.clone(),blend);
      arm.position.lerpVectors(new Vector3(side*.207,1.488,0),arm.position.clone(),blend);
      hand.quaternion.copy(arm.quaternion).multiply(elbow.quaternion).invert().multiply(wristQ);
    }
    root.userData.updateWristTwists?.();
  }
  root.updateMatrixWorld(true);root.userData.bodySkin?.skeleton.update();
  const tip=root.userData.arms[0].hand.localToWorld(REPAIR_TOOL_TIP.clone());
  return{visit,tip,screw:new Vector3(HATCH_SERVICE_POINT.x,HATCH_SERVICE_POINT.y,HATCH_SERVICE_POINT.z),
    contact:visit.pose.tool&&visit.pose.reach>.999};
}
