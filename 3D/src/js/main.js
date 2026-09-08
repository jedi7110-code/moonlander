import {MoonScene,terrainHeight} from './scene.js';
import {MoonGame} from './game.js';
import {HUD} from './hud.js';
import {AudioBus} from './audio.js';
import {registerGameTools} from './webmcp.js';

const coarse=matchMedia('(pointer:coarse)').matches;
let view,game,audio,ui,els,paused=false,helpPaused=false,pauseBeforeHelp=false,last=performance.now(),time=0,hudTime=0,lastStep=0,interactPulse=false;
const keys=new Set(),touch={x:0,z:0,fire:false,jump:false},mouse={fire:false,orbit:false,x:0,y:0,active:false,dragX:0,dragY:0};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function clearInput(){keys.clear();touch.x=touch.z=0;touch.fire=touch.jump=false;mouse.fire=mouse.orbit=false;interactPulse=false;game?.cancelInput();if(els)els.joystick.firstElementChild.style.transform='';}
function setPaused(value){
  if(!game||['title','complete','failed'].includes(game.state.phase))return;
  paused=value;clearInput();audio.setPaused(value);ui.show('pause-screen',value);els.pause.setAttribute('aria-label',value?'再開':'一時停止');
  if(value)els.resume.focus();else els.world.focus({preventScroll:true});
}
function startMission(round=1){
  audio.unlock();audio.stop();audio.setPaused(false);paused=false;helpPaused=false;clearInput();
  view.configure(game.start(round));mouse.active=false;ui.show('start-screen',false);ui.show('result-screen',false);ui.show('pause-screen',false);ui.show('hud',true);ui.show('touch-controls',coarse);
  els.pause.disabled=false;els.world.focus({preventScroll:true});hudTime=0;lastStep=0;handleEvents();ui.update(game.state,paused);
}
function title(){audio.stop();paused=false;clearInput();view.configure(game.reset(1));view.pad.position.set(0,0,0);ui.show('start-screen',true);ui.show('hud',false);ui.show('result-screen',false);ui.show('pause-screen',false);ui.show('touch-controls',false);els.pause.disabled=true;els.start.focus();}
function openGuide(){pauseBeforeHelp=paused;helpPaused=!['title','complete','failed'].includes(game.state.phase);if(helpPaused&&!paused)setPaused(true);ui.show('pause-screen',false);els.guide.showModal();}
function getInput(){
  const x=(keys.has('KeyD')||keys.has('ArrowRight')?1:0)-(keys.has('KeyA')||keys.has('ArrowLeft')?1:0)+touch.x;
  const z=(keys.has('KeyS')||keys.has('ArrowDown')?1:0)-(keys.has('KeyW')||keys.has('ArrowUp')?1:0)+touch.z;
  const yaw=view.cameraYaw;
  return{x:x*Math.cos(yaw)+z*Math.sin(yaw),z:-x*Math.sin(yaw)+z*Math.cos(yaw),rawZ:z,fire:keys.has('Space')||mouse.fire||touch.fire,jump:keys.has('ShiftLeft')||keys.has('ShiftRight')||touch.jump,interact:keys.has('KeyE')||interactPulse,aim:mouse.active&&!coarse?view.aim(mouse.x,mouse.y):null};
}
function handleEvents(){
  for(const event of game.drainEvents()){
    const s=game.state;
    if(event.type==='landed'){audio.play('landing',.6);audio.play('hatch',.3);ui.notify('TOUCHDOWN · 軟着陸成功');view.burst(s.ship.x,.3,s.ship.z,0xb8bdb2,100,2,5);}
    if(event.type==='surface')ui.notify('探査車のビーコンを追って、生存者を捜索せよ。',5);
    if(event.type==='rescue'){audio.play('rescue',.65);ui.notify(`${event.count}名の生存者を発見。全員を船へ連れ帰れ。`,5);}
    if(event.type==='boarded'){audio.play('hatch',.2);ui.notify(event.count===event.total?'全員の乗船を確認。船へ戻り E で脱出。':`CREW ${String(event.count).padStart(2,'0')} / ${event.total} · 乗船完了`,4);}
    if(event.type==='boss')ui.notify('警告：大型の生体反応が接近中。',4);
    if(event.type==='monolith')ui.notify('黒筐に接触。ビームエネルギーが回復した。',4);
    if(event.type==='hit'){audio.play('hit',.15);view.burst(event.x,event.y,event.z,0x8dc999,event.boss?40:22,.55,4);}
    if(event.type==='fire'){audio.play('beam',event.charged?.45:.22);audio.stopLoop('charge');}
    if(event.type==='emerge')view.burst(event.x,event.y+.15,event.z,0xaeb2a8,event.boss?55:25,1.6,3.5);
    if(event.type==='failure'){audio.stop();audio.play('explosion',.4);if(event.kind==='ship')view.burst(s.ship.x,s.ship.y+2,s.ship.z,0xffba6e,160,2.3,8);ui.result(s);}
    if(event.type==='launch'){ui.notify('全員の乗船を確認。軌道へ上昇中。',6);audio.stopLoop('charge');}
    if(event.type==='complete'){audio.stop();audio.play('landing',.4);ui.result(s);}
  }
}
function updateSoundButton(){els.sound.querySelector('span').textContent=audio.muted?'OFF':'ON';els.sound.setAttribute('aria-label',audio.muted?'音をオンにする':'音をオフにする');}
function setupInput(){
  const controlCodes=['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space','ShiftLeft','ShiftRight','KeyE'];
  window.addEventListener('keydown',e=>{
    if(els.guide.open){if(e.code==='Escape'){e.preventDefault();els.guide.close();}return;}
    if(e.repeat&&['Escape','KeyC','Enter','Slash'].includes(e.code))return;
    if(e.code==='Slash'&&e.shiftKey){e.preventDefault();openGuide();return;}
    if(e.code==='Escape'){e.preventDefault();setPaused(!paused);return;}
    if(e.code==='KeyC'){view.cameraMode=(view.cameraMode+1)%2;ui.notify(view.cameraMode?'俯瞰視点':'追従視点',2);return;}
    if(e.code==='Enter'&&game.state.phase==='title'){e.preventDefault();startMission();return;}
    if(controlCodes.includes(e.code)&&!['title','failed','complete'].includes(game.state.phase)&&!paused){e.preventDefault();keys.add(e.code);}
  });
  window.addEventListener('keyup',e=>keys.delete(e.code));
  window.addEventListener('blur',()=>{if(!els.guide.open)setPaused(true);clearInput();});
  document.addEventListener('visibilitychange',()=>{if(document.hidden){setPaused(true);clearInput();}});
  els.world.addEventListener('contextmenu',e=>e.preventDefault());
  els.world.addEventListener('pointerdown',e=>{
    if(game.state.phase==='title'||paused)return;audio.unlock();els.world.focus({preventScroll:true});
    if(e.button===2||e.pointerType==='touch'){mouse.orbit=true;mouse.dragX=e.clientX;mouse.dragY=e.clientY;}
    else if(e.button===0){mouse.fire=true;mouse.active=true;mouse.x=e.clientX;mouse.y=e.clientY;}
    els.world.setPointerCapture(e.pointerId);
  });
  els.world.addEventListener('pointermove',e=>{
    if(mouse.orbit){view.cameraYaw-=(e.clientX-mouse.dragX)*.006;view.cameraPitch=clamp(view.cameraPitch+(e.clientY-mouse.dragY)*.005,.18,1.05);mouse.dragX=e.clientX;mouse.dragY=e.clientY;}
    else if(e.pointerType==='mouse'){mouse.x=e.clientX;mouse.y=e.clientY;mouse.active=true;}
  });
  const releaseMouse=()=>{mouse.fire=false;mouse.orbit=false;};for(const ev of ['pointerup','pointercancel','lostpointercapture'])els.world.addEventListener(ev,releaseMouse);
  let stickPointer=null,origin={x:0,y:0};
  els.joystick.addEventListener('pointerdown',e=>{if(stickPointer!==null)return;audio.unlock();stickPointer=e.pointerId;const r=els.joystick.getBoundingClientRect();origin={x:r.x+r.width/2,y:r.y+r.height/2};els.joystick.setPointerCapture(e.pointerId);moveStick(e);});
  function moveStick(e){if(e.pointerId!==stickPointer)return;let dx=e.clientX-origin.x,dy=e.clientY-origin.y;const d=Math.hypot(dx,dy),radius=34;if(d>radius){dx*=radius/d;dy*=radius/d;}touch.x=dx/radius;touch.z=dy/radius;els.joystick.firstElementChild.style.transform=`translate(${dx}px,${dy}px)`;}
  els.joystick.addEventListener('pointermove',moveStick);const releaseStick=e=>{if(e.pointerId!==stickPointer)return;stickPointer=null;touch.x=touch.z=0;els.joystick.firstElementChild.style.transform='';};for(const ev of ['pointerup','pointercancel','lostpointercapture'])els.joystick.addEventListener(ev,releaseStick);
  for(const [el,key]of [[els['touch-main'],'fire'],[els['touch-alt'],'jump']]){
    el.addEventListener('pointerdown',e=>{e.preventDefault();audio.unlock();touch[key]=true;el.setPointerCapture(e.pointerId);});for(const ev of ['pointerup','pointercancel','lostpointercapture'])el.addEventListener(ev,()=>touch[key]=false);
  }
  els.interact.onclick=()=>{interactPulse=true;audio.unlock();els.world.focus({preventScroll:true});};
  els.start.onclick=()=>startMission();els.help.onclick=openGuide;els['guide-close'].onclick=()=>els.guide.close();els.pause.onclick=()=>setPaused(!paused);els.resume.onclick=()=>setPaused(false);
  els.guide.addEventListener('close',()=>{if(helpPaused){if(pauseBeforeHelp)ui.show('pause-screen',true);else setPaused(false);}helpPaused=false;});
  els['restart-pause'].onclick=()=>startMission(game.state.round);els.retry.onclick=()=>startMission(game.state.phase==='complete'?game.state.round+1:game.state.round);els['back-title'].onclick=title;
  els.camera.onclick=()=>{view.cameraMode=(view.cameraMode+1)%2;ui.notify(view.cameraMode?'俯瞰視点':'追従視点',2);els.world.focus({preventScroll:true});};
  els.sound.onclick=()=>{audio.unlock();audio.setMuted(!audio.muted);try{localStorage.setItem('moonlander3d-muted',String(audio.muted));}catch{}updateSoundButton();els.world.focus({preventScroll:true});};
  els.fullscreen.onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await els.game.requestFullscreen();}catch{ui.notify('このブラウザでは全画面表示を利用できません。');}els.world.focus({preventScroll:true});};
  if(!document.fullscreenEnabled)els.fullscreen.hidden=true;
}
function frame(now){
  const dt=Math.min((now-last)/1000,.05);last=now;time+=dt;
  if(game.state.phase==='title')view.title(time,dt);
  else{
    if(!paused){game.update(dt,getInput());interactPulse=false;handleEvents();}
    view.render(game.state,paused?0:dt);ui.project(game.state,mouse,paused);hudTime-=dt;if(hudTime<=0){ui.update(game.state,paused);hudTime=.09;}
    const s=game.state,active=!paused&&!['failed','complete'].includes(s.phase);
    audio.update({thrust:active&&s.ship.thrust>0,charge:active&&s.charge>.3&&s.chargeAllowed&&!s.chargedFired,launch:active&&s.phase==='launch'});
    if(active&&s.player.speed>1&&s.player.y===0&&s.time-lastStep>.38){audio.play('step',.1);lastStep=s.time;}
  }
  requestAnimationFrame(frame);
}
try{
  view=new MoonScene(document.querySelector('#world'));ui=new HUD(view,coarse);els=ui.elements;game=new MoonGame({height:terrainHeight,obstacles:view.obstacles});audio=new AudioBus();
  try{audio.setMuted(localStorage.getItem('moonlander3d-muted')==='true');}catch{}
  updateSoundButton();setupInput();els.start.disabled=false;els.start.querySelector('span').textContent='ミッションを開始';els.pause.disabled=true;
  registerGameTools({getState:()=>game.state,isPaused:()=>paused,pause:setPaused});
  els.world.addEventListener('webglcontextlost',e=>{e.preventDefault();setPaused(true);ui.show('fatal',true);els.fatal.textContent='3D描画が中断されました。\nページを再読み込みすると再開できます。';});requestAnimationFrame(frame);
}catch(error){const el=document.querySelector('#fatal');el.classList.remove('hidden');el.textContent='3D描画を開始できませんでした。\nWebGL対応ブラウザでハードウェアアクセラレーションを有効にして、再読み込みしてください。';console.error(error);}
