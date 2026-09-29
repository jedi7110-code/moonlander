import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {materials,batchStatic} from './obs/materials.js';
import {industrialMaterials} from './obs/industrial.js';
import {createSofaStudyModel} from './sofa-study-model.js';
import {createCabinToon} from './obs/cabin-toon.js';

const canvas=document.getElementById('sofa-view'),status=document.getElementById('status');
try{
  const m=industrialMaterials(await materials()),sofa=createSofaStudyModel(m);
  const bounds=new THREE.Box3().setFromObject(sofa),center=bounds.getCenter(new THREE.Vector3()),size=bounds.getSize(new THREE.Vector3());
  sofa.position.sub(center);
  const scene=new THREE.Scene();scene.background=new THREE.Color(0x171d1e);
  const model=batchStatic(sofa);scene.add(model);
  const renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'low-power'});
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.12;
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  const room=new RoomEnvironment(),pmrem=new THREE.PMREMGenerator(renderer),environment=pmrem.fromScene(room,.06);
  scene.environment=environment.texture;room.dispose();pmrem.dispose();
  scene.add(new THREE.HemisphereLight(0xe0e5dc,0x61645f,1.4));
  const key=new THREE.DirectionalLight(0xffefdc,2.3);key.position.set(-3,5,4);key.castShadow=true;
  key.shadow.mapSize.set(1024,1024);Object.assign(key.shadow.camera,{left:-3,right:3,top:2,bottom:-2,near:.1,far:15});key.shadow.normalBias=.018;scene.add(key);
  const fill=new THREE.DirectionalLight(0xdce8e9,1.7);fill.position.set(3,2,-4);scene.add(fill);
  const underside=new THREE.DirectionalLight(0xd2d9cf,.8);underside.position.set(0,-4,2);scene.add(underside);
  const grid=new THREE.GridHelper(10,20,0x53665b,0x364741);grid.position.y=-size.y/2-.004;
  grid.material.transparent=true;grid.material.opacity=.38;scene.add(grid);
  const toon=createCabinToon([model]);toon.setStyle('cartoon');
  const camera=new THREE.PerspectiveCamera(36,1,.02,80),controls=new OrbitControls(camera,canvas);
  controls.enableDamping=false;controls.screenSpacePanning=true;controls.minDistance=.6;controls.maxDistance=28;
  controls.minPolarAngle=0;controls.maxPolarAngle=Math.PI;controls.rotateSpeed=.75;controls.zoomSpeed=.8;
  const directions={front:[0,0,1],back:[0,0,-1],left:[-1,0,0],right:[1,0,0],top:[0,1,.0001],bottom:[0,-1,.0001],reset:[5.4,3.1,7]};
  const buttons=[...document.querySelectorAll('[data-view]')];let pending=0,width=1,height=1,preset='reset';
  function render(){
    pending=0;const visibleHeight=2*camera.position.distanceTo(controls.target)*Math.tan(THREE.MathUtils.degToRad(camera.fov/2));
    toon.update(width,height,visibleHeight,15);renderer.render(scene,camera);
  }
  function requestRender(){if(!pending&&!document.hidden)pending=requestAnimationFrame(render);}
  function selectPreset(name){buttons.forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.view===name)));}
  function setView(name){
    preset=name;
    const direction=new THREE.Vector3(...directions[name]).normalize(),right=new THREE.Vector3().crossVectors(camera.up,direction).normalize(),up=new THREE.Vector3().crossVectors(direction,right);
    const slope=Math.tan(THREE.MathUtils.degToRad(camera.fov/2));let distance=0;
    // Fit the projected corners: side views should fill the viewport too,
    // instead of inheriting the distance needed for the sofa's entire width.
    for(const x of [-1,1])for(const y of [-1,1])for(const z of [-1,1]){
      const corner=new THREE.Vector3(x*size.x/2,y*size.y/2,z*size.z/2);
      distance=Math.max(distance,corner.dot(direction)+1.16*Math.max(Math.abs(corner.dot(up))/slope,Math.abs(corner.dot(right))/(slope*camera.aspect)));
    }
    controls.target.set(0,0,0);camera.position.copy(direction).multiplyScalar(distance);controls.update();selectPreset(name);requestRender();
  }
  controls.addEventListener('change',requestRender);
  controls.addEventListener('start',()=>{preset=null;selectPreset(null);});
  buttons.forEach(button=>button.addEventListener('click',()=>setView(button.dataset.view)));
  document.getElementById('floor').addEventListener('change',event=>{grid.visible=event.target.checked;requestRender();});
  canvas.addEventListener('dblclick',()=>setView('reset'));
  const observer=new ResizeObserver(()=>{
    const rect=canvas.getBoundingClientRect();width=Math.max(1,rect.width);height=Math.max(1,rect.height);
    renderer.setSize(width,height,false);camera.aspect=width/height;camera.updateProjectionMatrix();
    if(preset)setView(preset);else requestRender();
  });
  observer.observe(canvas);document.addEventListener('visibilitychange',requestRender);status.hidden=true;
  window.addEventListener('pagehide',()=>{
    cancelAnimationFrame(pending);observer.disconnect();controls.dispose();toon.dispose();environment.dispose();
    const geometries=new Set(),usedMaterials=new Set();
    scene.traverse(object=>{if(object.geometry)geometries.add(object.geometry);if(object.material)for(const material of [].concat(object.material))usedMaterials.add(material);});
    geometries.forEach(geometry=>geometry.dispose());usedMaterials.forEach(material=>material.dispose());renderer.dispose();
  },{once:true});
}catch(error){status.textContent=`読み込みに失敗しました: ${error.message}`;console.error(error);}
