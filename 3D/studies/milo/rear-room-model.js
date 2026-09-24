import * as THREE from 'three';
import {animateMilo} from '../../src/obs/characters.js';
import {setMealHandFit} from '../../src/obs/cup-hand-fit.js';

const v=(x,y,z)=>new THREE.Vector3(x,y,z),s=THREE.MathUtils.smoothstep;
export const VISIT_DURATION=52;
export const REAR_JOBS={
  operations:{name:'設備室',floor:'3F / OPERATIONS',task:'端末点検',stand:[-.37,-4.70],contacts:[[-.24,1.43,-5.295],[-.44,1.53,-5.295]],look:[-.38,1.46,-5.305]},
  stores:{name:'備蓄倉庫',floor:'1F / LIFE SUPPORT',task:'備蓄確認',stand:[-.52,-3.79],contacts:[[-.40,1.41,-4.352],[-.19,1.44,-4.342]],look:[-.46,1.40,-4.36]},
};
const choose=id=>REAR_JOBS[id]??REAR_JOBS.operations;

// Ease velocity only near the ends, preserving an even walking speed in the
// middle. The same travelled distance drives the existing motion-capture walk.
function travel(t,start,end){
  const u=THREE.MathUtils.clamp((t-start)/(end-start),0,1),r=.12;
  return u<r?u*u/(2*r*(1-r)):u>1-r?1-(1-u)**2/(2*r*(1-r)):(u-r/2)/(1-r);
}
function roomPath(job,p){
  const z=THREE.MathUtils.lerp(.78,job.stand[1],p);
  return v(job.stand[0]*s(-z,2.65,-job.stand[1]),.11,z);
}
const arcs=new Map(Object.values(REAR_JOBS).map(job=>{
  const lengths=[0];let previous=roomPath(job,0);
  for(let i=1;i<=80;i++){const point=roomPath(job,i/80);lengths.push(lengths.at(-1)+previous.distanceTo(point));previous=point;}
  return[job,lengths];
}));
function distanceAt(job,p){const n=THREE.MathUtils.clamp(p,0,1)*80,i=Math.min(79,Math.floor(n)),a=arcs.get(job);return THREE.MathUtils.lerp(a[i],a[i+1],n-i);}
function roomHeading(job,p){
  const a=roomPath(job,Math.max(0,p-.001)),b=roomPath(job,Math.min(1,p+.001));
  return Math.atan2(b.x-a.x,b.z-a.z);
}
export function sampleRearVisit(id,seconds){
  const job=choose(id),time=THREE.MathUtils.clamp(seconds,0,VISIT_DURATION);
  const inside=travel(time,5,14),outside=travel(time,37,46),walkIn=travel(time,0,4),walkOut=travel(time,47,51);
  let position=roomPath(job,inside),yaw=-Math.PI;
  if(time<5){position=v(3*(1-walkIn),.11,.78);yaw=THREE.MathUtils.lerp(-Math.PI/2,-Math.PI,s(time,4,5));}
  else if(time<14)yaw=roomHeading(job,inside);
  else if(time<35)yaw=-Math.PI;
  else if(time<37)yaw=THREE.MathUtils.lerp(-Math.PI,0,s(time,35,37));
  else if(time<46){position=roomPath(job,1-outside);yaw=roomHeading(job,1-outside)+Math.PI;}
  else{position=v(3*walkOut,.11,.78);yaw=THREE.MathUtils.lerp(0,Math.PI/2,s(time,46,47));}
  // Path length lookup also accounts for the small sideways move at the desk.
  const distance=3*walkIn+distanceAt(job,inside)+(time>=37?distanceAt(job,1)-distanceAt(job,1-outside):0)+3*walkOut;
  const moving=(time>0&&time<4)||(time>5&&time<14)||(time>37&&time<46)||(time>47&&time<51);
  const work=time>=15&&time<35;
  const phase=time<5?'approach':time<14?'enter':time<16?'look':time<33?'work':time<35?'finish':time<37?'turn':time<46?'exit':'hall';
  const labels={approach:'通路から奥部屋へ',enter:'ゲートを通って入室',look:'設備の状態を確認',work:job.task,finish:'確認を終えて手を下ろす',turn:'出口へ向き直る',exit:'通路へ戻る',hall:'通常の船内生活へ'};
  return{time,position,yaw,moving,walkDistance:distance,phase,label:labels[phase],work,done:time===VISIT_DURATION};
}

export class RearRoomVisits{
  constructor(random=Math.random){this.random=random;this.room='operations';this.time=0;this.wait=0;this.waiting=false;this.completed=0;}
  start(room){this.room=REAR_JOBS[room]?room:'operations';this.time=0;this.wait=0;this.waiting=false;}
  advance(dt){
    let remaining=Math.max(0,Number.isFinite(dt)?dt:0);
    while(remaining>0){
      if(this.waiting){
        const step=Math.min(remaining,this.wait);this.wait-=step;remaining-=step;
        if(this.wait===0){const rooms=Object.keys(REAR_JOBS).filter(id=>id!==this.room);this.start(rooms[Math.min(rooms.length-1,Math.floor(this.random()*rooms.length))]);}
      }else{
        const step=Math.min(remaining,VISIT_DURATION-this.time);this.time+=step;remaining-=step;
        if(this.time===VISIT_DURATION){this.completed++;this.wait=120+120*THREE.MathUtils.clamp(this.random(),0,1);this.waiting=true;}
      }
    }
    return this;
  }
}

// Solve a fingertip target with a single elbow hinge and a fixed, straight
// wrist. A pole outside the ribs prevents the arm crossing the chest.
function pointAt(rig,target,weight){
  const {arm,elbow,hand,fingers,side}=rig,rest=[arm,elbow,hand].map(j=>j.quaternion.clone());
  const finger=fingers[side<0?3:0];
  const contact=finger.position.clone().add(v(0,-.072,0));
  const wrist=new THREE.Quaternion().setFromAxisAngle(v(0,1,0),side*1.15);
  const palm=contact.clone().multiply(hand.scale).applyQuaternion(wrist).add(hand.position);
  const delta=target.clone().sub(arm.position),upper=elbow.position.length(),lower=Math.hypot(palm.y,palm.z);
  const flex=Math.acos(THREE.MathUtils.clamp((delta.lengthSq()-palm.x*palm.x-upper*upper-lower*lower)/(2*upper*lower),-1,1));
  const bend=new THREE.Quaternion().setFromAxisAngle(v(1,0,0),-flex+Math.atan2(palm.z,-palm.y));
  const localAxis=palm.clone().applyQuaternion(bend).add(elbow.position).normalize();
  const localPole=elbow.position.clone().addScaledVector(localAxis,-elbow.position.dot(localAxis)).normalize();
  const axis=delta.normalize(),pole=v(side*.55,1.18,.34).sub(arm.position);pole.addScaledVector(axis,-pole.dot(axis)).normalize();
  const from=new THREE.Matrix4().makeBasis(localAxis,localPole,localAxis.clone().cross(localPole));
  const to=new THREE.Matrix4().makeBasis(axis,pole,axis.clone().cross(pole));
  const upperRotation=new THREE.Quaternion().setFromRotationMatrix(to.multiply(from.transpose()));
  arm.quaternion.slerpQuaternions(rest[0],upperRotation,weight);elbow.quaternion.slerpQuaternions(rest[1],bend,weight);hand.quaternion.slerpQuaternions(rest[2],wrist,weight);
  for(const f of fingers){
    const curl=f===finger?0:.48;f.rotation.x=THREE.MathUtils.lerp(f.rotation.x,curl,weight);
    f.userData.links.forEach((link,i)=>link.rotation.x=THREE.MathUtils.lerp(link.rotation.x,f===finger?0:i?.40:.72,weight));
  }
  return contact;
}

export function prepareRearRoomMotion(milo){
  const {body,head,arms}=milo.userData;
  return{update(room,seconds){
    const job=choose(room),pose=sampleRearVisit(room,seconds),t=pose.time;
    animateMilo(milo,{moving:pose.moving,time:0,walkDistance:pose.walkDistance,action:null,dt:0});
    milo.position.copy(pose.position);milo.rotation.y=pose.yaw;body.position.y=0;
    const settled=s(t,14,15)*(1-s(t,34,35));
    for(const rig of arms)rig.arm.rotation.z+=rig.side*.07*settled;
    // Three deliberate reaches with pauses to read between them.
    const reaches=[[16,17.5,19.5,21],[23,24.5,27,28.5],[30,31,32.5,34]];
    let reach=0,pass=0;
    for(const [i,[a,b,c,d]]of reaches.entries()){const value=s(t,a,b)*(1-s(t,c,d));if(value>reach){reach=value;pass=i;}}
    setMealHandFit(milo,reach);
    head.rotation.set((room==='stores'?.07:.025)*settled,Math.sin((t-15)*.43)*.09*settled,0);
    milo.updateWorldMatrix(true,true);
    let contact=null,target=null;
    if(reach>0){
      target=v(...job.contacts[pass===1?1:0]);
      // Two light taps on the terminal, a steady label/strap check in stores.
      if(room==='operations')target.z+=.012*(.5+.5*Math.cos((t-reaches[pass][1])*Math.PI*2));
      const local=body.worldToLocal(target.clone());contact=pointAt(arms[0],local,reach);
    }
    milo.userData.updateWristTwists?.();milo.updateWorldMatrix(true,true);
    return{...pose,reach,contact,target};
  }};
}
