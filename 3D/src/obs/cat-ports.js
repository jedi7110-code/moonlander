import * as THREE from 'three';
import {box,label} from './materials.js';
import {CAT_PORT} from './layout.js';

function rounded(shape,left,bottom,width,height,radius){
  const right=left+width,top=bottom+height,r=radius;
  shape.moveTo(left+r,bottom);shape.lineTo(right-r,bottom);shape.quadraticCurveTo(right,bottom,right,bottom+r);
  shape.lineTo(right,top-r);shape.quadraticCurveTo(right,top,right-r,top);
  shape.lineTo(left+r,top);shape.quadraticCurveTo(left,top,left,top-r);
  shape.lineTo(left,bottom+r);shape.quadraticCurveTo(left,bottom,left+r,bottom);return shape;
}

export function catPort(parent,m,x,y,level){
  const port=new THREE.Group();port.name='Cat passage deck '+(level+1);port.position.set(x,y,CAT_PORT.wallZ);parent.add(port);
  const {width,height}=CAT_PORT;
  const rim=rounded(new THREE.Shape(),-width/2-.04,.015,width+.08,height+.085,.09);
  rim.holes.push(rounded(new THREE.Path(),-width/2,.045,width,height,.075));
  const frame=new THREE.Mesh(new THREE.ExtrudeGeometry(rim,{depth:.10,bevelEnabled:true,bevelThickness:.005,bevelSize:.005,bevelSegments:2,steps:1,curveSegments:12}),m.metal);
  frame.castShadow=true;frame.receiveShadow=true;port.add(frame);
  // The dark recessed mouth occludes the cat progressively, nose to tail.
  const mouth=new THREE.Mesh(new THREE.ShapeGeometry(rounded(new THREE.Shape(),-width/2,.045,width,height,.075)),new THREE.MeshBasicMaterial({color:0x030605}));
  mouth.position.z=.008;port.add(mouth);
  box(port,m.dark,0,.035,.13,width+.10,.035,.23,.008);
  for(const side of [-1,1])for(const yy of [.11,height])box(port,m.dark,side*(width/2+.022),yy,.111,.018,.024,.011,.004);
  label(port,'DUCT / '+String(level+1).padStart(2,'0'),0,height+.18,.105,.53,.11,{fg:'#c2cabe',size:46});
  return port;
}
