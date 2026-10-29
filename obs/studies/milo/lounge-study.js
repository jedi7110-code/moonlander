import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {materials} from '../../src/obs/materials.js';
import {loadMiloHead} from '../../src/obs/head.js';
import {loadMiloBody} from '../../src/obs/milo-body.js';
import {createMiloToon} from '../../src/obs/milo-toon.js';
import {createCabinToon} from '../../src/obs/cabin-toon.js';
import {LOUNGE_STUDY_ITEMS,LOUNGE_STUDY_PHASES,LOUNGE_STUDY_DURATION,createLoungeStudyActors,applyLoungeStudy} from './lounge-model.js';

const $=id=>document.getElementById(id),params=new URLSearchParams(location.search);
let item=Object.hasOwn(LOUNGE_STUDY_ITEMS,params.get('item'))?params.get('item'):'tablet';
let view=['front','side','hands'].includes(params.get('view'))?params.get('view'):'oblique';
let time=Math.max(0,Number(params.get('time')??0)||0),playing=false;

async function init(){
  const [m,head]=await Promise.all([materials(),loadMiloHead(),loadMiloBody()]);
  head.userData.setAppearance({hair:'crop',beard:'none'});
  const canvas=$('lounge-canvas'),renderer=new THREE.WebGLRenderer({canvas,antialias:true,stencil:true});
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.1;
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  const scene=new THREE.Scene();scene.background=new THREE.Color(0x202b2c);
  const pmrem=new THREE.PMREMGenerator(renderer),room=new RoomEnvironment(),environment=pmrem.fromScene(room,.04);
  room.dispose();pmrem.dispose();scene.environment=environment.texture;
  scene.add(new THREE.HemisphereLight(0xf4f5e7,0x657b7b,2.1));
  const key=new THREE.DirectionalLight(0xfff1d7,2.6);key.position.set(3,5,4);key.castShadow=true;key.shadow.mapSize.set(1024,1024);
  Object.assign(key.shadow.camera,{left:-5,right:5,top:4,bottom:-4});key.shadow.normalBias=.008;scene.add(key);
  const fill=new THREE.DirectionalLight(0xc5dce7,1.1);fill.position.set(-3,2,-2);scene.add(fill);
  const floor=new THREE.Mesh(new THREE.PlaneGeometry(200,200),new THREE.MeshStandardMaterial({color:0x332e28,roughness:.9}));
  floor.rotation.x=-Math.PI/2;floor.position.y=-.009;floor.receiveShadow=true;scene.add(floor);
  const actors=createLoungeStudyActors(m,head);scene.add(actors.milo,actors.furniture);
  const toon=createMiloToon(actors.milo),furnitureToon=createCabinToon([actors.furniture]);furnitureToon.setStyle('cartoon');
  const camera=new THREE.PerspectiveCamera(35,1,.02,250),controls=new OrbitControls(camera,canvas);
  controls.enableDamping=false;controls.minDistance=1.5;controls.maxDistance=11;controls.maxPolarAngle=Math.PI*.49;
  let width=1,height=1,dirty=true,last=performance.now(),frame;
  controls.addEventListener('change',()=>dirty=true);
  function updateURL(){const url=new URL(location.href);url.searchParams.set('item',item);url.searchParams.set('time',time.toFixed(2));url.searchParams.set('view',view);history.replaceState(null,'',url);}
  function preset(){
    const close=view==='hands',target=new THREE.Vector3(close||view==='side'?0:-.6,close?1.08:view==='side'?1:.86,close?.65:.25);
    const offset={front:[0,1.0,6.3],oblique:[2.7,1.65,5.5],side:[3.3,.28,.15],hands:[.8,.38,1.25]}[view];
    controls.target.copy(target);camera.position.copy(target).add(new THREE.Vector3(...offset));camera.lookAt(target);controls.update();
    document.querySelectorAll('[data-view]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.view===view)));dirty=true;
  }
  function pose(){
    const sample=applyLoungeStudy(actors,item,time);time=sample.time;
    $('item-name').textContent=LOUNGE_STUDY_ITEMS[item];$('phase').textContent=time===LOUNGE_STUDY_DURATION?'完了':sample.phase.label;
    $('time').max=LOUNGE_STUDY_DURATION;$('time').value=time;$('time').setAttribute('aria-valuetext',`${sample.phase.label}・${time.toFixed(2)}秒`);
    $('clock').textContent=`${time.toFixed(2)} / ${LOUNGE_STUDY_DURATION.toFixed(2)} 秒`;
    document.querySelectorAll('[data-item]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.item===item)));
    document.querySelectorAll('[data-phase]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.phase===sample.phase.id)));dirty=true;
  }
  function setPlaying(value){playing=value;$('play').textContent=value?'一時停止':'再生';$('play').setAttribute('aria-pressed',String(value));last=performance.now();if(!value)updateURL();}
  function seek(value){setPlaying(false);time=value;pose();updateURL();}
  $('play').onclick=()=>{if(!playing&&time>=LOUNGE_STUDY_DURATION){time=0;pose();}setPlaying(!playing);};
  $('restart').onclick=()=>{time=0;pose();setPlaying(true);};
  $('time').oninput=()=>seek(Number($('time').value));
  document.querySelectorAll('[data-item]').forEach(button=>button.onclick=()=>{item=button.dataset.item;seek(0);});
  document.querySelectorAll('[data-phase]').forEach(button=>button.onclick=()=>seek(LOUNGE_STUDY_PHASES.find(phase=>phase.id===button.dataset.phase).time));
  document.querySelectorAll('[data-view]').forEach(button=>button.onclick=()=>{view=button.dataset.view;preset();updateURL();});
  const resize=()=>{const r=canvas.getBoundingClientRect();width=Math.max(1,r.width);height=Math.max(1,r.height);renderer.setSize(width,height,false);camera.aspect=width/height;camera.updateProjectionMatrix();dirty=true;};
  const observer=new ResizeObserver(resize);observer.observe(canvas);resize();preset();pose();setPlaying(false);
  document.querySelectorAll('button,input,select').forEach(control=>control.disabled=false);$('loading').hidden=true;
  function tick(now){
    frame=requestAnimationFrame(tick);const dt=Math.min((now-last)/1000,.05);last=now;if(document.hidden)return;
    if(playing){time+=dt*Number($('speed').value);if(time>=LOUNGE_STUDY_DURATION){if($('loop').checked)time%=LOUNGE_STUDY_DURATION;else{time=LOUNGE_STUDY_DURATION;setPlaying(false);}}pose();}
    if(dirty){toon.update(width,height);furnitureToon.update(width,height,3,15);renderer.render(scene,camera);dirty=false;}
  }
  frame=requestAnimationFrame(tick);
  addEventListener('pagehide',event=>{if(event.persisted)return;cancelAnimationFrame(frame);observer.disconnect();controls.dispose();toon.dispose();furnitureToon.dispose();environment.dispose();renderer.dispose();});
}
init().catch(error=>{console.error(error);$('loading').hidden=true;$('error').hidden=false;$('error').textContent='スタディーを読み込めませんでした。'+error.message;});
