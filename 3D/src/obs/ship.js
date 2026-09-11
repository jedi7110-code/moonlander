import * as THREE from 'three';
import {createDiningProps} from './dining.js';
import {box,ball,cylinder,pipe,rod,label,screen,batchStatic} from './materials.js';
import {createGym} from './gym.js';
import {GYM,PLANT,CAT_PORT,CAT_BOWL,STATIONS,LOUNGE_SEAT} from './layout.js';
import {createPlantRack} from './plants.js';
import {catPort} from './cat-ports.js';
import {createEVABay} from './eva.js';
import {createMedicalBay,MED_BED} from './medical.js';
import {createBunk} from './bunk.js';

export const FLOOR_Y=[6.784,3.392,0];
export const positionX=x=>(x-700)*.022;
export const positionY=y=>(870-y)*.016;
export const HABITAT_VIEW={centerY:6.6,minHeight:15.2,panMinY:0,panMaxY:13.4};

export function createAccessLadder(m){
  const root=new THREE.Group();root.name='Interdeck access shaft';
  const bottom=.08,top=13.14;
  panel(root,m,0,6.65,-1.46,1.12,13.3,m.dark);
  for(const side of [-1,1]){
    rod(root,m.yellow,[side*.36,bottom,.03],[side*.36,top,.03],.045);
    box(root,m.dark,side*.56,6.7,-.5,.18,13.4,1.45,.02);
    box(root,m.metal,side*.64,11.93,-.32,.10,2.75,1.83,.016);
    for(const y of [11.04,12.12]){
      box(root,m.dark,side*.53,y,.26,.095,.22,.05,.012);
      box(root,m.lamp,side*.53,y,.292,.031,.13,.015,.005);
    }
  }
  // Keep rung spacing continuous through the opening toward the rotation axis.
  for(let i=0;i<=46;i++){
    const y=.12+i*.28;
    const rung=rod(root,m.metal,[-.36,y,.03],[.36,y,.03],.028);rung.name='Ladder rung';
  }
  for(const y of [...FLOOR_Y,10.58])for(const side of [-1,1])box(root,m.yellow,side*.64,y+.026,.74,.06,.045,1.58);
  return root;
}

function bolts(parent,m,x,y,z,w,h) {
  for(const dx of [-w/2+.04,w/2-.04])for(const dy of [-h/2+.04,h/2-.04]){
    const screw=cylinder(parent,m.metal,x+dx,y+dy,z,.018,.015,.018,6);screw.rotation.x=Math.PI/2;
  }
}
function panel(parent,m,x,y,z,w,h,color=m.enamel) {
  box(parent,m.rubber,x,y,z,w+.025,h+.025,.10,.02);box(parent,color,x,y,z+.064,w,h,.06,.025);bolts(parent,m,x,y,z+.102,w,h);
}
function grille(parent,m,x,y,z,w,h) {
  box(parent,m.rubber,x,y,z,w,h,.08,.018);
  for(let i=0;i<Math.floor(h/.055);i++)box(parent,m.metal,x,y-h/2+.035+i*.055,z+.065,w-.045,.012,.018);
}
function gauge(parent,m,x,y,z,r=.09) {
  const bezel=cylinder(parent,m.metal,x,y,z,r,.06);bezel.rotation.x=Math.PI/2;
  const dial=cylinder(parent,m.white,x,y,z+.035,r*.82,.01);dial.rotation.x=Math.PI/2;
  rod(parent,m.black,[x,y,z+.045],[x+r*.47,y+r*.38,z+.045],.007);
}
function consoleUnit(parent,m,x,y,w=1.7,seed=0) {
  box(parent,m.dark,x,y+.58,-.30,w,1.15,1.15,.08);
  box(parent,m.enamel,x,y+.54,.3,w-.10,.90,.09,.03);
  grille(parent,m,x,y+.46,.36,w*.66,.3);
  box(parent,m.dark,x,y+1.14,-.5,w+.06,.14,1.47,.045);
  box(parent,m.rubber,x,y+1.7,-.80,w-.02,1.07,.37,.05);
  box(parent,m.enamel,x,y+1.7,-.58,w-.1,.98,.09,.035);
  box(parent,m.black,x-.1,y+1.73,-.51,w*.70,.73,.09,.04);
  screen(parent,x-.1,y+1.73,-.45,w*.64,.61,seed);
  for(let i=0;i<4;i++){const knob=cylinder(parent,m.black,x+w*.39,y+1.49+i*.14,-.48,.035,.06);knob.rotation.x=Math.PI/2;}
  for(let row=0;row<3;row++)for(let col=0;col<10;col++)box(parent,(row+col)%11===0?m.red:m.rubber,x-w*.34+col*w*.073,y+1.234,.00+row*.10,.074,.028,.059,.006);
  for(let i=0;i<5;i++)ball(parent,i%3?m.green:m.amber,x-w*.34+i*.135,y+1.243,-.3,.017,.014,.017);
  pipe(parent,m.black,[[x+.5,y+.12,-.6],[x+.7,y+.15,-1],[x+.75,y+1.1,-1]],.035);
}
function chair(parent,m,x,y,z,orientation=0) {
  const group=new THREE.Group();group.position.set(x,y,z);group.rotation.y=orientation;parent.add(group);
  cylinder(group,m.metal,0,.25,0,.06,.5);for(let i=0;i<5;i++){const a=i*Math.PI*2/5;rod(group,m.dark,[0,.10,0],[Math.sin(a)*.32,.08,Math.cos(a)*.32],.032);}
  box(group,m.rubber,0,.5,0,.53,.095,.57,.045);box(group,m.cushion,0,.56,0,.49,.08,.5,.035);
  box(group,m.dark,0,.9,-.28,.53,.72,.07,.035);box(group,m.cushion,0,.95,-.225,.47,.59,.09,.032);
  for(const s of [-1,1]){rod(group,m.metal,[s*.29,.49,-.16],[s*.29,.80,-.16],.024);box(group,m.rubber,s*.29,.8,.018,.085,.05,.39,.02);}
}
function cupboard(parent,m,x,y,z,w=1.25,h=1.85) {
  box(parent,m.dark,x,y+h/2,z,w,h,.62,.04);
  for(const side of [-1,1]){panel(parent,m,x+side*w*.245,y+h/2,z+.35,w*.475,h-.07);box(parent,m.black,x+side*.075,y+h*.52,z+.42,.03,.2,.04,.01);grille(parent,m,x+side*w*.245,y+.25,z+.414,w*.33,.2);}
}
export function createLoungeTable(m){
  const root=new THREE.Group(),top=LOUNGE_SEAT.top+.32,thickness=.08,underside=top-thickness;
  root.name='Lounge table';
  cylinder(root,m.metal,0,underside/2,0,.056,underside).name='Table pedestal';
  box(root,m.enamel,0,top-thickness/2,0,1.51,thickness,.80,.08).name='Tabletop';
  box(root,m.red,-.33,top+.035/2,-.03,.38,.035,.24,.007).name='Table book';
  cylinder(root,m.white,.21,top+.17/2,0,.07,.17,.079).name='Table cup';
  return root;
}
export function createLounge(m){
  const root=new THREE.Group(),seat=LOUNGE_SEAT;root.name='Lounge furniture';
  box(root,m.dark,7.4,.24,seat.centerDepth,4.12,.32,.70,.045);
  box(root,m.cushion,7.4,seat.top-.08,seat.centerDepth,3.98,.16,seat.cushionDepth,.07);
  box(root,m.cushion,7.4,.82,-.44,4.03,.84,.20,.06);
  for(const x of [5.32,9.49])box(root,m.enamel,x,.43,seat.centerDepth,.16,.69,.80,.04);
  for(let i=0;i<3;i++)box(root,m.olive,6.05+i*1.25,.75,-.255,.7,.50,.15,.08);
  const table=createLoungeTable(m);table.position.set(8.25,0,.91);root.add(table);
  return root;
}
export function createStationInteraction(id,bounds,pickMaterial){
  const size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3());
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(size.x,size.y,size.z),pickMaterial);
  mesh.position.copy(center);mesh.userData.station=id;
  const group=new THREE.Group(),material=new THREE.MeshBasicMaterial({color:0xf3bd62,transparent:true,depthWrite:false,depthTest:false,toneMapped:false});
  group.position.set(center.x,bounds.min.y,bounds.max.z+.025);group.visible=false;
  box(group,material,0,.055,0,size.x,.07,.018);
  box(group,material,0,size.y-.02,0,.66,.10,.025,.012);
  for(const side of [-1,1])for(const y of [.19,size.y-.16]){
    box(group,material,side*size.x/2,y,0,.045,.30,.018);
    if(y>.19)box(group,material,side*(size.x/2-.14),size.y-.02,0,.28,.045,.018);
  }
  group.children.forEach(part=>{part.castShadow=false;part.receiveShadow=false;part.renderOrder=8;});
  return{mesh,group,material};
}
function plumbing(parent,animated,m,x,y,type) {
  box(parent,m.dark,x,y+1.29,-1.20,1.66,2.59,.12,.04);
  for(const side of [-1,1])box(parent,m.white,x+side*.79,y+1.29,-.34,.10,2.59,1.80,.025);
  box(parent,m.white,x,y+2.54,-.34,1.66,.10,1.80,.025);
  box(parent,m.dark,x,y+.025,-.34,1.50,.05,1.80,.01);
  if(type==='toilet'){
    cylinder(parent,m.white,x,y+.24,-.72,.24,.48,.29);
    const seat=new THREE.Mesh(new THREE.TorusGeometry(.22,.045,12,36),m.dark);seat.rotation.x=Math.PI/2;seat.position.set(x,y+.49,-.72);parent.add(seat);
  }else pipe(parent,m.metal,[[x+.5,y+.4,-1.08],[x+.5,y+2.15,-1.08],[x,y+2.15,-.85]],.025);
  const door=new THREE.Group();door.position.set(x-.735,y,.44);animated.add(door);
  panel(door,m,.735,1.3,0,1.47,2.46,m.white);
  panel(door,m,.735,1.55,.09,.85,1.03,m.dark);
  box(door,m.black,1.295,1.17,.14,.06,.30,.05,.012);
  label(door,type==='shower'?'SHOWER':'WC',.735,2.25,.16,.94,.26,{size:65});
  const lamp=ball(door,m.green,1.285,1.62,.16,.026,.026,.016);lamp.name=type+'Lamp';
  grille(door,m,.735,.36,.15,1.08,.27);
  pipe(parent,m.metal,[[x-.72,y+2.8,-.87],[x-.72,y+2.67,-.87],[x,y+2.67,-.87],[x,y+2.6,-.87]],.035);
  return{door,lamp};
}
function hatch(parent,animated,m,x,y) {
  box(parent,m.dark,x,y+1.15,-.81,2.1,2.30,.46,.11);
  box(parent,m.metal,x,y+1.15,-.55,1.86,2.08,.14,.11);
  box(parent,m.black,x,y+1.15,-.455,1.70,1.92,.025,.06);
  const door=new THREE.Group();door.position.set(x-.85,y,-.43);animated.add(door);
  door.name='Vertical supply shutter';door.userData.closedY=y;
  box(door,m.enamel,.85,1.15,0,1.7,1.92,.10,.10);
  box(door,m.dark,.85,1.63,.065,.6,.40,.025,.05);
  box(door,m.dark,.85,.96,.057,.45,.12,.016,.012);
  box(door,m.metal,.85,.98,.07,.30,.028,.024,.007);
  // The panel retracts into an overhead wall pocket, not through the next deck.
  const pocketLip=new THREE.Plane(new THREE.Vector3(0,-1,0),y+2.12);
  door.traverse(part=>{if(part.isMesh){part.material=part.material.clone();part.material.clippingPlanes=[pocketLip];part.material.clipShadows=true;}});
  for(const side of [-1,1])box(parent,m.metal,x+side*.91,y+1.17,-.36,.065,2.02,.15,.012);
  box(parent,m.dark,x,y+2.17,-.28,1.96,.14,.30,.025);
  for(const side of [-1,1]){box(parent,m.dark,x+side*.91,y+.52,-.36,.12,.15,.13);box(parent,m.dark,x+side*.91,y+1.84,-.36,.12,.15,.13);}
  label(parent,'SUPPLY HATCH',x,y+2.47,-.32,1.74,.26,{fg:'#e2c174',size:52});
  box(parent,m.dark,x,y+.32,.32,2.15,.55,.73,.04);
  box(parent,m.metal,x,y+.64,.32,2.27,.065,.84,.02);
  for(let i=0;i<15;i++)box(parent,i%2?m.black:m.yellow,x-1.03+i*.146,y+.285,.705,.146,.14,.015);
  const lamp=new THREE.MeshBasicMaterial({color:0x4b6658,toneMapped:false});
  box(animated,lamp,x,y+2.25,-.08,.62,.065,.05,.014);
  return{door,lamp};
}
function engine(parent,m,x,y) {
  box(parent,m.dark,x,y+.18,-.2,2.15,.24,1.56,.03);
  const tank=cylinder(parent,m.metal,x,y+1.24,-.35,.52,1.90,.52,32);
  ball(parent,m.dark,x,y+2.16,-.35,.53,.18,.53);ball(parent,m.dark,x,y+.29,-.35,.53,.18,.53);
  for(let i=0;i<11;i++){const ring=new THREE.Mesh(new THREE.TorusGeometry(.526,.019,6,28),m.dark);ring.rotation.x=Math.PI/2;ring.position.set(x,y+.40+i*.16,-.35);parent.add(ring);}
  pipe(parent,m.red,[[x-.9,y+.18,-.30],[x-.9,y+2.5,-.30],[x+.9,y+2.5,-.30],[x+.9,y+.15,-.30]],.07);
  pipe(parent,m.teal,[[x-.73,y+.1,.05],[x-.73,y+1.84,.05],[x-.35,y+1.84,.1]],.042);
  gauge(parent,m,x,y+1.52,.22,.14);label(parent,'COOLANT\nLOOP 02',x,y+.92,.215,.60,.38,{size:48});
  for(const side of [-1,1]){const valve=new THREE.Mesh(new THREE.TorusGeometry(.15,.018,8,20),m.red);valve.position.set(x+side*.9,y+1.04,-.20);parent.add(valve);}
}

export function buildShip(m) {
  const staticRoot=new THREE.Group(),animated=new THREE.Group(),targets=[];
  box(staticRoot,m.dark,0,4.94,-.28,26.8,10.69,3.2,.3);
  // Interior faces sit in front of the hull's back surface; the viewing wall is removed.
  box(staticRoot,m.enamel,0,5,-1.98,26.30,10.20,.22,.14);
  for(const side of [-1,1]){
    box(staticRoot,m.dark,side*7,10.31,-.12,12.9,.26,3.6,.05);
    box(staticRoot,m.enamel,side*6.925,10.48,-.14,12.75,.19,3.46,.035);
  }
  // The enclosing block is only a back plate, not a solid volume.
  staticRoot.children[0].scale.z=.19;
  staticRoot.children[0].position.z=-2.08;
  for(const side of [-1,1]){
    // The operations deck ends at a recessed airlock instead of a solid side wall.
    const spans=side===1?[[-.365,FLOOR_Y[1]],[FLOOR_Y[0]-.15,10.245]]:[[-.365,10.245]];
    for(const [bottom,top]of spans){
      box(staticRoot,m.enamel,side*13.07,(bottom+top)/2,-.13,.40,top-bottom,3.45,.05);
      box(staticRoot,m.metal,side*13.33,(bottom+top)/2,-.52,.14,top-bottom-.1,2.41,.025);
    }
    for(let i=0;i<27;i++)if(side<0||.11+i*.37<FLOOR_Y[1]||.11+i*.37>FLOOR_Y[0]-.15)box(staticRoot,m.dark,side*13.40,.11+i*.37,-.25,.18,.1,1.73,.012);
    pipe(staticRoot,m.dark,[[side*13.63,.20,-.65],[side*13.65,1,-.65],[side*13.65,8.8,-.65],[side*13.15,10.1,-.65]],.115);
  }
  FLOOR_Y.forEach((y,level)=>{
    for(const side of [-1,1]){
      box(staticRoot,m.dark,side*6.73,y-.17,-.12,12.37,.32,3.38,.025);
      box(staticRoot,m.metal,side*6.73,y-.013,-.12,12.3,.025,3.25);
    }
    if(level===2){
      box(staticRoot,m.dark,0,y-.17,-.12,1.09,.32,3.38,.025);
      box(staticRoot,m.metal,0,y-.013,-.12,1.16,.025,3.25);
    }
    box(staticRoot,m.dark,0,y-.18,1.56,26.22,.38,.20,.02);
    box(staticRoot,m.dark,-1.55,y+2.30,-1.43,1.36,.21,.045,.012);
    label(staticRoot,`${String(level+1).padStart(2,'0')} / ${['HABITATION','OPERATIONS','LIFE SUPPORT'][level]}`,-1.55,y+2.30,-1.40,1.30,.16,{fg:'#d4dbcc',size:48});
    for(let xx=-12.8;xx<12.8;xx+=.42){
      for(const zz of [.1,.8,-.75])if(Math.abs(xx)>.50)box(staticRoot,m.rubber,xx,y+.005,zz,.18,.012,.021);
      box(staticRoot,m.rubber,xx,y-.19,1.68,.20,.105,.012,.009);
    }
    for(let xx=-11.8;xx<12.5;xx+=1.52){
      panel(staticRoot,m,xx,y+1.44,-1.70,1.48,2.70,level===1?m.dark:m.enamel);
      if(level===0&&Math.abs(xx)<1.265)continue;
      box(staticRoot,m.dark,xx,y+2.96,-.25,1.43,.17,3.14,.025);
      box(staticRoot,m.metal,xx,y+2.85,-.36,.82,.13,.44,.02);
      box(staticRoot,level===1?m.coolLamp:m.lamp,xx,y+2.775,-.36,.73,.025,.31,.015);
    }
    for(const zz of [-1.25,-.94])pipe(staticRoot,zz===-1.25?m.red:m.metal,[[-12.8,y+2.6,zz],[-6,y+2.6,zz],[0,y+2.6,zz],[6,y+2.6,zz],[12.8,y+2.6,zz]],zz===-1.25?.055:.075);
    for(let xx=-12;xx<=12;xx+=2.4){box(staticRoot,m.dark,xx,y+2.60,-1.08,.052,.29,.55);}
    for(const xx of [-12.83,-3.1,7.1,12.83]){
      if(level===1&&xx===7.1)continue;
      box(staticRoot,m.dark,xx,y+1.5,-1.32,.10,2.98,.48);
      box(staticRoot,m.enamel,xx,y+1.50,-1.035,.16,2.98,.10,.02);
      box(staticRoot,m.red,xx,y+1.15,-.958,.06,.45,.04,.01);
    }
    const deckLight=new THREE.PointLight(level===1?0xb4dcdb:0xffebc7,level===0?12:45,20,2);deckLight.position.set(-5,y+2.3,.6);animated.add(deckLight);
    const secondLight=new THREE.PointLight(0xe6ebe4,32,17,2);secondLight.position.set(6,y+2.3,.6);animated.add(secondLight);
  });
  for(const [level,y]of FLOOR_Y.entries())catPort(staticRoot,m,positionX(CAT_PORT.x),y,level);
  // The upper shaft is a visible continuation, not an additional playable deck.
  staticRoot.add(createAccessLadder(m));

  const top=FLOOR_Y[0],mid=FLOOR_Y[1];
  const bathrooms={shower:plumbing(staticRoot,animated,m,positionX(240),top,'shower'),toilet:plumbing(staticRoot,animated,m,positionX(380),top,'toilet')};
  const bunk=createBunk(m);bunk.root.position.set(positionX(510),top,0);animated.add(bunk.root);
  cupboard(staticRoot,m,2.1,top,-1.14,1.54,2.31);
  const lounge=createLounge(m);lounge.position.y=top;staticRoot.add(lounge);
  const loungeBounds=new THREE.Box3().setFromObject(lounge).expandByScalar(.06);
  cupboard(staticRoot,m,11.55,top,-1.11,1.35,2.35);
  panel(staticRoot,m,4.06,top+1.5,-1.38,1.37,1.26,m.white);
  label(staticRoot,'TARAIRON\nCREW 01',4.06,top+1.57,-1.255,1.13,.37,{bg:'#c8d0c4',fg:'#354236',size:40});

  for(let i=0;i<3;i++)consoleUnit(staticRoot,m,-10.2+i*1.63,mid,1.56,i);
  chair(staticRoot,m,-8.8,mid,.82,Math.PI);
  panel(staticRoot,m,-4.57,mid+1.48,-1.41,1.52,2.43,m.dark);
  for(let i=0;i<4;i++){screen(staticRoot,-4.57,mid+.79+i*.42,-1.30,1.16,.27,i+8);}
  for(let i=0;i<4;i++)gauge(staticRoot,m,-4.99+i*.27,mid+2.39,-1.24,.084);
  const medical=createMedicalBay(m,mid);staticRoot.add(medical.root);
  animated.attach(medical.bed);animated.attach(medical.rig.root);
  const evaBay=createEVABay(m,mid);staticRoot.add(evaBay.root);
  const innerDoor=evaBay.innerHatch.userData.door,innerSignal=evaBay.innerHatch.userData.signal;
  animated.attach(innerDoor);

  for(let i=0;i<2;i++){
    const x=-10.8+i*1.50;box(staticRoot,m.dark,x,.49,-.48,1.47,.95,1.13,.03);panel(staticRoot,m,x,.47,.13,1.39,.83,m.white);box(staticRoot,m.black,x,.76,.215,.49,.035,.044,.01);box(staticRoot,m.metal,x,1.0,-.42,1.51,.07,1.25,.018);
    cupboard(staticRoot,m,x,1.65,-1.20,1.41,1.03);
  }
  box(staticRoot,m.dark,-10.8,1.052,-.36,1.02,.028,.72,.04);
  for(const x of [-11.11,-10.56])for(const z of [-.58,-.17]){const ring=new THREE.Mesh(new THREE.TorusGeometry(.17,.017,8,22),m.metal);ring.rotation.x=Math.PI/2;ring.position.set(x,1.075,z);staticRoot.add(ring);}
  cylinder(staticRoot,m.metal,-11.11,1.19,-.58,.146,.23,.17);
  box(staticRoot,m.dark,-9.3,1.075,-.29,.85,.03,.52,.08);
  pipe(staticRoot,m.metal,[[-9.3,1.01,-.73],[-9.3,1.41,-.73],[-9.3,1.45,-.44],[-9.3,1.30,-.38]],.028);
  box(staticRoot,m.enamel,-11.90,1.42,-.33,.65,.74,.8,.045);grille(staticRoot,m,-11.9,1.4,.09,.37,.27);
  cylinder(staticRoot,m.white,-11.50,1.13,-.02,.055,.18,.065);
  const hydroX=positionX(560);cupboard(staticRoot,m,hydroX,0,-1.03,1.25,2.35);
  const plants=createPlantRack(m,positionX(PLANT.x));animated.add(plants.root);
  box(staticRoot,m.dark,hydroX,1.42,-.64,.66,.61,.13,.025);label(staticRoot,'H2O / 21°C',hydroX,1.62,-.56,.54,.13,{fg:'#a2d9c7',size:50});
  for(const x of [hydroX-.15,hydroX+.15]){cylinder(staticRoot,m.metal,x,1.26,-.47,.034,.10);ball(staticRoot,x<hydroX?m.teal:m.red,x,1.26,-.40,.025,.025,.025);}
  box(staticRoot,m.metal,hydroX,1.05,-.12,.74,.04,.76);
  const diningDocks={galley:createDiningProps(animated,m),hydro:createDiningProps(animated,m)};
  const galleyX=positionX(300),foodDock=diningDocks.galley,waterDock=diningDocks.hydro;
  foodDock.bowl.position.set(galleyX+.095,1.077,.10);foodDock.bowl.rotation.y=Math.PI;foodDock.bowl.visible=true;
  foodDock.spoon.position.set(galleyX-.17,1.039,.10);foodDock.spoon.visible=true;foodDock.bite.visible=false;
  waterDock.mug.position.set(hydroX-.17,1.134,.16);waterDock.mug.rotation.y=Math.PI;waterDock.mug.visible=true;
  const gym=createGym(m,positionX(GYM.x));animated.add(gym.root);
  panel(staticRoot,m,positionX(GYM.x)-.70,.97,-1.36,.57,.93,m.dark);
  for(let i=0;i<3;i++){
    const y=.69+i*.28,x=positionX(GYM.x)-.70;
    for(const side of [-1,1])rod(staticRoot,m.metal,[x+side*.1,y-.045,-1.28],[x+side*.1,y-.045,-1.08],.019);
    rod(staticRoot,m.metal,[x-.16,y,-1.1],[x+.16,y,-1.1],.024);
    for(const side of [-1,1]){const weight=cylinder(staticRoot,m.black,x+side*.14,y,-1.1,.085,.08,.085,12);weight.rotation.z=Math.PI/2;}
  }
  engine(staticRoot,m,5.65,0);
  const supplyHatch=hatch(staticRoot,animated,m,positionX(1110),0);
  for(let i=0;i<3;i++)box(staticRoot,i===1?m.teal:m.olive,11.78,.26+i*.48,-.61,1.23,.46,.89,.07);
  const bowlX=positionX(CAT_BOWL.x),bowlY=FLOOR_Y[CAT_BOWL.floor],bowlZ=CAT_BOWL.depth;
  cylinder(staticRoot,m.metal,bowlX,bowlY+.07,bowlZ,.16,.10,.20,28);
  cylinder(staticRoot,m.dark,bowlX,bowlY+.121,bowlZ,.16,.012,.16,28);
  const foodGroup=new THREE.Group();foodGroup.position.set(bowlX,bowlY,bowlZ);animated.add(foodGroup);
  for(let i=0;i<18;i++){const a=i*2.4,r=.025+Math.sqrt(i/18)*.13;ball(foodGroup,m.olive,Math.cos(a)*r,CAT_BOWL.foodHeight,Math.sin(a)*r,.025,.018,.022);}
  const fan=new THREE.Group();fan.position.set(12.08,2.14,-1.32);animated.add(fan);
  const fanRim=new THREE.Mesh(new THREE.TorusGeometry(.34,.039,12,36),m.metal);fan.add(fanRim);
  for(let i=0;i<4;i++){const blade=box(fan,m.dark,0,0,0,.18,.61,.035,.03);blade.rotation.z=i*Math.PI/2;}
  const cargo=[];
  ['food','water','catfood'].forEach((key,i)=>{
    const group=new THREE.Group();group.name='Delivery '+key;group.position.set(positionX(1110)+(i-1)*.70,.675,.32);group.visible=false;animated.add(group);
    if(key==='water'){
      box(group,m.teal,0,.31,0,.53,.61,.40,.04);
      for(const side of [-1,1])box(group,m.metal,side*.22,.31,.211,.025,.5,.02);
      box(group,m.black,0,.63,0,.24,.085,.12,.022);label(group,'H2O',0,.30,.211,.38,.18,{size:60});
    }else for(let j=0;j<2;j++){
      const y=.137+j*.283,material=key==='food'?m.olive:m.yellow;
      box(group,material,0,y,0,.61,.272,.43,.025);
      for(const side of [-1,1])box(group,m.dark,side*.20,y,.223,.04,.274,.012);
      label(group,key==='food'?'RATIONS':'CAT FOOD',0,y,.227,.33,.11,{size:42});
    }
    cargo.push(group);
  });
  const pickMaterial=new THREE.MeshBasicMaterial({visible:false}),indicators={};
  STATIONS.forEach(({id,x,floor:level})=>{
    const w=id==='galley'?3.06:id==='plant'?2.90:id==='medical'?5.10:id==='eva'?3.65:['airlock','innerHatch'].includes(id)?.62:1.9;
    const fixtureX=id==='galley'?-10.05:id==='airlock'?evaBay.hatch.position.x:id==='innerHatch'?evaBay.innerHatch.position.x:id==='medical'?MED_BED.x-.52:positionX(x);
    const bounds=id==='plant'?new THREE.Box3().setFromObject(plants.root).expandByScalar(.04):id==='lounge'?loungeBounds:new THREE.Box3().setFromCenterAndSize(new THREE.Vector3(fixtureX,FLOOR_Y[level]+1.25,0),new THREE.Vector3(w,2.5,3));
    const {mesh,group,material}=createStationInteraction(id,bounds,pickMaterial);
    if(id!=='lounge')group.position.z=1.75;
    targets.push(mesh);animated.add(mesh,group);indicators[id]={group,material};
  });
  return {staticMesh:batchStatic(staticRoot),animated,targets,indicators,cargo,hatchDoor:supplyHatch.door,hatchLamp:supplyHatch.lamp,foodGroup,fan,gym,medical,innerDoor,innerSignal,bathrooms,diningDocks,plants,bunk};
}
