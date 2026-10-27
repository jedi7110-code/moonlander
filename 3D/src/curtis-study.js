import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {materials} from './obs/materials.js';
import {buildShipInBackground} from './obs/ship.js?v=print08';
import {CurtisRoutine} from './obs/curtis-routine.js?v=coffee14';
import {CurtisView} from './obs/curtis-view.js?v=render08';
import {createCurtis} from './obs/curtis-model.js?v=print11';
import {createMiloToonSteps} from './obs/milo-toon.js';
import {runPreparationSteps} from './obs/background-preparation.js';
import {createMetalDeckStyle} from './obs/metal-deck.js';
import {finishCabinFixtures} from './obs/cabin-fixtures.js';
import {createCabinSignage} from './obs/cabin-signage.js';
import {createCabinToon} from './obs/cabin-toon.js';
import {CabinAudio} from './obs/audio.js';
import {CabinSoundEvents} from './obs/sound-events.js';
import {CABIN_SOUNDS} from './obs/sound-library.js';

const $=id=>document.getElementById(id),status=$('status');
const audio=new CabinAudio({ambience:false,library:Object.fromEntries(Object.entries(CABIN_SOUNDS).filter(([id])=>/^(step[123]|ladderStep[123]|coffeeMachine)$/.test(id)))});
const sounds=new CabinSoundEvents(audio);
try{
  const canvas=document.querySelector('canvas'),scene=new THREE.Scene();scene.background=new THREE.Color('#141c20');
  const renderer=new THREE.WebGLRenderer({canvas,antialias:true});
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.localClippingEnabled=true;
  renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.15;
  const camera=new THREE.PerspectiveCamera(38,1,.05,180),controls=new OrbitControls(camera,canvas);
  controls.minDistance=1.3;controls.maxDistance=65;controls.screenSpacePanning=true;
  const room=new RoomEnvironment(),pmrem=new THREE.PMREMGenerator(renderer),env=pmrem.fromScene(room,.06);
  scene.environment=env.texture;room.dispose();pmrem.dispose();
  scene.add(new THREE.HemisphereLight(0xe4edf2,0x62645b,2));
  const key=new THREE.DirectionalLight(0xffefd9,3);key.position.set(-4,16,12);scene.add(key);
  const fill=new THREE.DirectionalLight(0xccdef5,1.5);fill.position.set(5,9,-8);scene.add(fill);
  const deckStyle=createMetalDeckStyle();
  const ship=await buildShipInBackground(await materials(),{floorBuilder:deckStyle.buildFloor});scene.add(ship.staticMesh,ship.animated);
  // Study lighting is fixed; hundreds of local cabin lights would make close-up playback slow.
  for(const root of [ship.staticMesh,ship.animated])root.traverse(object=>{if(object.isLight)object.visible=false;});
  const view={scene,renderer,camera,ship,width:1,height:1};
  status.textContent='カーティスを読み込み中…';
  // Standalone playback does not need the live cabin's per-mesh background warmup.
  const visitor=new CurtisView(await createCurtis(),view);
  visitor.toon=await runPreparationSteps(createMiloToonSteps(visitor.root));scene.add(visitor.root);
  visitor.prepareLadderPose();
  finishCabinFixtures({...view,milo:visitor.root});
  const cabinRoots=[ship.staticMesh,ship.animated];
  const signage=await createCabinSignage(cabinRoots);
  const cabinToon=createCabinToon(cabinRoots);cabinToon.setStyle('cartoon');
  const source=new CurtisRoutine({random:()=>.25});source.beginVisit();
  const all=structuredClone(source.steps);
  let routine,steps,total=0,elapsed=0,playing=true,last=performance.now(),lastFocus=null;
  function focus(){return visitor.root.position.clone().add(new THREE.Vector3(0,1,0));}
  function frameView(name='front'){
    const target=focus();
    const offsets={front:[2,1.4,7],side:[7,1.2,.3],back:[1,1.3,-6],wide:[16,11,30]};
    if(name==='wide')target.set(0,6,0);
    controls.target.copy(target);camera.position.copy(target).add(new THREE.Vector3(...offsets[name]));controls.update();
    lastFocus=focus();$('follow').checked=name!=='wide';
  }
  function reset(){
    audio.stopAll();
    routine?.dispose();routine=new CurtisRoutine({random:()=>.25});routine.ready=true;routine.active=true;
    routine.steps=structuredClone(steps);routine.position={...steps[0].from};routine.yaw=Math.PI/2;
    routine.time=0;elapsed=0;
    const kind=steps[0].kind,yaw=['relax','stand'].includes(kind)?.15:['coffee','work','window','climb'].includes(kind)?Math.PI:Math.PI/2;
    visitor.root.rotation.set(0,yaw,0);
    visitor.render(routine,1/60);lastFocus=focus();
  }
  function choose(){
    const name=$('action').value;
    if(name==='ladderCoffee'){
      const route=new CurtisRoutine({random:()=>.25});
      route.climbTo(1,{enter:true});route.coffee();
      steps=structuredClone(route.steps);
    }else if(name==='visit')steps=all;
    else{
      const match=all.find(s=>name==='leave'?s.leave:s.kind===name);
      steps=[match];
      if(name==='sit'){
        const end=all.indexOf(match);let start=end;
        while(start>0&&all[start-1].kind==='walk')start--;
        steps=all.slice(start,end+1);
      }
    }
    total=steps.reduce((sum,s)=>sum+s.duration,0);$('timeline').max=total;
    reset();frameView();playing=true;updateUI();
  }
  function advance(seconds,withSound=true){
    // Fixed small steps preserve the same transfers and pose blending as OBS.
    while(seconds>1e-7&&elapsed<total-1e-7){
      const dt=Math.min(1/60,seconds,total-elapsed,routine.step.duration-routine.age);
      // Retain the final visible pose instead of hiding it when the visit ends.
      if(total-elapsed<=dt+1e-7){routine.age+=dt;routine.time+=dt;routine.position={...routine.step.to};visitor.render(routine,dt);if(withSound){sounds.curtisFootfalls(dt,routine);sounds.curtisCoffee(dt,routine);}elapsed=total;break;}
      routine.update(dt);visitor.render(routine,dt);elapsed+=dt;seconds-=dt;
      if(withSound){sounds.curtisFootfalls(dt,routine);sounds.curtisCoffee(dt,routine);}
    }
  }
  function updateUI(){
    $('timeline').value=elapsed;$('elapsed').textContent=`${elapsed.toFixed(1)} / ${total.toFixed(1)} 秒`;
    $('play').textContent=playing?'一時停止':'再生';
  }
  function resize(){const rect=canvas.getBoundingClientRect();view.width=Math.max(1,rect.width);view.height=Math.max(1,rect.height);renderer.setSize(view.width,view.height,false);camera.aspect=view.width/view.height;camera.updateProjectionMatrix();}
  const observer=new ResizeObserver(resize);observer.observe(canvas);resize();
  $('action').addEventListener('change',()=>{choose();audio.pause(false);audio.unlock();});
  $('play').onclick=()=>{if(elapsed>=total)reset();playing=!playing;audio.pause(!playing);if(playing)audio.unlock();updateUI();};
  $('restart').onclick=()=>{reset();frameView();updateUI();};
  $('frame').onclick=()=>{playing=false;audio.pause(true);advance(1/60,false);updateUI();};
  $('timeline').oninput=()=>{playing=false;audio.pause(true);const target=Number($('timeline').value);reset();advance(target,false);frameView();updateUI();};
  $('sound').onclick=async()=>{await audio.toggle();audio.pause(!playing);if(playing)audio.unlock();$('sound').textContent=audio.enabled?'音声オフ':'音声オン';$('sound').setAttribute('aria-pressed',String(audio.enabled));};
  document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>frameView(b.dataset.view));
  for(const id of ['action','play','restart','frame','timeline'])$(id).disabled=false;
  $('action').value='ladderCoffee';choose();status.hidden=true;
  renderer.setAnimationLoop(now=>{
    const dt=Math.min((now-last)/1000,.08);last=now;
    audio.pause(document.hidden||!playing||Number($('speed').value)!==1);
    if(!document.hidden&&playing){if(elapsed>=total){if($('loop').checked)reset();else playing=false;}advance(dt*Number($('speed').value));}
    const current=focus();if($('follow').checked&&lastFocus){const delta=current.clone().sub(lastFocus);camera.position.add(delta);controls.target.add(delta);}lastFocus=current;
    controls.update();updateUI();
    audio.setViewListener(camera,{center:controls.target},true);
    const visibleHeight=2*camera.position.distanceTo(controls.target)*Math.tan(THREE.MathUtils.degToRad(camera.fov/2));
    cabinToon.update(view.width,view.height,visibleHeight,15);
    renderer.render(scene,camera);
  });
  document.addEventListener('visibilitychange',()=>audio.pause(document.hidden||!playing));
  window.addEventListener('pagehide',()=>{audio.dispose();renderer.setAnimationLoop(null);observer.disconnect();controls.dispose();routine.dispose();visitor.dispose();cabinToon.dispose();signage?.dispose?.();env.dispose();renderer.dispose();},{once:true});
}catch(error){status.hidden=false;status.textContent=`読み込みに失敗しました: ${error.message}`;console.error(error);}
