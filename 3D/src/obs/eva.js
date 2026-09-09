import * as THREE from 'three';
import {box,ball,cylinder,pipe,rod,label} from './materials.js';
import {EVA_PASSAGE} from './layout.js';
import {createEVAHelmet} from './eva-helmet.js';

export const EVA_BAY={suitX:[7.85,9.05,10.25],suitZ:-.73,railY:2.62,hatchX:13.03,innerX:(EVA_PASSAGE.x-700)*.022,hatchYaw:-Math.PI/2,depth:-.12};

function ring(parent,material,x,y,z,r,tube=.025){
  const mesh=new THREE.Mesh(new THREE.TorusGeometry(r,tube,8,32),material);mesh.position.set(x,y,z);parent.add(mesh);return mesh;
}
function paddedLimb(parent,m,a,b,r){
  rod(parent,m.evaCloth,a,b,r);
  ball(parent,m.evaCloth,...a,r*1.05,r*1.1,r*1.05);
  ball(parent,m.evaCloth,...b,r*.95,r,r*.95);
  const from=new THREE.Vector3(...a),to=new THREE.Vector3(...b),axis=to.clone().sub(from).normalize();
  for(let i=0;i<3;i++){
    const point=from.clone().lerp(to,.55+i*.14),crease=ring(parent,m.cloth,point.x,point.y,point.z,r*.97,.014);
    crease.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),axis);
  }
}

export function hangingSuit(m,index){
  const suit=new THREE.Group();suit.name=`EVA suit ${index+1}`;suit.userData.suitNumber=index+1;
  // The backpack is held by the rack; slack sleeves and raised boots show storage, not a wearer.
  box(suit,m.dark,0,1.33,-.25,.50,.73,.23,.06);
  box(suit,m.enamel,0,1.34,-.39,.45,.62,.08,.035);
  for(const side of [-1,1]){
    cylinder(suit,m.metal,side*.16,1.28,-.41,.068,.45,.068,16);
    box(suit,m.dark,side*.19,1.66,-.3,.07,.17,.19,.016);
  }
  box(suit,m.evaCloth,0,1.28,0,.53,.62,.39,.14);
  ball(suit,m.evaCloth,0,1.02,0,.255,.23,.19);
  cylinder(suit,m.rubber,0,.985,0,.237,.075,.237,28).scale.z=.79;
  for(const side of [-1,1]){
    const hip=[side*.135,.94,-.015],knee=[side*.16,.56,.015],ankle=[side*.17,.22,.025];
    paddedLimb(suit,m,hip,knee,.125);paddedLimb(suit,m,knee,ankle,.111);
    box(suit,m.dark,side*.16,.55,.117,.15,.16,.055,.035);
    cylinder(suit,m.dark,side*.17,.22,.025,.115,.10,.115,24);
    box(suit,m.evaCloth,side*.17,.105,.075,.215,.22,.34,.058);
    box(suit,m.rubber,side*.17,.035,.085,.228,.065,.36,.025);
    for(let j=0;j<3;j++)box(suit,m.dark,side*.17,.10+j*.036,.236,.16,.013,.018,.004);
    const shoulder=[side*.29,1.49,-.005],elbow=[side*.405,1.17,.01],wrist=[side*.42,.91,.06];
    paddedLimb(suit,m,shoulder,elbow,.112);paddedLimb(suit,m,elbow,wrist,.092);
    const band=rod(suit,index===1?m.yellow:m.red,[side*.365,1.325,.001],[side*.38,1.28,.004],.115);
    band.name='Identification band';
    cylinder(suit,m.metal,side*.42,.87,.06,.096,.071,.096,24);
    ball(suit,m.evaCloth,side*.422,.75,.083,.086,.117,.064);
    ball(suit,m.evaCloth,side*.35,.783,.105,.037,.067,.04);
    for(let j=0;j<3;j++)rod(suit,m.cloth,[side*.422-.043+j*.029,.72,.142],[side*.422-.043+j*.029,.787,.142],.005);
  }
  cylinder(suit,m.metal,0,1.66,0,.185,.095,.185,32);
  cylinder(suit,m.rubber,0,1.707,0,.172,.028,.172,32);
  suit.add(createEVAHelmet(m));
  box(suit,m.dark,0,1.37,.214,.32,.27,.072,.035);
  box(suit,m.enamel,0,1.39,.258,.285,.214,.03,.025);
  for(const side of [-1,1]){
    const socket=cylinder(suit,side<0?m.teal:m.red,side*.086,1.395,.283,.034,.025,.034,16);socket.rotation.x=Math.PI/2;
  }
  label(suit,`EVA-${String(index+1).padStart(2,'0')}`,0,1.51,.281,.23,.065,{size:65,fg:'#182426',bg:'#d4d8c9'});
  pipe(suit,m.rubber,[[-.12,1.29,.263],[-.23,1.18,.26],[-.25,1.08,.12],[-.25,1.19,-.23]],.037);
  pipe(suit,m.metal,[[.28,1.66,-.23],[.23,2.27,-.23],[0,2.35,-.23],[0,2.40,-.23]],.022);
  pipe(suit,m.metal,[[0,2.38,-.23],[0,2.48,-.23],[0,2.5,-.34],[0,2.43,-.4]],.022);
  return suit;
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
    const suit=hangingSuit(m,index);suit.position.set(x,y+.35,EVA_BAY.suitZ);suit.scale.y=.90;root.add(suit);suits.push(suit);
  });
  box(root,m.dark,9.05,y+2.78,1.69,3.35,.30,.12,.014);
  label(root,'EVA / SUIT SERVICE',9.05,y+2.78,1.756,3.31,.26,{size:48});
  const hatch=createEVAHatch(m,y),innerHatch=createEVAHatch(m,y,true);root.add(hatch,innerHatch);
  label(root,'INNER',EVA_BAY.innerX-.15,y+2.81,1.80,.84,.24,{size:61});
  label(root,'EVA / OUTER',EVA_BAY.hatchX-.62,y+2.81,1.80,1.48,.24,{size:48});
  return{root,suits,hatch,innerHatch};
}

export function animateAirlock(door,signal,opening){
  door.position.z=EVA_BAY.depth-opening*3.2;
  door.visible=opening<.999;
  signal.color.setHex(opening>.01?0xf3bd62:0x85e3af);
}
