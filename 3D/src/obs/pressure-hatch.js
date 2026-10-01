import * as THREE from 'three';
import {box,cylinder} from './materials.js';
import {pressureHatchFinish,finishPressureHatch} from './pressure-hatch-finish.js';

// Metres. The two leaves remain inside this cassette at every opening amount.
export const PRESSURE_HATCH=Object.freeze({width:1.08,height:2.16,bottom:.06,centerY:1.14,cut:.10,cassetteWidth:2.60,cassetteHeight:2.26,cassetteDepth:.33,leafDepth:.128,edgeDepth:.238,edgeOverlap:.011,travel:.70});
const leafFace=PRESSURE_HATCH.leafDepth/2,lockFace=leafFace+.003;
export const PRESSURE_LOCK_SERVICE=Object.freeze({x:.35,y:.12,z:lockFace+.035,tip:.014});
const {width:w,height:h,cut:c}=PRESSURE_HATCH;
const perimeter=(width,height,cut)=>[[-width/2+cut,-height/2],[width/2-cut,-height/2],[width/2,-height/2+cut],[width/2,height/2-cut],[width/2-cut,height/2],[-width/2+cut,height/2],[-width/2,height/2-cut],[-width/2,-height/2+cut]];
function path(points,Type=THREE.Shape){const shape=new Type();points.forEach(([x,y],i)=>i?shape.lineTo(x,y):shape.moveTo(x,y));shape.closePath();return shape;}
function solid(parent,material,shape,z,depth,name){
  const mesh=new THREE.Mesh(new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:false,steps:1,curveSegments:1}),material);
  mesh.name=name;mesh.position.z=z;mesh.castShadow=mesh.receiveShadow=true;parent.add(mesh);return mesh;
}
function ring(parent,material,outer,inner,z,depth,name){
  const shape=path(outer);shape.holes.push(path([...inner].reverse(),THREE.Path));return solid(parent,material,shape,z,depth,name);
}
const seam=[[0,h/2],[0,.61],[.15,.42],[.15,-.40],[0,-.59],[0,-h/2]];
const topSlope=(seam[2][1]-seam[1][1])/(seam[2][0]-seam[1][0]);
const bottomSlope=(seam[3][1]-seam[4][1])/(seam[3][0]-seam[4][0]);
function paneOutline(padding=0){
  const left=-.075-padding,right=.085+padding;
  const top=x=>.23+topSlope*(x-.085)+padding*Math.hypot(1,topSlope);
  const bottom=x=>-.25+bottomSlope*(x-.085)-padding*Math.hypot(1,bottomSlope);
  return [[left,top(left)],[right,top(right)],[right,bottom(right)],[left,bottom(left)]];
}
// Glass, cutout and frame follow the actual door-seam angles. The frame is a
// 19 mm perpendicular offset, so its sloped edges stay parallel too.
const panePoints=paneOutline(),paneBorder=paneOutline(.019);

function leafEdge(parent,finish,side){
  // The thick folded perimeter overlaps behind the jamb. Its faces leave only
  // 1 mm sliding clearance to the covers, without a fixed return blocking locks.
  const overlap=PRESSURE_HATCH.edgeOverlap,ow=w/2+overlap,oh=h/2+overlap,oc=c+.006;
  const iw=w/2-.016,ih=h/2-.016,ic=c-.010;
  const points=[[-.004,-oh],[-ow+oc,-oh],[-ow,-oh+oc],[-ow,oh-oc],[-ow+oc,oh],[-.004,oh],
    [-.004,ih],[-iw+ic,ih],[-iw,ih-ic],[-iw,-ih+ic],[-iw+ic,-ih],[-.004,-ih]];
  solid(parent,finish.paint,path(points.map(([x,y])=>[side<0?x:-x,y])),-PRESSURE_HATCH.edgeDepth/2,PRESSURE_HATCH.edgeDepth,'Overlapping leaf perimeter');
}

function lockModule(parent,finish,signal,side,inner){
  const module=new THREE.Group();module.name=side>0?'Pressure lock / cabin face':'Pressure lock / reverse face';
  module.position.set(PRESSURE_LOCK_SERVICE.x,PRESSURE_LOCK_SERVICE.y,side*lockFace);if(side<0)module.rotation.y=Math.PI;parent.add(module);
  box(module,finish.graphite,0,0,.006,.225,.235,.022,.012).name='Recessed lock cartridge';
  box(module,finish.metal,0,-.028,.019,.17,.084,.012,.006).name='Flush lock lever recess';
  box(module,finish.graphite,0,-.028,.027,.106,.026,.017,.006).name='Flush lock lever';
  box(module,signal,-.044,.072,.019,.064,.009,.007,.003).name='Pressure lock status strip';
  box(module,finish.metal,.05,.072,.021,.025,.012,.008,.002);
  const screw=cylinder(module,finish.metal,0,0,PRESSURE_LOCK_SERVICE.z-lockFace,.014,.028,.014,8);
  screw.rotation.x=Math.PI/2;screw.name=inner&&side>0?'Inner lock service screw':'Pressure lock service screw';
  box(module,finish.graphite,0,0,PRESSURE_LOCK_SERVICE.z-lockFace+.0145,.014,.002,.001).name='Service screw slot';
  for(const x of [-.084,.084])for(const y of [-.087,.094]){
    const screw=cylinder(module,finish.metal,x,y,.020,.004,.003,.004,6);screw.rotation.x=Math.PI/2;
  }
  return module;
}

export function createPressureHatch({inner=false,materials=null}={}){
  const root=new THREE.Group();root.name='Biparting pocket hatch';
  const finish=pressureHatchFinish(materials);
  const signal=new THREE.MeshBasicMaterial({name:'Pressure hatch / powered status',color:0x85e3af,toneMapped:false});signal.userData.cabinAlwaysPowered=true;
  const aperture=perimeter(w,h,c),outer=perimeter(PRESSURE_HATCH.cassetteWidth,PRESSURE_HATCH.cassetteHeight,.06);
  for(const side of [-1,1]){
    ring(root,finish.paint,outer,aperture,side>0?.120:-.165,.045,`Pocket cassette cover / ${side>0?'front':'back'}`);
    ring(root,finish.metal,perimeter(w+.075,h+.075,c+.024),aperture,side>0?.166:-.178,.012,'Chamfered metal jamb');
    // Pocket covers, not clipping or disappearing meshes, conceal the leaves.
  }
  // End caps meet the covers at their inside faces, not their visible surfaces.
  for(const side of [-1,1])box(root,finish.graphite,side*(PRESSURE_HATCH.cassetteWidth/2-.012),0,0,.024,PRESSURE_HATCH.cassetteHeight,.24).name='Closed pocket end cap';
  for(const y of [-h/2-.032,h/2+.032])box(root,finish.metal,0,y,0,PRESSURE_HATCH.cassetteWidth-.06,.024,.24).name='Internal slide rail';
  const door=new THREE.Group();door.name='Pressure door assembly';root.add(door);
  const left=new THREE.Group(),right=new THREE.Group();left.name='Left pocket leaf';right.name='Right pocket leaf';door.add(left,right);
  const leftShape=path([[-w/2+c,-h/2],...seam.slice().reverse(),[-w/2+c,h/2],[-w/2,h/2-c],[-w/2,-h/2+c]]);
  leftShape.holes.push(path([...panePoints].reverse(),THREE.Path));
  const rightShape=path([[0,-h/2],[w/2-c,-h/2],[w/2,-h/2+c],[w/2,h/2-c],[w/2-c,h/2],...seam]);
  // A narrow physical shadow gap separates the interlocking seam.
  const leftPlate=solid(left,finish.paint,leftShape,-leafFace,PRESSURE_HATCH.leafDepth,'Sealed pressure door');leftPlate.position.x=-.002;
  const sealEdge=seam.map(([x,y])=>[x,THREE.MathUtils.clamp(y,-h/2+.003,h/2-.003)]);
  const seal=path([...sealEdge.map(([x,y])=>[x-.004,y]),...sealEdge.slice().reverse().map(([x,y])=>[x+.004,y])]);
  solid(left,finish.graphite,seal,-leafFace+.002,PRESSURE_HATCH.leafDepth-.004,'Interlocking center gasket');
  const rightPlate=solid(right,finish.panel,rightShape,-leafFace,PRESSURE_HATCH.leafDepth,'Sealed pressure door / right');rightPlate.position.x=.002;
  leafEdge(left,finish,-1);leafEdge(right,finish,1);
  for(const side of [-1,1])box(left,finish.graphite,0,side*(h/2+.004),0,.008,.014,PRESSURE_HATCH.edgeDepth-.002).name='Perimeter meeting seal';
  for(const side of [-1,1])ring(left,finish.graphite,paneBorder,panePoints,side>0?leafFace+.001:-leafFace-.011,.010,'Angular safety window frame');
  const pane=solid(left,finish.glass,path(panePoints),-.006,.012,'Angular safety window');pane.castShadow=false;
  for(const side of [-1,1])lockModule(right,finish,signal,side,inner);
  finishPressureHatch(root,left,right,finish,leafFace);
  door.userData.leaves=[left,right];root.userData={door,signal,inner};return root;
}

export function animatePressureHatch(door,opening){
  const t=THREE.MathUtils.clamp(Number.isFinite(opening)?opening:0,0,1),slide=t*t*(3-2*t)*PRESSURE_HATCH.travel;
  const [left,right]=door.userData.leaves;
  left.position.x=slide===0?0:-slide;right.position.x=slide;
  // Do not move the parent: OBS reparents it for animation, studies do not.
  door.visible=true;
}

export function pressureCassetteOutline(){return perimeter(PRESSURE_HATCH.cassetteWidth+.006,PRESSURE_HATCH.cassetteHeight+.006,.06);}
