import * as THREE from 'three';
import {LOUNGE_ASHTRAY} from './layout.js';
import {whiteCeramic} from './cabin-fixtures.js';

// A shallow moulded ceramic dish, with three cigarette rests on either side.
export function createLoungeAshtray(){
  const root=new THREE.Group();root.name='Lounge / ochre ceramic ashtray';
  root.scale.setScalar(LOUNGE_ASHTRAY.scale);
  const ceramic=whiteCeramic.clone();ceramic.name='Lounge / glazed ochre ceramic';
  ceramic.color.setHex(0x80683b);ceramic.roughness=.72;ceramic.clearcoat=.06;
  ceramic.envMapIntensity=.45;ceramic.specularIntensity=.45;
  const part=(geometry,name,x=0,y=0,z=0)=>{
    const mesh=new THREE.Mesh(geometry,ceramic);mesh.name=name;mesh.position.set(x,y,z);
    mesh.castShadow=mesh.receiveShadow=true;root.add(mesh);return mesh;
  };
  const profile=[[0,0],[.077,0],[.101,.004],[.108,.010],[.108,.016],[.104,.022],[.093,.027],[.082,.028],[.074,.024],[.068,.014],[.063,.009],[0,.009]];
  part(new THREE.LatheGeometry(profile.map(([r,y])=>new THREE.Vector2(r,y)),48),'Ashtray / recessed circular dish');
  // Groove floors are part of the wing surface, rather than rods stuck on top.
  const shape=new THREE.Shape();shape.moveTo(-.034,.009);shape.lineTo(.034,.009);shape.lineTo(.034,.025);
  for(let i=64;i>=0;i--){
    const z=-.034+i/64*.068;
    const d=Math.min(...[-.021,0,.021].map(center=>Math.abs(z-center)));
    const groove=d<.006?Math.sqrt(.006*.006-d*d):0;
    shape.lineTo(z,.025-groove);
  }
  shape.closePath();
  const wing=new THREE.ExtrudeGeometry(shape,{depth:.049,steps:1,bevelEnabled:true,bevelSize:.0015,bevelThickness:.0015,bevelSegments:2,curveSegments:1});
  wing.rotateY(Math.PI/2);
  for(const side of [-1,1]){
    const mesh=part(wing.clone(),`Ashtray / triple grooved rest ${side}`,side*.078);
    if(side<0)mesh.rotation.y=Math.PI;
  }
  wing.dispose();
  for(const x of [-.015,-.005,.005,.015]){
    const ridge=part(new THREE.CapsuleGeometry(.0018,.037,3,8),'Ashtray / moulded floor rib',x,.0098,0);ridge.rotation.x=Math.PI/2;
  }
  root.position.set(LOUNGE_ASHTRAY.x,LOUNGE_ASHTRAY.y,LOUNGE_ASHTRAY.z);
  return root;
}
