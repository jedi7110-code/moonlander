import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {materials,batchStatic,createStaticShadowProxy} from './obs/materials.js';
import {buildShip,REAR_ROOM_GATES} from './obs/ship.js';
import {createMetalDeckStyle} from './obs/metal-deck.js';
import {createCabinToon} from './obs/cabin-toon.js';
import {createCabinSignage} from './obs/cabin-signage.js';
import {CabinStartupLighting} from './obs/startup-lighting.js';
import {CABIN_AMBIENCE,CABIN_PIXEL_RATIO,CABIN_SHADOW_SIZE,limitCabinLights,limitShadowCasters} from './obs/lighting.js';

const canvas=document.getElementById('gate-view'),status=document.getElementById('status'),deck=document.getElementById('deck');
try{
  const m=await materials(),deckStyle=createMetalDeckStyle();
  const ship=buildShip(m,{mergeStatic:false,floorBuilder:deckStyle.buildFloor});
  const scene=new THREE.Scene();scene.background=new THREE.Color(0x090d0f);
  const frameRoot=new THREE.Group();frameRoot.name='Gate frame study';
  const {frames}=ship.gateFinish;
  for(const {mesh}of frames)frameRoot.attach(mesh);
  const staticMesh=batchStatic(ship.staticMesh);scene.add(staticMesh,frameRoot,ship.animated);
  ship.medical.rig.root.visible=false;
  limitCabinLights(ship.animated);
  const shadowProxy=createStaticShadowProxy(staticMesh);if(shadowProxy)scene.add(shadowProxy);
  const roots=[staticMesh,ship.animated,frameRoot];
  const signage=await createCabinSignage(roots),toon=createCabinToon(roots);toon.setStyle('cartoon');
  function setFinish(value){
    for(const frame of frames){
      frame.mesh.material=value==='paint'?frame.paint[0]:frame.metal;
      frame.reveal.material=value==='paint'?frame.paint[1]:frame.metal;
    }
    document.querySelectorAll('[data-finish]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.finish===value)));
  }
  setFinish('paint');
  const lighting=new CabinStartupLighting(roots,{start:false});
  const renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'low-power'});
  renderer.localClippingEnabled=true;renderer.setPixelRatio(Math.min(devicePixelRatio,CABIN_PIXEL_RATIO));
  renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=CABIN_AMBIENCE.exposure;
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  const pmrem=new THREE.PMREMGenerator(renderer),room=new RoomEnvironment(),environment=pmrem.fromScene(room,.04);
  scene.environment=environment.texture;room.dispose();pmrem.dispose();
  scene.add(new THREE.HemisphereLight(CABIN_AMBIENCE.sky,CABIN_AMBIENCE.ground,CABIN_AMBIENCE.ambient));
  const key=new THREE.DirectionalLight(CABIN_AMBIENCE.key,CABIN_AMBIENCE.keyPower);key.position.set(-5,12,15);key.target.position.set(0,5,0);key.castShadow=true;
  key.shadow.mapSize.set(CABIN_SHADOW_SIZE,CABIN_SHADOW_SIZE);Object.assign(key.shadow.camera,{left:-16,right:16,top:11,bottom:-10,near:.1,far:60});key.shadow.bias=-.0001;key.shadow.normalBias=.024;scene.add(key,key.target);
  const fill=new THREE.DirectionalLight(CABIN_AMBIENCE.fill,CABIN_AMBIENCE.fillPower);fill.position.set(12,7,9);scene.add(fill);limitShadowCasters(scene);
  const camera=new THREE.PerspectiveCamera(46,1,.025,100),controls=new OrbitControls(camera,canvas);
  controls.enableDamping=false;controls.minDistance=1.2;controls.maxDistance=20;controls.screenSpacePanning=true;controls.rotateSpeed=.65;
  let pending=0,width=1,height=1,mode='angle';
  function render(){
    pending=0;
    const visibleHeight=2*camera.position.distanceTo(controls.target)*Math.tan(THREE.MathUtils.degToRad(camera.fov/2));
    toon.update(width,height,visibleHeight,15);renderer.render(scene,camera);
  }
  function requestRender(){if(!pending)pending=requestAnimationFrame(render);}
  function setView(value){
    mode=value;
    const g=REAR_ROOM_GATES[Number(deck.value)],distance=Math.max(4.4,3.6/camera.aspect);
    controls.target.set(g.x,g.floor+1.35,g.front-.15);
    if(value==='front')camera.position.set(g.x,g.floor+1.40,g.front+distance);
    else if(value==='context')camera.position.set(g.x-.6,g.floor+1.80,g.front+distance*1.75);
    else camera.position.set(g.x-1.05,g.floor+1.70,g.front+distance);
    controls.update();requestRender();
    document.querySelectorAll('[data-view]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.view===value)));
  }
  controls.addEventListener('change',requestRender);
  controls.addEventListener('start',()=>{mode=null;document.querySelectorAll('[data-view]').forEach(button=>button.setAttribute('aria-pressed','false'));});
  document.querySelectorAll('[data-view]').forEach(button=>button.onclick=()=>setView(button.dataset.view));
  document.querySelectorAll('[data-finish]').forEach(button=>button.onclick=()=>{setFinish(button.dataset.finish);requestRender();});
  deck.onchange=()=>setView(mode??'angle');
  const observer=new ResizeObserver(()=>{
    const rect=canvas.getBoundingClientRect();width=Math.max(1,rect.width);height=Math.max(1,rect.height);
    renderer.setSize(width,height,false);camera.aspect=width/height;camera.updateProjectionMatrix();
    if(mode)setView(mode);else requestRender();
  });
  observer.observe(canvas);THREE.DefaultLoadingManager.onLoad=requestRender;status.hidden=true;
  window.addEventListener('pagehide',()=>{
    cancelAnimationFrame(pending);observer.disconnect();controls.dispose();lighting.dispose();toon.dispose();signage.dispose();environment.dispose();ship.gateFinish.dispose();
    const geometries=new Set(),usedMaterials=new Set();
    scene.traverse(object=>{if(object.geometry)geometries.add(object.geometry);if(object.material)for(const material of [].concat(object.material))usedMaterials.add(material);});
    geometries.forEach(geometry=>geometry.dispose());usedMaterials.forEach(material=>material.dispose());renderer.dispose();
  },{once:true});
}catch(error){status.textContent=`読み込みに失敗しました: ${error.message}`;console.error(error);}
