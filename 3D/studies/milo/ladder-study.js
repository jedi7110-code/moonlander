import * as THREE from 'three';
import {setLadderHandFit,fitLadderGripContact,fitLadderWatch} from './ladder-hand-fit.js';

// Study only: the cabin keeps its current animation until this is approved.
export const LADDER={spacing:.28,width:.72,depth:.30,radius:.028,duration:4};
const smooth=t=>{t=THREE.MathUtils.clamp(t,0,1);return t*t*t*(10+t*(-15+6*t));};
// Establish the higher foot support before reaching with the opposite hand.
// Reaching first forces a long split stance and excessive knee abduction.
const limbs=[
  {id:'leftHand',label:'左手',side:-1,hand:true,offset:.25,base:1.40},
  {id:'rightFoot',label:'右足',side:1,hand:false,offset:0,base:0},
  {id:'rightHand',label:'右手',side:1,hand:true,offset:.75,base:1.68},
  {id:'leftFoot',label:'左足',side:-1,hand:false,offset:.5,base:.28},
];

// Locate the bar inside the finger curl, then derive the wrist from that grip.
const GRIP_ROTATION=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),-2.8);
export const LADDER_WRIST_OFFSET=new THREE.Vector3(0,-.0675,-.0355).applyQuaternion(GRIP_ROTATION).negate();
const FINGER_GRIP=[[.675,.05,.535],[.89,.335,.445],[.99,.055,.26],[.575,.05,.05]];
function poseGrip(rig,grip){
  for(const [i,finger]of rig.fingers.entries()){
    const angles=FINGER_GRIP[rig.side<0?3-i:i];
    finger.rotation.set(angles[0]*grip,0,0);finger.userData.links[0].rotation.set(angles[1]*grip,0,0);finger.userData.links[1].rotation.set(angles[2]*grip,0,0);
  }
  rig.thumb.rotation.set(.85*grip,0,-rig.side*.10);rig.thumb.userData.ip.rotation.set(0,0,0);
}

function placeLadderHand(rig,target,inverseBody){
  const {arm,elbow,hand}=rig;
  const delta=target.clone().sub(arm.position),distance=delta.length(),axis=delta.clone().normalize();
  const upper=-elbow.position.y,lower=hand.position.length();
  const along=(upper*upper-lower*lower+distance*distance)/(2*distance);
  const bend=Math.sqrt(Math.max(0,upper*upper-along*along));
  // Keep the elbow in a nearly sagittal plane, close to its own shoulder width.
  // A fixed downward pole stays continuous when the hand passes overhead.
  // A target-derived yaw flips by 180 degrees as the wrist crosses the shoulder.
  const tuck=.10;
  const pole=new THREE.Vector3(-rig.side*tuck,-1,-.25).applyQuaternion(inverseBody);
  pole.addScaledVector(axis,-pole.dot(axis)).normalize();
  const humerus=axis.clone().multiplyScalar(along).addScaledVector(pole,bend);
  const forearm=delta.clone().sub(humerus);
  const x=forearm.clone().cross(humerus).normalize(),y=humerus.clone().normalize().negate();
  const z=x.clone().cross(y).normalize();
  arm.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x,y,z));
  // One hinge at the elbow: no yaw or roll in the lower arm.
  const flex=Math.acos(THREE.MathUtils.clamp(humerus.dot(forearm)/(upper*lower),-1,1));
  elbow.rotation.set(-flex+Math.atan2(hand.position.z,-hand.position.y),0,0);
  const palm=GRIP_ROTATION.clone().premultiply(inverseBody);
  hand.quaternion.copy(arm.quaternion).multiply(elbow.quaternion).invert().multiply(palm);
}

export function sampleLadder(time){
  const cycle=time/LADDER.duration,travel=cycle*2*LADDER.spacing;
  const contacts=limbs.map(limb=>{
    const shifted=cycle-limb.offset,lap=Math.floor(shifted),phase=shifted-lap;
    const moving=phase<.23,u=Math.min(1,phase/.23),lift=Math.sin(Math.PI*u)**2;
    const rungY=limb.base+(lap+smooth(u))*2*LADDER.spacing;
    return {...limb,moving,u,grip:limb.hand?1-.85*lift:1,
      point:new THREE.Vector3(limb.side*(limb.hand?.235:.10),rungY-travel,LADDER.depth-(limb.hand?.035:.12)*lift)};
  });
  return {travel,contacts};
}

export function applyLadderStudy(root,time){
  setLadderHandFit(root,true);
  const sample=sampleLadder(time),{body,head,arms,legs}=root.userData;
  // Follow the climber vertically: fixed grips descend with the ladder in this view.
  const lean=.18;
  body.rotation.set(lean,0,0);
  // Find the farthest hip setback that all four limbs can reach, with a small
  // extension reserve. Height follows the intersection of their reach spheres.
  // This is evaluated from time, not previous frames, so scrubbing/reverse agree.
  const reaches=sample.contacts.map(c=>({
    joint:new THREE.Vector3(c.side*(c.hand?.207:.1),c.hand?1.488:.970,0).applyQuaternion(body.quaternion),
    target:c.point.clone().add(c.hand?LADDER_WRIST_OFFSET:new THREE.Vector3(0,LADDER.radius+.107,-.12)),
    length:c.hand?.545:.845,
  }));
  const heightRange=back=>{
    let min=-Infinity,max=Infinity;
    const z=-.988*Math.sin(lean)-back;
    for(const {joint,target,length} of reaches){
      const remaining=length*length-(target.x-joint.x)**2-(target.z-joint.z-z)**2;
      if(remaining<0)return {min:Infinity,max:-Infinity};
      const height=Math.sqrt(remaining);
      min=Math.max(min,target.y-joint.y-height);max=Math.min(max,target.y-joint.y+height);
    }
    return {min,max};
  };
  let near=0,far=.26;
  for(let i=0;i<16;i++){
    const back=(near+far)/2,range=heightRange(back);
    if(range.min<=range.max)near=back;else far=back;
  }
  const range=heightRange(near);
  // Stand up on the supporting foot instead of hanging in a deep squat.
  body.position.set(0,THREE.MathUtils.lerp(range.min,range.max,.55),-.988*Math.sin(lean)-near);
  const inverse=body.quaternion.clone().invert();
  head.rotation.set(-.12,0,0);
  for(const contact of sample.contacts){
    if(contact.hand){
      const rig=arms.find(a=>a.side===contact.side);
      const target=contact.point.clone().add(LADDER_WRIST_OFFSET).sub(body.position).applyQuaternion(inverse);
      placeLadderHand(rig,target,inverse);
      // Fingers hook over the rung; thumbs oppose them below it.
      poseGrip(rig,contact.grip);
    }else{
      const {leg,knee,boot}=legs.find(a=>a.side===contact.side);
      const ankle=contact.point.clone().add(new THREE.Vector3(0,LADDER.radius+.107,-.12)).sub(body.position).applyQuaternion(inverse);
      const delta=ankle.clone().sub(leg.position),distance=delta.length(),axis=delta.clone().normalize();
      const upper=.435,lower=Math.hypot(.425,.013),along=(upper*upper-lower*lower+distance*distance)/(2*distance);
      // Knees bend forward with a small outward bias, not sideways around a rail.
      const pole=new THREE.Vector3(contact.side*.12,0,1).applyQuaternion(inverse);
      pole.addScaledVector(axis,-pole.dot(axis)).normalize();
      const thigh=axis.clone().multiplyScalar(along).addScaledVector(pole,Math.sqrt(Math.max(0,upper*upper-along*along)));
      leg.quaternion.setFromUnitVectors(new THREE.Vector3(0,-1,0),thigh.clone().normalize());
      const shin=delta.sub(thigh).normalize().applyQuaternion(leg.quaternion.clone().invert());
      knee.quaternion.setFromUnitVectors(boot.position.clone().normalize(),shin);
      boot.quaternion.copy(body.quaternion).multiply(leg.quaternion).multiply(knee.quaternion).invert();
    }
  }
  root.userData.updateWristTwists?.();
  fitLadderGripContact(root,sample.contacts,LADDER.radius,poseGrip);
  fitLadderWatch(root);
  if(root.userData.bodySkin){root.userData.bodySkin.boundingBox=null;root.userData.bodySkin.boundingSphere=null;}
  return sample;
}

export function createStudyLadder(){
  const root=new THREE.Group(),rungs=new THREE.Group(),markers=new THREE.Group();root.add(rungs,markers);
  const steel=new THREE.MeshStandardMaterial({color:0xa9b1ac,metalness:.55,roughness:.38});
  const railMat=new THREE.MeshStandardMaterial({color:0xc4a861,metalness:.3,roughness:.52});
  for(const side of [-1,1]){
    const rail=new THREE.Mesh(new THREE.CylinderGeometry(.04,.04,7,16),railMat);rail.position.set(side*LADDER.width/2,1,LADDER.depth);rail.castShadow=true;root.add(rail);
  }
  for(let i=-10;i<20;i++){
    const rung=new THREE.Mesh(new THREE.CylinderGeometry(LADDER.radius,LADDER.radius,LADDER.width,20),steel);
    rung.rotation.z=Math.PI/2;rung.position.set(0,i*LADDER.spacing,LADDER.depth);rung.castShadow=true;rungs.add(rung);
  }
  const dots=limbs.map(()=>{const dot=new THREE.Mesh(new THREE.SphereGeometry(.04,12,8),new THREE.MeshBasicMaterial({color:0x9ce7c5,depthTest:false}));dot.renderOrder=5;markers.add(dot);return dot;});
  return {root,update(sample,showContacts){rungs.position.y=-sample.travel;markers.visible=showContacts;sample.contacts.forEach((c,i)=>{dots[i].position.copy(c.point);dots[i].material.color.setHex(c.moving?0xffbd69:0x9ce7c5);});}};
}
