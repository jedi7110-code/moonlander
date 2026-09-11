import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {createIcons,Play,Pause} from 'lucide';

const $=id=>document.getElementById(id);
const renderer=new THREE.WebGLRenderer({canvas:$('view'),antialias:true,preserveDrawingBuffer:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.15;
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
const scene=new THREE.Scene();scene.background=new THREE.Color(0xb7c1c1);
const camera=new THREE.PerspectiveCamera(33,1,.005,10);
const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.minDistance=.36;controls.maxDistance=5;controls.maxPolarAngle=Math.PI*.52;controls.target.set(0,.17,.008);
const environment=new RoomEnvironment();const pmrem=new THREE.PMREMGenerator(renderer);const env=pmrem.fromScene(environment,.04);scene.environment=env.texture;environment.dispose();pmrem.dispose();
scene.add(new THREE.HemisphereLight(0xffffff,0x687275,2.2));
const key=new THREE.DirectionalLight(0xfff8ee,3);key.position.set(-.6,1,.5);key.castShadow=true;key.shadow.mapSize.set(2048,2048);Object.assign(key.shadow.camera,{left:-.6,right:.6,top:.6,bottom:-.6,near:.01,far:3});key.shadow.normalBias=.0004;key.shadow.bias=-.00005;scene.add(key);
const ground=new THREE.Mesh(new THREE.PlaneGeometry(50,50),new THREE.MeshStandardMaterial({color:0xb7c1c1,roughness:1}));ground.rotation.x=-Math.PI/2;ground.position.y=-.001;ground.receiveShadow=true;scene.add(ground);
let model,mixer,helper,active;let paused=false;const actions={};
const bytes=Uint8Array.from(atob(window.LUCY_MODEL),c=>c.charCodeAt(0));
const gltf=await new GLTFLoader().parseAsync(bytes.buffer,'');
model=gltf.scene;model.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;o.frustumCulled=false;o.material.envMapIntensity=.35;}});scene.add(model);
helper=new THREE.SkeletonHelper(model);helper.material.depthTest=false;helper.material.transparent=true;helper.material.opacity=.8;helper.visible=false;scene.add(helper);
mixer=new THREE.AnimationMixer(model);for(const c of gltf.animations)actions[c.name]=mixer.clipAction(c);
function motion(name){
  for(const action of Object.values(actions))action.stop();
  if(name==='Rest'){model.traverse(o=>{if(o.isSkinnedMesh)o.skeleton.pose();});active=null;}
  else{active=actions[name];active.reset().play();mixer.update(0);}
  document.querySelectorAll('[data-motion]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.motion===name));
}
document.querySelectorAll('[data-motion]').forEach(b=>b.onclick=()=>motion(b.dataset.motion));
$('bones').onchange=()=>helper.visible=$('bones').checked;
$('mesh').onchange=()=>model.traverse(o=>{if(o.isMesh)o.material.wireframe=$('mesh').checked;});
function view(){
  const positions={side:[.86,.20,0],front:[0,.20,.86],oblique:[.61,.31,.63]};
  controls.target.set(0,.17,.008);
  camera.position.set(...positions[$('angle').value]).sub(controls.target).multiplyScalar(Math.max(1,1.38/camera.aspect)).add(controls.target);controls.update();
}
$('angle').onchange=view;
function icons(){$('pause').innerHTML=`<i data-lucide="${paused?'play':'pause'}"></i>`;createIcons({icons:{Play,Pause}});$('pause').title=paused?'再生':'一時停止';$('pause').setAttribute('aria-label',$('pause').title);}
$('pause').onclick=()=>{paused=!paused;icons();};icons();motion('Walk');view();
function resize(){renderer.setSize(innerWidth,innerHeight,false);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();view();}
addEventListener('resize',resize);resize();
window.lucyCombined={model,mixer,helper,scene,camera,renderer,actions,motion,pause(value){paused=value;icons();},setTime(t){mixer.setTime(t);model.updateMatrixWorld(true);}};
let last=performance.now();
function frame(now){const dt=Math.min((now-last)/1000,.05);last=now;if(!paused)mixer.update(dt);controls.update();renderer.render(scene,camera);requestAnimationFrame(frame);}
requestAnimationFrame(frame);
