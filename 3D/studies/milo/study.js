import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {materials} from '../../src/obs/materials.js';
import {loadMiloHead} from '../../src/obs/head.js';
import {loadMiloBody} from '../../src/obs/milo-body.js';
import {createMilo,animateMilo} from '../../src/obs/characters.js';
import {miloWalkData as walkData} from '../../src/obs/mocap-walk.js';
import {updateMiloWatch} from '../../src/obs/milo-watch.js';

const POSES=[
  {id:'idle',label:'静止'},
  {id:'mocap',label:'歩行・実測'},
  {id:'walk',label:'歩行・従来'},
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
  let current=POSES[1],time=0,watchTime=0,paused=false,last=performance.now();
  const originalArms=milo.userData.arms.map(({arm})=>arm.position.clone());
  function pose(){
    $('time').max=current.id==='mocap'?walkData.duration:8;
    milo.userData.arms.forEach(({arm},i)=>arm.position.copy(originalArms[i]));
    animateMilo(milo,{moving:current.id==='walk'||current.id==='mocap',walkStyle:current.id==='walk'?'legacy':'measured',climbing:current.id==='climb',waiting:false,facing:1,action:current.id==='seat'?'console':null,time,walkDistance:time*walkData.cycleDistance/walkData.duration,actionTime:time,actionDuration:8});
    updateMiloWatch(milo,watchTime);
    milo.rotation.y=0;
    $('time').value=time;$('clock').value=`${time.toFixed(2)}秒`;$('status').textContent=current.id==='mocap'?'歩行・実測 / OBSと共通':`${current.label} / 本編と同じマイロを表示中`;
  }
  function setView(){
    const view=$('view').value,target=new THREE.Vector3(view==='arms'?.22:0,view==='arms'?1.02:view==='face'?1.68:view==='boots'?.13:view==='trousers'?.64:.87,view==='arms'?-.03:0);let az=.65,el=.12;camera.zoom=view==='arms'?2.4:view==='face'?4.4:view==='boots'?3.8:view==='trousers'?2.1:1;
    if(view==='arms'){az=Math.PI/2;el=.04;}
    if(view==='watch'){
      const watch=milo.userData.watch.group;watch.getWorldPosition(target);camera.zoom=6;
      controls.target.copy(target);camera.position.copy(target).add(new THREE.Vector3(0,.5,3).applyQuaternion(watch.getWorldQuaternion(new THREE.Quaternion())));
      camera.lookAt(target);camera.updateProjectionMatrix();controls.update();return;
    }
    if(view==='face')el=.04;
    if(view==='boots'){az=Math.PI/2;el=.04;}
    if(view==='front')az=0;if(view==='back')az=Math.PI;if(view==='left')az=-Math.PI/2;if(view==='right')az=Math.PI/2;
    controls.target.copy(target);camera.position.copy(target).add(new THREE.Vector3(Math.sin(az)*3,Math.sin(el)*3,Math.cos(az)*3));camera.lookAt(target);camera.updateProjectionMatrix();controls.update();
  }
  $('view').add(new Option('ブーツ拡大','boots'));
  $('view').add(new Option('顔拡大','face'));
  $('view').add(new Option('腕・手拡大','arms'));
  $('view').add(new Option('時計拡大','watch'));
  for(const entry of POSES){
    const button=document.createElement('button');button.textContent=entry.label;button.setAttribute('aria-pressed',entry===current);button.onclick=()=>{current=entry;time=0;for(const child of $('poses').children)child.setAttribute('aria-pressed',child===button);pose();};$('poses').append(button);
  }
  $('pause').onclick=()=>{paused=!paused;$('pause').textContent=paused?'再生':'一時停止';};
  $('restart').onclick=()=>{time=0;pose();};
  $('time').oninput=()=>{time=Number($('time').value);paused=true;$('pause').textContent='再生';pose();};
  $('view').onchange=setView;$('reset').onclick=()=>{$('view').value='oblique';setView();};
  function resize(){
    const w=innerWidth,h=innerHeight,top=document.querySelector('header').getBoundingClientRect().bottom+12,bottom=document.querySelector('footer').getBoundingClientRect().top-12;
    const usable=Math.max(100,bottom-top),half=Math.max(.92,1.08*h/w,1.03*h/usable),offset=((top+bottom)/2-h/2)*2*half/h;
    renderer.setSize(w,h,false);camera.top=half+offset;camera.bottom=-half+offset;camera.left=-half*w/h;camera.right=half*w/h;camera.updateProjectionMatrix();
  }
  const layoutObserver=new ResizeObserver(resize);layoutObserver.observe(document.querySelector('header'));layoutObserver.observe(document.querySelector('footer'));
  addEventListener('resize',resize);resize();pose();setView();
  function frame(now){const dt=Math.max(0,Math.min(.1,(now-last)/1000));last=now;if(!paused){const step=dt*Number($('speed').value);watchTime+=step;time=(time+step)%(current.id==='mocap'?walkData.duration:8);pose();}controls.update();renderer.render(scene,camera);requestAnimationFrame(frame);}
  requestAnimationFrame(frame);
}
start().catch(error=>{console.error(error);document.getElementById('status').textContent='読み込みに失敗しました';document.getElementById('error').textContent=error.message;});
