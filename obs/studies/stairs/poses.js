import * as THREE from 'three';
import {animateMilo} from '../../src/obs/characters.js';
import {STAIR_ROUTE_LENGTH,stairPoint,stairContact,stairFoot,STAIRS} from './route.js';
const V=(...p)=>new THREE.Vector3(...p),down=V(0,-1,0),up=V(0,1,0);
const mix=(a,b,t)=>a+(b-a)*t;

export function agentFeet(agent){
  const cat=agent.id==='cat',count=cat?4:2,raw=stairPoint(agent.s),dx=raw.dx*agent.direction,dz=raw.dz*agent.direction;
  const center={...raw,x:raw.x+dz*.32,z:raw.z-dx*.32,dx,dz,yaw:Math.atan2(dx,dz)};
  if(agent.wait===Infinity){center.x+=(agent.id==='human'?1.05:.35)*(agent.exit??0);if(cat)center.z+=.48*(agent.exit??0);}
  const feet=Array.from({length:count},(_,i)=>{
    const side=i%2===0?-1:1,rear=i>=2;
    const options=cat?{cycle:.31,forward:rear?-.18:.18,spread:.058,lift:.14,phase:(side<0?.5:0)+(rear?.5:0)}:{cycle:.65,spread:agent.id==='robot'?.137:.10,lift:.20};
    const p=stairFoot(agent.s,agent.direction,side,options);
    if(agent.wait===Infinity){
      const along=cat?(rear?-.18:.18):0;
      p.x=center.x+center.dx*along+center.dz*side*(cat?.058:.12);
      p.y=center.y;p.z=center.z+center.dz*along-center.dx*side*(cat?.058:.12);p.planted=true;
    }
    return {...p,side,rear};
  });
  return {center,feet};
}

function solveHumanLeg(rig,target){
  const {leg,knee,boot}=rig,origin=leg.position.clone(),delta=target.clone().sub(origin),distance=delta.length();
  const upper=knee.position.length(),lower=boot.position.length();
  const d=Math.min(distance,upper+lower-.001),axis=delta.normalize();
  const pole=V(0,-.1,1);pole.addScaledVector(axis,-pole.dot(axis)).normalize();
  const along=(upper*upper+d*d-lower*lower)/(2*d),height=Math.sqrt(Math.max(0,upper*upper-along*along));
  const joint=origin.clone().addScaledVector(axis,along).addScaledVector(pole,height);
  leg.quaternion.setFromUnitVectors(knee.position.clone().normalize(),joint.clone().sub(origin).normalize());
  const world=new THREE.Quaternion().setFromUnitVectors(boot.position.clone().normalize(),target.clone().sub(joint).normalize());
  knee.quaternion.copy(leg.quaternion).invert().multiply(world);
  boot.quaternion.copy(world).invert();
}

export function poseHuman(root,agent,time){
  const {center,feet}=agentFeet(agent),yaw=center.yaw;
  animateMilo(root,{moving:agent.wait!==Infinity&&!agent.waiting,waiting:agent.waiting,climbing:false,facing:1,walkYaw:yaw,walkStyle:'legacy',walkDistance:agent.s,time,dt:1/60});
  root.position.set(center.x,Math.min(...feet.map(p=>p.y)),center.z);root.rotation.set(0,yaw,0);
  const {body,legs}=root.userData;body.position.set(0,-.075,0);body.quaternion.identity();
  for(let i=0;i<legs.length;i++){
    const p=feet[i],target=V(p.x,p.y+.107,p.z).sub(root.position).applyAxisAngle(up,-yaw).sub(body.position);
    solveHumanLeg(legs[i],target);
  }
  root.userData.updateWristTwists?.();root.updateMatrixWorld(true);
  return {center,feet};
}

export function poseRobot(robot,parent,load,agent,time){
  const {center,feet}=agentFeet(agent),yaw=center.yaw;
  parent.position.set(center.x,Math.min(...feet.map(p=>p.y)),center.z);parent.rotation.set(0,yaw,0);
  const local=feet.map(p=>V(p.x,p.y+.099,p.z).sub(parent.position).applyAxisAngle(up,-yaw).toArray());
  const hands=load.visible?[[-.265,1.15,.31],[.265,1.15,.31]]:null;
  robot.face.setExpression('happy');
  const pose=robot.update(time,'service',{rest:0,feet:local,hipHeight:.86,walkAmount:agent.waiting||agent.wait===Infinity?0:1,walkPhase:agent.s/.65,lean:.11,hands,handWeight:1,gripKind:'carry'});
  parent.updateMatrixWorld(true);return{center,feet,pose};
}

export {poseCatStairs as poseCat} from './cat-gait.js';
