import {ObservationView} from './view.js';
import {ObservationXRQuality} from './xr-quality.js';
import {animateMilo} from './characters.js';
import {animateCabinLucy} from './lucy-cabin.js';

const $=id=>document.getElementById(id);
try{
  const view=await ObservationView.create($('scene')),quality=new ObservationXRQuality(view);
  // Separate the three subjects for repeatable, non-animated comparisons.
  view.milo.position.set(3,3.392,.78);view.cat.position.set(5,3.392,.78);
  view.droidService.actorRoot.position.set(6,0,.78);
  animateMilo(view.milo,{time:0,dt:1/60,moving:false,climbing:false,facing:1,action:null});
  animateCabinLucy(view.cat,{time:0,dt:1/60,moving:false,facing:1,mode:'idle'});
  $('focus').addEventListener('change',()=>view.setMode($('focus').value));
  let holdLighting=false;
  $('standby').addEventListener('click',()=>{
    holdLighting=true;view.startLighting();$('standby').setAttribute('aria-pressed','true');
  });
  $('startup').addEventListener('click',()=>{
    holdLighting=false;$('standby').setAttribute('aria-pressed','false');
    view.startLighting();if($('quality').value==='vr')quality.beginFrame(view.mode);
    try{view.renderer.compile(view.scene,view.camera);}finally{quality.endFrame();}
    previous=performance.now();
  });
  view.onModeChange=mode=>{if(mode!=='manual')$('focus').value=mode;};
  let previous=performance.now();
  view.renderer.setAnimationLoop(now=>{
    const dt=document.hidden?0:Math.max(0,(now-previous)/1000);previous=now;
    if(!holdLighting)view.startupLighting?.update(dt);
    if(view.mode==='milo')view.targetCenter.copy(view.milo.position).add({x:0,y:.95,z:0});
    if(view.mode==='cat')view.targetCenter.copy(view.cat.position).add({x:0,y:.4,z:0});
    if(view.mode==='droid')view.targetCenter.copy(view.droidService.actorRoot.position).add({x:0,y:.9,z:0});
    view.center.copy(view.targetCenter);view.viewHeight=view.targetHeight;view.setFrustum();
    view.characterToon.forEach(toon=>toon.update(view.width,view.height));
    view.cabinToon.update(view.width,view.height,view.viewHeight,view.fitHeight);
    if($('quality').value==='vr')quality.beginFrame(view.mode);
    try{view.renderer.render(view.scene,view.camera);}
    finally{quality.endFrame();}
    const {calls,triangles}=view.renderer.info.render;
    const text=`描画 ${calls.toLocaleString()} 回 / 三角形 ${triangles.toLocaleString()}`;
    if($('stats').textContent!==text)$('stats').textContent=text;
    $('startup').textContent=!holdLighting&&view.startupLighting&&!view.startupLighting.done?`照明 起動中 ${view.startupLighting.time.toFixed(1)}秒`:'照明の起動を再生';
  });
  document.addEventListener('visibilitychange',()=>{previous=performance.now();});
  window.addEventListener('pagehide',()=>{quality.dispose();view.dispose();},{once:true});
}catch(error){$('stats').textContent='読み込みエラー: '+error.message;console.error(error);}
