import {Box3,Group} from 'three';
import {VIEWING_WALL,viewingWallWindow,viewingWallPanelX} from './viewing-wall-profile.js';

// The near wall faces inward (-Z). Keep each pressure compartment independent
// and leave the low cat aisle and recessed footlights clear.
const solidPanels=Array.from({length:VIEWING_WALL.count},(_,i)=>i).filter(i=>!viewingWallWindow(i));
export const VIEWING_WALL_DRESSING=[
  ['switchTall','cabinet','pipes','switchWide','cabinet',null,'pipes','switchSquare','cabinet','switchTall',null],
  ['pipes','switchTall','cabinet','switchSquare','switchTall',null,'pipes','switchWide','switchSquare','cabinet','pipes'],
  ['cabinet','pipes',null,'switchTall','cabinet','switchWide','pipes','switchSquare','cabinet','switchWide',null],
].map(kinds=>kinds.flatMap((kind,i)=>kind?[[kind,viewingWallPanelX(solidPanels[i]),kind==='pipes'?.81:1.56]]:[]));

export function addViewingWallDressing(parent,templates,floors){
  if(!templates)return;
  const root=new Group();root.name='POV / near wall equipment';parent.add(root);
  const face=VIEWING_WALL.faceZ,gap=.008;
  for(const [deck,layout] of VIEWING_WALL_DRESSING.entries())for(const [kind,x,y] of layout){
    const item=templates[kind].clone();item.name=`POV equipment / ${deck} / ${kind}`;
    item.position.set(0,0,0);item.rotation.set(0,0,0);
    if(kind==='pipes')item.scale.y=.44;
    const rear=item.userData.wallMountZ??new Box3().setFromObject(item).min.z;
    item.rotation.y=Math.PI;
    item.position.set(x,floors[deck]+y,face-gap+rear);
    root.add(item);
  }
  return root;
}
