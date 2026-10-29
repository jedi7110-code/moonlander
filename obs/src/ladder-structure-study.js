import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {materials,batchStatic} from './obs/materials.js';
import {buildShip,FLOOR_Y} from './obs/ship.js';
import {FLOORS,ACCESS_LADDER} from './obs/layout.js';
import {createMetalDeckStyle} from './obs/metal-deck.js';
import {createCabinToon} from './obs/cabin-toon.js';
import {createCabinSignage} from './obs/cabin-signage.js';
import {CabinStartupLighting} from './obs/startup-lighting.js';
import {CABIN_AMBIENCE,CABIN_PIXEL_RATIO,limitCabinLights} from './obs/lighting.js';

const $=id=>document.getElementById(id),names={angle:'斜め',front:'正面',side:'側面',back:'背面',top:'上から'};
try{
  const m=await materials(),deckStyle=createMetalDeckStyle(),ship=buildShip(m,{mergeStatic:false,floorBuilder:deckStyle.buildFloor});
  const scene=new THREE.Scene();scene.background=new THREE.Color(0x101719);
  const ladder=ship.staticMesh.getObjectByName('Interdeck access shaft'),workLights=ship.animated.getObjectByName('Ladder work lights');
  scene.attach(ladder);scene.attach(workLights);
  const cabin=batchStatic(ship.staticMesh);scene.add(cabin,ship.animated);
  ship.medical.rig.root.visible=false;limitCabinLights(ship.animated);limitCabinLights(workLights);limitCabinLights(ladder);
  const bounds=new THREE.Box3().setFromObject(ladder);
  const rearClearance=ACCESS_LADDER.depth-.028-(ACCESS_LADDER.rearPanelZ+.094);
  $('dimensions').textContent=`ハシゴ上端 ${bounds.max.y.toFixed(2)} m / 天井上面 10.58 m / 踏み段の裏の隙間 約${Math.round(rearClearance*100)} cm`;
  const roots=[cabin,ship.animated,ladder,workLights],signage=await createCabinSignage(roots),toon=createCabinToon(roots);toon.setStyle('cartoon');
  const lighting=new CabinStartupLighting(roots,{start:false});
  const renderer=new THREE.WebGLRenderer({canvas:$('ladder-view'),antialias:true,powerPreference:'low-power'});
  renderer.localClippingEnabled=true;renderer.setPixelRatio(Math.min(devicePixelRatio,CABIN_PIXEL_RATIO));
  renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=CABIN_AMBIENCE.exposure;
  const pmrem=new THREE.PMREMGenerator(renderer),room=new RoomEnvironment(),environment=pmrem.fromScene(room,.04);
  scene.environment=environment.texture;room.dispose();pmrem.dispose();
  scene.add(new THREE.HemisphereLight(CABIN_AMBIENCE.sky,CABIN_AMBIENCE.ground,1.1));
  const key=new THREE.DirectionalLight(CABIN_AMBIENCE.key,2.25);key.position.set(-5,12,15);scene.add(key);
  const fill=new THREE.DirectionalLight(0xd8e0de,1.0);fill.position.set(6,8,-7);scene.add(fill);
  const camera=new THREE.PerspectiveCamera(42,1,.025,100),controls=new OrbitControls(camera,$('ladder-view'));
  controls.enableDamping=false;controls.screenSpacePanning=true;controls.rotateSpeed=.65;controls.minDistance=.7;controls.maxDistance=45;
  const section=[new THREE.Plane(new THREE.Vector3(1,0,0),2.45),new THREE.Plane(new THREE.Vector3(-1,0,0),2.45)];
  const rearCut=new THREE.Plane(new THREE.Vector3(0,0,1),1.80);
  let mode='angle',width=1,height=1,pending=0,disposed=false;
  function render(){
    pending=0;if(disposed)return;
    const visibleHeight=2*camera.position.distanceTo(controls.target)*Math.tan(THREE.MathUtils.degToRad(camera.fov/2));
    toon.update(width,height,visibleHeight,15);renderer.render(scene,camera);
  }
  function requestRender(){if(!pending&&!disposed)pending=requestAnimationFrame(render);}
  function updateContext(){
    const isolated=$('isolated').checked;cabin.visible=ship.animated.visible=!isolated;
    const planes=isolated?[]:$('cut-wall').checked?[...section,rearCut]:[...section];
    const focus=$('focus').value;
    if(focus!=='all'){
      const floor=focus==='roof'?10.58:FLOOR_Y[Number(focus)];
      planes.push(new THREE.Plane(new THREE.Vector3(0,1,0),-(floor-.4)));
      planes.push(new THREE.Plane(new THREE.Vector3(0,-1,0),focus==='roof'?13.6:mode==='top'?floor+.025:floor+3.18));
    }
    renderer.clippingPlanes=planes;
    requestRender();
  }
  function showView(value=mode??'angle'){
    mode=value;
    const focus=$('focus').value,all=focus==='all',roof=focus==='roof',floor=FLOOR_Y[Number(focus)]??FLOOR_Y[0];
    const targetY=all?6.5:roof?11.95:floor+1.1;
    const distance=all?Math.max(21,6.5/camera.aspect):Math.max(5.5,3.1/camera.aspect);
    controls.target.set(0,value==='top'&&!all&&!roof?floor+.005:targetY,value==='top'?.37:ACCESS_LADDER.depth+.35);
    camera.up.set(0,1,0);
    const offset={front:[0,.12,distance],side:[distance,.35,0],back:[0,.12,-distance],angle:[distance*.46,distance*.26,distance*.90],top:[0,distance,.01]}[value];
    camera.position.copy(controls.target).add(new THREE.Vector3(...offset));controls.update();updateContext();
    $('view-name').textContent=`${names[value]} / ${all?'ハシゴ全体':roof?'天井より上':FLOORS[Number(focus)].name}`;
    document.querySelectorAll('[data-view]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.view===value)));
    requestRender();
  }
  document.querySelectorAll('[data-view]').forEach(button=>button.onclick=()=>showView(button.dataset.view));
  $('focus').onchange=()=>showView();$('isolated').onchange=updateContext;$('cut-wall').onchange=updateContext;
  controls.addEventListener('change',requestRender);
  controls.addEventListener('start',()=>{mode=null;$('view-name').textContent='自由視点';document.querySelectorAll('[data-view]').forEach(button=>button.setAttribute('aria-pressed','false'));});
  const observer=new ResizeObserver(()=>{
    const rect=$('ladder-view').getBoundingClientRect();width=Math.max(1,rect.width);height=Math.max(1,rect.height);
    renderer.setSize(width,height,false);camera.aspect=width/height;camera.updateProjectionMatrix();
    if(mode)showView();else requestRender();
  });observer.observe($('ladder-view'));updateContext();showView();
  await renderer.compileAsync(scene,camera);
  $('status').hidden=true;requestRender();
  // Late artwork textures can finish after the first static draw.
  const previousLoad=THREE.DefaultLoadingManager.onLoad;
  THREE.DefaultLoadingManager.onLoad=()=>{previousLoad?.();requestRender();};
  window.addEventListener('pagehide',event=>{
    if(event.persisted)return;disposed=true;cancelAnimationFrame(pending);observer.disconnect();controls.dispose();lighting.dispose();toon.dispose();signage.dispose();ship.gateFinish.dispose();environment.dispose();
    THREE.DefaultLoadingManager.onLoad=previousLoad;
    const geometries=new Set(),usedMaterials=new Set(),textures=new Set();
    scene.traverse(object=>{if(object.geometry)geometries.add(object.geometry);for(const material of [].concat(object.material??[])){usedMaterials.add(material);Object.values(material).forEach(value=>{if(value?.isTexture)textures.add(value);});}});
    geometries.forEach(geometry=>geometry.dispose());usedMaterials.forEach(material=>material.dispose());textures.forEach(texture=>texture.dispose());renderer.dispose();
  },{once:true});
}catch(error){$('status').hidden=false;$('status').textContent=`表示できません: ${error.message}`;console.error(error);}
