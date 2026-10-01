import * as THREE from 'three';
import {box,cylinder,rod} from './materials.js';
import {EVA_PASSAGE,CABIN_AISLE} from './layout.js';
import {hangingSuit} from './eva-suit.js';
import {createEquipmentRack} from './eva-equipment.js';
import {EVA_SPOT_LAYOUT} from './lighting.js';
import {createPressureHatch,animatePressureHatch,PRESSURE_HATCH,PRESSURE_LOCK_SERVICE,pressureCassetteOutline} from './pressure-hatch.js';
export {PRESSURE_HATCH} from './pressure-hatch.js';
export {hangingSuit} from './eva-suit.js';

export const EVA_BAY={suitX:EVA_SPOT_LAYOUT.suitX,suitZ:-.73,railY:2.62,hatchX:13.03,innerX:(EVA_PASSAGE.x-700)*.022,hatchYaw:-Math.PI/2,depth:CABIN_AISLE.crewZ};
// World X/Z and deck-relative Y, shared by OBS and the repair study.
export const HATCH_SERVICE_POINT={x:EVA_BAY.innerX-PRESSURE_LOCK_SERVICE.z-PRESSURE_LOCK_SERVICE.tip,y:PRESSURE_HATCH.centerY+PRESSURE_LOCK_SERVICE.y,z:EVA_BAY.depth+PRESSURE_LOCK_SERVICE.x};

export function createEVASpotlights(m,y){
  const root=new THREE.Group();root.name='EVA overhead spotlights';
  const lens=new THREE.MeshBasicMaterial({name:'EVA spot light lens',color:0xffe5c6,toneMapped:false});
  lens.userData.cabinAlwaysPowered=true;
  const layout=EVA_SPOT_LAYOUT,direction=new THREE.Vector3(0,layout.targetY-layout.sourceY,layout.targetZ-layout.sourceZ).normalize();
  for(const [index,x]of layout.suitX.entries()){
    box(root,m.dark,x,y+3.18,layout.sourceZ,.27,.055,.24);
    cylinder(root,m.metal,x,y+3.07,layout.sourceZ,.025,.20,.025,8);
    const head=new THREE.Group();head.name=`EVA overhead spot ${index+1}`;
    head.position.set(x,y+layout.sourceY,layout.sourceZ);
    head.quaternion.setFromUnitVectors(new THREE.Vector3(0,-1,0),direction);root.add(head);
    cylinder(head,m.dark,0,.025,0,.115,.20,.115,16).name='EVA spot housing';
    cylinder(head,m.metal,0,-.078,0,.108,.024,.108,16);
    const glass=cylinder(head,lens,0,-.092,0,.087,.009,.087,16);glass.name=`EVA spot lens ${index+1}`;
    glass.castShadow=false;glass.receiveShadow=false;
  }
  return root;
}

export function createEVAHatch(m,y,inner=false){
  const root=createPressureHatch({inner,materials:m});root.name=inner?'Inner airlock / sealed':'EVA airlock / sealed';
  root.position.set(inner?EVA_BAY.innerX:EVA_BAY.hatchX,y+PRESSURE_HATCH.centerY,EVA_BAY.depth);root.rotation.y=EVA_BAY.hatchYaw;
  return root;
}

export function createEVABay(m,y){
  const root=new THREE.Group();root.name='EVA preparation bay';const suits=[];
  for(const x of [7.25,10.88]){
    box(root,m.dark,x,y+1.36,-1.25,.085,2.66,.19,.015);
    box(root,m.metal,x,y+.19,-.70,.10,.16,1.14,.014);
  }
  rod(root,m.metal,[7.25,y+EVA_BAY.railY,-1.04],[10.88,y+EVA_BAY.railY,-1.04],.046);
  box(root,m.dark,9.05,y+.12,-.69,3.71,.12,1.25,.025);
  for(let i=0;i<25;i++)box(root,m.metal,7.34+i*.141,y+.186,-.68,.075,.013,1.06);
  EVA_BAY.suitX.forEach((x,index)=>{
    const suit=hangingSuit(m,index);suit.position.set(x,y+.35,EVA_BAY.suitZ);suit.rotation.y=(index-1)*.16;root.add(suit);suits.push(suit);
  });
  root.add(createEVASpotlights(m,y));
  const hatch=createEVAHatch(m,y),innerHatch=createEVAHatch(m,y,true);root.add(hatch,innerHatch);
  root.add(createEVAPartitions(m,y));
  const equipmentRack=createEquipmentRack(m,y);root.add(equipmentRack);
  return{root,suits,hatch,innerHatch,equipmentRack};
}

// Fixed pressure partitions belong to the ship, not the removable viewing wall.
// Their openings fit the complete pocket cassettes while the surrounding wall
// reaches the widened deck's front edge in every camera mode.
export function createEVAPartitions(m,y){
  const root=new THREE.Group();root.name='Permanent airlock partitions';
  const front=CABIN_AISLE.deckFront,back=-1.87;
  for(const x of [EVA_BAY.innerX,EVA_BAY.hatchX]){
    const top=x===EVA_BAY.innerX?3.396:3.242;
    const shape=new THREE.Shape();shape.moveTo(back,0);shape.lineTo(front,0);shape.lineTo(front,top);shape.lineTo(back,top);shape.closePath();
    const points=pressureCassetteOutline().map(([z,yy])=>[z+EVA_BAY.depth,yy+PRESSURE_HATCH.centerY]).reverse();
    const opening=new THREE.Path();opening.moveTo(...points[0]);for(const point of points.slice(1))opening.lineTo(...point);opening.closePath();shape.holes.push(opening);
    const bulkhead=new THREE.Mesh(new THREE.ExtrudeGeometry(shape,{depth:.20,bevelEnabled:false,steps:1}),m.enamel);
    bulkhead.name='Hatch bulkhead return';bulkhead.position.set(x+.155,y,0);bulkhead.rotation.y=-Math.PI/2;bulkhead.castShadow=bulkhead.receiveShadow=true;root.add(bulkhead);
  }
  return root;
}

export function animateAirlock(door,signal,opening){
  animatePressureHatch(door,opening);
  signal.color.setHex(opening>.01?0xf3bd62:0x85e3af);
}

export function animateHatchFault(signal,environment,{hatchId='innerHatch',opening=0}={}){
  signal.color.setHex(environment?.fault?.id===hatchId?0xff6254:opening>.01?0xf3bd62:0x85e3af);
}
