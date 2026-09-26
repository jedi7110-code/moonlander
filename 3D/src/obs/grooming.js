import * as THREE from 'three';
import {box,cylinder,pipe} from './materials.js';
import {animateMilo} from './characters.js';
import {setMealHandFit} from './cup-hand-fit.js';
import {applyMocapWalk,miloWalkData} from './mocap-walk.js';
import {headingEase} from './heading.js';
import {applyAuthoredMiloTurn} from './milo-turn.js';

export const GROOMING_DURATION=54;
export const VANITY={x:-.86,z:-3.22,standX:-.37,floor:.11};
export const TOOL_TIP=new THREE.Vector3(0,.084,-.034);
export const SHAVER_TIP=new THREE.Vector3(0,.089,0);
export const TOOL_GRIP=new THREE.Vector3(0,-.064,-.020);
const s=(t,a,b)=>THREE.MathUtils.smoothstep(t,a,b);
const v=(x,y,z)=>new THREE.Vector3(x,y,z);

export function sampleGrooming(seconds){
  const time=THREE.MathUtils.clamp(seconds,0,GROOMING_DURATION);
  // Allow 3.3 seconds to bring the left hand around from the nape and lower
  // the clipper. Keep this slower return inside the same authored trajectory.
  const t=time<=27?time:time<=30.3?27+(time-27)*1.3/3.3:time-2;
  const phase=t<4?'enter':t<5.5?'turn':t<9?'pickClipper':t<15?'cutRight':t<21?'transfer':t<27?'cutLeft':t<29?'putClipper':t<33?'pickShaver':t<43?'shave':t<45?'putShaver':t<48?'check':'leave';
  const labels={enter:'2階の奥部屋へ',turn:'鏡の前に立つ',pickClipper:'バリカンを手に取る',cutRight:'右側から頭頂部を刈る',transfer:'正面で左手に持ち替える',cutLeft:'左側と後頭部を刈る',putClipper:'バリカンを戻す',pickShaver:'シェーバーを手に取る',shave:'髭を剃る',putShaver:'シェーバーを戻す',check:'鏡で仕上がりを確認',leave:'短髪A・髭なしにリセット完了'};
  const enter=s(t,0,4),leave=s(t,48,52);
  return{time,motionTime:t,phase,label:labels[phase],hair:1-.5*(s(t,9,15)+s(t,21,27)),beard:1-s(t,33,43),
    x:VANITY.standX*enter*(1-leave),z:THREE.MathUtils.lerp(.78,VANITY.z,enter)*(1-leave)+.78*leave,
    // Finish the approach, then turn with small planted steps at the mirror.
    yaw:t<46?Math.PI+Math.PI/2*headingEase((t-4)/1.5):Math.PI*1.5+Math.PI/2*headingEase((t-46)/2),
    moving:(t>0&&t<4)||(t>48&&t<52),
    walkWeight:s(t,0,.65)*(1-s(t,3.2,4))+s(t,48,48.65)*(1-s(t,51.2,52)),
    walkDistance:(.78-VANITY.z)*(enter+leave),done:t===52};
}

export function createVanity(m,metals){
  const root=new THREE.Group();root.name='Laundry washbasin and mirror';root.position.set(VANITY.x,VANITY.floor,VANITY.z);root.rotation.y=Math.PI/2;
  const cabinet=metals.shell,steel=metals.alloy;
  box(root,cabinet,0,.54,0,.84,.71,.43,.025).name='Washbasin cabinet';
  box(root,m.rubber,0,.19,.015,.72,.065,.34,.009);
  for(const x of [-.207,.207]){
    box(root,cabinet,x,.58,.225,.396,.60,.024,.01);
    box(root,steel,x,.78,.250,.16,.018,.024,.004);
  }
  // The countertop has a real opening so its plane cannot cover the basin.
  // Notch the rear corner around the laundry gate jamb.
  const shape=new THREE.Shape();shape.moveTo(-.46,-.27);shape.lineTo(.46,-.27);shape.lineTo(.46,.27);shape.lineTo(-.37,.27);shape.lineTo(-.37,.20);shape.lineTo(-.46,.20);shape.closePath();
  const hole=new THREE.Path();hole.absellipse(0,.02,.265,.183,0,Math.PI*2,true);shape.holes.push(hole);
  const top=new THREE.Mesh(new THREE.ExtrudeGeometry(shape,{depth:.033,bevelEnabled:false,curveSegments:36}),steel);
  top.rotation.x=-Math.PI/2;top.position.y=.94;top.name='Open washbasin countertop';root.add(top);
  const profile=[[0,-.13],[.06,-.13],[.12,-.10],[.18,-.035],[.225,.023],[.244,.028],[.253,.025],[.246,.013],[.230,.010],[.208,-.045],[.14,-.118],[.06,-.145],[0,-.145]];
  const basin=new THREE.Mesh(new THREE.LatheGeometry(profile.map(([r,y])=>new THREE.Vector2(r,y)),40),steel);
  basin.position.set(0,.943,-.02);basin.scale.z=.70;basin.name='Recessed metal washbasin';root.add(basin);
  cylinder(root,m.dark,0,.820,-.02,.027,.006,.027,20).name='Washbasin drain';
  pipe(root,steel,[[0,.98,-.19],[0,1.15,-.19],[0,1.20,-.10],[0,1.15,-.035]],.014).name='Washbasin faucet';
  box(root,steel,.07,1.03,-.19,.09,.015,.024,.005);
  box(root,cabinet,0,1.63,-.21,.80,.99,.046,.02).name='Smoked titanium mirror frame';
  const mirror=new THREE.Object3D();mirror.name='Mirror mounting plane';mirror.position.set(0,1.63,-.180);root.add(mirror);
  box(root,m.coolLamp,0,2.155,-.15,.69,.025,.06,.008).name='Mirror task light';
  const docks={};
  for(const [id,x]of [['clipper',0],['shaver',.30]]){
    const dock=new THREE.Object3D();dock.position.set(x,1.035,.22);dock.name=id+' charging dock';root.add(dock);docks[id]=dock;
    box(root,m.rubber,x,.994,.22,.09,.025,.10,.008);
  }
  return{root,mirror,docks};
}

export function createGroomingTools(parent,m,metals){
  const tools={};
  for(const name of ['clipper','shaver']){
    const tool=new THREE.Group();tool.name=name==='clipper'?'Hair clipper':'Electric shaver';parent.add(tool);tools[name]=tool;
    box(tool,m.rubber,0,-.003,0,.037,.115,.036,.012);
    box(tool,metals.shell,0,.010,.019,.030,.080,.006,.003);
    box(tool,metals.alloy,0,.075,-.006,name==='clipper'?.053:.043,.018,.039,.005);
    box(tool,m.green,0,.01,.024,.010,.017,.003,.002);
    if(name==='clipper')for(let i=0;i<8;i++)box(tool,metals.alloy,-.023+i*.0065,.080,-.028,.003,.015,.012);
    else for(const z of [-.011,.011]){
      const foil=cylinder(tool,metals.alloy,0,.075,z,.014,.037,.014,16);foil.rotation.z=Math.PI/2;
    }
  }
  return tools;
}

function contactPose(point,normal,direction,hair){
  if(!hair){
    // Foil shavers contact with the top of the head. The handle projects
    // away from the cheek, leaving room for the palm below the foil.
    const y=normal.clone().negate(),z=v(0,1,0).addScaledVector(y,y.y*-1).normalize(),x=y.clone().cross(z).normalize();
    const rotation=new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x,y,z));
    return{position:point.clone().sub(SHAVER_TIP.clone().applyQuaternion(rotation)),rotation};
  }
  const z=normal.clone().normalize(),y=direction.clone().addScaledVector(z,-direction.dot(z));
  if(y.lengthSq()<.01)y.set(0,0,-1).addScaledVector(z,z.z);
  y.normalize();const x=y.clone().cross(z).normalize();y.copy(z).cross(x).normalize();
  const rotation=new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x,y,z));
  return{position:point.clone().sub(TOOL_TIP.clone().applyQuaternion(rotation)),rotation};
}

// Head landmarks are in the scan's local coordinates, before the head offset.
// The tool follows short surface strokes, lifting away between passes.
const cutPaths=[
  [v(-1.58,1.75,.30),v(-1.52,2.95,.27)],
  [v(-1.43,2.28,-.70),v(-1.12,3.58,-.54)],
  [v(-.82,3.49,1.00),v(-.66,3.99,-.03)],
  [v(.68,3.37,1.14),v(.79,3.89,-.04)],
  [v(1.42,1.78,.26),v(1.45,2.93,.16)],
  [v(.65,2.28,-1.78),v(.56,3.58,-1.02)],
];
const shavePaths=[
  [v(-.90,.25,1.70),v(-1.13,.89,1.39)],
  [v(.85,.25,1.70),v(1.02,.89,1.35)],
  [v(-.50,-.63,1.81),v(.40,-.38,1.95)],
  [v(-.44,.71,2.17),v(.27,.72,2.18)],
];

// Author the elbow as well as the hand: a wrist-derived shoulder yaw can
// swing the humerus through the torso when a stroke crosses the shoulder.
function solveArm(rig,target,guide,palmRotation){
  // Include the palm offset in the two-link solution. Iterating wrist position
  // and palm rotation can switch between two solutions during a low reach.
  const palm=TOOL_GRIP.clone().multiply(rig.hand.scale).applyQuaternion(palmRotation).add(rig.hand.position);
  const delta=target.clone().sub(rig.arm.position),upper=rig.elbow.position.length(),lower=Math.hypot(palm.y,palm.z);
  const planarSquared=delta.lengthSq()-palm.x*palm.x;
  const flex=Math.acos(THREE.MathUtils.clamp((planarSquared-upper*upper-lower*lower)/(2*upper*lower),-1,1));
  const hinge=Math.atan2(-rig.elbow.position.z,-rig.elbow.position.y);
  const elbow=new THREE.Quaternion().setFromAxisAngle(v(1,0,0),-flex+Math.atan2(palm.z,-palm.y)+hinge);
  const localAxis=palm.clone().applyQuaternion(elbow).add(rig.elbow.position).normalize();
  const localPole=rig.elbow.position.clone().addScaledVector(localAxis,-rig.elbow.position.dot(localAxis)).normalize();
  const axis=delta.normalize(),pole=guide.clone().sub(rig.arm.position);pole.addScaledVector(axis,-pole.dot(axis)).normalize();
  const from=new THREE.Matrix4().makeBasis(localAxis,localPole,localAxis.clone().cross(localPole));
  const to=new THREE.Matrix4().makeBasis(axis,pole,axis.clone().cross(pole));
  return{arm:new THREE.Quaternion().setFromRotationMatrix(to.multiply(from.transpose())),elbow};
}

export function prepareGroomingMotion(milo,station,tools,{origin=new THREE.Vector3()}={}){
  const {head,body}=milo.userData,face=head.getObjectByName('Milo scanned head');
  const {chest,arms,legs}=milo.userData;
  const nodes=[body,chest,head,...arms.flatMap(a=>[a.arm,a.elbow,a.hand,...a.fingers.flatMap(f=>[f,...f.userData.links]),a.thumb,a.thumb.userData.ip]),...legs.flatMap(l=>[l.leg,l.knee,l.boot])];
  const capturePose=()=>nodes.map(node=>({position:node.position.clone(),rotation:node.quaternion.clone(),scale:node.scale.clone()}));
  const blendPose=(pose,weight)=>nodes.forEach((node,i)=>{
    node.position.lerp(pose[i].position,weight);node.quaternion.slerp(pose[i].rotation,weight);node.scale.lerp(pose[i].scale,weight);
  });
  let arrivalPose=null;
  const surface=new THREE.Mesh(face.geometry,new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));
  const ray=new THREE.Raycaster(),center=v(-.11,1.6,head.userData.faceForward/head.scale.x);
  function sampleContact(paths,elapsed,duration,hair){
    const phase=THREE.MathUtils.clamp(elapsed/duration,0,1)*paths.length,index=Math.min(paths.length-1,Math.floor(phase)),u=Math.min(1,phase-index);
    const stroke=s(u,.10,.56),point=paths[index][0].clone().lerp(paths[index][1],stroke);
    if(u>.64)point.lerp(paths[Math.min(index+1,paths.length-1)][index===paths.length-1?1:0],s(u,.64,1));
    point.z+=head.userData.faceForward/head.scale.x;
    const direction=point.clone().sub(center).normalize();ray.set(center.clone().addScaledVector(direction,8),direction.clone().negate());
    const hit=ray.intersectObject(surface)[0];
    // The wide cutting head follows the skull/jaw envelope, not individual
    // ear folds or lip triangles whose normals can flip between frames.
    const normal=hair?direction.clone():v(point.x-center.x,(point.y-.65)*.9,point.z-center.z).normalize();
    if(normal.dot(direction)<0)normal.negate();
    const lift=.018*(1-s(u,0,.12)+s(u,.56,.64))+.025*Math.sin(Math.PI*s(u,.64,1));
    // Keep the blade outside the scan; remaining hair is removed by each pass.
    point.copy(hit?.point??point).multiplyScalar(head.scale.x).applyQuaternion(head.quaternion).add(head.position);
    normal.applyQuaternion(head.quaternion);point.addScaledVector(normal,.006+lift+(hair?.009:0));
    const directionAlong=hair?paths[index][1].clone().sub(paths[index][0]):v(0,1,0);
    if(hair&&u>.64){const next=paths[Math.min(index+1,paths.length-1)];directionAlong.lerp(next[1].clone().sub(next[0]),s(u,.64,1));}
    const pose=contactPose(point,normal,directionAlong.applyQuaternion(head.quaternion),hair);
    const rear=i=>hair&&paths[i][0].z<0?1:0;
    pose.elbowBack=THREE.MathUtils.lerp(rear(index),rear(Math.min(index+1,paths.length-1)),s(u,.64,1));
    return pose;
  }
  const dockPose=name=>{
    body.updateWorldMatrix(true,false);station.docks[name].updateWorldMatrix(true,false);
    return{position:body.worldToLocal(station.docks[name].getWorldPosition(new THREE.Vector3())),rotation:body.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(station.docks[name].getWorldQuaternion(new THREE.Quaternion()))};
  };
  const mix=(a,b,t)=>({position:a.position.clone().lerp(b.position,t),rotation:a.rotation.clone().slerp(b.rotation,t),elbowBack:THREE.MathUtils.lerp(a.elbowBack??0,b.elbowBack??0,t)});
  function holdTool(rig,tool,pose,weight,hair,gripOffset=0){
    const {arm,elbow,hand,fingers,thumb}=rig;
    tool.position.copy(pose.position);tool.quaternion.copy(pose.rotation);
    if(weight<=0)return;
    const rest=[arm,elbow,hand].map(j=>j.quaternion.clone());
    const grip=pose.position.clone().add(v(0,gripOffset,0).applyQuaternion(pose.rotation));
    const target=grip;
    target.x+=rig.side*.09*Math.sin(Math.PI*weight);target.z+=.085*Math.sin(Math.PI*weight);
    const overhead=hair?s(target.y,1.50,1.79):0;
    const back=pose.elbowBack??0;
    const guide=v(rig.side*.56,THREE.MathUtils.lerp(hair?1.28:1.20,1.66,overhead),THREE.MathUtils.lerp(.38,-.32,back));
    const neutral=new THREE.Quaternion().setFromAxisAngle(v(1,0,0),Math.atan2(-hand.position.z,-hand.position.y));
    neutral.multiply(new THREE.Quaternion().setFromAxisAngle(v(0,1,0),rig.side*1.15));
    const solution=solveArm(rig,target,guide,neutral);arm.quaternion.copy(solution.arm);elbow.quaternion.copy(solution.elbow);hand.quaternion.copy(neutral);
    // Blend the reachable outward pose into rest before/after contact. Solving
    // a nearly straight intermediate wrist makes the elbow plane ambiguous.
    [arm,elbow,hand].forEach((joint,i)=>joint.quaternion.slerpQuaternions(rest[i],joint.quaternion.clone(),weight));
    for(const finger of fingers){finger.rotation.x=THREE.MathUtils.lerp(finger.rotation.x,.75,weight);finger.userData.links[0].rotation.x=THREE.MathUtils.lerp(finger.userData.links[0].rotation.x,1.25,weight);finger.userData.links[1].rotation.x=THREE.MathUtils.lerp(finger.userData.links[1].rotation.x,.8,weight);}
    thumb.quaternion.slerp(new THREE.Quaternion().setFromEuler(new THREE.Euler(.25,0,rig.side*.45)),weight);thumb.userData.ip.rotation.x=THREE.MathUtils.lerp(thumb.userData.ip.rotation.x,.7,weight);
  }
  // Lift/retract through free space beside the chest, never straight through
  // the head or shoulder between the back of the scalp and the countertop.
  const travel=(from,to,u,side)=>{
    const via={position:v(side*.32,1.47,.34),rotation:new THREE.Quaternion()};
    return u<.5?mix(from,via,s(u,0,.5)):mix(via,to,s(u,.5,1));
  };
  return{beginVisit(){arrivalPose=capturePose();},update(seconds,{yaw,floor=VANITY.floor,health=null,arrivalWeight=0,standingTurn=null}={}){
    const state=sampleGrooming(seconds),t=state.motionTime;
    // A boolean walk/idle switch discarded up to 40 cm of limb motion in one
    // frame at the doorway and mirror. Shorten the stride into the rest pose.
    delete milo.userData.headingTurn;delete milo.userData.standingTurn;
    animateMilo(milo,{moving:false,time:0,action:null,dt:0,health});
    if(state.walkWeight>0){
      const rest=capturePose();
      applyMocapWalk(milo,miloWalkData,state.walkDistance/miloWalkData.cycleDistance*miloWalkData.duration);
      blendPose(rest,1-state.walkWeight);
    }
    for(const rig of milo.userData.arms)rig.arm.rotation.z+=rig.side*.065*s(t,4,5.5)*(1-s(t,45,46));
    setMealHandFit(milo,s(t,5.5,7)*(1-s(t,44.3,45)));
    milo.position.set(origin.x+state.x,origin.y+floor,origin.z+state.z);milo.rotation.y=yaw??state.yaw;
    const rightCut=s(t,8,9)*(1-s(t,14,15)),leftCut=s(t,20,21)*(1-s(t,26,27));
    const rightCheek=s(t,32,33)*(1-s(t,35,35.5)),leftCheek=s(t,35,35.5)*(1-s(t,37.5,38));
    const chin=s(t,37.5,38)*(1-s(t,40,40.5));
    if(!state.moving)head.rotation.set(-.10*chin,.16*(rightCheek-leftCheek),.065*(leftCut-rightCut));
    const headingOffset=(yaw??state.yaw)-state.yaw;
    if(standingTurn)applyAuthoredMiloTurn(milo,standingTurn.from,standingTurn.to,standingTurn.progress,{upperBody:false});
    else if(t>=4&&t<=5.5)applyAuthoredMiloTurn(milo,Math.PI+headingOffset,Math.PI*1.5+headingOffset,(t-4)/1.5,{upperBody:false});
    else if(t>=46&&t<=48)applyAuthoredMiloTurn(milo,Math.PI*1.5+headingOffset,Math.PI*2+headingOffset,(t-46)/2,{upperBody:false});
    if(arrivalPose&&arrivalWeight>0)blendPose(arrivalPose,arrivalWeight);
    milo.updateWorldMatrix(true,true);
    for(const name of ['clipper','shaver']){const pose=dockPose(name);tools[name].position.copy(pose.position);tools[name].quaternion.copy(pose.rotation);}
    const [right,left]=milo.userData.arms;
    if(t>=5.5&&t<29){
      const dock=dockPose('clipper'),rightPaths=cutPaths.slice(0,3),leftPaths=cutPaths.slice(3);
      const rightStart=sampleContact(rightPaths,0,6,true),rightEnd=sampleContact(rightPaths,6,6,true);
      const leftStart=sampleContact(leftPaths,0,6,true),leftEnd=sampleContact(leftPaths,6,6,true);
      const transfer={position:v(0,1.27,.39),rotation:new THREE.Quaternion()};
      const pose=t<9?travel(dock,rightStart,(t-7)/2,-1):t<15?sampleContact(rightPaths,t-9,6,true):t<16.5?travel(rightEnd,transfer,(t-15)/1.5,-1):t<19?transfer:t<21?travel(transfer,leftStart,(t-19)/2,1):t<27?sampleContact(leftPaths,t-21,6,true):travel(leftEnd,dock,(t-27)/1.3,1);
      if(t<18.5)holdTool(right,tools.clipper,pose,s(t,5.5,7)*(1-s(t,17.5,18.5)),true,-.032*s(t,15,16.5));
      if(t>=16)holdTool(left,tools.clipper,pose,s(t,16,17.5)*(1-s(t,28.3,29)),true,.055*(1-s(t,18.5,19)));
    }else if(t>=29&&t<45){
      const dock=dockPose('shaver'),start=sampleContact(shavePaths,0,10,false),end=sampleContact(shavePaths,10,10,false);
      const pose=t<33?travel(dock,start,(t-31)/2,-1):t<43?sampleContact(shavePaths,t-33,10,false):travel(end,dock,(t-43)/1.3,-1);
      holdTool(right,tools.shaver,pose,s(t,29,31)*(1-s(t,44.3,45)),false);
    }
    milo.userData.updateWristTwists?.();milo.updateWorldMatrix(true,true);return state;
  },dispose(){surface.material.dispose();}};
}
