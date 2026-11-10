import {CABIN_AISLE,LOUNGE_TABLE,LOUNGE_ACCESS,getStation,ladderApproachDepth} from './layout.js';

const loungeEntry=(getStation('lounge').x-700)*.022+LOUNGE_ACCESS.sideX;
export const LOUNGE_TABLE_PASSAGE=Object.freeze({floor:1,x:LOUNGE_TABLE.x,
  halfWidth:LOUNGE_TABLE.x-loungeEntry,depth:LOUNGE_TABLE.z+LOUNGE_TABLE.depth/2+.45});
// Both bends share the narrow robot lane; reserve them while the crew passes.
export function crewPassages(actor){
  const sofa=actor?.loungeAvoidance?.robot?null:actor?.loungeAvoidance;
  const table=actor?.floor===1?LOUNGE_TABLE_PASSAGE:null;
  // The adjacent bends form one passing section. Reserving each separately
  // would strand a robot between them while Milo waits at the second bend.
  if(sofa&&table&&sofa.floor===table.floor){
    const left=Math.min(sofa.x-sofa.halfWidth,table.x-table.halfWidth);
    const right=Math.max(sofa.x+sofa.halfWidth,table.x+table.halfWidth);
    return [{floor:table.floor,x:(left+right)/2,halfWidth:(right-left)/2}];
  }
  return [sofa,table].filter(Boolean);
}

// Approach the wall-mounted ladder on the solid bridge, then rejoin the aisle.
export function crewWalkway(x,floor,facing=1,avoidance=null,tableAccess=false){
  const inner=.85,outer=1.90,offset=ladderApproachDepth(floor)-CABIN_AISLE.crewZ;
  const t=Math.max(0,Math.min(1,(outer-Math.abs(x))/(outer-inner)));
  const blend=t*t*t*(10+t*(-15+6*t));
  let slope=-Math.sign(x)*offset*30*t*t*(1-t)*(1-t)/(outer-inner);
  let z=CABIN_AISLE.crewZ+offset*blend,detouring=false;
  if(floor===1&&!tableAccess){
    // The right staircase opens beyond the lounge. Keep through traffic in
    // front of the table, returning to the exact authored entrance on its
    // left, so sitting down never jumps sideways. The tangent also eases
    // to zero at the entrance and at the straight section past the table.
    const inner=LOUNGE_TABLE.width/2+.10,outer=LOUNGE_TABLE_PASSAGE.halfWidth;
    const t=Math.max(0,Math.min(1,(outer-Math.abs(x-LOUNGE_TABLE.x))/(outer-inner)));
    const height=LOUNGE_TABLE.z+LOUNGE_TABLE.depth/2+.45-CABIN_AISLE.crewZ;
    z+=height*t*t*t*(10+t*(-15+6*t));
    slope-=Math.sign(x-LOUNGE_TABLE.x)*height*30*t*t*(1-t)*(1-t)/(outer-inner);
    detouring=t>0;
  }
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

// The short approach to the adjacent cushion is behind the table's left
// corner. It starts/ends at the normal entrance before using that lane.
export const actorWalkway=(actor,x=(actor.x-700)*.022)=>crewWalkway(x,actor.floor,actor.facing,actor.loungeAvoidance,actor.loungeTableAccess);
