import {ExtrudeGeometry,Mesh,MeshBasicMaterial,Path,Shape,ShapeGeometry} from 'three';
import {cylinder} from './materials.js';
import {SPACE_COLOR} from './space-stars.js';

export const BATHROOM_WINDOW={width:.98,height:1.08,y:1.61,wallBack:-3.86,wallDepth:.12};
const finishes=new WeakMap();

function octagon(Type,w,h,cut,cy=0){
  const shape=new Type(),a=w/2,b=h/2;
  const points=cut>0?[[-a+cut,-b],[a-cut,-b],[a,-b+cut],[a,b-cut],[a-cut,b],[-a+cut,b],[-a,b-cut],[-a,-b+cut]]:
    [[-a,-b],[a,-b],[a,b],[-a,b]];
  points.forEach(([x,y],i)=>i?shape.lineTo(x,y+cy):shape.moveTo(x,y+cy));shape.closePath();return shape;
}

function windowFinishes(m){
  if(finishes.has(m))return finishes.get(m);
  const space=new MeshBasicMaterial({name:'Rear windows / deep space',color:SPACE_COLOR,depthWrite:false,toneMapped:false});
  const glass=new MeshBasicMaterial({name:'Bathroom / pressure glass',color:0x8aa4b0,transparent:true,opacity:.065,depthWrite:false,toneMapped:false});
  for(const material of [space,glass]){material.userData.cabinAlwaysPowered=true;material.userData.castShadow=false;}
  const result={space,glass};finishes.set(m,result);return result;
}

export function addBathroomRearWindow(parent,m,x,floor,type){
  return addRearSpaceWindow(parent,m,x,floor,type);
}

export function addRearSpaceWindow(parent,m,x,floor,type,options={}){
  const {width:w,height:h,y,wallBack,wallDepth,wallWidth,wallHeight,wallY,wallCut,wallMaterial}={
    ...BATHROOM_WINDOW,wallWidth:1.56,wallHeight:2.48,wallY:1.29,wallCut:.04,wallMaterial:m.dark,...options,
  };
  const wallFront=wallBack+wallDepth;
  const add=(name,geometry,material,cy,z)=>{
    const mesh=new Mesh(geometry,material);mesh.name=`${type} ${name}`;mesh.position.set(x,floor+cy,z);
    mesh.castShadow=mesh.receiveShadow=material.userData.castShadow!==false;parent.add(mesh);return mesh;
  };
  const extrude=(shape,depth)=>new ExtrudeGeometry(shape,{depth,steps:1,bevelEnabled:false,curveSegments:1});
  const wall=octagon(Shape,wallWidth,wallHeight,wallCut,wallY);
  wall.holes.push(octagon(Path,w,h,.12,y));
  add('rear wall',extrude(wall,wallDepth),wallMaterial,0,wallBack);

  const frame=octagon(Shape,w+.22,h+.22,.18);
  frame.holes.push(octagon(Path,w-.02,h-.02,.115));
  add('pressure window frame',extrude(frame,.075),m.metal,y,wallFront-.015);
  const seal=octagon(Shape,w+.028,h+.028,.135);
  seal.holes.push(octagon(Path,w-.070,h-.070,.10));
  add('pressure window seal',extrude(seal,.042),m.rubber,y,wallFront-.067);
  const boltX=w/2+.06,boltY=h/2-.23;
  for(const [dx,dy] of [[-boltX,-boltY],[-boltX,boltY],[boltX,-boltY],[boltX,boltY],[0,-h/2-.06],[0,h/2+.06]]){
    const bolt=cylinder(parent,m.dark,x+dx,floor+y+dy,wallFront+.067,.014,.012,.014,6);
    bolt.rotation.x=Math.PI/2;bolt.name=`${type} window fastener`;
  }

  const {space,glass}=windowFinishes(m);
  add('pressure window glass',new ShapeGeometry(octagon(Shape,w,h,.12)),glass,y,wallBack+.012);
  // Match the opposite passage's dark sky. Distant points render through this
  // real opening after the opaque cabin; the backing does not write depth.
  const skyGeometry=new ShapeGeometry(octagon(Shape,w+.08,h+.08,.13));
  const sky=add('space view',skyGeometry,space,y,wallBack-.003);
  sky.userData.spaceWindow={width:w-.070,height:h-.070,cut:.10};
}
