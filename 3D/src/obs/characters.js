import * as THREE from 'three';
import {angleDelta,turnTowards} from './heading.js';
import {ball,box,cylinder,pipe,rod} from './materials.js';
import {createCatEar,createCatTail,animateCatTail,createCatLegSkin,updateCatLegSkins} from './cat-anatomy.js';
import {createCatSkull,createCatEyes,createCatMuzzle,updateCatEyes,catFaceSurface} from './cat-face.js';
import {applyCyclingPose,applyGymVisitPose} from './gym.js';
import {applyMedicalPose,medicalExitTime} from './medical.js';
import {BUNK_BED,reclineProgress,applyReclinedPose,reclineExitProgress} from './recline.js';
import {applyBunkVisitPose,applySleepingHands} from './bunk-pose.js';
import {applyCatGrooming} from './cat-groom.js';
import {applyCatHop} from './cat-hop.js';
import {restWeight,applyCatSitting} from './cat-rest.js';
import {createDiningProps,applyDiningPose,resetDiningPose,diningPhase,placeHand,DINING_APPROACH} from './dining.js';
import {applyWalkingPose} from './walking.js';
import {applyMocapWalk,miloWalkData} from './mocap-walk.js';
import {relaxMiloHand} from './milo-hands.js';
export {relaxMiloHand} from './milo-hands.js';
import {applyCallingPose} from './calling.js';
import {CAT_LIMBS,applyCatLegPose,placeCatPaw} from './cat-walk.js';
import {createLeisureProps,applyLeisurePose,applyDeskHands} from './leisure.js';
import {setTabletHandFit} from './tablet-pose.js';
import {setLadderHandFit} from './ladder-hand-fit.js';
import {applyLoungeExit,applyLoungeEntry,loungeExitPose,loungeEntryAge} from './lounge-exit.js';
import {applySeatedLegSpread} from './seated-pose.js';
import {LOUNGE_SEAT,CAT_SCALE,CAT_BOWL} from './layout.js';
import {attachMiloBody} from './milo-body.js';
import {attachMiloWatch,updateMiloWatch} from './milo-watch.js';

function joint(parent,x,y,z){const group=new THREE.Group();group.position.set(x,y,z);parent.add(group);return group;}
function limb(parent,mat,length,profile,depth=1) {
  const points=profile.map(([fraction,r])=>new THREE.Vector2(r,-fraction*length)).reverse();
  const geo=new THREE.LatheGeometry(points,24);geo.computeVertexNormals();
  const mesh=new THREE.Mesh(geo,mat);mesh.scale.z=depth;mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;
}

function bootFootprint(side,scale=1){
  const shape=new THREE.Shape(),points=[
    [0,-.098],[.024,-.094],[.040,-.080],[.051,-.057],[.056,-.027],[.064,.018],[.068,.050],[.064,.088],[.052,.130],[.035,.158],[.010,.177],
    [-.013,.179],[-.036,.165],[-.053,.141],[-.063,.105],[-.065,.068],[-.063,.030],[-.053,-.016],[-.048,-.047],[-.038,-.078],[-.020,-.094]
  ].map(([x,z])=>[x*side*scale,z*scale]);
  const outline=new THREE.CatmullRomCurve3(points.map(([x,z])=>new THREE.Vector3(x,z,0)),true,'centripetal').getPoints(96);
  shape.moveTo(outline[0].x,outline[0].y);for(const p of outline.slice(1))shape.lineTo(p.x,p.y);shape.closePath();return shape;
}
function shapedSole(parent,material,side,{depth,bevel,y,name,scale=1}){
  const geometry=new THREE.ExtrudeGeometry(bootFootprint(side,scale),{depth,bevelEnabled:true,bevelSegments:2,bevelSize:bevel,bevelThickness:bevel,steps:1});
  geometry.rotateX(Math.PI/2);geometry.translate(0,y,0);geometry.computeVertexNormals();
  if(name==='Anatomical combat boot sole'){
    const p=geometry.attributes.position;
    for(let i=0;i<p.count;i++){
      const arch=THREE.MathUtils.smoothstep(p.getZ(i),-.042,-.020)*(1-THREE.MathUtils.smoothstep(p.getZ(i),.012,.040));
      const bottom=1-THREE.MathUtils.smoothstep(p.getY(i),y-depth+.002,y-.002);
      p.setY(i,p.getY(i)+.009*arch*bottom);
    }
    geometry.computeVertexNormals();
  }
  const mesh=new THREE.Mesh(geometry,material);mesh.name=name;mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;
}
const bootSections=[
  [-.064,.060,.166,-.090],[-.047,.063,.174,-.092],[-.026,.063,.161,-.092],
  [-.006,.061,.122,-.091],[.016,.058,.081,-.089],[.040,.057,.060,-.087],
  [.064,.057,.055,-.084],[.086,.058,.055,-.082],
];
function bootSection(y){
  let i=0;while(i<bootSections.length-2&&y>bootSections[i+1][0])i++;
  const a=bootSections[i],b=bootSections[i+1],before=bootSections[Math.max(0,i-1)],after=bootSections[Math.min(bootSections.length-1,i+2)];
  const h=b[0]-a[0],t=THREE.MathUtils.clamp((y-a[0])/h,0,1);
  return [1,2,3].map(k=>{
    const ma=(b[k]-before[k])/(b[0]-before[0]),mb=(after[k]-a[k])/(after[0]-a[0]);
    return THREE.MathUtils.clamp((2*t**3-3*t*t+1)*a[k]+(t**3-2*t*t+t)*h*ma+(-2*t**3+3*t*t)*b[k]+(t**3-t*t)*h*mb,Math.min(a[k],b[k]),Math.max(a[k],b[k]));
  });
}
function bootFront(y,x){
  const [width,front,rear]=bootSection(y);
  return (front+rear)/2+(front-rear)/2*Math.sqrt(Math.max(0,1-(x/width)**2));
}
let bootGrain=null;
function bootLeather(){
  if(!bootGrain){
    const pixels=new Uint8Array(64*64*4);let seed=2718;
    for(let i=0;i<pixels.length;i+=4){seed=(Math.imul(seed,1664525)+1013904223)>>>0;pixels[i]=pixels[i+1]=pixels[i+2]=110+(seed>>>26);pixels[i+3]=255;}
    bootGrain=new THREE.DataTexture(pixels,64,64);bootGrain.wrapS=bootGrain.wrapT=THREE.RepeatWrapping;bootGrain.repeat.set(4,4);bootGrain.magFilter=THREE.LinearFilter;bootGrain.needsUpdate=true;
  }
  return new THREE.MeshStandardMaterial({color:0x554735,roughness:.73,metalness:0,bumpMap:bootGrain,bumpScale:.00035});
}
export function createMiloBoot(parent,m,side){
  const boot=joint(parent,0,-.425,.013);boot.name='Laced combat boot';
  const leather=bootLeather(),welt=leather.clone(),laces=m.cloth.clone();
  welt.color.setHex(0x736249);laces.color.setHex(0xc4b995);laces.roughness=.88;

  shapedSole(boot,m.rubber,side,{depth:.024,bevel:.003,y:-.073,name:'Anatomical combat boot sole'});
  shapedSole(boot,welt,side,{depth:.008,bevel:.0015,y:-.064,name:'Foot-shaped stitched boot welt',scale:.985});
  const lugRows=[[-.073,.021],[-.045,.032],[.046,.047],[.077,.044],[.109,.036],[.137,.026],[.162,.012]];
  for(const [z,width]of lugRows)for(const x of [-width,0,width]){
    if(x===0&&Math.abs(z)<.03)continue;
    const lug=box(boot,m.rubber,x,-.102,z,x===0?.024:.020,.010,.024,.002);lug.name='Combat boot sole lug';
    lug.rotation.y=x===0?0:-Math.sign(x)*THREE.MathUtils.lerp(.08,.34,THREE.MathUtils.clamp((z+.09)/.23,0,1));
  }

  const upper=surface(boot,leather,56,64,(t,u)=>{
    const y=-.064+t*.150,[width,front,rear]=bootSection(y),angle=u*Math.PI*2;
    return [Math.sin(angle)*width,y,(front+rear)/2+Math.cos(angle)*(front-rear)/2];
  });upper.name='Continuous leather boot upper';

  const rows=[-.026,-.009,.007,.023,.040,.057,.074].map(y=>[y,bootFront(y,.032)]);
  for(const [row,[y,z]]of rows.entries()){
    for(const side of [-1,1]){
      const eyelet=new THREE.Mesh(new THREE.TorusGeometry(.0052,.0016,6,16),m.metal);
      eyelet.name='Metal boot eyelet';eyelet.position.set(side*.032,y,z+.002);
      const slope=(bootFront(y+.001,.032)-bootFront(y-.001,.032))/.002;
      eyelet.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),new THREE.Vector3(side*.4,-slope,1).normalize());
      eyelet.castShadow=true;boot.add(eyelet);
    }
    if(row<rows.length-1){
      const [nextY,nextZ]=rows[row+1];
      for(const side of [-1,1]){
        const midY=(y+nextY)/2;
        const lace=pipe(boot,laces,[[side*.032,y,z+.005],[0,midY,bootFront(midY,0)+.004],[-side*.032,nextY,nextZ+.005]],.0018);lace.name='Crossed boot lace';
      }
    }
  }
  const [topY]=rows.at(-1),topZ=bootFront(topY,0);
  pipe(boot,laces,[[-.032,topY,bootFront(topY,.032)+.005],[0,topY,topZ+.004],[.032,topY,bootFront(topY,.032)+.005]],.0018).name='Tightened top lace';
  for(const side of [-1,1]){
    pipe(boot,laces,[[side*.006,topY,topZ+.016],[side*.030,.079,.069],[side*.050,.066,.061],[side*.026,.057,.064],[side*.006,topY,topZ+.016]],.0017).name='Tied boot lace loop';
    pipe(boot,laces,[[side*.006,topY,topZ+.016],[side*.020,.048,.075],[side*.029,.030,.079]],.0015).name='Boot lace end';
  }
  return boot;
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
    const a=u*Math.PI*2,s=Math.sin(a),c=Math.cos(a),side=Math.abs(s);
    const top=c>=0?1.535+.045*side:1.558+.025*side;
    const y=1.045+t*(top-1.045),fold=(Math.sin(a*11+y*27)+Math.sin(a*17-y*12))*.0012*Math.sin(t*Math.PI);
    return[s*(torsoRadius(y,1)+.005+fold),y,c*(torsoRadius(y,2)+.005+fold)];
  });cloth.name='Crew neck T-shirt';
  return skin;
}

export function createMilo(m,headModel=new THREE.Group()) {
  const root=new THREE.Group(),body=joint(root,0,0,0);
  const pants=m.olive.clone();pants.userData.fabricMap=pants.map;pants.map=null;pants.bumpScale=.004;pants.color.setHex(0x4a5338);pants.roughness=.96;
  const hips=ball(body,pants,0,.988,0,.177,.134,.119);
  const chest=joint(body,0,0,0),neck=torso(chest,m);
  const head=headModel;head.position.set(0,1.637,-.009);body.add(head);
  const arms=[],legs=[];
  for(const side of [-1,1]){
    const arm=joint(body,side*.207,1.488,0);arm.rotation.z=side*.025;
    const upper=limb(arm,m.skin,.365,[[0,0],[.025,.028],[.09,.048],[.19,.060],[.35,.059],[.55,.051],[.8,.043],[1,.035]],.92);upper.position.y=.055;
    const sleeve=limb(arm,m.cloth,.215,[[0,.033],[.12,.056],[.35,.072],[.7,.068],[1,.062]],.96);sleeve.position.y=.025;sleeve.name='T-shirt short sleeve';
    const elbow=joint(arm,0,-.310,0);
    ball(elbow,m.skin,0,0,0,.035,.039,.032);
    limb(elbow,m.skin,.246,[[0,.034],[.17,.045],[.37,.047],[.62,.037],[.87,.027],[1,.025]],.89);
    const hand=joint(elbow,0,-.244,0);
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
    thumb.userData.ip=joint(thumb,-side*.008,-.023,-.046);
    const leg=joint(body,side*.100,.970,0);
    limb(leg,pants,.435,[[0,.087],[.12,.098],[.34,.095],[.66,.081],[.9,.065],[1,.064]],1.05);
    const knee=joint(leg,0,-.435,0);
    ball(knee,pants,0,0,0,.064,.065,.064);
    limb(knee,pants,.425,[[0,.064],[.15,.072],[.36,.071],[.64,.060],[.90,.054],[1,.061]],.98);
    for(let i=0;i<2;i++)ball(knee,pants,0,-.359-i*.019,0,.062,.010,.063);
    const boot=createMiloBoot(knee,m,side);
    arms.push({arm,elbow,hand,fingers,thumb,side});legs.push({leg,knee,boot,side});
  }
  const headParts=new Set();head.traverse(o=>headParts.add(o));
  const legacy=[];body.traverse(o=>{if(o.isMesh&&!headParts.has(o)&&[m.skin,m.cloth,pants].includes(o.material))legacy.push(o);});
  const dining=createDiningProps(body,m),{mug}=dining;
  const bandage=new THREE.Group();bandage.position.y=-.13;arms[0].elbow.add(bandage);bandage.visible=false;
  cylinder(bandage,m.cloth,0,0,0,.049,.105,.049,24);
  for(const y of [-.037,-.013,.013,.037])cylinder(bandage,m.white,0,y,0,.050,.009,.050,24);
  const leisure=createLeisureProps(body,m);
  root.userData={body,chest,head,arms,legs,mug,dining,hips,neck,bandage,leisure};root.name='Milo Jarvis';attachMiloBody(root,m,pants,legacy);
  for(const {hand} of arms)hand.scale.multiplyScalar(1.08);
  root.userData.updateWristTwists?.();attachMiloWatch(root);return root;
}

export function animateMilo(root,{moving,waiting=false,climbing,facing,action,time,dt=1/60,walkDistance=time*1.188,walkStyle='measured',actionTime=time,actionDuration,callingTime=null,health=null,bathroom=null,diningDocks=null,leisure=null,catReady=false,loungeExit=null,gymVisit=null,loungeEntry=null,reclineExit=null,bunkVisit=null}) {
  const {body,chest,head,arms,legs,bandage}=root.userData;
  setLadderHandFit(root,false);
  setTabletHandFit(root,action==='lounge'&&!moving&&leisure==='tablet');
  if(action==='medical'&&!moving)root.userData.medicalStartYaw??=root.rotation.y;
  else delete root.userData.medicalStartYaw;
  if(bathroom)root.userData.bathroomStartYaw??=root.rotation.y;
  else delete root.userData.bathroomStartYaw;
  if(action==='bunk'&&!moving)root.userData.bunkStartYaw??=root.rotation.y;
  else delete root.userData.bunkStartYaw;
  resetDiningPose(root);
  for(const prop of ['tablet','phones','toy'])root.userData.leisure[prop].visible=false;
  const stride=time*(climbing?5.4:6.5),walking=moving&&!climbing&&!waiting;
  const seated=['lounge','console'].includes(action)&&!moving;
  body.position.y=walking?0:Math.sin(time*1.5)*.003;
  body.position.x=0;body.position.z=0;body.rotation.set(0,0,0);chest.scale.x=1+Math.sin(time*1.6)*.006;
  chest.rotation.set(0,0,0);chest.position.set(0,0,0);head.position.set(0,1.637,-.009);
  const dining=['galley','hydro'].includes(action)&&!moving;
  const calling=callingTime!==null&&!moving&&!action;
  const desired=bathroom?root.userData.bathroomStartYaw+angleDelta(root.userData.bathroomStartYaw,bathroom.yaw??0)*(bathroom.turn??1):dining||climbing||calling?Math.PI:walking||waiting?(facing||1)*Math.PI/2:['eva','plant'].includes(action)?Math.PI:['airlock','innerHatch'].includes(action)?Math.PI/2:action==='console'?Math.PI*.84:action ? .15 : root.rotation.y;
  const authored=bathroom||bunkVisit||gymVisit||(action==='medical'&&!moving)||reclineExit||(action==='bunk'&&!moving);
  if(authored)delete root.userData.headingTurn;
  else turnTowards(root,desired,dt);
  head.rotation.set(0,!moving?Math.sin(time*.32)*.12:0,0);
  for(const {arm,elbow,hand,fingers,thumb,side} of arms){arm.position.set(side*.207,1.488,0);hand.rotation.set(0,root.userData.bodySkin?side*Math.PI/2:0,0);arm.rotation.set(climbing?-2+Math.sin(stride+side*Math.PI/2)*.35:-.05,0,side*.025,'XYZ');
    elbow.rotation.set(climbing?-.70:-.08,0,0);
    fingers.forEach(finger=>{finger.rotation.set(0,0,0);finger.userData.links.forEach(link=>link.rotation.set(0,0,0));});thumb.position.set(-side*.029,-.051,.025);thumb.rotation.set(0,0,0);thumb.userData.ip.rotation.set(0,0,0);
    if(!climbing&&(moving||!action||action==='gym'))relaxMiloHand({fingers,thumb,side});
    if(seated){arm.rotation.x=-.65;elbow.rotation.x=-.8;}
  }
  for(const {leg,knee,boot,side} of legs){leg.position.x=side*.100;leg.rotation.set(climbing?-.6+Math.sin(stride-side*Math.PI/2)*.47:0,0,0,'XYZ');
    knee.rotation.set(climbing?.9+Math.sin(stride-side*Math.PI/2)*.4:0,0,0);
    if(seated){
      if(action==='lounge'){
        body.position.y=LOUNGE_SEAT.top-(.988-.134);
        // Set the hip on the cushion and solve the thigh slope for a grounded, vertical shin.
        leg.rotation.x=-Math.acos((leg.position.y+body.position.y-.425-.107-.006)/.435);
        knee.rotation.x=-leg.rotation.x;
      }else{leg.rotation.x=-1.15;knee.rotation.x=1.30;body.position.y=-.254;}
    }
    boot.rotation.set(seated?-(leg.rotation.x+knee.rotation.x):0,0,0);
  }
  if(walking){
    if(walkStyle==='legacy')applyWalkingPose(root,walkDistance);
    else applyMocapWalk(root,miloWalkData,walkDistance/miloWalkData.cycleDistance*miloWalkData.duration);
  }
  if(seated&&action==='lounge'&&!leisure)applyDeskHands(root);
  applyCallingPose(root,calling?callingTime:null,dt);
  if(seated&&action==='lounge'&&leisure)applyLeisurePose(root,leisure,actionTime,actionDuration,catReady);
  if(loungeExit)applyLoungeExit(root,loungeExit);
  if(loungeEntry)applyLoungeEntry(root,loungeEntry);
  if(seated){
    const rise=loungeExit?loungeExitPose(loungeExit.age).rise:loungeEntry?loungeExitPose(loungeEntryAge(loungeEntry.age)).rise:0;
    applySeatedLegSpread(root,1-rise);
  }
  if(action==='bunk'&&!moving)applyReclinedPose(root,reclineProgress(actionTime,actionDuration??BUNK_BED.duration,BUNK_BED.transition),BUNK_BED.top,root.userData.bunkStartYaw);
  if(action==='gym'&&!moving){if(gymVisit)applyGymVisitPose(root,gymVisit);else applyCyclingPose(root,actionTime);}
  if(action==='medical'&&!moving)applyMedicalPose(root,actionTime,actionDuration,root.userData.medicalStartYaw);
  if(reclineExit?.id==='medical')applyMedicalPose(root,medicalExitTime(reclineExit),reclineExit.actionDuration,root.userData.medicalStartYaw);
  else if(reclineExit)applyReclinedPose(root,reclineExitProgress(reclineExit),BUNK_BED.top,root.userData.bunkStartYaw);
  if(bunkVisit)applyBunkVisitPose(root,bunkVisit);
  else if(action==='bunk'&&!moving)applySleepingHands(root,reclineExit?reclineExitProgress(reclineExit):reclineProgress(actionTime,actionDuration??BUNK_BED.duration,BUNK_BED.transition));
  if(action==='plant'&&!moving){
    const weight=THREE.MathUtils.smoothstep(Math.min(actionTime,(actionDuration??9)-actionTime),0,1.2);
    for(const {arm,elbow,side,hand}of arms){
      arm.rotation.x=THREE.MathUtils.lerp(-.05,-1.12+Math.sin(actionTime*2+side)*.12,weight);
      elbow.rotation.x=THREE.MathUtils.lerp(-.08,-.8,weight);hand.rotation.y=side*.5*weight;
    }
    head.rotation.x=.20*weight;
  }
  bandage.visible=Boolean(health?.bandageTime>0||(health?.treatment?.kind==='injury'&&health.treatment.elapsed>health.treatment.duration*.5));
  if(health?.needsCare&&!climbing&&!['medical','gym','bunk','lounge','console'].includes(action)){
    if(health.condition.kind==='injury'){arms[0].arm.rotation.x=-.70;arms[0].elbow.rotation.x=-1.3;}
    else{head.rotation.x=.12+Math.sin(time*9)*.012;if(!walking)body.position.y-=.008;}
  }
  root.visible=true;
  if(bathroom){
    root.position.z=bathroom.depth;root.rotation.y=desired;
    if(bathroom.moving)applyWalkingPose(root,bathroom.walkDistance);
    if(bathroom.reach>0){
      root.updateWorldMatrix(true,true);
      const target=body.worldToLocal(new THREE.Vector3(root.position.x+.56,root.position.y+1.17,.58));
      const wrist=body.worldToLocal(arms[0].hand.getWorldPosition(new THREE.Vector3()));
      placeHand(arms[0],wrist.lerp(target,bathroom.reach),new THREE.Quaternion(),.4*bathroom.reach);
    }
  }
  if(dining&&!climbing){
    const phase=diningPhase(actionTime,actionDuration??(action==='galley'?6:5));
    if(phase.approach>0&&phase.approach<1){
      applyWalkingPose(root,DINING_APPROACH*phase.approach);
      const weight=Math.sin(Math.PI*phase.approach);
      for(const {leg,knee,boot}of legs){leg.rotation.x*=weight;knee.rotation.x*=weight;boot.rotation.x*=weight;}
    }
    body.position.y=0;applyDiningPose(root,action,actionTime,actionDuration,diningDocks);
  }
  root.userData.updateWristTwists?.();
  updateMiloWatch(root,time);
  // Raycast bounds must follow the current pose, not the first observed pose.
  if(root.userData.bodySkin){root.userData.bodySkin.boundingBox=null;root.userData.bodySkin.boundingSphere=null;}
}

function coatBall(parent,material,x,y,z,w,h,d){
  const mesh=ball(parent,material,x,y,z,w,h,d);mesh.geometry=mesh.geometry.clone();mesh.updateMatrix();
  const coat=mesh.geometry.attributes.position.clone();coat.applyMatrix4(mesh.matrix);mesh.geometry.setAttribute('coatPosition',coat);return mesh;
}
export function createCat(m) {
  const root=new THREE.Group(),body=joint(root,0,0,0);
  root.scale.setScalar(CAT_SCALE);
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
  root.userData={body,neck,head,ears,eyes,legs,tail,tongue,groom:{weight:0,time:0,lastTime:null,side:-1}};root.name='Lucy';
  applyCatLegPose(root,{distance:0,moving:false,resting:false});updateCatLegSkins(root);return root;
}

export function animateCat(root,{time,moving,climbing,facing,mode,walkDistance=time*.792,passage=null,hop=null,actionTime=time,remaining=Infinity,playRelease=null}) {
  const {body,neck,head,ears,eyes,tail}=root.userData;
  // Gait works in model coordinates; incoming travel is measured in ship coordinates.
  walkDistance/=root.scale.x;
  const quiet=!moving&&!passage&&!hop,sleep=mode==='sleep'&&quiet?restWeight(actionTime,remaining,2.2):0,eat=mode==='eat'&&quiet?restWeight(actionTime,remaining,1.6):0,sitting=['look','play'].includes(mode)&&quiet?restWeight(actionTime,remaining,1.5):0;
  const resting=sleep>.5;body.rotation.set(0,0,0);body.scale.set(1,1-.04*sleep,1-.08*sleep);body.position.y=-.17*sleep+(moving?Math.sin(walkDistance/.50*Math.PI*4)*.004:Math.sin(time*2.3)*.003)*(1-sleep);
  eyes.forEach(eye=>eye.scale.y=THREE.MathUtils.lerp(1-Math.pow(Math.max(0,Math.sin(time*.42)),60)*.9,.08,sleep));
  const direction=hop?.yaw??(climbing?Math.PI:facing*Math.PI/2);
  root.rotation.y+=Math.atan2(Math.sin(direction-root.rotation.y),Math.cos(direction-root.rotation.y))*.12;
  if(passage){root.rotation.y=passage.yaw;body.scale.y=1-passage.crouch*.14;body.position.y=0;}
  body.rotation.x=climbing?-1.0:0;
  applyCatLegPose(root,{distance:walkDistance,moving:moving&&!hop,resting:sleep});
  neck.position.y=THREE.MathUtils.lerp(.414,.299+CAT_BOWL.foodHeight*(1/root.scale.y-1),eat);
  neck.rotation.set((.90+Math.sin(time*7)*.045)*eat+.72*sleep+Math.sin(time*.9)*.04*(1-eat)*(1-sleep),0,0,'XYZ');
  head.rotation.set(0,!moving?Math.sin(time*.42)*.20*(1-eat)*(1-sleep):0,0);
  ears.forEach((ear,i)=>{ear.rotation.z=0;ear.rotation.x=.10*sleep+Math.pow(Math.max(0,Math.sin(time*.33+i*2.4)),60)*.10;});
  const grooming=applyCatGrooming(root,{time,actionTime,remaining,active:mode==='groom'&&!moving&&!climbing&&!passage,facing,passage});
  applyCatSitting(root,sitting,actionTime);
  if(mode==='play'&&quiet){
    const weight=restWeight(actionTime,remaining,1.5);
    const release=playRelease?THREE.MathUtils.smoothstep(playRelease.age,0,1.2):0;
    const playTime=playRelease?time-playRelease.age:time;
    applyCatSitting(root,weight,0);head.rotation.set(THREE.MathUtils.lerp(-.16*weight,.04*Math.sin(1.5*.7)*weight,release),Math.sin(playTime*2.1)*.12*weight*(1-release),0);
    const paw=root.userData.legs.find(leg=>!leg.rear&&leg.side===-1);
    const reach=Math.max(0,Math.sin(playTime*2.1)),c=Math.cos(body.rotation.x),s=Math.sin(body.rotation.x);
    const floorY=.036-body.position.y,floorZ=THREE.MathUtils.lerp(.205,.10,weight);
    placeCatPaw(paw,paw.side*.101,THREE.MathUtils.lerp(.08+reach*.14*weight,floorY*c+floorZ*s,release),THREE.MathUtils.lerp(.16+reach*.13*weight,-floorY*s+floorZ*c,release));
  }
  applyCatHop(root,hop);
  updateCatEyes(eyes);
  updateCatLegSkins(root);
  animateCatTail(tail,{time,resting,moving,crouching:Boolean(passage),grooming:Math.max(grooming,sitting),sitting});
}
