import * as THREE from 'three';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {Reflector} from 'three/addons/objects/Reflector.js';
import {materials,box} from '../../src/obs/materials.js';
import {industrialMaterials} from '../../src/obs/industrial.js';
import {createMachinedMetals,finishMachinedFixtures} from '../../src/obs/machined-metals.js';
import {createBulkheadGate,BULKHEAD_GATE} from '../../src/obs/bulkhead-gate.js';
import {loadMiloHead} from '../../src/obs/head.js';
import {loadMiloBody} from '../../src/obs/milo-body.js';
import {createMilo} from '../../src/obs/characters.js';
import {createMiloToon} from '../../src/obs/milo-toon.js';
import {createCabinToon} from '../../src/obs/cabin-toon.js';
import {attachGrowthStudy,studyDate} from './growth-model.js';
import {GROOMING_DURATION,createVanity,createGroomingTools,prepareGroomingMotion} from './grooming-model.js';

const $=id=>document.getElementById(id),params=new URLSearchParams(location.search);
const start=studyDate(params.get('start'),1)?params.get('start'):'2026-09-24';
const date=studyDate(start,16);$('grooming-date').dateTime=date;$('grooming-date').textContent=date.replaceAll('-','.')+' / 08:00';
$('back-growth').href='./growth.html?day=15&start='+start;
let time=THREE.MathUtils.clamp(Number(params.get('time'))||0,0,GROOMING_DURATION),playing=false,dirty=true;
async function init(){
  const [m,head]=await Promise.all([materials(),loadMiloHead(),loadMiloBody()]);
  const canvas=$('grooming-canvas'),renderer=new THREE.WebGLRenderer({canvas,antialias:true,stencil:true});
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.12;
  const scene=new THREE.Scene();scene.background=new THREE.Color(0x172124);
  const pmrem=new THREE.PMREMGenerator(renderer),room=new RoomEnvironment(),env=pmrem.fromScene(room,.04);scene.environment=env.texture;room.dispose();pmrem.dispose();
  scene.add(new THREE.HemisphereLight(0xf2f2df,0x637777,2.2));
  const key=new THREE.DirectionalLight(0xffedd9,2.5);key.position.set(3,6,2);scene.add(key);
  const fill=new THREE.DirectionalLight(0xe1f4ff,1.1);fill.position.set(-1,3,-3);scene.add(fill);
  const worn=industrialMaterials(m),metals=createMachinedMetals(),gate=createBulkheadGate(worn,{...BULKHEAD_GATE,x:0,floor:0,room:'laundry'},m);
  finishMachinedFixtures(gate.root,worn,metals);scene.add(gate.root,gate.lights);
  box(gate.root,worn.metal,0,.055,-.34,2.36,.10,2.52).name='Study entrance floor';
  // Study cutaway: retain the real room and furniture but remove the viewing
  // side wall/ceiling. This does not alter the OBS cabin geometry.
  for(const part of gate.root.children){
    if(!part.isMesh||!['BoxGeometry','RoundedBoxGeometry'].includes(part.geometry.type))continue;
    if(part.position.y>2.65||part.position.x>1.08)part.visible=false;
  }
  const station=createVanity(worn,metals);scene.add(station.root);
  const mirror=new Reflector(new THREE.PlaneGeometry(.72,.89),{color:0xa8b5b5,textureWidth:512,textureHeight:768,clipBias:.002,multisample:2});
  mirror.name='Working laundry mirror';mirror.getRenderTarget().stencilBuffer=true;station.mirror.add(mirror);
  const lamp=new THREE.PointLight(0xeef5ef,1.4,3,2);lamp.position.set(-.55,2.15,-3.22);scene.add(lamp);
  const growth=attachGrowthStudy(head),milo=createMilo(m,head);scene.add(milo);
  const tools=createGroomingTools(milo.userData.body,m,metals),motion=prepareGroomingMotion(milo,station,tools);
  const characterToon=createMiloToon(milo),cabinToon=createCabinToon([gate.root,station.root]);cabinToon.setStyle('cartoon');
  // Three's physical-material clone drops custom defines. Restore the UV
  // varying required by the machined-metal props after the toon pass clones them.
  for(const tool of Object.values(tools))tool.traverse(part=>{
    if(part.material?.anisotropy>0)part.material.defines.USE_UV='';
  });
  const camera=new THREE.PerspectiveCamera(42,1,.05,40),controls=new OrbitControls(camera,canvas);
  controls.minDistance=1.2;controls.maxDistance=11;controls.maxPolarAngle=Math.PI*.92;controls.addEventListener('change',()=>dirty=true);
  let currentView='work';
  function showTools(){
    const isolated=['front','side'].includes(currentView);
    tools.clipper.visible=!isolated||(time>=7&&time<=30.3);
    tools.shaver.visible=!isolated||(time>=33&&time<=46.3);
  }
  function setView(view){
    currentView=view;gate.root.visible=station.root.visible=!['front','side'].includes(view);showTools();
    for(const part of gate.root.children)if(['Eight-sided gate frame','Gate seal','Rear threshold frame'].includes(part.name))part.visible=view==='room';
    const views={room:{eye:[4.4,3.2,1.4],target:[0,1.12,-2.7]},work:{eye:[2.7,2.2,-1.65],target:[-.25,1.33,-3.3]},mirror:{eye:[1.35,2.0,-2.70],target:[-.52,1.70,-3.22]},front:{eye:[-2.15,1.77,-3.22],target:[-.37,1.60,-3.22]},side:{eye:[-.37,1.77,-1.44],target:[-.37,1.60,-3.22]}};
    const choice=views[view]??views.work;camera.position.set(...choice.eye);controls.target.set(...choice.target);controls.update();
    document.querySelectorAll('[data-view]').forEach(button=>button.setAttribute('aria-pressed',button.dataset.view===view));saveURL();dirty=true;
  }
  function saveURL(){const url=new URL(location.href);url.searchParams.set('time',String(Math.round(time*100)/100));url.searchParams.set('start',start);url.searchParams.set('view',currentView);history.replaceState(null,'',url);}
  function update(value,save=true){
    time=THREE.MathUtils.clamp(Number(value)||0,0,GROOMING_DURATION);const pose=motion.update(time);growth.setGrowth(pose.hair,pose.beard);
    $('grooming-time').value=time;$('time-output').textContent=time.toFixed(1)+' / '+GROOMING_DURATION+'秒';$('phase').textContent=pose.label;
    $('hair-status').textContent=pose.hair===0?'短髪A':pose.hair===1?'DAY 15の長さ':'カット中';
    $('beard-status').textContent=pose.beard===0?'髭なし':pose.beard===1?'伸びた状態':'髭剃り中';
    showTools();
    if(save)saveURL();dirty=true;
  }
  let last=performance.now();
  function play(value){playing=value;last=performance.now();$('play-grooming').textContent=value?'一時停止':'再生';$('play-grooming').setAttribute('aria-pressed',value);if(!value)saveURL();}
  $('play-grooming').onclick=()=>{if(time===GROOMING_DURATION)update(0);play(!playing);};
  $('restart-grooming').onclick=()=>{update(0);play(true);};
  $('grooming-time').oninput=()=>{play(false);update($('grooming-time').value);};
  document.querySelectorAll('[data-time]').forEach(button=>button.onclick=()=>{play(false);update(button.dataset.time);});
  document.querySelectorAll('[data-view]').forEach(button=>button.onclick=()=>setView(button.dataset.view));
  let width=1,height=1;
  const resize=()=>{const rect=canvas.getBoundingClientRect();width=Math.max(1,rect.width);height=Math.max(1,rect.height);renderer.setSize(width,height,false);camera.aspect=width/height;camera.updateProjectionMatrix();dirty=true;};
  const observer=new ResizeObserver(resize);observer.observe(canvas);resize();setView(['room','work','mirror','front','side'].includes(params.get('view'))?params.get('view'):'work');update(time);play(false);
  document.querySelectorAll('button,input').forEach(button=>button.disabled=false);$('loading').hidden=true;
  let frame;
  function tick(now){
    frame=requestAnimationFrame(tick);const dt=Math.min((now-last)/1000,.1);last=now;if(document.hidden)return;
    if(playing){update(time+dt,false);if(time===GROOMING_DURATION)play(false);}
    if(dirty){characterToon.update(width,height);cabinToon.update(width,height,3,15);renderer.render(scene,camera);dirty=false;}
  }
  frame=requestAnimationFrame(tick);
  window.addEventListener('pagehide',event=>{if(event.persisted)return;cancelAnimationFrame(frame);observer.disconnect();controls.dispose();characterToon.dispose();cabinToon.dispose();motion.dispose();mirror.dispose();env.dispose();renderer.dispose();});
}
init().catch(error=>{console.error(error);$('loading').hidden=true;$('error').hidden=false;$('error').textContent='スタディを読み込めませんでした。'+error.message;});
