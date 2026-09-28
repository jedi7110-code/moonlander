import {CABIN_AISLE} from './layout.js';

// The floor edge stays put; the vertical face recesses away from the aisle.
export const VIEWING_WALL={
  edgeZ:CABIN_AISLE.deckFront-.05,faceZ:CABIN_AISLE.deckFront+.60,
  bottom:.146,knee:.70,shoulder:2.34,top:3.02,
  firstX:-11.8,spacing:1.52,count:16,halfWidth:13.15,
  windowY:1.52,windowWidth:1.02,windowHeight:1.12,
};
export const viewingWallWindow=index=>index%3===2;
export const viewingWallPanelX=index=>VIEWING_WALL.firstX+index*VIEWING_WALL.spacing;
export function viewingWallFaceZ(y){
  const p=VIEWING_WALL;
  if(y<p.knee)return p.edgeZ+(p.faceZ-p.edgeZ)*(y-p.bottom)/(p.knee-p.bottom);
  if(y>p.shoulder)return p.faceZ+(p.edgeZ-p.faceZ)*(y-p.shoulder)/(p.top-p.shoulder);
  return p.faceZ;
}
