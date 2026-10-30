import {CABIN_AISLE,ladderApproachDepth} from './layout.js';

// Approach the wall-mounted ladder on the solid bridge, then rejoin the aisle.
export function crewWalkway(x,floor,facing=1,avoidance=null){
  const inner=.85,outer=1.90,offset=ladderApproachDepth(floor)-CABIN_AISLE.crewZ;
  const t=Math.max(0,Math.min(1,(outer-Math.abs(x))/(outer-inner)));
  const blend=t*t*t*(10+t*(-15+6*t));
  let slope=-Math.sign(x)*offset*30*t*t*(1-t)*(1-t)/(outer-inner);
  let z=CABIN_AISLE.crewZ+offset*blend,detouring=false;
  if(avoidance&&avoidance.floor===floor){
    const dx=x-avoidance.x,r=avoidance.halfWidth;
    if(Math.abs(dx)<r){
      // Zero position and tangent offsets at both ends join the authored
      // lounge entrance without a snap, sideways slide, or changed seat pose.
      const q=1-(dx/r)**2,height=avoidance.depth-CABIN_AISLE.crewZ;
      z+=height*q*q*q;slope-=6*height*dx/(r*r)*q*q;detouring=true;
    }
  }
  return Math.abs(x)>=outer&&!detouring?{z}:{z,yaw:Math.atan2(facing,slope*facing)};
}
