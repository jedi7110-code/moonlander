import * as THREE from 'three';
import {box,cylinder,pipe,rod,screen} from './materials.js';
import {CABIN_LIGHT_COLOR} from './lighting.js';

export const BULKHEAD_GATE={x:-1.88,floor:6.784,width:1.82,height:2.42,bottom:.10,front:-1.36,back:-5.65};

function outline(width,height,bottom){
  const {x,floor}=BULKHEAD_GATE,cut=Math.min(width*.19,height*.18),lo=floor+bottom,hi=lo+height;
  return [[x-width/2+cut,lo],[x+width/2-cut,lo],
    [x+width/2,lo+cut],[x+width/2,hi-cut],[x+width/2-cut,hi],
    [x-width/2+cut,hi],[x-width/2,hi-cut],[x-width/2,lo+cut]];
}
function path(points,Type=THREE.Shape){
  const shape=new Type();shape.moveTo(...points[0]);for(const p of points.slice(1))shape.lineTo(...p);shape.closePath();return shape;
}
function slab(root,m,shape,z,depth,name){
  const geometry=new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:false,curveSegments:1,steps:1});
  const mesh=new THREE.Mesh(geometry,m);mesh.position.z=z;mesh.name=name;
  mesh.castShadow=mesh.receiveShadow=true;root.add(mesh);return mesh;
}

// Every wall layer has a real aperture. No black decal covers an intact bulkhead.
export function gateWall(root,material,{left,right,bottom,top,z,depth,openingClearance=0}){
  const shape=path([[left,bottom],[right,bottom],[right,top],[left,top]]);
  const g=BULKHEAD_GATE;
  // The trim hides this clearance; only the frame supplies the visible reveal.
  shape.holes.push(path(outline(g.width+2*openingClearance,g.height+2*openingClearance,g.bottom-openingClearance).reverse(),THREE.Path));
  return slab(root,material,shape,z,depth,'Bulkhead with octagonal opening');
}

export function createBulkheadGate(m){
  const root=new THREE.Group(),lights=new THREE.Group();root.name='Octagonal gate and rear room';
  lights.name='Bulkhead gate lights';
  const g=BULKHEAD_GATE,y=g.floor;
  const opening=outline(g.width,g.height,g.bottom);
  const frame=path(outline(g.width+.30,g.height+.24,g.bottom-.12));
  frame.holes.push(path([...opening].reverse(),THREE.Path));
  slab(root,m.enamel,frame,g.front-.48,.50,'Eight-sided gate frame');
  const seal=path(outline(g.width+.09,g.height+.09,g.bottom-.045));
  seal.holes.push(path([...opening].reverse(),THREE.Path));
  slab(root,m.rubber,seal,g.front+.022,.024,'Gate seal');
  const outer=outline(g.width+.24,g.height+.18,g.bottom-.09);
  for(let i=0;i<8;i++){
    const a=outer[i],b=outer[(i+1)%8];
    for(const t of [.18,.82]){
      const bolt=cylinder(root,m.dark,a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,g.front+.034,.026,.028,.026,6);bolt.rotation.x=Math.PI/2;
    }
  }
  // A second frame and continuous deck lead into a lit equipment room.
  const inner=path(outline(g.width-.12,g.height-.08,g.bottom+.02));
  inner.holes.push(path(outline(g.width-.26,g.height-.22,g.bottom+.09).reverse(),THREE.Path));
  slab(root,m.dark,inner,-2.48,.16,'Rear threshold frame');
  // Recess the floor nose behind the trim face at z=-1.56, including its metal cap.
  box(root,m.dark,g.x,y+.014,-3.68,2.36,.16,4.12).name='Recessed rear-room floor';
  box(root,m.metal,g.x,y+.101,-3.68,2.20,.018,4.08).name='Rear-room floor cap';
  for(const z of [-2.1,-2.75,-3.4,-4.05,-4.7,-5.35])box(root,m.rubber,g.x,y+.115,z,2.18,.012,.028);
  for(const side of [-1,1]){
    box(root,m.dark,g.x+side*1.19,y+1.37,-3.76,.15,2.70,4.03);
    rod(root,m.pipeSteel,[g.x+side*.98,y+.20,-2.5],[g.x+side*.98,y+.20,-5.4],.045);
    for(const z of [-2.8,-4.1,-5.3])box(root,m.enamel,g.x+side*1.10,y+1.43,z,.06,2.44,.09);
  }
  box(root,m.dark,g.x,y+2.76,-3.75,2.4,.16,4.1);
  box(root,m.enamel,g.x,y+1.35,g.back,2.3,2.66,.16);
  for(const side of [-1,1]){
    box(root,m.dark,g.x+side*.93,y+1.26,g.front+.045,.075,.67,.045);
    box(root,m.metal,g.x+side*.93,y+1.26,g.front+.08,.036,.43,.06);
  }
  for(const z of [-3.1,-4.8]){
    rod(root,m.pipeSteel,[g.x-.91,y+2.16,z],[g.x+.91,y+2.16,z],.055);
    pipe(root,m.cable,[[g.x-.82,y+2.31,z],[g.x-.3,y+2.20,z+.1],[g.x+.70,y+2.3,z]],.027);
  }
  for(let i=0;i<4;i++){
    const yy=y+.55+i*.34;
    box(root,m.metal,g.x-.92,yy,-3.79,.38,.035,1.24);
    for(const z of [-3.36,-3.85,-4.3])box(root,i%2?m.olive:m.enamel,g.x-.92,yy+.13,z,.25,.23,.30,.012);
  }
  box(root,m.dark,g.x-.37,y+.47,-5.25,.78,.72,.54,.03);
  box(root,m.enamel,g.x-.37,y+.47,-4.96,.68,.64,.045,.016);
  box(root,m.metal,g.x-.37,y+.87,-5.20,.87,.05,.69,.02);
  box(root,m.dark,g.x-.38,y+1.46,-5.40,.56,.49,.15,.025);
  screen(root,g.x-.38,y+1.46,-5.305,.46,.37,23);
  box(root,m.dark,g.x+.74,y+.49,-4.06,.42,.70,1.68,.025);
  box(root,m.enamel,g.x+.74,y+.87,-4.06,.48,.06,1.77,.018);
  for(const z of [-3.48,-4.30])box(root,m.olive,g.x+.74,y+1.06,z,.34,.31,.47,.035);
  pipe(root,m.pipeSteel,[[g.x+.66,y+.24,-5.40],[g.x+.66,y+1.9,-5.40],[g.x+.34,y+2.22,-5.40],[g.x-.65,y+2.22,-5.40]],.055);
  for(const z of [-2.85,-4.7]){
    box(root,m.dark,g.x,y+2.43,z,.83,.09,.33,.02);
    box(root,m.coolLamp,g.x,y+2.375,z,.71,.022,.25);
    const light=new THREE.PointLight(CABIN_LIGHT_COLOR,5,4.2,2);light.position.set(g.x,y+2.24,z);lights.add(light);
  }
  return{root,lights};
}
