import * as THREE from 'three';
import {box,cylinder,rod,pipe} from './materials.js';

// Shared geometry and materials are merged with the static cabin.
export function addFireExtinguishers(parent,m,floors){
  const unit=new THREE.Group();
  const red=new THREE.MeshStandardMaterial({name:'Fire extinguisher / red enamel',color:0xd63827,roughness:.43,metalness:.06});
  const black=new THREE.MeshStandardMaterial({name:'Fire extinguisher / hose',color:0x202525,roughness:.78});
  const white=new THREE.MeshStandardMaterial({name:'Fire extinguisher / gauge',color:0xf3f1df,roughness:.52});

  // Rear bracket meets the wall; the bottle stays behind the walking aisle.
  box(unit,m.metal,0,.30,-.17,.22,.59,.05,.015);
  box(unit,black,0,.015,-.04,.25,.035,.25,.008);
  const profile=[[0,0],[.082,0],[.108,.025],[.116,.055],[.116,.425],[.108,.475],[.08,.51],[.038,.535],[.038,.565],[0,.565]];
  const body=new THREE.Mesh(new THREE.LatheGeometry(profile.map(([r,y])=>new THREE.Vector2(r,y)),20),red);
  body.castShadow=true;body.receiveShadow=true;unit.add(body);
  const strap=new THREE.Mesh(new THREE.TorusGeometry(.119,.013,6,20),black);
  strap.rotation.x=Math.PI/2;strap.position.y=.13;unit.add(strap);

  cylinder(unit,m.metal,0,.588,0,.036,.067,.036,12);
  rod(unit,black,[-.025,.612,0],[.122,.626,0],.021);
  rod(unit,red,[-.025,.648,0],[.128,.652,0],.017);
  const pin=new THREE.Mesh(new THREE.TorusGeometry(.027,.006,5,12),m.brass);
  pin.position.set(-.048,.615,.042);unit.add(pin);
  pipe(unit,black,[[.028,.586,-.005],[.12,.579,-.02],[.178,.472,-.012],[.178,.225,.015],[.161,.175,.033]],.019);
  rod(unit,black,[.161,.175,.033],[.145,.26,.045],.026);

  cylinder(unit,m.metal,0,.542,.056,.042,.048,.042,16).rotation.x=Math.PI/2;
  cylinder(unit,white,0,.542,.083,.032,.008,.032,16).rotation.x=Math.PI/2;
  rod(unit,black,[0,.542,.089],[.013,.558,.089],.0035);
  box(unit,white,0,.315,.113,.136,.19,.008,.008);
  box(unit,red,0,.365,.119,.104,.025,.006);
  for(let i=0;i<3;i++)box(unit,black,-.006,.325-i*.027,.119,.086-i*.009,.009,.006);

  // Same position on every deck, above the cat duct and right of the ladder.
  return floors.map((floor,index)=>{
    const placed=unit.clone();placed.name=`Fire extinguisher deck ${index+1}`;
    placed.position.set(.99,floor+1.02,-1.405);parent.add(placed);return placed;
  });
}
