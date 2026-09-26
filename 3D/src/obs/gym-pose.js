import {Vector3,Quaternion,MathUtils} from 'three';

export const BIKE={seat:.95,bodyLift:.10,depth:.30,crankY:.43,crankZ:.32,radius:.155,cadence:4.2,gripY:1.35,gripZ:.55};
// Anatomical left when the rider faces +Z (the legacy skin labels are reversed).
export const GYM_LEFT_SIDE=1;
export const GYM_TRANSFER_SECONDS=5;
export const GYM_POSE_END=9.4;
const smooth=(t,a,b)=>{const u=MathUtils.clamp((t-a)/(b-a),0,1);return u*u*u*(u*(u*6-15)+10);};
const lerp=MathUtils.lerp;

export function pedalPosition(time,side){
  const phase=-time*BIKE.cadence+(side<0?Math.PI:0);
  return{x:side*.14,y:BIKE.crankY+Math.sin(phase)*BIKE.radius,z:BIKE.crankZ+Math.cos(phase)*BIKE.radius,phase};
}
export function cyclingFootPosition(time,side){
  const p=pedalPosition(time,side);
  // Stand slightly outward on the left platform to clear the flywheel cover.
  return new Vector3(p.x+(side===GYM_LEFT_SIDE?.04:0),p.y+.1245,p.z-.024);
}
export function hingeAngles(y,z,upper,lower,bend=1){
  const distance=MathUtils.clamp(Math.hypot(y,z),Math.abs(upper-lower)+1e-6,upper+lower-1e-6);
  const bearing=Math.atan2(-z,-y);
  const alpha=Math.acos(MathUtils.clamp((upper*upper+distance*distance-lower*lower)/(2*upper*distance),-1,1));
  const beta=Math.PI-Math.acos(MathUtils.clamp((upper*upper+lower*lower-distance*distance)/(2*upper*lower),-1,1));
  return{upper:bearing-bend*alpha,lower:bend*beta};
}
export function armHingeAngles({arm,elbow,hand},target){
  const offset=target.clone().sub(arm.position),upper=elbow.position.length(),lower=Math.hypot(hand.position.y,hand.position.z);
  const reach=upper+lower-1e-5,distance=offset.length();
  if(distance>reach){arm.position.addScaledVector(offset,(distance-reach)/distance);offset.subVectors(target,arm.position);}
  const angles=hingeAngles(offset.y,Math.hypot(offset.x,offset.z),upper,lower,-1);
  const hinge=Math.atan2(-elbow.position.z,-elbow.position.y);
  return {...angles,upper:angles.upper-hinge,lower:angles.lower+Math.atan2(hand.position.z,-hand.position.y)+hinge,yaw:Math.atan2(offset.x,offset.z)};
}

// Approved study trajectory in bike-local coordinates. Reversing it returns
// the right foot to the floor before the left foot leaves its platform.
export function sampleGymTransfer(time,pedalTime=0){
  const lift=smooth(time,1,2.8),cross=smooth(time,2.8,4.2),lower=smooth(time,4.2,5.8);
  const leftPedal=cyclingFootPosition(pedalTime,GYM_LEFT_SIDE),rightPedal=cyclingFootPosition(pedalTime,-GYM_LEFT_SIDE);
  // Tuck the boot behind the handlebar uprights, above the wheel, toe included.
  const left=new Vector3(lerp(-.32,leftPedal.x,cross),lerp(lerp(.107,.86,lift),leftPedal.y,lower),lerp(lerp(.173,.48,lift),leftPedal.z,lower));
  const rightLift=smooth(time,6,7.3),rightStep=smooth(time,7.3,8.2),rightLower=smooth(time,8.2,8.8),seat=smooth(time,6,9.4);
  const right=new Vector3(lerp(-.52,rightPedal.x,rightStep),lerp(lerp(.107,.70,rightLift),rightPedal.y,rightLower),lerp(lerp(.173,.38,rightLift),rightPedal.z,rightLower));
  return {left,right,seat,rise:smooth(time,6,8.1),settle:smooth(time,8.1,9.4),grip:smooth(time,0,1),leftGrip:smooth(time,1,5.8),lean:smooth(time,1,4.2),
    stage:time<1?'ハンドルで支える':time<2.8?'左足を持ち上げる':time<4.2?'左足で車輪の上をまたぐ':time<5.8?'左足を先にステップへ載せる':time<6?'左足で支える':time<8.8?'腰をサドルへ移しながら右足も載せる':time<9.4?'サドルへ腰を下ろす':'着席・両足をステップに置いて保持'};
}

// animateMilo resets the rig before this runs. The root is the bike origin;
// keep all contacts in that frame so no wrist or foot jumps at cycle boundaries.
export function applyGymTransferPose(root,time,pedalTime=0){
  const sample=sampleGymTransfer(time,pedalTime),entry=sample.grip;
  const {body,chest,head,arms,legs}=root.userData;
  const idleHead=head.quaternion.clone();
  body.position.set(lerp(-.48,-.42+lerp(.10*sample.lean,.42,sample.seat),entry),
    -.022*sample.lean+.182*sample.rise-.06*sample.settle,.16*(1-sample.seat)*entry);
  const pivot=new Vector3(0,1.08,0),forward=lerp(.06*sample.lean,.14,sample.seat),sideLean=-.12*sample.lean*(1-sample.seat);
  chest.rotation.set(forward,0,sideLean);
  chest.position.copy(pivot).sub(pivot.clone().applyQuaternion(chest.quaternion));chest.updateMatrix();
  head.position.set(0,1.637,-.009).applyMatrix4(chest.matrix);
  head.rotation.set(.07+forward,0,sideLean);head.quaternion.copy(idleHead.slerp(head.quaternion,entry));
  for(const {arm,side}of arms)arm.position.set(side*.207,1.488,0).applyMatrix4(chest.matrix);
  for(const {leg,knee,boot,side}of legs){
    const target=new Vector3(-.48+side*.100,.107,.013).lerp(side===GYM_LEFT_SIDE?sample.left:sample.right,entry);
    target.sub(body.position).sub(leg.position);
    const yaw=Math.atan2(target.x,target.z),a=hingeAngles(target.y,Math.hypot(target.x,target.z),knee.position.length(),boot.position.length());
    leg.rotation.set(a.upper,yaw,0,'YXZ');knee.rotation.set(a.lower+Math.atan2(.013,.425),0,0);
    if(side!==GYM_LEFT_SIDE&&time>6){
      // Lead with the right thigh forwards, not a sideways knee/ankle lift.
      const upper=knee.position.length(),lower=boot.position.length(),distance=target.length(),axis=target.clone().normalize();
      const pole=knee.position.clone().applyQuaternion(leg.quaternion);
      pole.addScaledVector(axis,-pole.dot(axis)).normalize();
      const forward=new Vector3(0,0,1);forward.addScaledVector(axis,-forward.dot(axis)).normalize();
      pole.lerp(forward,smooth(time,6,6.6)).normalize();
      const angle=Math.acos(MathUtils.clamp((upper*upper+distance*distance-lower*lower)/(2*upper*distance),-1,1));
      const joint=axis.clone().multiplyScalar(upper*Math.cos(angle)).addScaledVector(pole,upper*Math.sin(angle));
      leg.quaternion.setFromUnitVectors(knee.position.clone().normalize(),joint.clone().normalize());
      const lowerRotation=new Quaternion().setFromUnitVectors(boot.position.clone().normalize(),target.clone().sub(joint).normalize());
      knee.quaternion.copy(leg.quaternion).invert().multiply(lowerRotation);
    }
    boot.quaternion.copy(leg.quaternion).multiply(knee.quaternion).invert();
  }
  root.updateMatrixWorld(true);
  for(const rig of arms){
    const {arm,elbow,hand,side}=rig,left=side===GYM_LEFT_SIDE,blend=left?sample.leftGrip:sample.grip;
    if(blend===0)continue;
    const idle=body.worldToLocal(hand.getWorldPosition(new Vector3()));
    const palm=arm.quaternion.clone().multiply(elbow.quaternion).multiply(hand.quaternion);
    const grip=new Vector3(left?.14:-.29,BIKE.gripY-.007*hand.scale.z,BIKE.gripZ-.045*hand.scale.y).sub(body.position);
    const target=idle.lerp(grip,blend),angles=armHingeAngles(rig,target);
    arm.rotation.set(angles.upper,angles.yaw,0,'YXZ');elbow.rotation.set(angles.lower,0,0);
    palm.slerp(new Quaternion().setFromAxisAngle(new Vector3(1,0,0),-Math.PI/2),blend);
    hand.quaternion.copy(arm.quaternion).multiply(elbow.quaternion).invert().multiply(palm);
    for(const finger of rig.fingers){finger.rotation.x=.6*blend;for(const link of finger.userData.links)link.rotation.x=1.05*blend;}
  }
}
export function applyCyclingPose(root,pedalTime){
  root.rotation.y=Math.PI/2;applyGymTransferPose(root,GYM_POSE_END,pedalTime);
}
export function applyGymVisitPose(root,visit){
  const pose=visit.pose;
  visit.startYaw??=root.rotation.y;
  const delta=Math.atan2(Math.sin(Math.PI/2-visit.startYaw),Math.cos(Math.PI/2-visit.startYaw));
  root.rotation.y=visit.startYaw+delta*pose.turn;
  if(pose.turn<1)return;
  applyGymTransferPose(root,pose.transferTime,pose.pedalTime);
}
