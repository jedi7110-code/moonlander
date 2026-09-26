import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {materials} from '../../src/obs/materials.js';
import {loadMiloHead} from '../../src/obs/head.js';
import {loadMiloBody} from '../../src/obs/milo-body.js';
import {createMilo} from '../../src/obs/characters.js';
import {createMiloToon} from '../../src/obs/milo-toon.js';
import {updateMiloWatch} from '../../src/obs/milo-watch.js';
import {createBunk,animateBunk} from '../../src/obs/bunk.js';
import {createMedicalBay,animateMedical,MED_BED} from '../../src/obs/medical.js';
import {ENTRY_STUDY,sampleBedEntry,applyBedEntry} from './bed-entry-model.js';

const $=id=>document.getElementById(id),params=new URLSearchParams(location.search);
let kind=params.get('kind')==='medical'?'medical':'bunk',view=['front','feet','top'].includes(params.get('view'))?params.get('view'):'oblique';
let time=Math.max(0,Number(params.get('time')??(ENTRY_STUDY[kind].start-.3))||0),playing=false;
async function init(){
  const [m,leftHead,rightHead]=await Promise.all([materials(),loadMiloHead(),loadMiloHead(),loadMiloBody()]);
  const canvas=$('entry-canvas'),renderer=new THREE.WebGLRenderer({canvas,antialias:true,stencil:true});
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.1;
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  const pmrem=new THREE.PMREMGenerator(renderer),room=new RoomEnvironment(),environment=pmrem.fromScene(room,.04);room.dispose();pmrem.dispose();
  const entries=[leftHead,rightHead].map((head,i)=>{
    head.userData.setAppearance({hair:'crop',beard:'none'});
    const scene=new THREE.Scene();scene.background=new THREE.Color(0x202b2c);scene.environment=environment.texture;
    scene.add(new THREE.HemisphereLight(0xf4f5e7,0x657b7b,2.1));
    const key=new THREE.DirectionalLight(0xfff1d7,2.6);key.position.set(3,5,4);key.castShadow=true;key.shadow.mapSize.set(1024,1024);key.shadow.camera.left=-3;key.shadow.camera.right=3;key.shadow.camera.top=3;key.shadow.camera.bottom=-3;key.shadow.normalBias=.008;scene.add(key);
    const fill=new THREE.DirectionalLight(0xc5dce7,1.1);fill.position.set(-3,2,-2);scene.add(fill);
    const floor=new THREE.Mesh(new THREE.PlaneGeometry(200,200),new THREE.MeshStandardMaterial({color:0x495450,roughness:.95}));floor.rotation.x=-Math.PI/2;floor.position.y=-.009;floor.receiveShadow=true;scene.add(floor);
    const milo=createMilo(m,head),bunk=createBunk(m),medical=createMedicalBay(m,0);medical.root.position.x=-MED_BED.x;
    // Isolate the real couch so cabinets and scanner arms do not hide the footwork.
    medical.root.children.forEach(child=>child.visible=child===medical.bed);
    scene.add(milo,bunk.root,medical.root);
    const toon=createMiloToon(milo),camera=new THREE.PerspectiveCamera(35,1,.02,250);
    return {scene,milo,bunk,medical,toon,camera,sequential:i===1};
  });
  const controls=new OrbitControls(entries[0].camera,canvas);controls.enableDamping=false;controls.minDistance=2;controls.maxDistance=11;controls.maxPolarAngle=Math.PI*.49;controls.target.set(0,.88,.32);
  let width=1,height=1,dirty=true,last=performance.now(),frame;
  controls.addEventListener('change',()=>dirty=true);
  const duration=()=>sampleBedEntry(kind,0,true).duration;
  function updateURL(){const url=new URL(location.href);url.searchParams.set('kind',kind);url.searchParams.set('time',time.toFixed(2));url.searchParams.set('view',view);history.replaceState(null,'',url);}
  function cameraPreset(){
    const camera=entries[0].camera,target=new THREE.Vector3(0,.92,kind==='bunk'?.36:0);
    const offset={oblique:[3.0,2.0,4.6],front:[0,1.0,5.7],feet:[5.1,1.45,1.5],top:[.35,5.5,1.5]}[view];
    controls.target.copy(target);camera.position.copy(target).add(new THREE.Vector3(...offset));camera.lookAt(target);controls.update();dirty=true;
    document.querySelectorAll('[data-view]').forEach(button=>button.setAttribute('aria-pressed',button.dataset.view===view));
  }
  function pose(){
    time=Math.min(time,duration());
    for(const entry of entries){
      const sample=sampleBedEntry(kind,time,entry.sequential);applyBedEntry(entry.milo,sample);
      entry.bunk.root.visible=kind==='bunk';entry.medical.root.visible=kind==='medical';
      if(kind==='bunk')animateBunk(entry.bunk,sample.pose);else animateMedical(entry.medical,sample.sourceTime,true,null,{patient:entry.milo,duration:sample.actionDuration,sequential:entry.sequential});
      entry.milo.userData.bandage.visible=false;updateMiloWatch(entry.milo,8);entry.milo.updateMatrixWorld(true);entry.milo.userData.bodySkin.skeleton.update();
      $(entry.sequential?'after-stage':'before-stage').textContent=sample.stage;
    }
    $('time').max=duration();$('time').value=time;$('time').setAttribute('aria-valuetext',time.toFixed(2)+'秒');$('clock').textContent=time.toFixed(2)+' / '+duration().toFixed(2)+'秒';
    document.querySelectorAll('[data-kind]').forEach(button=>button.setAttribute('aria-pressed',button.dataset.kind===kind));
    dirty=true;
  }
  function resize(){const rect=canvas.getBoundingClientRect();width=Math.max(2,Math.round(rect.width));height=Math.max(1,Math.round(rect.height));renderer.setSize(width,height,false);entries.forEach(entry=>{entry.camera.aspect=(width/2)/height;entry.camera.updateProjectionMatrix();});dirty=true;}
  function setPlaying(value){playing=value;$('play').textContent=playing?'一時停止':'足上げを再生';$('play').setAttribute('aria-pressed',playing);last=performance.now();if(!value)updateURL();}
  $('play').onclick=()=>{if(!playing&&(time>=duration()||time<ENTRY_STUDY[kind].start-.3))time=ENTRY_STUDY[kind].start-.3;setPlaying(!playing);pose();};
  $('restart').onclick=()=>{time=0;setPlaying(true);pose();};
  $('time').oninput=()=>{setPlaying(false);time=Number($('time').value);pose();updateURL();};
  document.querySelectorAll('[data-kind]').forEach(button=>button.onclick=()=>{setPlaying(false);kind=button.dataset.kind;time=ENTRY_STUDY[kind].start-.3;cameraPreset();pose();updateURL();});
  document.querySelectorAll('[data-phase]').forEach(button=>button.onclick=()=>{setPlaying(false);time=ENTRY_STUDY[kind].start+{seat:-.1,left:1.7,right:3.65,lie:5.4}[button.dataset.phase];pose();updateURL();});
  document.querySelectorAll('[data-view]').forEach(button=>button.onclick=()=>{view=button.dataset.view;cameraPreset();updateURL();});
  const observer=new ResizeObserver(resize);observer.observe(canvas);resize();cameraPreset();pose();setPlaying(false);
  document.querySelectorAll('button,input,select').forEach(control=>control.disabled=false);$('loading').hidden=true;
  function draw(){
    entries[1].camera.position.copy(entries[0].camera.position);entries[1].camera.quaternion.copy(entries[0].camera.quaternion);entries[1].camera.zoom=entries[0].camera.zoom;entries[1].camera.updateProjectionMatrix();
    renderer.setScissorTest(true);entries.forEach((entry,i)=>{const x=i*Math.floor(width/2),w=i?width-x:Math.floor(width/2);renderer.setViewport(x,0,w,height);renderer.setScissor(x,0,w,height);entry.toon.update(w,height);renderer.render(entry.scene,entry.camera);});renderer.setScissorTest(false);dirty=false;
  }
  function tick(now){frame=requestAnimationFrame(tick);const dt=Math.min((now-last)/1000,.05);last=now;if(document.hidden)return;if(playing){time=Math.min(duration(),time+dt*Number($('speed').value));pose();if(time>=duration())setPlaying(false);}if(dirty)draw();}
  frame=requestAnimationFrame(tick);
  addEventListener('pagehide',event=>{if(event.persisted)return;cancelAnimationFrame(frame);observer.disconnect();controls.dispose();entries.forEach(entry=>entry.toon.dispose());environment.dispose();renderer.dispose();});
}
init().catch(error=>{console.error(error);$('loading').hidden=true;$('error').hidden=false;$('error').textContent='スタディを読み込めませんでした。'+error.message;});
