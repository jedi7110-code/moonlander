import {CabinAudio} from './obs/audio.js';
import {CabinSoundEvents} from './obs/sound-events.js';
import {CABIN_SOUNDS} from './obs/sound-library.js';
import {BathroomVisit} from './obs/bathroom.js';
import {BunkVisit} from './obs/bunk-visit.js';
import {CatMotion,CrewMotion} from './obs/state.js';
import {CAT_PORT,CAT_BOWL,LADDER_X} from './obs/layout.js';
import {planDroidTurn} from './obs/droid-turn.js';
import {DroidRoutine,DROID_PACE} from './obs/droid-routine.js';
import {DROID_GAIT} from './obs/pace.js';
const $=id=>document.getElementById(id),audio=new CabinAudio({ambience:false});
let running=null,previous=0,previewTimer=null,frame=null;
function status(){const s=audio.stats;$('status').textContent=`${audio.enabled?'音声 ON':'音声 OFF'} / 読み込み ${s.loaded} / ${s.total} / 発音 ${s.active} / ループ ${s.loops} / エラー ${s.failed}`;}
audio.onChange=status;
function controls(){document.querySelectorAll('[data-sound],#run').forEach(button=>button.disabled=!audio.enabled||audio.stats.loaded!==audio.stats.total);$('enable').setAttribute('aria-pressed',String(audio.enabled));$('enable').textContent=audio.enabled?'音声オフ':'音声オン';status();}
function stop(){running=null;clearTimeout(previewTimer);if(frame)cancelAnimationFrame(frame);frame=null;audio.pause(true);$('scene-state').textContent='停止中';status();}
$('enable').addEventListener('click',async()=>{
  $('enable').disabled=true;
  try{await audio.toggle();controls();if(audio.enabled)await audio.load();else stop();controls();}
  catch(error){$('status').textContent=`音声を開始できません: ${error.message}`;}
  finally{$('enable').disabled=false;}
});
$('stop').addEventListener('click',stop);
for(const [id,definition]of Object.entries(CABIN_SOUNDS)){
  const card=document.createElement('article');card.className='card';
  const title=document.createElement('b');title.textContent=definition.label;
  const detail=document.createElement('p');detail.textContent=`${definition.description?definition.description+' · ':''}${definition.loop?'ループ / 試聴は4秒':'単発'} · mono WAV · ${definition.license??'CC0'}`;
  const button=document.createElement('button');button.textContent='試聴';button.dataset.sound=id;button.disabled=true;
  button.addEventListener('click',()=>{stop();audio.pause(false);if(definition.loop)audio.setLoop('preview',id,true);else audio.play(id);$('scene-state').textContent=`個別試聴：${definition.label}`;status();previewTimer=setTimeout(()=>{audio.stopLoop('preview');status();},4000);});
  card.append(title,detail,button);$('library').append(card);
}
function start(){
  stop();audio.pause(false);
  const kind=$('scenario').value,state={actor:{x:700,y:650,floor:1,walkDistance:0,queue:[],busy:false},brain:{},care:{phase:'idle'},airlock:{opening:0}};
  const driver=new CabinSoundEvents(audio);driver.update(1/60,state);
  if(['shower','toilet'].includes(kind))state.brain.bathroom=new BathroomVisit(kind);
  if(kind==='bed')state.brain.bunkVisit=new BunkVisit({startAsleep:true});
  if(kind==='washerDoor'){
    const droid=state.droid=new DroidRoutine({care:state.care,brain:state.brain,actor:state.actor});
    droid.job='laundry';droid.add('hold',.5);
    droid.act('washer-open',1.8);droid.add('hold',1);
    droid.act('washer-close',1.8);droid.add('hold',.6);
    driver.update(1/60,state);
  }
  if(kind==='feed'){
    const droid=state.droid=new DroidRoutine({care:state.care,brain:state.brain,actor:state.actor});
    droid.job='feed';droid.carriedFood=true;droid.position={x:(CAT_BOWL.x-700)*.022+.40,y:0,z:CAT_BOWL.depth+.48};
    droid.act('food-pour',6,()=>{droid.carriedFood=false;});driver.update(1/60,state);
  }
  if(['washer','cook'].includes(kind))state.droid={position:{x:-2,y:3.4,z:-2},step:{kind:'work',action:{washer:'wash',cook:'cook-chop'}[kind],duration:6},age:0,time:0,washingUntil:kind==='washer'?6:0};
  if(kind==='droidWalk')state.droid={position:{x:-2,y:3.4,z:.78},step:{kind:'walk'},walkDistance:0,age:0,time:0,washingUntil:0};
  if(kind.startsWith('miloClimb')){
    const from=kind==='miloClimbUp'?1:0;
    state.actor=new CrewMotion({floor:from,x:LADDER_X});state.actor.goTo({floor:1-from,x:LADDER_X});
  }
  if(['droidTurn','droidClimb'].includes(kind)){
    const turn=planDroidTurn(0,Math.PI);turn.duration/=DROID_PACE;
    state.droid={position:{x:0,y:0,z:.34},step:kind==='droidTurn'?{kind:'turn',turn,duration:turn.duration}:{kind:'climb',from:{y:0},duration:6},age:0,time:0,washingUntil:0};
  }
  if(kind==='catLift'){state.cat={motion:new CatMotion({floor:1,x:CAT_PORT.x})};state.cat.motion.goTo({floor:0,x:CAT_PORT.x+30});}
  if(kind==='delivery'){state.care.phase='unloading';state.care.delivery={age:0};}
  running={kind,state,driver,time:0};previous=performance.now();frame=requestAnimationFrame(tick);
}
function tick(now){
  if(!running)return;const dt=Math.min(.05,(now-previous)/1000);previous=now;
  const r=running,s=r.state;r.time+=dt;const t=r.time;
  if(r.kind==='door')s.airlock.opening=t<.5?0:t<1.2?(t-.5)/.7:t<2?1:Math.max(0,1-(t-2)/.7);
  if(s.brain.bunkVisit){if(t>.5)s.brain.bunkVisit.requestExit();s.brain.bunkVisit.update(dt);}
  if(s.brain.bathroom){s.brain.bathroom.update(dt);if(t>9)s.brain.bathroom.requestExit();}
  if(r.kind==='walk'){s.actor.busy=t<4;if(s.actor.busy){s.actor.walkDistance+=dt*48;s.actor.x+=dt*48;}}
  if(r.kind.startsWith('miloClimb'))s.actor.update(dt);
  if(r.kind==='droidWalk'){s.droid.waiting=t>=4;if(!s.droid.waiting){const travel=dt*DROID_GAIT.speed*DROID_PACE;s.droid.walkDistance+=travel;s.droid.position.x+=travel;}}
  if(['washerDoor','feed'].includes(r.kind))s.droid.update(dt);
  else if(s.droid){s.droid.time=t;s.droid.age=Math.min(t,s.droid.step?.duration??6);if(r.kind==='droidClimb')s.droid.position.y=Math.min(3.392,t*.40*DROID_PACE);if(t>=(s.droid.step?.duration??6))s.droid.step=null;}
  if(s.cat)s.cat.motion.update(dt);
  if(s.care.delivery){s.care.delivery.age=t;if(t>3.3)s.care.phase='idle';}
  r.driver.update(dt,s);status();$('scene-state').textContent=`${$('scenario').selectedOptions[0].textContent} / ${t.toFixed(1)}秒 / ${s.cat?.motion.portal?.phase??s.brain.bunkVisit?.phase??s.brain.bathroom?.phase??s.droid?.step?.action??s.care.phase}`;
  if(['washerDoor','feed'].includes(r.kind)&&!s.droid.step){stop();return;}
  if(s.brain.bunkVisit?s.brain.bunkVisit.phase==='done'||t>45:s.cat?!s.cat.motion.busy||t>60:r.kind.startsWith('miloClimb')?!s.actor.busy||t>35:t>(s.brain.bathroom?16:8)){stop();return;}frame=requestAnimationFrame(tick);
}
$('run').addEventListener('click',start);
document.addEventListener('visibilitychange',()=>{if(document.hidden){stop();audio.pause(true);}else audio.pause(false);});
window.addEventListener('pagehide',()=>{stop();audio.dispose();});
