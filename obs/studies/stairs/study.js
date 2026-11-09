import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {materials,box,batchStatic} from '../../src/obs/materials.js';
import {industrialMaterials} from '../../src/obs/industrial.js';
import {buildShip} from '../../src/obs/ship.js';
import {loadMiloHead} from '../../src/obs/head.js';
import {loadMiloBody} from '../../src/obs/milo-body.js';
import {createMilo} from '../../src/obs/characters.js';
import {loadLucy,createLucy} from '../../src/obs/lucy.js';
import {createDroid} from '../../src/obs/droid-model.js';
import {createDroidChargingBay} from '../../src/obs/droid-charging.js';
import {createMiloToon} from '../../src/obs/milo-toon.js';
import {createCabinToon} from '../../src/obs/cabin-toon.js';
import {CABIN_AMBIENCE,limitCabinLights} from '../../src/obs/lighting.js';
import {StairTraffic,STAIRS,STAIR_SEGMENTS,stairContact,STAIR_ROUTE_LENGTH} from './route.js';
import {createStairStructure,openCabinLeft} from './structure.js';
import {poseHuman,poseRobot,poseCat} from './poses.js';
const $=id=>document.getElementById(id);
let playing=true,time=0,last=performance.now(),view='stairs',reversed=false,frame,dirty=true;
const traffic=new StairTraffic();
const param=new URLSearchParams(location.search);
let catPass=['up','down'].includes(param.get('cat'))?param.get('cat'):null;
if(param.has('paused'))playing=false;
async function start(){
  const canvas=$('view'),scene=new THREE.Scene();scene.background=new THREE.Color('#0b1013');
  const renderer=new THREE.WebGLRenderer({canvas,antialias:true,stencil:true});renderer.setPixelRatio(Math.min(devicePixelRatio,1.4));
  renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=CABIN_AMBIENCE.exposure;
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  const camera=new THREE.PerspectiveCamera(32,1,.5,160),controls=new OrbitControls(camera,canvas);controls.enableDamping=false;
  const pmrem=new THREE.PMREMGenerator(renderer),room=new RoomEnvironment(),env=pmrem.fromScene(room,.04);scene.environment=env.texture;room.dispose();pmrem.dispose();
  scene.add(new THREE.HemisphereLight(CABIN_AMBIENCE.sky,CABIN_AMBIENCE.ground,CABIN_AMBIENCE.ambient));
  const key=new THREE.DirectionalLight(CABIN_AMBIENCE.key,CABIN_AMBIENCE.keyPower);key.position.set(-19,16,12);key.target.position.set(-15,4,0);key.castShadow=true;key.shadow.mapSize.set(1024,1024);Object.assign(key.shadow.camera,{left:-7,right:7,top:8,bottom:-8,near:1,far:45});key.shadow.bias=-.00015;key.shadow.normalBias=.025;scene.add(key,key.target);
  const fill=new THREE.DirectionalLight(CABIN_AMBIENCE.fill,.7);fill.position.set(-5,9,12);scene.add(fill);
  await new Promise(r=>requestAnimationFrame(r));
  const [m,head,lucy]=await Promise.all([materials(),loadMiloHead(),loadLucy(),loadMiloBody()]);
  head.userData.setAppearance({hair:'crop',beard:'none'});
  $('loading').textContent='階段室を組み立てています…';await new Promise(r=>requestAnimationFrame(r));
  const ship=buildShip(m,{mergeStatic:false}),removed=openCabinLeft(ship),steel=industrialMaterials(m);
  const cabin=batchStatic(ship.staticMesh);limitCabinLights(ship.animated);scene.add(cabin,ship.animated);
  const stairs=createStairStructure(steel);scene.add(stairs);
  const bay=createDroidChargingBay(6.784);bay.droid.root.visible=false;scene.add(bay.root);
  const human=createMilo(m,head),cat=createLucy(lucy),robot=createDroid({detail:'obs',balanceRotor:true}),robotParent=new THREE.Group();robotParent.add(robot.root);
  scene.add(human,cat,robotParent);
  const load=new THREE.Group();load.name='Robot carried equipment case';robot.root.add(load);
  box(load,steel.dark,0,1.18,.31,.61,.34,.37,.024);
  for(const x of [-.21,.21])box(load,steel.metal,x,1.18,.505,.045,.34,.015);
  box(load,steel.yellow,0,1.18,.506,.28,.07,.01);
  const toon=createCabinToon([cabin,ship.animated,stairs,robot.root]);toon.setStyle('cartoon');const humanToon=createMiloToon(human);
  const markers=new THREE.Group();scene.add(markers);const dots=[];
  for(let i=0;i<8;i++){const mesh=new THREE.Mesh(new THREE.SphereGeometry(.035,8,6),new THREE.MeshBasicMaterial({color:0x90e5ff,depthTest:false}));mesh.renderOrder=100;markers.add(mesh);dots.push(mesh);}
  const cameraPresets={stairs:{position:[-15.7,7.3,24.5],target:[-14.6,5.0,.65]},angle:{position:[-20,11,24],target:[-14.4,4.7,.6]},whole:{position:[-4,10,36],target:[-2.0,4.5,.4]}};
  function setView(name){
    dirty=true;view=name;if(cameraPresets[name]){camera.position.fromArray(cameraPresets[name].position);controls.target.fromArray(cameraPresets[name].target);}
    document.querySelectorAll('[data-view]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.view===name)));
    controls.update();
  }
  document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>setView(b.dataset.view));
  function reset(){
    dirty=true;time=0;traffic.reset();
    if(reversed)for(const a of traffic.agents){a.s=STAIR_ROUTE_LENGTH-a.s;a.direction*=-1;}
    if(catPass){const catAgent=traffic.agents.find(a=>a.id==='cat'),flight=STAIR_SEGMENTS.find(s=>s.kind==='flight');catAgent.direction=catPass==='up'?1:-1;catAgent.s=catAgent.direction>0?flight.start-.6:flight.end+.6;}
    last=performance.now();
  }
  document.querySelectorAll('[data-cat-pass]').forEach(button=>button.onclick=()=>{
    catPass=button.dataset.catPass;reset();$('cat').checked=true;$('human').checked=false;$('robot').checked=false;playing=true;$('play').textContent='一時停止';setView('cat');
  });
  $('rate').value=param.get('rate')==='.5'?'.5':'1';
  $('play').onclick=()=>{playing=!playing;dirty=true;$('play').textContent=playing?'一時停止':'再生';last=performance.now();};
  $('restart').onclick=()=>{reset();playing=true;$('play').textContent='一時停止';};
  $('reverse').onclick=()=>{if(catPass)catPass=catPass==='up'?'down':'up';else reversed=!reversed;reset();playing=true;$('play').textContent='一時停止';};
  $('time').oninput=()=>{const target=Number($('time').value);reset();for(let t=0;t<target-1e-9;t+=1/60)traffic.update(Math.min(1/60,target-t));time=target;playing=false;dirty=true;$('play').textContent='再生';};
  const resize=()=>{const r=canvas.getBoundingClientRect();renderer.setSize(r.width,r.height,false);camera.aspect=r.width/r.height;camera.updateProjectionMatrix();dirty=true;};
  controls.addEventListener('change',()=>{dirty=true;});document.querySelectorAll('input[type=checkbox]').forEach(input=>input.onchange=()=>{dirty=true;});
  const observer=new ResizeObserver(resize);observer.observe(canvas);resize();setView(param.get('view')==='cat'||catPass?'cat':'stairs');
  if(catPass){reset();$('human').checked=false;$('robot').checked=false;}
  window.stairStudy={traffic,scene,stairs,human,cat,robot,robotParent,camera,controls,renderer,removed,setView,get time(){return time;}};
  function draw(dt){
    load.visible=$('cargo').checked;const poses=[];
    for(const a of traffic.agents){
      const root=a.id==='human'?human:a.id==='robot'?robotParent:cat;
      root.visible=$(a.id).checked;if(!root.visible)continue;
      const p=a.id==='human'?poseHuman(human,a,time):a.id==='robot'?poseRobot(robot,robotParent,load,a,time):poseCat(cat,a,time,dt);
      poses.push({id:a.id,...p});
    }
    markers.visible=$('contacts').checked;
    let dot=0;for(const pose of poses)for(const foot of pose.feet){if(dot<dots.length)dots[dot++].position.set(foot.x,foot.y+.025,foot.z);}
    for(let i=0;i<dots.length;i++)dots[i].visible=i<dot;
    if(['human','robot','cat'].includes(view)){
      const a=traffic.agents.find(a=>a.id===view),p=view==='cat'?cat.position:stairContact(a.s,a.direction,.32),target=new THREE.Vector3(p.x,p.y+(view==='cat'?.28:.95),p.z);
      const offset=view==='cat'?new THREE.Vector3(0,.32,2.8):new THREE.Vector3(0,.7,5.8);
      controls.target.lerp(target,dt>0?.16:1);camera.position.lerp(target.clone().add(offset),dt>0?.16:1);
    }
    controls.update();toon.update(canvas.clientWidth,canvas.clientHeight,view==='whole'?16:11,16);
    humanToon.update(canvas.clientWidth,canvas.clientHeight,11,16);renderer.render(scene,camera);
    $('time').value=time;$('clock').textContent=`${time.toFixed(1)} 秒`;
    $('state').textContent=(catPass?('猫の'+(catPass==='up'?'上り':'下り')+' / '+($('rate').value==='1'?'通常速度':'½速度')):'人・ロボ・猫の同時通行')+' / '+(playing?'再生中':'一時停止');
    window.stairStudy.poses=poses;
    if(traffic.agents.every(a=>a.wait===Infinity&&a.exit>=1)&&playing){playing=false;$('play').textContent='再生';}
  }
  if(param.has('time')){const t=Math.min(100,Math.max(0,Number(param.get('time'))||0));for(let s=0;s<t;s+=1/60)traffic.update(1/60);time=t;}
  draw(1/60);$('play').textContent=playing?'一時停止':'再生';$('loading').hidden=true;last=performance.now();
  function tick(now){frame=requestAnimationFrame(tick);const dt=Math.min(.05,(now-last)/1000);last=now;if(document.hidden)return;if(playing){const step=dt*Number($('rate').value);time+=step;traffic.update(step);}if(playing||dirty){dirty=false;draw(playing?dt:0);}}
  frame=requestAnimationFrame(tick);
  window.addEventListener('pagehide',()=>{cancelAnimationFrame(frame);observer.disconnect();controls.dispose();toon.dispose();humanToon.dispose();renderer.dispose();env.dispose();});
}
start().catch(error=>{console.error(error);$('loading').textContent='読み込みに失敗しました: '+error.message;});
