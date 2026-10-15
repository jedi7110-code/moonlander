import * as THREE from 'three';
import {createExteriorMothership,EXTERIOR} from './obs/exterior-mothership.js';
import {createExteriorOptics} from './obs/exterior-optics.js';
import {createDistantStars} from './obs/exterior-stars.js';
import {createExteriorPlanet} from './obs/exterior-planet.js';
import {sampleExteriorCinemaFrame,CINEMA_SHOTS,CINEMA_DISSOLVE_SECONDS} from './obs/exterior-cinematic.js';
import {createExteriorDissolve} from './obs/exterior-dissolve.js';
import {applyExteriorProbePose} from './obs/exterior-probe-flight.js';
import {createExteriorShadow} from './obs/exterior-shadow.js';
import {createExteriorGasPass} from './obs/exterior-gas-pass.js';
import {EXTERIOR_LOGO,LOGO_SETTLED} from './obs/exterior-logo.js';
const $=id=>document.getElementById(id),query=new URLSearchParams(location.search),opening=query.get('mode')==='opening',embedded=query.get('embedded')==='1';
const tell=action=>{if(embedded)parent.postMessage({type:'tara-exterior',action},location.origin);};
if(embedded)$('cabin').hidden=true;
$('scene-number').hidden=embedded;
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
  const ship=createExteriorMothership();ship.setCoreScale(Number(query.get('core'))||2.6);scene.add(ship.root);
  let gasPass=null;
  const optics=createExteriorOptics(ship),stars=createDistantStars();scene.add(stars.haze,stars.field,new THREE.HemisphereLight(0xc4d5e1,0x394b53,.68));
  const planet=createExteriorPlanet();scene.add(planet.body);
  const sun=new THREE.DirectionalLight(0xfff2d4,3.15),shadows=createExteriorShadow(sun,ship);
  const bounce=new THREE.DirectionalLight(0x8ca7bd,.65);scene.add(sun,bounce,sun.target,bounce.target);
  const camera=new THREE.PerspectiveCamera(38,1,.1,2400),target=new THREE.Vector3(),size=new THREE.Vector2();
  let time=Math.max(0,Number(query.get('time'))||0),running=query.get('paused')!=='1',last=0,frame=0,disposed=false;
  const freshOpening=opening&&time===0&&running;
  let probeReady=false,probeLoading=null,playingFrames=0,logoResolvedFrames=0,introFinishedFrames=0;
  const openingFrames={};
  const logoPlayback={maxFrameMs:0,skippedBands:0,frames:0,lastReveal:0};
  let logoMeasured=false;
  // A fresh opening waits just before the probe's first shot
  // if a very slow load hasn't finished, so it never appears midway through flight.
  const probeDeadline=CINEMA_SHOTS.slice(0,CINEMA_SHOTS.findIndex(shot=>shot.probeStage==='approach'))
    .reduce((seconds,shot)=>seconds+shot.duration,0)-CINEMA_DISSOLVE_SECONDS/2;
  async function prepareProbe(){
    if(probeLoading)return probeLoading;
    document.documentElement.dataset.probeLoadStartedMs=performance.now().toFixed(1);
    return probeLoading=(async()=>{
      await ship.prepareProbe();if(disposed)return;
      ship.dockedLander.visible=false;
      gasPass=createExteriorGasPass(renderer,ship.probeThrusters.gas);
      await renderer.compileAsync(scene,camera);if(disposed)return;
      probeReady=true;document.documentElement.dataset.probeReadyMs=performance.now().toFixed(1);
    })();
  }
  if(!freshOpening)document.body.classList.remove('waiting-for-film');
  const options={opening,coreScale:ship.coreScale,phase:(query.has('phase')?Number(query.get('phase')):55)*Math.PI/180,
    rpm:query.has('rpm')?Number(query.get('rpm')):EXTERIOR.rpm,penultimate:query.get('penultimate'),approach:query.get('approach'),ending:query.get('ending'),docking:query.get('docking'),openingCamera:query.get('openingCamera'),transition:query.get('transition'),revision:query.get('revision')};
  const identity=document.querySelector('.identity'),logoReveal=identity.querySelector('.logo-reveal');
  function drawView(shot,renderTarget,gasTarget){
    ship.root.position.x=shot.shipX;ship.root.visible=shot.shipVisible;ship.setAngle(shot.angle);camera.position.fromArray(shot.eye);target.fromArray(shot.target);
    applyExteriorProbePose(ship,shot.probe);
    // Restore per view, including both dissolve layers. Default scene 07
    // hides the rotating habitats, trusses and connecting ring together.
    ship.rotor.visible=shot.rotorVisible!==false;
    for(const pod of ship.pods)pod.visible=shot.habitatsVisible;
    camera.fov=shot.fov;camera.near=shot.near;camera.far=shot.far;camera.up.fromArray(shot.up);camera.updateProjectionMatrix();camera.lookAt(target);
    planet.show(shot.planet?.position);
    shadows.update(shot);bounce.position.set(shot.shipX-38,-15,-30);bounce.target.position.set(shot.shipX,0,0);
    stars.follow(camera);renderer.getDrawingBufferSize(size);optics.update(camera,size,shot.optics);
    if(gasPass)return gasPass.render(scene,camera,renderTarget,gasTarget);
    renderer.render(scene,camera);return false;
  }
  function draw(){
    const film=sampleExteriorCinemaFrame(time,{...options,aspect:camera.aspect}),shot=film.shot;
    dissolve.render(film,drawView);
    identity.style.opacity=String(shot.titleOpacity*.88);
    // The first dial-up band starts after 120ms. Keep the glow hidden until
    // that band exists, and sample every band from the film's own clock.
    logoReveal.style.visibility=shot.logoReveal>0?'visible':'hidden';
    logoReveal.style.clipPath=shot.logoClip;
    if(freshOpening&&!logoMeasured){
      const difference=Math.round((shot.logoReveal-logoPlayback.lastReveal)*EXTERIOR_LOGO.steps);
      logoPlayback.skippedBands+=Math.max(0,difference-1);logoPlayback.lastReveal=shot.logoReveal;
      if(time>=EXTERIOR_LOGO.end){
        logoMeasured=true;document.documentElement.dataset.logoPlayback=JSON.stringify(logoPlayback);
      }
    }
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
    running=next;last=performance.now();$('play').textContent=next?'一時停止':'再開';$('play').setAttribute('aria-pressed',String(next));
    const current=new URLSearchParams(location.search);current.set('time',time.toFixed(3));
    if(next)current.delete('paused');else current.set('paused','1');history.replaceState(null,'',`?${current}`);
  }
  $('play').onclick=()=>play(!running);$('restart').onclick=()=>{time=0;play(true);};play(running);
  $('timeline').oninput=()=>{time=Number($('timeline').value);play(false);};
  // Keep the lightweight sky over the renderer until the first real frames settle.
  // A seek into the probe shots needs the complete model before its first draw.
  // A fresh opening starts with only the mother ship and the decoded logo.
  if(!freshOpening)await prepareProbe();
  draw();ship.root.visible=true;
  await Promise.all([renderer.compileAsync(scene,camera),document.querySelector('.logo-image').decode()]);
  document.documentElement.dataset.shipReadyMs=performance.now().toFixed(1);
  if(freshOpening)await new Promise(resolve=>{
    let previous=0,steady=0;const start=performance.now();
    function warm(now){
      draw();steady=previous&&now-previous<=50?steady+1:0;previous=now;
      if((now-start>=550&&steady>=4)||now-start>=3000)resolve();
      else requestAnimationFrame(warm);
    }
    requestAnimationFrame(warm);
  });
  else if(time===0&&running)time=(performance.now()-Number(document.documentElement.dataset.spaceStartedMs||0))/1000;
  draw();
  $('space-boot').hidden=true;$('status').hidden=true;$('cinema-controls').hidden=embedded&&opening;tell('ready');
  if(freshOpening)await new Promise(resolve=>requestAnimationFrame(resolve));
  document.body.classList.remove('waiting-for-film');last=performance.now();
  function tick(now){
    if(disposed)return;frame=requestAnimationFrame(tick);
    if(document.hidden){last=0;return;}
    if(running&&last){
      const dt=Math.max(0,(now-last)/1000);
      if(freshOpening&&time<EXTERIOR_LOGO.end&&time+dt>=EXTERIOR_LOGO.start){
        logoPlayback.maxFrameMs=Math.max(logoPlayback.maxFrameMs,Math.round(dt*10000)/10);logoPlayback.frames++;
      }
      if(freshOpening&&time<38){
        const second=Math.floor(time),bucket=openingFrames[second]??={frames:0,maxFrameMs:0,slowFrames:0};
        bucket.frames++;bucket.maxFrameMs=Math.max(bucket.maxFrameMs,Math.round(dt*10000)/10);
        if(dt>.05)bucket.slowFrames++;
        document.documentElement.dataset.openingFrames=JSON.stringify(openingFrames);
      }
      time+=dt;
      if(!probeReady)time=Math.min(time,probeDeadline);
    }last=now;
    draw();
    if(running&&++playingFrames===2){
      document.documentElement.dataset.filmStartedMs=performance.now().toFixed(1);tell('playing');
    }
    // Let the ten-band reveal finish and reach the screen before beginning
    // paced cabin assembly during the logo hold. Probe setup starts later.
    if(running&&freshOpening&&time>=LOGO_SETTLED&&++logoResolvedFrames===2){
      document.documentElement.dataset.logoResolvedMs=performance.now().toFixed(1);tell('logo-resolved');
    }
    // Present two frames with the logo fully faded before releasing expensive
    // CPU/GPU preparation. The network preloads already run in the parent.
    if(running&&freshOpening&&time>=EXTERIOR_LOGO.end&&++introFinishedFrames===2){
      document.documentElement.dataset.introFinishedMs=performance.now().toFixed(1);tell('intro-finished');
      void prepareProbe().catch(error=>{
        if(disposed)return;console.error(error);play(false);
        $('status').hidden=false;$('status').textContent='探査機の準備に失敗しました。再読み込みしてください。';
      });
    }
  }
  frame=requestAnimationFrame(tick);
  const visibility=()=>{last=performance.now();};document.addEventListener('visibilitychange',visibility);
  cleanup=()=>{disposed=true;cancelAnimationFrame(frame);document.removeEventListener('visibilitychange',visibility);resize.disconnect();dissolve.dispose();optics.dispose();stars.dispose();planet.dispose();ship.dispose();renderer.dispose();renderer.forceContextLoss();};
  $('exterior-view').addEventListener('webglcontextlost',event=>{if(disposed)return;event.preventDefault();play(false);$('status').hidden=false;$('status').textContent='映像接続が中断されました。船内へ戻って再度お試しください。';});
}catch(error){console.error(error);tell('failed');$('status').hidden=false;$('cinema-controls').hidden=false;$('status').textContent='船体映像を開けませんでした。船内へ戻って再度お試しください。';}
window.addEventListener('pagehide',event=>{if(!event.persisted)cleanup();});
