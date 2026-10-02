import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {createEVAHatch,animateAirlock,PRESSURE_HATCH,EVA_HATCH_FIT} from './obs/eva.js';
import {createCabinToon} from './obs/cabin-toon.js';
import {materials} from './obs/materials.js';
import {industrialMaterials} from './obs/industrial.js';

const $=id=>document.getElementById(id),params=new URLSearchParams(location.search);
const number=Number(params.get('opening'));
let opening=Number.isFinite(number)?THREE.MathUtils.clamp(number,0,1):0;
let view=['front','back','angle','pockets'].includes(params.get('view'))?params.get('view'):'front';
const inner=params.get('hatch')!=='outer';
document.querySelectorAll('[data-hatch]').forEach(button=>{
  button.setAttribute('aria-pressed',button.dataset.hatch===(inner?'inner':'outer'));
  button.onclick=()=>{const url=new URL(location.href);url.searchParams.set('hatch',button.dataset.hatch);location.assign(url);};
});
async function init(){
const cabinMaterials=await materials(),worn=industrialMaterials(cabinMaterials);
const canvas=$('hatch-view'),renderer=new THREE.WebGLRenderer({canvas,antialias:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.1;
const scene=new THREE.Scene();scene.background=new THREE.Color(0x253136);
const pmrem=new THREE.PMREMGenerator(renderer),room=new RoomEnvironment(),environment=pmrem.fromScene(room,.04);scene.environment=environment.texture;room.dispose();pmrem.dispose();
scene.add(new THREE.HemisphereLight(0xe6f2ed,0x536168,2));
for(const [x,y,z,color]of [[-3,4,4,0xffedda],[2,3,-3,0xc6e0ee]]){const light=new THREE.DirectionalLight(color,2);light.position.set(x,y,z);scene.add(light);}
const hatch=createEVAHatch(worn,0,inner);hatch.position.set(0,EVA_HATCH_FIT.centerY,0);hatch.rotation.set(0,0,0);scene.add(hatch);
$('dimensions').textContent=`${inner?'内扉':'船外出口'} · 全体スケール ${(hatch.scale.x*100).toFixed(0)}% · 全体 ${EVA_HATCH_FIT.width.toFixed(2)} × ${EVA_HATCH_FIT.height.toFixed(2)} m · 開口 ${(PRESSURE_HATCH.width*hatch.scale.x).toFixed(2)} × ${(PRESSURE_HATCH.height*hatch.scale.y).toFixed(2)} m`;
const floor=new THREE.Mesh(new THREE.BoxGeometry(4.0,.035,1.6),new THREE.MeshStandardMaterial({color:0x334146,roughness:.85}));floor.position.set(0,-.02,0);scene.add(floor);
const toon=createCabinToon([hatch]);toon.setStyle('cartoon');
const camera=new THREE.PerspectiveCamera(37,1,.01,40),controls=new OrbitControls(camera,canvas);controls.minDistance=.35;controls.maxDistance=9;controls.enableDamping=false;
let width=1,height=1,pending=0,playing=false,last=performance.now(),direction=1,human=null,humanLoading=null,disposed=false;
function save(){const url=new URL(location.href);url.searchParams.set('view',view);url.searchParams.set('opening',opening.toFixed(3));history.replaceState(null,'',url);}
function render(){pending=0;toon.update(width,height,2*camera.position.distanceTo(controls.target)*Math.tan(THREE.MathUtils.degToRad(camera.fov/2)),15);renderer.render(scene,camera);}
function requestRender(){if(!pending)pending=requestAnimationFrame(render);}
function updateOpening(){
  animateAirlock(hatch.userData.door,hatch.userData.signal,opening);$('opening').value=opening;$('opening-value').textContent=`${Math.round(opening*100)}%`;
  document.querySelectorAll('[data-open]').forEach(button=>button.setAttribute('aria-pressed',Math.abs(Number(button.dataset.open)-opening)<.001));requestRender();
}
function setPlaying(value){playing=value;$('play').textContent=value?'一時停止':'開閉を再生';$('play').setAttribute('aria-pressed',value);last=performance.now();if(!value)save();}
function showView(){
  controls.target.set(0,EVA_HATCH_FIT.height/2,0);const distance=Math.max(5.9,5.9/camera.aspect);
  const offset={front:[0,.07,distance],back:[0,.07,-distance],angle:[distance*.58,.65,distance*.85],pockets:[distance*.32,.5,distance*.86]}[view];
  camera.position.copy(controls.target).add(new THREE.Vector3(...offset));controls.update();
  hatch.getObjectByName('Pocket cassette cover / front').visible=view!=='pockets';
  hatch.getObjectByName('Fixed pocket finish').visible=view!=='pockets';
  document.querySelectorAll('[data-view]').forEach(button=>button.setAttribute('aria-pressed',button.dataset.view===view));requestRender();
}
for(const button of document.querySelectorAll('[data-view]'))button.onclick=()=>{view=button.dataset.view;showView();save();};
for(const button of document.querySelectorAll('[data-open]'))button.onclick=()=>{setPlaying(false);opening=Number(button.dataset.open);updateOpening();save();};
$('opening').oninput=()=>{setPlaying(false);opening=Number($('opening').value);updateOpening();save();};
$('play').onclick=()=>setPlaying(!playing);
$('human').onchange=async()=>{
  if(!human&&$('human').checked){
    $('status').hidden=false;$('status').textContent='マイロを読み込み中';
    humanLoading??=Promise.all([import('./obs/head.js'),import('./obs/milo-body.js'),import('./obs/characters.js')]).then(async([h,b,c])=>{
      const [head]=await Promise.all([h.loadMiloHead(),b.loadMiloBody()]);
      head.userData.setAppearance({hair:'crop',beard:'none'});
      const root=c.createMilo(cabinMaterials,head);root.position.set(0,0,-.45);c.animateMilo(root,{moving:false,climbing:false,facing:1,time:0,dt:0,action:null});return root;
    });
    try{human=await humanLoading;if(disposed)return;scene.add(human);$('status').hidden=true;}
    catch(error){$('status').textContent=`人物を読み込めません: ${error.message}`;console.error(error);$('human').checked=false;return;}
  }
  if(human){human.visible=$('human').checked;if(human.visible){setPlaying(false);opening=1;updateOpening();save();}requestRender();}
};
controls.addEventListener('change',requestRender);
const observer=new ResizeObserver(()=>{const rect=canvas.getBoundingClientRect();width=Math.max(1,rect.width);height=Math.max(1,rect.height);renderer.setSize(width,height,false);camera.aspect=width/height;camera.updateProjectionMatrix();showView();});observer.observe(canvas);
updateOpening();showView();$('status').hidden=true;
let animation;
function tick(now){animation=requestAnimationFrame(tick);const dt=Math.min((now-last)/1000,.1);last=now;if(!playing||document.hidden)return;opening+=direction*dt/2;if(opening>=1){opening=1;direction=-1;}if(opening<=0){opening=0;direction=1;}updateOpening();}
animation=requestAnimationFrame(tick);
window.addEventListener('pagehide',event=>{if(event.persisted)return;disposed=true;cancelAnimationFrame(animation);cancelAnimationFrame(pending);observer.disconnect();controls.dispose();toon.dispose();environment.dispose();const geometries=new Set(),materials=new Set(),textures=new Set();scene.traverse(object=>{if(object.geometry)geometries.add(object.geometry);for(const m of [].concat(object.material??[])){materials.add(m);Object.values(m).forEach(value=>{if(value?.isTexture)textures.add(value);});}});geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());renderer.dispose();},{once:true});
}
init().catch(error=>{$('status').hidden=false;$('status').textContent=`表示できません: ${error.message}`;console.error(error);});
