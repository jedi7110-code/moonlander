import * as THREE from 'three';
import {ObservationView} from './obs/view.js';
import {animateMilo} from './obs/characters.js';
import {SmokingVisit,SMOKING_SECONDS} from './obs/smoking-visit.js';
import {ASHTRAY} from './obs/layout.js';
import {FLOOR_Y} from './obs/ship.js';
const view=await ObservationView.create(document.querySelector('canvas'));view.observer.disconnect();
view.cat.visible=false;view.droidService.root.visible=false;view.ship.medical.rig.root.visible=false;
for(const {group}of Object.values(view.ship.indicators))group.visible=false;
const slider=document.getElementById('time'),status=document.getElementById('status'),play=document.getElementById('play');slider.max=SMOKING_SECONDS;
document.getElementById('camera').value='hands';
let visit=new SmokingVisit(),elapsed=0,running=false,last=performance.now();
function pose(dt){
  view.milo.position.set(ASHTRAY.x+ASHTRAY.standOffsetX,FLOOR_Y[1],.78);
  animateMilo(view.milo,{moving:false,climbing:false,facing:-1,action:'smoking',time:elapsed,dt,smokingVisit:visit});
}
function seek(time){
  visit=new SmokingVisit();visit.startYaw=-Math.PI/2;elapsed=0;
  for(const p of view.milo.userData.smokingProps.particles){p.age=Infinity;p.sprite.visible=false;}
  view.milo.userData.smokingProps.emission=0;
  while(elapsed<time){const dt=Math.min(1/30,time-elapsed);elapsed+=dt;visit.update(dt);pose(dt);}
  slider.value=elapsed;pose(0);
}
function setRunning(value){running=value;play.textContent=running?'一時停止':'再生';last=performance.now();}
play.onclick=()=>setRunning(!running);document.getElementById('restart').onclick=()=>{seek(0);setRunning(true);};
slider.oninput=()=>{setRunning(false);seek(Number(slider.value));};
document.querySelectorAll('[data-time]').forEach(button=>button.onclick=()=>{setRunning(false);seek(Number(button.dataset.time));});
document.getElementById('leave').onclick=()=>{visit.requestExit();setRunning(true);};
function frame(now){
  const dt=Math.min(.05,(now-last)/1000);last=now;
  if(running&&!visit.done){visit.update(dt);elapsed+=dt;slider.value=elapsed;}
  pose(running?dt:0);if(visit.done)setRunning(false);
  const width=innerWidth,height=document.querySelector('canvas').clientHeight,y=FLOOR_Y[1],camera=view.camera;
  if(document.getElementById('camera').value==='hands'){camera.position.set(-12.58,y+1.86,-.15);camera.lookAt(-11.80,y+1.40,-.66);camera.fov=58;}
  else{camera.position.set(-12.2,y+2.14,3.1);camera.lookAt(-11.35,y+1.1,-.5);camera.fov=42;}
  camera.aspect=width/height;camera.near=.025;camera.updateProjectionMatrix();view.renderer.setSize(width,height,false);
  view.characterToon.forEach(toon=>toon.update(width,height));view.cabinToon.update(width,height,3.1,15);view.renderer.render(view.scene,camera);
  status.value=`${elapsed.toFixed(1)}秒 ／ ${visit.pose.gesture?.label??(visit.done?'一服を終える':visit.pose.moving?'歩く':'向きを変える')}`;
  requestAnimationFrame(frame);
}
seek(15.8);requestAnimationFrame(frame);
