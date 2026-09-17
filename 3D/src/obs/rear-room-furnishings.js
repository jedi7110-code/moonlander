import * as THREE from 'three';
import {box,cylinder,rod,pipe} from './materials.js';
import {createMiloBoot} from './characters.js';

function ring(root,material,x,y,z,r,tube){
  const mesh=new THREE.Mesh(new THREE.TorusGeometry(r,tube,8,32),material);
  mesh.position.set(x,y,z);root.add(mesh);return mesh;
}

function laundry(root,m,wearMaterials){
  // Stacked front-loading washer/dryer: round doors face the cabin entrance.
  for(const [i,name]of ['Washing machine','Dryer'].entries()){
    const unit=new THREE.Group();unit.name=name;unit.position.set(-.46,.14+i*.94,-4.72);root.add(unit);
    box(unit,m.enamel,0,.45,0,.88,.90,.76,.045);
    box(unit,m.dark,0,.75,.39,.74,.13,.025,.01);
    box(unit,m.teal,-.16,.75,.408,.24,.055,.012);
    const knob=cylinder(unit,m.metal,.25,.75,.416,.042,.025,.042,16);knob.rotation.x=Math.PI/2;
    const drum=cylinder(unit,m.dark,0,.36,.391,.265,.024,.265,32);drum.rotation.x=Math.PI/2;
    ring(unit,m.metal,0,.36,.425,.258,.028);
    ring(unit,m.rubber,0,.36,.432,.219,.016);
    box(unit,m.cloth,-.035,.31,.415,.24,.13,.018,.03);
    box(unit,m.metal,.23,.36,.46,.05,.12,.055,.01);
  }
  const closet=new THREE.Group();closet.name='Open clothes closet';closet.position.set(.51,.14,-4.77);root.add(closet);
  box(closet,m.dark,0,1.02,-.27,.92,2.04,.12);
  for(const side of [-1,1])box(closet,m.enamel,side*.45,1.02,0,.055,2.04,.72);
  for(const h of [.03,.37,2.01])box(closet,m.enamel,0,h,0,.92,.055,.72);
  rod(closet,m.metal,[-.38,1.76,.12],[.38,1.76,.12],.018);
  for(const [i,paint]of [m.olive,m.cloth,m.teal].entries()){
    const garment=new THREE.Group();garment.name='Hanging garment';garment.position.x=-.27+i*.27;closet.add(garment);
    const hanger=new THREE.Group();hanger.name='Shirt hanger';garment.add(hanger);
    // The hook wraps over the rail; its stem passes through the neck opening.
    pipe(hanger,m.metal,[[0,1.746,.097],[0,1.784,.10],[0,1.789,.137],[0,1.763,.16],[0,1.70,.16],[0,1.615,.16]],.007);
    hanger.userData.shoulderContacts=[[-.075,1.581,.16],[.075,1.581,.16]];
    for(const tip of hanger.userData.shoulderContacts)rod(hanger,m.metal,[0,1.615,.16],tip,.007);
    rod(hanger,m.metal,...hanger.userData.shoulderContacts,.007);
    // One continuous shirt surface: sleeves cannot overlap the torso or neighbours.
    const points=[[-.035,1.51],[-.075,1.49],[-.12,1.38],[-.085,1.32],[-.07,1.37],[-.07,.74],
      [.07,.74],[.07,1.37],[.085,1.32],[.12,1.38],[.075,1.49],[.035,1.51],[.026,1.46],[-.026,1.46]];
    const shape=new THREE.Shape();shape.moveTo(...points[0]);for(const p of points.slice(1))shape.lineTo(...p);shape.closePath();
    const shirt=new THREE.Mesh(new THREE.ExtrudeGeometry(shape,{depth:.08,bevelEnabled:false,steps:1,curveSegments:1}),paint);
    shirt.name='Seamless T-shirt';shirt.position.set(0,.10,.12);shirt.castShadow=shirt.receiveShadow=true;garment.add(shirt);
  }
  for(let i=0;i<3;i++)box(closet,i%2?m.cloth:m.olive,0,.45+i*.08,.12,.59,.075,.39,.018).name='Folded clothing';
  // Use Milo's actual left/right boots, at their worn size, without a separate prop model.
  for(const side of [-1,1]){
    const pair=new THREE.Group();pair.name='Wardrobe boot';pair.userData.side=side;
    const boot=createMiloBoot(pair,wearMaterials,side);boot.position.set(0,0,0);
    boot.position.y=-new THREE.Box3().setFromObject(boot).min.y;
    pair.position.set(.43+side*.12,.11,-3.98);root.add(pair);
  }
  const basket=new THREE.Group();basket.name='Laundry basket';basket.position.set(.84,.13,-3.45);root.add(basket);
  box(basket,m.enamel,0,.04,0,.42,.08,.48);
  for(const side of [-1,1])for(let i=0;i<5;i++)box(basket,m.enamel,side*.20,.11+i*.045,0,.025,.018,.47);
  for(const side of [-1,1])box(basket,m.enamel,0,.22,side*.23,.42,.025,.026);
  box(basket,m.cloth,0,.27,0,.33,.11,.36,.045);
}

function stores(root,m){
  const rack=new THREE.Group();rack.name='Food and household storage rack';rack.position.z=-4.70;root.add(rack);
  for(const x of [-.93,.04,.93])for(const z of [-.34,.35])box(rack,m.metal,x,1.16,z,.045,2.12,.045);
  for(const y of [.18,.69,1.20,1.71,2.22])box(rack,m.metal,0,y,0,1.94,.045,.78);
  // Strapped ration cases and tins occupy the left half of the rack.
  for(let row=0;row<3;row++){
    const y=.38+row*.51;
    box(rack,m.olive,-.46,y,.04,.78,.34,.56,.025).name='Food ration case';
    box(rack,m.cloth,-.46,y,.327,.31,.13,.009);
    for(const dx of [-.27,.27])box(rack,m.yellow,-.46+dx,y,.333,.04,.34,.016);
  }
  for(let i=0;i<4;i++){
    const x=-.78+i*.21;
    cylinder(rack,m.enamel,x,1.89,.12,.077,.28,.077,16).name='Preserved food tin';
    cylinder(rack,m.metal,x,2.035,.12,.080,.015,.080,16);
    box(rack,m.olive,x,1.90,.198,.11,.12,.01);
  }
  // Household supplies: detergent, folded linen and paper rolls.
  for(let i=0;i<3;i++){
    const x=.25+i*.24;
    box(rack,m.teal,x,.41,.04,.19,.40,.29,.025).name='Household detergent';
    box(rack,m.dark,x,.63,.04,.085,.055,.10,.01);
    box(rack,m.cloth,x,.42,.192,.11,.16,.01);
  }
  for(let i=0;i<4;i++)box(rack,i%2?m.cloth:m.enamel,.49,.77+i*.09,.04,.69,.075,.55,.02).name='Stored linen';
  for(let row=0;row<2;row++)for(let col=0;col<3;col++){
    const x=.25+col*.24,y=1.34+row*.23;
    const roll=cylinder(rack,m.cloth,x,y,.07,.105,.30,.105,20);roll.rotation.x=Math.PI/2;roll.name='Paper roll';
    const core=cylinder(rack,m.dark,x,y,.225,.030,.012,.030,12);core.rotation.x=Math.PI/2;
  }
  for(let i=0;i<2;i++)box(rack,m.enamel,.29+i*.38,1.93,.03,.33,.36,.54,.02).name='Household supply box';
}

export function createRearRoomFurnishings(m,g,wearMaterials=m){
  const root=new THREE.Group();root.name=g.room==='laundry'?'Laundry and wardrobe room':'Food and household storeroom';
  root.position.set(g.x,g.floor,0);
  if(g.room==='laundry')laundry(root,m,wearMaterials);else stores(root,m);
  return root;
}
