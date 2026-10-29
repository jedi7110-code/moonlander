import * as THREE from 'three';
import {ASHTRAY} from './layout.js';
import {CIGARETTE,LIGHTER_TIP} from './smoking-props.js';
import {mouthPosition,placeHand} from './dining.js';
import {relaxMiloHand} from './milo-hands.js';
import {applyAuthoredMiloTurn} from './milo-turn.js';
import {applyMocapWalk,miloWalkData} from './mocap-walk.js';
import {setSmokingHandFit,fitSmokingLighterContact,poseSmokingLighterGrip} from './smoking-hand-fit.js';
import {applyLoungeSpine} from './milo-spine.js';
import {applyDeskHands} from './leisure.js';
import {LOUNGE_ASHTRAY} from './layout.js';
import {solveHingeArm} from './arm-ik.js';

const v=(x,y,z)=>new THREE.Vector3(x,y,z),q=(x=0,y=0,z=0)=>new THREE.Quaternion().setFromEuler(new THREE.Euler(x,y,z));

function easeWrist(rig){
  const forearm=rig.hand.position.clone().normalize(),fingers=v(0,-1,0).applyQuaternion(rig.hand.quaternion),angle=forearm.angleTo(fingers),limit=.78;
  if(angle<=limit)return;
  const swing=new THREE.Quaternion().setFromUnitVectors(forearm,fingers);
  swing.slerp(new THREE.Quaternion(),1-limit/angle);
  rig.hand.quaternion.premultiply(new THREE.Quaternion().setFromUnitVectors(fingers,forearm.applyQuaternion(swing)));
}

function placeSmokingHand(rig,target,rotation,seated,ashWeight=0,blend=1){
  if(!seated){placeHand(rig,target,rotation,0);return;}
  if(blend<=0)return;
  // Keep each elbow outside the ribs. The generic forward reach folds both
  // elbows inward at mouth height, crossing the forearms through the chest.
  const alignedElbow=target.clone().sub(v(0,-1,0).applyQuaternion(rotation).multiplyScalar(rig.hand.position.length()));
  const pole=v(rig.side*.65,-.65,.8).lerp(alignedElbow.sub(rig.arm.position),ashWeight);
  rig.arm.parent.updateWorldMatrix(true,true);
  const idlePole=rig.arm.parent.worldToLocal(rig.elbow.getWorldPosition(v(0,0,0))).sub(rig.arm.position);
  pole.lerpVectors(idlePole,pole.clone(),blend);
  const delta=target.clone().sub(rig.arm.position),max=rig.elbow.position.length()+rig.hand.position.length()-.001;
  if(delta.length()>max)target=rig.arm.position.clone().add(delta.setLength(max));
  const axis=target.clone().sub(rig.arm.position).normalize();
  if(pole.clone().addScaledVector(axis,-pole.dot(axis)).length()<.005)pole.add(v(rig.side*.1,0,0));
  const pose=solveHingeArm(rig,target,pole);
  rig.arm.quaternion.copy(pose.upper);rig.elbow.quaternion.copy(pose.lower);
  rig.hand.quaternion.copy(rig.arm.quaternion).multiply(rig.elbow.quaternion).invert().multiply(rotation);
}

function cigaretteGrip(rig,props,weight,tap,extinguish,reach){
  relaxMiloHand(rig);
  for(const i of [2,3]){
    const finger=rig.fingers[i];
    finger.rotation.set(THREE.MathUtils.lerp(i===3?.28:.42,THREE.MathUtils.lerp(i===3?.64:.58,i===3?.28:.24,extinguish),weight)*reach,0,0);
    finger.userData.links[0].rotation.set(THREE.MathUtils.lerp(i===3?.58:.65,THREE.MathUtils.lerp(i===3?.58:.72,i===3?.40:.48,extinguish),weight)*reach,0,0);
    finger.userData.links[1].rotation.set(.22*reach,0,0);
  }
  for(const i of [0,1]){
    rig.fingers[i].rotation.x=THREE.MathUtils.lerp(.65,.85,weight)*reach;
    rig.fingers[i].userData.links[0].rotation.x=1.05*reach;
    rig.fingers[i].userData.links[1].rotation.x=.40*reach;
  }
  // Hold at the bent index/middle knuckles rather than leaving the paper
  // attached to the old straight-finger point. The thumb flicks the filter.
  const pinch=v(0,0,0);
  for(const i of [2,3]){
    const finger=rig.fingers[i],middle=finger.userData.links[0];
    pinch.add(middle.position.clone().addScaledVector(finger.userData.links[1].position.clone().applyQuaternion(middle.quaternion),.6*extinguish).applyQuaternion(finger.quaternion).add(finger.position));
  }
  pinch.multiplyScalar(.5).add(v(0,-.007,-.002));
  // At the lips/rest the distal finger pads hold the paper; the ash gesture
  // rolls it back toward the curved middle phalanges for a thumb flick.
  pinch.addScaledVector(v(0,-.012,-.025),1-weight);
  const grip=CIGARETTE.grip.clone().lerp(pinch,reach);
  rig.thumb.rotation.x=THREE.MathUtils.lerp(rig.thumb.rotation.x,.42,weight);
  rig.thumb.rotation.z=THREE.MathUtils.lerp(rig.thumb.rotation.z,-.48,weight);
  rig.thumb.userData.ip.rotation.x=THREE.MathUtils.lerp(rig.thumb.userData.ip.rotation.x,.68+.24*tap*(1-extinguish),weight);
  // Palm down: tilt the cigarette through the fingers toward the bowl. Only
  // lower it vertically into the well when stubbing it out.
  props.cigarette.quaternion.identity().slerp(q(THREE.MathUtils.lerp(Math.PI*.75,Math.PI,extinguish)),weight);
  props.cigarette.position.copy(grip).sub(v(0,0,CIGARETTE.heldAt).applyQuaternion(props.cigarette.quaternion));
  return grip;
}

function levelRestingCigarette(root,weight){
  if(weight<=0)return;
  const {body,arms,smokingProps:props}=root.userData,hand=arms[0].hand,cigarette=props.cigarette;
  root.updateWorldMatrix(true,true);
  // Keep the pinch fixed while turning the paper forward in the horizontal
  // plane. Use the solved wrist, so its bend limit cannot tip the paper upright.
  const held=v(0,0,CIGARETTE.heldAt).applyQuaternion(cigarette.quaternion).add(cigarette.position);
  const forward=v(0,0,1).applyQuaternion(body.getWorldQuaternion(new THREE.Quaternion()));
  forward.y=0;forward.normalize().transformDirection(hand.matrixWorld.clone().invert());
  cigarette.quaternion.slerp(new THREE.Quaternion().setFromUnitVectors(v(0,0,1),forward),weight);
  cigarette.position.copy(held).sub(v(0,0,CIGARETTE.heldAt).applyQuaternion(cigarette.quaternion));
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
  applySmokingHands(root,pose.gesture,v(ASHTRAY.x,root.position.y+ASHTRAY.y-.018,ASHTRAY.z));
}

export function applyLoungeSmokingPose(root,visit,docks){
  const gesture=visit.pose.gesture;if(!gesture)return;
  // The dish is within seated arm reach. Keep pelvis, spine and feet fixed
  // for both the ash flick and extinguishing; solve only the reaching arm.
  applyLoungeSpine(root,0,0,0);
  applyDeskHands(root);
  const target=docks.ashtray.getWorldPosition(v(0,0,0));target.y+=LOUNGE_ASHTRAY.wellY;
  applySmokingHands(root,gesture,target,true);
}

function applySmokingHands(root,gesture,ashWorld,seated=false){
  const {body,head,arms,smokingProps:props}=root.userData;
  root.userData.smokingSignal=gesture;
  if(!gesture)return;
  setSmokingHandFit(root,gesture.reach);
  head.rotation.x=.12*gesture.hand[3];head.rotation.y=-.10*gesture.hand[1];
  root.updateWorldMatrix(true,true);
  const mouth=mouthPosition(head),right=arms[0],left=arms[1],scale=right.hand.scale;
  const ashWeight=seated?gesture.hand[3]*gesture.reach:0,extinguish=gesture.extinguish??0;
  const handGrip=cigaretteGrip(right,props,ashWeight,gesture.tap/.012,extinguish,gesture.reach);
  const ash=body.worldToLocal(ashWorld);
  const ashRotation=seated?q(0,.10,0).multiply(q(-Math.PI/2)):q(Math.PI/2,0,3.0);
  const ashGrip=seated?ash.clone().add(v(0,.035*(1-extinguish)+gesture.tap*.15,0))
    .sub(v(0,0,(CIGARETTE.length-CIGARETTE.heldAt)*scale.z).applyQuaternion(q(THREE.MathUtils.lerp(Math.PI*.75,Math.PI,extinguish))).applyQuaternion(ashRotation)):
    ash.clone().add(v(0,(CIGARETTE.length-CIGARETTE.heldAt)*scale.z+gesture.tap,0));
  const positions=[v(-.20,1.025,.13),v(-.28,seated?1.32:1.23,seated?.38:.25),mouth.clone().add(v(0,0,CIGARETTE.heldAt*scale.z)),ashGrip];
  const rotations=[q(2.1,0,3.0),q(-1.64,0,-.34),q(0,0,seated?2.3:3.13),ashRotation];
  const grip=v(0,0,0),rotation=new THREE.Quaternion();let weight=0;
  gesture.hand.forEach((w,i)=>{
    grip.addScaledVector(positions[i],w);if(!w)return;
    if(!weight)rotation.copy(rotations[i]);else rotation.slerp(rotations[i],w/(weight+w));weight+=w;
  });
  const wrist=grip.sub(handGrip.clone().multiply(scale).applyQuaternion(rotation));
  const idle=body.worldToLocal(right.hand.getWorldPosition(v(0,0,0))),idleQ=right.hand.getWorldQuaternion(new THREE.Quaternion()).premultiply(body.getWorldQuaternion(new THREE.Quaternion()).invert());
  placeSmokingHand(right,idle.lerp(wrist,gesture.reach),idleQ.slerp(rotation,gesture.reach),seated,gesture.hand[3]*gesture.reach,gesture.reach);
  easeWrist(right);
  if(seated)levelRestingCigarette(root,gesture.hand[1]*gesture.reach);
  props.cigarette.visible=gesture.cigarette;props.lighter.visible=gesture.lighter>.04;props.flame.visible=gesture.flame;
  props.lid.rotation.z=-Math.PI*.85*(gesture.lid??0);props.wheel.rotation.x=-Math.PI*2*(gesture.strike??0);
  props.ember.material.emissiveIntensity=gesture.lit?(gesture.inhale?2.5:.65):0;
  if(gesture.lighter>0){
    root.updateWorldMatrix(true,true);
    const tip=body.worldToLocal(props.cigarette.localToWorld(v(0,0,CIGARETTE.length)));
    // Keep the fingers pointing up while turning the palm inward toward the
    // chest. Rolling around the finger axis preserves the flame/ember contact.
    const palm=seated?q(0,0,Math.PI+.55):q(Math.PI),target=tip.sub(LIGHTER_TIP.clone().multiply(left.hand.scale).applyQuaternion(palm));
    const from=body.worldToLocal(left.hand.getWorldPosition(v(0,0,0))),fromQ=left.hand.getWorldQuaternion(new THREE.Quaternion()).premultiply(body.getWorldQuaternion(new THREE.Quaternion()).invert());
    placeSmokingHand(left,from.lerp(target,gesture.lighter),fromQ.slerp(palm,gesture.lighter),seated,0,gesture.lighter);
    easeWrist(left);
    // Rotate at the anatomical CMC/MCP/IP joints. Translating the thumb base
    // pulls its connected webbing through the fingers and tears the silhouette.
    poseSmokingLighterGrip(left,gesture.lighter,gesture.strike??0);
  }
  fitSmokingLighterContact(root,gesture.lighter);
}
