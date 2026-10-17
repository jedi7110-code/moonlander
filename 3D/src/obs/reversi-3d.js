import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
import {createChessHologram,createChessFootGlowMaterial} from './chess-hologram.js';

export function createReversi3DView({stage,board}){
  const canvas=document.createElement('canvas');canvas.className='reversi-3d-canvas';canvas.setAttribute('aria-hidden','true');
  const renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'low-power'});
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.6));renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  const scene=new THREE.Scene();scene.background=new THREE.Color(0x0c1911);
  const half=4.65,camera=new THREE.OrthographicCamera(-half,half,half,-half,.1,40);
  camera.position.set(0,16,0);camera.up.set(0,0,-1);camera.lookAt(0,0,0);
  const composer=new EffectComposer(renderer),bloom=new UnrealBloomPass(new THREE.Vector2(512,512),.48,.4,.85),output=new OutputPass();
  composer.addPass(new RenderPass(scene,camera));composer.addPass(bloom);composer.addPass(output);
  const resources=new Set(),keep=value=>(resources.add(value),value);
  const mesh=(geometry,material,parent=scene,position=[0,0,0])=>{
    const object=new THREE.Mesh(geometry,material);object.position.set(...position);parent.add(object);return object;
  };
  const metal=keep(new THREE.MeshStandardMaterial({color:0x1c2b22,metalness:.74,roughness:.36}));
  mesh(keep(new RoundedBoxGeometry(8.55,.26,8.55,3,.08)),metal,scene,[0,-.19,0]);
  const tile=keep(new THREE.BoxGeometry(.986,.06,.986)),surface=keep(new THREE.MeshLambertMaterial({color:0x142a1b}));
  for(let i=0;i<64;i++)mesh(tile,surface,scene,[i%8-3.5,-.03,(i>>3)-3.5]).receiveShadow=true;
  const gridWidth=.022,gridLines=new THREE.Group();scene.add(gridLines);
  const gridLine=keep(new THREE.BoxGeometry(8,.002,gridWidth));
  const gridMaterial=keep(new THREE.MeshBasicMaterial({color:0x46644b,transparent:true,opacity:.65,depthWrite:false}));
  for(let i=1;i<8;i++){
    mesh(gridLine,gridMaterial,gridLines,[0,.002,i-4]);
    mesh(gridLine,gridMaterial,gridLines,[i-4,.002,0]).rotation.y=Math.PI/2;
  }
  const edge=keep(new THREE.MeshBasicMaterial({color:new THREE.Color(0x80b875).multiplyScalar(.6)}));
  for(const side of [-1,1]){
    mesh(keep(new THREE.BoxGeometry(8.4,.016,.018)),edge,scene,[0,-.018,side*4.18]);
    mesh(keep(new THREE.BoxGeometry(.018,.016,8.4)),edge,scene,[side*4.18,-.018,0]);
  }
  const screw=keep(new THREE.CylinderGeometry(.045,.045,.014,20));
  const screwMaterial=keep(new THREE.MeshStandardMaterial({color:0x778473,metalness:.9,roughness:.38}));
  for(const x of [-4.25,4.25])for(const z of [-4.25,0,4.25])mesh(screw,screwMaterial,scene,[x,-.045,z]);
  const dot=keep(new THREE.CircleGeometry(.045,24)),dotMaterial=keep(new THREE.MeshBasicMaterial({color:0x263b29}));
  for(const x of [-2,2])for(const z of [-2,2])mesh(dot,dotMaterial,scene,[x,.006,z]).rotation.x=-Math.PI/2;
  scene.add(new THREE.HemisphereLight(0xd7e4cf,0x132b1c,1.1));
  const sun=new THREE.DirectionalLight(0xe1ecda,2.9);sun.position.set(-3,10,6);sun.castShadow=true;
  sun.shadow.mapSize.set(1024,1024);Object.assign(sun.shadow.camera,{left:-6,right:6,top:6,bottom:-6,near:1,far:30});
  sun.shadow.bias=-.0001;sun.shadow.normalBias=.014;scene.add(sun);
  const fill=new THREE.DirectionalLight(0x8aba75,1.4);fill.position.set(5,5,-6);scene.add(fill);
  const profile=[[0,.025],[.29,.025],[.33,.035],[.35,.06],[.35,.13],[.335,.16],[.30,.175],[0,.175]];
  const disc=keep(new THREE.LatheGeometry(profile.map(([r,y])=>new THREE.Vector2(r,y)),64));
  const player=keep(createChessHologram({color:0x608b5b,emissive:0x385030,tint:new THREE.Color(.28,.43,.23)}).material);
  const milo=keep(createChessHologram({color:0x23472b,emissive:0x123019,tint:new THREE.Color(.07,.22,.085)}).material);
  const depth=keep(new THREE.MeshBasicMaterial({colorWrite:false}));
  const glowPlane=keep(new THREE.PlaneGeometry(1.2,1.2));
  const playerGlow=keep(createChessFootGlowMaterial(0x8eae7c)),miloGlow=keep(createChessFootGlowMaterial(0x3f7241));
  const legalDot=keep(new THREE.CircleGeometry(.065,32));
  const legalMaterial=keep(new THREE.MeshBasicMaterial({color:0x64865b,transparent:true,opacity:.30,depthWrite:false}));
  const pieces=new THREE.Group(),markers=new THREE.Group();scene.add(pieces,markers);
  let currentStage=null,currentBoard=null,frame=0,disposed=false;
  function invalidate(){
    if(disposed||frame||document.hidden)return;
    frame=requestAnimationFrame(()=>{frame=0;if(!disposed&&!document.hidden)composer.render();});
  }
  function resize(){
    const rect=currentStage.getBoundingClientRect();if(!rect.width||!rect.height)return;
    renderer.setSize(rect.width,rect.height,false);composer.setSize(rect.width,rect.height);
    const aspect=rect.width/rect.height;camera.left=-half*aspect;camera.right=half*aspect;camera.updateProjectionMatrix();
    // Keep the boundaries readable when the board shrinks below desktop size.
    const lineScale=Math.max(1,half*2*1.15/(rect.height*gridWidth));
    for(const line of gridLines.children)line.scale.z=lineScale;
    // The DOM grid is the input surface, aligned with the same 8x8 world plane.
    const size=rect.height*8/(half*2);
    Object.assign(currentBoard.style,{width:size+'px',height:size+'px',left:(rect.width-size)/2+'px',top:(rect.height-size)/2+'px'});
    invalidate();
  }
  const observer=new ResizeObserver(resize);
  function attach(nextStage,nextBoard){
    observer.disconnect();currentStage=nextStage;currentBoard=nextBoard;
    currentStage.prepend(canvas);currentStage.classList.add('is-3d');observer.observe(currentStage);resize();
  }
  function update({board:cells,legal=[]}){
    pieces.clear();markers.clear();
    for(let i=0;i<64;i++){
      if(!cells[i])continue;
      const root=new THREE.Group();root.position.set(i%8-3.5,0,(i>>3)-3.5);pieces.add(root);
      mesh(disc,depth,root).renderOrder=1;
      const body=mesh(disc,cells[i]===1?player:milo,root);body.renderOrder=2;body.castShadow=true;body.receiveShadow=true;
      const glow=mesh(glowPlane,cells[i]===1?playerGlow:miloGlow,root,[0,.012,0]);glow.rotation.x=-Math.PI/2;
    }
    for(const i of legal)mesh(legalDot,legalMaterial,markers,[i%8-3.5,.018,(i>>3)-3.5]).rotation.x=-Math.PI/2;
    invalidate();
  }
  document.addEventListener('visibilitychange',invalidate);attach(stage,board);
  return{attach,update,dispose(){
    disposed=true;cancelAnimationFrame(frame);observer.disconnect();document.removeEventListener('visibilitychange',invalidate);
    currentStage.classList.remove('is-3d');currentBoard.removeAttribute('style');canvas.remove();
    resources.forEach(resource=>resource.dispose());sun.shadow.map?.dispose();bloom.dispose();output.dispose();composer.dispose();renderer.dispose();renderer.forceContextLoss();
  }};
}
