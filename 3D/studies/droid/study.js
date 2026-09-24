import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {createCabinToon} from '../../src/obs/cabin-toon.js';
import {createDroid,DROID_EXPRESSIONS} from './droid-model.js';

const $=id=>document.getElementById(id),params=new URLSearchParams(location.search);
const MODES={idle:'待機 / 周囲を確認',walk:'歩行 / 船内をゆっくり巡回',carry:'配膳 / トレーを両手で保持',charging:'充電休止 / 駆動・顔表示 OFF'};
const VIEWS={three:{eye:[2.35,1.60,3.25],target:[0,.94,0],label:'THREE-QUARTER'},front:{eye:[0,1.19,4.0],target:[0,.94,0],label:'FRONT'},side:{eye:[4.0,1.23,0],target:[0,.94,0],label:'SIDE'},back:{eye:[0,1.35,-4.0],target:[0,.94,0],label:'BACK'},head:{eye:[.22,1.655,1.05],target:[0,1.565,.025],label:'NIXIE / EXPRESSIONS'},hands:{eye:[1.05,1.50,1.8],target:[0,1.09,.24],label:'SERVICE HANDS'}};
Object.assign(VIEWS,{'head-side':{eye:[.92,1.69,.38],target:[0,1.575,.010],label:'HEAD / SIDE MODULE'},'head-back':{eye:[.54,1.67,-.96],target:[0,1.575,-.020],label:'HEAD / REAR SERVICE COVER'},'head-under':{eye:[.50,1.24,.95],target:[0,1.55,.010],label:'HEAD / UNDERSIDE'}});

function init(){
  const canvas=$('droid-canvas'),renderer=new THREE.WebGLRenderer({canvas,antialias:true});
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.6));renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.08;
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  const scene=new THREE.Scene();scene.background=new THREE.Color(0x1c2420);scene.fog=new THREE.Fog(0x1c2420,7,15);
  const room=new RoomEnvironment(),pmrem=new THREE.PMREMGenerator(renderer),env=pmrem.fromScene(room,.04);scene.environment=env.texture;room.dispose();pmrem.dispose();
  scene.add(new THREE.HemisphereLight(0xe7ebd7,0x44473d,1.8));
  const key=new THREE.DirectionalLight(0xffe9c9,3.2);key.position.set(-3,5,4);key.castShadow=true;key.shadow.mapSize.set(2048,2048);key.shadow.camera.left=-2;key.shadow.camera.right=2;key.shadow.camera.top=2.4;key.shadow.camera.bottom=-2;key.shadow.camera.near=.1;key.shadow.camera.far=12;key.shadow.bias=-.0002;key.shadow.normalBias=.012;key.shadow.radius=3;scene.add(key);
  const rim=new THREE.DirectionalLight(0xc9dfe7,2.6);rim.position.set(2,3,-3);scene.add(rim);
  const fill=new THREE.DirectionalLight(0xe5cfb1,.7);fill.position.set(4,2,3);scene.add(fill);
  const floor=new THREE.Mesh(new THREE.PlaneGeometry(60,60),new THREE.MeshStandardMaterial({color:0x303b30,roughness:.94,metalness:.15}));floor.rotation.x=-Math.PI/2;floor.position.y=-.002;floor.receiveShadow=true;scene.add(floor);
  const stage=new THREE.Group();scene.add(stage);
  const marker=new THREE.MeshBasicMaterial({color:0x6a7057,transparent:true,opacity:.37,depthWrite:false});
  const circle=new THREE.Mesh(new THREE.RingGeometry(1.04,1.045,96),marker);circle.rotation.x=-Math.PI/2;circle.position.y=.0001;stage.add(circle);
  for(let i=0;i<32;i++){
    const angle=i/32*Math.PI*2,r=1.07,mark=new THREE.Mesh(new THREE.PlaneGeometry(.002,i%4===0?.06:.025),marker);mark.rotation.x=-Math.PI/2;mark.rotation.z=-angle;mark.position.set(Math.sin(angle)*r,.0005,Math.cos(angle)*r);stage.add(mark);
  }
  const droid=createDroid();scene.add(droid.root);const toon=createCabinToon([droid.root]);
  // Small workshop labels are drawn locally; no external image/font dependency.
  const labelCanvas=document.createElement('canvas');labelCanvas.width=256;labelCanvas.height=128;
  const ctx=labelCanvas.getContext('2d');ctx.fillStyle='#888a77';ctx.fillRect(0,0,256,128);ctx.fillStyle='#252b26';ctx.font='bold 29px Helvetica, Arial, sans-serif';ctx.fillText('SERVICE',18,40);ctx.font='48px Helvetica, Arial, sans-serif';ctx.fillText('3817',18,96);
  const labelTexture=new THREE.CanvasTexture(labelCanvas);labelTexture.colorSpace=THREE.SRGBColorSpace;
  const label=new THREE.Mesh(new THREE.PlaneGeometry(.071,.0355),new THREE.MeshBasicMaterial({map:labelTexture}));label.position.set(-.073,.403,.0885);droid.chassis.add(label);
  const camera=new THREE.PerspectiveCamera(32,1,.03,70),controls=new OrbitControls(camera,canvas);controls.minDistance=.5;controls.maxDistance=8;controls.maxPolarAngle=Math.PI*.70;controls.minPolarAngle=.18;
  let mode=Object.hasOwn(MODES,params.get('mode'))?params.get('mode'):'idle';
  let expression=Object.hasOwn(DROID_EXPRESSIONS,params.get('face'))?params.get('face'):'neutral';
  let view=Object.hasOwn(VIEWS,params.get('view'))?params.get('view'):'three';
  let style=['current','cartoon','flat'].includes(params.get('style'))?params.get('style'):'current';
  let time=THREE.MathUtils.clamp(Number(params.get('time'))||0,0,86400),speed=1,playing=!params.has('time')&&!matchMedia('(prefers-reduced-motion: reduce)').matches;
  let dirty=true,width=1,height=1,last=performance.now(),frame,hud=0;
  function saveURL(){const url=new URL(location.href);url.searchParams.set('mode',mode);url.searchParams.set('view',view);url.searchParams.set('style',style);url.searchParams.set('face',expression);url.searchParams.set('time',time.toFixed(2));history.replaceState(null,'',url);}
  function setView(next){
    view=next;const preset=VIEWS[view];camera.position.set(...preset.eye);controls.target.set(...preset.target);controls.update();
    if(mode==='walk'){camera.position.sub(controls.target).multiplyScalar(1.25).add(controls.target);controls.update();}
    $('view-label').textContent=preset.label;document.querySelectorAll('[data-view]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.view===view));dirty=true;
  }
  function updateHUD(){
    $('mode-label').textContent=MODES[mode];$('play').textContent=playing?'一時停止':'再生';$('play').setAttribute('aria-pressed',playing);$('time').max=Math.max(20,Math.ceil(time/20)*20);$('time').value=time;$('time-output').textContent=time.toFixed(1)+' s';
    document.querySelectorAll('[data-mode]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.mode===mode));document.querySelectorAll('[data-style]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.style===style));
    document.querySelectorAll('[data-expression]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.expression===expression));
  }
  function pose(){droid.update(time,mode);dirty=true;}
  document.querySelectorAll('[data-mode]').forEach(button=>button.onclick=()=>{mode=button.dataset.mode;time=0;pose();setView(mode==='walk'?'three':view);updateHUD();saveURL();});
  document.querySelectorAll('[data-view]').forEach(button=>button.onclick=()=>{if((button.dataset.view.startsWith('head')||button.dataset.view==='hands')&&mode==='walk'){mode='idle';time=0;pose();updateHUD();}setView(button.dataset.view);saveURL();});
  document.querySelectorAll('[data-style]').forEach(button=>button.onclick=()=>{style=button.dataset.style;toon.setStyle(style);dirty=true;updateHUD();saveURL();});
  document.querySelectorAll('[data-expression]').forEach(button=>button.onclick=()=>{expression=button.dataset.expression;droid.face.setExpression(expression);dirty=true;updateHUD();saveURL();});
  $('play').onclick=()=>{playing=!playing;last=performance.now();updateHUD();saveURL();};
  $('reset').onclick=()=>{time=0;pose();updateHUD();saveURL();};
  $('time').oninput=()=>{time=Number($('time').value);playing=false;pose();updateHUD();saveURL();};
  $('speed').onchange=()=>{speed=Number($('speed').value);};
  controls.addEventListener('change',()=>dirty=true);
  function resize(){const rect=canvas.getBoundingClientRect();width=Math.max(1,rect.width);height=Math.max(1,rect.height);renderer.setSize(width,height,false);camera.aspect=width/height;camera.updateProjectionMatrix();dirty=true;}
  const observer=new ResizeObserver(resize);observer.observe(canvas);resize();setView(view);toon.setStyle(style);droid.face.setExpression(expression);pose();updateHUD();$('loading').hidden=true;
  function tick(now){frame=requestAnimationFrame(tick);const dt=Math.min((now-last)/1000,.05);last=now;if(document.hidden)return;if(playing){time+=dt*speed;pose();hud+=dt;if(hud>.10){updateHUD();hud=0;}}if(dirty){toon.update(width,height,2,10);renderer.render(scene,camera);dirty=false;}}
  frame=requestAnimationFrame(tick);
  window.addEventListener('pagehide',event=>{if(event.persisted)return;cancelAnimationFrame(frame);observer.disconnect();controls.dispose();toon.dispose();droid.dispose();labelTexture.dispose();label.geometry.dispose();label.material.dispose();floor.geometry.dispose();floor.material.dispose();stage.traverse(o=>o.geometry?.dispose());marker.dispose();env.dispose();renderer.dispose();});
}
try{init();}catch(error){console.error(error);$('loading').hidden=true;$('error').hidden=false;$('error').textContent='スタディを読み込めませんでした。'+error.message;}
