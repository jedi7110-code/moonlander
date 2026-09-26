import * as THREE from 'three';
import {angleDelta,headingEase,turnTowards} from './heading.js';

const v=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z),up=v(0,1,0),axisX=v(1,0,0);
const clamp=t=>THREE.MathUtils.clamp(t,0,1),yawQ=yaw=>new THREE.Quaternion().setFromAxisAngle(up,yaw);
const sole=[[-.04,-.107,-.09],[.04,-.107,-.09],[-.055,-.107,.105],[.055,-.107,.105],[-.02,-.107,.175],[.02,-.107,.175]].map(p=>v(...p));
const restFoot=(side,yaw,origin)=>v(side*.100,.110,.013).applyQuaternion(yawQ(yaw)).add(origin);
const bottom=q=>Math.min(...sole.map(p=>p.clone().applyQuaternion(q).y));

export function captureMiloFeet(root){
  root.updateWorldMatrix(true,true);
  return root.userData.legs.map(({boot,side})=>({side,position:boot.getWorldPosition(v()),quaternion:boot.getWorldQuaternion(new THREE.Quaternion())}));
}

// Open the foot on the turning side, then take alternating small steps.
// The opening foot leads by 60 degrees; the following foot adds 30 degrees.
// This keeps both the heel and toe clear of the other boot during a quarter-turn.
export function planMiloTurn(from,to,origin=v(),feet=null){
  const delta=angleDelta(from,to),pairs=Math.max(1,Math.ceil((Math.abs(delta)-1e-8)/(Math.PI/2)));
  const start=[-1,1].map(side=>{
    const captured=feet?.find(foot=>foot.side===side);
    return captured?{side,position:captured.position.clone(),quaternion:captured.quaternion.clone()}:{side,position:restFoot(side,from,origin),quaternion:yawQ(from)};
  });
  const raised=start.find(foot=>foot.position.y+bottom(foot.quaternion)>origin.y+.012);
  const first=raised?.side??(delta<0?-1:1);
  const steps=[];
  const small=Math.abs(delta)<=Math.PI/4,stepCount=small?2:pairs*2+1;
  for(let i=0;i<stepCount;i++){
    const side=i%2?-first:first,previousStep=[...steps].reverse().find(step=>step.side===side);
    const previous=previousStep?.end??start.find(foot=>foot.side===side);
    const fraction=small||i===pairs*2?1:(Math.floor(i/2)+(i%2?1:2/3))/pairs;
    const yaw=from+delta*fraction;
    steps.push({side,start:previous,end:{side,position:restFoot(side,yaw,origin),quaternion:yawQ(yaw)},fromYaw:previousStep?.toYaw??from,toYaw:yaw});
  }
  return{from,delta,origin:origin.clone(),start,steps,lift:.024*Math.min(1,Math.abs(delta)/(Math.PI/3))};
}

export function sampleMiloTurn(plan,progress){
  const p=clamp(progress),count=plan.steps.length,index=Math.min(count-1,Math.floor(p*count)),local=p===1?1:p*count-index;
  const step=plan.steps[index],u=clamp((local-.10)/.80),s=headingEase(u),swing=Math.sin(Math.PI*u)**2;
  const feet=plan.start.map(foot=>({...foot,position:foot.position.clone(),quaternion:foot.quaternion.clone(),planted:true,lift:0}));
  for(let i=0;i<index;i++){
    const end=plan.steps[i].end,foot=feet.find(foot=>foot.side===end.side);
    foot.position.copy(end.position);foot.quaternion.copy(end.quaternion);
  }
  const foot=feet.find(foot=>foot.side===step.side);
  if(u>0){
    // Travel around the support foot instead of cutting across the other shoe.
    const neutralStart=restFoot(step.side,step.fromYaw,plan.origin);
    foot.position.copy(restFoot(step.side,THREE.MathUtils.lerp(step.fromYaw,step.toYaw,s),plan.origin));
    foot.position.addScaledVector(step.start.position.clone().sub(neutralStart),1-s);
    foot.quaternion.slerpQuaternions(step.start.quaternion,step.end.quaternion,s);
    foot.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(axisX,.045*Math.sin(2*Math.PI*u)*swing));
    foot.lift=plan.lift*swing;
    foot.position.y=Math.max(foot.position.y,plan.origin.y+.003-bottom(foot.quaternion))+foot.lift;
    foot.planted=u===1;
  }
  return{progress:p,feet,support:-step.side,swing,envelope:headingEase(p/.12)*headingEase((1-p)/.12)};
}

function segmentRotation(a,b,forward,rest){
  const y=a.clone().sub(b).normalize(),z=forward.clone().addScaledVector(y,-forward.dot(y)).normalize(),x=v().crossVectors(y,z).normalize();
  z.crossVectors(x,y);
  // The lower-leg bind vector has a small forward offset at the ankle.
  return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x,y,z)).multiply(new THREE.Quaternion().setFromUnitVectors(rest.clone().normalize(),v(0,-1,0)));
}

export function applyMiloTurn(root,plan,progress,{upperBody=true,weight=1}={}){
  const state=sampleMiloTurn(plan,progress),{body,legs,chest,head,arms}=root.userData;
  const originals=weight<1?{position:body.position.clone(),joints:legs.flatMap(r=>[r.leg,r.knee,r.boot]).map(j=>j.quaternion.clone())}:null;
  const worldQ=root.getWorldQuaternion(new THREE.Quaternion()),inverse=worldQ.clone().invert();
  const support=state.feet.find(foot=>foot.side===state.support).position.clone().sub(plan.origin);support.y=0;
  support.normalize().multiplyScalar(.014*state.swing*state.envelope).applyQuaternion(inverse);
  body.position.x+=support.x;body.position.z+=support.z;body.position.y=-.010*state.envelope;
  root.updateWorldMatrix(true,true);
  // A planted ankle must stay reachable even when the pelvis travels around it.
  // Lower the hips by the missing reach instead of shortening or sliding a leg.
  let drop=0;
  for(const rig of legs){
    const target=body.worldToLocal(state.feet.find(f=>f.side===rig.side).position.clone());
    const length=rig.knee.position.length()+rig.boot.position.length()-.0002*state.envelope;
    const dx=target.x-rig.leg.position.x,dz=target.z-rig.leg.position.z;
    drop=Math.max(drop,rig.leg.position.y-target.y-Math.sqrt(Math.max(.01,length*length-dx*dx-dz*dz)));
  }
  body.position.y-=drop;root.updateWorldMatrix(true,true);
  const bodyQ=body.getWorldQuaternion(new THREE.Quaternion());
  for(const rig of legs){
    const foot=state.feet.find(f=>f.side===rig.side),target=body.worldToLocal(foot.position.clone()),hip=rig.leg.position;
    const axis=target.clone().sub(hip),distance=axis.length();axis.normalize();
    const a=rig.knee.position.length(),b=rig.boot.position.length(),along=THREE.MathUtils.clamp((a*a-b*b+distance*distance)/(2*distance),-a,a);
    // Share yaw through the hip and knee; do not put all the twist in the ankle.
    const footForward=v(0,0,1).applyQuaternion(foot.quaternion).applyQuaternion(bodyQ.clone().invert());
    const forward=footForward.lerp(v(0,0,1),.45).normalize(),bend=forward.clone().addScaledVector(axis,-forward.dot(axis)).normalize();
    const joint=hip.clone().addScaledVector(axis,along).addScaledVector(bend,Math.sqrt(Math.max(0,a*a-along*along)));
    const upper=segmentRotation(hip,joint,forward,rig.knee.position),lower=segmentRotation(joint,target,forward,rig.boot.position);
    rig.leg.quaternion.copy(upper);rig.knee.quaternion.copy(upper).invert().multiply(lower);
    rig.boot.quaternion.copy(bodyQ).multiply(lower).invert().multiply(foot.quaternion);
  }
  if(originals){
    body.position.lerpVectors(originals.position,body.position.clone(),weight);
    legs.flatMap(r=>[r.leg,r.knee,r.boot]).forEach((j,i)=>j.quaternion.slerpQuaternions(originals.joints[i],j.quaternion.clone(),weight));
  }
  const lead=Math.sign(plan.delta)*state.envelope*(1-state.progress)*Math.min(1,Math.abs(plan.delta)/.7);
  if(upperBody){
    chest.rotation.y+=.045*lead;chest.updateMatrix();
    for(const {arm,side}of arms)arm.position.set(side*.207,1.488,0).applyMatrix4(chest.matrix);
  }
  head.rotation.y+=.16*lead;chest.updateMatrix();
  head.position.set(0,1.607,0).applyMatrix4(chest.matrix).sub(v(0,-.030,.009).applyQuaternion(head.quaternion));
  root.updateWorldMatrix(true,true);return state;
}

export function advanceMiloTurn(root,target,dt,enabled){
  const position=root.getWorldPosition(v()),previousPosition=root.userData.turnRootPosition;
  // Kitchen/hydroponic approaches move the actor in depth independently of the
  // walk flag. Their feet must not remain pinned at the start of that travel.
  if(dt>0){
    if(previousPosition&&position.distanceTo(previousPosition)/Math.min(dt,.1)>.005)enabled=false;
    root.userData.turnRootPosition=position;
  }
  // If walking stops while a heading change is unfinished, continue from the
  // visible feet, rather than inheriting a root-only walking turn.
  if(enabled&&dt>0&&!root.userData.standingTurn&&Math.abs(root.userData.headingTurn?.delta??0)>.035&&root.userData.headingTurn?.age<root.userData.headingTurn?.duration)delete root.userData.headingTurn;
  const previous=root.userData.headingTurn;
  const changed=!previous||Math.abs(angleDelta(previous.target,target))>1e-7||Math.abs(angleDelta(previous.value,root.rotation.y))>1e-7;
  const feet=enabled&&changed&&dt>0?captureMiloFeet(root):null;
  turnTowards(root,target,dt);
  const turn=root.userData.headingTurn;
  if(!enabled)delete root.userData.standingTurn;
  else if(turn!==previous){
    root.userData.standingTurn=Math.abs(turn.delta)>.035?{heading:turn,plan:planMiloTurn(turn.from,turn.target,position,feet)}:null;
  }
}

export function applyCurrentMiloTurn(root,options){
  const turn=root.userData.standingTurn;
  if(turn&&turn.heading===root.userData.headingTurn&&turn.heading.age<turn.heading.duration)applyMiloTurn(root,turn.plan,turn.heading.age/turn.heading.duration,options);
}

export function applyAuthoredMiloTurn(root,from,to,progress,options){
  if(!Number.isFinite(progress)||progress<0||progress>1||Math.abs(angleDelta(from,to))<.035)return;
  applyMiloTurn(root,planMiloTurn(from,to,root.getWorldPosition(v())),progress,options);
}
