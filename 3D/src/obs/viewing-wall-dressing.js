import {Box3,Group,Curve,CubicBezierCurve3,LineCurve3,TubeGeometry,Vector3} from 'three';
import {VIEWING_WALL,viewingWallWindow,viewingWallPanelX} from './viewing-wall-profile.js';

// The near wall faces inward (-Z). Keep each pressure compartment independent
// and leave the low cat aisle and recessed footlights clear.
const solidPanels=Array.from({length:VIEWING_WALL.count},(_,i)=>i).filter(i=>!viewingWallWindow(i));
export const VIEWING_WALL_DRESSING=[
  ['switchTall','cabinet','pipes','switchWide','cabinet',null,'pipes','switchSquare','cabinet','switchTall',null],
  ['pipes','switchTall','cabinet','switchSquare','switchTall',null,'pipes','switchWide','switchSquare','cabinet','pipes'],
  ['cabinet','pipes',null,'switchTall','cabinet','switchWide','pipes','switchSquare','cabinet','switchWide',null],
].map(kinds=>kinds.flatMap((kind,i)=>kind?[[kind,viewingWallPanelX(solidPanels[i]),kind==='pipes'?.81:1.56]]:[]));

function wallReturnPipeGeometry(){
  const low=.18*.44,high=2.97*.44,radius=.10,k=radius*.55228475;
  const lower=new CubicBezierCurve3(
    new Vector3(0,low,-radius),new Vector3(0,low,-radius+k),
    new Vector3(0,low+radius-k,0),new Vector3(0,low+radius,0),
  );
  const upper=new CubicBezierCurve3(
    new Vector3(0,high-radius,0),new Vector3(0,high-radius+k,0),
    new Vector3(0,high,-radius+k),new Vector3(0,high,-radius),
  );
  const upright=new LineCurve3(lower.v3,upper.v0),path=new Curve();
  // Give each wall-return elbow four rings; keep the round section at this
  // compact height instead of squashing the rear wall's sideways pipe run.
  const sample=(method,t,target)=>t<.25?lower[method](t*4,target):t<.75?upright[method]((t-.25)*2,target):upper[method]((t-.75)*4,target);
  path.getPointAt=(t,target)=>sample('getPoint',t,target);
  path.getTangentAt=(t,target)=>sample('getTangent',t,target);
  return new TubeGeometry(path,16,.022,6,false);
}

export function addViewingWallDressing(parent,templates,floors){
  if(!templates)return;
  const root=new Group();root.name='POV / near wall equipment';parent.add(root);
  const face=VIEWING_WALL.faceZ,gap=.008,pipeGeometry=wallReturnPipeGeometry();
  for(const [deck,layout] of VIEWING_WALL_DRESSING.entries())for(const [kind,x,y] of layout){
    const item=templates[kind].clone();item.name=`POV equipment / ${deck} / ${kind}`;
    item.position.set(0,0,0);item.rotation.set(0,0,0);
    if(kind==='pipes')for(const part of item.children){
      if(part.name==='Rear wall thin service pipe')part.geometry=pipeGeometry;
      else{part.position.y*=.44;part.scale.y*=.44;}
    }
    const rear=item.userData.wallMountZ??new Box3().setFromObject(item).min.z;
    item.rotation.y=Math.PI;
    item.position.set(x,floors[deck]+y,face-gap+rear);
    root.add(item);
  }
  return root;
}
