import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {materials} from './obs/materials.js';
import {industrialMaterials} from './obs/industrial.js';
import {createServicePartsPanel} from './obs/service-parts.js';

const canvas=document.getElementById('study');
const status=document.querySelector('.status');
const renderer=new THREE.WebGLRenderer({canvas,antialias:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,2));
renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure=1.12;
renderer.shadowMap.enabled=true;
renderer.shadowMap.type=THREE.PCFSoftShadowMap;

const scene=new THREE.Scene();
scene.background=new THREE.Color('#202b28');
const camera=new THREE.PerspectiveCamera(35,1,.05,80);
const controls=new OrbitControls(camera,canvas);
controls.enableDamping=true;
controls.dampingFactor=.08;
controls.minDistance=2.1;
controls.maxDistance=24;
controls.maxPolarAngle=Math.PI*.75;
const pmrem=new THREE.PMREMGenerator(renderer);
const room=new RoomEnvironment();
const environment=pmrem.fromScene(room,.04);
scene.environment=environment.texture;
room.dispose();pmrem.dispose();
scene.add(new THREE.HemisphereLight(0xf0f0df,0x35423e,1.5));
const key=new THREE.DirectionalLight(0xffe7c8,3.2);
key.position.set(-3,4.5,6);key.castShadow=true;
key.shadow.mapSize.set(2048,2048);key.shadow.camera.left=-8;key.shadow.camera.right=8;
key.shadow.camera.top=5;key.shadow.camera.bottom=-5;key.shadow.bias=-.0003;
scene.add(key);
const fill=new THREE.DirectionalLight(0xc1d9d0,1.3);fill.position.set(4,1,3);scene.add(fill);

let models={},mode='all';
try{
  const m=industrialMaterials(await materials());
  models={cassette:createServicePartsPanel(m,'cassette'),rack:createServicePartsPanel(m,'rack'),manifold:createServicePartsPanel(m,'manifold')};
  for(const [name,model] of Object.entries(models)){
    model.position.x={cassette:-2.81,rack:0,manifold:2.81}[name];
    model.name=name;scene.add(model);
  }
  status.hidden=true;
}catch(error){status.textContent=`読み込みに失敗しました: ${error.message}`;throw error;}

const selectButtons=[...document.querySelectorAll('[data-view]')];
function compareDistance(){
  return Math.max(7.5,8.7/(2*Math.tan(THREE.MathUtils.degToRad(camera.fov/2))*camera.aspect)*1.12);
}
function view(next){
  mode=next;
  for(const [name,model] of Object.entries(models))model.visible=next==='all'||next===name;
  selectButtons.forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.view===next)));
  document.querySelector('.labels').hidden=next!=='all';
  const x=next==='all'?0:models[next].position.x;
  controls.target.set(x,0,0);
  camera.position.set(x+(next==='all'?.3:.22),next==='all'?.65:.26,next==='all'?compareDistance():3.45);
  controls.minDistance=next==='all'?5:1.7;
  controls.update();
  history.replaceState(null,'',`?view=${next}`);
}
selectButtons.forEach(button=>button.addEventListener('click',()=>view(button.dataset.view)));
function resize(){
  const rect=canvas.getBoundingClientRect();
  renderer.setSize(rect.width,rect.height,false);
  camera.aspect=rect.width/rect.height;camera.updateProjectionMatrix();
  if(mode==='all')camera.position.z=compareDistance();
}
addEventListener('resize',resize);
resize();
const requested=new URLSearchParams(location.search).get('view');
view(models[requested]?requested:(innerWidth<670?'cassette':'all'));
function frame(){controls.update();renderer.render(scene,camera);requestAnimationFrame(frame)}
frame();
addEventListener('pagehide',event=>{
  if(event.persisted)return;
  controls.dispose();renderer.dispose();environment.dispose();
  const geometries=new Set(),materials=new Set(),textures=new Set();
  scene.traverse(object=>{
    if(object.geometry)geometries.add(object.geometry);
    if(object.material)materials.add(object.material);
  });
  for(const material of materials)for(const value of Object.values(material))if(value?.isTexture)textures.add(value);
  for(const resource of [...geometries,...materials,...textures])resource.dispose();
});
