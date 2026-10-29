import * as THREE from 'three';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {loadMiloHead} from '../../src/obs/head.js';
import {loadMiloBody} from '../../src/obs/milo-body.js';
import {materials} from '../../src/obs/materials.js';
import {createMilo,animateMilo} from '../../src/obs/characters.js';
import {createMiloToon} from '../../src/obs/milo-toon.js';
import {headingEase} from '../../src/obs/heading.js';
import {planMiloTurn,applyMiloTurn} from '../../src/obs/milo-turn.js';

const $=id=>document.getElementById(id),params=new URLSearchParams(location.search);
let angle=[90,-90,180,-180].includes(Number(params.get('angle')))?Number(params.get('angle')):90;
let progress=THREE.MathUtils.clamp(Number(params.get('progress')??0)||0,0,1),view=['feet','top'].includes(params.get('view'))?params.get('view'):'full',playing=false;
async function init(){
  const [m,leftHead,rightHead]=await Promise.all([materials(),loadMiloHead(),loadMiloHead(),loadMiloBody()]);
  const canvas=$('turn-canvas'),renderer=new THREE.WebGLRenderer({canvas,antialias:true,stencil:true});
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.1;
  const pmrem=new THREE.PMREMGenerator(renderer),room=new RoomEnvironment(),environment=pmrem.fromScene(room,.04);room.dispose();pmrem.dispose();
  const entries=[leftHead,rightHead].map(head=>{
    head.userData.setAppearance({hair:'crop',beard:'none'});
    const scene=new THREE.Scene();scene.background=new THREE.Color(0x202b2c);scene.environment=environment.texture;
    scene.add(new THREE.HemisphereLight(0xf4f5e7,0x657b7b,2.1));
    const key=new THREE.DirectionalLight(0xfff1d7,2.6);key.position.set(3,5,4);scene.add(key);
    const fill=new THREE.DirectionalLight(0xc5dce7,1.1);fill.position.set(-3,2,-2);scene.add(fill);
    const floor=new THREE.Mesh(new THREE.PlaneGeometry(8,8),new THREE.MeshStandardMaterial({color:0x465453,roughness:1}));floor.rotation.x=-Math.PI/2;floor.position.y=-.001;scene.add(floor);
    const grid=new THREE.GridHelper(8,80,0x77817c,0x667573);grid.position.y=.001;grid.material.transparent=true;grid.material.opacity=.4;scene.add(grid);
    const milo=createMilo(m,head);scene.add(milo);
    return{scene,milo,camera:new THREE.OrthographicCamera(-1,1,1,-1,.02,20),toon:createMiloToon(milo)};
  });
  let width=1,height=1,dirty=true,last=performance.now(),frame,hold=0;
  const duration=()=>.45+.65*Math.abs(angle*Math.PI/180);
  function url(){const next=new URL(location.href);next.searchParams.set('angle',angle);next.searchParams.set('view',view);next.searchParams.set('progress',progress.toFixed(3));history.replaceState(null,'',next);}
  function camera(){
    const aspect=width/2/height,target=new THREE.Vector3(0,view==='full'?.92:view==='feet'?.29:0,0),half=Math.max(view==='full'?1.10:view==='feet'?.56:.43,(view==='full'?.48:.37)/aspect);
    for(const {camera}of entries){camera.left=-half*aspect;camera.right=half*aspect;camera.top=half;camera.bottom=-half;camera.updateProjectionMatrix();camera.position.copy(target).add(view==='top'?new THREE.Vector3(0,4,.001):new THREE.Vector3(2.4,view==='full'?1.1:1.65,3.2));camera.lookAt(target);}
    dirty=true;
  }
  function pose(){
    const plan=planMiloTurn(0,angle*Math.PI/180);let state;
    entries.forEach(({milo},index)=>{
      milo.rotation.y=0;animateMilo(milo,{moving:false,action:null,time:0,dt:0});milo.rotation.y=plan.delta*headingEase(progress);
      if(index)state=applyMiloTurn(milo,plan,progress);
      milo.updateMatrixWorld(true);milo.userData.bodySkin.skeleton.update();
    });
    $('progress').value=progress;$('time-output').textContent=(progress*duration()).toFixed(2)+' / '+duration().toFixed(2)+'秒';
    const lifted=state.feet.find(f=>!f.planted);
    $('status').textContent=lifted?(lifted.side===1?'左足':'右足')+'を踏み替える / '+(lifted.side===1?'右足':'左足')+'は接地':'両足で立つ';
    document.querySelectorAll('[data-angle]').forEach(b=>b.setAttribute('aria-pressed',Number(b.dataset.angle)===angle));dirty=true;
  }
  function setPlaying(value){playing=value;$('play').textContent=value?'一時停止':'再生';$('play').setAttribute('aria-pressed',value);last=performance.now();hold=0;}
  $('progress').oninput=()=>{setPlaying(false);progress=Number($('progress').value);pose();url();};
  $('play').onclick=()=>{if(!playing&&progress===1)progress=0;setPlaying(!playing);pose();};
  document.querySelectorAll('[data-angle]').forEach(b=>b.onclick=()=>{angle=Number(b.dataset.angle);progress=0;hold=0;pose();url();});
  document.querySelectorAll('[data-view]').forEach(b=>{b.setAttribute('aria-pressed',b.dataset.view===view);b.onclick=()=>{view=b.dataset.view;document.querySelectorAll('[data-view]').forEach(other=>other.setAttribute('aria-pressed',other===b));camera();url();};});
  function resize(){const rect=canvas.getBoundingClientRect();width=Math.max(2,Math.round(rect.width));height=Math.max(1,Math.round(rect.height));renderer.setSize(width,height,false);camera();}
  const observer=new ResizeObserver(resize);observer.observe(canvas);resize();pose();
  document.querySelectorAll('button,input,select').forEach(control=>control.disabled=false);$('loading').hidden=true;
  function draw(){renderer.setScissorTest(true);entries.forEach((entry,i)=>{const x=i*Math.floor(width/2),w=i?width-x:Math.floor(width/2);renderer.setViewport(x,0,w,height);renderer.setScissor(x,0,w,height);entry.toon.update(w,height);renderer.render(entry.scene,entry.camera);});renderer.setScissorTest(false);dirty=false;}
  function tick(now){frame=requestAnimationFrame(tick);const dt=Math.min((now-last)/1000,.05);last=now;if(document.hidden)return;
    if(playing){if(progress<1){progress=Math.min(1,progress+dt*Number($('speed').value)/duration());pose();}else if($('loop').checked){hold+=dt;if(hold>.9){progress=0;hold=0;pose();}}else{setPlaying(false);url();}}
    if(dirty)draw();
  }
  frame=requestAnimationFrame(tick);
  addEventListener('pagehide',event=>{if(event.persisted)return;cancelAnimationFrame(frame);observer.disconnect();entries.forEach(e=>e.toon.dispose());environment.dispose();renderer.dispose();});
}
init().catch(error=>{console.error(error);$('loading').hidden=true;$('error').hidden=false;$('error').textContent='スタディを読み込めませんでした。'+error.message;});
