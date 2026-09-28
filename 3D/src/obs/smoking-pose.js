import * as THREE from 'three';
import {ASHTRAY} from './layout.js';
import {CIGARETTE,LIGHTER_TIP} from './smoking-props.js';
import {mouthPosition,placeHand} from './dining.js';
import {relaxMiloHand} from './milo-hands.js';
import {applyAuthoredMiloTurn} from './milo-turn.js';
import {applyMocapWalk,miloWalkData} from './mocap-walk.js';
import {setMealHandFit} from './cup-hand-fit.js';

const v=(x,y,z)=>new THREE.Vector3(x,y,z),q=(x=0,y=0,z=0)=>new THREE.Quaternion().setFromEuler(new THREE.Euler(x,y,z));

function easeWrist(rig){
  const forearm=rig.hand.position.clone().normalize(),fingers=v(0,-1,0).applyQuaternion(rig.hand.quaternion),angle=forearm.angleTo(fingers),limit=.78;
  if(angle<=limit)return;
  const swing=new THREE.Quaternion().setFromUnitVectors(forearm,fingers);
  swing.slerp(new THREE.Quaternion(),1-limit/angle);
  rig.hand.quaternion.premultiply(new THREE.Quaternion().setFromUnitVectors(fingers,forearm.applyQuaternion(swing)));
}

export function applySmokingPose(root,visit){
  visit.startYaw??=root.rotation.y;
  const pose=visit.pose,{body,head,arms,legs,smokingProps:props}=root.userData;
  root.position.z=pose.depth;root.rotation.y=pose.yaw;body.position.set(0,0,0);head.rotation.set(0,0,0);
  for(const arm of arms)relaxMiloHand(arm);
  if(pose.moving){
    const joints=legs.flatMap(({leg,knee,boot})=>[leg,knee,boot]).concat(arms.flatMap(({arm,elbow,hand})=>[arm,elbow,hand]));
    const rest=joints.map(joint=>joint.quaternion.clone());
    applyMocapWalk(root,miloWalkData,pose.walkDistance/miloWalkData.cycleDistance*miloWalkData.duration);
    joints.forEach((joint,i)=>joint.quaternion.slerpQuaternions(rest[i],joint.quaternion.clone(),pose.walkWeight));body.position.multiplyScalar(pose.walkWeight);
  }
  if(pose.turn)applyAuthoredMiloTurn(root,pose.turn.from,pose.turn.to,pose.turn.progress,{upperBody:false});
  const gesture=pose.gesture;root.userData.smokingSignal=gesture;
  if(!gesture)return;
  setMealHandFit(root,gesture.reach);
  head.rotation.x=.12*gesture.hand[3];head.rotation.y=-.10*gesture.hand[1];
  root.updateWorldMatrix(true,true);
  const mouth=mouthPosition(head),right=arms[0],left=arms[1],scale=right.hand.scale;
  const ash=body.worldToLocal(v(ASHTRAY.x,root.position.y+ASHTRAY.y-.018,ASHTRAY.z));
  const positions=[v(-.20,1.025,.13),v(-.28,1.23,.25),mouth.clone().add(v(0,0,CIGARETTE.heldAt*scale.z)),ash.clone().add(v(0,(CIGARETTE.length-CIGARETTE.heldAt)*scale.z+gesture.tap,0))];
  const rotations=[q(2.1,0,3.0),q(-1.64,0,-.34),q(0,0,3.13),q(Math.PI/2,0,3.0)];
  const grip=v(0,0,0),rotation=new THREE.Quaternion();let weight=0;
  gesture.hand.forEach((w,i)=>{
    grip.addScaledVector(positions[i],w);if(!w)return;
    if(!weight)rotation.copy(rotations[i]);else rotation.slerp(rotations[i],w/(weight+w));weight+=w;
  });
  const wrist=grip.sub(CIGARETTE.grip.clone().multiply(scale).applyQuaternion(rotation));
  const idle=body.worldToLocal(right.hand.getWorldPosition(v(0,0,0))),idleQ=right.hand.getWorldQuaternion(new THREE.Quaternion()).premultiply(body.getWorldQuaternion(new THREE.Quaternion()).invert());
  placeHand(right,idle.lerp(wrist,gesture.reach),idleQ.slerp(rotation,gesture.reach),0);
  relaxMiloHand(right);
  // Keep the index and middle finger almost straight around the paper; curl
  // the other two away from it. The cigarette is attached to this same hand.
  for(const i of [2,3]){right.fingers[i].rotation.set(0,0,0);right.fingers[i].userData.links.forEach(link=>link.rotation.set(0,0,0));}
  for(const i of [0,1]){right.fingers[i].rotation.x=.25;right.fingers[i].userData.links[0].rotation.x=.65;}
  easeWrist(right);
  props.cigarette.visible=gesture.cigarette;props.lighter.visible=gesture.lighter>.04;props.flame.visible=gesture.flame;
  props.ember.material.emissiveIntensity=gesture.lit?(gesture.inhale?2.5:.65):0;
  if(gesture.lighter>0){
    root.updateWorldMatrix(true,true);
    const tip=body.worldToLocal(props.cigarette.localToWorld(v(0,0,CIGARETTE.length)));
    const palm=q(Math.PI),target=tip.sub(LIGHTER_TIP.clone().multiply(left.hand.scale).applyQuaternion(palm));
    const from=body.worldToLocal(left.hand.getWorldPosition(v(0,0,0))),fromQ=left.hand.getWorldQuaternion(new THREE.Quaternion()).premultiply(body.getWorldQuaternion(new THREE.Quaternion()).invert());
    placeHand(left,from.lerp(target,gesture.lighter),fromQ.slerp(palm,gesture.lighter),0);
    easeWrist(left);
    for(const finger of left.fingers){finger.rotation.x=.25*gesture.lighter;finger.userData.links[0].rotation.x=.65*gesture.lighter;}
  }
}
