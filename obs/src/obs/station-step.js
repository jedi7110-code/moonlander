import {planMiloWalk,miloWalkState} from './milo-gait.js';
import {CREW_WALK_SPEED} from './pace.js';
import {CABIN_AISLE,HYDRO_TRAY} from './layout.js';

// Stepping up to a fitting from the aisle and back again (the plant shelf, the
// galley counter, the hydration tray). Milo stands in the aisle when a visit
// starts, turns to face the fitting, takes the short planned walk up to it
// (milo-gait.js: from standing to standing, a step or two), works, and at the
// end takes the same steps back, backwards, before he turns to walk away.
// It used to be a slide in the standing pose.
// m from the aisle up to the fitting
export const STATION_APPROACH=Object.freeze({plant:.76,galley:.32,hydro:CABIN_AISLE.crewZ-HYDRO_TRAY.standZ});
// Setting the harvest down on the galley counter: the turn towards it, then the step up to
// the counter and back (seconds of the whole, and metres).
export const HARVEST_PLACING=Object.freeze({turn:1.6,seconds:5.8,approach:.35});
export const STATION_STEP=Object.freeze({
  turn:1.5,   // s kept for the turn on the spot towards the fitting before the first step
});
const plans=new Map();
function planFor(distance){
  const key=distance.toFixed(3);
  if(!plans.has(key))plans.set(key,planMiloWalk(distance,CREW_WALK_SPEED*.022));
  return plans.get(key);
}
// The step at `time` of a visit `duration` seconds long, `distance` metres from the aisle.
// offset: metres towards the fitting; fraction: 0..1 of the way; gait: the walk state to
// pose (null while he stands, in the aisle or at the fitting).
// A visit too short for the turn and both walks plays them faster.
export function stationStep(distance,time,duration,{delay=STATION_STEP.turn}={}){
  const plan=planFor(distance),scale=Math.max(1,(delay+2*plan.duration)/Math.max(duration,.1));
  const into=(time-delay/scale)*scale,back=(duration-time)*scale,t=Math.max(0,Math.min(plan.duration,into,back));
  const state=miloWalkState(plan,t);
  // (walked: seconds of the walk up to the fitting that have been walked, or are left to walk back)
  return {offset:state.x,fraction:state.x/distance,gait:t>0&&t<plan.duration?state:null,leaving:back<into,walked:t/scale};
}

// A short walk of `distance` metres inside an authored visit (into the back room to the
// mirror, up to the ashtray, to the hatch): from standing to standing at the walk's own
// pace from the start of the `seconds` allowed for it, standing for what is left of them.
// (Where the time allowed is shorter than the walk, it is walked that much faster.)
// fraction: 0..1 of the way; gait: the walk state to pose, null while he stands.
export function plannedPassage(distance,time,seconds){
  const plan=planFor(distance),t=Math.max(0,Math.min(plan.duration,time*Math.max(1,plan.duration/seconds))),state=miloWalkState(plan,t);
  return {fraction:state.x/distance,gait:t>0&&t<plan.duration?state:null};
}

// What a visit to one of these stations takes besides the work there: the turn and the walk
// up to the fitting (lead), and the walk back (tail), in seconds. The cabin's brain adds
// them to the station's own duration.
export function stationWrap(id){
  const distance=STATION_APPROACH[id];if(!distance)return null;
  const walk=planFor(distance).duration;
  return {distance,lead:STATION_STEP.turn+walk,tail:walk};
}
// A visit at `time` of its `duration` (both including lead and tail): the step (see
// stationStep), and the clock of the work itself (time, duration), which runs while he
// stands at the fitting.
export function stationVisit(id,time,duration){
  const wrap=stationWrap(id);if(!wrap)return null;
  const work=Math.max(.1,duration-wrap.lead-wrap.tail);
  return {...stationStep(wrap.distance,time,duration),time:Math.max(0,Math.min(work,time-wrap.lead)),duration:work};
}
