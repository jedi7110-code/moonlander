import * as THREE from 'three';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {materials,box} from '../../src/obs/materials.js';
import {industrialMaterials} from '../../src/obs/industrial.js';
import {createMachinedMetals,finishMachinedFixtures} from '../../src/obs/machined-metals.js';
import {createBulkheadGate,BULKHEAD_GATE} from '../../src/obs/bulkhead-gate.js';
import {loadMiloHead} from '../../src/obs/head.js';
import {loadMiloBody} from '../../src/obs/milo-body.js';
import {createMilo} from '../../src/obs/characters.js';
import {createMiloToon} from '../../src/obs/milo-toon.js';
import {createCabinToon} from '../../src/obs/cabin-toon.js';
import {applyStudyCropHairline} from './crop-hairline.js';
import {REAR_JOBS,VISIT_DURATION,RearRoomVisits,prepareRearRoomMotion} from './rear-room-model.js';

const $=id=>document.getElementById(id),params=new URLSearchParams(location.search);
async function init(){
  const [m,head]=await Promise.all([materials(),loadMiloHead(),loadMiloBody()]);
  const canvas=$('room-canvas'),renderer=new THREE.WebGLRenderer({canvas,antialias:true,stencil:true});
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.12;
  const scene=new THREE.Scene();scene.background=new THREE.Color(0x172124);
  const pmrem=new THREE.PMREMGenerator(renderer),environmentRoom=new RoomEnvironment(),env=pmrem.fromScene(environmentRoom,.04);
  scene.environment=env.texture;environmentRoom.dispose();pmrem.dispose();
  scene.add(new THREE.HemisphereLight(0xf2f2df,0x637777,2.2));
  const key=new THREE.DirectionalLight(0xffedd9,2.5);key.position.set(3,6,2);scene.add(key);
  const fill=new THREE.DirectionalLight(0xe1f4ff,1.1);fill.position.set(-1,3,-3);scene.add(fill);
  const worn=industrialMaterials(m),metals=createMachinedMetals(),rooms={};
  for(const id of Object.keys(REAR_JOBS)){
    const group=new THREE.Group(),gate=createBulkheadGate(worn,{...BULKHEAD_GATE,x:0,floor:0,room:id},m);
    group.add(gate.root,gate.lights);scene.add(group);finishMachinedFixtures(gate.root,worn,metals);
    box(gate.root,worn.metal,0,.055,-.31,7,.10,2.60).name='Study corridor floor';
    // Same cutaway as the grooming study: expose the viewing wall and roof.
    for(const part of gate.root.children){
      if(!part.isMesh||!['BoxGeometry','RoundedBoxGeometry'].includes(part.geometry.type))continue;
      if(part.position.y>2.65||part.position.x>1.08)part.visible=false;
    }
    rooms[id]={group,gate};
  }
  head.userData.setAppearance({hair:'crop',beard:'none'});applyStudyCropHairline(head);
  const milo=createMilo(m,head);scene.add(milo);const motion=prepareRearRoomMotion(milo);
  const toon=createMiloToon(milo),cabinToon=createCabinToon(Object.values(rooms).map(r=>r.gate.root));cabinToon.setStyle('cartoon');
  scene.traverse(part=>{if(part.material?.anisotropy>0)part.material.defines.USE_UV='';});
  const camera=new THREE.PerspectiveCamera(42,1,.05,40),controls=new OrbitControls(camera,canvas);
  controls.minDistance=1.1;controls.maxDistance=14;controls.maxPolarAngle=Math.PI*.92;
  const visits=new RearRoomVisits();visits.start(params.get('room'));
  visits.time=THREE.MathUtils.clamp(Number(params.get('time'))||0,0,VISIT_DURATION);
  let automatic=params.has('auto')?params.get('auto')==='1':!params.has('time'),playing=automatic,speed=1,view=params.get('view')==='work'?'work':'room';
  let width=1,height=1,dirty=true,last=performance.now(),frame,lastRoom='',lastPhase='',hud=0;
  controls.addEventListener('change',()=>dirty=true);
  function saveURL(){const url=new URL(location.href);url.searchParams.set('room',visits.room);url.searchParams.set('time',visits.time.toFixed(2));url.searchParams.set('view',view);url.searchParams.set('auto',automatic?'1':'0');history.replaceState(null,'',url);}
  function setView(value){
    view=value;const job=REAR_JOBS[visits.room];
    camera.position.set(...(view==='work'?[2.5,2.05,job.stand[1]+.24]:[4.6,3.2,1.8]));
    controls.target.set(...(view==='work'?[job.stand[0],1.26,job.stand[1]-.30]:[0,1.15,-2.65]));controls.update();
    for(const {gate}of Object.values(rooms))for(const part of gate.root.children){
      const frontFitting=part.isMesh&&part.position.z>=BULKHEAD_GATE.front-.54&&part.position.z<=BULKHEAD_GATE.front+.16;
      if(frontFitting||['Eight-sided gate frame','Gate seal','Rear threshold frame'].includes(part.name))part.visible=view==='room';
    }
    for(const button of document.querySelectorAll('[data-view]'))button.setAttribute('aria-pressed',button.dataset.view===view);
    dirty=true;
  }
  function updateHUD(){
    const job=REAR_JOBS[visits.room];$('deck').textContent=job.floor;$('room-name').textContent=job.name;
    $('time-output').textContent=visits.time.toFixed(1)+' / '+VISIT_DURATION+'秒';$('visit-time').value=visits.time;
    $('visit-status').textContent=automatic?(visits.waiting?'次の訪問まで '+Math.ceil(visits.wait)+'秒':'自動巡回 · 作業後は2〜4分の間隔'):'動作確認';
    $('play').textContent=playing?'一時停止':'再生';$('play').setAttribute('aria-pressed',playing);$('automatic').setAttribute('aria-pressed',automatic);
    for(const button of document.querySelectorAll('[data-room]'))button.setAttribute('aria-pressed',button.dataset.room===visits.room);
  }
  function drawPose(){
    if(lastRoom!==visits.room){lastRoom=visits.room;for(const [id,r]of Object.entries(rooms))r.group.visible=id===visits.room;setView(view);updateHUD();saveURL();}
    const state=motion.update(visits.room,visits.time),phase=visits.waiting?'作業完了 · 次の訪問まで待機':state.label;
    if(phase!==lastPhase){$('phase').textContent=phase;lastPhase=phase;}dirty=true;
  }
  function seek(value){automatic=false;playing=false;visits.waiting=false;visits.time=THREE.MathUtils.clamp(Number(value),0,VISIT_DURATION);drawPose();updateHUD();saveURL();}
  $('play').onclick=()=>{if(!playing&&visits.time===VISIT_DURATION&&!automatic)visits.start(visits.room);playing=!playing;last=performance.now();drawPose();updateHUD();saveURL();};
  $('automatic').onclick=()=>{automatic=!automatic;if(automatic){if(visits.time===VISIT_DURATION)visits.start(visits.room);playing=true;last=performance.now();}updateHUD();saveURL();};
  $('visit-time').oninput=()=>seek($('visit-time').value);
  document.querySelectorAll('[data-time]').forEach(button=>button.onclick=()=>seek(button.dataset.time));
  document.querySelectorAll('[data-room]').forEach(button=>button.onclick=()=>{automatic=false;visits.start(button.dataset.room);playing=true;last=performance.now();drawPose();updateHUD();saveURL();});
  document.querySelectorAll('[data-view]').forEach(button=>button.onclick=()=>{setView(button.dataset.view);saveURL();});
  $('speed').onchange=()=>{speed=Number($('speed').value);};
  function resize(){const rect=canvas.getBoundingClientRect();width=Math.max(1,rect.width);height=Math.max(1,rect.height);renderer.setSize(width,height,false);camera.aspect=width/height;camera.updateProjectionMatrix();dirty=true;}
  const observer=new ResizeObserver(resize);observer.observe(canvas);resize();drawPose();updateHUD();
  document.querySelectorAll('button,input,select').forEach(c=>c.disabled=false);$('loading').hidden=true;
  function tick(now){
    frame=requestAnimationFrame(tick);const dt=Math.min((now-last)/1000,.1);last=now;if(document.hidden)return;
    if(playing){
      const oldTime=visits.time,oldRoom=visits.room,wasWaiting=visits.waiting;
      if(automatic)visits.advance(dt*speed);else{visits.time=Math.min(VISIT_DURATION,visits.time+dt*speed);if(visits.time===VISIT_DURATION){playing=false;saveURL();updateHUD();}}
      if(oldTime!==visits.time||oldRoom!==visits.room||wasWaiting!==visits.waiting)drawPose();
      hud+=dt;if(hud>.12){updateHUD();hud=0;}
    }
    if(dirty){toon.update(width,height);cabinToon.update(width,height,3,15);renderer.render(scene,camera);dirty=false;}
  }
  frame=requestAnimationFrame(tick);
  window.addEventListener('pagehide',event=>{if(event.persisted)return;cancelAnimationFrame(frame);observer.disconnect();controls.dispose();toon.dispose();cabinToon.dispose();env.dispose();renderer.dispose();});
}
init().catch(error=>{console.error(error);$('loading').hidden=true;$('error').hidden=false;$('error').textContent='スタディを読み込めませんでした。'+error.message;});
