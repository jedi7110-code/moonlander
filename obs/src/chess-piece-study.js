import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
import {createChessPieceGeometry} from './obs/chess-geometry.js';
import {createChessHologram,createChessFootGlowMaterial,CHESS_HOLOGRAM_SETTINGS} from './obs/chess-hologram.js';

const canvas=document.getElementById('pieces'),stage=document.getElementById('stage'),status=document.getElementById('status');
const query=new URLSearchParams(location.search);
let focus=['k','n','p'].includes(query.get('piece'))?query.get('piece'):'all';
let preset=['front','back','side'].includes(query.get('view'))?query.get('view'):'oblique';
let materialMode=query.get('material')==='solid'?'solid':'hologram';
const {translucency,glow}=CHESS_HOLOGRAM_SETTINGS;

try{
  const renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'low-power'});
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.75));renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  const scene=new THREE.Scene();scene.background=new THREE.Color(0x080f12);
  scene.fog=new THREE.FogExp2(0x080f12,.045);
  const camera=new THREE.PerspectiveCamera(34,1,.02,80);
  const controls=new OrbitControls(camera,canvas);controls.enableDamping=false;
  controls.minDistance=.8;controls.maxDistance=24;controls.maxPolarAngle=Math.PI*.51;
  controls.rotateSpeed=.7;controls.zoomSpeed=.8;controls.screenSpacePanning=true;
  const composer=new EffectComposer(renderer),bloom=new UnrealBloomPass(new THREE.Vector2(512,512),.42,.45,.9),output=new OutputPass();
  composer.addPass(new RenderPass(scene,camera));composer.addPass(bloom);composer.addPass(output);
  const resources=new Set(),keep=value=>(resources.add(value),value);
  const physical=options=>keep(new THREE.MeshPhysicalMaterial(options));
  const solid=physical({color:0xc9c2af,roughness:1,metalness:0,specularIntensity:0});
  const metal=physical({color:0x152329,roughness:.45,metalness:.65});
  const footGlowMaterial=keep(createChessFootGlowMaterial(undefined,glow));
  const depth=keep(new THREE.MeshBasicMaterial({colorWrite:false}));
  const {material:projection}=createChessHologram({translucency,glow});keep(projection);
  function mesh(geometry,material,parent=scene,position=[0,0,0]){
    const object=new THREE.Mesh(keep(geometry),material);object.position.set(...position);parent.add(object);return object;
  }
  const floor=mesh(new THREE.PlaneGeometry(100,100),physical({color:0x101b20,roughness:.9,metalness:.1}),scene,[0,-.025,0]);
  floor.rotation.x=-Math.PI/2;floor.receiveShadow=true;
  const grid=new THREE.GridHelper(60,120,0x416675,0x284149);grid.position.y=-.022;
  grid.material.transparent=true;grid.material.opacity=.10;keep(grid.geometry);keep(grid.material);scene.add(grid);
  scene.add(new THREE.HemisphereLight(0xc2e2ee,0x20323b,1.1));
  const key=new THREE.DirectionalLight(0xe4f2ff,2.6);key.position.set(-3,5,4);key.castShadow=true;
  key.shadow.mapSize.set(2048,2048);Object.assign(key.shadow.camera,{left:-4,right:4,top:3,bottom:-3,near:.1,far:16});key.shadow.normalBias=.012;key.shadow.bias=-.0001;scene.add(key);
  const fill=new THREE.DirectionalLight(0x64b9d1,1.1);fill.position.set(4,2,-3);scene.add(fill);
  const pieces=new Map();
  for(const [index,type] of ['k','n','p'].entries()){
    const root=new THREE.Group();root.position.x=(index-1)*1.6;root.name={k:'キング',n:'ナイト',p:'ポーン'}[type];scene.add(root);
    const geometry=keep(createChessPieceGeometry(type));
    // Only the nearest surface contributes: overlapping sculpted parts stay clean
    // while the lit floor remains visible through the projected silhouette.
    const prepass=mesh(geometry,depth,root);prepass.renderOrder=1;
    const body=mesh(geometry,projection,root);body.renderOrder=2;body.castShadow=false;
    if(type==='n')body.rotation.y=prepass.rotation.y=-Math.PI/2;
    const plinth=mesh(new THREE.CylinderGeometry(.39,.41,.06,64),metal,root,[0,.005,0]);plinth.receiveShadow=true;
    const pool=mesh(new THREE.PlaneGeometry(1.2,1.2),footGlowMaterial,root,[0,.038,0]);pool.rotation.x=-Math.PI/2;pool.renderOrder=0;pool.raycast=()=>{};
    root.updateMatrixWorld(true);
    const bounds=new THREE.Box3().setFromObject(body);
    pieces.set(type,{root,body,prepass,pool,bounds,label:document.querySelector(`[data-label="${type}"]`)});
  }
  const directions={front:[0,.65,7],back:[0,.65,-7],side:[7,1.1,0],oblique:[1.5,2.3,8]};
  let pending=0,disposed=false,width=1,height=1;
  const labelPoint=new THREE.Vector3();
  function render(){
    pending=0;if(disposed)return;composer.render();
    for(const [type,piece] of pieces){
      labelPoint.set(piece.root.position.x,-.17,0).project(camera);
      piece.label.hidden=(focus!=='all'&&focus!==type)||Math.abs(labelPoint.x)>1||Math.abs(labelPoint.y)>1||labelPoint.z>1;
      piece.label.style.transform=`translate(${(labelPoint.x+1)*width/2}px,${(1-labelPoint.y)*height/2}px) translate(-50%,0)`;
    }
  }
  function requestRender(){if(!disposed&&!pending&&!document.hidden)pending=requestAnimationFrame(render);}
  function pressed(attribute,value){document.querySelectorAll(`[data-${attribute}]`).forEach(button=>button.setAttribute('aria-pressed',String(button.dataset[attribute]===value)));}
  function save(){
    const params=new URLSearchParams();params.set('piece',focus);if(preset)params.set('view',preset);
    params.set('material',materialMode);history.replaceState(null,'','?'+params);
  }
  function setView(name=preset||'oblique'){
    preset=name;const bounds=new THREE.Box3();
    for(const [type,piece] of pieces)if(focus==='all'||focus===type)bounds.union(piece.bounds);
    bounds.min.y=-.19;bounds.expandByScalar(.13);
    const target=bounds.getCenter(new THREE.Vector3()),size=bounds.getSize(new THREE.Vector3());
    const direction=new THREE.Vector3(...directions[name]).normalize(),right=new THREE.Vector3().crossVectors(camera.up,direction).normalize(),up=new THREE.Vector3().crossVectors(direction,right);
    const slope=Math.tan(THREE.MathUtils.degToRad(camera.fov/2));let distance=0;
    for(const x of [-1,1])for(const y of [-1,1])for(const z of [-1,1]){
      const p=new THREE.Vector3(x*size.x/2,y*size.y/2,z*size.z/2);
      distance=Math.max(distance,p.dot(direction)+1.17*Math.max(Math.abs(p.dot(up))/slope,Math.abs(p.dot(right))/(slope*camera.aspect)));
    }
    controls.target.copy(target);camera.position.copy(target).addScaledVector(direction,Math.max(1,distance));controls.update();pressed('piece',focus);pressed('view',preset);save();requestRender();
  }
  function setMaterial(){
    const projected=materialMode==='hologram';
    for(const piece of pieces.values()){
      piece.body.material=projected?projection:solid;piece.body.castShadow=!projected;piece.prepass.visible=projected;
      piece.pool.visible=projected;
    }
    bloom.enabled=projected;pressed('material',materialMode);save();requestRender();
  }
  controls.addEventListener('change',requestRender);
  controls.addEventListener('start',()=>{preset=null;pressed('view',null);save();});
  document.querySelectorAll('[data-piece]').forEach(button=>button.addEventListener('click',()=>{focus=button.dataset.piece;setView();}));
  document.querySelectorAll('[data-view]').forEach(button=>button.addEventListener('click',()=>setView(button.dataset.view)));
  document.querySelectorAll('[data-material]').forEach(button=>button.addEventListener('click',()=>{materialMode=button.dataset.material;setMaterial();}));
  canvas.addEventListener('dblclick',()=>{focus='all';setView('oblique');});
  const observer=new ResizeObserver(()=>{
    const rect=stage.getBoundingClientRect();width=Math.max(1,rect.width);height=Math.max(1,rect.height);
    renderer.setSize(width,height,false);composer.setSize(width,height);camera.aspect=width/height;camera.updateProjectionMatrix();
    if(preset)setView(preset);else requestRender();
  });
  observer.observe(stage);document.addEventListener('visibilitychange',requestRender);setMaterial();status.hidden=true;
  window.addEventListener('pagehide',()=>{
    disposed=true;cancelAnimationFrame(pending);observer.disconnect();controls.dispose();document.removeEventListener('visibilitychange',requestRender);
    resources.forEach(resource=>resource.dispose());key.shadow.map?.dispose();bloom.dispose();output.dispose();composer.dispose();renderer.dispose();
  },{once:true});
}catch(error){status.textContent='表示できませんでした: '+error.message;console.error(error);}
