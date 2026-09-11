import {applyBedTransferPose} from './bed-pose.js';
import {BUNK_BED,BUNK_TRAY} from './recline.js';

export function applyBunkVisitPose(root,visit){
  applyBedTransferPose(root,visit.pose,{...BUNK_TRAY,top:BUNK_BED.top},visit.startYaw??0);
}
