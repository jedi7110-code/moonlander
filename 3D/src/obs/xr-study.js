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
  view.onModeChange=mode=>{if(mode!=='manual')$('focus').value=mode;};
  view.renderer.setAnimationLoop(()=>{
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
  });
  window.addEventListener('pagehide',()=>{quality.dispose();view.dispose();},{once:true});
}catch(error){$('stats').textContent='読み込みエラー: '+error.message;console.error(error);}
