import * as THREE from 'three';
import {box,ball,cylinder,pipe,rod,label} from './materials.js';
import {createEVAHelmet} from './eva-helmet.js';

function variant(m,red){
  const cloth=m.evaCloth.clone(),paint=m.enamel.clone(),seam=m.evaCloth.clone(),helmet=m.evaHelmet.clone();
  cloth.color.setHex(red?0x82151c:0xbabfb7);cloth.roughness=.88;
  seam.color.setHex(red?0x7e2025:0x90958d);
  paint.color.setHex(red?0x962229:0xcbd0c8);paint.roughness=.49;
  helmet.color.copy(paint.color);helmet.metalness=.32;helmet.roughness=.32;
  return Object.assign(Object.create(m),{evaCloth:cloth,evaPaint:paint,evaSeam:seam,evaHelmet:helmet});
}

function ring(parent,material,point,radius,tube=.008,axis=[0,0,1]){
  const mesh=new THREE.Mesh(new THREE.TorusGeometry(radius,tube,8,32),material);
  mesh.position.set(...point);mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),new THREE.Vector3(...axis).normalize());
  mesh.castShadow=true;parent.add(mesh);return mesh;
}

function socket(parent,m,x,y,z,r=.04){
  cylinder(parent,m.dark,x,y,z,r,.023,r,24).rotation.x=Math.PI/2;
  ring(parent,m.metal,[x,y,z+.015],r*.85,.006);
  cylinder(parent,m.rubber,x,y,z+.021,r*.58,.008,r*.58,24).rotation.x=Math.PI/2;
}

// Cloth folds are part of a continuous surface, rather than separate padded rings.
function sleeve(parent,m,a,b,profile,seed,depth=1){
  const from=new THREE.Vector3(...a),to=new THREE.Vector3(...b),length=from.distanceTo(to),rows=64,columns=36;
  const vertices=[],uvs=[],indices=[];
  for(let row=0;row<=rows;row++){
    const t=row/rows;let section=0;
    while(section<profile.length-2&&t>profile[section+1][0])section++;
    const [ta,ra]=profile[section],[tb,rb]=profile[section+1],blend=THREE.MathUtils.smoothstep(t,ta,tb),radius=THREE.MathUtils.lerp(ra,rb,blend);
    for(let col=0;col<=columns;col++){
      const angle=col/columns*Math.PI*2;
      const envelope=Math.sin(t*Math.PI)**2;
      const crease=envelope*(.0022*Math.sin(t*83+Math.sin(angle*3+seed)*1.7)+.0015*Math.sin(t*135-angle*5+seed));
      const r=radius+crease;
      vertices.push(Math.cos(angle)*r,-t*length,Math.sin(angle)*r*depth);uvs.push(col/columns,t);
      if(row<rows&&col<columns){const i=row*(columns+1)+col;indices.push(i,i+1,i+columns+1,i+1,i+columns+2,i+columns+1);}
    }
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));geometry.setIndex(indices);geometry.computeVertexNormals();
  const group=new THREE.Group();group.position.copy(from);group.quaternion.setFromUnitVectors(new THREE.Vector3(0,-1,0),to.sub(from).normalize());parent.add(group);
  const mesh=new THREE.Mesh(geometry,m.evaCloth);mesh.name='Tailored pressure garment';mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);
  for(const side of [-1,1])pipe(group,m.evaSeam,profile.map(([t,r])=>[side*(r+.001),-t*length,.014]),.0025);
  return group;
}

function strap(parent,m,a,b,width=.04){
  const from=new THREE.Vector3(...a),to=new THREE.Vector3(...b);
  const mesh=box(parent,m.rubber,...from.clone().add(to).multiplyScalar(.5),width,from.distanceTo(to),.019,.005);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),to.sub(from).normalize());mesh.name='Restraint harness';
  return mesh;
}

function shoulderHarness(parent,m,points){
  const curve=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p))),vertices=[],uvs=[],indices=[];
  for(let i=0;i<=24;i++){
    const p=curve.getPoint(i/24);vertices.push(p.x-.022,p.y,p.z,p.x+.022,p.y,p.z);uvs.push(0,i/24,1,i/24);
    if(i<24){const n=i*2;indices.push(n,n+2,n+1,n+1,n+2,n+3);}
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));geometry.setIndex(indices);geometry.computeVertexNormals();
  const mesh=new THREE.Mesh(geometry,m.rubber);mesh.name='Restraint harness';mesh.castShadow=true;parent.add(mesh);
  for(const side of [-1,1])pipe(parent,m.dark,points.map(([x,y,z])=>[x+side*.019,y,z+.001]),.0016);
}

function hose(parent,m,points,r=.022){
  const curve=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)));
  pipe(parent,m.rubber,points,r);
  for(let i=0;i<=24;i++)ring(parent,m.dark,curve.getPoint(i/24).toArray(),r*1.04,.004,curve.getTangent(i/24).toArray());
}

function glove(parent,m,side){
  const root=new THREE.Group();root.position.set(side*.37,.88,.034);root.rotation.z=-side*.10;parent.add(root);
  cylinder(root,m.metal,0,0,0,.073,.045,.073,28);
  ring(root,m.rubber,[0,-.025,0],.073,.008,[0,1,0]);
  ball(root,m.rubber,0,-.090,.014,.065,.080,.040);
  box(root,m.dark,0,-.080,.051,.104,.083,.014,.01);
  for(let i=0;i<4;i++){
    const x=(i-1.5)*.027,end=-.215+Math.abs(i-1.5)*.016;
    pipe(root,m.rubber,[[x,-.135,.01],[x,-.179,.029],[x,end,.048]],.013);
    for(const y of [-.14,-.168])box(root,m.dark,x,y,.043,.022,.012,.014,.004);
  }
  pipe(root,m.rubber,[[-side*.051,-.077,.026],[-side*.079,-.130,.055],[-side*.070,-.155,.071]],.019);
}

export function hangingSuit(materials,index){
  const red=index===1,m=variant(materials,red),suit=new THREE.Group();
  suit.name=`EVA suit ${index+1}`;suit.userData={suitNumber:index+1,colorway:red?'red':'white'};
  const backpack=new THREE.Group();backpack.name='Life support backpack';suit.add(backpack);
  box(backpack,m.rubber,0,1.34,-.228,.45,.69,.22,.065);
  box(backpack,m.evaPaint,0,1.36,-.347,.43,.65,.093,.055);
  box(backpack,m.dark,0,1.40,-.402,.215,.26,.027,.025);
  for(let i=0;i<9;i++)box(backpack,m.metal,0,1.30+i*.025,-.420,.17,.007,.014,.002);
  for(const x of [-.14,.14])for(const y of [1.10,1.59])cylinder(backpack,m.dark,x,y,-.404,.014,.018,.014,8).rotation.x=Math.PI/2;
  for(const x of [-.1,.1])hose(backpack,m,[[x,1.53,-.39],[x,1.81,-.36],[x,1.98,-.24]],.014);
  sleeve(suit,m,[0,1.589,0],[0,1.04,0],[[0,.141],[.16,.216],[.36,.228],[.65,.206],[.84,.203],[1,.222]],index+7,.70);
  ball(suit,m.evaCloth,0,1.048,0,.224,.182,.15);
  cylinder(suit,m.rubber,0,1.007,.004,.222,.044,.222,40).scale.z=.73;
  for(const side of [-1,1]){
    const hip=[side*.112,1.005,0],ankle=[side*.141,.17,.015];
    sleeve(suit,m,hip,ankle,[[0,.111],[.12,.117],[.37,.101],[.52,.092],[.59,.095],[.72,.086],[.92,.079],[1,.076]],index+side,.91);
    box(suit,m.evaCloth,side*.14,.559,.089,.135,.154,.024,.030).name='Fabric knee reinforcement';
    box(suit,m.evaPaint,side*.144,.297,.084,.062,.095,.028,.009);
    box(suit,m.dark,side*.145,.298,.102,.040,.062,.012,.004);
    for(const y of [.186,.366]){
      const band=cylinder(suit,m.rubber,side*.141,y,.014,.088,.025,.088,28);band.scale.z=.88;
      box(suit,m.metal,side*.141,y,.091,.055,.035,.013,.005);
    }
    box(suit,m.rubber,side*.142,.060,.067,.179,.100,.292,.035);
    box(suit,m.evaCloth,side*.142,.123,.055,.166,.15,.254,.055);
    ball(suit,m.dark,side*.142,.081,.157,.089,.051,.094);
    for(let j=0;j<5;j++)box(suit,m.rubber,side*.142,.021,-.052+j*.047,.186,.024,.024,.004);
    for(const y of [.118,.16])strap(suit,m,[side*.142-.062,y,.118],[side*.142+.062,y,.118],.021);
    const shoulder=[side*.258,1.495,0],wrist=[side*.37,.91,.025];
    sleeve(suit,m,shoulder,wrist,[[0,.072],[.10,.099],[.30,.092],[.49,.078],[.59,.081],[.76,.075],[1,.067]],index+side+2,.95);
    ball(suit,m.evaCloth,side*.243,1.492,-.004,.111,.092,.108);
    const port=new THREE.Group();port.position.set(side*.331,1.399,.005);port.rotation.y=side*Math.PI/2;suit.add(port);
    socket(port,m,0,0,0,.045);
    box(suit,m.evaPaint,side*.365,.975,.098,.112,.127,.039,.018);
    box(suit,m.dark,side*.365,.983,.120,.082,.084,.012,.010);
    glove(suit,m,side);
    shoulderHarness(suit,m,[[side*.147,1.577,.080],[side*.168,1.506,.149],[side*.166,1.437,.179],[side*.146,1.373,.196]]);
    strap(suit,m,[side*.21,1.012,.061],[side*.14,1.154,.17],.036);
    box(suit,m.metal,side*.175,1.532,.097,.06,.051,.02,.006);
    box(suit,m.rubber,side*.175,1.532,.110,.038,.026,.008,.003);
    socket(suit,m,side*.178,1.136,.145,.040);
    hose(suit,m,[[side*.178,1.136,.170],[side*.245,1.08,.125],[side*.256,1.088,-.092],[side*.20,1.217,-.28]]);
  }
  for(const x of [-.12,0,.12])pipe(suit,m.evaSeam,[[x,1.20,.155],[x,1.085,.154],[x,1.033,.151]],.0025);
  for(const side of [-1,1])pipe(suit,m.evaSeam,[[side*.105,1.016,.154],[side*.110,.937,.106],[side*.116,.809,.106],[side*.121,.639,.099]],.0025);
  cylinder(suit,m.dark,0,1.625,0,.169,.113,.162,36);
  for(const y of [1.590,1.627,1.665])ring(suit,m.rubber,[0,y,0],.165,.011,[0,1,0]);
  const helmet=createEVAHelmet(m);suit.add(helmet);
  box(suit,m.evaPaint,0,1.389,.168,.259,.239,.052,.027).name='Chest service panel';
  box(suit,m.dark,0,1.462,.200,.177,.030,.010,.004);
  for(const [x,y,r]of [[-.061,1.399,.038],[.060,1.399,.038],[0,1.324,.035]])socket(suit,m,x,y,.205,r);
  label(suit,`EVA-${String(index+1).padStart(2,'0')}`,0,1.542,.171,.17,.042,{size:50,fg:'#d9dfd7',bg:'#283031'});
  pipe(suit,m.metal,[[.20,1.69,-.30],[.18,2.20,-.32],[0,2.26,-.32],[0,2.39,-.32]],.019);
  pipe(suit,m.metal,[[0,2.39,-.32],[0,2.49,-.32],[0,2.51,-.39],[0,2.42,-.43]],.019);
  return suit;
}
