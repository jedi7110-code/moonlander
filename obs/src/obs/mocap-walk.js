import * as THREE from 'three';
import {hingeAngles} from './gym.js';
import {relaxMiloHand} from './milo-hands.js';
import miloWalkData from './milo-walk-cycle.json' with {type:'json'};
export {miloWalkData};

const down=new THREE.Vector3(0,-1,0),xAxis=new THREE.Vector3(1,0,0);
const hipPivot=new THREE.Vector3(0,.970,0),neckPivot=new THREE.Vector3(0,1.607,0);
const support=[[-.04,-.107,-.09],[.04,-.107,-.09],[-.055,-.107,.105],[.055,-.107,.105],[-.02,-.107,.175],[.02,-.107,.175]];

function soleSupport(boot){
  if(boot.userData.walkSoleSupport)return boot.userData.walkSoleSupport;
  const sole=boot.getObjectByName('Anatomical combat boot sole');
  if(!sole)return support;
  if(!sole.geometry.boundingBox)sole.geometry.computeBoundingBox();
  const {min,max}=sole.geometry.boundingBox;
  // The continuous treadless sole reaches beyond the old, separate tread
  // contacts at the toe and heel. Include those ends when the foot rolls.
  return boot.userData.walkSoleSupport=[min.x,max.x].flatMap(x=>[min.z,max.z].map(z=>[x,min.y,z]));
}

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

// `stride` scales how far the feet reach ahead of and behind the hips: a
// walk driven with stride s covers s cycle distances per cycle without the
// planted foot sliding (the stair trips shorten the step this way).
export function applyMocapWalk(root,data,time,stride=1){
  const p=sampleWalk(data,time);
  if(stride!==1)for(const prefix of ['Left','Right']){
    const ankle=p[prefix+'Foot'],knee=p[prefix+'Leg'],shift=(ankle.z-p.Hips.z)*(stride-1);
    ankle.z+=shift;p[prefix+'ToeBase'].z+=shift;knee.z+=(knee.z-p.Hips.z)*(stride-1);
  }
  applyMocapSample(root,data,p);
}

// Mean direction of each arm segment over the cycle (the swing is scaled about it).
const armMeans=new WeakMap();
function meanArms(data){
  if(armMeans.has(data))return armMeans.get(data);
  const result={};
  for(const prefix of ['Left','Right']){
    const upper=new THREE.Vector3(),lower=new THREE.Vector3(),at=(frame,name)=>new THREE.Vector3().fromArray(frame,data.names.indexOf(name)*3);
    for(const frame of data.frames){
      upper.add(at(frame,prefix+'ForeArm').sub(at(frame,prefix+'Arm')).normalize());
      lower.add(at(frame,prefix+'Hand').sub(at(frame,prefix+'ForeArm')).normalize());
    }
    result[prefix]={upper:upper.normalize(),lower:lower.normalize()};
  }
  result.hipHeight=data.frames.reduce((sum,frame)=>sum+frame[data.names.indexOf('Hips')*3+1],0)/data.frames.length;
  armMeans.set(data,result);return result;
}
const upright=new THREE.Quaternion(),standElbow=new THREE.Quaternion().setFromEuler(new THREE.Euler(-.08,0,0));

// Pose the figure from one sample of joint positions (root space).
//   walk  0..1: 0 is the standing pose (upright, arms at rest, feet flat), 1 the sample
//   sway  scales the rotation of pelvis and trunk away from upright
//   arms  scales the arm swing about its mean
//   lift  raises the hips (m); bob scales their rise and fall within a step
//   centre  sideways position of the walking line in the sample; sideSway scales the
//           hips' sway about it, aside shifts them (m); forward: the hips ahead of the root (m, with feet)
//   feet  {Left,Right}: {x,z} of the ankle in root space, `lift` 0..1 scaling its height over the
//         floor, `pitch` 0..1 scaling the roll of the foot (default: lift), `turnout` 0..1
//         scaling how far the toes point outward, `stride` the local scale of the step (for the knee),
//         `rest` 0..1 how far the leg is simply the standing leg (only where the foot stands at rest),
//         `ahead` how far the knee's aim is put forward of the measured one (m, default .30)
// Without options this is the plain mocap pose.
export function applyMocapSample(root,data,p,{walk=1,sway=1,arms:armSwing=1,lift=0,bob=1,centre=0,sideSway=1,aside=0,forward=0,feet=null}={}){
  const {body,chest,head,arms,legs}=root.userData,plain=walk===1&&sway===1;
  const pelvis=orientation(p.RightUpLeg.clone().sub(p.LeftUpLeg),p.Spine.clone().sub(p.Hips));
  const torso=orientation(p.RightArm.clone().sub(p.LeftArm),p.Neck.clone().sub(p.Hips));
  const skull=orientation(p.RightArm.clone().sub(p.LeftArm),p.Head.clone().sub(p.Neck));
  if(!plain){for(const q of [pelvis,torso])q.copy(upright.clone().slerp(q,walk*sway));skull.copy(upright.clone().slerp(skull,walk));}
  const inversePelvis=pelvis.clone().invert(),hip=p.Hips.clone();
  hip.y+=.107-data.ankleHeight+.006;
  if(feet){hip.x=(hip.x-centre)*sideSway;hip.z=forward;}
  if(bob!==1){const mean=meanArms(data).hipHeight+.107-data.ankleHeight+.006;hip.y=mean+(hip.y-mean)*bob;}
  if(walk!==1)hip.lerpVectors(hipPivot,hip,walk);
  hip.y+=lift;hip.x+=aside;
  body.quaternion.copy(pelvis);body.position.copy(hip).sub(hipPivot.clone().applyQuaternion(pelvis));
  chest.scale.set(1,1,1);chest.quaternion.copy(inversePelvis).multiply(torso);
  chest.position.copy(hipPivot).sub(hipPivot.clone().applyQuaternion(chest.quaternion));chest.updateMatrix();
  head.quaternion.copy(inversePelvis).multiply(skull);
  head.position.copy(neckPivot).applyMatrix4(chest.matrix).sub(new THREE.Vector3(0,-.030,.009).applyQuaternion(head.quaternion));
  for(const {arm,elbow,hand,side,fingers,thumb} of arms){
    const prefix=side<0?'Left':'Right';
    let upperDirection=p[prefix+'ForeArm'].clone().sub(p[prefix+'Arm']).normalize(),lowerDirection=p[prefix+'Hand'].clone().sub(p[prefix+'ForeArm']).normalize();
    if(armSwing!==1){const mean=meanArms(data)[prefix];upperDirection=mean.upper.clone().lerp(upperDirection,armSwing).normalize();lowerDirection=mean.lower.clone().lerp(lowerDirection,armSwing).normalize();}
    const upper=new THREE.Quaternion().setFromUnitVectors(down,upperDirection),lower=new THREE.Quaternion().setFromUnitVectors(down,lowerDirection);
    // Close the lateral opening in chest space without changing forward swing
    // or the elbow's relative bend. Apply the same correction to both segments.
    const direction=down.clone().applyQuaternion(upper).applyQuaternion(torso.clone().invert());
    const correction=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,0,1).applyQuaternion(torso),-.32*Math.atan2(direction.x,-direction.y));
    upper.premultiply(correction);lower.premultiply(correction);
    if(walk!==1){
      const rest=new THREE.Quaternion().setFromEuler(new THREE.Euler(-.05,0,side*.025,'XYZ')),restLower=rest.clone().multiply(standElbow);
      upper.copy(rest.slerp(upper,walk));lower.copy(restLower.slerp(lower,walk));
    }
    arm.position.set(side*.207,1.488,0).applyMatrix4(chest.matrix);
    arm.quaternion.copy(inversePelvis).multiply(upper);elbow.quaternion.copy(upper).invert().multiply(lower);
    hand.rotation.set(0,side*Math.PI/2,0);
    relaxMiloHand({fingers,thumb,side});
  }
  for(const {leg,knee,boot,side} of legs){
    const prefix=side<0?'Left':'Right',ankle=p[prefix+'Foot'],toe=p[prefix+'ToeBase'],placed=feet?.[prefix],raise=placed?placed.lift:1,roll=placed?placed.pitch??raise:1;
    const forward=toe.clone().sub(ankle);if(placed?.turnout!==undefined)forward.x*=placed.turnout;forward.normalize();
    const right=xAxis.clone().addScaledVector(forward,-forward.x).normalize();
    const foot=new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(right,new THREE.Vector3().crossVectors(forward,right),forward));
    // The BVH toe offset slopes downward even in a flat-footed rest pose.
    foot.multiply(new THREE.Quaternion().setFromAxisAngle(xAxis,Math.atan2(-1.39921,5.47975)));
    if(roll!==1)foot.copy(upright.clone().slerp(foot,roll));
    const bottom=Math.min(...soleSupport(boot).map(a=>new THREE.Vector3(...a).applyQuaternion(foot).y));
    const clearance=Math.max(0,Math.min(ankle.y-data.ankleHeight,toe.y-data.toeHeight)-.003)*raise;
    const target=ankle.clone();target.y=.006+clearance-bottom;
    if(placed){
      // Standing, the ankle is exactly where the straight leg puts it (a few millimetres of error
      // would bend the knee visibly): the standing rig's soles are 3 mm lower than the walk's.
      // `turnout` is also how far the footfall is a walking one.
      const rest=leg.position.clone().add(knee.position).add(boot.position);
      target.x=placed.x;target.z=placed.z+rest.z*(1-(placed.turnout??1));target.y-=.003*(1-walk);
    }
    target.sub(body.position).applyQuaternion(inversePelvis);
    const pole=p[prefix+'Leg'].clone();pole.y+=.107-data.ankleHeight+.006;
    if(placed){
      // the knee keeps its place relative to the hips; standing, it points straight ahead
      // (and well ahead of the leg, so that it never bends backward where the steps shrink to nothing)
      const offset=p[prefix+'Leg'].clone().sub(p.Hips);offset.z=offset.z*(placed.stride??1)+(placed.ahead??.30);
      pole.copy(hip).add(offset).lerp(new THREE.Vector3(side*.100,.535,.30),1-walk);
    }
    pole.sub(body.position).applyQuaternion(inversePelvis);
    solveLeg(leg,knee,boot,target,pole);
    if(placed?.rest>0){leg.quaternion.slerp(upright,placed.rest);knee.quaternion.slerp(upright,placed.rest);}
    boot.quaternion.copy(pelvis).multiply(leg.quaternion).multiply(knee.quaternion).invert().multiply(foot);
  }
  root.userData.updateWristTwists?.();
}
