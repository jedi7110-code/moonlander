import * as THREE from 'three';
import {LADDER,applyLadderPose,LADDER_WRIST_OFFSET,placeLadderHand,poseGrip} from './ladder-pose.js';
import {fitLadderGripContact,fitLadderWatch} from './ladder-hand-fit.js';
import {fitLadderEntryBody} from './ladder-entry.js';
import {CABIN_AISLE} from './layout.js';
import {LADDER_LANDING} from './pace.js';

export const CABIN_LADDER={rungBase:.12,depth:.03,transfer:LADDER_LANDING.height};
export const ladderTimeAtHeight=height=>(height-CABIN_LADDER.rungBase)/(2*LADDER.spacing)*LADDER.duration;

// Solve in the torso's coordinates while the sole targets stay in the cabin.
// Interpolating leg rotations lets both feet float down and drags a planted foot.
function placeLandingFoot({leg,knee,boot},ankle,bodyRotation,cabinRotation,footYaw=Math.PI,entry=null){
  const offset=ankle.clone().sub(leg.position),distance=offset.length(),axis=offset.clone().normalize();
  const a=knee.position.length(),b=boot.position.length(),reach=THREE.MathUtils.clamp(distance,Math.abs(a-b)+1e-6,a+b-1e-6);
  const along=(a*a+reach*reach-b*b)/(2*reach);
  const pole=new THREE.Vector3(-(entry?.side??0)*.12*(entry?.blend??0),0,-1).applyQuaternion(cabinRotation).applyQuaternion(bodyRotation.clone().invert());
  if(entry){
    const cabinAxis=axis.clone().applyQuaternion(bodyRotation).applyQuaternion(cabinRotation.clone().invert());
    const bend=new THREE.Vector3(0,-cabinAxis.z,cabinAxis.y).normalize().applyQuaternion(cabinRotation).applyQuaternion(bodyRotation.clone().invert());
    pole.lerpVectors(bend,pole,entry.blend);
  }
  pole.addScaledVector(axis,-pole.dot(axis)).normalize();
  const joint=axis.clone().multiplyScalar(along).addScaledVector(pole,Math.sqrt(Math.max(0,a*a-along*along)));
  leg.quaternion.setFromUnitVectors(knee.position.clone().normalize(),joint.clone().normalize());
  const lower=new THREE.Quaternion().setFromUnitVectors(boot.position.clone().normalize(),offset.sub(joint).normalize());
  knee.quaternion.copy(leg.quaternion).invert().multiply(lower);
  const foot=cabinRotation.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),footYaw));
  boot.quaternion.copy(bodyRotation).multiply(leg.quaternion).multiply(knee.quaternion).invert().multiply(foot);
  return Math.max(0,distance-a-b);
}

function applyLadderEntry(root,sample,{height,startHeight,startYaw,startDepth,poseHeight},rest,nodes,ladderBody){
  const {body,head,arms,legs}=root.userData,ease=THREE.MathUtils.smootherstep,mix=THREE.MathUtils.lerp;
  const u=Math.abs(height-startHeight)/CABIN_LADDER.transfer,reach=ease(u,.16,.38),transfer=ease(u,.4,.96);
  nodes.forEach((node,i)=>{node.position.copy(rest[i].position);node.quaternion.copy(rest[i].rotation);});
  const turn=ease(u,0,.25),angle=Math.atan2(Math.sin(Math.PI-startYaw),Math.cos(Math.PI-startYaw));
  root.rotation.y=startYaw+angle*turn;root.position.z=mix(startDepth,CABIN_LADDER.depth+LADDER.depth,transfer);
  const yaw=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),root.rotation.y);
  // Save the standing contacts before moving the torso. Their heights are deck
  // coordinates, independent of the logical root's progress along the ladder.
  root.updateWorldMatrix(true,true);
  const standing=node=>root.worldToLocal(node.getWorldPosition(new THREE.Vector3())).applyQuaternion(yaw).add(new THREE.Vector3(root.position.x,startHeight,startDepth));
  const wrists=arms.map(a=>standing(a.hand));
  const soles=legs.map(l=>root.worldToLocal(l.boot.localToWorld(new THREE.Vector3(0,-.107,.12))).applyQuaternion(yaw).add(new THREE.Vector3(root.position.x,startHeight,startDepth)));
  soles.forEach(sole=>sole.y=startHeight+.003);
  const upper=startDepth>1,lean=upper?.60:.18,hipY=upper?.70:.94,hipZ=upper?.78:.62;
  const standingBody=rest[0].position.clone().applyQuaternion(yaw).add(new THREE.Vector3(root.position.x,startHeight,startDepth));
  const gripBody=new THREE.Vector3(root.position.x,startHeight+hipY-.970*Math.cos(lean),hipZ+.970*Math.sin(lean));
  const finalBody=new THREE.Vector3(root.position.x-ladderBody.x,poseHeight+ladderBody.y,CABIN_LADDER.depth+LADDER.depth-ladderBody.z);
  const bodyPoint=standingBody.lerp(gripBody,reach).lerp(finalBody,transfer);
  root.parent?.localToWorld(bodyPoint);body.position.copy(root.worldToLocal(bodyPoint));body.rotation.set(mix(lean*reach,.18,transfer),0,0);
  head.rotation.x=mix(0,-.12,reach);
  root.updateWorldMatrix(true,true);
  const bodyRotation=body.getWorldQuaternion(new THREE.Quaternion()),cabinRotation=root.parent?.getWorldQuaternion(new THREE.Quaternion())??new THREE.Quaternion();
  const rung=CABIN_LADDER.rungBase+Math.round((startHeight+1.24-CABIN_LADDER.rungBase)/LADDER.spacing)*LADDER.spacing;
  const contacts=[],feet=[],footTargets=[],handTargets=[],supports=[];let reachError=0;
  for(const [i,rig]of legs.entries()){
    const c=sample.contacts.find(c=>!c.hand&&c.side===rig.side),step=ease(u,rig.side===-1?.4:.62,rig.side===-1?.61:.81);
    const rungY=CABIN_LADDER.rungBase+Math.floor((poseHeight+c.point.y-CABIN_LADDER.rungBase+1e-8)/LADDER.spacing)*LADDER.spacing;
    const foothold=new THREE.Vector3(root.position.x-c.point.x,rungY+LADDER.radius,CABIN_LADDER.depth);
    foothold.lerp(new THREE.Vector3(root.position.x-c.point.x,poseHeight+c.point.y+LADDER.radius,CABIN_LADDER.depth+LADDER.depth-c.point.z),ease(u,.86,1));
    const sole=soles[i].lerp(foothold,step);
    const footYaw=mix(root.rotation.y,Math.PI,step),footRotation=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),footYaw);
    const ankle=sole.clone().sub(new THREE.Vector3(0,-.107,.12).applyQuaternion(footRotation));
    root.parent?.localToWorld(ankle);root.worldToLocal(ankle);
    footTargets.push({rig,ankle,footYaw});
    supports.push({target:ankle,offset:rig.leg.position.clone().applyQuaternion(body.quaternion),length:rig.knee.position.length()+rig.boot.position.length()-.002});
    feet.push({side:rig.side,point:sole,grounded:step===0});
  }
  for(const [i,rig]of arms.entries()){
    const c=sample.contacts.find(c=>c.hand&&c.side===rig.side),shift=ease(u,rig.side===-1?.79:.90,rig.side===-1?.90:1);
    const grip=new THREE.Vector3(root.position.x-rig.side*.235,rung,CABIN_LADDER.depth).lerp(new THREE.Vector3(root.position.x-c.point.x,poseHeight+c.point.y,CABIN_LADDER.depth+LADDER.depth-c.point.z),shift);
    const wrist=wrists[i].lerp(grip.clone().add(new THREE.Vector3(-LADDER_WRIST_OFFSET.x,LADDER_WRIST_OFFSET.y,-LADDER_WRIST_OFFSET.z)),reach);
    root.parent?.localToWorld(wrist);root.worldToLocal(wrist);
    if(reach===1)supports.push({target:wrist,offset:rig.arm.position.clone().applyQuaternion(body.quaternion),length:rig.elbow.position.length()+rig.hand.position.length()-.006});
    handTargets.push({rig,wrist,shift,c});
    const closure=ease(u,.29,.38)*mix(1,c.grip,shift);
    root.parent?.localToWorld(grip);root.worldToLocal(grip);
    contacts.push({...c,point:grip,grip:closure,moving:u<.38||shift>0&&shift<1});
  }
  body.position.copy(fitLadderEntryBody(body.position,supports));root.updateWorldMatrix(true,true);
  for(const {rig,ankle,footYaw}of footTargets){
    const target=ankle.clone().sub(body.position).applyQuaternion(body.quaternion.clone().invert());
    reachError=Math.max(reachError,placeLandingFoot(rig,target,bodyRotation,cabinRotation,footYaw,{side:rig.side,blend:ease(u,.86,1)}));
  }
  for(const {rig,wrist}of handTargets){
    const target=wrist.clone().sub(body.position).applyQuaternion(body.quaternion.clone().invert());
    const joints=[rig.arm,rig.elbow,rig.hand],before=joints.map(j=>j.quaternion.clone());
    placeLadderHand(rig,target,body.quaternion.clone().invert());
    joints.forEach((j,k)=>j.quaternion.slerpQuaternions(before[k],j.quaternion.clone(),reach));
    poseGrip(rig,contacts.find(c=>c.side===rig.side).grip);
  }
  root.userData.updateWristTwists?.();fitLadderGripContact(root,contacts,LADDER.radius,poseGrip);fitLadderWatch(root);
  root.userData.elbowDeformation?.update();
  return {progress:u,feet,contacts,reachError};
}

// Absolute height locks held hands/feet to the physical rungs in either direction,
// including pause and mid-shaft retargeting. Only the deck transfers blend out.
export function applyCabinLadder(root,{height,startHeight,endHeight,startYaw,endYaw,startDepth=CABIN_AISLE.crewZ,endDepth=CABIN_AISLE.crewZ}){
  const from=Math.abs(height-startHeight),to=Math.abs(endHeight-height);
  const weight=THREE.MathUtils.smoothstep(Math.min(from,to),0,CABIN_LADDER.transfer);
  const descendingLanding=startHeight>endHeight&&to<=CABIN_LADDER.transfer&&from>=CABIN_LADDER.transfer;
  const {body,head,arms,legs}=root.userData;
  const nodes=[body,head,...arms.flatMap(a=>[a.arm,a.elbow,a.hand,...a.fingers.flatMap(f=>[f,...f.userData.links]),a.thumb,a.thumb.userData.ip]),...legs.flatMap(l=>[l.leg,l.knee,l.boot])];
  const rest=nodes.map(node=>({position:node.position.clone(),rotation:node.quaternion.clone()}));
  root.position.z=THREE.MathUtils.lerp(from<to?startDepth:endDepth,CABIN_LADDER.depth+LADDER.depth,weight);
  const yaw=from<to?startYaw:endYaw;
  root.rotation.y=yaw+Math.atan2(Math.sin(Math.PI-yaw),Math.cos(Math.PI-yaw))*weight;
  // Hold the adjacent climbing pose during the transfer. Changing gait phase
  // while interpolating from idle can switch a shoulder's shortest rotation arc.
  const poseHeight=THREE.MathUtils.clamp(height,Math.min(startHeight,endHeight)+CABIN_LADDER.transfer,Math.max(startHeight,endHeight)-CABIN_LADDER.transfer);
  const sample=applyLadderPose(root,ladderTimeAtHeight(poseHeight));
  const ladderBody=body.position.clone();
  if(from<CABIN_LADDER.transfer&&from<to){
    const entry=applyLadderEntry(root,sample,{height,startHeight,startYaw,startDepth,poseHeight},rest,nodes,ladderBody);
    return {...sample,weight,entry,landing:null};
  }
  if(descendingLanding){
    // Reverse the supported mount: step straight back onto the destination
    // deck one foot at a time, then release the hands. Fit the body to those
    // contacts rather than blending it through the opening or turning early.
    const landing=applyLadderEntry(root,sample,{height,startHeight:endHeight,startYaw:Math.PI,startDepth:endDepth,poseHeight},rest,nodes,ladderBody);
    landing.progress=1-landing.progress;
    return {...sample,weight,landing};
  }
  nodes.forEach((node,i)=>{node.position.lerpVectors(rest[i].position,node.position.clone(),weight);node.quaternion.slerpQuaternions(rest[i].rotation,node.quaternion.clone(),weight);});
  root.userData.updateWristTwists?.();
  return {...sample,weight,landing:null};
}
