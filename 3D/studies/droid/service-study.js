import {ObservationView} from '../../src/obs/view.js';
import {DroidRoutine,DROID_JOBS,DROID_FLOORS,DROID_LANE} from '../../src/obs/droid-routine.js';
import {Supplies,CrewMotion,CatRoutine,CatMotion,advanceCabinTraffic} from '../../src/obs/state.js';
import {LADDER_X,CAT_BOWL,CAT_PORT} from '../../src/obs/layout.js';
import {CrewHealth} from '../../src/obs/health.js';
import {PlantBed} from '../../src/obs/plant-state.js';
const $=id=>document.getElementById(id),params=new URLSearchParams(location.search);
let selected=Object.hasOwn(DROID_JOBS,params.get('job'))?params.get('job'):'feed';
const trafficNames={'crew-first':'梯子待ち：マイロ先行','droid-first':'梯子待ち：ドロイド先行','split-ladder':'別区間の同時昇降','cat-crossing':'猫と2人のすれ違い'};
let traffic=Object.hasOwn(trafficNames,params.get('traffic'))?params.get('traffic'):null,crewLaunched=false;
let playing=false,following=true,rate=1,routine,care,brain,actor,cat,view,frame,last=performance.now();
function reset(){
  care=new Supplies();actor=new CrewMotion({floor:0,x:1040});cat=new CatRoutine(care);
  cat.motion.floor=0;cat.motion.y=446;cat.motion.x=1170;
  brain={plants:new PlantBed(),health:new CrewHealth(),needs:{hunger:90,thirst:90,energy:90,hygiene:90,bladder:90,fun:90},hour:12,state:'idle',actStation:null,curDurSec:0};
  if(selected==='cargo')care.lastDelivery=1;
  if(selected==='harvest'){brain.plants.rows.forEach(row=>row.growth=1);care.supplies.food=0;}
  routine=new DroidRoutine({care,brain,actor,cat});routine.request(selected);view.droidRoutine=routine;
  if(traffic){
    routine.steps=[];routine.age=0;routine.restUntil=Infinity;crewLaunched=false;
    const crossing=traffic==='cat-crossing',split=traffic==='split-ladder',floor=crossing?2:split?1:0,x=crossing?(CAT_BOWL.approachX-LADDER_X)*.022:0;
    routine.position={x:x-3,y:DROID_FLOORS[floor],z:DROID_LANE,floor,yaw:Math.PI/2};routine.plan={...routine.position};
    if(crossing){
      actor=new CrewMotion({floor:2,x:CAT_BOWL.approachX+130});actor.goTo({floor:2,x:CAT_BOWL.approachX-180});
      cat.motion=new CatMotion({floor:2,x:CAT_BOWL.approachX,turns:true});cat.mode='fetch';cat.hunger=100;
      cat.motion.goTo({floor:2,x:CAT_BOWL.approachX,z:CAT_BOWL.depth},()=>cat.rest('eat',100));routine.walk(x+3,DROID_LANE);
    }else{
      actor=new CrewMotion({floor:split?1:2,x:traffic==='crew-first'?LADDER_X:LADDER_X+150});
      if(traffic==='crew-first'){actor.goTo({floor:0,x:LADDER_X+150});crewLaunched=true;}
      routine.travel(2,-3,DROID_LANE);
    }
    routine.actor=actor;routine.add('release',.01,()=>{routine.job=null;});
  }
  $('time').max=routine.steps.reduce((total,step)=>total+step.duration,0)+3;
  if(traffic)$('time').max=45;
  playing=false;following=true;view.mode='manual';$('play').textContent='再生';
  document.querySelectorAll('[data-job]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.job===selected)));
  document.querySelectorAll('[data-traffic]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.traffic===traffic)));
  history.replaceState(null,'',`?job=${selected}${traffic?`&traffic=${traffic}`:''}`);draw();
}
function advance(dt){
  if(!traffic){routine.update(dt);return;}
  while(dt>1e-8){
    const step=Math.min(dt,1/60);dt-=step;
    if(!crewLaunched&&['droid-first','split-ladder'].includes(traffic)&&routine.ladderClaim){actor.goTo({floor:0,x:LADDER_X+150});crewLaunched=true;}
    actor.waitingForDroid=routine.blocksCrew(actor,step);advanceCabinTraffic(actor,cat,step,routine);routine.update(step);
  }
}
function draw(dt=.05){
  if(following){const p=routine.pose;view.mode='manual';view.targetCenter.set(p.x,p.y+.94,p.z);view.targetHeight=3.1;view.center.copy(view.targetCenter);view.viewHeight=3.1;}
  if(traffic&&following){
    const y=(870-actor.y)*.016,x=(actor.x-LADDER_X)*.022,p=routine.position;
    view.targetHeight=traffic==='cat-crossing'?5.2:Math.max(3.8,Math.abs(y-p.y)+2.8);
    view.targetCenter.set((x+p.x)/2,(y+p.y)/2+.8,1);view.center.copy(view.targetCenter);view.viewHeight=view.targetHeight;
  }
  view.render(dt,routine.time,actor,brain,cat,care,!playing);
  $('status').textContent=traffic?trafficNames[traffic]:routine.label;
  const names={'food-pick':'猫餌を取り出す','food-pour':'皿に注ぐ','cargo-pick':'荷受け','cargo-place':'倉庫に置く','scrub-toilet':'便器をブラシで清掃','scrub-shower':'壁をスポンジで清掃',harvest:'葉を摘む','laundry-pick':'洗濯物を集める','washer-open':'洗濯機を開く','washer-close':'洗濯機を閉じる','laundry-load':'衣類を入れる','laundry-unload':'衣類を取り出す','laundry-fold':'たたんで棚へ','washer-start':'洗濯を開始',wash:'洗濯中','cook-chop':'野菜を切る','cook-stir':'鍋をかき混ぜる','cook-serve':'盛り付け','door-open':'扉を開く','door-close':'扉を閉じる'};
  $('detail').textContent=`${routine.time.toFixed(1)}秒 / ${names[routine.pose.action]??routine.pose.mode}　${routine.door?'ドア開放 '+Math.round(routine.opening*100)+'%':''}　餌皿 ${care.catBowl} / 1`;
  const wasteNames={'cook-cleanup':'調理ごみを集める','waste-open':'焼却ボックスを開く','waste-insert':'ごみを投入','waste-close':'扉を閉じる','waste-burn':'焼却中'};
  if(wasteNames[routine.pose.action])$('detail').textContent=`${routine.time.toFixed(1)}秒 / ${wasteNames[routine.pose.action]}　処理 ${routine.disposedWaste} 件`;
  if(traffic)$('detail').textContent=`${routine.time.toFixed(1)}秒 / マイロ${actor.waitingForDroid||actor.waitingForCat?' 待機':' 移動可'} / ドロイド${routine.waiting?' 待機':' 移動可'} / 猫${cat.motion.waitingForCrew||cat.motion.waitingForDroid?' 待機':' 移動可'}`;
  $('time').value=routine.time;
}
function pause(){playing=false;$('play').textContent='再生';}
function saveTime(){history.replaceState(null,'',`?job=${selected}${traffic?`&traffic=${traffic}`:''}&time=${routine.time.toFixed(2)}`);}
async function start(){
  view=await ObservationView.create($('ship-view'));
  for(const [job,name]of Object.entries(DROID_JOBS)){const button=document.createElement('button');button.textContent=name;button.dataset.job=job;button.onclick=()=>{selected=job;traffic=null;reset();};$('jobs').append(button);}
  for(const [id,name]of Object.entries(trafficNames)){const button=document.createElement('button');button.textContent=name;button.dataset.traffic=id;button.onclick=()=>{traffic=id;reset();};$('traffic').append(button);}
  $('play').onclick=()=>{playing=!playing;$('play').textContent=playing?'一時停止':'再生';};
  $('home').onclick=reset;$('speed').onchange=()=>{rate=Number($('speed').value);};
  $('time').oninput=()=>{const target=Number($('time').value);reset();advance(target);pause();draw();saveTime();};
  $('step').onclick=()=>{pause();advance(.2);draw();saveTime();};
  document.querySelectorAll('[data-motion]').forEach(button=>button.onclick=()=>{
    traffic=null;reset();const mode=button.dataset.motion;
    for(let i=0;i<24000&&!routine.docked;i++){
      routine.update(.05);const p=routine.pose;
      if(mode==='walk'?p.walking&&p.age>1&&p.duration>8:p.climb&&Math.abs(p.y-p.climb.from)>.85&&((p.climb.to>p.climb.from)===(mode==='up')))break;
    }
    pause();draw();saveTime();
  });
  $('next').onclick=()=>{
    playing=false;$('play').textContent='再生';
    const current=routine.step;for(let i=0;i<24000;i++){
      advance(.05);
      if(routine.docked||(routine.step!==current&&routine.pose.mode==='work'))break;
    }
    if(!routine.docked)advance(Math.min(1.5,routine.step.duration*.4));draw();saveTime();
  };
  $('wide').onclick=()=>{following=false;view.setMode('all');};$('follow').onclick=()=>{following=true;};
  reset();if(params.has('time')){advance(Math.min(Number($('time').max),Math.max(0,Number(params.get('time'))||0)));draw();saveTime();}$('loading').hidden=true;
  function tick(now){const dt=Math.min(.05,(now-last)/1000);last=now;if(!document.hidden){if(playing)advance(dt*rate);draw(dt);}frame=requestAnimationFrame(tick);}
  frame=requestAnimationFrame(tick);
  window.addEventListener('pagehide',e=>{if(!e.persisted){cancelAnimationFrame(frame);view.dispose();}});
}
start().catch(error=>{$('loading').textContent=error.message;console.error(error);});
