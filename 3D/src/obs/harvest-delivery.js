import * as THREE from 'three';
import {box,ball} from './materials.js';
import {placeHand} from './dining.js';

export const HARVEST_DOCK=new THREE.Vector3(-10.0,1.043,-.22);
const smooth=(a,b,t)=>THREE.MathUtils.smoothstep(t,a,b),v=(...a)=>new THREE.Vector3(...a);

export function createHarvestDelivery(m,scene){
  const tray=new THREE.Group();tray.name='Milo harvested greens';scene.add(tray);tray.visible=false;
  const plastic=new THREE.MeshStandardMaterial({name:'Harvest / dull produce tray',color:0x424d42,roughness:.94});
  box(tray,plastic,0,.015,0,.44,.030,.30,.012);
  for(const x of [-.212,.212])box(tray,plastic,x,.050,0,.016,.065,.30,.006);
  for(const z of [-.142,.142])box(tray,plastic,0,.050,z,.41,.065,.016,.006);
  const greens=[0x597c32,0x749744,0x415f2b].map(color=>new THREE.MeshStandardMaterial({color,roughness:.95}));
  for(let i=0;i<5;i++){
    const plant=new THREE.Group();plant.position.set((i%3-1)*.105,.04,(Math.floor(i/3)-.5)*.11);tray.add(plant);
    for(let j=0;j<5;j++){
      const a=j*2.399,leaf=ball(plant,greens[i%3],Math.cos(a)*.025,.041,Math.sin(a)*.025,.030,.072,.012);
      leaf.rotation.set(Math.cos(a)*.55,a,Math.sin(a)*.55);
    }
  }
  function update(milo,brain){
    const delivery=brain.harvestDelivery,{body,arms}=milo.userData;
    tray.visible=Boolean(delivery||brain.kitchenGreens);
    if(!tray.visible)return;
    if(!delivery){tray.position.copy(HARVEST_DOCK);tray.quaternion.identity();return;}
    const age=delivery.age,placing=delivery.phase==='placing',pickup=delivery.phase==='pickup';
    // Holding height follows the torso; the final approach lands on the counter.
    body.updateWorldMatrix(true,true);
    const carried=body.localToWorld(v(0,1.03,.40)),rotation=body.getWorldQuaternion(new THREE.Quaternion());
    const deposit=placing?smooth(.65,2.5,age):0;
    tray.position.copy(carried).lerp(HARVEST_DOCK,deposit);
    tray.quaternion.copy(rotation).slerp(new THREE.Quaternion().setFromAxisAngle(v(0,1,0),Math.PI),deposit);
    const grip=(pickup?smooth(0,.85,age):1)*(placing?1-smooth(2.5,3.5,age):1);
    tray.visible=!pickup||age>=.75;
    for(const rig of arms){
      const {arm,elbow,hand,fingers,thumb,side}=rig;
      const before=[arm.quaternion.clone(),elbow.quaternion.clone(),hand.quaternion.clone()];
      const point=tray.localToWorld(v(side*.219,.060,0));
      const contact=body.worldToLocal(point);
      const y=v(0,.22,-.975).normalize(),z=v(-side,0,0),x=y.clone().cross(z);
      const q=new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x,y,z));
      const wrist=contact.sub(v(0,-.085,0).multiply(hand.scale).applyQuaternion(q));
      placeHand(rig,wrist,q,0);
      [arm,elbow,hand].forEach((joint,i)=>joint.quaternion.slerp(before[i],1-grip));
      for(const finger of fingers){finger.rotation.x=.38*grip;finger.userData.links[0].rotation.x=.72*grip;finger.userData.links[1].rotation.x=.42*grip;}
      thumb.rotation.z=side*.24*grip;
    }
    milo.userData.updateWristTwists?.();milo.updateMatrixWorld(true);
  }
  return{root:tray,update};
}
