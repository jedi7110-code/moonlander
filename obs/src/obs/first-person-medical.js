import {medicalTransferPose,medicalExitTime} from './medical.js';

export function medicalView(brain,character='milo'){
  const exit=brain.reclineExit?.id==='medical'?brain.reclineExit:null;
  const active=character==='milo'&&(exit||brain.state==='performing'&&brain.cur?.id==='medical');
  if(!active)return{active:false,locked:false,recline:0};
  const duration=exit?.actionDuration??brain.curDurSec;
  const pose=medicalTransferPose(exit?medicalExitTime(exit):duration-brain.performT,duration);
  return{active:true,locked:pose.recline>0||pose.phase==='lowering',recline:pose.recline};
}
