import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {materials} from './obs/materials.js';
import {loadMiloHead} from './obs/head.js';
import {loadMiloBody} from './obs/milo-body.js';
import {createMiloToon} from './obs/milo-toon.js';
import {createCabinToon} from './obs/cabin-toon.js';
import {createLoungeAshtray} from './obs/lounge-ashtray.js';
import {LOUNGE_SMOKING_STUDY_DURATION as duration,LOUNGE_SMOKING_STUDY_PHASES as phases,createLoungeSmokingStudyActors,applyLoungeSmokingStudy} from './lounge-smoking-study-model.js';

const $=id=>document.getElementById(id),params=new URLSearchParams(location.search);
let mode=params.get('mode')==='ashtray'?'ashtray':'lounge',view=['front','side','top','hands','lighter','lighterBack','cigarette'].includes(params.get('view'))?params.get('view'):'oblique';
let time=params.has('time')?Number(params.get('time')):11.4,playing=false,dirty=true,last=performance.now(),frame;
if(!Number.isFinite(time))time=11.4;
async function init(){
  const [m,head]=await Promise.all([materials(),loadMiloHead(),loadMiloBody()]);
  head.userData.setAppearance({hair:'crop',beard:'none'});
  const canvas=$('smoking-view'),renderer=new THREE.WebGLRenderer({canvas,antialias:true,stencil:true});
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.1;
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  const scene=new THREE.Scene();scene.background=new THREE.Color(0x202b2c);
  const room=new RoomEnvironment(),pmrem=new THREE.PMREMGenerator(renderer),environment=pmrem.fromScene(room,.04);scene.environment=environment.texture;room.dispose();pmrem.dispose();
  scene.add(new THREE.HemisphereLight(0xf4f5e7,0x657b7b,1.8));
  const key=new THREE.DirectionalLight(0xfff1d7,2.2);key.position.set(3,5,4);key.castShadow=true;key.shadow.mapSize.set(1024,1024);
  Object.assign(key.shadow.camera,{left:-5,right:5,top:4,bottom:-4});key.shadow.normalBias=.003;scene.add(key);
  const fill=new THREE.DirectionalLight(0xc5dce7,1.0);fill.position.set(-3,2,-2);scene.add(fill);
  const floor=new THREE.Mesh(new THREE.PlaneGeometry(200,200),new THREE.MeshStandardMaterial({color:0x332e28,roughness:.9}));floor.rotation.x=-Math.PI/2;floor.position.y=-.009;floor.receiveShadow=true;scene.add(floor);
  const actors=createLoungeSmokingStudyActors(m,head),ashtray=createLoungeAshtray();ashtray.position.set(0,0,0);scene.add(actors.milo,actors.furniture,ashtray);
  const toon=createMiloToon(actors.milo),furnitureToon=createCabinToon([actors.furniture]);furnitureToon.setStyle('cartoon');
  const camera=new THREE.PerspectiveCamera(35,1,.005,250),controls=new OrbitControls(camera,canvas);
  controls.enableDamping=false;controls.screenSpacePanning=true;controls.maxPolarAngle=Math.PI*.495;
  let width=1,height=1,followTarget=null;
  controls.addEventListener('change',()=>dirty=true);
  const save=()=>{const url=new URL(location.href);for(const [key,value]of Object.entries({mode,view,time:time.toFixed(3)}))url.searchParams.set(key,value);history.replaceState(null,'',url);};
  function setPlaying(value){playing=value&&mode==='lounge';$('play').textContent=playing?'一時停止':'再生';$('play').setAttribute('aria-pressed',String(playing));last=performance.now();}
  function pose(dt=0){
    const sample=applyLoungeSmokingStudy(actors,time,{dt});time=sample.time;
    if(followTarget&&mode==='lounge'){
      const rig=actors.milo.userData.arms[view.startsWith('lighter')?1:0],target=rig.hand.localToWorld(new THREE.Vector3(0,-.08,0)),delta=target.clone().sub(followTarget);
      camera.position.add(delta);controls.target.add(delta);followTarget.copy(target);controls.update();
    }
    actors.milo.visible=actors.furniture.visible=mode==='lounge';ashtray.visible=mode==='ashtray';
    $('phase').textContent=mode==='ashtray'?'灰皿単体 / OBSと同じモデル':time>=duration?'完了':sample.visit?.pose.gesture?.label??sample.phase.label;
    $('study-time').max=duration;$('study-time').value=time;$('study-time').setAttribute('aria-valuetext',`${sample.phase.label}・${time.toFixed(2)}秒`);
    $('clock').textContent=`${time.toFixed(2)} / ${duration.toFixed(2)} 秒`;
    document.querySelectorAll('[data-phase]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.phase===sample.phase.id)));dirty=true;
  }
  function preset(){
    if(mode==='lounge'&&['lighter','lighterBack','cigarette'].includes(view)){
      const rig=actors.milo.userData.arms[view.startsWith('lighter')?1:0];
      const target=rig.hand.localToWorld(new THREE.Vector3(0,-.08,0));
      controls.minDistance=.12;controls.maxDistance=2;
      const offset=view==='lighter'?new THREE.Vector3(-.34,-.03,-.13):new THREE.Vector3(view==='lighterBack'?-.18:.18,-.06,view==='lighterBack'?.32:-.32);
      controls.target.copy(target);camera.position.copy(target).add(offset.applyQuaternion(rig.hand.getWorldQuaternion(new THREE.Quaternion())));
      camera.lookAt(target);controls.update();
      followTarget=target.clone();
      document.querySelectorAll('[data-view]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.view===view)));dirty=true;return;
    }
    followTarget=null;
    const single=mode==='ashtray',close=view==='hands';
    const target=single?new THREE.Vector3(0,.013,0):close?actors.furniture.userData.loungeProps.ashtray.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0,.30,-.10)):new THREE.Vector3(-.6,.86,.25);
    if(close&&!single)target.x=(target.x+actors.milo.position.x)/2;
    const offsets=single?{oblique:[.26,.23,.36],front:[0,.10,.47],side:[.48,.10,0],top:[0,.50,.001],hands:[.26,.20,.32]}:
      {oblique:[2.7,1.65,5.5],front:[0,1.0,6.3],side:[3.3,.28,.15],top:[0,5.5,.01],hands:[.45,.45,1.55]};
    controls.minDistance=single?.12:.35;controls.maxDistance=single?1.5:11;
    controls.target.copy(target);camera.position.copy(target).add(new THREE.Vector3(...offsets[view]));camera.lookAt(target);controls.update();
    document.querySelectorAll('[data-view]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.view===view)));dirty=true;
  }
  function chooseMode(){
    setPlaying(false);actors.milo.visible=actors.furniture.visible=mode==='lounge';ashtray.visible=mode==='ashtray';
    for(const id of ['playback','timeline','phases'])$(id).hidden=mode==='ashtray';
    document.querySelectorAll('[data-mode]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.mode===mode)));
    pose();preset();save();
  }
  function seek(value){setPlaying(false);time=value;pose();save();}
  $('play').onclick=()=>{if(!playing&&time>=duration){time=0;pose();}setPlaying(!playing);save();};
  $('restart').onclick=()=>{time=0;pose();setPlaying(true);save();};
  $('previous').onclick=()=>seek(time-1/60);$('next').onclick=()=>seek(time+1/60);$('study-time').oninput=()=>seek(Number($('study-time').value));
  document.querySelectorAll('[data-phase]').forEach(button=>button.onclick=()=>seek(phases.find(phase=>phase.id===button.dataset.phase).time));
  document.querySelectorAll('[data-mode]').forEach(button=>button.onclick=()=>{mode=button.dataset.mode;chooseMode();});
  document.querySelectorAll('[data-view]').forEach(button=>button.onclick=()=>{view=button.dataset.view;preset();save();});
  const resize=()=>{const rect=canvas.getBoundingClientRect();width=Math.max(1,rect.width);height=Math.max(1,rect.height);renderer.setSize(width,height,false);camera.aspect=width/height;camera.updateProjectionMatrix();dirty=true;};
  const observer=new ResizeObserver(resize);observer.observe(canvas);resize();chooseMode();
  document.querySelectorAll('button,input,select').forEach(control=>control.disabled=false);
  await renderer.compileAsync?.(scene,camera);renderer.render(scene,camera);$('loading').hidden=true;
  function tick(now){
    frame=requestAnimationFrame(tick);const elapsed=Math.max(0,Math.min((now-last)/1000,.1));last=now;if(document.hidden)return;
    if(playing){
      const dt=elapsed*Number($('speed').value);time+=dt;
      if(time>=duration){if($('loop').checked){time%=duration;pose();}else{time=duration;setPlaying(false);}}
      pose(dt);
    }
    if(dirty){toon.update(width,height);furnitureToon.update(width,height,3,15);renderer.render(scene,camera);dirty=false;}
  }
  frame=requestAnimationFrame(tick);
  addEventListener('pagehide',event=>{
    if(event.persisted)return;cancelAnimationFrame(frame);observer.disconnect();controls.dispose();toon.dispose();furnitureToon.dispose();environment.dispose();
    const resources=new Set();scene.traverse(o=>{if(o.geometry)resources.add(o.geometry);for(const material of [].concat(o.material??[])){resources.add(material);for(const value of Object.values(material))if(value?.isTexture)resources.add(value);}});resources.forEach(resource=>resource.dispose());renderer.dispose();
  });
}
init().catch(error=>{console.error(error);$('loading').hidden=true;$('error').hidden=false;$('error').textContent='スタディーを読み込めませんでした。'+error.message;});
