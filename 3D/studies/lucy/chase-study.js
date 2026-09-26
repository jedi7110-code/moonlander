import * as THREE from 'three';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {loadCabinLucy,createCabinLucy,animateCabinLucy} from '../../src/obs/lucy-cabin.js';
import {createLucyToon} from '../../src/obs/lucy-toon.js';
import {createCatTurn,sampleCatTurn} from '../../src/obs/cat-turn.js';
import {MouseChase,runCycle,RUN_STRIDE} from './chase-motion.js';
import {createLucyRunRig} from './run-rig.js';

const $=id=>document.getElementById(id),params=new URLSearchParams(location.search);
let sceneTime=Math.max(0,Math.min(12,Number(params.get('time'))||0)),playing=false,simulation,previewTriggered=false;
if(params.get('floor')==='other')$('floor').value='other';
if(params.get('direction')==='-1')$('direction').value='-1';
if(['follow','side','all'].includes(params.get('view')))$('view').value=params.get('view');
const floorY=floor=>floor*1.55;
function reset(){simulation=new MouseChase({random:()=>.45,direction:Number($('direction').value)});previewTriggered=false;sceneTime=0;}
function advance(dt){
  if(!$('rare').checked&&!previewTriggered){simulation.appear($('floor').value==='same'?0:1);previewTriggered=true;}
  simulation.update(dt);sceneTime+=dt;
}
function seek(t){reset();for(let remaining=t;remaining>1e-8;){const dt=Math.min(remaining,1/60);advance(dt);remaining-=dt;}}

function mouseModel(){
  const root=new THREE.Group(),body=new THREE.Group();root.add(body);
  const fur=new THREE.MeshStandardMaterial({color:0x817967,roughness:1}),pink=new THREE.MeshStandardMaterial({color:0x9c8273,roughness:1}),black=new THREE.MeshStandardMaterial({color:0x141511,roughness:.48});
  function ellipsoid(parent,mat,pos,size){const mesh=new THREE.Mesh(new THREE.SphereGeometry(1,12,8),mat);mesh.position.set(...pos);mesh.scale.set(...size);parent.add(mesh);mesh.castShadow=mesh.receiveShadow=true;return mesh;}
  ellipsoid(body,fur,[0,.040,0],[.031,.031,.062]);
  ellipsoid(body,fur,[0,.038,.061],[.022,.022,.033]);
  ellipsoid(body,pink,[0,.035,.089],[.008,.006,.007]);
  for(const s of [-1,1]){ellipsoid(body,fur,[s*.022,.061,.043],[.014,.021,.006]);ellipsoid(body,pink,[s*.022,.062,.047],[.010,.015,.003]);ellipsoid(body,black,[s*.018,.047,.070],[.004,.004,.004]);}
  const paws=[];for(const x of [-.026,.026])for(const z of [-.039,.038])paws.push(ellipsoid(root,pink,[x,.009,z],[.009,.007,.016]));
  const tail=[];for(let i=0;i<7;i++){
    const part=new THREE.Mesh(new THREE.CylinderGeometry(.0038-i*.00038,.0042-i*.0004,.027,6),pink);root.add(part);tail.push(part);
  }
  return{root,update(time,speed){
    const w=Math.min(1,speed/.8);body.position.y=Math.sin(time*36)*.0017*w;
    paws.forEach((paw,i)=>{paw.position.z=(i%2? .038:-.039)+Math.sin(time*36+i*Math.PI/2)*.012*w;paw.position.y=.009+Math.max(0,Math.sin(time*36+i*Math.PI/2))*.007*w;});
    let last=new THREE.Vector3(0,.026,-.052);
    tail.forEach((part,i)=>{const next=new THREE.Vector3(Math.sin(time*7-i*.5)*.014*(i+1)/7,.010+.012*(1-i/7),-.074-i*.024);part.position.copy(last).add(next).multiplyScalar(.5);part.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),next.clone().sub(last).normalize());last=next;});
  }};
}
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
  const rig=createLucyRunRig(lucy),toon=createLucyToon(lucy),mouse=mouseModel();scene.add(mouse.root);
  const camera=new THREE.OrthographicCamera(-2,2,1,-1,.02,30);let width=1,height=1,dirty=true,raf,last=performance.now();
  function frame(){
    const cat=simulation.cat,m=simulation.mouse,view=$('view').value;
    lucy.position.set(cat.x,floorY(cat.floor),cat.z);lucy.rotation.y=cat.yaw;
    let turn=null;if(cat.phase==='turn'){const plan=createCatTurn(simulation.startYaw,simulation.startYaw+simulation.turnDelta,{duration:1.15});plan.age=simulation.turnAge;turn=sampleCatTurn(plan);}
    animateCabinLucy(lucy,{time:simulation.time,dt:1/60,moving:cat.speed>.03,mode:'idle',walkDistance:cat.distance,yaw:cat.yaw,headingControlled:true,turn});
    const gait=cat.speed>.45?rig.update({distance:cat.distance,speed:cat.speed}):null;
    mouse.root.visible=m.visible;mouse.root.position.set(m.x,floorY(m.floor),m.z);mouse.root.rotation.y=simulation.direction*Math.PI/2;mouse.update(simulation.time,m.speed);
    let target=new THREE.Vector3(cat.x+.60*simulation.direction,floorY(cat.floor)+.39,-.30),half=1.02;
    if(view==='all'||$('floor').value==='other'){target.set(0,1.28,-.25);half=Math.max(1.67,4.6/(width/height));}
    else half=Math.max(.79,1.65/(width/height));
    camera.left=-half*width/height;camera.right=-camera.left;camera.top=half;camera.bottom=-half;camera.updateProjectionMatrix();
    camera.position.copy(target).add(view==='side'?new THREE.Vector3(0,.12,7):new THREE.Vector3(.65,.7,7));camera.lookAt(target);
    const labels={idle:'壁際を見て待つ',notice:'ネズミに気づく',turn:'足を踏み替えて向きを変える',chase:'ネズミを追いかける',braking:'減速して、隙間を見送る'};
    $('status').textContent=$('rare').checked&&!simulation.active?`次の出現まで 約${Math.ceil(simulation.wait)}秒`:cat.floor!==m.floor&&m.visible?'別の階なので、追いかけない':labels[cat.phase];
    $('speed-output').textContent=cat.speed.toFixed(2)+' m/s';$('time-output').textContent=sceneTime.toFixed(2)+' 秒';$('time').value=Math.min(12,sceneTime);
    for(const id of ['frontL','frontR','rearL','rearR'])$(id).classList.toggle('on',gait?gait.feet[id].planted:cat.speed<.03);
    toon.update(width,height);renderer.render(scene,camera);dirty=false;
  }
  function resize(){const rect=canvas.getBoundingClientRect();width=Math.max(1,Math.round(rect.width));height=Math.max(1,Math.round(rect.height));renderer.setSize(width,height,false);dirty=true;}
  const observer=new ResizeObserver(resize);observer.observe(canvas);resize();seek(sceneTime);frame();
  function url(){const u=new URL(location.href);for(const key of ['floor','direction','view'])u.searchParams.set(key,$(key).value);u.searchParams.set('time',sceneTime.toFixed(2));history.replaceState(null,'',u);}
  function play(value){playing=value;$('play').textContent=value?'一時停止':'再生';last=performance.now();}
  $('play').onclick=()=>play(!playing);$('restart').onclick=()=>{reset();simulation.appear($('floor').value==='same'?0:1);previewTriggered=true;dirty=true;play(true);};
  $('time').oninput=()=>{play(false);seek(Number($('time').value));dirty=true;url();};
  for(const id of ['floor','direction'])$(id).onchange=()=>{seek(0);dirty=true;url();};
  $('view').onchange=()=>{dirty=true;url();};$('rare').onchange=()=>{reset();dirty=true;play(true);};
  document.querySelectorAll('button,input,select').forEach(el=>el.disabled=false);
  function tick(now){raf=requestAnimationFrame(tick);const dt=Math.min(.05,(now-last)/1000);last=now;if(document.hidden)return;
    if(playing){if(!$('rare').checked&&sceneTime>=12)reset();advance(dt*Number($('speed').value));dirty=true;}
    if(dirty)frame();
  }
  raf=requestAnimationFrame(tick);
  addEventListener('pagehide',e=>{if(!e.persisted){cancelAnimationFrame(raf);observer.disconnect();toon.dispose();environment.dispose();renderer.dispose();}});
}
init().catch(error=>{console.error(error);$('error').hidden=false;$('error').textContent='スタディを読み込めませんでした: '+error.message;});
