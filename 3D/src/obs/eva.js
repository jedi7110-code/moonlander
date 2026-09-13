import * as THREE from 'three';
import {box,ball,cylinder,rod,label} from './materials.js';
import {EVA_PASSAGE} from './layout.js';
import {hangingSuit} from './eva-suit.js';
import {createEquipmentRack} from './eva-equipment.js';
export {hangingSuit} from './eva-suit.js';

export const EVA_BAY={suitX:[7.85,9.05,10.25],suitZ:-.73,railY:2.62,hatchX:13.03,innerX:(EVA_PASSAGE.x-700)*.022,hatchYaw:-Math.PI/2,depth:-.12};

function ring(parent,material,x,y,z,r,tube=.025){
  const mesh=new THREE.Mesh(new THREE.TorusGeometry(r,tube,8,32),material);mesh.position.set(x,y,z);parent.add(mesh);return mesh;
}
function chamfer(w,h,r){
  return new THREE.Shape([
    new THREE.Vector2(-w/2+r,-h/2),new THREE.Vector2(w/2-r,-h/2),new THREE.Vector2(w/2,-h/2+r),new THREE.Vector2(w/2,h/2-r),
    new THREE.Vector2(w/2-r,h/2),new THREE.Vector2(-w/2+r,h/2),new THREE.Vector2(-w/2,h/2-r),new THREE.Vector2(-w/2,-h/2+r)
  ]);
}
function plate(parent,material,w,h,r,z,depth){
  const mesh=new THREE.Mesh(new THREE.ExtrudeGeometry(chamfer(w,h,r),{depth,bevelEnabled:true,bevelSegments:1,steps:1,bevelSize:.015,bevelThickness:.015}),material);
  mesh.position.z=z;mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;
}

function frame(parent,material,width,height,z,depth){
  const shape=chamfer(width,height,.25);
  shape.holes.push(new THREE.Path(chamfer(2.78,2.42,.17).getPoints().reverse()));
  const mesh=new THREE.Mesh(new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:false,steps:1}),material);
  mesh.position.z=z;mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;
}

export function createEVAHatch(m,y,inner=false){
  const root=new THREE.Group();root.name=inner?'Inner airlock / sealed':'EVA airlock / sealed';
  root.position.set(inner?EVA_BAY.innerX:EVA_BAY.hatchX,y+1.38,EVA_BAY.depth);root.rotation.y=EVA_BAY.hatchYaw;
  frame(root,m.dark,3.22,2.94,-.15,.22);frame(root,m.metal,3.10,2.79,.07,.10);frame(root,m.rubber,2.88,2.53,.18,.035);
  const door=new THREE.Group();door.name='Pressure door assembly';root.add(door);
  plate(door,m.enamel,2.78,2.42,.17,.22,.085).name='Sealed pressure door';
  plate(door,m.dark,.84,1.30,.15,.308,.025).position.y=-.18;
  plate(door,m.enamel,.74,1.20,.12,.335,.018).position.y=-.18;
  const porthole=ring(door,m.metal,0,.66,.356,.209,.045);porthole.name='Pressure window rim';
  const pane=cylinder(door,inner?m.black:m.evaWindow,0,.66,.354,.185,.017,.185,40);pane.rotation.x=Math.PI/2;
  if(!inner)for(const [x,yy,r]of [[-.072,.71,.009],[.082,.61,.007],[.035,.78,.006]])ball(door,m.white,x,yy,.371,r,r,.003);
  ring(door,m.red,0,-.23,.439,.225,.029);
  cylinder(door,m.dark,0,-.23,.387,.059,.10,.059,20).rotation.x=Math.PI/2;
  for(let i=0;i<4;i++){
    const angle=i*Math.PI/2;rod(door,m.red,[0,-.23,.439],[Math.cos(angle)*.22,-.23+Math.sin(angle)*.22,.439],.018);
  }
  for(const side of [-1,1])for(const yy of [-.78,0,.78]){
    box(door,m.metal,side*1.25,yy,.357,.18,.09,.09,.016);
    cylinder(door,m.dark,side*1.19,yy,.415,.024,.025,.024,8).rotation.x=Math.PI/2;
  }
  for(const yy of [-.81,.80])box(root,m.dark,1.48,yy,.24,.12,.30,.20,.025);
  label(door,inner?'CABIN':'EVA',0,.29,.378,.60,.18,{size:62});
  label(door,'PRESSURE LOCK',0,-.79,.378,.90,.13,{fg:'#c6cfbd',size:44});
  box(root,m.metal,0,-1.30,.17,3.03,.085,.38,.018);
  // The cutaway exposes the front jamb, not an artificially camera-facing door leaf.
  const edge=new THREE.Group();edge.rotation.y=Math.PI/2;edge.position.set(1.59,0,.035);root.add(edge);
  box(edge,m.enamel,0,0,0,.27,2.87,.11,.015);
  box(edge,m.rubber,0,0,.066,.095,2.50,.018);
  for(const yy of [-.90,.90])box(edge,m.metal,0,yy,.098,.33,.075,.13,.012);
  box(edge,m.red,0,-.10,.095,.046,.44,.025,.005);
  const signal=new THREE.MeshBasicMaterial({color:0x85e3af,toneMapped:false});
  box(edge,signal,0,.61,.094,.10,.055,.025,.006);
  root.userData={door,signal,inner};
  return root;
}

export function createEVABay(m,y){
  const root=new THREE.Group();root.name='EVA preparation bay';const suits=[];
  for(const x of [7.25,10.88]){
    box(root,m.dark,x,y+1.36,-1.25,.085,2.66,.19,.015);
    box(root,m.metal,x,y+.19,-.70,.11,.16,1.14,.014);
  }
  rod(root,m.metal,[7.25,y+EVA_BAY.railY,-1.04],[10.88,y+EVA_BAY.railY,-1.04],.046);
  box(root,m.dark,9.05,y+.12,-.69,3.71,.12,1.25,.025);
  for(let i=0;i<25;i++)box(root,m.metal,7.34+i*.141,y+.186,-.68,.075,.013,1.06);
  EVA_BAY.suitX.forEach((x,index)=>{
    const suit=hangingSuit(m,index);suit.position.set(x,y+.35,EVA_BAY.suitZ);suit.scale.y=.90;suit.rotation.y=(index-1)*.16;root.add(suit);suits.push(suit);
  });
  const hatch=createEVAHatch(m,y),innerHatch=createEVAHatch(m,y,true);root.add(hatch,innerHatch);
  const equipmentRack=createEquipmentRack(m,y);root.add(equipmentRack);
  return{root,suits,hatch,innerHatch,equipmentRack};
}

export function animateAirlock(door,signal,opening){
  door.position.z=EVA_BAY.depth-opening*3.2;
  door.visible=opening<.999;
  signal.color.setHex(opening>.01?0xf3bd62:0x85e3af);
}
