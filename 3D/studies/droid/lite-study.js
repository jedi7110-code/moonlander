import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {createCabinToon} from '../../src/obs/cabin-toon.js';
import {createDroid,DROID_EXPRESSIONS} from '../../src/obs/droid-model.js';
import {sampleDroidServicePose} from '../../src/obs/droid-service.js';
import {DROID_STARTUP_SECONDS} from '../../src/obs/droid-startup.js';

const $=id=>document.getElementById(id),params=new URLSearchParams(location.search);
const VIEWS={three:{eye:[2.35,1.60,3.25],target:[0,.89,0],label:'THREE-QUARTER'},front:{eye:[0,1.19,4],target:[0,.89,0],label:'FRONT'},side:{eye:[4,1.23,0],target:[0,.89,0],label:'SIDE'},back:{eye:[0,1.35,-4],target:[0,.89,0],label:'BACK'},head:{eye:[.30,1.67,1.30],target:[0,1.56,.02],label:'NIXIE / EXPRESSIONS'},hands:{eye:[1.3,1.25,2],target:[0,1.05,.14],label:'HANDS / JOINTS'}};
const choose=(name,values,fallback)=>values.includes(params.get(name))?params.get(name):fallback;
function init(){
  const canvas=$('droid-canvas'),renderer=new THREE.WebGLRenderer({canvas,antialias:true});
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.08;
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  const room=new RoomEnvironment(),pmrem=new THREE.PMREMGenerator(renderer),environment=pmrem.fromScene(room,.04);room.dispose();pmrem.dispose();
  const models=['study','obs'].map(detail=>{
    const scene=new THREE.Scene();scene.background=new THREE.Color(0x1c2420);scene.environment=environment.texture;
    scene.add(new THREE.HemisphereLight(0xe7ebd7,0x44473d,1.8));
    const key=new THREE.DirectionalLight(0xffe9c9,3.2);key.position.set(-3,5,4);key.castShadow=true;key.shadow.mapSize.set(1024,1024);Object.assign(key.shadow.camera,{left:-1.5,right:1.5,top:2,bottom:-1.5,near:.1,far:12});key.shadow.bias=-.0002;key.shadow.normalBias=.012;scene.add(key);
    const rim=new THREE.DirectionalLight(0xc9dfe7,2.6);rim.position.set(2,3,-3);scene.add(rim);
    const fill=new THREE.DirectionalLight(0xe5cfb1,.7);fill.position.set(4,2,3);scene.add(fill);
    const floor=new THREE.Mesh(new THREE.PlaneGeometry(60,60),new THREE.MeshStandardMaterial({color:0x303b30,roughness:.94,metalness:.15}));floor.rotation.x=-Math.PI/2;floor.position.y=-.002;floor.receiveShadow=true;scene.add(floor);
    const droid=createDroid({detail});scene.add(droid.root);let triangles=0;
    droid.root.traverse(o=>{if(o.isMesh)triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;});
    const toon=createCabinToon([droid.root]);
    // A merged ladder moves past the stationary comparison camera. Its rung
    // spacing and hand contacts use the same ship-space sampler as OBS.
    const ladderParts=[],ladderMaterial=new THREE.MeshStandardMaterial({color:0x626b5c,metalness:.6,roughness:.65});
    for(let i=0;i<30;i++)ladderParts.push(new THREE.BoxGeometry(.64,.030,.030).translate(0,.12+i*.28,.31));
    for(const side of [-1,1])ladderParts.push(new THREE.BoxGeometry(.035,8,.035).translate(side*.335,4,.31));
    const ladder=new THREE.Mesh(mergeGeometries(ladderParts,false),ladderMaterial);ladderParts.forEach(g=>g.dispose());scene.add(ladder);
    return {detail,scene,droid,toon,triangles,floor,key,ladder};
  });
  for(const m of models)$(`${m.detail}-triangles`).textContent=m.triangles.toLocaleString()+' triangles';
  $('reduction').textContent='三角形数 '+(100-models[1].triangles/models[0].triangles*100).toFixed(1)+'% 削減';
  const camera=new THREE.PerspectiveCamera(32,1,.03,70),controls=new OrbitControls(camera,canvas);controls.minDistance=.55;controls.maxDistance=8;controls.minPolarAngle=.18;controls.maxPolarAngle=Math.PI*.70;
  let mode=choose('mode',['idle','walk','climb','carry','charging','wake'],'idle'),view=choose('view',Object.keys(VIEWS),'three'),style=choose('style',['current','cartoon','flat'],'cartoon'),expression=choose('face',Object.keys(DROID_EXPRESSIONS),'neutral'),layout=choose('layout',['both','study','obs'],'both');
  const duration=()=>mode==='wake'?DROID_STARTUP_SECONDS:20;
  let time=Math.max(0,Math.min(duration(),Number(params.get('time'))||0)),speed=1,playing=false,dirty=true,width=1,height=1,last=performance.now(),frame,hud=0;
  function save(){const url=new URL(location.href);for(const [key,value]of Object.entries({mode,view,style,face:expression,layout,time:time.toFixed(2)}))url.searchParams.set(key,value);history.replaceState(null,'',url);}
  function setView(){const v=VIEWS[view];camera.position.set(...v.eye);controls.target.set(...v.target);if(!['head','hands'].includes(view))camera.position.sub(controls.target).multiplyScalar(.88).add(controls.target);controls.update();$('view-label').textContent=v.label;dirty=true;}
  function pose(){
    for(const m of models){
      m.ladder.visible=mode==='climb';m.floor.visible=mode!=='climb';
      if(mode==='walk')m.droid.update(time,'service',sampleDroidServicePose({walking:true,walkDistance:time*.58,age:3,duration:100,rest:0}));
      else if(mode==='climb'){
        const y=.75+time*.16;m.droid.update(time,'service',sampleDroidServicePose({y,climb:{from:0,to:6.784},age:10,duration:100,rest:0}));m.ladder.position.y=-y;
      }else m.droid.update(time,mode);
      m.droid.face.setExpression(expression);
    }
    dirty=true;
  }
  function ui(){
    document.body.dataset.layout=layout;$('play').textContent=playing?'一時停止':'再生';$('play').setAttribute('aria-pressed',String(playing));$('time').max=duration();$('time').value=time;$('time-output').textContent=time.toFixed(1)+' s';
    for(const [kind,value]of Object.entries({mode,view,style,expression,layout}))document.querySelectorAll('[data-'+kind+']').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset[kind]===value)));
  }
  for(const kind of ['mode','view','style','expression','layout'])document.querySelectorAll('[data-'+kind+']').forEach(button=>button.onclick=()=>{
    const value=button.dataset[kind];
    if(kind==='mode'){mode=value;time=0;if(mode==='wake'){playing=true;last=performance.now();}pose();}
    if(kind==='view'){view=value;setView();}
    if(kind==='style'){style=value;models.forEach(m=>m.toon.setStyle(style));}
    if(kind==='expression'){expression=value;pose();}
    if(kind==='layout')layout=value;
    dirty=true;ui();save();
  });
  $('play').onclick=()=>{if(!playing&&mode==='wake'&&time>=duration()){time=0;pose();}playing=!playing;last=performance.now();ui();save();};$('reset').onclick=()=>{time=0;pose();ui();save();};
  $('time').oninput=()=>{time=Number($('time').value);playing=false;pose();ui();save();};$('speed').onchange=()=>speed=Number($('speed').value);
  controls.addEventListener('change',()=>dirty=true);
  function resize(){const rect=canvas.getBoundingClientRect();width=Math.max(1,Math.floor(rect.width));height=Math.max(1,Math.floor(rect.height));renderer.setSize(width,height,false);dirty=true;}
  const observer=new ResizeObserver(resize);observer.observe(canvas);resize();setView();models.forEach(m=>m.toon.setStyle(style));pose();ui();$('loading').hidden=true;
  function render(){
    renderer.setScissorTest(true);const active=models.filter(m=>layout==='both'||m.detail===layout);
    active.forEach((m,i)=>{
      const x=Math.floor(width*i/active.length),right=Math.floor(width*(i+1)/active.length),w=right-x;
      camera.aspect=w/height;camera.updateProjectionMatrix();renderer.setViewport(x,0,w,height);renderer.setScissor(x,0,w,height);
      m.toon.update(w,height,2,10);renderer.render(m.scene,camera);
      // The floor or merged ladder contributes exactly one visible main draw.
      $(`${m.detail}-calls`).textContent='描画 '+Math.max(0,renderer.info.render.calls-1)+' 回 / フレーム';
    });
    renderer.setScissorTest(false);dirty=false;
  }
  function tick(now){
    frame=requestAnimationFrame(tick);const dt=Math.min((now-last)/1000,.05);last=now;if(document.hidden)return;
    if(playing){
      const next=time+dt*speed;
      // Startup is a single action: hold the lit pose instead of jumping back to sleep.
      if(mode==='wake'&&next>=duration()){time=duration();playing=false;save();}
      else time=next%duration();
      pose();hud+=dt;if(hud>.1||!playing){ui();hud=0;}
    }
    if(dirty)render();
  }
  frame=requestAnimationFrame(tick);
  window.addEventListener('pagehide',event=>{if(event.persisted)return;cancelAnimationFrame(frame);observer.disconnect();controls.dispose();for(const m of models){m.toon.dispose();m.droid.dispose();m.floor.geometry.dispose();m.floor.material.dispose();m.ladder.geometry.dispose();m.ladder.material.dispose();m.key.shadow.map?.dispose();}environment.dispose();renderer.dispose();});
}
try{init();}catch(error){console.error(error);$('loading').hidden=true;$('error').hidden=false;$('error').textContent='比較スタディを読み込めませんでした。'+error.message;}
