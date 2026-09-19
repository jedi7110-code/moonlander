import * as THREE from 'three';
import {box,ball,cylinder,pipe,label} from './materials.js';
import {createEVAHelmet,EVA_HELMET,helmetHoseSocket} from './eva-helmet.js';
import {finishEVAGarment} from './eva-garment.js';
import {EVA_BODY,mirrored,armFrame,buildTailoredBody,tailoredTube} from './eva-anatomy.js';

function variant(m,red){
  const cloth=m.evaCloth.clone(),paint=m.enamel.clone(),seam=m.evaCloth.clone(),helmet=m.evaHelmet.clone();
  cloth.color.setHex(red?0x82151c:0xbabfb7);cloth.roughness=.88;seam.color.setHex(red?0x7e2025:0x90958d);
  paint.color.setHex(red?0x962229:0xcbd0c8);paint.roughness=.49;
  helmet.color.copy(paint.color);helmet.metalness=.22;helmet.roughness=.46;
  return Object.assign(Object.create(m),{evaCloth:cloth,evaPaint:paint,evaSeam:seam,evaHelmet:helmet});
}
function ring(parent,material,point,radius,tube=.008,axis=[0,0,1]){
  const mesh=new THREE.Mesh(new THREE.TorusGeometry(radius,tube,8,32),material);
  mesh.position.set(...point);mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),new THREE.Vector3(...axis).normalize());
  mesh.castShadow=true;parent.add(mesh);return mesh;
}
function socket(parent,m,x,y,z,r=.04){
  cylinder(parent,m.dark,x,y,z,r,.023,r,24).rotation.x=Math.PI/2;ring(parent,m.metal,[x,y,z+.015],r*.85,.005);
  cylinder(parent,m.rubber,x,y,z+.021,r*.58,.008,r*.58,24).rotation.x=Math.PI/2;
}
function strap(parent,m,a,b,width=.04){
  const from=new THREE.Vector3(...a),to=new THREE.Vector3(...b);
  const mesh=box(parent,m.rubber,...from.clone().add(to).multiplyScalar(.5),width,from.distanceTo(to),.012,.004);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),to.sub(from).normalize());mesh.name='Restraint harness';return mesh;
}
function shoulderHarness(parent,m,points){
  const curve=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p))),vertices=[],uvs=[],indices=[];
  for(let i=0;i<=32;i++){
    const p=curve.getPoint(i/32);vertices.push(p.x-.020,p.y,p.z,p.x+.020,p.y,p.z);uvs.push(0,i/32,1,i/32);
    if(i<32){const n=i*2;indices.push(n,n+2,n+1,n+1,n+2,n+3);}
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));geometry.setIndex(indices);geometry.computeVertexNormals();
  const mesh=new THREE.Mesh(geometry,m.evaPaint);mesh.name='Restraint harness';mesh.castShadow=true;parent.add(mesh);
  for(const side of [-1,1])pipe(parent,m.dark,points.map(([x,y,z])=>[x+side*.018,y,z+.001]),.0015);
}
function hose(parent,m,points,r=.016){
  const curve=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)));pipe(parent,m.rubber,points,r);
  for(let i=0;i<=24;i++)ring(parent,m.dark,curve.getPoint(i/24).toArray(),r*1.04,.003,curve.getTangent(i/24).toArray());
}

// Neutral forearms: dorsum outward, thumb leading forward, fingers curling inward.
function glove(parent,m,side){
  const frame=armFrame(side),root=new THREE.Group();root.name='Relaxed pressure glove';root.userData.side=side;
  root.position.copy(frame.wrist);root.quaternion.copy(frame.quaternion);parent.add(root);
  cylinder(root,m.metal,0,0,0,.060,.026,.060,32).name='Glove locking cuff';
  ring(root,m.rubber,[0,-.018,0],.059,.004,[0,1,0]).name='Glove wrist gasket';
  // The circular wrist overlaps the cuff and gasket before becoming an oval
  // palm. Keep this one continuous surface, not a separate floating hand.
  const handScale=1.12,hand=new THREE.Group();hand.name='Pressure glove hand';
  hand.scale.setScalar(handScale);hand.position.y=.018*(handScale-1);root.add(hand);
  tailoredTube(root,m.evaCloth,[[0,.020,0],[0,-.018,0],[0,-.0628,0],[0,-.1132,-.00336]],
    [[0,.057,.057],[.34,.057,.057],[.50,.054,.047],[.75,.0504,.0336],[1,.04592,.02464]],
    {rows:48,columns:32,name:'Shaped glove palm'});
  ball(hand,m.evaCloth,0,-.095,-.004,.043,.026,.024);ball(hand,m.evaCloth,0,-.064,.024,.034,.036,.005);
  const lengths=[.077,.088,.082,.064];
  for(let i=0;i<4;i++){
    const x=side*(i-1.5)*.021,base=-.101+Math.abs(i-1.3)*.002,len=lengths[i],tip=[x+side*(i-1.5)*.001,base-len*.88,-.031];
    const finger=tailoredTube(hand,m.evaCloth,[[x,base,0],[x,base-len*.46,-.005],tip],[[0,.0105,.012],[.42,.010,.011],[.78,.009,.009],[1,.0075,.008]],{rows:20,columns:16,name:'Curved glove finger'});
    finger.userData.finger=i;ball(hand,m.evaCloth,...tip,.0075,.009,.008);ring(hand,m.evaSeam,[x,base-len*.35,-.003],.010,.0013,[0,1,.15]);
  }
  const thumbPoints=[[-side*.032,-.049,-.004],[-side*.060,-.078,-.014],[-side*.061,-.111,-.035]];
  tailoredTube(hand,m.evaCloth,thumbPoints,[[0,.019,.020],[.42,.016,.016],[1,.010,.011]],{rows:24,columns:20,name:'Opposed glove thumb'});
  ball(hand,m.evaCloth,...thumbPoints[2],.010,.012,.011);
  const instrument=new THREE.Group();instrument.name='Dorsal wrist instrument';instrument.position.set(0,.066,.064);root.add(instrument);
  box(instrument,m.evaPaint,0,0,0,.074,.094,.025,.010);box(instrument,m.dark,0,.004,.016,.052,.061,.009,.005);
  for(const x of [-.025,.025])box(instrument,m.metal,x,-.035,.015,.010,.008,.006,.002);
  return root;
}
function legEquipment(parent,m,side){
  const knee=mirrored(EVA_BODY.knee,side),ankle=mirrored(EVA_BODY.ankle,side),up=knee.clone().sub(ankle).normalize();
  const shin=new THREE.Group();shin.position.copy(ankle);shin.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),up);parent.add(shin);
  box(shin,m.evaCloth,0,.416,.087,.124,.139,.019,.026).name='Fabric knee reinforcement';
  for(let j=0;j<6;j++)pipe(shin,m.evaSeam,[[-.048,.379+j*.012,.098],[0,.377+j*.012,.104],[.048,.379+j*.012,.098]],.0013);
  box(shin,m.evaCloth,side*.061,.186,.038,.075,.177,.103,.022).name='Calf utility pocket';
  box(shin,m.evaPaint,side*.063,.246,.093,.037,.029,.011,.004);
  for(const [y,r]of [[.031,.072],[.247,.089]]){
    cylinder(shin,m.rubber,0,y,0,r,.018,r,32).scale.z=1.07;box(shin,m.metal,0,y,r*1.07,.033,.022,.009,.003);
  }
  const boot=new THREE.Group();boot.name='Anatomical pressure boot';boot.position.set(ankle.x,0,ankle.z);boot.rotation.y=side*.09;parent.add(boot);
  box(boot,m.rubber,0,.034,.058,.148,.047,.263,.022);box(boot,m.evaCloth,0,.078,.055,.136,.078,.237,.032);
  tailoredTube(boot,m.evaCloth,[[0,.211,.004],[0,.150,.008],[0,.075,.054]],[[0,.063,.062],[.45,.067,.064],[1,.064,.080]],{rows:28,folds:[[.5,.2,.001]],name:'Boot ankle gusset'});
  box(boot,m.dark,0,.055,.155,.137,.036,.066,.018);
  for(let j=0;j<5;j++)box(boot,m.rubber,0,.013,-.042+j*.046,.145,.013,.016,.003);
  for(const y of [.105,.140])strap(boot,m,[-.050,y,.105],[.050,y,.105],.013);
}
function lifeSupport(parent,m){
  const pack=new THREE.Group();pack.name='Life support backpack';pack.position.z=-.047;parent.add(pack);
  box(pack,m.rubber,0,1.388,-.174,.323,.448,.108,.040);box(pack,m.evaPaint,0,1.398,-.233,.306,.427,.079,.034);
  box(pack,m.evaPaint,0,1.196,-.229,.214,.180,.080,.039);box(pack,m.dark,0,1.422,-.280,.139,.159,.018,.012);
  for(let i=0;i<8;i++)box(pack,m.metal,0,1.358+i*.018,-.292,.111,.004,.006,.001);
  for(const x of [-.115,.115])for(const y of [1.26,1.568])cylinder(pack,m.dark,x,y,-.279,.007,.010,.007,8).rotation.x=Math.PI/2;
  for(const [x,y,r]of [[-.092,1.259,.026],[.092,1.259,.026],[0,1.192,.036]]){
    const port=new THREE.Group();port.position.set(x,y,-.279);port.rotation.y=Math.PI;pack.add(port);socket(port,m,0,0,0,r);
  }
  for(const side of [-1,1]){
    const socket=helmetHoseSocket(side).outlet.multiplyScalar(EVA_HELMET.scale).add(new THREE.Vector3(0,EVA_HELMET.base,EVA_HELMET.depthOffset)).sub(pack.position);
    const link=new THREE.Group();link.name='Rear helmet breathing hose';link.userData.side=side;pack.add(link);
    hose(link,m,[[side*.071,1.608,-.270],[side*.070,1.669,-.231],socket.toArray()],.0105);
  }
}
function chestPlate(parent,m,index){
  const shape=new THREE.Shape();shape.moveTo(-.105,.144);shape.lineTo(.105,.144);shape.lineTo(.130,.074);shape.lineTo(.105,-.105);shape.lineTo(.082,-.143);shape.lineTo(-.082,-.143);shape.lineTo(-.105,-.105);shape.lineTo(-.130,.074);shape.closePath();
  const plate=new THREE.Mesh(new THREE.ExtrudeGeometry(shape,{depth:.022,bevelEnabled:true,bevelSegments:3,steps:1,bevelSize:.006,bevelThickness:.005}),m.evaPaint);
  plate.position.set(0,1.422,.088);plate.name='Chest service panel';plate.castShadow=true;parent.add(plate);
  box(parent,m.dark,0,1.493,.117,.119,.021,.008,.003);
  for(const [x,y,r]of [[-.043,1.432,.027],[.043,1.432,.027],[0,1.368,.028]])socket(parent,m,x,y,.117,r);
  label(parent,`EVA-${String(index+1).padStart(2,'0')}`,0,1.541,.117,.099,.024,{size:50,fg:'#d9dfd7',bg:'#283031'});
}
export function hangingSuit(materials,index){
  const red=index===1,m=variant(materials,red),suit=new THREE.Group();
  suit.name=`EVA suit ${index+1}`;suit.userData={suitNumber:index+1,colorway:red?'red':'white',anatomy:'reference-reconstructed-v2',joints:EVA_BODY};
  buildTailoredBody(suit,m);lifeSupport(suit,m);cylinder(suit,m.evaPaint,0,1.151,-.054,.196,.018,.196,48).scale.z=.69;
  for(const side of [-1,1]){
    legEquipment(suit,m,side);glove(suit,m,side);
    const port=new THREE.Group();port.position.set(side*.354,1.407,-.064);port.rotation.y=side*Math.PI/2;suit.add(port);socket(port,m,0,0,0,.029);
    shoulderHarness(suit,m,[[side*.110,1.621,-.030],[side*.146,1.572,.035],[side*.160,1.496,.082],[side*.132,1.323,.110]]);
    box(suit,m.metal,side*.144,1.566,.047,.039,.036,.012,.004);box(suit,m.rubber,side*.144,1.566,.055,.025,.020,.005,.002);
    strap(suit,m,[side*.183,1.153,.005],[side*.128,1.241,.067],.026);socket(suit,m,side*.150,1.244,.065,.030);
    hose(suit,m,[[side*.150,1.244,.086],[side*.198,1.192,.051],[side*.211,1.194,-.127],[side*.142,1.248,-.268]]);
  }
  pipe(suit,m.evaSeam,[[0,1.137,.080],[0,1.083,.072],[0,1.010,.039],[0,.948,-.005]],.0013);
  const collarRoot=new THREE.Group();collarRoot.position.set(0,1.629,-.044);collarRoot.rotation.x=Math.atan(.30);suit.add(collarRoot);
  cylinder(collarRoot,m.dark,0,0,0,.140,.064,.133,48).name='Wide helmet locking collar';
  for(const y of [-.020,.014])ring(collarRoot,m.rubber,[0,y,0],.139,.0045,[0,1,0]);
  for(const side of [-1,1])box(collarRoot,m.metal,side*.039,-.004,.136,.018,.025,.009,.002);
  const helmet=createEVAHelmet(m,{red});suit.add(helmet);chestPlate(suit,m,index);finishEVAGarment(suit,m.evaCloth);
  pipe(suit,m.metal,[[.145,1.60,-.26],[.145,2.075,-.30],[0,2.115,-.31],[0,2.15,-.31]],.014).name='Suspension support';
  pipe(suit,m.metal,[[0,2.15,-.31],[0,2.24,-.31],[0,2.265,-.39],[0,2.18,-.43]],.014).name='Suspension hook';return suit;
}
