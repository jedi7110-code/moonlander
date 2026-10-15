import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {createExteriorShip,EXTERIOR} from './obs/ship-exterior.js';
import {HABITAT_ENVELOPE} from './obs/habitat-envelope.js';
import {createExteriorDissolve} from './obs/exterior-dissolve.js';
import {createExteriorGasPass} from './obs/exterior-gas-pass.js';
import {createExteriorShadow} from './obs/exterior-shadow.js';
import {fitExteriorInspectionDepth} from './obs/exterior-depth.js';
import {createExteriorPanelStudy} from './obs/exterior-panel-study.js';
import {createProbeLineStudy} from './obs/exterior-probe-line-study.js';
const $=id=>document.getElementById(id),query=new URLSearchParams(location.search),probe=query.get('craft')==='probe';
let cleanup=()=>{};window.addEventListener('pagehide',()=>cleanup(),{once:true});
try{
  const renderer=new THREE.WebGLRenderer({canvas:$('view'),antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,1.6));
  renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.18;
  const scene=new THREE.Scene();scene.background=new THREE.Color($('background').value);
  const ambient=new THREE.HemisphereLight(0xe3edf5,0x6e7480,1.25);scene.add(ambient);
  const key=new THREE.DirectionalLight(0xfff6e8,2.8);key.position.set(35,50,40);scene.add(key);
  const fill=new THREE.DirectionalLight(0xbacfe2,1);fill.position.set(-35,15,-30);scene.add(fill);
  const ship=createExteriorShip();ship.setCoreScale(2.6);ship.setAngle(55*Math.PI/180);
  const shadows=createExteriorShadow(key,ship);scene.add(key.target,fill.target);
  renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  function lighting(space){
    ambient.color.set(space?0xc4d5e1:0xe3edf5);ambient.groundColor.set(space?0x394b53:0x6e7480);ambient.intensity=space?.68:1.25;
    key.color.set(space?0xfff2d4:0xfff6e8);key.intensity=space?3.15:2.8;
    fill.color.set(space?0x8ca7bd:0xbacfe2);fill.intensity=space?.65:1;
    renderer.shadowMap.enabled=space;
    if(space){shadows.update({id:'study'});fill.position.set(-38,-15,-30);}
    else{key.position.set(35,50,40);key.target.position.set(0,0,0);fill.position.set(-35,15,-30);}
    fill.target.position.set(0,0,0);
  }
  $('lighting').value=query.get('lighting')==='space'?'space':'studio';
  if(query.get('lighting')==='space'){$('background').value='#000000';scene.background.set('#000000');}
  lighting($('lighting').value==='space');
  $('lighting').onchange=()=>lighting($('lighting').value==='space');
  const model=probe?ship.dockedLander:ship.root;
  if(probe){model.removeFromParent();scene.add(model);}else{ship.probeDock.visible=false;scene.add(model);}
  const panelStudy=probe?null:createExteriorPanelStudy(ship);
  const probeLines=probe?createProbeLineStudy(ship):null;
  $('probe-lines-control').hidden=!probe;$('probe-lines').checked=query.get('lines')!=='0';
  const applyProbeLines=()=>{
    probeLines?.setEnabled($('probe-lines').checked);
    if(probe){
      const params=new URLSearchParams(location.search);params.set('lines',$('probe-lines').checked?'1':'0');history.replaceState(null,'',`?${params}`);
      $('detail-note').textContent=$('probe-lines').checked?'Aのパネル配置 / 既存の線だけ濃く':'Aのパネル配置 / 元の線の濃さ';
    }
  };
  $('probe-lines').onchange=applyProbeLines;
  if(probe){document.querySelector('[data-detail="enhanced"]').hidden=true;document.querySelector('[data-detail="current"]').textContent='A / 既存パネル';}
  applyProbeLines();
  $('panel-wear').checked=query.get('wear')!=='0';
  const applyPanelWear=()=>{
    panelStudy?.setWeathering($('panel-wear').checked);
    const params=new URLSearchParams(location.search);params.set('wear',$('panel-wear').checked?'1':'0');history.replaceState(null,'',`?${params}`);
    for(const link of document.querySelectorAll('[data-craft]')){const url=new URL(link.href);url.searchParams.set('wear',params.get('wear'));link.href=url;}
  };
  $('panel-wear').onchange=applyPanelWear;applyPanelWear();
  function panelVersion(version){
    if(probe)version='current';
    panelStudy?.setEnabled(version==='enhanced');
    for(const button of document.querySelectorAll('[data-detail]'))button.setAttribute('aria-pressed',String(button.dataset.detail===version));
    $('panel-wear-control').hidden=version!=='enhanced';
    $('detail-note').textContent=version==='enhanced'?'B案：パネルの分割・段差 / 汚しをON・OFFで比較':'現状版';
    if(probe)applyProbeLines();
    const params=new URLSearchParams(location.search);params.set('detail',version);history.replaceState(null,'',`?${params}`);
    for(const link of document.querySelectorAll('[data-craft]')){const url=new URL(link.href);url.searchParams.set('detail',version);link.href=url;}
  }
  for(const button of document.querySelectorAll('[data-detail]'))button.onclick=()=>panelVersion(button.dataset.detail);
  panelVersion(query.get('detail')==='enhanced'?'enhanced':'current');
  const inspectionBounds=new THREE.Box3().setFromObject(model);
  const camera=new THREE.PerspectiveCamera(38,1,.05,2000),controls=new OrbitControls(camera,$('view'));
  controls.enableDamping=true;controls.dampingFactor=.12;controls.screenSpacePanning=true;
  controls.minDistance=probe ? .35 : 5;controls.maxDistance=probe?80:700;
  const presentation=createExteriorDissolve(renderer,{samples:4}),gasPass=createExteriorGasPass(renderer,ship.probeThrusters.gas);
  const center=probe?new THREE.Vector3(0,2.7,0):new THREE.Vector3(-1.6,0,0),radius=probe?5:60;
  let current=query.get('view')||'whole',frame=0,disposed=false;
  const directions={whole:[1,.35,1.2],front:probe?[0,0,1]:[1,0,0],side:probe?[1,0,0]:[0,0,1],rear:probe?[0,0,-1]:[-1,0,0],under:[.3,-1,.35]};
  function view(name){
    current=name;controls.target.copy(center);camera.up.set(0,1,0);
    if(name==='antenna'){
      controls.target.copy(probe?new THREE.Vector3(.8,6.3,-.4):new THREE.Vector3(22,11.5,-.45));
      camera.position.copy(probe?new THREE.Vector3(2.4,8,1.8):new THREE.Vector3(31,19,15));
    }
    else if(name==='bridge'&&!probe){
      controls.target.set(31,3,0);camera.position.set(53,24,32);
    }
    else if(name==='front-windows'&&!probe){controls.target.set(39,4.8,0);camera.position.set(53,9,6);}
    else if(name==='skylights'&&!probe){controls.target.set(41.8,6.7,0);camera.position.set(49,23,0);}
    else if((name==='service-top'||name==='service-under')&&!probe){
      const side=name==='service-top'?1:-1;
      controls.target.copy(ship.core.localToWorld(new THREE.Vector3(8,side*2.7,0)));
      camera.position.copy(controls.target).add(new THREE.Vector3(-5,side*18,9));
    }
    else if(name==='service-side'&&!probe){
      controls.target.copy(ship.core.localToWorld(new THREE.Vector3(7.3,0,2.8)));
      camera.position.copy(controls.target).add(new THREE.Vector3(-5,4,18));
    }
    else if((name==='service-cover'||name==='service-cover-left')&&!probe){
      const side=name==='service-cover-left'?-1:1;
      controls.target.copy(ship.core.localToWorld(new THREE.Vector3(7.55,2.09,side*2.13)));
      camera.position.copy(controls.target).add(new THREE.Vector3(-.8,3.8,side*4.5));
    }
    else if(name==='eva-hatch'&&!probe){
      const hatch=ship.evaHatches[1];hatch.updateWorldMatrix(true,false);
      controls.target.copy(hatch.localToWorld(new THREE.Vector3(0,0,.27)));
      camera.position.copy(hatch.localToWorld(new THREE.Vector3(2,.6,3.8)));
    }
    else if(name==='bow-face'&&!probe){
      controls.target.copy(ship.core.localToWorld(new THREE.Vector3(17.3,-.075,0)));
      camera.position.copy(controls.target).add(new THREE.Vector3(11,0,0));
    }
    else if(name==='habitat-face'&&!probe){
      const pod=ship.pods[0],z=(-HABITAT_ENVELOPE.front+HABITAT_ENVELOPE.rearRoomBack)/2;pod.updateWorldMatrix(true,false);
      controls.target.copy(pod.localToWorld(new THREE.Vector3(EXTERIOR.podLength/2+1.8,0,z)));
      camera.position.copy(pod.localToWorld(new THREE.Vector3(EXTERIOR.podLength/2+24,0,z)));
      camera.up.transformDirection(pod.matrixWorld);
    }
    else if(name==='habitat-hatch'&&!probe){
      const pod=ship.pods[0],z=(-HABITAT_ENVELOPE.front+HABITAT_ENVELOPE.rearRoomBack)/2;pod.updateWorldMatrix(true,false);
      controls.target.copy(pod.localToWorld(new THREE.Vector3(EXTERIOR.podLength/2+2,-.5,z)));
      camera.position.copy(pod.localToWorld(new THREE.Vector3(EXTERIOR.podLength/2+9,1,z)));
      camera.up.transformDirection(pod.matrixWorld);
    }
    else if(name==='markings'){
      controls.target.copy(probe?new THREE.Vector3(0,3.2,1.8):new THREE.Vector3(-34,-3.5,20));
      camera.position.copy(probe?new THREE.Vector3(4.7,3.8,8):new THREE.Vector3(-42,9,45));
    }
    else if(name==='nozzle'&&!probe){controls.target.set(-48,0,0);camera.position.set(-100,7,13);}
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
  $('nozzle-bounce-control').hidden=probe;
  $('habitat-hatch-view').hidden=probe;
  $('habitat-face-view').hidden=probe;$('bow-face-view').hidden=probe;
  for(const id of ['service-top-view','service-under-view','service-side-view','service-cover-view','service-cover-left-view','eva-hatch-view'])$(id).hidden=probe;
  $('nozzle-bounce').onchange=()=>ship.setNozzleBounce($('nozzle-bounce').checked);
  $('gas-control').hidden=!probe;$('nozzle-view').hidden=false;$('nozzle-view').textContent=probe?'姿勢制御ノズル':'主エンジン内側';$('foot-view').hidden=!probe;$('bridge-view').hidden=probe;$('front-windows-view').hidden=probe;$('skylights-view').hidden=probe;
  $('note').textContent=probe?'姿勢制御ノズルと取付台を拡大して確認できます。ガスは減速中の噴射を表示します。':'オープニングと同じ母艦モデル。小型船を外した状態で確認できます。';
  for(const button of document.querySelectorAll('[data-view]'))button.onclick=()=>view(button.dataset.view);
  $('background').onchange=()=>scene.background.set($('background').value);
  $('wire').onchange=()=>model.traverse(mesh=>{for(const material of [].concat(mesh.material??[]))if(!material.isShaderMaterial)material.wireframe=$('wire').checked;});
  $('reset').onclick=()=>view('whole');
  const resize=()=>{const rect=$('view').getBoundingClientRect();renderer.setSize(Math.max(1,rect.width),Math.max(1,rect.height),false);camera.aspect=rect.width/Math.max(1,rect.height);camera.updateProjectionMatrix();view(current);};
  const observer=new ResizeObserver(resize);observer.observe($('view'));resize();
  cleanup=()=>{if(disposed)return;disposed=true;cancelAnimationFrame(frame);observer.disconnect();controls.dispose();presentation.dispose();panelStudy?.dispose();probeLines?.dispose();if(probe){ship.probeDock.add(model);}ship.dispose();renderer.dispose();renderer.forceContextLoss();};
  await renderer.compileAsync(scene,camera);$('status').hidden=true;
  // The compositor supplies the opaque/depth and gas targets to the draw callback.
  function render(now){
    if(disposed)return;frame=requestAnimationFrame(render);controls.update();
    fitExteriorInspectionDepth(camera,controls.target,inspectionBounds);
    ship.probeThrusters.update({visible:probe&&$('gas').checked,thrusterClock:{seconds:6+(now/1000% .28),approachDuration:8,captureDuration:12,coreScale:2.6}});
    presentation.render({from:camera,to:null,mix:0},(_view,target,gasTarget)=>gasPass.render(scene,camera,target,gasTarget));
  }
  frame=requestAnimationFrame(render);
}catch(error){$('status').textContent=`表示できません: ${error.message}`;console.error(error);}
