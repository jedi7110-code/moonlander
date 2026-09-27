import {CABIN_AISLE} from './layout.js';

// The upper decks have a ladder opening up to z=.94. Pass across the existing
// forward bridge, with room for the full boot footprint, then rejoin the aisle.
export function crewWalkway(x,floor,facing=1){
  const inner=.85,outer=1.90,offset=.56;
  if(floor===2||Math.abs(x)>=outer)return{z:CABIN_AISLE.crewZ};
  const t=Math.max(0,Math.min(1,(outer-Math.abs(x))/(outer-inner)));
  const blend=t*t*t*(10+t*(-15+6*t));
  const slope=-Math.sign(x)*offset*30*t*t*(1-t)*(1-t)/(outer-inner);
  return{z:CABIN_AISLE.crewZ+offset*blend,yaw:Math.atan2(facing,slope*facing)};
}
