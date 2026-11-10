import * as THREE from 'three';
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
export {poseHumanStairs as poseHuman} from './human-gait.js';
