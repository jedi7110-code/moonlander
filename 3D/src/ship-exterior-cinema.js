import * as THREE from 'three';
import {createExteriorShip,EXTERIOR} from './obs/ship-exterior.js';
import {createExteriorOptics} from './obs/exterior-optics.js';
import {createDistantStars} from './obs/exterior-stars.js';
import {createExteriorPlanet} from './obs/exterior-planet.js';
import {sampleExteriorCinemaFrame} from './obs/exterior-cinematic.js';
import {createExteriorDissolve} from './obs/exterior-dissolve.js';
import {applyExteriorProbePose} from './obs/exterior-probe-flight.js';
const $=id=>document.getElementById(id),query=new URLSearchParams(location.search),opening=query.get('mode')==='opening',embedded=query.get('embedded')==='1';
const tell=action=>{if(embedded)parent.postMessage({type:'tara-exterior',action},location.origin);};
if(embedded)$('cabin').hidden=true;
document.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();tell('exit');}});
let cleanup=()=>{};
// The inline lightweight sky must reach the screen before model construction.
await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
try{
  const scene=new THREE.Scene();scene.background=new THREE.Color('#030609');
  const renderer=new THREE.WebGLRenderer({canvas:$('exterior-view'),antialias:true,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.6));renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.18;
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  const dissolve=createExteriorDissolve(renderer);
  const ship=createExteriorShip();ship.setCoreScale(Number(query.get('core'))||2.6);scene.add(ship.root);
  const optics=createExteriorOptics(ship),stars=createDistantStars();scene.add(stars.haze,stars.field,new THREE.HemisphereLight(0xc4d5e1,0x394b53,.68));
  const planet=createExteriorPlanet();scene.add(planet.body);
  const sun=new THREE.DirectionalLight(0xfff2d4,3.15);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);
  Object.assign(sun.shadow.camera,{left:-80,right:80,top:80,bottom:-80,near:1,far:320});sun.shadow.bias=-.00012;sun.shadow.normalBias=.05;
  const bounce=new THREE.DirectionalLight(0x8ca7bd,.65);scene.add(sun,bounce,sun.target,bounce.target);
  const camera=new THREE.PerspectiveCamera(38,1,.1,2400),target=new THREE.Vector3(),size=new THREE.Vector2();
  let time=Math.max(0,Number(query.get('time'))||0),running=query.get('paused')!=='1',last=0,frame=0,disposed=false;
  const options={opening,coreScale:ship.coreScale,phase:(query.has('phase')?Number(query.get('phase')):55)*Math.PI/180,rpm:query.has('rpm')?Number(query.get('rpm')):EXTERIOR.rpm};
  const identity=document.querySelector('.identity'),logoReveal=identity.querySelector('.logo-reveal'),logoImage=identity.querySelector('.logo-image');
  let logoAnimations=[];
  // Native CSS animations keep the logo moving while the cabin's JavaScript
  // builds its models. Pause/restart/seek set the same clock deterministically.
  function syncLogo(){for(const animation of logoAnimations){
    animation.pause();animation.currentTime=time*1000;
    if(running&&!document.hidden&&time*1000<animation.effect.getComputedTiming().endTime)animation.play();
  }}
  function drawView(shot){
    ship.root.position.x=shot.shipX;ship.root.visible=shot.shipVisible;ship.setAngle(shot.angle);camera.position.fromArray(shot.eye);target.fromArray(shot.target);
    applyExteriorProbePose(ship,shot.probe);
    // Set this for every view, so the other dissolve layer and later shots
    // restore the habitats without retaining scene 07's visibility state.
    for(const pod of ship.pods)pod.visible=shot.habitatsVisible;
    camera.fov=shot.fov;camera.near=shot.near;camera.far=shot.far;camera.up.fromArray(shot.up);camera.updateProjectionMatrix();camera.lookAt(target);
    planet.show(shot.planet?.position);
    sun.position.set(shot.shipX+64,-110,92);bounce.position.set(shot.shipX-38,-15,-30);sun.target.position.set(shot.shipX,0,0);bounce.target.position.set(shot.shipX,0,0);
    stars.follow(camera);renderer.getDrawingBufferSize(size);optics.update(camera,size.x);renderer.render(scene,camera);
  }
  function draw(){
    const film=sampleExteriorCinemaFrame(time,{...options,aspect:camera.aspect}),shot=film.shot;
    dissolve.render(film,drawView);
    $('cut').style.opacity=String(shot.fade);
    const number=shot=>String(shot.number).padStart(2,'0');
    $('scene-number').textContent=film.to?`SCENE ${number(film.from)} → ${number(film.to)}`:`SCENE ${number(shot)}`;
    $('time').textContent=shot.cruising?`航行中 ${shot.time.toFixed(1)} 秒`:`${shot.time.toFixed(1)} / ${shot.duration.toFixed(0)} 秒`;
    $('timeline').max=Math.max(shot.duration,shot.time);$('timeline').value=shot.time;
    return shot;
  }
  const resize=new ResizeObserver(()=>{const r=$('exterior-view').getBoundingClientRect();renderer.setSize(Math.max(1,r.width),Math.max(1,r.height),false);camera.aspect=r.width/Math.max(1,r.height);camera.updateProjectionMatrix();});resize.observe($('exterior-view'));
  const rect=$('exterior-view').getBoundingClientRect();renderer.setSize(rect.width,rect.height,false);camera.aspect=rect.width/rect.height;
  function play(next){
    running=next;last=performance.now();syncLogo();$('play').textContent=next?'一時停止':'再開';$('play').setAttribute('aria-pressed',String(next));
    const current=new URLSearchParams(location.search);current.set('time',time.toFixed(3));
    if(next)current.delete('paused');else current.set('paused','1');history.replaceState(null,'',`?${current}`);
  }
  $('play').onclick=()=>play(!running);$('restart').onclick=()=>{time=0;play(true);};play(running);
  $('timeline').oninput=()=>{time=Number($('timeline').value);play(false);};
  // Compile even while the ship is off-screen beneath the introductory logo.
  draw();ship.root.visible=true;await renderer.compileAsync(scene,camera);
  document.documentElement.dataset.shipReadyMs=performance.now().toFixed(1);
  // Use the actual elapsed loading time: a slow load must never restart the logo.
  if(time===0&&query.get('paused')!=='1')time=(performance.now()-Number(document.documentElement.dataset.spaceStartedMs||0))/1000;
  for(const element of [identity,logoReveal,logoImage]){
    element.style.animationDelay='';element.style.animationPlayState='';logoAnimations.push(...element.getAnimations());
  }
  syncLogo();last=performance.now();draw();
  $('space-boot').hidden=true;$('status').hidden=true;$('cinema-controls').hidden=embedded&&opening;tell('ready');
  function tick(now){
    if(disposed)return;frame=requestAnimationFrame(tick);
    if(document.hidden){last=0;return;}
    if(running&&last)time+=Math.max(0,(now-last)/1000);last=now;
    draw();
  }
  frame=requestAnimationFrame(tick);
  const visibility=()=>{syncLogo();last=performance.now();};document.addEventListener('visibilitychange',visibility);
  cleanup=()=>{disposed=true;cancelAnimationFrame(frame);document.removeEventListener('visibilitychange',visibility);resize.disconnect();dissolve.dispose();optics.dispose();stars.dispose();planet.dispose();ship.dispose();renderer.dispose();renderer.forceContextLoss();};
  $('exterior-view').addEventListener('webglcontextlost',event=>{if(disposed)return;event.preventDefault();play(false);$('status').hidden=false;$('status').textContent='映像接続が中断されました。船内へ戻って再度お試しください。';});
}catch(error){console.error(error);$('status').hidden=false;$('cinema-controls').hidden=false;$('status').textContent='船体映像を開けませんでした。船内へ戻って再度お試しください。';}
window.addEventListener('pagehide',event=>{if(!event.persisted)cleanup();});
