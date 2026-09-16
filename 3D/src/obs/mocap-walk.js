import * as THREE from 'three';
import {hingeAngles} from './gym.js';
import {relaxMiloHand} from './milo-hands.js';
import miloWalkData from './milo-walk-cycle.json' with {type:'json'};
export {miloWalkData};

const down=new THREE.Vector3(0,-1,0),xAxis=new THREE.Vector3(1,0,0);
const hipPivot=new THREE.Vector3(0,.970,0),neckPivot=new THREE.Vector3(0,1.607,0);
const support=[[-.04,-.107,-.09],[.04,-.107,-.09],[-.055,-.107,.105],[.055,-.107,.105],[-.02,-.107,.175],[.02,-.107,.175]];

// Periodic cubic interpolation preserves velocity through the loop boundary.
export function sampleWalk(data,time){
  const phase=((time/data.duration)%1+1)%1*data.count,index=Math.floor(phase),t=phase-index;
  const frames=[-1,0,1,2].map(offset=>data.frames[(index+offset+data.count)%data.count]);
  const out={};
  for(let j=0;j<data.names.length;j++){
    const xyz=[0,1,2].map(axis=>{
      const [a,b,c,d]=frames.map(f=>f[j*3+axis]);
      return .5*((2*b)+(-a+c)*t+(2*a-5*b+4*c-d)*t*t+(-a+3*b-3*c+d)*t*t*t);
    });
    out[data.names[j]]=new THREE.Vector3(...xyz);
  }
  return out;
}
function orientation(across,vertical){
  const y=vertical.clone().normalize(),x=across.clone().addScaledVector(y,-across.dot(y)).normalize(),z=new THREE.Vector3().crossVectors(x,y);
  return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x,y,z));
}
function limbOrientation(a,b){return new THREE.Quaternion().setFromUnitVectors(down,b.clone().sub(a).normalize());}
function solveLeg(leg,knee,boot,target,pole){
  const d=target.clone().sub(leg.position),length=d.length(),axis=d.clone().normalize();
  const upper=knee.position.length(),lower=boot.position.length(),angle=-hingeAngles(-length,0,upper,lower).upper;
  const bend=pole.clone().sub(leg.position);bend.addScaledVector(axis,-bend.dot(axis)).normalize();
  const joint=leg.position.clone().addScaledVector(axis,Math.cos(angle)*upper).addScaledVector(bend,Math.sin(angle)*upper);
  leg.quaternion.setFromUnitVectors(knee.position.clone().normalize(),joint.clone().sub(leg.position).normalize());
  const lowerWorld=new THREE.Quaternion().setFromUnitVectors(boot.position.clone().normalize(),target.clone().sub(joint).normalize());
  knee.quaternion.copy(leg.quaternion).invert().multiply(lowerWorld);
}

export function applyMocapWalk(root,data,time){
  const p=sampleWalk(data,time),{body,chest,head,arms,legs}=root.userData;
  const pelvis=orientation(p.RightUpLeg.clone().sub(p.LeftUpLeg),p.Spine.clone().sub(p.Hips));
  const torso=orientation(p.RightArm.clone().sub(p.LeftArm),p.Neck.clone().sub(p.Hips));
  const inversePelvis=pelvis.clone().invert(),hip=p.Hips.clone();
  hip.y+=.107-data.ankleHeight+.006;
  body.quaternion.copy(pelvis);body.position.copy(hip).sub(hipPivot.clone().applyQuaternion(pelvis));
  chest.scale.set(1,1,1);chest.quaternion.copy(inversePelvis).multiply(torso);
  chest.position.copy(hipPivot).sub(hipPivot.clone().applyQuaternion(chest.quaternion));chest.updateMatrix();
  head.quaternion.copy(inversePelvis).multiply(orientation(p.RightArm.clone().sub(p.LeftArm),p.Head.clone().sub(p.Neck)));
  head.position.copy(neckPivot).applyMatrix4(chest.matrix).sub(new THREE.Vector3(0,-.030,.009).applyQuaternion(head.quaternion));
  for(const {arm,elbow,hand,side,fingers,thumb} of arms){
    const prefix=side<0?'Left':'Right',upper=limbOrientation(p[prefix+'Arm'],p[prefix+'ForeArm']),lower=limbOrientation(p[prefix+'ForeArm'],p[prefix+'Hand']);
    // Close the lateral opening in chest space without changing forward swing
    // or the elbow's relative bend. Apply the same correction to both segments.
    const direction=down.clone().applyQuaternion(upper).applyQuaternion(torso.clone().invert());
    const correction=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,0,1).applyQuaternion(torso),-.32*Math.atan2(direction.x,-direction.y));
    upper.premultiply(correction);lower.premultiply(correction);
    arm.position.set(side*.207,1.488,0).applyMatrix4(chest.matrix);
    arm.quaternion.copy(inversePelvis).multiply(upper);elbow.quaternion.copy(upper).invert().multiply(lower);
    hand.rotation.set(0,side*Math.PI/2,0);
    relaxMiloHand({fingers,thumb,side});
  }
  for(const {leg,knee,boot,side} of legs){
    const prefix=side<0?'Left':'Right',ankle=p[prefix+'Foot'],toe=p[prefix+'ToeBase'];
    const forward=toe.clone().sub(ankle).normalize(),right=xAxis.clone().addScaledVector(forward,-forward.x).normalize();
    const foot=new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(right,new THREE.Vector3().crossVectors(forward,right),forward));
    // The BVH toe offset slopes downward even in a flat-footed rest pose.
    foot.multiply(new THREE.Quaternion().setFromAxisAngle(xAxis,Math.atan2(-1.39921,5.47975)));
    const bottom=Math.min(...support.map(a=>new THREE.Vector3(...a).applyQuaternion(foot).y));
    const clearance=Math.max(0,Math.min(ankle.y-data.ankleHeight,toe.y-data.toeHeight)-.003);
    const target=ankle.clone();target.y=.006+clearance-bottom;
    target.sub(body.position).applyQuaternion(inversePelvis);
    const pole=p[prefix+'Leg'].clone();pole.y+=.107-data.ankleHeight+.006;pole.sub(body.position).applyQuaternion(inversePelvis);
    solveLeg(leg,knee,boot,target,pole);
    boot.quaternion.copy(pelvis).multiply(leg.quaternion).multiply(knee.quaternion).invert().multiply(foot);
  }
  root.userData.updateWristTwists?.();
}
