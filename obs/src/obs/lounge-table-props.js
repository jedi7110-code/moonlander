import {Group,Mesh,LatheGeometry,Vector2,TorusGeometry,CircleGeometry,MeshPhysicalMaterial,Box3} from 'three';
import {whiteCeramic} from './cabin-fixtures.js';
import {createLeisureProps} from './leisure.js';
import {loungePropHome} from './lounge-handling.js';
import {updateCatTeaser} from './cat-teaser.js';
import {LOUNGE_TABLE} from './layout.js';
import {printMugLogo} from './cup-print.js';

export function createLoungeCoffee(m={},{filled=true}={}){
  const root=new Group();root.name='Lounge coffee mug';
  // One physical size for the table, vending machine and standalone study.
  root.scale.setScalar(1.18);
  const profile=[[0,0],[.033,0],[.041,.010],[.047,.120],[.045,.132],[.039,.132],[.038,.120],[.032,.012],[0,.012]];
  const cup=new Mesh(new LatheGeometry(profile.map(p=>new Vector2(...p)),48),whiteCeramic);
  cup.name='Table cup';cup.castShadow=cup.receiveShadow=true;root.add(cup);
  printMugLogo(cup,m.taraironLogo?.map);
  const handle=new Mesh(new TorusGeometry(.033,.007,12,40),whiteCeramic);
  handle.name='Table cup handle';handle.position.set(.065,.067,0);handle.scale.y=1.18;
  handle.castShadow=handle.receiveShadow=true;root.add(handle);
  if(filled){
    const coffee=new MeshPhysicalMaterial({name:'Lounge / dark coffee',color:0x231007,roughness:.17,metalness:0,ior:1.33,clearcoat:.5,clearcoatRoughness:.10,envMapIntensity:.55});
    const surface=new Mesh(new CircleGeometry(.0373,48),coffee);
    surface.name='Table coffee surface';surface.rotation.x=-Math.PI/2;surface.position.y=.106;surface.receiveShadow=true;root.add(surface);
    const meniscus=new Mesh(new TorusGeometry(.0373,.001,6,48),coffee);
    meniscus.name='Coffee meniscus';meniscus.rotation.x=Math.PI/2;meniscus.position.y=.106;root.add(meniscus);
  }
  return root;
}

export function createTableLeisureProps(table,m,top){
  const {tablet,phones,toy}=createLeisureProps(table,m);
  tablet.name='Table pad terminal';phones.name='Table headphones';toy.name='Table cat teaser';
  const place=(prop,x,z)=>{
    prop.visible=true;prop.position.set(x,0,z);prop.updateWorldMatrix(true,true);
    prop.position.y=top-new Box3().setFromObject(prop).min.y;
  };
  tablet.rotation.y=-.10;place(tablet,-.07,.01);
  phones.rotation.set(Math.PI/2,.16,0,'YXZ');place(phones,.44,0);
  place(toy,-.55,.24);
  toy.userData.tableSupport={minX:-LOUNGE_TABLE.width/2-toy.position.x,maxX:LOUNGE_TABLE.width/2-toy.position.x,
    minZ:-LOUNGE_TABLE.depth/2-toy.position.z,maxZ:LOUNGE_TABLE.depth/2-toy.position.z};
  return{tablet,phones,toy};
}

export function updateTableLeisureProps(tableProps,heldProps){
  for(const key of ['tablet','phones','toy']){
    const prop=tableProps[key],held=heldProps[key],home=loungePropHome(prop);
    if(key==='tablet'){
      if(held.visible&&!prop.userData.padWasHeld)prop.userData.nextPadPage?.();
      prop.userData.padWasHeld=held.visible;
    }
    prop.parent.updateWorldMatrix(true,false);held.updateWorldMatrix(true,false);
    prop.position.copy(prop.parent.worldToLocal(held.visible?held.getWorldPosition(home.position.clone()):home.position.clone()));
    prop.quaternion.copy(prop.parent.getWorldQuaternion(home.quaternion.clone()).invert()).multiply(held.visible?held.getWorldQuaternion(home.quaternion.clone()):home.quaternion);
    prop.visible=true;held.visible=false;
    if(key==='toy')updateCatTeaser(prop,home);
  }
}
