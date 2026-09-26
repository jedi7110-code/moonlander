import {MathUtils,Quaternion,Euler,Vector3} from 'three';
import {applyBedTransferPose} from './bed-pose.js';
import {BUNK_BED,BUNK_TRAY} from './recline.js';
import {placeHand} from './dining.js';
import {bedEntryMotion} from './bed-entry.js';

export function applySleepingHands(root,recline){
  const weight=MathUtils.smoothstep(recline,.35,1);
  if(weight===0)return;
  for(const rig of root.userData.arms){
    const {arm,elbow,hand,side}=rig;
    const rest=[arm,elbow,hand].map(joint=>joint.quaternion.clone());
    // Stagger the palms along the abdomen, with fingers pointing gently inward.
    const target=new Vector3(side*.155,side<0?1.235:1.145,.145);
    const rotation=new Quaternion().setFromEuler(new Euler(0,0,-side*1.32));
    placeHand(rig,target,rotation,0);
    [arm,elbow,hand].forEach((joint,i)=>joint.quaternion.slerpQuaternions(rest[i],joint.quaternion.clone(),weight));
    for(const finger of rig.fingers){
      finger.rotation.x=.04*weight;
      finger.userData.links[0].rotation.x=.10*weight;
      finger.userData.links[1].rotation.x=.04*weight;
    }
    rig.thumb.rotation.set(.08*weight,0,side*.10*weight);
    rig.thumb.userData.ip.rotation.x=.10*weight;
  }
}

export function applyBunkVisitPose(root,visit){
  applyBedTransferPose(root,visit.pose,{...BUNK_TRAY,top:BUNK_BED.top},visit.startYaw??0);
  applySleepingHands(root,visit.pose.entry===undefined?visit.pose.recline:bedEntryMotion(visit.pose.entry).lay);
}
