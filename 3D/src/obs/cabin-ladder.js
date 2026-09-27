import * as THREE from 'three';
import {LADDER,applyLadderPose,LADDER_WRIST_OFFSET,placeLadderHand,poseGrip} from './ladder-pose.js';
import {fitLadderGripContact,fitLadderWatch} from './ladder-hand-fit.js';
import {fitLadderEntryBody} from './ladder-entry.js';
import {planMiloTurn,sampleMiloTurn,miloTurnSway,placeMiloTurnLegs,applyMiloTurnLead} from './milo-turn.js';
import {CABIN_AISLE} from './layout.js';
import {LADDER_LANDING} from './pace.js';

export const CABIN_LADDER={rungBase:.12,depth:.03,transfer:LADDER_LANDING.height};
export const ladderTimeAtHeight=height=>(height-CABIN_LADDER.rungBase)/(2*LADDER.spacing)*LADDER.duration;
const SOLE=new THREE.Vector3(0,-.107,.12);
// The top and middle decks leave the ladder well open up to their bridge at
// z=.94, 0.91 m in front of the rungs. Mount and dismount there with the toes
// 4 cm behind that edge instead of reaching out over the well from the aisle.
const WELL_EDGE=.94,WELL_STANCE=WELL_EDGE+.04+.188;
export const ladderStanceDepth=depth=>depth>1?WELL_STANCE:depth;
const phase=(u,[start,end])=>THREE.MathUtils.clamp((u-start)/(end-start),0,1);

// Carry a sole between the bridge edge and a rung inside the well. It rises
// 4.5 cm before it travels and stays that high until the heel has cleared the edge.
function wellStep(start,end,t){
  const h=THREE.MathUtils.smoothstep(t,0,1),sole=start.clone().lerp(end,h);
  if(t>0&&t<1){
    // The heel is 21.5 cm behind the sole point.
    const clear=THREE.MathUtils.clamp((start.z-(WELL_EDGE-.215))/(start.z-end.z),0,1)+.02;
    const d=end.y<start.y?THREE.MathUtils.smootherstep(h,Math.min(clear,.9),1):h,lift=.045*THREE.MathUtils.smoothstep(t,0,.12);
    sole.y=start.y+(end.y-start.y)*d+lift*(1-d);
  }
  return sole;
}

// Face the rungs with the shared planted-foot turn. Rotating the standing pose
// with the root swings both soles around it on the deck.
function ladderTurn(u,span,startYaw,angle,deck){
  if(u>=span||Math.abs(angle)<.035)return null;
  const plan=planMiloTurn(startYaw,startYaw+angle,deck);
  return {plan,state:sampleMiloTurn(plan,u/span)};
}

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

function applyLadderEntry(root,sample,{height,startHeight,startYaw,startDepth,poseHeight,reverse=false},rest,nodes,ladderBody){
  const {body,head,arms,legs}=root.userData,ease=THREE.MathUtils.smootherstep,mix=THREE.MathUtils.lerp;
  const u=Math.abs(height-startHeight)/CABIN_LADDER.transfer,reach=ease(u,.16,.38),transfer=ease(u,.4,.96);
  nodes.forEach((node,i)=>{node.position.copy(rest[i].position);node.quaternion.copy(rest[i].rotation);});
  const turnSpan=.25,turn=ease(u,0,turnSpan),angle=Math.atan2(Math.sin(Math.PI-startYaw),Math.cos(Math.PI-startYaw));
  root.rotation.y=startYaw+angle*turn;root.position.z=mix(startDepth,CABIN_LADDER.depth+LADDER.depth,transfer);
  const yaw=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),root.rotation.y);
  // The root keeps the same eased heading; the soles follow the stepping plan.
  const turning=Math.abs(angle)>=.035,deck=new THREE.Vector3(root.position.x,startHeight,startDepth);
  const stepping=ladderTurn(u,turnSpan,startYaw,angle,deck);
  // Over a well the turn's last step carries its foot to the edge stance. The
  // right foot, which leaves the deck last, always ends there: it follows with a
  // step of its own after the turn ended on the left foot, or when there is no
  // turn, once the weight is on the other foot. A left foot not carried there by
  // the turn waits at the aisle stance.
  const upper=startDepth>1,stance=ladderStanceDepth(startDepth);
  const lastMover=turning?(stepping?.plan??planMiloTurn(startYaw,startYaw+angle,deck)).steps.at(-1).side:0;
  let merged=1;
  if(upper&&stepping){
    const count=stepping.plan.steps.length,p=stepping.state.progress*count,index=Math.min(count-1,Math.floor(p));
    merged=index<count-1?0:ease(THREE.MathUtils.clamp((p-index-.1)/.8,0,1),0,1);
  }
  const follower=upper&&lastMover!==1?1:0,followWindow=turning?[.30,.355]:[.25,.31],preWindow=turning?[.24,.30]:[.19,.25];
  const followT=follower?phase(u,followWindow):0;
  const shuffle=side=>!upper?0:side===lastMover?merged:side===follower?ease(followT,0,1):0;
  const loadOther=follower?ease(u,preWindow[0],preWindow[1])*(1-ease(u,followWindow[1],followWindow[1]+.04)):0;
  const footDepth=side=>mix(startDepth,stance,shuffle(side));
  // Save the standing contacts before moving the torso. Their heights are deck
  // coordinates, independent of the logical root's progress along the ladder.
  root.updateWorldMatrix(true,true);
  const standing=node=>root.worldToLocal(node.getWorldPosition(new THREE.Vector3())).applyQuaternion(yaw).add(new THREE.Vector3(root.position.x,startHeight,startDepth));
  const wrists=arms.map(a=>standing(a.hand));
  const soles=legs.map(l=>root.worldToLocal(l.boot.localToWorld(SOLE.clone())).applyQuaternion(yaw).add(new THREE.Vector3(root.position.x,startHeight,footDepth(l.side))));
  soles.forEach((sole,i)=>sole.y=startHeight+.003+(legs[i].side===follower?.025*Math.sin(Math.PI*followT)**2:0));
  // Over a well, reach the rung in a crouch: bent knees, a moderate hip hinge and
  // the pelvis above the edge. It moves out over the opening once both hands hold.
  const lean=upper?.8:.18,hipY=upper?.74:.94,hipZ=upper?stance-.17:.62;
  const standingBody=rest[0].position.clone().applyQuaternion(yaw).add(new THREE.Vector3(root.position.x,startHeight,startDepth));
  if(stepping){standingBody.add(miloTurnSway(stepping.plan,stepping.state));standingBody.y-=.010*stepping.state.envelope;}
  let shiftX=0;
  if(upper){
    // Shift the pelvis toward the loaded sole while each turn step swings.
    if(stepping){
      const {plan,state}=stepping,count=plan.steps.length,local=state.progress*count-Math.min(count-1,Math.floor(state.progress*count));
      const loaded=state.feet.find(f=>f.side===state.support).position.clone().sub(plan.origin);loaded.y=0;
      standingBody.addScaledVector(loaded.normalize(),.035*Math.sin(Math.PI*Math.min(1,local)));
    }
    const sole=side=>soles[legs.findIndex(l=>l.side===side)];
    // Load the standing foot before the follower lifts, and keep it loaded until it lands.
    if(follower)shiftX+=(sole(-follower).x-root.position.x)*.5*loadOther;
  }
  const gripBody=new THREE.Vector3(root.position.x,startHeight+hipY-.970*Math.cos(lean),hipZ+.970*Math.sin(lean));
  const finalBody=new THREE.Vector3(root.position.x-ladderBody.x,poseHeight+ladderBody.y,CABIN_LADDER.depth+LADDER.depth-ladderBody.z);
  let reachBody=standingBody.clone().lerp(gripBody,reach),bend=lean*reach;
  if(upper){
    // Interpolate the hip joint itself. Lerping the body origin while the torso
    // hinges swings the hips ahead of both the standing and the reaching pose.
    // The torso bends early and the hips move forward late, once both feet are down.
    // Once both hands hold, lean out over the well before the first foot leaves
    // the deck, so the stepping leg does not drag the pelvis after it.
    const out=ease(u,.38,.5);bend=mix(lean,.6,out)*ease(u,.1,.38);
    const hip=standingBody.clone().add(new THREE.Vector3(0,.970,0)),target=new THREE.Vector3(root.position.x,startHeight+mix(hipY,.70,out),mix(hipZ,.78,out));
    hip.x=mix(hip.x,target.x,reach)+shiftX;hip.y=mix(hip.y,target.y,reach);hip.z=mix(hip.z,target.z,ease(u,.24,.38));
    reachBody=hip.sub(new THREE.Vector3(0,.970*Math.cos(bend),.970*Math.sin(bend)).applyQuaternion(yaw));
  }
  const bodyPoint=reachBody.lerp(finalBody,transfer);
  root.parent?.localToWorld(bodyPoint);body.position.copy(root.worldToLocal(bodyPoint));body.rotation.set(mix(bend,.18,transfer),0,0);
  // Played backwards (an arrival), the head must still lead the turn it is making.
  if(stepping)applyMiloTurnLead(root,reverse?{delta:-stepping.plan.delta}:stepping.plan,reverse?{...stepping.state,progress:1-stepping.state.progress}:stepping.state,false);
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
    // Rung steps start after the turn, so a planned foot is still on the deck.
    let planned=stepping?.state.feet.find(f=>f.side===rig.side);
    if(planned&&rig.side===lastMover&&upper)planned={...planned,position:planned.position.clone().add(new THREE.Vector3(0,0,(stance-startDepth)*merged))};
    // Turn the boot the short way: the root may face -π rather than π after the turn.
    const footYaw=root.rotation.y+Math.atan2(Math.sin(Math.PI-root.rotation.y),Math.cos(Math.PI-root.rotation.y))*step,footRotation=planned?planned.quaternion:new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),footYaw);
    const window=rig.side===-1?[.4,.61]:[.62,.81];
    const sole=planned?planned.position.clone().add(SOLE.clone().applyQuaternion(footRotation)):upper?wellStep(soles[i],foothold,phase(u,window)):soles[i].lerp(foothold,step);
    const ankle=planned?planned.position.clone():sole.clone().sub(SOLE.clone().applyQuaternion(footRotation));
    root.parent?.localToWorld(ankle);root.worldToLocal(ankle);
    footTargets.push({rig,ankle,footYaw,planned});
    supports.push({target:ankle,offset:rig.leg.position.clone().applyQuaternion(body.quaternion),length:rig.knee.position.length()+rig.boot.position.length()-.002});
    feet.push({side:rig.side,point:sole,grounded:planned?planned.planted:step===0&&shuffle(rig.side)%1===0});
  }
  for(const [i,rig]of arms.entries()){
    const c=sample.contacts.find(c=>c.hand&&c.side===rig.side),shift=ease(u,rig.side===-1?.79:.90,rig.side===-1?.90:1);
    const grip=new THREE.Vector3(root.position.x-rig.side*.235,rung,CABIN_LADDER.depth).lerp(new THREE.Vector3(root.position.x-c.point.x,poseHeight+c.point.y,CABIN_LADDER.depth+LADDER.depth-c.point.z),shift);
    const wrist=wrists[i].clone().lerp(grip.clone().add(new THREE.Vector3(-LADDER_WRIST_OFFSET.x,LADDER_WRIST_OFFSET.y,-LADDER_WRIST_OFFSET.z)),reach);
    if(upper&&reach<1){
      // A reaching hand waits for the body instead of dragging the pelvis forward.
      const shoulder=rig.arm.getWorldPosition(new THREE.Vector3()),arm=(rig.elbow.position.length()+rig.hand.position.length())*.98;
      root.parent?.worldToLocal(shoulder);
      if(wrist.distanceTo(shoulder)>arm)wrist.sub(shoulder).setLength(arm).add(shoulder);
    }
    root.parent?.localToWorld(wrist);root.worldToLocal(wrist);
    // A reaching hand must never outrun a straight arm: its IK basis degenerates
    // and flips. Over a well the pelvis may still be stepping to the edge.
    if(reach===1||upper&&reach>0)supports.push({target:wrist,offset:rig.arm.position.clone().applyQuaternion(body.quaternion),length:rig.elbow.position.length()+rig.hand.position.length()-.006});
    handTargets.push({rig,wrist,shift,c});
    const closure=ease(u,.29,.38)*mix(1,c.grip,shift);
    root.parent?.localToWorld(grip);root.worldToLocal(grip);
    contacts.push({...c,point:grip,grip:closure,moving:u<.38||shift>0&&shift<1});
  }
  body.position.copy(fitLadderEntryBody(body.position,supports));root.updateWorldMatrix(true,true);
  for(const {rig,ankle,footYaw}of footTargets){
    const target=ankle.clone().sub(body.position).applyQuaternion(body.quaternion.clone().invert());
    if(stepping)reachError=Math.max(reachError,target.distanceTo(rig.leg.position)-rig.knee.position.length()-rig.boot.position.length());
    else reachError=Math.max(reachError,placeLandingFoot(rig,target,bodyRotation,cabinRotation,footYaw,{side:rig.side,blend:ease(u,.86,1)}));
  }
  // Share the turn's hip and knee twist instead of turning each boot at the ankle.
  if(stepping)placeMiloTurnLegs(root,footTargets.map(({rig,ankle,planned})=>({side:rig.side,position:root.localToWorld(ankle.clone()),quaternion:cabinRotation.clone().multiply(planned.quaternion)})));
  for(const {rig,wrist}of handTargets){
    const target=wrist.clone().sub(body.position).applyQuaternion(body.quaternion.clone().invert());
    const joints=[rig.arm,rig.elbow,rig.hand],before=joints.map(j=>j.quaternion.clone());
    placeLadderHand(rig,target,body.quaternion.clone().invert());
    joints.forEach((j,k)=>j.quaternion.slerpQuaternions(before[k],j.quaternion.clone(),upper?ease(u,.16,.35):reach));
    poseGrip(rig,contacts.find(c=>c.side===rig.side).grip);
  }
  if(upper){
    // Look at the hands as they reach, then at the rung; settle into the climbing head pose.
    root.updateWorldMatrix(true,true);
    const eye=head.getWorldPosition(new THREE.Vector3()),hands=arms.map(a=>a.hand.getWorldPosition(new THREE.Vector3())).reduce((a,b)=>a.add(b).multiplyScalar(.5));
    const down=Math.atan2(eye.y-hands.y,Math.hypot(eye.x-hands.x,eye.z-hands.z)),pitch=body.rotation.x;
    head.rotation.x=mix(mix(0,THREE.MathUtils.clamp(Math.min(down,.55)-pitch,-.75,.1),reach),-.12,transfer);
    root.updateWorldMatrix(true,true);
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
  if(startHeight<endHeight&&endDepth>1&&to<=CABIN_LADDER.transfer&&from>=CABIN_LADDER.transfer){
    // Arriving upward on a deck with a well mirrors its mount: step each foot up
    // onto the edge while holding the rungs, bring the pelvis over the feet,
    // release, step back to the aisle and turn to face it on planted feet.
    const arrival=applyLadderEntry(root,sample,{height,startHeight:endHeight,startYaw:endYaw,startDepth:endDepth,poseHeight,reverse:true},rest,nodes,ladderBody);
    arrival.progress=1-arrival.progress;
    return {...sample,weight,arrival};
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
