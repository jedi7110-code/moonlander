import * as THREE from 'three';
import {box,ball,batchStatic} from './materials.js';
import {solveArm} from './meal-pose.js';
import {applyWalkingPose} from './walking.js';

export const HARVEST_DOCK=new THREE.Vector3(-10.0,1.043,-.10);
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
  const contents=batchStatic(tray);tray.clear();tray.add(contents);
  function update(milo,brain){
    const delivery=brain.harvestDelivery,{body,arms,chest,head}=milo.userData;
    tray.visible=Boolean(delivery||brain.kitchenGreens);
    if(!tray.visible)return;
    if(!delivery){tray.position.copy(HARVEST_DOCK);tray.quaternion.identity();return;}
    const placing=delivery.phase==='placing',pickup=delivery.phase==='pickup';
    // Let the normal planted-foot turn face the counter before reaching for it.
    const age=placing?Math.max(0,delivery.age-1.6):delivery.age;
    if(placing){
      const step=smooth(0,.8,age)*(1-smooth(2.8,3.6,age));
      milo.position.z=.78-.35*step;
      if(step>0&&step<1)applyWalkingPose(milo,.35*step);
      const lean=.26*smooth(.5,1.4,age)*(1-smooth(2.6,3.5,age));
      chest.rotation.x=lean;const pivot=v(0,1.08,0);
      chest.position.copy(pivot).sub(pivot.clone().applyQuaternion(chest.quaternion));chest.updateMatrix();
      for(const rig of arms)rig.arm.position.set(rig.side*.207,1.488,0).applyMatrix4(chest.matrix);
      head.position.set(0,1.637,-.009).applyMatrix4(chest.matrix);head.rotation.x+=lean*.6;
    }
    // Holding height follows the torso; the final approach lands on the counter.
    body.updateWorldMatrix(true,true);
    const carried=body.localToWorld(v(0,1.13,.40)),rotation=body.getWorldQuaternion(new THREE.Quaternion());
    const deposit=placing?smooth(.65,2.5,age):0;
    tray.position.copy(carried).lerp(HARVEST_DOCK,deposit);
    tray.quaternion.copy(rotation).slerp(new THREE.Quaternion().setFromAxisAngle(v(0,1,0),Math.PI),deposit);
    const grip=(pickup?smooth(0,.85,age):1)*(placing?1-smooth(2.5,3.5,age):1);
    tray.visible=!pickup||age>=.75;
    for(const rig of arms){
      const {arm,elbow,hand,fingers,thumb,side}=rig;
      const restWrist=body.worldToLocal(hand.getWorldPosition(v()));
      const restRotation=body.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(hand.getWorldQuaternion(new THREE.Quaternion()));
      const point=tray.localToWorld(v(side*.219,.060,0));
      const contact=body.worldToLocal(point);
      const y=v(0,.22,-.975).normalize(),z=v(side,0,0),x=y.clone().cross(z);
      const q=new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x,y,z));
      const wrist=restWrist.lerp(contact.sub(v(0,-.085,0).multiply(hand.scale).applyQuaternion(q)),grip),pose=solveArm(rig,wrist);
      arm.quaternion.copy(pose.upper);elbow.quaternion.copy(pose.lower);
      hand.quaternion.copy(pose.upper).multiply(pose.lower).invert().multiply(restRotation.slerp(q,grip));
      for(const finger of fingers){finger.rotation.x=.38*grip;finger.userData.links[0].rotation.x=.72*grip;finger.userData.links[1].rotation.x=.42*grip;}
      thumb.rotation.z=side*.24*grip;
    }
    milo.userData.updateWristTwists?.();milo.updateMatrixWorld(true);
  }
  return{root:tray,update};
}
