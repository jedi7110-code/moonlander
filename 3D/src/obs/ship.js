import * as THREE from 'three';
import {CABIN_LIGHT_COLOR,LADDER_LIGHT_LAYOUT} from './lighting.js';
import {createDiningProps} from './dining.js';
import {box,ball,cylinder,pipe,rod,label,batchStatic} from './materials.js';
import {createGym} from './gym.js';
import {DECK,FLOORS,GYM,PLANT,CAT_PORT,CAT_BOWL,STATIONS,getStation,LOUNGE_SEAT,LOUNGE_TABLE,CABIN_AISLE,HYDRO_TRAY,ASHTRAY} from './layout.js';
import {createPlantRack} from './plants.js';
import {catPort} from './cat-ports.js';
import {createEVABay} from './eva.js';
import {createMedicalBay,MED_BED} from './medical.js';
import {createBunk} from './bunk.js';
import {industrialMaterials,addIndustrialDeck,addWorkLights} from './industrial.js';
import {BULKHEAD_GATE,gateWall,createBulkheadGate} from './bulkhead-gate.js';
import {addCabinDressing} from './cabin-dressing.js';
import {configurePocketShutter,addPocketShutterFrame} from './shutter.js';
import {HATCH_TRAVEL} from './delivery.js';
import {paintSupplyLedge} from './supply-ledge.js';
import {createWasteIncinerator} from './waste-incinerator.js';
import {createScreenGlow} from './screen-glow.js';
import {displayFrame} from './display-frame.js';
import {createVanity} from './grooming.js';
import {createLoungeTitanium,createMachinedMetals} from './machined-metals.js';
import {createCargoStowage,createCargoVentilation} from './cargo-bay.js';
import {createLoungeCoffee,createTableLeisureProps} from './lounge-table-props.js';
import {createConsoleMaterials,addConsoleControls} from './console-controls.js';
import {ConsoleScreens} from './console-screens.js';
import {createAIServiceRack} from './ai-service-rack.js';
import {createShowerFixtures} from './shower-fixtures.js';
import {createBathroomCeilingLight} from './bathroom-lighting.js';
import {addBathroomRearWindow} from './bathroom-window.js';
import {finishLoungeSofa} from './lounge-sofa-finish.js';
import {createLoungeCap} from './lounge-cap.js';
import {createLoungeTableFrame} from './lounge-table-frame.js';
import {createRearWindowStars} from './space-stars.js';
import {finishGateFrames} from './gate-frame-finish.js';
import {createCatFoodCarton,createCatFoodMaterial} from './cat-food-package.js';

export const FLOOR_Y=[6.784,3.392,0];
// All rear rooms share the same full-width doorway and aligned centerline.
export const REAR_ROOM_GATES=FLOOR_Y.map((floor,level)=>({...BULKHEAD_GATE,floor,room:['operations','laundry','stores'][level]}));
export const positionX=x=>(x-700)*.022;
export const positionY=y=>(870-y)*.016;
export const RECESSED_OPENINGS=['shower','toilet','hatch'].map(id=>{
  const station=getStation(id),x=positionX(station.x),y=FLOOR_Y[station.floor],half=id==='hatch'?.90:.78;
  return{id,floor:station.floor,left:x-half,right:x+half,bottom:y+.04,top:y+(id==='hatch'?2.22:2.56)};
});
export const HABITAT_VIEW={centerY:6.35,minHeight:16.1,panMinY:-.6,panMaxY:13.4};
export function groomingGateBounds(){
  const gate=REAR_ROOM_GATES[DECK.HABITATION];
  return new THREE.Box3().setFromCenterAndSize(new THREE.Vector3(gate.x,gate.floor+1.31,gate.front+.06),new THREE.Vector3(2.12,2.66,.24));
}

export function createDeckFloor(m,y,level){
  const root=new THREE.Group();root.name='Deck floor '+level;
  const {deckBack:back,deckFront:front}=CABIN_AISLE,depth=front-back,center=(front+back)/2;
  for(const side of [-1,1]){
    box(root,m.dark,side*6.73,y-.17,center,12.37,.32,depth,.025);
    box(root,m.metal,side*6.73,y-.013,center,12.3,.025,depth-.13);
  }
  // Leave the ladder well open, but carry the cat's front aisle across it.
  const bridgeBack=level===2?back:.94,bridgeDepth=front-bridgeBack,bridgeZ=(front+bridgeBack)/2;
  box(root,m.dark,0,y-.17,bridgeZ,1.09,.32,bridgeDepth,.025);
  box(root,m.metal,0,y-.013,bridgeZ,1.16,.025,bridgeDepth-.13);
  box(root,m.dark,0,y-.18,front-.01,26.22,.38,.20,.02);
  for(let x=-12.8;x<12.8;x+=.42){
    for(const z of [-.75,.1,.8,CABIN_AISLE.catZ])if(Math.abs(x)>.50||z>.94||level===2)box(root,m.rubber,x,y+.005,z,.18,.012,.021);
    box(root,m.rubber,x,y-.19,front+.11,.20,.105,.012,.009);
  }
  return root;
}

export function createAccessLadder(m){
  const root=new THREE.Group();root.name='Interdeck access shaft';
  const lights=new THREE.Group();lights.name='Ladder work lights';root.add(lights);
  const diffuser=new THREE.MeshBasicMaterial({name:'Ladder light diffuser',color:CABIN_LIGHT_COLOR,toneMapped:false});
  diffuser.userData.cabinAlwaysPowered=true;
  const bottom=.08,top=13.14;
  panel(root,m,0,6.65,-1.46,1.12,13.3,m.dark);
  for(const side of [-1,1]){
    rod(root,m.yellow,[side*.36,bottom,.03],[side*.36,top,.03],.045);
    box(root,m.dark,side*.56,6.7,-.5,.18,13.4,1.45,.02);
    box(root,m.metal,side*.64,11.93,-.32,.10,2.75,1.83,.016);
    // A matched pair every four rungs lights hands and feet along the entire shaft.
    for(let i=0;i<LADDER_LIGHT_LAYOUT.count;i++){
      const y=LADDER_LIGHT_LAYOUT.firstY+i*LADDER_LIGHT_LAYOUT.spacing,sconce=new THREE.Group();sconce.name='Inward ladder light housing';
      sconce.position.set(side*.53,y,.24);sconce.lookAt(0,y-.08,.03);root.add(sconce);
      box(sconce,m.dark,0,0,0,.14,.28,.10,.012);
      box(sconce,m.metal,0,0,.054,.10,.23,.015);
      box(sconce,diffuser,0,0,.064,.065,.19,.012).name='Ladder light lens';
      box(root,diffuser,side*.53,y,.33,.040,.16,.014).name='Ladder front light lens';
      for(const x of [-.063,.063])box(sconce,m.dark,x,0,.073,.018,.28,.065);
      const light=new THREE.SpotLight(CABIN_LIGHT_COLOR,2.4,1.8,1.06,.72,2);
      light.name='Ladder hand and foot light';light.position.set(side*LADDER_LIGHT_LAYOUT.sourceX,y+LADDER_LIGHT_LAYOUT.sourceYOffset,LADDER_LIGHT_LAYOUT.sourceZ);
      light.target.position.set(0,y-.08,.03);lights.add(light,light.target);
    }
  }
  // Four shared, shadow-free sources light all the paired fixtures along the shaft.
  for(let i=0;i<4;i++){
    const light=new THREE.PointLight(CABIN_LIGHT_COLOR,4,4.2,2);
    light.name='Ladder shaft fill';light.position.set(0,1.66+i*3.36,.40);lights.add(light);
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
function consoleUnit(parent,m,controls,screens,x,y,w=1.7,seed=0) {
  box(parent,m.dark,x,y+.58,-.30,w,1.15,1.15,.08);
  box(parent,m.enamel,x,y+.54,.3,w-.10,.90,.09,.03);
  grille(parent,m,x,y+.46,.36,w*.66,.3);
  box(parent,m.dark,x,y+1.14,-.5,w+.04,.14,1.47,.045);
  box(parent,m.rubber,x,y+1.7,-.80,w-.02,1.07,.37,.05);
  displayFrame(parent,m.enamel,{x,y:y+1.7,z:-.49,width:w-.1,height:.98,depth:.20,holeWidth:w*.70+.012,holeHeight:.742,offsetX:-.1,offsetY:.03});
  box(parent,m.black,x-.1,y+1.73,-.51,w*.70,.73,.09,.04);
  displayFrame(parent,m.black,{x:x-.1,y:y+1.73,z:-.44,width:w*.70,height:.73,depth:.07,holeWidth:w*.64+.012,holeHeight:.622});
  screens.add(parent,x-.1,y+1.73,-.45,w*.64,.61,seed);
  addConsoleControls(parent,controls,{x,y,width:w,seed});
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
export function createLoungeTable(m,titanium=createLoungeTitanium()){
  const root=createLoungeTableFrame(titanium,m.enamel),top=LOUNGE_SEAT.top+.32;
  box(root,m.red,-.45,top+.035/2,-.15,.38,.035,.24,.007).name='Table book';
  const cup=createLoungeCoffee(m);cup.position.set(-.58,top+.035,-.20);cup.rotation.y=Math.PI+.58;root.add(cup);
  root.userData.loungeProps=createTableLeisureProps(root,m,top);
  return root;
}
function sofaCushionGeometry(){
  // A broad upper shoulder and tapered lower corners, rounded into upholstery.
  const width=.70,height=.58,radius=.07,thickness=.075,bevel=.022,bevelDepth=.011;
  const corners=[[-.27,.5],[.27,.5],[.5,.10],[.23,-.5],[-.23,-.5],[-.5,.10]]
    .map(([x,y])=>new THREE.Vector2(x*(width-bevel*2),y*(height-bevel*2)));
  const outline=new THREE.Shape();
  for(let i=0;i<corners.length;i++){
    const corner=corners[i],previous=corners[(i+5)%6],next=corners[(i+1)%6];
    const entry=corner.clone().add(previous.clone().sub(corner).setLength(radius));
    const exit=corner.clone().add(next.clone().sub(corner).setLength(radius));
    if(i===0)outline.moveTo(entry.x,entry.y);else outline.lineTo(entry.x,entry.y);
    outline.quadraticCurveTo(corner.x,corner.y,exit.x,exit.y);
  }
  outline.closePath();
  const geometry=new THREE.ExtrudeGeometry(outline,{depth:thickness-bevelDepth*2,steps:1,curveSegments:5,bevelEnabled:true,bevelSize:bevel,bevelThickness:bevelDepth,bevelSegments:3});
  geometry.translate(0,0,-(thickness-bevelDepth*2)/2);
  return geometry;
}
export function createLoungeSofa(m){
  const root=new THREE.Group(),seat=LOUNGE_SEAT;root.name='Lounge sofa';
  // Keep the upper contacts fixed and sink the plinth just inside the deck.
  box(root,m.dark,7.4,.194,-.225,4.12,.412,.95,.045).name='Sofa floor plinth';
  box(root,m.cushion,7.4,seat.top-.08,seat.centerDepth,3.98,.16,seat.cushionDepth,.07).name='Sofa seat';
  // Thicken toward the rear wall; keep the cushion's front and seated contacts.
  box(root,m.cushion,7.4,.82,-.52,4.03,.84,.36,.06).name='Sofa backrest';
  for(const x of [5.32,9.49])box(root,m.enamel,x,.38,-.20,.16,.79,1.00,.04).name='Sofa floor-reaching arm';
  const cushionGeometry=sofaCushionGeometry();
  for(let i=0;i<3;i++){
    const cushion=new THREE.Mesh(cushionGeometry,m.olive);cushion.name='Sofa hexagonal cushion';
    cushion.position.set(6.05+i*1.25,.87,-.303);cushion.castShadow=true;cushion.receiveShadow=true;root.add(cushion);
  }
  finishLoungeSofa(root,m);
  const cap=createLoungeCap(m);cap.rotation.set(.75,-.24,-.12,'YXZ');
  // Hook the open rear hem over the left arm's rounded front corner. The
  // hollow crown cups the end and the curved bill hangs down, clear of the seat.
  cap.position.set(5.32,.805,.260);root.add(cap);
  return root;
}
export function createLounge(m){
  const root=createLoungeSofa(m);root.name='Lounge furniture';
  const titanium=root.getObjectByName('Sofa floor-reaching arm').material;
  const table=createLoungeTable(m,titanium);table.position.set(LOUNGE_TABLE.x,0,LOUNGE_TABLE.z);root.add(table);root.userData.loungeProps=table.userData.loungeProps;
  return root;
}
export function createStationInteraction(id,bounds,pickMaterial){
  const size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3());
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(size.x,size.y,size.z),pickMaterial);
  mesh.position.copy(center);mesh.userData.station=id;
  const group=new THREE.Group(),material=new THREE.MeshBasicMaterial({color:0xf3bd62,transparent:true,depthWrite:false,depthTest:false,toneMapped:false});
  group.position.set(center.x,bounds.min.y,bounds.max.z+.025);group.visible=false;
  // One filled outline per bracket keeps the corners seamless at every opacity.
  const stroke=.045,arm=Math.min(.28,size.x*.3),shape=new THREE.Shape();
  shape.moveTo(arm,size.y);shape.lineTo(0,size.y);shape.lineTo(0,0);shape.lineTo(arm,0);
  shape.lineTo(arm,stroke);shape.lineTo(stroke,stroke);shape.lineTo(stroke,size.y-stroke);shape.lineTo(arm,size.y-stroke);shape.closePath();
  const geometry=new THREE.ShapeGeometry(shape);
  for(const side of [-1,1]){
    const bracket=new THREE.Mesh(geometry,material);bracket.name=side<0?'Selection bracket left':'Selection bracket right';
    bracket.position.set(side*size.x/2,side<0?0:size.y,0);bracket.rotation.z=side<0?0:Math.PI;group.add(bracket);
  }
  group.children.forEach(part=>{part.castShadow=false;part.receiveShadow=false;part.renderOrder=8;});
  return{mesh,group,material};
}
export function createBathroom(parent,animated,m,x,y,type) {
  // Fit the sill and ceiling BETWEEN the jambs. Their old full-width front
  // faces intersected the jamb faces, producing black flicker at all corners.
  addBathroomRearWindow(parent,m,x,y,type);
  for(const side of [-1,1])box(parent,m.white,x+side*.83,y+1.29,-2.66,.10,2.59,2.18,.025).name=`${type} side wall`;
  box(parent,m.white,x,y+2.54,-2.66,1.56,.10,2.18,.025).name=`${type} ceiling`;
  box(parent,m.dark,x,y+.025,-2.66,1.56,.05,2.18,.01).name=`${type} sill`;
  if(type==='toilet'){
    cylinder(parent,m.white,x,y+.265,-3.37,.24,.43,.29);
    const seat=new THREE.Mesh(new THREE.TorusGeometry(.22,.045,12,36),m.dark);seat.rotation.x=Math.PI/2;seat.position.set(x,y+.49,-3.37);parent.add(seat);
  }else{
    const fixtures=createShowerFixtures(m);fixtures.position.set(x,y,0);parent.add(fixtures);
  }
  const door=new THREE.Group();door.position.set(x-.735,y,-1.72);animated.add(door);
  door.name=`Pocket ${type} shutter`;
  panel(door,m,.735,1.3,0,1.47,2.46,m.white);
  box(door,m.black,1.295,1.17,.14,.06,.30,.05,.012);
  label(door,type==='shower'?'SHOWER':'WC',.735,2.12,.20,.94,.18,{size:65});
  const lamp=ball(door,m.green,1.285,1.62,.16,.026,.026,.016);lamp.name=type+'Lamp';
  grille(door,m,.735,.36,.15,1.08,.27);
  configurePocketShutter(door,{left:x-.77,right:x+.77,travel:1.63});
  addPocketShutterFrame(parent,m,x,y,-1.53,{name:type});
  const ceilingLight=createBathroomCeilingLight(m,x,y,type);parent.add(ceilingLight.housing);animated.add(ceilingLight.root);
  return{door,lamp,ceilingLight};
}
function hatch(parent,animated,m,x,y) {
  box(parent,m.black,x,y+1.15,-3.42,1.80,2.30,.12);
  for(const side of [-1,1])box(parent,m.dark,x+side*.97,y+1.15,-2.45,.14,2.30,1.8);
  for(const h of [.15,2.17])box(parent,m.metal,x,y+h,-2.51,1.80,.10,1.68);
  const door=new THREE.Group();door.position.set(x-.85,y,-1.67);animated.add(door);
  door.name='Pocket supply shutter';
  const paint=m.enamel.clone();paint.name='Industrial / oxblood supply hatch';
  paint.color.setHex(0x793537);paint.roughness=.72;paint.metalness=.24;
  box(door,paint,.85,1.15,0,1.7,1.92,.10,.10).name='Oxblood supply hatch leaf';
  box(door,m.dark,.85,1.63,.065,.6,.40,.025,.05);
  box(door,m.dark,.85,.96,.057,.45,.12,.016,.012);
  box(door,m.metal,.85,.98,.07,.30,.028,.024,.007);
  configurePocketShutter(door,{left:x-.89,right:x+.89,travel:HATCH_TRAVEL});
  for(const side of [-1,1])box(parent,m.metal,x+side*.91,y+1.17,-1.53,.065,2.02,.15,.012);
  box(parent,m.dark,x,y+2.17,-1.56,1.96,.10,.17,.025);
  // The lower jamb fittings are enclosed by the full-depth receiving plinth.
  for(const side of [-1,1])box(parent,m.dark,x+side*.91,y+1.84,-1.50,.12,.15,.13);
  // Keep the fixed header ahead of the service cables; only the leaf is recessed.
  label(parent,'SUPPLY HATCH',x,y+2.47,-.32,1.74,.26,{fg:'#e2c174',size:52});
  // Reach the recessed shutter while keeping the cargo pickup edge in place.
  const ledgeBack=door.position.z+.07,baseFront=.685,topFront=.74;
  const plinth=box(parent,m.dark,x,y+.32,(ledgeBack+baseFront)/2,2.15,.55,baseFront-ledgeBack,.04);
  plinth.name='Supply hatch receiving plinth';
  paintSupplyLedge(plinth,{width:2.15,height:.55,depth:baseFront-ledgeBack,radius:.04});
  box(parent,m.metal,x,y+.64,(ledgeBack+topFront)/2,2.27,.065,topFront-ledgeBack,.02).name='Supply hatch receiving surface';
  const lamp=new THREE.MeshBasicMaterial({color:0x4b6658,toneMapped:false});
  box(animated,lamp,x,y+2.25,-1.50,.62,.065,.05,.014);
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

// Shared by the live cabin and the close-up dining study.
export function createDiningStation(m,action){
  const root=new THREE.Group(),propsRoot=new THREE.Group();
  root.name=action==='hydro'?'Drinking water station':'Kitchen station';
  const stationX=positionX(getStation(action).x),docks=createDiningProps(propsRoot,m);
  if(action==='hydro'){
    cupboard(root,m,stationX,0,-1.03,1.25,2.35);
    box(root,m.dark,stationX,1.42,-.64,.66,.61,.13,.025);label(root,'H2O / 21°C',stationX,1.62,-.56,.54,.13,{fg:'#a2d9c7',size:50});
    for(const x of [stationX-.15,stationX+.15]){cylinder(root,m.metal,x,1.26,-.47,.034,.10);ball(root,x<stationX?m.teal:m.red,x,1.26,-.40,.025,.025,.025);}
    box(root,m.metal,stationX,1.05,HYDRO_TRAY.z,.74,.04,HYDRO_TRAY.depth).name='Shallow cup tray';
    docks.mug.position.set(stationX-.17,1.134,HYDRO_TRAY.cupZ);docks.mug.rotation.y=Math.PI;docks.mug.visible=true;
  }else{
    for(let i=0;i<2;i++){
      const x=-10.8+i*1.50;box(root,m.dark,x,.49,-.48,1.47,.95,1.13,.03);panel(root,m,x,.47,.13,1.39,.83,m.white);box(root,m.black,x,.76,.215,.49,.035,.044,.01);box(root,m.metal,x,1.0,-.42,1.51,.07,1.25,.018);
      cupboard(root,m,x,1.65,-1.20,1.41,1.03);
    }
    box(root,m.dark,-10.8,1.052,-.36,1.02,.028,.72,.04);
    for(const x of [-11.11,-10.56])for(const z of [-.58,-.17]){const ring=new THREE.Mesh(new THREE.TorusGeometry(.17,.017,8,22),m.metal);ring.rotation.x=Math.PI/2;ring.position.set(x,1.075,z);root.add(ring);}
    cylinder(root,m.metal,-11.11,1.19,-.58,.146,.23,.17);
    box(root,m.dark,-9.3,1.075,-.29,.85,.03,.52,.08);
    pipe(root,m.metal,[[-9.3,1.01,-.73],[-9.3,1.41,-.73],[-9.3,1.45,-.44],[-9.3,1.30,-.38]],.028);
    cylinder(root,m.white,-11.50,1.13,-.02,.055,.18,.065);
    docks.bowl.position.set(stationX+.095,1.077,.10);docks.bowl.rotation.y=Math.PI;docks.bowl.visible=true;
    docks.spoon.position.set(stationX-.17,1.039,.10);docks.spoon.visible=true;docks.bite.visible=false;
  }
  return{root,propsRoot,docks,stationX};
}

export function buildShip(sourceMaterials,{mergeStatic=true,floorBuilder=createDeckFloor}={}) {
  const m=industrialMaterials(sourceMaterials);
  const staticRoot=new THREE.Group(),animated=new THREE.Group(),targets=[];
  // Leave clearance behind the fitted jambs: aperture reveal faces must not
  // double up with the room walls, even when the pocket doors are open.
  const wallOpenings=RECESSED_OPENINGS.map(r=>({...r,left:r.left-.015,right:r.right+.015,bottom:r.bottom-.015,top:r.top+.015}));
  // Recess the dark hull behind the lining so their aperture walls cannot coincide.
  gateWall(staticRoot,m.dark,{left:-13.4,right:13.4,bottom:-.405,top:10.285,z:-2.30,depth:.19,gates:REAR_ROOM_GATES,rectangles:wallOpenings});
  // Interior faces sit in front of the hull's back surface; the viewing wall is removed.
  gateWall(staticRoot,m.enamel,{left:-13.15,right:13.15,bottom:-.10,top:10.10,z:-2.09,depth:.22,gates:REAR_ROOM_GATES,rectangles:wallOpenings});
  // Carry the roof over the full forward aisle, matching the deck below.
  const roofFront=CABIN_AISLE.deckFront,roofBridgeBack=.94;
  for(const side of [-1,1]){
    box(staticRoot,m.dark,side*7,10.31,(roofFront-1.92)/2,12.9,.26,roofFront+1.92,.05);
    box(staticRoot,m.enamel,side*6.925,10.48,(roofFront-1.87)/2,12.75,.19,roofFront+1.87,.035);
  }
  // Only the ladder shaft stays open; its forward landing has a continuous roof.
  const roofBridgeZ=(roofFront+roofBridgeBack)/2,roofBridgeDepth=roofFront-roofBridgeBack;
  box(staticRoot,m.dark,0,10.31,roofBridgeZ,1.10,.26,roofBridgeDepth);
  box(staticRoot,m.enamel,0,10.5075,roofBridgeZ,1.10,.135,roofBridgeDepth);
  for(const side of [-1,1]){
    // The operations deck ends at a recessed airlock instead of a solid side wall.
    const airlockBottom=FLOOR_Y[DECK.OPERATIONS],airlockTop=airlockBottom+3.242;
    const spans=side===1?[[-.365,airlockBottom],[airlockTop,10.245]]:[[-.365,10.245]];
    for(const [bottom,top]of spans){
      box(staticRoot,m.enamel,side*13.07,(bottom+top)/2,-.13,.40,top-bottom,3.45,.05);
      box(staticRoot,m.metal,side*13.33,(bottom+top)/2,-.52,.14,top-bottom-.1,2.41,.025);
    }
    for(let i=0;i<27;i++)if(side<0||.11+i*.37<airlockBottom||.11+i*.37>airlockTop)box(staticRoot,m.dark,side*13.40,.11+i*.37,-.25,.18,.1,1.73,.012);
    pipe(staticRoot,m.dark,[[side*13.63,.20,-.65],[side*13.65,1,-.65],[side*13.65,8.8,-.65],[side*13.15,10.1,-.65]],.115);
  }
  FLOOR_Y.forEach((y,level)=>{
    staticRoot.add(floorBuilder(m,y,level));
    const signX=REAR_ROOM_GATES[level].x,signY=y+2.79,signZ=1.40;
    box(staticRoot,m.dark,signX,signY,signZ,1.36,.21,.045,.012);
    label(staticRoot,`${String(level+1).padStart(2,'0')} / ${FLOORS[level].name}`,signX,signY,signZ+.03,1.30,.16,{fg:'#d4dbcc',size:48});
    for(let xx=-11.8;xx<12.5;xx+=1.52){
      const opening=RECESSED_OPENINGS.some(r=>r.floor===level&&xx+.74>r.left&&xx-.74<r.right);
      if(!opening&&!(xx> -3.0&&xx<-.8))panel(staticRoot,m,xx,y+1.44,-1.70,1.48,2.70,level===DECK.OPERATIONS?m.dark:m.enamel);
      if(Math.abs(xx)<1.265)continue;
      box(staticRoot,m.dark,xx,y+2.96,-.25,1.43,.17,3.14,.025);
    }
    for(const zz of [-1.25,-.94])pipe(staticRoot,zz===-1.25?m.red:m.metal,[[-12.8,y+2.6,zz],[-6,y+2.6,zz],[0,y+2.6,zz],[6,y+2.6,zz],[12.8,y+2.6,zz]],zz===-1.25?.055:.075);
    for(let xx=-12;xx<=12;xx+=2.4){box(staticRoot,m.dark,xx,y+2.60,-1.08,.052,.29,.55);}
    for(const xx of [-12.83,-3.1,7.1,12.83]){
      if(level===DECK.OPERATIONS&&xx===7.1)continue;
      box(staticRoot,m.dark,xx,y+1.5,-1.32,.10,2.98,.48);
      box(staticRoot,m.enamel,xx,y+1.50,-1.035,.16,2.98,.10,.02);
      box(staticRoot,m.red,xx,y+1.15,-.958,.06,.45,.04,.01);
    }
    addIndustrialDeck(staticRoot,m,y,level,{floorDetails:floorBuilder===createDeckFloor});
    addWorkLights(animated,y,level);
  });
  for(const g of REAR_ROOM_GATES){
    gateWall(staticRoot,m.enamel,{left:-3.435,right:-.405,bottom:g.floor+.07,top:g.floor+2.81,z:-1.68,depth:.12,openingClearance:.02,gates:[g]});
    const gate=createBulkheadGate(m,g,sourceMaterials);staticRoot.add(gate.root);animated.add(gate.lights);
  }
  const groomingStation=createVanity(m,createMachinedMetals()),groomingGate=REAR_ROOM_GATES[DECK.HABITATION];
  groomingStation.origin=new THREE.Vector3(groomingGate.x,groomingGate.floor,0);
  groomingStation.root.position.add(groomingStation.origin);staticRoot.add(groomingStation.root);
  // Keep the fixture batched with the cabin; only the mirror and tool mounts need transforms.
  staticRoot.updateMatrixWorld(true);
  for(const mount of [groomingStation.mirror,...Object.values(groomingStation.docks)])animated.attach(mount);
  const catPorts=FLOOR_Y.map((y,level)=>catPort(staticRoot,m,positionX(CAT_PORT.x),y,level,animated));
  // The upper shaft is a visible continuation, not an additional playable deck.
  const ladder=createAccessLadder(m);staticRoot.add(ladder);
  animated.attach(ladder.getObjectByName('Ladder work lights'));

  const habitation=FLOOR_Y[DECK.HABITATION],operations=FLOOR_Y[DECK.OPERATIONS];
  const bathrooms={shower:createBathroom(staticRoot,animated,m,positionX(240),habitation,'shower'),toilet:createBathroom(staticRoot,animated,m,positionX(380),habitation,'toilet')};
  const bunk=createBunk(m);bunk.root.position.set(positionX(510),habitation,0);animated.add(bunk.root);
  cupboard(staticRoot,m,2.1,habitation,-1.14,1.54,2.31);
  const lounge=createLounge(m);lounge.position.y=habitation;staticRoot.add(lounge);
  const loungeBounds=new THREE.Box3().setFromObject(lounge).expandByScalar(.06);
  const loungeProps=lounge.userData.loungeProps;
  staticRoot.updateMatrixWorld(true);for(const prop of Object.values(loungeProps))animated.attach(prop);
  cupboard(staticRoot,m,11.55,habitation,-1.11,1.35,2.35);
  panel(staticRoot,m,4.06,habitation+1.5,-1.38,1.37,1.26,m.white);
  const wallLogo=new THREE.Mesh(new THREE.PlaneGeometry(1.13,1.13*754/1427),m.taraironLogo);
  wallLogo.name='TARAIRON panel logo';wallLogo.position.set(4.06,habitation+1.5,-1.255);staticRoot.add(wallLogo);

  const consoleMaterials=createConsoleMaterials(),consoleScreens=new ConsoleScreens();
  for(let i=0;i<3;i++)consoleUnit(staticRoot,m,consoleMaterials,consoleScreens,-10.2+i*1.63,operations,1.56,i);
  chair(staticRoot,m,-8.8,operations,.82,Math.PI);
  const aiRack=createAIServiceRack(m);aiRack.root.position.set(-4.57,operations,-1.41);staticRoot.add(aiRack.root);
  animated.add(createScreenGlow());
  const medical=createMedicalBay(m,operations);staticRoot.add(medical.root);
  animated.attach(medical.bed);animated.attach(medical.rig.root);
  const evaBay=createEVABay(m,operations);staticRoot.add(evaBay.root);
  const innerDoor=evaBay.innerHatch.userData.door,innerSignal=evaBay.innerHatch.userData.signal;
  const outerSignal=evaBay.hatch.userData.signal;
  animated.attach(innerDoor);

  const diningStations=Object.fromEntries(['galley','hydro'].map(action=>[action,createDiningStation(m,action)]));
  for(const station of Object.values(diningStations)){staticRoot.add(station.root);animated.add(station.propsRoot);}
  const diningDocks=Object.fromEntries(Object.entries(diningStations).map(([action,station])=>[action,station.docks]));
  const incinerator=createWasteIncinerator(m);animated.add(incinerator.root);
  const plants=createPlantRack(m,positionX(PLANT.x));animated.add(plants.root);
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
  staticRoot.add(createCargoStowage(m));
  const bowlX=positionX(CAT_BOWL.x),bowlY=FLOOR_Y[CAT_BOWL.floor],bowlZ=CAT_BOWL.depth;
  cylinder(staticRoot,m.metal,bowlX,bowlY+.07,bowlZ,.16,.10,.20,28);
  cylinder(staticRoot,m.dark,bowlX,bowlY+.121,bowlZ,.16,.012,.16,28);
  const foodGroup=new THREE.Group();foodGroup.position.set(bowlX,bowlY,bowlZ);animated.add(foodGroup);
  const catFood=new THREE.MeshStandardMaterial({name:'Cat food / brown kibble',color:CAT_BOWL.foodColor,roughness:.9});
  for(let i=0;i<18;i++){const a=i*2.4,r=.025+Math.sqrt(i/18)*.13;ball(foodGroup,catFood,Math.cos(a)*r,CAT_BOWL.foodHeight,Math.sin(a)*r,.025,.018,.022);}
  const ventilation=createCargoVentilation(m),fan=ventilation.rotor;
  staticRoot.add(ventilation.root);animated.add(fan);
  const cargo=[],catFoodPackage=m.catFoodPackage??createCatFoodMaterial();
  ['food','water','catfood'].forEach((key,i)=>{
    const group=new THREE.Group();group.name='Delivery '+key;group.position.set(positionX(1110)+(i-1)*.70,.675,.32);group.visible=false;animated.add(group);
    if(key==='water'){
      box(group,m.teal,0,.31,0,.53,.61,.40,.04);
      for(const side of [-1,1])box(group,m.metal,side*.22,.31,.211,.025,.5,.02);
      box(group,m.black,0,.63,0,.24,.085,.12,.022);label(group,'H2O',0,.30,.211,.38,.18,{size:60});
    }else for(let j=0;j<2;j++){
      const y=.137+j*.283;
      if(key==='catfood'){
        const carton=createCatFoodCarton(catFoodPackage);carton.position.y=y;group.add(carton);
      }else{
        box(group,m.olive,0,y,0,.61,.272,.43,.025);
        for(const side of [-1,1])box(group,m.dark,side*.20,y,.223,.04,.274,.012);
        label(group,'RATIONS',0,y,.227,.33,.11,{size:42});
      }
    }
    cargo.push(group);
  });
  const pickMaterial=new THREE.MeshBasicMaterial({visible:false}),indicators={};
  STATIONS.forEach(({id,x,floor:level})=>{
    const w=id==='galley'?3.06:id==='plant'?2.90:id==='medical'?5.10:id==='eva'?3.65:['airlock','innerHatch'].includes(id)?.62:1.9;
    const fixtureX=id==='galley'?-10.05:id==='airlock'?evaBay.hatch.position.x:id==='innerHatch'?evaBay.innerHatch.position.x:id==='medical'?MED_BED.x-.52:positionX(x);
    const bounds=id==='smoking'?new THREE.Box3().setFromCenterAndSize(new THREE.Vector3(ASHTRAY.x,FLOOR_Y[level]+1.0,ASHTRAY.z),new THREE.Vector3(.52,.43,.45)):id==='grooming'?groomingGateBounds():id==='plant'?new THREE.Box3().setFromObject(plants.root).expandByScalar(.04):id==='lounge'?loungeBounds:new THREE.Box3().setFromCenterAndSize(new THREE.Vector3(fixtureX,FLOOR_Y[level]+1.25,0),new THREE.Vector3(w,2.5,3));
    const {mesh,group,material}=createStationInteraction(id,bounds,pickMaterial);
    if(!['lounge','grooming','smoking'].includes(id))group.position.z=1.75;
    targets.push(mesh);animated.add(mesh,group);indicators[id]={group,material};
  });
  const dressing=addCabinDressing(staticRoot,m,FLOOR_Y);
  const gateFinish=finishGateFrames(staticRoot,REAR_ROOM_GATES);
  staticRoot.updateMatrixWorld(true);
  const washerDoor=staticRoot.getObjectByName('Washer service door'),washerClothes=staticRoot.getObjectByName('Washer rotating clothes');
  for(const part of [washerDoor,washerClothes])if(part)animated.attach(part);
  animated.add(createRearWindowStars(staticRoot));
  const staticMesh=mergeStatic?batchStatic(staticRoot,{xrLOD:true}):staticRoot;
  const pipes=staticRoot.getObjectByName('Rear wall pipe bundle / 運動区画と機関部の間').clone();pipes.position.set(0,0,0);
  staticMesh.userData.viewingWallFixtures={...dressing.userData.viewingWallFixtures,pipes};
  return {staticMesh,animated,targets,indicators,cargo,catFoodPackage,hatchDoor:supplyHatch.door,hatchLamp:supplyHatch.lamp,foodGroup,fan,gym,medical,innerDoor,innerSignal,outerSignal,bathrooms,catPorts,diningDocks,loungeProps,plants,bunk,washerDoor,washerClothes,incinerator,groomingStation,consoleScreens,aiSupervision:aiRack.screens,gateFinish};
}
