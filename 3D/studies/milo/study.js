import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {materials} from '../../src/obs/materials.js';
import {loadMiloHead} from '../../src/obs/head.js';
import {loadMiloBody} from '../../src/obs/milo-body.js';
import {createMilo,animateMilo} from '../../src/obs/characters.js';

const POSES=[
  {id:'idle',label:'静止'},
  {id:'walk',label:'歩行'},
  {id:'climb',label:'梯子'},
  {id:'seat',label:'着席'},
];

async function start(){
  const $=id=>document.getElementById(id);
  const [m,head]=await Promise.all([materials(),loadMiloHead(),loadMiloBody()]);
  const milo=createMilo(m,head);
  const renderer=new THREE.WebGLRenderer({canvas:document.querySelector('canvas'),antialias:true});
  renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  const scene=new THREE.Scene();scene.background=new THREE.Color(0x5d6263);scene.add(milo,new THREE.HemisphereLight(0xffffff,0x343a3c,2.2));
  const key=new THREE.DirectionalLight(0xfffaf0,2.7);key.position.set(-3,5,4);key.castShadow=true;key.shadow.mapSize.set(2048,2048);scene.add(key);
  const fill=new THREE.DirectionalLight(0xbad1d5,1.2);fill.position.set(3,2,-4);scene.add(fill);
  const floor=new THREE.Mesh(new THREE.PlaneGeometry(20,20),new THREE.MeshStandardMaterial({color:0x656a69,roughness:1}));floor.rotation.x=-Math.PI/2;floor.receiveShadow=true;scene.add(floor);
  const camera=new THREE.OrthographicCamera(-1,1,1,-1,.01,30),controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.minZoom=.45;controls.maxZoom=6;controls.maxPolarAngle=Math.PI/2-.015;
  let current=POSES[0],time=0,paused=false,last=performance.now();
  function pose(){
    animateMilo(milo,{moving:current.id==='walk',climbing:current.id==='climb',waiting:false,facing:1,action:current.id==='seat'?'console':null,time,walkDistance:time*.42,actionTime:time,actionDuration:8});
    milo.rotation.y=0;
    $('time').value=time;$('clock').value=`${time.toFixed(2)}秒`;$('status').textContent=`${current.label} / 本編と同じマイロを表示中`;
  }
  function setView(){
    const view=$('view').value,target=new THREE.Vector3(view==='arms'?.22:0,view==='arms'?1.02:view==='face'?1.68:view==='boots'?.13:view==='trousers'?.64:.87,view==='arms'?-.03:0);let az=.65,el=.12;camera.zoom=view==='arms'?2.4:view==='face'?4.4:view==='boots'?3.8:view==='trousers'?2.1:1;
    if(view==='arms'){az=Math.PI/2;el=.04;}
    if(view==='face')el=.04;
    if(view==='boots'){az=Math.PI/2;el=.04;}
    if(view==='front')az=0;if(view==='back')az=Math.PI;if(view==='left')az=-Math.PI/2;if(view==='right')az=Math.PI/2;
    controls.target.copy(target);camera.position.copy(target).add(new THREE.Vector3(Math.sin(az)*3,Math.sin(el)*3,Math.cos(az)*3));camera.lookAt(target);camera.updateProjectionMatrix();controls.update();
  }
  $('view').add(new Option('ブーツ拡大','boots'));
  $('view').add(new Option('顔拡大','face'));
  $('view').add(new Option('腕・手拡大','arms'));
  for(const entry of POSES){
    const button=document.createElement('button');button.textContent=entry.label;button.setAttribute('aria-pressed',entry===current);button.onclick=()=>{current=entry;time=0;for(const child of $('poses').children)child.setAttribute('aria-pressed',child===button);pose();};$('poses').append(button);
  }
  $('pause').onclick=()=>{paused=!paused;$('pause').textContent=paused?'再生':'一時停止';};
  $('restart').onclick=()=>{time=0;pose();};
  $('time').oninput=()=>{time=Number($('time').value);paused=true;$('pause').textContent='再生';pose();};
  $('view').onchange=setView;$('reset').onclick=()=>{$('view').value='oblique';setView();};
  function resize(){const w=innerWidth,h=innerHeight,half=Math.max(.92,1.08*h/w);renderer.setSize(w,h,false);camera.top=half;camera.bottom=-half;camera.left=-half*w/h;camera.right=half*w/h;camera.updateProjectionMatrix();}
  addEventListener('resize',resize);resize();pose();setView();
  function frame(now){const dt=Math.min(.1,(now-last)/1000);last=now;if(!paused){time=(time+dt*Number($('speed').value))%8;pose();}controls.update();renderer.render(scene,camera);requestAnimationFrame(frame);}
  requestAnimationFrame(frame);
}
start().catch(error=>{console.error(error);document.getElementById('status').textContent='読み込みに失敗しました';document.getElementById('error').textContent=error.message;});
