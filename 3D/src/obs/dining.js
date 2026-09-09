import * as THREE from 'three';
import {ball,rod} from './materials.js';
import {hingeAngles} from './gym.js';

const clamp=THREE.MathUtils.clamp,lerp=THREE.MathUtils.lerp;
const smooth=value=>{const t=clamp(value,0,1);return t*t*(3-2*t);};
const v=(x,y,z)=>new THREE.Vector3(x,y,z);
const bowlHand=new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI/2,0,Math.PI/2)),spoonHand=new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI/2,0,-.12));
const cupHand=new THREE.Quaternion().setFromAxisAngle(v(0,1,0),Math.PI);
const cupRim=v(0,.067,-.043),cupGrip=v(.097,.067,.019),spoonGrip=v(.027,.018,.164),bowlGrip=v(-.134,-.058,.015);

export function mouthPosition(head){
  // Lip landmark on the head scan, in metres relative to the neck joint.
  return v(-.006,.02475,.1254).applyQuaternion(head.quaternion).add(head.position);
}

function lathe(parent,material,profile,name){
  const mesh=new THREE.Mesh(new THREE.LatheGeometry(profile.map(([r,y])=>new THREE.Vector2(r,y)),48),material);
  mesh.name=name;mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;
}

export function createDiningProps(body,m){
  const mug=new THREE.Group(),bowl=new THREE.Group(),spoon=new THREE.Group();
  const steel=new THREE.MeshStandardMaterial({color:0xc0c8c7,roughness:.32,metalness:.48});
  mug.name='Drinking cup';bowl.name='Meal bowl';spoon.name='Meal spoon';
  for(const prop of [mug,bowl,spoon]){body.add(prop);prop.visible=false;}
  lathe(mug,m.white,[[0,-.064],[.032,-.064],[.039,-.056],[.046,.059],[.045,.067],[.041,.068],[.039,.057],[.033,-.052],[0,-.052]],'Hollow enamel cup');
  const handle=new THREE.Mesh(new THREE.TorusGeometry(.032,.006,12,32),m.white);
  handle.position.set(.066,.003,0);handle.scale.y=1.18;mug.add(handle);
  const water=ball(mug,m.water??m.metal,0,-.026,0,.033,.002,.033);water.name='Cup liquid surface';
  lathe(bowl,steel,[[0,-.042],[.061,-.042],[.080,-.025],[.102,.034],[.108,.041],[.107,.047],[.102,.047],[.096,.035],[.074,-.023],[0,-.031]],'Open meal bowl');
  const mealMaterial=new THREE.MeshStandardMaterial({color:0xad8649,roughness:.92});
  const meal=ball(bowl,mealMaterial,0,.017,0,.088,.015,.088);
  for(let i=0;i<18;i++){
    const angle=i*2.39996,r=.073*Math.sqrt((i+.5)/18);
    ball(meal,mealMaterial,Math.cos(angle)*r/.088,.8,Math.sin(angle)*r/.088,.08,.25,.10);
  }
  // The spoon origin is the bowl of the spoon, so it can meet the lips directly.
  const spoonBowl=lathe(spoon,steel,[[0,-.004],[.010,-.004],[.018,.001],[.020,.006],[.018,.007],[.010,0],[0,0]],'Spoon bowl');spoonBowl.scale.z=1.45;
  rod(spoon,steel,[0,.002,.019],[0,.006,.148],.004);
  const bite=ball(spoon,mealMaterial,0,.007,0,.015,.006,.021);
  return{mug,bowl,spoon,bite,meal,water};
}

function pointOn(prop,point){return point.clone().applyQuaternion(prop.quaternion).add(prop.position);}

function placeHand(rig,target,rotation,grip){
  const {arm,elbow,hand}=rig,offset=target.clone().sub(arm.position);
  const yaw=Math.atan2(offset.x,offset.z),angles=hingeAngles(offset.y,Math.hypot(offset.x,offset.z),.310,.274,-1);
  arm.rotation.set(angles.upper,yaw,0,'YXZ');elbow.rotation.set(angles.lower,0,0);
  hand.quaternion.copy(arm.quaternion).multiply(elbow.quaternion).invert().multiply(rotation);
  for(const [i,finger] of (rig.fingers??[]).entries()){
    finger.rotation.x=-grip*(.45+i*.04);
    finger.userData.links[0].rotation.x=-grip*.95;
    finger.userData.links[1].rotation.x=-grip*.7;
  }
  if(rig.thumb)rig.thumb.rotation.z=rig.side*.35*grip;
}

function mixPoint(points,phase){
  for(let i=1;i<points.length;i++)if(phase<=points[i][0]){
    const [a,p]=points[i-1],[b,q]=points[i];return p.clone().lerp(q,smooth((phase-a)/(b-a)));
  }
  return points.at(-1)[1].clone();
}

export function applyDiningPose(root,action,time,duration=action==='galley'?6:5){
  const {head,arms,dining}=root.userData,{mug,bowl,spoon,bite,meal,water}=dining;
  const progress=clamp(time/Math.max(duration,.1),0,1),ready=smooth(progress/.13)*smooth((1-progress)/.13);
  head.rotation.set(.10*(1-ready),0,0);
  const mouth=mouthPosition(head);
  if(action==='hydro'){
    mug.visible=true;
    const lift=smooth((progress-.14)/.18)*(1-smooth((progress-.73)/.17));
    const tilt=.94*smooth((progress-.33)/.13)*(1-smooth((progress-.62)/.11));
    head.rotation.x=-.045*(tilt/.94);
    const lip=mouthPosition(head),rest=v(.17,lerp(.96,1.26,ready),lerp(.10,.35,ready));
    mug.rotation.set(-tilt,0,0);
    const contact=lip.clone().add(v(0,-.002,.006)).sub(cupRim.clone().applyQuaternion(mug.quaternion));
    mug.position.copy(rest).lerp(contact,lift);
    placeHand(arms[1],pointOn(mug,cupGrip),mug.quaternion.clone().multiply(cupHand),1.1);
    water.visible=tilt<.35;water.position.y=-.026-.015*smooth((progress-.42)/.2);
    if(head.userData.setMouthMotion)head.userData.setMouthMotion(0,tilt>.6?.22:0);
    return;
  }
  bowl.visible=true;spoon.visible=true;
  bowl.position.set(-.095,lerp(1.04,1.215,ready),lerp(.16,.285,ready));bowl.rotation.set(0,0,.025);
  placeHand(arms[0],pointOn(bowl,bowlGrip),bowlHand,.75);
  const cycle=clamp((progress-.13)/.74,0,1)*2,phase=cycle===2?1:cycle%1;
  const scoop=bowl.position.clone().add(v(.025,.028,.009));
  const lifted=scoop.clone().add(v(.038,.10,.035)),atMouth=mouth.clone().add(v(0,.002,.014)),withdrawn=atMouth.clone().add(v(.065,-.085,.15));
  const tip=mixPoint([[0,scoop],[.17,lifted],[.43,atMouth],[.54,atMouth],[.76,withdrawn],[1,scoop]],phase);
  const rest=v(.16,1,.08);spoon.position.copy(rest).lerp(tip,ready);spoon.rotation.set(-.1*(1-smooth(phase/.25)),0,-.06*(1-ready));
  placeHand(arms[1],pointOn(spoon,spoonGrip),spoon.quaternion.clone().multiply(spoonHand),1.15);
  bite.visible=progress>.13&&progress<.87&&phase>.10&&phase<.50;
  meal.position.y=.017-.006*Math.min(2,Math.floor(cycle+.5));
  const eating=ready*smooth((phase-.30)/.1)*(1-smooth((phase-.54)/.06));
  const chewing=ready*(phase>.57?Math.sin((phase-.57)*Math.PI*10)**2*.35:0);
  if(head.userData.setMouthMotion)head.userData.setMouthMotion(eating,chewing);
}

export function resetDiningPose(root){
  const {dining,head}=root.userData;
  for(const prop of [dining.mug,dining.bowl,dining.spoon])prop.visible=false;
  if(head.userData.setMouthMotion)head.userData.setMouthMotion(0,0);
}
