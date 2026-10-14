import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {createExteriorShip} from './obs/ship-exterior.js';
import {createExteriorDissolve} from './obs/exterior-dissolve.js';
import {createExteriorGasPass} from './obs/exterior-gas-pass.js';
const $=id=>document.getElementById(id),probe=new URLSearchParams(location.search).get('craft')==='probe';
let cleanup=()=>{};window.addEventListener('pagehide',()=>cleanup(),{once:true});
try{
  const renderer=new THREE.WebGLRenderer({canvas:$('view'),antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,1.6));
  renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.18;
  const scene=new THREE.Scene();scene.background=new THREE.Color($('background').value);
  scene.add(new THREE.HemisphereLight(0xe3edf5,0x6e7480,1.25));
  const key=new THREE.DirectionalLight(0xfff6e8,2.8);key.position.set(35,50,40);scene.add(key);
  const fill=new THREE.DirectionalLight(0xbacfe2,1);fill.position.set(-35,15,-30);scene.add(fill);
  const ship=createExteriorShip();ship.setCoreScale(2.6);ship.setAngle(55*Math.PI/180);
  const model=probe?ship.dockedLander:ship.root;
  if(probe){model.removeFromParent();scene.add(model);}else{ship.probeDock.visible=false;scene.add(model);}
  const camera=new THREE.PerspectiveCamera(38,1,.05,2000),controls=new OrbitControls(camera,$('view'));
  controls.enableDamping=true;controls.dampingFactor=.12;controls.screenSpacePanning=true;
  controls.minDistance=probe ? .35 : 5;controls.maxDistance=probe?80:700;
  const presentation=createExteriorDissolve(renderer),gasPass=createExteriorGasPass(renderer,ship.probeThrusters.gas);
  const center=probe?new THREE.Vector3(0,2.7,0):new THREE.Vector3(-1.6,0,0),radius=probe?5:60;
  let current='whole',frame=0,disposed=false;
  const directions={whole:[1,.35,1.2],front:probe?[0,0,1]:[1,0,0],side:probe?[1,0,0]:[0,0,1],rear:probe?[0,0,-1]:[-1,0,0],under:[.3,-1,.35]};
  function view(name){
    current=name;controls.target.copy(center);
    if(name==='antenna'){
      controls.target.copy(probe?new THREE.Vector3(.8,6.3,-.4):new THREE.Vector3(22,11.5,-.45));
      camera.position.copy(probe?new THREE.Vector3(2.4,8,1.8):new THREE.Vector3(31,19,15));
    }
    else if(name==='bridge'&&!probe){
      controls.target.set(31,3,0);camera.position.set(53,24,32);
    }
    else if(name==='markings'){
      controls.target.copy(probe?new THREE.Vector3(0,3.2,1.8):new THREE.Vector3(-34,-3.5,20));
      camera.position.copy(probe?new THREE.Vector3(4.7,3.8,8):new THREE.Vector3(-42,9,45));
    }
    else if(name==='nozzle'&&probe){controls.target.set(1.55,2.9,1);camera.position.set(4.5,4.1,4.6);}
    else if(name==='foot'&&probe){controls.target.set(2.75,.85,2.47);camera.position.set(4.5,1.55,4.7);}
    else{
      const distance=radius/Math.sin(THREE.MathUtils.degToRad(camera.fov/2))*Math.max(1,1/camera.aspect);
      camera.position.copy(center).add(new THREE.Vector3(...(directions[name]??directions.whole)).normalize().multiplyScalar(distance));
    }
    controls.update();for(const button of document.querySelectorAll('[data-view]'))button.setAttribute('aria-pressed',String(button.dataset.view===name));
  }
  $('name').textContent=probe?'小型船 BARRAMUNDI / 単独スタディー':'母艦 TARAIRON / 単独スタディー';document.title=$('name').textContent;
  for(const link of document.querySelectorAll('[data-craft]'))if(link.dataset.craft===(probe?'probe':'mothership'))link.setAttribute('aria-current','page');
  $('gas-control').hidden=!probe;$('nozzle-view').hidden=!probe;$('foot-view').hidden=!probe;$('bridge-view').hidden=probe;
  $('note').textContent=probe?'姿勢制御ノズルと取付台を拡大して確認できます。ガスは減速中の噴射を表示します。':'オープニングと同じ母艦モデル。小型船を外した状態で確認できます。';
  for(const button of document.querySelectorAll('[data-view]'))button.onclick=()=>view(button.dataset.view);
  $('background').onchange=()=>scene.background.set($('background').value);
  $('wire').onchange=()=>model.traverse(mesh=>{for(const material of [].concat(mesh.material??[]))if(!material.isShaderMaterial)material.wireframe=$('wire').checked;});
  $('reset').onclick=()=>view('whole');
  const resize=()=>{const rect=$('view').getBoundingClientRect();renderer.setSize(Math.max(1,rect.width),Math.max(1,rect.height),false);camera.aspect=rect.width/Math.max(1,rect.height);camera.updateProjectionMatrix();view(current);};
  const observer=new ResizeObserver(resize);observer.observe($('view'));resize();
  cleanup=()=>{if(disposed)return;disposed=true;cancelAnimationFrame(frame);observer.disconnect();controls.dispose();presentation.dispose();if(probe){ship.probeDock.add(model);}ship.dispose();renderer.dispose();renderer.forceContextLoss();};
  await renderer.compileAsync(scene,camera);$('status').hidden=true;
  // The compositor supplies the opaque/depth and gas targets to the draw callback.
  function render(now){
    if(disposed)return;frame=requestAnimationFrame(render);controls.update();
    ship.probeThrusters.update({visible:probe&&$('gas').checked,thrusterClock:{seconds:6+(now/1000% .28),approachDuration:8,captureDuration:12,coreScale:2.6}});
    presentation.render({from:camera,to:null,mix:0},(_view,target,gasTarget)=>gasPass.render(scene,camera,target,gasTarget));
  }
  frame=requestAnimationFrame(render);
}catch(error){$('status').textContent=`表示できません: ${error.message}`;console.error(error);}
