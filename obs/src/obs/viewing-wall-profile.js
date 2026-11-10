import {CABIN_AISLE} from './layout.js';

// The floor edge stays put; the vertical face recesses away from the aisle.
export const VIEWING_WALL={
  edgeZ:CABIN_AISLE.deckFront-.05,faceZ:CABIN_AISLE.deckFront+.60,
  bottom:.146,knee:.70,shoulder:2.34,top:3.02,
  firstX:-11.8,spacing:1.52,count:16,halfWidth:13.15,
  windowY:1.52,windowWidth:1.02,windowHeight:1.12,
};
// With the left stair tower the wall continues over three more bays (negative
// indices) to the tower's outer lining. The cabin's window spacing carries on,
// which puts one window beside the stair entrance (bay -1) and none at the
// turn landing, where the landing slab would cut across it.
export const VIEWING_WALL_TOWER={firstIndex:-3,left:-17.695};
// With the right stair tower (LEVEL 3 and LEVEL 2 only) the wall continues
// over three more bays to the right tower's outer lining, mirroring the left.
// Bay 17 has a window on LEVEL 2; on LEVEL 3 the tower's first flight and its
// handrail rise across it, so it stays closed there.
export const VIEWING_WALL_RIGHT_TOWER={lastIndex:18,right:17.695};
export const viewingWallWindow=index=>(index%3+3)%3===2;
export const viewingWallPanelX=index=>VIEWING_WALL.firstX+index*VIEWING_WALL.spacing;
export function viewingWallFaceZ(y){
  const p=VIEWING_WALL;
  if(y<p.knee)return p.edgeZ+(p.faceZ-p.edgeZ)*(y-p.bottom)/(p.knee-p.bottom);
  if(y>p.shoulder)return p.faceZ+(p.edgeZ-p.faceZ)*(y-p.shoulder)/(p.top-p.shoulder);
  return p.faceZ;
}
