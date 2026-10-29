import {BUNK_PHASE_SECONDS} from './bunk-visit.js';

const smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};

// Lucy's approved side-sleep pose already eases into and out of sleep.
// Follow that rendered weight instead of Milo's bunk visit or the wall clock.
export function catSleepView(weight=0){
  return{locked:weight>0,recline:weight,closure:weight};
}

// Use the bunk's simulation clock, so pausing also stops the eyelids.
export function sleepView(pose,character='milo',outside=false){
  if(character!=='milo'||!pose)return{locked:false,recline:0,closure:0};
  const recline=pose.recline,locked=recline>0||pose.phase==='lowering';
  let closure=0;
  if(pose.phase==='closing'&&recline===1)closure=smooth(pose.age/BUNK_PHASE_SECONDS.closing);
  if(pose.phase==='sleeping')closure=1;
  if(pose.phase==='waking')closure=1-smooth(pose.age/BUNK_PHASE_SECONDS.waking);
  return{locked,recline,closure:outside?0:closure};
}
