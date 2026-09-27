import * as THREE from 'three';
import {ObservationView} from '../../src/obs/view.js';
import {CabinBrain} from '../../src/obs/brain.js';
import {Supplies,CrewMotion,CatRoutine,CatMotion,advanceCabinTraffic,FLOORS} from '../../src/obs/state.js';
import {DroidRoutine} from '../../src/obs/droid-routine.js';
import {AirlockPassage} from '../../src/obs/airlock.js';
import {CABIN_AISLE,CAT_PORT,DECK,EVA_PASSAGE,LADDER_X,getStation} from '../../src/obs/layout.js';
import {pupilShells} from '../lucy/pupil-study.js';
import {HeadLookRig,LookInput,LOOK_PROFILES} from './look.js';
import {createViewingWall,cabinWallMaterials} from './front-wall.js';
import {StableFirstPersonCamera,maskSelfView} from './comfort.js';
import {createMetalDeckStyle} from './metal-deck.js';
import {sleepView} from './sleep-view.js';
import {medicalView} from './medical-view.js';
import {MED_BED} from '../../src/obs/medical.js';
import {LOUNGE_ENTRY_SECONDS} from '../../src/obs/lounge-exit.js';
import {BUNK_PHASE_SECONDS} from '../../src/obs/bunk-visit.js';

const $=id=>document.getElementById(id),canvas=$('ship-view'),params=new URLSearchParams(location.search);
const deck=createMetalDeckStyle();
const previewStarts={airlock:{floor:DECK.OPERATIONS,x:EVA_PASSAGE.x-70},console:getStation('console'),medical:getStation('medical'),duct:{floor:0,x:620},lounge:{floor:DECK.HABITATION,x:1010},water:{floor:getStation('hydro').floor,x:getStation('hydro').x-8},bunk:getStation('bunk'),ladder:{floor:DECK.LIFE_SUPPORT,x:LADDER_X}};
const previewArea=Object.hasOwn(previewStarts,params.get('area'))?params.get('area'):null;
let selected=params.get('character')==='all'?null:Object.hasOwn(LOOK_PROFILES,params.get('character'))?params.get('character'):'milo';
let outside=params.get('outside')==='1',paused=Boolean(previewArea),elapsed=0,last=performance.now(),frame,view,rigs,wall,comfort,frameDt=0;
const look=new LookInput(selected??'milo'),care=new Supplies(),actor=new CrewMotion(previewStarts[previewArea]??{floor:1,x:470});
if(['lounge','water'].includes(previewArea)){look.setNormalized(0,-.75);look.pitch=look.targetPitch;}
if(previewArea==='console'){look.setNormalized(0,-.24);look.pitch=look.targetPitch;}
const cat=new CatRoutine(care,{turns:true}),airlock=new AirlockPassage(),timers=[];
const scene={time:{delayedCall(ms,callback){timers.push({at:elapsed+ms/1000,callback});}},sound:{add(){return{play(){},once(_e,fn){fn();},destroy(){}};}},obsUI:null};
const brain=new CabinBrain(scene,actor,{care,name:'MILO',random:()=>.9});
const previewActivity=previewArea==='lounge'&&['tablet','music','cat'].includes(params.get('activity'))?params.get('activity'):null;
if(previewActivity)actor.x=getStation('lounge').x;
brain.catRoutine=cat;Object.keys(brain.needs).forEach(key=>brain.needs[key]=98);brain.exercise=98;
cat.motion=new CatMotion({floor:1,x:820,turns:true});cat.motion.y=FLOORS[1].y;cat.motion.z=CABIN_AISLE.catZ;cat.rest('look',35);
if(previewArea==='duct'){
  cat.motion=new CatMotion({floor:0,x:CAT_PORT.x,turns:true});cat.mode='walk';
  cat.motion.goTo({floor:1,x:CAT_PORT.x+100},()=>cat.rest('look',20));
  if(params.get('passage')==='exit')for(let i=0;i<60*60;i++){
    if(cat.motion.portal?.phase==='exit'&&cat.motion.z>.6)break;
    cat.motion.update(1/60);
  }
}
actor.facing=1;
const droid=new DroidRoutine({care,brain,actor,cat});brain.droidRoutine=droid;
const restoreMasks=[];
function roots(){return{milo:view.milo,cat:view.cat,droid:view.droidBay.droid.root};}
function currentSleep(){return sleepView(brain.bunkVisit?.pose,selected,outside);}
function currentRest(){const sleep=currentSleep(),medical=medicalView(brain,selected);return medical.active?{...medical,closure:0,medical:true}:sleep;}

function createRigs(){
  const milo=view.milo,head=milo.userData.head,eyes=[];
  head.traverse(mesh=>{if(mesh.name==='Fitted Milo eye surface')eyes.push(mesh);});
  const miloEye=new THREE.Vector3();
  for(const mesh of eyes)miloEye.add(head.worldToLocal(mesh.localToWorld(new THREE.Vector3().fromBufferAttribute(mesh.geometry.attributes.position,0))));
  miloEye.divideScalar(eyes.length);
  const lucy=view.cat,skull=lucy.getObjectByName('Bone004');
  let pupils;lucy.traverse(mesh=>{if(mesh.isSkinnedMesh&&mesh.material?.name==='Pupils and eye margin')pupils=mesh;});
  pupils.updateWorldMatrix(true,false);pupils.skeleton.update();
  const lucyEye=new THREE.Vector3(),point=new THREE.Vector3();
  for(const shell of pupilShells(pupils.geometry)){
    const center=new THREE.Vector3();
    for(const i of shell.indices)center.add(pupils.getVertexPosition(i,point));
    lucyEye.add(center.divideScalar(shell.indices.length).applyMatrix4(pupils.matrixWorld));
  }
  lucyEye.multiplyScalar(.5);skull.worldToLocal(lucyEye);
  const robot=view.droidBay.droid;
  // Calibrate the mechanical forward axis while powered up, not in its docked nod.
  robot.update(0,'idle');robot.root.updateMatrixWorld(true);
  return{
    milo:new HeadLookRig(head,milo.userData.body,miloEye,{neckAnchor:new THREE.Vector3(0,-.030,.009)}),
    cat:new HeadLookRig(skull,lucy,lucyEye),
    droid:new HeadLookRig(robot.head,robot.root,new THREE.Vector3(0,.026,.148)),
  };
}
function freedom(){
  if(selected==='milo')return brain.grooming?.18:brain.bunkVisit?.25:brain.state==='performing'?.55:1;
  if(selected==='cat')return ['sleep','groom','eat'].includes(cat.mode)?.3:1;
  return droid.docked?.45:droid.pose.mode==='work'?.6:1;
}
function updateCamera(baseFrustum){
  if(!rigs)return baseFrustum();
  wall.visible=Boolean(selected&&!outside);
  deck.setFootlightsVisible(wall.visible);
  if(!selected){view.mode='all';view.viewHeight=view.targetHeight=view.fitHeight;view.center.copy(view.targetCenter.set(0,6.35,0));return baseFrustum();}
  const sleep=currentRest(),rig=rigs[selected],profile=LOOK_PROFILES[selected];rig.apply(look.yaw*(1-sleep.recline),look.pitch*(1-sleep.recline));
  const eye=rig.eyePosition(),orientation=rig.orientation();
  const camera=view.camera;camera.aspect=view.width/view.height;camera.near=.025;camera.far=150;
  if(outside){
    const range=selected==='cat'?1.05:3.25;
    const offset=new THREE.Vector3(range*.65,range*.18,range);
    camera.position.copy(eye).add(offset);camera.up.set(0,1,0);camera.lookAt(eye.clone().add(new THREE.Vector3(0,selected==='cat'?-.09:-.35,0)));camera.fov=43;
    view.viewHeight=view.targetHeight=selected==='cat'?1.2:3.5;
  }else{
    camera.position.copy(eye);camera.quaternion.copy(orientation).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),Math.PI));camera.fov=profile.fov;
    if(selected==='milo')comfort.update(camera,{eye,yaw:look.yaw,pitch:look.pitch,dt:frameDt,climbing:actor.climbing,recline:sleep.recline,attachedOrientation:brain.bunkVisit||sleep.medical?orientation:null,standing:actor.busy||(!brain.grooming&&!brain.bunkVisit&&brain.state!=='performing'&&!brain.loungeEntry&&!brain.loungeStow&&!brain.loungeExit&&!brain.reclineExit)});
    view.viewHeight=view.targetHeight=2;
  }
  camera.updateProjectionMatrix();camera.updateMatrixWorld(true);
  const root=roots()[selected],shownEye=outside?eye:camera.position;$('eye-height').textContent=`目線 ${(shownEye.y-root.getWorldPosition(new THREE.Vector3()).y).toFixed(2)} m · ${outside?'首の動きを確認':'船内の壁を表示'}`;
}
function updateUI(){
  $('pause').textContent=paused?'再生':'一時停止';$('pause').setAttribute('aria-pressed',String(paused));
  document.querySelectorAll('[data-character]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.character===selected)));
  $('wide').setAttribute('aria-pressed',String(!selected));$('outside').setAttribute('aria-pressed',String(outside));
  $('outside').textContent=outside?'本人視点に戻る':'外から首を見る';
  for(const id of ['outside','center','walk'])$(id).disabled=!selected;
  $('mode-label').textContent=selected?`${LOOK_PROFILES[selected].label} / ${outside?'外から確認':'本人視点'}`:'TARAIRON / 全景';
  $('reticle').hidden=!selected||outside;document.querySelector('.look-meter').hidden=!selected;
  if(selected){const p=LOOK_PROFILES[selected];$('limits').textContent=`首の試作可動域：左右 ${p.yaw}° · 上 ${p.up}° / 下 ${p.down}°`;}else{$('limits').textContent='キャラを選ぶと、その目線へ切り替わります。';$('eye-height').textContent='';}
  history.replaceState(null,'',`?character=${selected??'all'}${outside?'&outside=1':''}${previewArea?`&area=${previewArea}`:''}`);
}
function select(id){Object.values(rigs).forEach(r=>r.restore());selected=id;if(id)look.setProfile(id);comfort.reset();view.mode='manual';updateUI();}
function updateSleepUI(sleep){
  $('eyelids').hidden=sleep.closure===0;$('eyelids').style.setProperty('--closure',sleep.closure);
  const edge=60*sleep.closure,curve=40*sleep.closure-30*Math.sin(Math.PI*sleep.closure);
  $('upper-lid').setAttribute('d',`M0 0H100V${edge}Q50 ${curve} 0 ${edge}Z`);
  $('lower-lid').setAttribute('d',`M0 100H100V${100-edge}Q50 ${100-curve} 0 ${100-edge}Z`);
  $('reticle').hidden=!selected||outside||sleep.locked;document.querySelector('.look-meter').hidden=!selected||sleep.locked;
  $('center').disabled=!selected||sleep.locked;
  const waking=brain.bunkVisit?.exitRequested,headingToBed=brain.actStation==='bunk'&&!brain.bunkVisit&&brain.state==='goingTo';
  $('sleep').disabled=selected!=='milo'||waking||headingToBed;
  const label=waking?'起きています…':brain.bunkVisit?'起きる':headingToBed?'ベッドへ移動中…':'ベッドで眠る';
  if($('sleep').textContent!==label)$('sleep').textContent=label;
  const hint=sleep.medical&&sleep.locked?'治療中 · 頭と視点を固定しています':sleep.locked?(outside?'ベッドで休んでいます':sleep.closure===1?'睡眠中 · 起きるとゆっくり目が開きます':sleep.recline<1?(waking?'体を起こしています':'ベッドに横になっています'):'横になって休んでいます'):'マウス移動で見回す · スマホは指でなぞる';
  if($('hint').textContent!==hint)$('hint').textContent=hint;
  if(selected){const p=LOOK_PROFILES[selected],limits=sleep.locked?(sleep.medical?'治療中は視点を固定':'就寝中は視点を固定'):`首の試作可動域：左右 ${p.yaw}° · 上 ${p.up}° / 下 ${p.down}°`;if($('limits').textContent!==limits)$('limits').textContent=limits;}
}
function draw(dt){
  frameDt=dt;Object.values(rigs).forEach(r=>r.restore());
  const sleep=currentRest();if(sleep.locked)look.targetYaw=look.targetPitch=0;
  if(selected)look.update(dt,freedom());
  updateSleepUI(sleep);
  view.mode='manual';view.render(dt,elapsed,actor,brain,cat,care,paused,airlock);
  if(selected){const p=look.profile;$('look-dot').style.left=`${50+look.yaw/THREE.MathUtils.degToRad(p.yaw)*44}%`;$('look-dot').style.top=`${50-look.pitch/THREE.MathUtils.degToRad(look.pitch>0?p.up:p.down)*42}%`;}
}
function advance(dt){
  for(let remaining=dt;remaining>1e-8;){const step=Math.min(remaining,1/60);remaining-=step;elapsed+=step;
    care.update(step);airlock.update(step,actor);actor.waitingForDroid=droid.blocksCrew(actor,step);advanceCabinTraffic(actor,cat,step,droid);brain.update(step);droid.update(step);
    for(let i=timers.length-1;i>=0;i--)if(timers[i].at<=elapsed)timers.splice(i,1)[0].callback();
  }
}
function walk(){
  if(selected==='milo'){
    const go=()=>actor.goTo({floor:actor.floor,x:actor.x<700?1000:450});
    if(!brain.deferDeparture(go))go();
  }
  if(selected==='cat')cat.depart(()=>{cat.mode='walk';cat.motion.goTo({floor:cat.motion.floor,x:cat.motion.x<700?980:400},()=>cat.rest('look',20));},'walk');
  if(selected==='droid')droid.request('feed');
  paused=false;$('pause').textContent='一時停止';$('pause').setAttribute('aria-pressed','false');
}
async function start(){
  view=await ObservationView.create(canvas,{floorBuilder:deck.buildFloor});view.droidRoutine=droid;
  for(const [type,fn,options]of view.listeners)canvas.removeEventListener(type,fn,options);view.listeners=[];
  view.milo.rotation.y=['water','console'].includes(previewArea)?Math.PI:Math.PI/2;
  view.render(.016,0,actor,brain,cat,care,false,airlock);
  rigs=createRigs();wall=createViewingWall(cabinWallMaterials(view.ship.staticMesh));view.scene.add(wall);
  comfort=new StableFirstPersonCamera(view.milo,rigs.milo.eyePosition());
  if(previewActivity){
    brain.nextLeisure=previewActivity;brain._startPerform(getStation('lounge'));brain.update(LOUNGE_ENTRY_SECONDS);
    view.milo.rotation.y=.15;
    if(params.get('handling')==='pickup')brain.performT=brain.curDurSec-1.9;
    if(params.get('handling')==='return'){brain.performT=brain.curDurSec-8;brain.beginLoungeStow('exit');brain.loungeStow.age=1.6;}
  }
  if(previewArea==='medical'){
    brain._startPerform(getStation('medical'));
    if(params.get('treatment')==='rest')brain.performT=brain.curDurSec-MED_BED.transition-1;
  }
  if(previewArea==='ladder'){
    brain._go(getStation('bunk'));
    actor.update(Math.abs(FLOORS[DECK.HABITATION].y-FLOORS[DECK.LIFE_SUPPORT].y)/actor.climbSpeed/2);
  }
  if(previewArea==='bunk'){
    brain.needs.energy=35;brain._startPerform(getStation('bunk'));
    // Optional paused review poses; normal previews play the complete transfer.
    const beforeLowering=['approaching','opening','extending','sitting','settled'].reduce((t,phase)=>t+BUNK_PHASE_SECONDS[phase],0);
    if(params.get('sleep')==='lowering')brain.bunkVisit.update(beforeLowering+BUNK_PHASE_SECONDS.lowering/2);
    if(params.get('sleep')==='closing')brain.bunkVisit.update(beforeLowering+BUNK_PHASE_SECONDS.lowering+BUNK_PHASE_SECONDS.entering+BUNK_PHASE_SECONDS.closing/2);
  }
  const headMeshes=new Set();view.milo.userData.head.traverse(mesh=>{if(mesh.isMesh)headMeshes.add(mesh);});
  for(const [id,root]of Object.entries(roots()))root.traverse(mesh=>{
    if(mesh.isMesh&&(headMeshes.has(mesh)||/ink|outline/i.test(mesh.material?.name??'')))restoreMasks.push(maskSelfView(mesh,view.camera,()=>selected===id&&!outside));
  });
  const baseFrustum=view.setFrustum.bind(view);view.setFrustum=()=>updateCamera(baseFrustum);
  let touch=null;
  canvas.addEventListener('pointermove',e=>{
    if(!selected||currentRest().locked)return;
    if(e.pointerType==='mouse'){
      const r=canvas.getBoundingClientRect();look.setNormalized((e.clientX-r.left)/r.width*2-1,1-(e.clientY-r.top)/r.height*2);
    }else if(touch?.id===e.pointerId){look.drag(e.clientX-touch.x,e.clientY-touch.y);touch.x=e.clientX;touch.y=e.clientY;}
  });
  canvas.addEventListener('pointerdown',e=>{if(e.pointerType==='mouse'||!selected||currentRest().locked)return;touch={id:e.pointerId,x:e.clientX,y:e.clientY};canvas.setPointerCapture(e.pointerId);});
  for(const name of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(name,e=>{if(touch?.id===e.pointerId)touch=null;});
  document.querySelectorAll('[data-character]').forEach(button=>button.onclick=()=>select(button.dataset.character));
  $('wide').onclick=()=>select(null);$('outside').onclick=()=>{outside=!outside;comfort.reset();updateUI();};
  $('center').onclick=()=>look.reset();$('walk').onclick=walk;
  $('sleep').onclick=()=>{if(brain.bunkVisit)brain._endPerform();else brain._go(getStation('bunk'));paused=false;updateUI();};
  $('floor-tone').onchange=event=>deck.setTone(event.target.value);
  $('pause').onclick=()=>{paused=!paused;$('pause').textContent=paused?'再生':'一時停止';$('pause').setAttribute('aria-pressed',String(paused));};
  window.addEventListener('keydown',event=>{if(event.key==='Escape'){select(null);}if(event.key.toLowerCase()==='r')look.reset();});
  updateUI();draw(.016);$('loading').hidden=true;last=performance.now();
  function tick(now){const dt=Math.min(.05,Math.max(0,(now-last)/1000));last=now;if(!document.hidden){if(!paused)advance(dt);draw(dt);}frame=requestAnimationFrame(tick);}
  frame=requestAnimationFrame(tick);
  window.addEventListener('pagehide',event=>{if(event.persisted)return;cancelAnimationFrame(frame);restoreMasks.forEach(restore=>restore());Object.values(rigs).forEach(r=>r.restore());view.dispose();});
}
start().catch(error=>{$('loading').hidden=false;$('loading').textContent=`読み込みに失敗しました：${error.message}`;console.error(error);});
