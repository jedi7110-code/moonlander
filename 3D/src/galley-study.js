import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {materials,box,batchStatic} from './obs/materials.js';
import {industrialMaterials} from './obs/industrial.js';
import {createCabinToon} from './obs/cabin-toon.js';
import {createGalley} from './obs/galley.js';

const canvas=document.querySelector('canvas'),status=document.getElementById('status');
try{
  const m=industrialMaterials(await materials()),source=createGalley(m);source.position.x=0;
  const model=batchStatic(source),scene=new THREE.Scene();scene.background=new THREE.Color('#20292b');scene.add(model);
  const floor=new THREE.Group();box(floor,m.dark,0,-.035,-.4,4.7,.065,3.6);scene.add(floor);
  const renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'low-power'});
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  const room=new RoomEnvironment(),pmrem=new THREE.PMREMGenerator(renderer),environment=pmrem.fromScene(room,.035);
  scene.environment=environment.texture;room.dispose();pmrem.dispose();
  scene.add(new THREE.HemisphereLight(0xe2e8df,0x4c5353,1.65));
  const key=new THREE.DirectionalLight(0xfff0dc,2.5);key.position.set(-2,5,4);key.castShadow=true;
  key.shadow.mapSize.set(1024,1024);Object.assign(key.shadow.camera,{left:-3,right:3,top:3,bottom:-3,near:.1,far:15});key.shadow.normalBias=.009;scene.add(key);
  const fill=new THREE.DirectionalLight(0xddeaf0,1.15);fill.position.set(4,3,-2);scene.add(fill);
  const toon=createCabinToon([model,floor]);toon.setStyle('cartoon');
  const camera=new THREE.PerspectiveCamera(36,1,.02,60),controls=new OrbitControls(camera,canvas);
  controls.enableDamping=false;controls.minDistance=.35;controls.maxDistance=15;controls.screenSpacePanning=true;
  const presets={angle:{eye:[2.8,2.8,4.8],target:[0,1.40,-.46]},front:{eye:[0,1.56,4.7],target:[0,1.43,-.45]},
    sink:{eye:[1.95,2.95,1.95],target:[.77,1.075,-.42]},storage:{eye:[1.8,1.50,3.7],target:[.1,.66,-.01]},
    top:{eye:[0,4.3,2.9],target:[0,1.045,-.42]}};
  let preset=new URLSearchParams(location.search).get('view');if(!presets[preset])preset='angle';
  let width=1,height=1,pending=0;
  function render(){pending=0;const visibleHeight=2*camera.position.distanceTo(controls.target)*Math.tan(THREE.MathUtils.degToRad(camera.fov/2));
    toon.update(width,height,visibleHeight,15);renderer.render(scene,camera);
  }
  function requestRender(){if(!pending&&!document.hidden)pending=requestAnimationFrame(render);}
  function selectView(name){
    preset=name;const pose=presets[name],target=new THREE.Vector3(...pose.target),eye=new THREE.Vector3(...pose.eye);
    eye.sub(target).multiplyScalar(Math.max(1,1.32/camera.aspect)).add(target);
    camera.position.copy(eye);controls.target.copy(target);controls.update();
    document.querySelectorAll('[data-view]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.view===name)));
    history.replaceState(null,'',`?view=${name}`);requestRender();
  }
  document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>selectView(b.dataset.view)));
  controls.addEventListener('change',requestRender);controls.addEventListener('start',()=>{preset=null;document.querySelectorAll('[data-view]').forEach(b=>b.setAttribute('aria-pressed','false'));});
  canvas.addEventListener('dblclick',()=>selectView('angle'));
  const observer=new ResizeObserver(()=>{const rect=canvas.getBoundingClientRect();width=Math.max(1,rect.width);height=Math.max(1,rect.height);
    renderer.setSize(width,height,false);camera.aspect=width/height;camera.updateProjectionMatrix();if(preset)selectView(preset);else requestRender();
  });observer.observe(canvas);document.addEventListener('visibilitychange',requestRender);
  let triangles=0;source.traverse(o=>{if(o.isMesh)triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;});
  document.getElementById('stats').textContent=`OBS共通モデル ／ ${Math.round(triangles).toLocaleString()} tris・印刷アトラス1枚`;
  status.hidden=true;
  window.addEventListener('pagehide',()=>{
    cancelAnimationFrame(pending);observer.disconnect();document.removeEventListener('visibilitychange',requestRender);controls.dispose();toon.dispose();
    const geometry=new Set(),material=new Set(),texture=new Set();for(const root of [scene,source])root.traverse(o=>{if(o.geometry)geometry.add(o.geometry);if(o.material)for(const mat of [].concat(o.material))material.add(mat);});
    for(const mat of material)for(const v of Object.values(mat))if(v?.isTexture)texture.add(v);
    for(const resource of [...geometry,...material,...texture])resource.dispose();environment.dispose();renderer.dispose();
  },{once:true});
}catch(error){status.textContent=`読み込みに失敗しました: ${error.message}`;console.error(error);}
