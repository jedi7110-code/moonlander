import * as THREE from 'three';
import {box,ball,cylinder,rod} from './materials.js';

export const EQUIPMENT_RACK={x:11.73,width:1.60,depth:-1.15,slots:[-.51,0,.51]};

function plate(parent,material,points,z,depth){
  const shape=new THREE.Shape(points.map(([x,y])=>new THREE.Vector2(x,y)));
  const mesh=new THREE.Mesh(new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:true,bevelSize:.012,bevelThickness:.009,bevelSegments:2,steps:1}),material);
  mesh.position.z=z;mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;
}

export function createEVARifle(m){
  const root=new THREE.Group();root.name='EVA pulse rifle';
  const shell=m.metal.clone();shell.color.setHex(0xb4b9b1);shell.roughness=.5; shell.metalness=.52;
  const trim=m.metal.clone();trim.color.setHex(0xcbd0c6);
  const light=m.coolLamp.clone();light.color.setHex(0x90dde0);light.emissive.setHex(0x48cbd8);light.emissiveIntensity=.65;
  // Display-only prop: broad shroud, inset panels and restrained cyan charge windows.
  plate(root,shell,[[-.43,-.11],[-.30,-.11],[-.22,-.06],[.51,-.06],[.58,.00],[.58,.13],[.51,.19],[-.26,.19],[-.43,.13]],-.072,.144).name='Armored receiver';
  plate(root,m.rubber,[[-.43,-.10],[-.62,-.17],[-.65,-.13],[-.63,.12],[-.43,.14]],-.060,.120).name='Stock';
  plate(root,m.rubber,[[-.24,-.07],[-.29,-.26],[-.18,-.28],[-.12,-.07]],-.04,.08).name='Grip';
  box(root,m.dark,.12,-.112,0,.32,.07,.14,.015);
  box(root,trim,.15,.193,0,.74,.035,.17,.008);
  box(root,m.rubber,.17,.107,.083,.63,.109,.016,.010);
  for(let i=0;i<7;i++)box(root,light,-.063+i*.076,.12,.096,.05,.042,.009,.006);
  for(let i=0;i<9;i++)box(root,m.rubber,-.18+i*.078,.219,0,.030,.013,.14,.003);
  for(const z of [-.085,.085]){
    box(root,trim,.24,-.025,z,.52,.025,.018,.004);
    for(let i=0;i<6;i++)box(root,m.dark,.035+i*.079,.025,z,.050,.043,.014,.005);
  }
  const port=new THREE.Group();port.position.set(-.298,.038,.087);root.add(port);
  cylinder(port,m.rubber,0,0,0,.084,.029,.084,32).rotation.x=Math.PI/2;
  cylinder(port,trim,0,0,.020,.066,.015,.066,32).rotation.x=Math.PI/2;
  cylinder(port,light,0,0,.031,.042,.008,.042,32).rotation.x=Math.PI/2;
  for(const x of [-.42,-.10,.47])for(const y of [-.055,.168])ball(root,trim,x,y,.09,.009,.009,.005);
  const muzzle=new THREE.Group();muzzle.position.set(.606,.060,0);muzzle.rotation.z=-Math.PI/2;root.add(muzzle);
  cylinder(muzzle,m.dark,0,0,0,.094,.10,.094,8);
  cylinder(muzzle,trim,0,.055,0,.070,.014,.070,8);
  cylinder(muzzle,m.black,0,.064,0,.052,.008,.052,24);
  rod(root,m.dark,[-.38,.279,0],[-.02,.279,0],.031).name='Optic';
  for(const x of [-.28,-.12])box(root,trim,x,.242,0,.036,.051,.058,.006);
  return root;
}

export function createEquipmentRack(m,y){
  const root=new THREE.Group();root.name='EVA weapon rack';root.position.set(EQUIPMENT_RACK.x,y,EQUIPMENT_RACK.depth);
  box(root,m.dark,0,1.40,0,EQUIPMENT_RACK.width,2.22,.12,.045);
  box(root,m.rubber,0,1.40,.072,1.47,2.08,.025,.025);
  box(root,m.dark,0,2.50,.15,1.49,.075,.25,.015);
  box(root,m.coolLamp,0,2.464,.184,1.32,.015,.14,.005);
  for(const x of [-.75,.75])for(const yy of [.39,2.41])cylinder(root,m.metal,x,yy,.072,.016,.014,.016,8).rotation.x=Math.PI/2;
  for(const yy of [.64,1.60,2.16])box(root,m.metal,0,yy,.125,1.44,.045,.042,.009);
  const weapons=[];
  for(const [index,x]of EQUIPMENT_RACK.slots.entries()){
    const rifle=createEVARifle(m);rifle.position.set(x,1.33,.29);rifle.rotation.z=Math.PI/2;rifle.scale.y=.78;rifle.userData.rackSlot=index+1;root.add(rifle);weapons.push(rifle);
    for(const yy of [.90,1.63]){
      box(root,m.rubber,x,yy,.20,.21,.075,.15,.018);
      for(const side of [-1,1])box(root,m.metal,x+side*.095,yy,.30,.026,.076,.14,.007);
    }
    box(root,m.metal,x,.64,.24,.22,.036,.20,.010);
  }
  root.userData.weapons=weapons;return root;
}
