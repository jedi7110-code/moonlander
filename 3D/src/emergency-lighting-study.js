import {ObservationView} from './obs/view.js';
import {CabinEnvironment} from './obs/environment.js';
import {EMERGENCY_LIGHT_PERIOD,EMERGENCY_LIGHT_FADE,EMERGENCY_LIGHT_BRIGHT_TIME} from './obs/emergency-lighting.js';
import {animateAirlock,animateHatchFault} from './obs/eva.js';
import {animateCabinLucy} from './obs/lucy-cabin.js';
import {getStation,FLOORS} from './obs/layout.js';
import {positionY} from './obs/ship.js';
import {poseRepairStudy} from './hatch-repair-study-model.js';
import {HATCH_SERVICE_POINT} from './obs/hatch-repair-pose.js';
import {CabinAudio} from './obs/audio.js';
import {bindCabinAudioGestures} from './obs/audio-unlock.js';

const $=id=>document.getElementById(id),environment=new CabinEnvironment();
let view=null,playing=true,previous=performance.now(),chosenView='all';
const audio=new CabinAudio({ambience:false});
let unbindAudioGestures=()=>{};
function syncAlarm(){const paused=!playing||document.hidden;if(audio.paused!==paused)audio.pause(paused);audio.setLoop('hatch-alarm','hatchAlarm',Boolean(environment.fault));}
function updateAudioUI(){
  $('sound').textContent=audio.enabled?'警報音をOFF':'警報音をON';$('sound').setAttribute('aria-pressed',String(audio.enabled));
  const status=!audio.enabled?'音声OFF':audio.failures.some(f=>f.id==='hatchAlarm')?'警報音を読み込めませんでした':!audio.buffers.has('hatchAlarm')?'音声を準備中…':!audio.unlocked?'操作すると音声が有効になります':audio.paused?'音声は一時停止中':!environment.fault?'復旧済み / 警報停止':audio.loops.has('hatch-alarm')?'警報を再生中':'警報の開始待ち';
  if($('sound-state').textContent!==status)$('sound-state').textContent=status;
}
try{
  view=await ObservationView.create($('scene'),{deferGroomCache:true});
  const effect=view.emergencyLighting,deckY=positionY(FLOORS[getStation('innerHatch').floor].y);
  const {visit}=poseRepairStudy(view.milo,11.8);view.milo.position.y=deckY;view.milo.updateMatrixWorld(true);
  view.cat.position.set(3.7,3.392,.78);animateCabinLucy(view.cat,{time:0,dt:0,moving:false,facing:1,mode:'idle'});
  animateAirlock(view.ship.innerDoor,view.ship.innerSignal,0);
  const brain={environment,hatchRepair:visit,hour:8,state:'repairingHatch',cur:getStation('innerHatch')};
  $('steady').checked=effect.reducedMotion;

  function updateUI(){
    const fault=Boolean(environment.fault),recovering=!fault&&effect.amount.value>0;
    $('state').textContent=fault?'船内ハッチ故障 / 非常照明':recovering?'復旧確認 / 暖色へ移行中':'船内環境 正常 / 通常照明';
    $('state').dataset.alert=String(fault);
    $('play').textContent=playing?'一時停止':'明滅を再開';$('play').setAttribute('aria-pressed',String(playing));
    $('play-state').textContent=effect.reducedMotion?'一定の赤い照明で表示しています。':!fault?'「故障を再現」で赤い明滅に切り替わります。':playing?`警報音と同じ${EMERGENCY_LIGHT_PERIOD}秒周期で明滅しています。`:'選んだ瞬間で止めています。';
    $('phase').disabled=!fault||effect.reducedMotion;
    $('bright').disabled=$('dim').disabled=effect.reducedMotion;
    syncAlarm();updateAudioUI();
  }
  function syncShip(){
    animateHatchFault(view.ship.innerSignal,environment);
    view.ship.consoleScreens?.update({brain,clock:environment.clock});
    view.ship.aiSupervision?.update({brain,clock:environment.clock});
  }
  function fault(){environment.triggerFault();environment.setStage(environment.fault.serial,'repair');playing=true;previous=performance.now();syncShip();updateUI();}
  function holdPhase(time){
    environment.triggerFault();environment.setStage(environment.fault.serial,'repair');
    effect.update(EMERGENCY_LIGHT_FADE.on,environment);effect.time=time;effect.update(0,environment);
    playing=false;syncShip();updateUI();
  }
  $('fault').onclick=fault;
  $('restore').onclick=()=>{environment.resolve(environment.fault?.serial);playing=true;previous=performance.now();syncShip();updateUI();};
  $('play').onclick=()=>{if(!environment.fault){fault();return;}playing=!playing;previous=performance.now();updateUI();};
  $('bright').onclick=()=>holdPhase(EMERGENCY_LIGHT_BRIGHT_TIME);
  $('dim').onclick=()=>holdPhase(0);
  $('phase').max=EMERGENCY_LIGHT_PERIOD;$('phase').oninput=()=>holdPhase(Number($('phase').value));
  $('steady').onchange=()=>{effect.reducedMotion=$('steady').checked;effect.update(0,environment);updateUI();};
  audio.onChange=updateAudioUI;audio.onError=error=>{console.warn('警報音:',error);updateAudioUI();};
  unbindAudioGestures=bindCabinAudioGestures(audio,{ignore:event=>Boolean(event.target?.closest?.('#sound')),onError:audio.onError});
  $('sound').onclick=async()=>{try{await audio.toggle();syncAlarm();updateAudioUI();if(audio.enabled){await audio.load();syncAlarm();updateAudioUI();}}catch(error){audio.onError(error);}};
  function setView(mode){
    chosenView=mode;
    if(mode==='all')view.setMode('all');
    else{
      view.mode='manual';view.zoomAnchor=null;
      view.targetCenter.set(HATCH_SERVICE_POINT.x-.25,deckY+(mode==='hands'?HATCH_SERVICE_POINT.y:1.35),HATCH_SERVICE_POINT.z);
      view.targetHeight=mode==='hands'?1.9:4.2;
    }
    $('view-name').textContent={all:'全景',hatch:'故障ハッチ',hands:'修理する手元'}[mode];
    document.querySelectorAll('[data-view]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.view===mode)));
  }
  document.querySelectorAll('[data-view]').forEach(button=>button.onclick=()=>setView(button.dataset.view));
  view.onModeChange=mode=>{if(mode==='manual'){chosenView='manual';$('view-name').textContent='自由視点';document.querySelectorAll('[data-view]').forEach(button=>button.setAttribute('aria-pressed','false'));}};
  document.querySelectorAll('button,input').forEach(control=>control.disabled=false);
  fault();setView('all');
  await view.compilePrograms();
  $('loading').hidden=true;previous=performance.now();
  view.renderer.setAnimationLoop(now=>{
    const dt=document.hidden?0:Math.min(.1,Math.max(0,(now-previous)/1000));previous=now;
    if(document.hidden)return;
    syncAlarm();updateAudioUI();
    const wasRecovering=!environment.fault&&effect.amount.value>0;
    if(playing)effect.update(dt,environment,audio.loopTime('hatch-alarm'));
    if(wasRecovering&&effect.amount.value===0)updateUI();
    if(chosenView==='all')view.targetHeight=view.fitHeight;
    view.center.lerp(view.targetCenter,1-Math.exp(-dt*12));view.viewHeight+=(view.targetHeight-view.viewHeight)*(1-Math.exp(-dt*12));view.setFrustum();
    view.characterToon.forEach(toon=>toon.update(view.width,view.height));
    view.cabinToon.update(view.width,view.height,view.viewHeight,view.fitHeight);
    view.renderer.render(view.scene,view.camera);
    $('phase').value=effect.time;$('phase-value').textContent=`${effect.time.toFixed(2)} / ${EMERGENCY_LIGHT_PERIOD.toFixed(2)} 秒`;
  });
  document.addEventListener('visibilitychange',()=>{previous=performance.now();syncAlarm();updateAudioUI();});
  window.addEventListener('pagehide',event=>{audio.pause(true);if(!event.persisted){unbindAudioGestures();audio.dispose();view.dispose();}});
}catch(error){unbindAudioGestures();audio.dispose();view?.dispose();$('loading').hidden=false;$('loading').textContent=`読み込みに失敗しました: ${error.message}`;$('loading').setAttribute('role','alert');console.error(error);}
