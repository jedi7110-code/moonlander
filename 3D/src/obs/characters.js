import * as THREE from 'three';
import {ball,box,cylinder,pipe,rod} from './materials.js';
import {createCatEar,createCatTail,animateCatTail} from './cat-anatomy.js';
import {applyCyclingPose} from './gym.js';
import {applyMedicalPose} from './medical.js';
import {applyCatGrooming} from './cat-groom.js';

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
    for(let i=0;i<4;i++)ball(hand,m.skin,(i-1.5)*.014,-.113+Math.abs(i-1.5)*.009,.012,.0075,.035,.009);
    ball(hand,m.skin,-side*.029,-.051,.025,.011,.037,.013);
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
    arms.push({arm,elbow,hand,side});legs.push({leg,knee,boot,side});
  }
  const mug=new THREE.Group();cylinder(mug,m.white,0,0,0,.037,.075,.04,20);const handle=new THREE.Mesh(new THREE.TorusGeometry(.029,.006,8,20),m.white);handle.position.x=.041;mug.add(handle);mug.visible=false;arms[1].hand.add(mug);mug.position.set(0,-.07,.055);
  const bandage=new THREE.Group();bandage.position.y=-.13;arms[0].elbow.add(bandage);bandage.visible=false;
  cylinder(bandage,m.cloth,0,0,0,.049,.105,.049,24);
  for(const y of [-.037,-.013,.013,.037])cylinder(bandage,m.white,0,y,0,.050,.009,.050,24);
  root.userData={body,chest,head,arms,legs,mug,hips,neck,bandage};root.name='Milo Jarvis';return root;
}

export function animateMilo(root,{moving,waiting=false,climbing,facing,action,time,actionTime=time,actionDuration,knock=0,health=null}) {
  const {body,chest,head,arms,legs,mug,bandage}=root.userData;
  const stride=time*(climbing?5.4:6.5),walking=moving&&!climbing&&!waiting;
  const seated=['lounge','console','bunk'].includes(action)&&!moving;
  body.position.y=walking?Math.abs(Math.sin(stride))*.018:Math.sin(time*1.5)*.003;
  body.position.x=0;body.position.z=0;body.rotation.set(0,0,0);chest.scale.x=1+Math.sin(time*1.6)*.006;
  chest.rotation.set(0,0,0);chest.position.set(0,0,0);head.position.set(0,1.637,-.009);
  const desired=climbing?Math.PI:walking||waiting?facing*Math.PI/2:action==='eva'?Math.PI:['airlock','innerHatch'].includes(action)?Math.PI/2:action==='console'?Math.PI*.84:.15;
  root.rotation.y+=Math.atan2(Math.sin(desired-root.rotation.y),Math.cos(desired-root.rotation.y))*.12;
  head.rotation.set(0,!moving?Math.sin(time*.32)*.12:0,0);
  for(const {arm,elbow,hand,side} of arms){arm.position.set(side*.207,1.488,0);hand.rotation.set(0,0,0);arm.rotation.x=walking?Math.sin(stride+side*Math.PI/2)*.42:climbing?-2+Math.sin(stride+side*Math.PI/2)*.35:-.05;
    arm.rotation.z=side*.025;elbow.rotation.x=walking?-.14:climbing?-.70:-.08;
    if(seated){arm.rotation.x=-.65;elbow.rotation.x=-.8;}
    if(action==='galley'||action==='hydro'){arm.rotation.x=side===1?-1.15:-.12;elbow.rotation.x=side===1?-1.1+Math.sin(time*2)*.09:-.15;}
    if(knock>0){arm.rotation.x=-1.5;elbow.rotation.x=-.5-Math.sin(knock*22)*.25;}
  }
  for(const {leg,knee,boot,side} of legs){leg.position.x=side*.100;leg.rotation.x=walking?Math.sin(stride-side*Math.PI/2)*.43:climbing?-.6+Math.sin(stride-side*Math.PI/2)*.47:0;
    knee.rotation.x=walking?Math.max(0,-Math.sin(stride-side*Math.PI/2))*.55:climbing?.9+Math.sin(stride-side*Math.PI/2)*.4:0;
    if(seated){const lounge=action==='lounge';leg.rotation.x=lounge?-1.05:-1.15;knee.rotation.x=lounge?1.20:1.30;body.position.y=lounge?-.214:-.254;}
    boot.rotation.x=seated?-(leg.rotation.x+knee.rotation.x):0;
  }
  if(action==='bunk'&&!moving){body.rotation.z=Math.PI/2;body.position.set(.62,.52,-.7);legs.forEach(({leg,knee,boot})=>{leg.rotation.x=0;knee.rotation.x=.13;boot.rotation.x=0;});arms.forEach(({arm,elbow})=>{arm.rotation.x=-.12;elbow.rotation.x=-.7;});}
  if(action==='gym'&&!moving)applyCyclingPose(root,actionTime);
  if(action==='medical'&&!moving)applyMedicalPose(root,actionTime,actionDuration);
  bandage.visible=Boolean(health?.bandageTime>0||(health?.treatment?.kind==='injury'&&health.treatment.elapsed>health.treatment.duration*.5));
  if(health?.needsCare&&!climbing&&!['medical','gym','bunk','lounge','console'].includes(action)){
    if(health.condition.kind==='injury'){arms[0].arm.rotation.x=-.70;arms[0].elbow.rotation.x=-1.3;}
    else{head.rotation.x=.12+Math.sin(time*9)*.012;body.position.y-=.008;}
  }
  root.visible=!['shower','toilet'].includes(action)||moving;
  mug.visible=['galley','hydro'].includes(action)&&!moving;
}

function coatBall(parent,material,x,y,z,w,h,d){
  const mesh=ball(parent,material,x,y,z,w,h,d);mesh.geometry=mesh.geometry.clone();mesh.updateMatrix();
  const coat=mesh.geometry.attributes.position.clone();coat.applyMatrix4(mesh.matrix);mesh.geometry.setAttribute('coatPosition',coat);return mesh;
}
export function createCat(m) {
  const root=new THREE.Group(),body=joint(root,0,0,0);
  coatBall(body,m.furBody,0,.32,-.055,.157,.184,.33);
  coatBall(body,m.furBody,0,.32,-.265,.165,.184,.17);
  ball(body,m.furLight,0,.36,.16,.125,.18,.17);
  const neck=joint(body,0,.414,.23);ball(neck,m.furLight,0,-.005,0,.105,.135,.12);
  const head=joint(neck,0,.066,.055);
  const eyes=[];
  ball(head,m.furFace,0,0,0,.126,.12,.113);
  ball(head,m.furLight,0,-.055,.064,.088,.063,.086);
  for(const side of [-1,1]){
    ball(head,m.furLight,side*.034,-.043,.102,.044,.032,.039);
    const eye=joint(head,side*.065,.021,.088);eyes.push(eye);
    ball(eye,m.black,0,0,0,.035,.029,.018);
    ball(eye,m.catEye,0,0,.01,.029,.025,.013);
    ball(eye,m.black,0,0,.022,.005,.019,.003);
    ball(eye,m.white,-side*.006,.009,.024,.004,.004,.002);
    for(let i=0;i<4;i++){const curve=new THREE.CatmullRomCurve3([new THREE.Vector3(side*.045,-.035+i*.004,.131),new THREE.Vector3(side*.132,-.022+i*.015,.15),new THREE.Vector3(side*.217,-.039+i*.027,.12)]);
      const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints(curve.getPoints(8)),new THREE.LineBasicMaterial({color:0xc5c5bc,transparent:true,opacity:.55}));head.add(line);}
  }
  ball(head,m.pink,0,-.033,.137,.018,.012,.012);
  pipe(head,m.pink,[[0,-.04,.144],[0,-.062,.14]],.002);
  const tongue=ball(head,m.pink,0,-.070,.153,.014,.005,.018);tongue.visible=false;
  const ears=[-1,1].map(side=>{const ear=createCatEar(m.furEar,side);head.add(ear);return ear;});
  const legs=[];
  for(const z of [-.25,.20])for(const side of [-1,1]){
    const hip=joint(body,side*.101,.33,z);
    limb(hip,z<0?(side<0?m.furGinger:m.fur):m.furLight,.14,[[0,z<0?.087:.047],[.25,z<0?.085:.052],[.75,.034],[1,.033]],1.05);
    const knee=joint(hip,0,-.14,z<0?-.025:0);
    limb(knee,m.furLight,.135,[[0,.032],[.3,.038],[.8,.027],[1,.029]],1.15);
    const foot=joint(knee,0,-.151,.025),paw=ball(foot,m.furLight,0,0,0,.047,.036,.072);
    for(let i=0;i<3;i++)ball(foot,m.furLight,(i-1)*.021,-.003,.049,.014,.024,.022);
    legs.push({hip,knee,foot,paw,side,rear:z<0});
  }
  const tail=createCatTail(m.furTail);body.add(tail);
  root.userData={body,neck,head,ears,eyes,legs,tail,tongue,groom:{weight:0,time:0,lastTime:null,side:-1}};root.name='Ship cat';return root;
}

export function animateCat(root,{time,moving,climbing,facing,mode,passage=null,actionTime=time,remaining=Infinity}) {
  const {body,neck,head,ears,eyes,legs,tail}=root.userData;const gait=time*9;
  const resting=mode==='sleep';body.rotation.set(0,0,0);body.scale.set(1,resting?.72:1,resting?.88:1);body.position.y=resting?-.125:Math.sin(time*2.3)*.003;
  eyes.forEach(eye=>eye.scale.y=resting?.08:1-Math.pow(Math.max(0,Math.sin(time*.42)),60)*.9);
  const direction=climbing?Math.PI:facing*Math.PI/2;
  root.rotation.y+=Math.atan2(Math.sin(direction-root.rotation.y),Math.cos(direction-root.rotation.y))*.12;
  if(passage){root.rotation.y=passage.yaw;body.scale.y=1-passage.crouch*.14;body.position.y=0;}
  body.rotation.x=climbing?-1.0:0;
  for(const {hip,knee,foot,side,rear}of legs){const phase=gait+(side===1?Math.PI:0)+(rear?Math.PI/2:0);hip.rotation.set(moving?Math.sin(phase)*.42:resting?-1.2:0,0,resting?side*.10:0,'XYZ');knee.rotation.x=moving?Math.max(0,-Math.sin(phase))*.6:resting?2.45:0;foot.rotation.set(0,0,0);}
  neck.position.y=mode==='eat'?.299:.414;
  neck.rotation.set(mode==='eat'?.90+Math.sin(time*7)*.045:resting?.72:Math.sin(time*.9)*.04,0,0,'XYZ');
  head.rotation.y=!moving&&mode!=='eat'?Math.sin(time*.42)*.20:0;
  ears.forEach((ear,i)=>ear.rotation.x=(resting?.10:0)+Math.pow(Math.max(0,Math.sin(time*.33+i*2.4)),60)*.10);
  const grooming=applyCatGrooming(root,{time,actionTime,remaining,active:mode==='groom'&&!moving&&!climbing&&!passage,facing,passage});
  animateCatTail(tail,{time,resting,moving,crouching:Boolean(passage),grooming});
}
