import {Vector3,Quaternion,Matrix4,MathUtils} from 'three';
import {relaxMiloHand} from './milo-hands.js';

const v=(x,y,z)=>new Vector3(x,y,z);
const smooth=t=>MathUtils.smoothstep(t,0,1);
// Contact on the bowl's outside wall and on the spoon handle, not its tip.
export const MEAL_CONTACTS=[v(-.087,.028,-.040),v(0,.006,.120)];
export const MEAL_HAND_CONTACTS=[v(0,-.085,-.035),v(-.017,-.095,-.024)];

function solveArm(rig,wrist){
  const delta=wrist.clone().sub(rig.arm.position),distance=delta.length(),axis=delta.clone().normalize();
  const upper=-rig.elbow.position.y,lower=rig.hand.position.length();
  const along=MathUtils.clamp((upper*upper-lower*lower+distance*distance)/(2*distance),-upper,upper);
  const pole=v(rig.side*.65,-1,.08);pole.addScaledVector(axis,-pole.dot(axis)).normalize();
  const humerus=axis.clone().multiplyScalar(along).addScaledVector(pole,Math.sqrt(Math.max(0,upper*upper-along*along)));
  const forearm=delta.clone().sub(humerus);
  const x=forearm.clone().cross(humerus).normalize(),y=humerus.clone().normalize().negate(),z=x.clone().cross(y).normalize();
  return {upper:new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(x,y,z)),
    lower:new Quaternion().setFromAxisAngle(v(1,0,0),-Math.acos(MathUtils.clamp(humerus.dot(forearm)/(upper*lower),-1,1))+Math.atan2(rig.hand.position.z,-rig.hand.position.y)),forearm};
}

// Keep the hand along the forearm. Solve the wrist from the actual palm/finger
// contact, so correcting its angle cannot detach it from the dish.
export function mealGripPose(rig,prop,index){
  const contact=MEAL_CONTACTS[index].clone().applyQuaternion(prop.quaternion).add(prop.position);
  const handContact=MEAL_HAND_CONTACTS[index].clone().multiply(rig.hand.scale);
  const palmNormal=v(index===0?1:-1,0,0);
  const wrist=contact.clone().add(v(rig.side*.025,-.025,-.085));
  let rotation,arm;
  for(let step=0;step<40;step++){
    arm=solveArm(rig,wrist);
    const y=arm.forearm.clone().normalize().negate(),z=palmNormal.clone().negate();
    z.addScaledVector(y,-z.dot(y)).normalize();const x=y.clone().cross(z).normalize();
    rotation=new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(x,y,z));
    const next=contact.clone().sub(handContact.clone().applyQuaternion(rotation));
    if(wrist.distanceToSquared(next)<1e-20){wrist.copy(next);break;}
    wrist.lerp(next,.65);
  }
  return {position:wrist,rotation,contact};
}

export function reachMeal(root,index,prop,reach){
  const rig=root.userData.arms[index],{arm,elbow,hand,fingers,thumb}=rig;
  relaxMiloHand(rig);if(reach===0)return;
  root.updateWorldMatrix(true,true);
  const rest=root.userData.body.worldToLocal(hand.getWorldPosition(new Vector3()));
  const upper=arm.quaternion.clone(),lower=elbow.quaternion.clone(),neutral=hand.quaternion.clone();
  const grip=mealGripPose(rig,prop,index),contactArm=solveArm(rig,grip.position);
  const wrist=contactArm.upper.clone().multiply(contactArm.lower).invert().multiply(grip.rotation);
  const retreat=index===0?.18:Math.min(.18,Math.max(0,grip.position.z-rest.z)*.45);
  const target=rest.lerp(grip.position,reach),arc=Math.sin(Math.PI*reach);
  target.y+=.24*arc;target.z-=retreat*arc;
  const pose=solveArm(rig,target);
  arm.quaternion.copy(upper.slerp(pose.upper,reach));elbow.quaternion.copy(lower.slerp(pose.lower,reach));
  hand.quaternion.copy(neutral).slerp(wrist,smooth((reach-.35)/.65));
  const close=smooth((reach-.68)/.32);
  for(const [i,finger]of fingers.entries()){
    const rank=rig.side<0?3-i:i;
    const curl=index===0?[.36,.55,.30]:rank===0?[.40,.75,.40]:rank===1?[.70,1.35,.90]:[1.0,1.50,.85];
    finger.rotation.x=MathUtils.lerp(finger.rotation.x,curl[0],close);
    finger.userData.links.forEach((link,j)=>link.rotation.x=MathUtils.lerp(link.rotation.x,curl[j+1],close));
  }
  thumb.rotation.set(MathUtils.lerp(.16,index===0?.12:-.15,close),0,rig.side*MathUtils.lerp(.10,index===0?.20:.30,close));
  thumb.userData.ip.rotation.x=MathUtils.lerp(.28,.20,close);
}
