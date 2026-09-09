import * as THREE from 'three';
import {ball,box,cylinder,pipe,rod} from './materials.js';
import {createCatEar,createCatTail,animateCatTail,createCatLegSkin,updateCatLegSkins} from './cat-anatomy.js';
import {createCatSkull,createCatEyes,createCatMuzzle,updateCatEyes,catFaceSurface} from './cat-face.js';
import {applyCyclingPose} from './gym.js';
import {applyMedicalPose} from './medical.js';
import {BUNK_BED,reclineProgress,applyReclinedPose} from './recline.js';
import {applyCatGrooming} from './cat-groom.js';
import {createDiningProps,applyDiningPose,resetDiningPose} from './dining.js';
import {applyWalkingPose} from './walking.js';
import {CAT_LIMBS,applyCatLegPose} from './cat-walk.js';
import {LOUNGE_SEAT} from './layout.js';

function joint(parent,x,y,z){const group=new THREE.Group();group.position.set(x,y,z);parent.add(group);return group;}
function limb(parent,mat,length,profile,depth=1) {
  const points=profile.map(([fraction,r])=>new THREE.Vector2(r,-fraction*length)).reverse();
  const geo=new THREE.LatheGeometry(points,24);geo.computeVertexNormals();
  const mesh=new THREE.Mesh(geo,mat);mesh.scale.z=depth;mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;
}

const torsoProfile=[[1.025,.165,.105],[1.09,.159,.107],[1.18,.170,.117],[1.28,.190,.128],[1.36,.197,.126],[1.43,.198,.112],[1.48,.200,.093],[1.51,.180,.081],[1.535,.140,.069],[1.555,.082,.061],[1.575,.061,.060],[1.625,.050,.057]];
function torsoRadius(y,axis){
  let i=0;while(i<torsoProfile.length-2&&y>torsoProfile[i+1][0])i++;
  const a=torsoProfile[i],b=torsoProfile[i+1],before=torsoProfile[Math.max(0,i-1)],after=torsoProfile[Math.min(torsoProfile.length-1,i+2)],h=b[0]-a[0],t=THREE.MathUtils.clamp((y-a[0])/h,0,1);
  const ma=(b[axis]-before[axis])/(b[0]-before[0]),mb=(after[axis]-a[axis])/(after[0]-a[0]);
  return (2*t*t*t-3*t*t+1)*a[axis]+(t*t*t-2*t*t+t)*h*ma+(-2*t*t*t+3*t*t)*b[axis]+(t*t*t-t*t)*h*mb;
}
function surface(parent,material,rows,columns,position){
  const vertices=[],uvs=[],indices=[];
  for(let row=0;row<=rows;row++)for(let col=0;col<=columns;col++){
    vertices.push(...position(row/rows,col/columns));uvs.push(col/columns,row/rows);
    if(row<rows&&col<columns){const a=row*(columns+1)+col,b=a+1,c=a+columns+1,d=c+1;indices.push(a,b,c,b,d,c);}
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));geometry.setIndex(indices);geometry.computeVertexNormals();
  const mesh=new THREE.Mesh(geometry,material);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;
}
function torso(parent,m){
  const skin=surface(parent,m.skin,60,64,(t,u)=>{const y=1.025+t*.60,a=u*Math.PI*2;return[Math.sin(a)*torsoRadius(y,1),y,Math.cos(a)*torsoRadius(y,2)];});skin.name='Continuous shoulders and torso';
  const cloth=surface(parent,m.cloth,40,96,(t,u)=>{
    const a=u*Math.PI*2,s=Math.sin(a),c=Math.cos(a),side=Math.abs(s),strap=Math.exp(-Math.pow((side-.78)/.21,4));
    const top=c>=0?1.345+.11*side*side+.113*strap-.15*Math.pow(side,8):1.435+.035*side+.065*strap-.14*Math.pow(side,8);
    const y=1.045+t*(top-1.045),fold=(Math.sin(a*11+y*27)+Math.sin(a*17-y*12))*.0012*Math.sin(t*Math.PI);
    return[s*(torsoRadius(y,1)+.005+fold),y,c*(torsoRadius(y,2)+.005+fold)];
  });cloth.name='Fitted tank top';
  // Flat fabric straps sit on the shoulder surface instead of floating tubes.
  for(const side of [-1,1])surface(parent,m.cloth,32,8,(t,u)=>{
    const x=side*.126+(u-.5)*.043,z=.096-t*.192;let low=1.30,high=1.58;
    for(let i=0;i<16;i++){const mid=(low+high)/2;if(x*x/torsoRadius(mid,1)**2+z*z/torsoRadius(mid,2)**2>1)high=mid;else low=mid;}
    return[x,(low+high)/2+.005,z];
  });
  return skin;
}

export function createMilo(m,headModel=new THREE.Group()) {
  const root=new THREE.Group(),body=joint(root,0,0,0);
  const pants=m.olive.clone();pants.map=null;pants.bumpScale=.0015;pants.color.setHex(0x4a5338);
  const hips=ball(body,pants,0,.988,0,.177,.134,.119);
  box(body,m.rubber,0,1.074,.002,.331,.038,.225,.012);
  box(body,m.metal,0,1.073,.122,.043,.029,.011,.004);
  for(const x of [-.137,-.063,.063,.137])box(body,pants,x,1.072,.117,.02,.058,.014,.005);
  const chest=joint(body,0,0,0),neck=torso(chest,m);
  const head=headModel;head.position.set(0,1.637,-.009);body.add(head);
  const arms=[],legs=[];
  for(const side of [-1,1]){
    const arm=joint(body,side*.207,1.488,0);arm.rotation.z=side*.025;
    const upper=limb(arm,m.skin,.365,[[0,0],[.025,.028],[.09,.048],[.19,.060],[.35,.059],[.55,.051],[.8,.043],[1,.035]],.92);upper.position.y=.055;
    const elbow=joint(arm,0,-.310,0);
    ball(elbow,m.skin,0,0,0,.035,.039,.032);
    limb(elbow,m.skin,.276,[[0,.034],[.17,.045],[.37,.047],[.62,.037],[.87,.027],[1,.025]],.89);
    const hand=joint(elbow,0,-.274,0);
    ball(hand,m.skin,0,-.045,.007,.034,.054,.022);
    const fingers=[];
    for(let i=0;i<4;i++){
      const finger=joint(hand,(i-1.5)*.014,-.078+Math.abs(i-1.5)*.009,.012);
      ball(finger,m.skin,0,-.014,0,.0075,.016,.009);
      const middle=joint(finger,0,-.028,0);ball(middle,m.skin,0,-.012,0,.0073,.014,.0085);
      const tip=joint(middle,0,-.024,0);ball(tip,m.skin,0,-.009,0,.007,.011,.008);
      finger.userData.links=[middle,tip];fingers.push(finger);
    }
    const thumb=joint(hand,-side*.029,-.051,.025);ball(thumb,m.skin,0,0,0,.011,.037,.013);
    const leg=joint(body,side*.100,.970,0);
    limb(leg,pants,.435,[[0,.087],[.12,.098],[.34,.095],[.66,.081],[.9,.065],[1,.064]],1.05);
    box(leg,pants,side*.078,-.21,.009,.044,.154,.132,.012);
    box(leg,pants,side*.098,-.145,.011,.017,.032,.139,.005);
    const knee=joint(leg,0,-.435,0);
    ball(knee,pants,0,0,0,.064,.065,.064);
    limb(knee,pants,.425,[[0,.064],[.15,.072],[.36,.071],[.64,.060],[.90,.054],[1,.061]],.98);
    for(let i=0;i<2;i++)ball(knee,pants,0,-.359-i*.019,0,.062,.010,.063);
    const boot=joint(knee,0,-.425,.013);
    box(boot,m.rubber,0,-.005,-.025,.123,.13,.166,.024);
    ball(boot,m.rubber,0,-.038,.068,.062,.044,.089);
    box(boot,m.black,0,-.092,.024,.13,.03,.26,.01);
    for(let i=0;i<4;i++)rod(boot,m.dark,[-.036,.039,.005+i*.02],[.036,.037,.005+i*.02],.0035);
    arms.push({arm,elbow,hand,fingers,thumb,side});legs.push({leg,knee,boot,side});
  }
  const dining=createDiningProps(body,m),{mug}=dining;
  const bandage=new THREE.Group();bandage.position.y=-.13;arms[0].elbow.add(bandage);bandage.visible=false;
  cylinder(bandage,m.cloth,0,0,0,.049,.105,.049,24);
  for(const y of [-.037,-.013,.013,.037])cylinder(bandage,m.white,0,y,0,.050,.009,.050,24);
  root.userData={body,chest,head,arms,legs,mug,dining,hips,neck,bandage};root.name='Milo Jarvis';return root;
}

export function animateMilo(root,{moving,waiting=false,climbing,facing,action,time,walkDistance=time*1.188,actionTime=time,actionDuration,knock=0,health=null}) {
  const {body,chest,head,arms,legs,bandage}=root.userData;
  resetDiningPose(root);
  const stride=time*(climbing?5.4:6.5),walking=moving&&!climbing&&!waiting;
  const seated=['lounge','console'].includes(action)&&!moving;
  body.position.y=walking?0:Math.sin(time*1.5)*.003;
  body.position.x=0;body.position.z=0;body.rotation.set(0,0,0);chest.scale.x=1+Math.sin(time*1.6)*.006;
  chest.rotation.set(0,0,0);chest.position.set(0,0,0);head.position.set(0,1.637,-.009);
  const desired=climbing?Math.PI:walking||waiting?facing*Math.PI/2:action==='eva'?Math.PI:['airlock','innerHatch'].includes(action)?Math.PI/2:action==='console'?Math.PI*.84:.15;
  root.rotation.y+=Math.atan2(Math.sin(desired-root.rotation.y),Math.cos(desired-root.rotation.y))*.12;
  head.rotation.set(0,!moving?Math.sin(time*.32)*.12:0,0);
  for(const {arm,elbow,hand,fingers,thumb,side} of arms){arm.position.set(side*.207,1.488,0);hand.rotation.set(0,0,0);arm.rotation.set(climbing?-2+Math.sin(stride+side*Math.PI/2)*.35:-.05,0,side*.025,'XYZ');
    elbow.rotation.set(climbing?-.70:-.08,0,0);
    fingers.forEach(finger=>{finger.rotation.set(0,0,0);finger.userData.links.forEach(link=>link.rotation.set(0,0,0));});thumb.rotation.set(0,0,0);
    if(seated){arm.rotation.x=-.65;elbow.rotation.x=-.8;}
  }
  for(const {leg,knee,boot,side} of legs){leg.position.x=side*.100;leg.rotation.x=climbing?-.6+Math.sin(stride-side*Math.PI/2)*.47:0;
    knee.rotation.x=climbing?.9+Math.sin(stride-side*Math.PI/2)*.4:0;
    if(seated){
      if(action==='lounge'){
        body.position.y=LOUNGE_SEAT.top-(.988-.134);
        // Set the hip on the cushion and solve the thigh slope for a grounded, vertical shin.
        leg.rotation.x=-Math.acos((leg.position.y+body.position.y-.425-.107-.006)/.435);
        knee.rotation.x=-leg.rotation.x;
      }else{leg.rotation.x=-1.15;knee.rotation.x=1.30;body.position.y=-.254;}
    }
    boot.rotation.x=seated?-(leg.rotation.x+knee.rotation.x):0;
  }
  if(walking)applyWalkingPose(root,walkDistance);
  if(knock>0)for(const {arm,elbow}of arms){arm.rotation.x=-1.5;elbow.rotation.x=-.5-Math.sin(knock*22)*.25;}
  if(action==='bunk'&&!moving)applyReclinedPose(root,reclineProgress(actionTime,actionDuration??BUNK_BED.duration,BUNK_BED.transition),BUNK_BED.top);
  if(action==='gym'&&!moving)applyCyclingPose(root,actionTime);
  if(action==='medical'&&!moving)applyMedicalPose(root,actionTime,actionDuration);
  bandage.visible=Boolean(health?.bandageTime>0||(health?.treatment?.kind==='injury'&&health.treatment.elapsed>health.treatment.duration*.5));
  if(health?.needsCare&&!climbing&&!['medical','gym','bunk','lounge','console'].includes(action)){
    if(health.condition.kind==='injury'){arms[0].arm.rotation.x=-.70;arms[0].elbow.rotation.x=-1.3;}
    else{head.rotation.x=.12+Math.sin(time*9)*.012;if(!walking)body.position.y-=.008;}
  }
  root.visible=!['shower','toilet'].includes(action)||moving;
  if(['galley','hydro'].includes(action)&&!moving&&!climbing)applyDiningPose(root,action,actionTime,actionDuration);
}

function coatBall(parent,material,x,y,z,w,h,d){
  const mesh=ball(parent,material,x,y,z,w,h,d);mesh.geometry=mesh.geometry.clone();mesh.updateMatrix();
  const coat=mesh.geometry.attributes.position.clone();coat.applyMatrix4(mesh.matrix);mesh.geometry.setAttribute('coatPosition',coat);return mesh;
}
export function createCat(m) {
  const root=new THREE.Group(),body=joint(root,0,0,0);
  coatBall(body,m.furBody,0,.360,-.055,.143,.146,.34);
  coatBall(body,m.furBody,0,.354,-.265,.146,.147,.17);
  ball(body,m.furLight,0,.374,.145,.112,.137,.123);
  const neck=joint(body,0,.414,.23);ball(neck,m.furLight,0,-.004,-.006,.084,.105,.087);
  const head=joint(neck,0,.066,.055);
  head.add(createCatSkull(m.furFace));
  const eyes=createCatEyes(head,m.furFace);createCatMuzzle(head);
  const tongue=ball(head,m.pink,0,-.070,catFaceSurface(0,-.070)+.012,.014,.005,.018);tongue.visible=false;
  const ears=[-1,1].map(side=>{const ear=createCatEar(m.furEar,side);ear.scale.y=.84;head.add(ear);return ear;});
  const legs=[];
  for(const z of [-.25,.20])for(const side of [-1,1]){
    const rear=z<0,anatomy=CAT_LIMBS[rear?'rear':'front'];
    const hip=joint(body,side*.101,anatomy.height,anatomy.z);
    hip.name=rear?'Hip':'Shoulder';
    const knee=joint(hip,0,-anatomy.upper,0);knee.name=rear?'Stifle':'Elbow';
    const ankle=joint(knee,0,-anatomy.lower,0);ankle.name=rear?'Hock':'Carpus';
    const foot=joint(ankle,0,-anatomy.distal,0),paw=ball(foot,m.furLight,0,0,.011,.044,.033,.060);
    for(let i=0;i<3;i++)ball(foot,m.furLight,(i-1)*.020,-.006,.055,.014,.024,.020);
    const leg={hip,knee,ankle,foot,paw,side,rear,anatomy,body};
    createCatLegSkin(leg,rear?m.furBody:m.furLight);legs.push(leg);
  }
  const tail=createCatTail(m.furTail);body.add(tail);
  root.userData={body,neck,head,ears,eyes,legs,tail,tongue,groom:{weight:0,time:0,lastTime:null,side:-1}};root.name='Ship cat';
  applyCatLegPose(root,{distance:0,moving:false,resting:false});updateCatLegSkins(root);return root;
}

export function animateCat(root,{time,moving,climbing,facing,mode,walkDistance=time*.792,passage=null,actionTime=time,remaining=Infinity}) {
  const {body,neck,head,ears,eyes,tail}=root.userData;
  const resting=mode==='sleep'&&!moving;body.rotation.set(0,0,0);body.scale.set(1,resting?.72:1,resting?.88:1);body.position.y=resting?-.125:moving?Math.sin(walkDistance/.50*Math.PI*4)*.004:Math.sin(time*2.3)*.003;
  eyes.forEach(eye=>eye.scale.y=resting?.08:1-Math.pow(Math.max(0,Math.sin(time*.42)),60)*.9);
  const direction=climbing?Math.PI:facing*Math.PI/2;
  root.rotation.y+=Math.atan2(Math.sin(direction-root.rotation.y),Math.cos(direction-root.rotation.y))*.12;
  if(passage){root.rotation.y=passage.yaw;body.scale.y=1-passage.crouch*.14;body.position.y=0;}
  body.rotation.x=climbing?-1.0:0;
  applyCatLegPose(root,{distance:walkDistance,moving,resting});
  neck.position.y=mode==='eat'?.299:.414;
  neck.rotation.set(mode==='eat'?.90+Math.sin(time*7)*.045:resting?.72:Math.sin(time*.9)*.04,0,0,'XYZ');
  head.rotation.y=!moving&&mode!=='eat'?Math.sin(time*.42)*.20:0;
  ears.forEach((ear,i)=>ear.rotation.x=(resting?.10:0)+Math.pow(Math.max(0,Math.sin(time*.33+i*2.4)),60)*.10);
  const grooming=applyCatGrooming(root,{time,actionTime,remaining,active:mode==='groom'&&!moving&&!climbing&&!passage,facing,passage});
  updateCatEyes(eyes);
  updateCatLegSkins(root);
  animateCatTail(tail,{time,resting,moving,crouching:Boolean(passage),grooming});
}
