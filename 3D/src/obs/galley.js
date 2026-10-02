import * as THREE from 'three';
import {box,cylinder,rod,pipe} from './materials.js';
import {createMachinedMetals} from './machined-metals.js';

// Approved galley, shared by the production kitchen and its close-up study.
// Metres, in the existing kitchen's coordinate system. Cooking contact points
// and counter height stay fixed so this can replace the old fixture as a unit.
export const GALLEY={x:-10.05,width:3.06,height:2.82,back:-1.12,front:.205,top:1.035,
  sink:{x:.75,z:-.36,width:.82,depth:.56,bottom:.785},pot:{x:-.51,y:1.075,z:-.17}};

const PRINT_SIZE=[1024,512];
const tiles={id:[0,0,512,96],dry:[0,96,256,80],chill:[256,96,256,80],
  heat:[512,0,512,128],water:[512,128,512,128],service:[0,176,512,128],
  cart:[0,304,512,112],caution:[512,256,512,96],drainer:[512,352,512,160]};

export function createGalleyPrint(){
  if(typeof document==='undefined')return null;
  const canvas=document.createElement('canvas');[canvas.width,canvas.height]=PRINT_SIZE;
  const c=canvas.getContext('2d');
  const text=(s,x,y,size=16,color='#343b39',weight=500)=>{
    c.fillStyle=color;c.font=`${weight} ${size}px Arial`;c.textAlign='left';c.fillText(s,x,y);
  };
  const rule=(x,y,w)=>{c.fillStyle='#737b75';c.fillRect(x,y,w,1);};
  text('G / 03',10,43,34,'#343b39',700);text('TARAIRON  /  GALLEY',135,33,22);
  text('HABITAT SERVICE MODULE',135,59,13);rule(10,75,478);
  text('01  DRY STOWAGE',12,125,20);text('LATCH BEFORE TRANSIT',12,151,12);
  text('02  COLD STOWAGE',268,125,19);text('SECURE CONTENTS',268,151,12);
  c.fillStyle='#172220';c.fillRect(512,0,512,128);
  text('THERMAL PROCESSOR',534,27,15,'#aabbb0');text('165°',534,76,40,'#b7cbb7');
  text('STANDBY',751,49,16,'#bb9c61');text('CABIN / 28 VDC',751,78,13,'#9dada2');
  text('POTABLE WATER',535,160,23);rule(535,176,450);
  text('PUSH TO DISPENSE  /  AUTO SHUTOFF',535,203,14);
  text('DRAIN TO GREY WATER RECOVERY',535,232,14);
  text('03 / WATER SERVICE',16,205,22);rule(16,221,465);
  text('ISOLATE SUPPLY BEFORE ACCESS',16,245,14);
  text('STRAINER  /  TRAP  /  RETURN',16,267,14);text('SERVICE  ______   TECH  ______',16,289,12);
  text('MEAL SERVICE / RETAINED UNIT',16,331,21);rule(16,345,465);
  text('CLOSE DOOR  /  ENGAGE BOTH RESTRAINTS',16,369,14);
  text('G03-ST  /  MAX 18 KG',16,397,13);text('REV. 02',400,397,12);
  text('CAUTION / HOT SURFACE',536,290,22,'#936c33',700);
  text('RETAIN COOKWARE BEFORE TRANSIT',536,318,13);
  // Perforations are a static print, not hundreds of extra cylinders or holes.
  c.fillStyle='#343a39';
  for(let row=0;row<9;row++)for(let col=0;col<27;col++){
    c.beginPath();c.arc(523+col*18+(row%2)*5,362+row*16,3.2,0,Math.PI*2);c.fill();
  }
  const map=new THREE.CanvasTexture(canvas);map.name='Galley / shared static service atlas';
  map.colorSpace=THREE.SRGBColorSpace;map.anisotropy=4;return map;
}

function print(parent,material,key,x,y,z,w,h){
  const g=new THREE.PlaneGeometry(w,h),uv=g.attributes.uv,[tx,ty,tw,th]=tiles[key];
  for(let i=0;i<uv.count;i++)uv.setXY(i,(tx+2+uv.getX(i)*(tw-4))/PRINT_SIZE[0],1-(ty+th-2-uv.getY(i)*(th-4))/PRINT_SIZE[1]);
  const mesh=new THREE.Mesh(g,material);mesh.name=`Galley / ${key} print`;mesh.position.set(x,y,z);parent.add(mesh);return mesh;
}

function contour(w,h,r=.016){
  const x=w/2,y=h/2;
  return [[-x+r,-y],[x-r,-y],[x,-y+r],[x,y-r],[x-r,y],[-x+r,y],[-x,y-r],[-x,-y+r]];
}
function path(points,Type=THREE.Shape){
  const shape=new Type();points.forEach(([x,y],i)=>i?shape.lineTo(x,y):shape.moveTo(x,y));shape.closePath();return shape;
}
function panel(parent,material,name,x,y,z,w,h,d=.035){
  const geometry=new THREE.ExtrudeGeometry(path(contour(w,h)),{depth:d,bevelEnabled:false,curveSegments:1,steps:1});
  geometry.translate(0,0,-d/2);
  const mesh=new THREE.Mesh(geometry,material);mesh.name=`Galley / ${name}`;mesh.position.set(x,y,z);
  mesh.castShadow=mesh.receiveShadow=true;parent.add(mesh);return mesh;
}
function fastener(parent,mat,x,y,z){
  const screw=cylinder(parent,mat,x,y,z,.008,.005,.008,6);screw.rotation.x=Math.PI/2;screw.name='Galley / captive fastener';
}

// The metal rim surrounds an actual hole; there is no slab under the opening.
function horizontalRing(parent,material,name,w,d,innerW,innerD,x,y,z){
  const s=path(contour(w,d,.035));s.holes.push(path(contour(innerW,innerD,.027).reverse(),THREE.Path));
  const geometry=new THREE.ExtrudeGeometry(s,{depth:.014,bevelEnabled:false,curveSegments:1,steps:1});
  geometry.rotateX(-Math.PI/2);
  const mesh=new THREE.Mesh(geometry,material);mesh.name=name;mesh.position.set(x,y-.014,z);mesh.castShadow=mesh.receiveShadow=true;parent.add(mesh);return mesh;
}

function sink(parent,metal,dark){
  const s=GALLEY.sink,top=GALLEY.top+.009,points=contour(s.width,s.depth,.035);
  // Four tapered walls (eight with clipped corners), formed from two rings.
  const vertices=[],uv=[],indices=[];
  for(const [level,y]of [[0,top],[1,s.bottom]])for(const [x,z]of points){
    vertices.push(s.x+x*(level?.82:1),y,s.z-z*(level?.76:1));uv.push(x/s.width+.5,z/s.depth+.5);
  }
  for(let i=0;i<8;i++){const j=(i+1)%8;indices.push(i,j,i+8,j,j+8,i+8);}
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
  geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geometry.setIndex(indices);geometry.computeVertexNormals();
  const bowl=new THREE.Mesh(geometry,metal);bowl.name='Galley / open tapered sink walls';bowl.castShadow=bowl.receiveShadow=true;parent.add(bowl);
  const floor=panel(parent,metal,'sink floor',s.x,s.bottom-.006,s.z,s.width*.82,s.depth*.76,.012);floor.rotation.x=-Math.PI/2;
  horizontalRing(parent,metal,'Galley / rolled sink rim',s.width+.055,s.depth+.055,s.width,s.depth,s.x,top+.004,s.z);
  cylinder(parent,dark,s.x+.17,s.bottom+.002,s.z-.055,.044,.005,.044,20).name='Galley / drain well';
  const strainer=cylinder(parent,metal,s.x+.17,s.bottom+.006,s.z-.055,.031,.003,.031,16);strainer.name='Galley / drain strainer';
  for(let i=-2;i<=2;i++)box(parent,dark,s.x+.17+i*.009,s.bottom+.008,s.z-.055,.004,.001,.033-Math.abs(i)*.006);
}

export function createGalley(m={}, {cookware=true}={}){
  const root=new THREE.Group();root.name='Aircraft cabin galley';root.position.x=GALLEY.x;
  const metals=createMachinedMetals(),metal=metals.alloy;
  metal.name='Galley / satin aluminium';metal.color.setHex(0xb4baba);metal.roughness=.48;
  const paint=(m.enamel??new THREE.MeshStandardMaterial()).clone();paint.name='Galley / ivory laminate';
  paint.color.setHex(0xd7d8ce);paint.metalness=.12;paint.roughness=.64;paint.bumpScale=.00045;
  // Washable liners are less weathered than the hull, but share its palette.
  paint.map=null;paint.roughnessMap=null;paint.bumpMap=m.enamel?.bumpMap??null;
  const dark=new THREE.MeshStandardMaterial({name:'Galley / graphite seals',color:0x252d2d,roughness:.77,metalness:.18});
  const red=new THREE.MeshStandardMaterial({name:'Galley / oxblood safety latches',color:0xa34432,roughness:.58,metalness:.25});
  const map=createGalleyPrint(),ink=new THREE.MeshStandardMaterial({name:'Galley / direct service print',map,alphaTest:.2,roughness:1,metalness:0,
    polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1,userData:{cabinKeepSurface:true,cabinNoOutline:true,castShadow:false}});
  const screen=ink.clone();screen.name='Galley / processor display';screen.alphaTest=0;
  const indicator=new THREE.MeshStandardMaterial({name:'Galley / status lens',color:0x7caa95,emissive:0x5c8877,emissiveIntensity:.25,roughness:.5});
  function door(name,x,y,w,h,z=-.48){
    panel(root,dark,`${name} seal`,x,y,z-.02,w+.022,h+.022,.016);
    panel(root,metal,`${name} frame`,x,y,z,w,h,.035);
    panel(root,paint,`${name} face`,x,y,z+.022,w-.028,h-.028,.018);
    // A real U handle in a recessed finger well, not a domestic cupboard pull.
    panel(root,dark,'handle pocket',x,y-.035,z+.034,.208,.092,.008);
    for(const side of [-1,1])box(root,metal,x+side*.079,y-.025,z+.054,.016,.052,.025);
    box(root,metal,x,y-.048,z+.066,.15,.018,.022).name='Galley / flush U handle';
    panel(root,metals.shell,'quarter-turn latch recess',x+w/2-.09,y+h/2-.083,z+.035,.10,.065,.008);
    box(root,metal,x+w/2-.09,y+h/2-.083,z+.047,.057,.023,.015);
    for(const sy of [-1,1])box(root,metal,x-w/2+.009,y+sy*h*.28,z+.038,.019,.065,.027).name='Galley / hinge';
    return z+.033;
  }
  function restraint(x,y,z){
    const pivot=cylinder(root,metals.shell,x,y,z,.028,.021,.028,12);pivot.rotation.x=Math.PI/2;
    panel(root,red,'red rotary restraint',x,y-.045,z+.016,.038,.112,.020);
    fastener(root,metal,x,y,z+.029);
  }
  function vent(x,y,z,w){
    box(root,dark,x,y,z,w,.057,.012);
    for(let i=0;i<3;i++)box(root,metal,x,y-.018+i*.018,z+.008,w-.015,.005,.006);
  }
  // Aluminum extrusions tie the modular inserts into one restrained assembly.
  box(root,dark,0,.067,-.44,3.02,.115,1.19).name='Galley / recessed plinth';
  box(root,paint,0,1.49,-1.09,3.03,2.65,.055).name='Galley / rear liner';
  for(const x of [-1.506,1.506]){
    // Recess the vertical edge behind the meal grip and leave toe clearance
    // under the cheek for the established rear service / mouse passage.
    box(root,paint,x,.5835,-.46,.043,.897,1.20).name='Galley / lower side cheek';
    box(root,paint,x,1.926,-.49,.043,1.788,1.14).name='Galley / side cheek';
    box(root,metal,x,.556,.15,.037,.942,.052).name='Galley / lower corner extrusion';
    box(root,metal,x,1.921,.068,.037,1.788,.052).name='Galley / corner extrusion';
  }
  box(root,metal,0,2.80,-.47,3.06,.043,1.27);
  box(root,metal,0,2.25,-.65,3.01,.039,.89).name='Galley / insert carrier rail';
  box(root,metal,0,.97,.163,3.01,.055,.062).name='Galley / cart restraint rail';
  for(const x of [-.757,-.008,.716])box(root,metal,x,.52,.149,.026,.83,.072);

  // Retained half-width service containers; wheels sit behind the kick line.
  for(const [i,x]of [-1.125,-.378].entries()){
    box(root,metals.shell,x,.535,-.42,.697,.76,1.04);
    door(`retained cart ${i+1}`,x,.55,.686,.724,.135);
    print(root,ink,'cart',x,.758,.17,.565,.124);
    for(const dx of [-.234,.234]){
      const wheel=cylinder(root,dark,x+dx,.113,-.035,.055,.027,.055,12);wheel.rotation.z=Math.PI/2;
      box(root,metal,x+dx,.159,-.035,.071,.045,.065);
      restraint(x+dx,.946,.205);
    }
    box(root,red,x,.177,.21,.102,.024,.031).name='Galley / cart brake';
  }
  for(const [i,y]of [.368,.737].entries()){
    door(`service drawer ${i+1}`,.355,y,.663,.33,.135);
    restraint(.595,y+.141,.188);
  }
  door('water service access',1.099,.55,.692,.724,.135);
  print(root,ink,'service',1.099,.747,.17,.547,.137);
  vent(1.099,.29,.17,.45);

  // Monolithic worktop with a real hole cut through it, not a dark decal.
  const s=GALLEY.sink,topShape=path([[-1.53,-.205],[1.53,-.205],[1.53,1.09],[-1.53,1.09]]);
  topShape.holes.push(path(contour(s.width+.01,s.depth+.01,.035).map(([x,z])=>[s.x+x,-s.z+z]).reverse(),THREE.Path));
  const topGeometry=new THREE.ExtrudeGeometry(topShape,{depth:.038,bevelEnabled:false,steps:1,curveSegments:1});topGeometry.rotateX(-Math.PI/2);
  const worktop=new THREE.Mesh(topGeometry,metal);worktop.name='Galley / cutout stainless worktop';worktop.position.y=GALLEY.top-.038;
  worktop.castShadow=worktop.receiveShadow=true;root.add(worktop);
  sink(root,metal,dark);
  box(root,metal,0,1.071,-1.045,2.98,.076,.045).name='Galley / rear spill lip';
  // Keep the front edge low where Milo lifts the bowl and the droid chops.
  for(const x of [-1.47,1.47])box(root,metal,x,1.065,-.48,.02,.06,1.12);
  box(root,metal,0,1.026,.194,2.98,.017,.023).name='Galley / low front spill edge';

  const hob=box(root,dark,-.75,1.052,-.36,1.02,.028,.72);hob.name='Galley / retained induction hob';
  for(const x of [-1.06,-.51])for(const z of [-.58,-.17]){
    const ring=new THREE.Mesh(new THREE.TorusGeometry(.17,.006,4,24),metals.shell);ring.rotation.x=Math.PI/2;ring.position.set(x,1.075,z);root.add(ring);
  }
  for(const x of [-1.27,-.23])rod(root,metal,[x,1.085,-.68],[x,1.085,-.015],.01).name='Galley / pan retaining rail';
  print(root,ink,'caution',-.75,1.043,-.887,.85,.159).rotation.x=-Math.PI/2;
  // Draining grooves to the right of the basin are printed on the same metal.
  const drainer=print(root,ink,'drainer',1.327,1.037,-.36,.226,.62);drainer.rotation.x=-Math.PI/2;
  // Compact push-valve spout; its outlet is over the open basin.
  cylinder(root,metal,.75,1.087,-.794,.043,.092,.043,12);
  pipe(root,metal,[[.75,1.12,-.794],[.75,1.29,-.794],[.75,1.35,-.745],[.75,1.35,-.55],[.75,1.35,-.41]],.024).name='Galley / formed faucet';
  cylinder(root,metal,.75,1.326,-.41,.029,.052,.029,12).name='Galley / faucet outlet';
  const tap=cylinder(root,metals.shell,.935,1.28,-1.032,.045,.037,.045,16);tap.rotation.x=Math.PI/2;
  box(root,metal,.935,1.28,-1.004,.069,.025,.022);
  print(root,ink,'water',.82,1.59,-1.059,.89,.222);
  print(root,ink,'id',.82,2.037,-1.059,.86,.161);

  // Upper inserts: oven at left, chilled provisions in the middle, open wet
  // niche at right. The geometry leaves the pan, bowl and faucet accessible.
  for(const [x,w,key]of [[-1.11,.735,'dry'],[-.37,.70,'dry'],[.37,.70,'chill'],[1.11,.735,'dry']]){
    box(root,paint,x,2.519,-.66,w,.495,.78);
    door('upper stowage',x,2.517,w-.015,.486,-.256);
    print(root,ink,key,x-.025,2.681,-.219,w-.12,.15);
    for(const dx of [-w*.30,w*.30])restraint(x+dx,2.261,-.207);
  }
  box(root,metals.shell,-1.02,1.925,-.846,.94,.60,.49).name='Galley / oven casing';
  door('thermal processor',-1.02,1.916,.864,.532,-.587);
  print(root,screen,'heat',-1.02,2.087,-.550,.74,.185);
  vent(-1.02,1.724,-.55,.64);
  box(root,paint,-.12,1.928,-.858,.795,.60,.464);
  door('chilled insert',-.12,1.918,.742,.53,-.608);
  print(root,ink,'chill',-.13,2.085,-.571,.54,.15);
  vent(-.12,1.72,-.571,.52);
  for(const x of [-1.42,-.54,.24,1.43])for(const y of [.991,2.25,2.801])fastener(root,metals.shell,x,y,y<1?.199:-.17);
  box(root,indicator,.10,2.167,-.581,.036,.014,.009);
  // OBS already owns this permanent saucepan in the droid service rig. Only
  // the isolated study adds a local copy, so the live hob never has two pots.
  let pot=null;
  if(cookware){
    pot=new THREE.Group();pot.name='Galley / permanent saucepan';pot.position.set(GALLEY.pot.x,GALLEY.pot.y,GALLEY.pot.z);root.add(pot);
    cylinder(pot,metal,0,.115,0,.145,.22,.15,24);cylinder(pot,dark,0,.23,0,.14,.014,.14,24);
    for(const side of [-1,1])box(pot,dark,side*.20,.18,0,.11,.025,.04);
  }
  root.userData={sink:GALLEY.sink,pot,materials:{metal,paint,dark,red,ink}};
  return root;
}
