import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {createExteriorShip,EXTERIOR,rotationGravity,exteriorAngle} from './obs/ship-exterior.js';
import {createExteriorOptics} from './obs/exterior-optics.js';
import {createExteriorCruise} from './obs/exterior-cruise.js';
import {createDistantStars} from './obs/exterior-stars.js';
import {createExteriorDissolve} from './obs/exterior-dissolve.js';
import {createExteriorCameraLimit} from './obs/exterior-camera-limit.js';
import {ExteriorCinemaUI} from './obs/exterior-cinema-ui.js';
const $=id=>document.getElementById(id),canvas=$('ship-view');
const entryQuery=new URLSearchParams(location.search),embedded=entryQuery.get('embedded')==='1',freeView=entryQuery.get('viewer')==='free';
const tell=action=>{if(embedded)parent.postMessage({type:'tara-exterior',action},location.origin);};
document.addEventListener('keydown',event=>{if(embedded&&event.key==='Escape'){event.preventDefault();tell('exit');}});
let cleanup=()=>{},closed=false;
window.addEventListener('pagehide',event=>{if(!event.persisted){closed=true;cleanup();}});
try{
  const scene=new THREE.Scene();scene.background=new THREE.Color('#030609');
  const renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.6));renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.18;
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  // Use the cinema's linear star blending and final color conversion. Direct
  // canvas rendering converts each point before blending, changing the sky.
  const presentation=createExteriorDissolve(renderer);
  const ship=createExteriorShip();ship.setCoreScale(Number(new URLSearchParams(location.search).get('core'))||2.6);scene.add(ship.root);
  const optics=createExteriorOptics(ship),bufferSize=new THREE.Vector2();
  scene.add(new THREE.HemisphereLight(0xc4d5e1,0x394b53,.68));
  const sun=new THREE.DirectionalLight(0xfff2d4,3.15);sun.position.set(64,-110,92);sun.castShadow=true;
  sun.shadow.mapSize.set(2048,2048);sun.shadow.camera.left=-32;sun.shadow.camera.right=32;sun.shadow.camera.top=32;sun.shadow.camera.bottom=-32;
  sun.shadow.camera.left=-80;sun.shadow.camera.right=80;sun.shadow.camera.top=80;sun.shadow.camera.bottom=-80;
  sun.shadow.camera.near=1;sun.shadow.camera.far=320;sun.shadow.bias=-.00012;sun.shadow.normalBias=.05;scene.add(sun);
  const bounce=new THREE.DirectionalLight(0x8ca7bd,.65);bounce.position.set(-38,-15,-30);scene.add(bounce,sun.target,bounce.target);
  const stars=createDistantStars();scene.add(stars.haze,stars.field);
  const camera=new THREE.PerspectiveCamera(38,1,.1,2400),controls=new OrbitControls(camera,canvas);
  controls.enableDamping=true;controls.dampingFactor=.10;controls.maxDistance=260;controls.screenSpacePanning=true;controls.rotateSpeed=.6;
  const cameraLimit=createExteriorCameraLimit({ship,camera,controls});
  const cruise=createExteriorCruise({ship,camera,controls,lights:[sun,bounce]});
  let currentView='whole',running=true,angle=55*Math.PI/180,rpm=EXTERIOR.rpm,disposed=false,last=0,frame=0,visible=true,measureFrames=0,measureTime=0;
  const habitatTarget=new THREE.Vector3(),followDelta=new THREE.Vector3(),rotorAxis=new THREE.Vector3(1,0,0);let trackingAngle=angle;
  const views={
    whole:{name:'全体 / 斜め',target:[-2,0,0],eye:[-90,38,70],extent:72},
    bow:{name:'船首 / 前方の装備',target:[11,0,0],eye:[34,12,20],extent:20},
    side:{name:'側面 / 船体と重力区画',target:[-2,0,0],eye:[-2,14,115],extent:72},
    stern:{name:'船尾 / ロケット機関部',target:[-15,0,0],eye:[-43,9,17],extent:25},
    sternSide:{name:'船尾側面 / 4本の機器と文字ロゴ',target:[-13.65,.5,7.75],eye:[-13.65,2,22],extent:11},
    sternFace:{name:'船尾正面 / ノズル奥の青白い光',target:[-18.7,1.0,1.8],eye:[-48,2,3],extent:22},
    eva:{name:'船外用ハッチ / 中央船体側面',target:[4,0,3.1],eye:[11,5,17],extent:13},
    lander:{name:'船体下 / Moonlander探査機 BARRAMUNDI',target:[10.4,-6.8,0],eye:[1.4,-10.8,13],extent:12},
    habitat:{name:'重力区画 / OBSと同じ3階建て',target:[-1.6,EXTERIOR.radius,0],eye:[40,EXTERIOR.radius+16,-34],extent:38},
    habitatRear:{name:'重力区画 / 厚さを揃えた背面',target:[-1.6,EXTERIOR.radius,0],eye:[40,EXTERIOR.radius+16,34],extent:38},
    bearing:{name:'軸受 / 固定船体との接続',target:[-1.6,0,0],eye:[13,9,14],extent:16}
  };
  function gravity(){ $('rpm-value').textContent=`${rpm.toFixed(1)} RPM`;$('gravity').textContent=`約 ${rotationGravity(rpm).toFixed(2)} g`;$('period').textContent=rpm>0?`約 ${(60/rpm).toFixed(1)} 秒`:'停止'; }
  function phase(){const degrees=((angle*180/Math.PI)%360+360)%360;$('phase').value=degrees;$('phase-value').textContent=`${Math.round(degrees)}°`;ship.setAngle(angle);}
  function settings(){const query=new URLSearchParams(location.search);query.set('phase',String(Math.round(angle*180/Math.PI)));query.set('rpm',String(rpm));if(running)query.delete('paused');else query.set('paused','1');history.replaceState(null,'',`?${query}`);}
  function play(value){running=value;$('play').textContent=value?'回転を止める':'回転を再開';$('play').setAttribute('aria-pressed',String(value));last=0;settings();}
  function showView(key){
    currentView=key;const base=views[key],scale=ship.coreScale;
    const fixedView=['bow','stern','sternSide','sternFace','eva','bearing'].includes(key);
    const mapped=p=>[(p[0]-EXTERIOR.rotorX)*scale+EXTERIOR.rotorX,p[1]*scale,p[2]*scale];
    const view={...base,target:fixedView?mapped(base.target):base.target,eye:fixedView?mapped(base.eye):base.eye,
      extent:fixedView?base.extent*scale:['whole','side'].includes(key)?Math.max(72,ship.dimensions.x*1.10):base.extent};
    controls.target.set(...view.target).add(ship.root.position);camera.position.set(...view.eye).add(ship.root.position);
    if(key==='lander'){
      ship.dockedLander.getWorldPosition(controls.target);controls.target.y+=3.1;
      camera.position.copy(controls.target).add(new THREE.Vector3(-7,-2.8,10));
    }
    if(key==='habitat'||key==='habitatRear'){
      ship.rotor.updateWorldMatrix(true,true);ship.pods[0].getWorldPosition(habitatTarget);
      followDelta.copy(camera.position).sub(controls.target).applyAxisAngle(rotorAxis,angle);
      controls.target.copy(habitatTarget);camera.position.copy(habitatTarget).add(followDelta);trackingAngle=angle;
    }
    const offset=camera.position.clone().sub(controls.target),minDistance=view.extent/(2*Math.tan(camera.fov*Math.PI/360)*Math.min(1,camera.aspect));
    if(offset.length()<minDistance)camera.position.copy(controls.target).add(offset.setLength(minDistance));
    controls.update();cameraLimit.update();$('view-name').textContent=view.name;document.querySelectorAll('[data-view]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.view===key)));
    const query=new URLSearchParams(location.search);query.set('view',key);history.replaceState(null,'',`?${query}`);
  }
  document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>showView(b.dataset.view)));
  $('play').onclick=()=>play(!running);
  $('rpm').oninput=()=>{rpm=Number($('rpm').value);gravity();settings();};
  $('phase').oninput=()=>{play(false);angle=Number($('phase').value)*Math.PI/180;phase();settings();};
  $('services').onchange=()=>ship.setServices($('services').checked);
  $('wear').onchange=()=>ship.setWear($('wear').checked);
  $('floors').onchange=()=>ship.setFloorGuides($('floors').checked);
  $('flares').onchange=()=>optics.setEnabled($('flares').checked);
  $('cruise').onchange=()=>{
    cruise.setEnabled($('cruise').checked);
    const query=new URLSearchParams(location.search);if($('cruise').checked)query.delete('cruise');else query.set('cruise','0');history.replaceState(null,'',`?${query}`);
  };
  function balance(){
    $('core').value=ship.coreScale;$('core-value').textContent=`${ship.coreScale.toFixed(1)} 倍`;
    $('dimensions').textContent=`全長 約 ${ship.dimensions.x.toFixed(1)} m / 3 GRAVITY SECTIONS / 7 ROCKET ENGINES`;
    const query=new URLSearchParams(location.search);query.set('core',String(ship.coreScale));history.replaceState(null,'',`?${query}`);
  }
  $('core').oninput=()=>{ship.setCoreScale($('core').value);balance();showView('whole');};
  controls.addEventListener('start',()=>{currentView=null;$('view-name').textContent='自由視点';document.querySelectorAll('[data-view]').forEach(b=>b.setAttribute('aria-pressed','false'));});
  const resize=new ResizeObserver(()=>{const rect=canvas.getBoundingClientRect();renderer.setSize(Math.max(1,rect.width),Math.max(1,rect.height),false);camera.aspect=rect.width/rect.height;camera.updateProjectionMatrix();if(currentView)showView(currentView);});resize.observe(canvas);
  const rect=canvas.getBoundingClientRect();renderer.setSize(rect.width,rect.height,false);camera.aspect=rect.width/rect.height;camera.updateProjectionMatrix();
  const query=new URLSearchParams(location.search);$('rpm').value=rpm;showView(views[query.get('view')]?query.get('view'):'whole');
  if(query.has('rpm')){rpm=THREE.MathUtils.clamp(Number(query.get('rpm'))||0,0,8);$('rpm').value=rpm;}
  if(query.has('phase'))angle=(Number(query.get('phase'))||0)*Math.PI/180;
  if(query.get('paused')==='1')play(false);gravity();phase();
  $('cruise').checked=query.get('cruise')!=='0';cruise.setEnabled($('cruise').checked);
  balance();
  const cinema=freeView?null:new ExteriorCinemaUI({onChange(){last=0;}});
  if(cinema)$('cinema').onclick=()=>cinema.show({cinematic:true,core:ship.coreScale,phase:angle*180/Math.PI,rpm});
  const visibility=()=>{visible=!document.hidden;last=0;};
  // A free-view visit can be closed while the shaders are still compiling.
  cleanup=()=>{if(disposed)return;disposed=true;cinema?.dispose();cancelAnimationFrame(frame);document.removeEventListener('visibilitychange',visibility);resize.disconnect();controls.dispose();cameraLimit.dispose();presentation.dispose();optics.dispose();ship.dispose();stars.dispose();renderer.dispose();renderer.forceContextLoss();};
  await renderer.compileAsync(scene,camera);
  function render(now){
    if(disposed)return;frame=requestAnimationFrame(render);if(!visible||cinema?.open){last=0;return;}
    const rawDt=last?(now-last)/1000:0,dt=Math.min(rawDt,.25);last=now;
    cruise.step(dt);
    if(running){angle=(angle+exteriorAngle(dt,rpm))%(Math.PI*2);phase();}
    if(currentView==='habitat'||currentView==='habitatRear'){
      ship.rotor.updateWorldMatrix(true,true);ship.pods[0].getWorldPosition(habitatTarget);
      followDelta.copy(camera.position).sub(controls.target).applyAxisAngle(rotorAxis,angle-trackingAngle);
      camera.position.copy(habitatTarget).add(followDelta);controls.target.copy(habitatTarget);trackingAngle=angle;
    }
    controls.update();cameraLimit.update();stars.follow(camera);renderer.getDrawingBufferSize(bufferSize);optics.update(camera,bufferSize);
    let viewDraws=0;
    presentation.render({from:camera,to:null,mix:0},()=>{renderer.render(scene,camera);viewDraws=renderer.info.render.calls;return false;});
    if(rawDt>0){measureFrames++;measureTime+=rawDt;}
    if(measureTime>=1.2){$('performance').textContent=`${Math.round(measureFrames/measureTime)} FPS · ${viewDraws+renderer.info.render.calls} DRAWS`;measureFrames=0;measureTime=0;}
  }
  if(!disposed){$('status').hidden=true;tell('ready');frame=requestAnimationFrame(render);document.addEventListener('visibilitychange',visibility);}
}catch(error){if(!closed){$('status').hidden=false;$('status').textContent=`表示できません: ${error.message}`;console.error(error);}}
