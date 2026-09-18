import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {materials} from '../../src/obs/materials.js';
import {industrialMaterials} from '../../src/obs/industrial.js';
import {loadEVAGarment} from '../../src/obs/eva-garment.js';
import {createStudyModel,studyFraming,STUDY_FOCUS,STUDY_VIEWS} from './study-model.js';

const $=id=>document.getElementById(id),canvas=document.querySelector('canvas'),viewport=document.querySelector('.viewer');
async function start(){
  const [base]=await Promise.all([materials(),loadEVAGarment('/3D/assets/obs/eva/pressure-garment.glb')]);
  const model=createStudyModel(industrialMaterials(base));
  if(!model.suits.every(suit=>suit.userData.garmentSource==='Blender'))throw new Error('本編の衣服モデルを読み込めませんでした');
  const renderer=new THREE.WebGLRenderer({canvas,antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));
  renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  const scene=new THREE.Scene();scene.background=new THREE.Color(0x505859);scene.add(model.root);
  const pmrem=new THREE.PMREMGenerator(renderer),environment=new RoomEnvironment(),env=pmrem.fromScene(environment,.025);
  scene.environment=env.texture;environment.dispose();pmrem.dispose();
  const hemi=new THREE.HemisphereLight(0xf5f7ef,0x414d50,1.7);scene.add(hemi);
  const key=new THREE.DirectionalLight(0xfff8e9,2.4);key.position.set(-3,5,4);key.castShadow=true;
  key.shadow.mapSize.set(2048,2048);Object.assign(key.shadow.camera,{left:-2.8,right:2.8,top:3,bottom:-2,near:.1,far:12});key.shadow.normalBias=.015;scene.add(key);
  const fill=new THREE.DirectionalLight(0xcbdde4,1.1);fill.position.set(3,3,-4);scene.add(fill);
  const floor=new THREE.Mesh(new THREE.PlaneGeometry(30,30),new THREE.MeshStandardMaterial({color:0x454f50,roughness:1}));floor.rotation.x=-Math.PI/2;floor.receiveShadow=true;scene.add(floor);
  const grid=new THREE.GridHelper(8,40,0x7d8c85,0x647370);grid.position.y=.002;grid.material.transparent=true;grid.material.opacity=.26;scene.add(grid);
  const camera=new THREE.PerspectiveCamera(30,1,.02,40),controls=new OrbitControls(camera,canvas);
  controls.enableDamping=true;controls.dampingFactor=.09;controls.minDistance=.25;controls.maxDistance=15;controls.autoRotateSpeed=.65;controls.maxPolarAngle=Math.PI*.94;
  const params=new URLSearchParams(location.search);
  let mode=['white','red','all'].includes(params.get('suit'))?params.get('suit'):'white';
  let focus=Object.hasOwn(STUDY_FOCUS,params.get('focus'))?params.get('focus'):'body';
  let view=Object.hasOwn(STUDY_VIEWS,params.get('view'))?params.get('view'):'oblique',frame=0,last=performance.now(),disposed=false;
  function status(){
    for(const [selector,key,value]of [['#suits button','suit',mode],['#focuses button','focus',focus],['#views button','view',view]])
      document.querySelectorAll(selector).forEach(button=>button.setAttribute('aria-pressed',button.dataset[key]===value));
    $('view-label').textContent=`${STUDY_FOCUS[focus].label} / ${STUDY_VIEWS[view].label}`;
    $('status').textContent=`${mode==='all'?'白・赤・白の3着':mode==='red'?'EVA-02 / 赤':'EVA-01 / 白'} · ${STUDY_FOCUS[focus].label}`;
    const query=new URLSearchParams({suit:mode,focus,view});history.replaceState(null,'',`?${query}`);
  }
  function frameView(){
    model.select(mode);controls.autoRotate=false;$('rotate').checked=false;
    const fit=studyFraming({focus,view,mode,aspect:camera.aspect,hanger:$('hanger').checked});
    // Clear any residual orbit/pan velocity before placing the new inspection view.
    controls.enableDamping=false;controls.update();
    controls.target.copy(fit.target);camera.position.copy(fit.position);camera.zoom=1;
    camera.fov=THREE.MathUtils.radToDeg(2*Math.atan(fit.height/12));camera.updateProjectionMatrix();controls.update();controls.enableDamping=true;status();
  }
  document.querySelectorAll('#suits button').forEach(button=>button.onclick=()=>{mode=button.dataset.suit;frameView();});
  document.querySelectorAll('#focuses button').forEach(button=>button.onclick=()=>{focus=button.dataset.focus;if(focus==='backpack')view='back';frameView();});
  document.querySelectorAll('#views button').forEach(button=>button.onclick=()=>{view=button.dataset.view;frameView();});
  $('wireframe').onchange=()=>model.setWireframe($('wireframe').checked);
  $('hanger').onchange=()=>{model.setHanger($('hanger').checked);frameView();};
  $('rotate').onchange=()=>{controls.autoRotate=$('rotate').checked;};
  $('light').onchange=()=>{
    const warm=$('light').value==='warm';key.color.setHex(warm?0xffd0a0:0xfff8e9);key.intensity=warm?1.5:2.4;
    hemi.intensity=warm?.8:1.7;fill.intensity=warm?.45:1.1;renderer.toneMappingExposure=warm?.85:1.05;
    scene.background.setHex(warm?0x303837:0x505859);
  };
  $('reset').onclick=()=>{view='oblique';frameView();};
  function zoom(factor){const delta=camera.position.clone().sub(controls.target);delta.setLength(THREE.MathUtils.clamp(delta.length()*factor,controls.minDistance,controls.maxDistance));camera.position.copy(controls.target).add(delta);controls.update();}
  $('zoom-in').onclick=()=>zoom(.8);$('zoom-out').onclick=()=>zoom(1.25);
  function resize(){const {width,height}=viewport.getBoundingClientRect();renderer.setSize(width,height,false);camera.aspect=width/height;frameView();}
  const observer=new ResizeObserver(resize);observer.observe(viewport);resize();
  $('loading').hidden=true;$('source-label').textContent='本編共通 / カスタムGLB';
  function render(now){if(disposed)return;const dt=Math.min(.05,(now-last)/1000);last=now;if(!document.hidden){
    // three r155 uses one fixed autorotation step per update; compensate for fps.
    controls.autoRotateSpeed=.65*dt*60;controls.update();renderer.render(scene,camera);
  }frame=requestAnimationFrame(render);}
  frame=requestAnimationFrame(render);
  addEventListener('pagehide',event=>{if(event.persisted)return;disposed=true;cancelAnimationFrame(frame);observer.disconnect();controls.dispose();
    const geometries=new Set(),mats=new Set(Object.values(base)),textures=new Set();scene.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material)for(const m of Array.isArray(o.material)?o.material:[o.material])mats.add(m);});
    for(const m of mats)for(const value of Object.values(m))if(value?.isTexture)textures.add(value);
    geometries.forEach(g=>g.dispose());mats.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());env.dispose();renderer.dispose();
  },{once:true});
}
start().catch(error=>{$('loading').hidden=true;$('error').hidden=false;$('error').textContent=`読み込みに失敗しました。${error.message}`;console.error(error);});
