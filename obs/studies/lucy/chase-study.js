import * as THREE from 'three';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {loadCabinLucy,createCabinLucy,animateCabinLucy} from '../../src/obs/lucy-cabin.js';
import {createLucyToon} from '../../src/obs/lucy-toon.js';
import {createCatTurn,sampleCatTurn} from '../../src/obs/cat-turn.js';
import {MouseChase,CHASE_PREVIEW_DURATION,RUN_STRIDE,RUN_SPEED} from './chase-motion.js';
import {createLucyRunRig} from './run-rig.js';
import {createStudyMouse} from './mouse-model.js';

const $=id=>document.getElementById(id),params=new URLSearchParams(location.search);
let sceneTime=Math.max(0,Math.min(CHASE_PREVIEW_DURATION,Number(params.get('time'))||0)),playing=false,simulation,previewTriggered=false;
let cycleFrame=Math.max(0,Math.min(11,(Number(params.get('frame'))||1)-1));
if(params.get('floor')==='other')$('floor').value='other';
if(params.get('direction')==='-1')$('direction').value='-1';
if(['follow','side','all','mouse','mouse-side','cycle'].includes(params.get('view')))$('view').value=params.get('view');
$('time').max=CHASE_PREVIEW_DURATION;
const floorY=floor=>floor*1.55;
function reset(){simulation=new MouseChase({random:$('rare').checked?Math.random:()=>.45,mouseFloor:$('floor').value==='same'?0:1,direction:Number($('direction').value)});previewTriggered=false;sceneTime=0;}
function advance(dt){
  if(!$('rare').checked&&!previewTriggered){simulation.appear($('floor').value==='same'?0:1);previewTriggered=true;}
  simulation.update(dt);sceneTime+=dt;
}
function seek(t){reset();for(let remaining=t;remaining>1e-8;){const dt=Math.min(remaining,1/60);advance(dt);remaining-=dt;}}

async function init(){
  const canvas=$('canvas'),renderer=new THREE.WebGLRenderer({canvas,antialias:true,stencil:true});renderer.setPixelRatio(Math.min(2,devicePixelRatio));renderer.localClippingEnabled=true;
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.2;
  const scene=new THREE.Scene();scene.background=new THREE.Color(0x283730);
  const pmrem=new THREE.PMREMGenerator(renderer),room=new RoomEnvironment(),environment=pmrem.fromScene(room,.04);scene.environment=environment.texture;room.dispose();pmrem.dispose();
  scene.add(new THREE.HemisphereLight(0xf2eed5,0x414d3d,2));const key=new THREE.DirectionalLight(0xffefd3,3);key.position.set(-2,6,6);key.castShadow=true;key.shadow.mapSize.set(2048,1024);Object.assign(key.shadow.camera,{left:-5,right:5,top:4,bottom:-2,near:.1,far:20});key.shadow.bias=-.0003;key.shadow.normalBias=.009;scene.add(key);
  const wall=new THREE.MeshStandardMaterial({color:0x68766b,roughness:.95}),floorMat=new THREE.MeshStandardMaterial({color:0x535e53,roughness:.95}),metal=new THREE.MeshStandardMaterial({color:0x283b35,roughness:.85});
  function box(mat,x,y,z,w,h,d){const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);mesh.position.set(x,y,z);mesh.receiveShadow=true;scene.add(mesh);return mesh;}
  for(const floor of [0,1]){
    const y=floorY(floor);box(floorMat,0,y-.04,-.12,9,.08,1.85);box(wall,0,y+.70,-1.10,9,1.4,.14);box(metal,0,y+.075,-.99,9,.10,.09);
    for(let x=-4.5;x<=4.5;x+=.75){box(metal,x,y+.75,-1.014,.009,1.31,.013);box(metal,x,y+.003,.29,.007,.004,.60);}
    for(const x of [-4.25,4.25]){box(metal,x,y+.10,-.935,.23,.19,.09);box(wall,x,y+.065,-.83,.12,.13,.14);}
  }
  const lucy=createCabinLucy(await loadCabinLucy(),{random:()=>.5});scene.add(lucy);
  const rig=createLucyRunRig(lucy),toon=createLucyToon(lucy),mouse=createStudyMouse();scene.add(mouse.root);
  const camera=new THREE.OrthographicCamera(-2,2,1,-1,.02,30);let width=1,height=1,dirty=true,raf,last=performance.now();
  function frame(){
    const m=simulation.mouse,view=$('view').value,cycle=view==='cycle',mouseView=view==='mouse'||view==='mouse-side';
    // Start the twelve-frame inspection at the forward reach, like the
    // supplied Muybridge strip. It samples the very same rig as the chase.
    const cyclePhase=(.75+cycleFrame/12)%1;
    const cat=cycle?{x:0,floor:0,z:-.18,yaw:Number($('direction').value)*Math.PI/2,speed:RUN_SPEED,distance:cyclePhase*RUN_STRIDE}:simulation.cat;
    lucy.position.set(cat.x,floorY(cat.floor),cat.z);lucy.rotation.y=cat.yaw;
    let turn=null;if(!cycle&&cat.phase==='turn'){const plan=createCatTurn(simulation.startYaw,simulation.startYaw+simulation.turnDelta,{duration:1.15});plan.age=simulation.turnAge;turn=sampleCatTurn(plan);}
    animateCabinLucy(lucy,{time:cycle?0:simulation.time,dt:1/60,moving:!cycle&&cat.speed>.03,mode:'idle',walkDistance:cat.distance,yaw:cat.yaw,headingControlled:true,turn});
    const gait=cat.speed>.45?rig.update({distance:cat.distance,speed:cat.speed,...(cycle?{weight:1}:{})}):null;
    lucy.visible=!mouseView;
    mouse.root.visible=m.visible&&!cycle;mouse.root.position.set(m.x,floorY(m.floor),m.z);mouse.root.rotation.y=simulation.direction*Math.PI/2;
    const mouseGait=mouse.update(m);
    let target=new THREE.Vector3(cat.x+.60*simulation.direction,floorY(cat.floor)+.39,-.30),half=1.02;
    if(cycle){target.set(0,.24,-.18);half=Math.max(.34,.68/(width/height));}
    else if(mouseView){target.set(m.x,floorY(m.floor)+.078,m.z-.03);half=Math.max(.18,.24/(width/height));}
    else if(view==='all'||$('floor').value==='other'){target.set(0,1.28,-.25);half=Math.max(1.67,4.6/(width/height));}
    else half=Math.max(.79,1.65/(width/height));
    camera.left=-half*width/height;camera.right=-camera.left;camera.top=half;camera.bottom=-half;camera.updateProjectionMatrix();
    camera.position.copy(target).add(view==='mouse'?new THREE.Vector3(simulation.direction*4.8,.7,3.5):view==='mouse-side'?new THREE.Vector3(0,.05,7):cycle?new THREE.Vector3(0,.05,7):view==='side'?new THREE.Vector3(0,.12,7):new THREE.Vector3(.65,.7,7));camera.lookAt(target);
    const labels={idle:'壁際を見て待つ',watch:'壁際の様子を見ている',notice:'歩いているネズミに気づく',turn:'足を踏み替えて向きを変える',chase:'ネズミを追いかける',braking:'減速して、隙間を見送る'};
    const mouseLabels={emerge:'ネズミが隙間からゆっくり出てくる',survey:'半立ちで、左右をうかがう',settle:'前足を下ろして、歩く準備',walk:'猫に見つかるまでは、ゆっくり歩く',run:'猫に見つかり、次の隙間へ走る',hidden:'隙間へ隠れた'};
    const cycleLabels=['前足を前に伸ばす','着地へ向けて下ろす','先行する前足が接地へ','前足で着地を受ける','左右の前足で支える','体が前足を越える','後脚を引きつける','前足が床を離れる','手首を下へ折り畳む','胸の下で前足を回収','後脚で蹴り、肘を開く','前足を前へ振り出す'];
    $('status').textContent=cycle?cycleLabels[Math.floor(cycleFrame)]:$('rare').checked&&!simulation.active?`次の出現まで 約${Math.ceil(simulation.wait)}秒`:mouseView||['emerge','survey','settle','walk'].includes(m.phase)?mouseLabels[m.phase]:cat.floor!==m.floor&&m.visible?'別の階なので、追いかけない':labels[cat.phase];
    $('speed-output').textContent=(mouseView?m.speed:cat.speed).toFixed(2)+' m/s';$('time-output').textContent=sceneTime.toFixed(2)+' 秒';$('time').value=Math.min(CHASE_PREVIEW_DURATION,sceneTime);
    $('timeline-controls').hidden=cycle;$('cycle-controls').hidden=!cycle;
    $('restart').hidden=cycle;$('floor-control').hidden=cycle;$('rare-control').hidden=cycle;
    $('cycle').value=Math.floor(cycleFrame)+1;$('cycle-output').textContent=`${Math.floor(cycleFrame)+1} / 12 コマ`;
    for(const id of ['frontL','frontR','rearL','rearR'])$(id).classList.toggle('on',mouseView?m.visible&&mouseGait.feet[id].planted:gait?gait.feet[id].planted:cat.speed<.03);
    toon.update(width,height);renderer.render(scene,camera);dirty=false;
  }
  function resize(){const rect=canvas.getBoundingClientRect();width=Math.max(1,Math.round(rect.width));height=Math.max(1,Math.round(rect.height));renderer.setSize(width,height,false);dirty=true;}
  const observer=new ResizeObserver(resize);observer.observe(canvas);resize();seek(sceneTime);frame();
  function url(){const u=new URL(location.href);for(const key of ['floor','direction','view'])u.searchParams.set(key,$(key).value);u.searchParams.set('time',sceneTime.toFixed(2));if($('view').value==='cycle')u.searchParams.set('frame',Math.floor(cycleFrame)+1);else u.searchParams.delete('frame');history.replaceState(null,'',u);}
  function play(value){playing=value;$('play').textContent=value?'一時停止':'再生';last=performance.now();}
  $('play').onclick=()=>play(!playing);$('restart').onclick=()=>{reset();simulation.appear($('floor').value==='same'?0:1);previewTriggered=true;dirty=true;play(true);};
  $('time').oninput=()=>{play(false);seek(Number($('time').value));dirty=true;url();};
  function setCycle(frame){play(false);cycleFrame=(frame+12)%12;dirty=true;url();}
  $('cycle').oninput=()=>setCycle(Number($('cycle').value)-1);
  $('cycle-prev').onclick=()=>setCycle(Math.floor(cycleFrame)-1);$('cycle-next').onclick=()=>setCycle(Math.floor(cycleFrame)+1);
  for(const id of ['floor','direction'])$(id).onchange=()=>{seek(0);dirty=true;url();};
  $('view').onchange=()=>{dirty=true;url();};$('rare').onchange=()=>{reset();dirty=true;play(true);};
  document.querySelectorAll('button,input,select').forEach(el=>el.disabled=false);
  function tick(now){raf=requestAnimationFrame(tick);const dt=Math.min(.05,(now-last)/1000);last=now;if(document.hidden)return;
    if(playing){const step=dt*Number($('speed').value);if($('view').value==='cycle')cycleFrame=(cycleFrame+step*12*RUN_SPEED/RUN_STRIDE)%12;else{if(!$('rare').checked&&sceneTime>=CHASE_PREVIEW_DURATION)reset();advance(step);}dirty=true;}
    if(dirty)frame();
  }
  raf=requestAnimationFrame(tick);
  addEventListener('pagehide',e=>{if(!e.persisted){cancelAnimationFrame(raf);observer.disconnect();rig.dispose();toon.dispose();environment.dispose();renderer.dispose();}});
}
init().catch(error=>{console.error(error);$('error').hidden=false;$('error').textContent='スタディを読み込めませんでした: '+error.message;});
