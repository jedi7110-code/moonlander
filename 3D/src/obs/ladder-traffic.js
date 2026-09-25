import {FLOORS} from './layout.js';

// Foot-to-foot clearance includes the taller climber's body and raised hands.
// Routes are expressed as the remaining vertical sweep, not an entire shaft lock.
export const LADDER_BODY_CLEARANCE=2.10;
export const ladderHeight=y=>(870-y)*.016;

export function crewLadderPath(actor){
  const y=Number.isFinite(actor?.y)?actor.y:FLOORS[actor?.floor]?.y;
  if(!Number.isFinite(y))return null;
  const first=actor.queue?.[0],climb=first?.type==='climb'?first:
    first?.type==='walk'&&actor.queue[1]?.type==='climb'?actor.queue[1]:null;
  return {from:ladderHeight(y),to:climb?ladderHeight(climb.y):ladderHeight(y)};
}

export function ladderPathsConflict(a,b){
  // Older adapters without coordinates must remain conservative.
  if(!a||!b)return true;
  const gap=Math.max(Math.min(a.from,a.to),Math.min(b.from,b.to))-
    Math.min(Math.max(a.from,a.to),Math.max(b.from,b.to));
  return gap<LADDER_BODY_CLEARANCE;
}
