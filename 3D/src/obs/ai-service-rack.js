import {Group,Mesh,MeshBasicMaterial,PlaneGeometry,Shape,Path,ShapeGeometry} from 'three';
import {box,cylinder,label} from './materials.js';
import {displayFrame} from './display-frame.js';
import {AISupervision} from './ai-supervision.js';

function screw(root,m,x,y,z){
  const head=cylinder(root,m.metal,x,y,z,.013,.013,.013,6);head.rotation.x=Math.PI/2;
}
function serverUnit(root,m,y,index,led){
  const unit=new Group();unit.name=`Supervisor server ${index?'B / standby':'A / primary'}`;unit.position.y=y;root.add(unit);
  unit.scale.y=.60;
  box(unit,m.dark,0,0,.105,1.32,.166,.19,.009);
  box(unit,m.metal,0,0,.208,1.27,.146,.018,.004);
  box(unit,m.black,-.24,-.02,.222,.65,.065,.013);
  for(let i=0;i<16;i++)box(unit,m.dark,-.543+i*.039,-.02,.233,.013,.061,.014);
  label(unit,index?'CORE B / RESERVE':'CORE A / SUPERVISOR',-.24,.045,.221,.61,.027,{fg:'#d0d6c5',bg:'#354142'});
  for(let i=0;i<3;i++){
    const x=.167+i*.149;
    box(unit,m.black,x,0,.225,.133,.108,.017,.004);
    box(unit,m.dark,x,0,.244,.110,.081,.022,.003);
    box(unit,m.metal,x-.037,0,.26,.012,.047,.014);
    box(unit,led,x+.028,-.027,.26,.014,.007,.007);
  }
  for(const x of [-.605,.605]){
    box(unit,m.dark,x,0,.244,.033,.107,.036,.006);screw(unit,m,x,.06,.232);screw(unit,m,x,-.06,.232);
  }
}
function wiringBay(root,m){
  const bay=new Group();bay.name='AI rack / wired service bay';root.add(bay);
  // The original harness is baked once into this PNG. No runtime cable meshes,
  // texture redraws or additional lights are needed inside the covered bay.
  const wiring=new Mesh(new PlaneGeometry(1.32,.32),m.aiWiring);
  wiring.name='Baked service wiring';wiring.position.set(0,.435,.13);bay.add(wiring);
  const sheet=new Shape();sheet.moveTo(-.63,-.133);sheet.lineTo(.63,-.133);sheet.lineTo(.63,.133);sheet.lineTo(-.63,.133);sheet.closePath();
  for(let row=0;row<4;row++)for(let column=0;column<18;column++){
    const x=(column-8.5)*.064+(row%2?1:-1)*.016,y=(row-1.5)*.059,hole=new Path();
    for(let corner=0;corner<6;corner++){
      const angle=corner*Math.PI/3,px=x+Math.cos(angle)*.024,py=y+Math.sin(angle)*.024;
      corner?hole.lineTo(px,py):hole.moveTo(px,py);
    }
    hole.closePath();sheet.holes.push(hole);
  }
  const cover=new Mesh(new ShapeGeometry(sheet),m.metal);cover.name='Perforated wiring cover';
  cover.position.set(0,.435,.236);cover.castShadow=cover.receiveShadow=true;bay.add(cover);
  displayFrame(bay,m.dark,{x:0,y:.435,z:.24,width:1.32,height:.32,depth:.052,holeWidth:1.24,holeHeight:.258});
  for(const x of [-.644,.644])for(const y of [.31,.56])screw(bay,m,x,y,.278);
}

export function createAIServiceRack(m){
  const root=new Group();root.name='AI supervision rack';
  box(root,m.rubber,0,1.48,0,1.545,2.455,.10,.018);
  box(root,m.dark,0,1.48,.064,1.52,2.43,.06,.015);
  for(const side of [-1,1]){
    box(root,m.metal,side*.717,1.48,.131,.033,2.40,.026,.003).name='Rack mounting rail';
    for(let i=0;i<18;i++)box(root,m.black,side*.717,.345+i*.129,.146,.013,.022,.006);
    for(const y of [.32,.65,1.19,1.72,2.24,2.61])screw(root,m,side*.717,y,.154);
  }
  const online=new MeshBasicMaterial({name:'AI rack / online indicators',color:0x87c9aa,toneMapped:false});online.userData.cabinAlwaysPowered=true;
  const reserve=new MeshBasicMaterial({name:'AI rack / reserve indicators',color:0xc6a96b,toneMapped:false});reserve.userData.cabinAlwaysPowered=true;
  serverUnit(root,m,2.405,0,online);serverUnit(root,m,2.282,1,reserve);
  const screens=new AISupervision();
  for(let index=0;index<4;index++){
    const y=2.05-index*.42;
    displayFrame(root,m.dark,{x:0,y,z:.135,width:1.32,height:.36,depth:.065,holeWidth:1.17,holeHeight:.282});
    screens.add(root,0,y,.11,1.16,.27,index);
    for(const x of [-.635,.635])screw(root,m,x,y,.175);
  }
  wiringBay(root,m);return{root,screens};
}
