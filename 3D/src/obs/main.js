import {createIcons,Pause,Play,VolumeX,Volume2,Cat,Scan,UserRound,Minus,Plus,Maximize,Radio,ArrowUpRight,X,Utensils,Droplet,Fish,Disc3,Send,RadioTower,Swords,Undo2,ArrowDownUp,Flag,RotateCcw,RotateCw,ArrowLeft,HeartPulse,Cross} from 'lucide';
import {CabinBrain,isChessRequest,isGameAcceptance} from './brain.js';
import {CabinChess} from './chess-ui.js';
import {LEISURE_LABELS} from './leisure.js';
import {t,line,getLang,toggleLang} from '../../../js/obs/i18n.js?v=15';
import {CrewMotion,Supplies,CatRoutine,getStation,currentAction} from './state.js';
import {ObservationView} from './view.js';
import {CabinAudio} from './audio.js';
import {StationFeedback,SIGNAL_COLORS} from './feedback.js';
import {AirlockPassage} from './airlock.js';
import {Sprout} from 'lucide';
import {PLANT} from './layout.js';

const $=id=>document.getElementById(id);
const icons={Sprout,Pause,Play,VolumeX,Volume2,Cat,Scan,UserRound,Minus,Plus,Maximize,Radio,ArrowUpRight,X,Utensils,Droplet,Fish,Disc3,Send,RadioTower,Swords,Undo2,ArrowDownUp,Flag,RotateCcw,RotateCw,ArrowLeft,HeartPulse,Cross};
const refreshIcons=()=>createIcons({icons});
const words=(ja,en)=>getLang()==='ja'?ja:en;
const stationName=id=>({plant:words('栽培棚','Plant rack'),gym:words('ジム','Gym'),medical:words('医療区画','Medical bay'),eva:words('宇宙服ラック','Suit rack'),airlock:words('船外ハッチ','EVA hatch'),innerHatch:words('船内ハッチ','Inner hatch')}[id]||t('st_'+id));
const needName=key=>key==='health'?words('健康','Health'):key==='exercise'?words('運動','Exercise'):t('need_'+key);
const care=new Supplies(),actor=new CrewMotion(),cat=new CatRoutine(care),audio=new CabinAudio();
const feedback=new StationFeedback(),airlock=new AirlockPassage();
let paused=false,elapsed=0,view=null,frame=0,previous=performance.now(),accumulator=0,hudTime=0,pendingHQ=false;
const timers=[];
let messageTimer=null;
function dismissMessage(){
  clearTimeout(messageTimer);messageTimer=null;$('dialogue').hidden=true;
}
function showMessage(text,speaker='MILO'){
  if(!text)return;
  clearTimeout(messageTimer);
  $('dialogue-text').textContent=text.replace(/^MILO:\s*/,'');$('dialogue-speaker').textContent=speaker;$('dialogue').hidden=false;
  messageTimer=setTimeout(dismissMessage,20000);
}
const scene={
  time:{delayedCall(ms,callback){timers.push({at:elapsed+ms/1000,callback});}},
  sound:{add(){return{play(){audio.tone(440,.09,.02);},once(_event,callback){callback();},destroy(){}};}},
  obsUI:{
    plantResult(count){showMessage(count?words(`野菜を収穫した。食料を${count}補充。`,`Greens harvested. Food +${count}.`):brain.plants.ready?words('食料庫はいっぱいだ。育った野菜は棚に残しておく。','Food storage is full. I will leave the mature greens growing.'):words('戻り水と養液の導電率を確認した。収穫までもう少しだ。','Condensate return and nutrient conductivity checked. The greens need more time.'));},
    flashMonitor(){$('call-alert').animate([{opacity:.6},{opacity:1}],{duration:350});},
    showWant(text){$('call-text').textContent=text.replace(t('want_hint'),'');$('call-alert').hidden=false;},
    hideWant(){$('call-alert').hidden=true;},
    openGame(){pendingHQ=false;dismissMessage();view?.setMode('milo');chess.show();audio.pause(true);},
    inspectEVA(id){showMessage(id==='eva'?words('宇宙服は三着、ラックに固定されている。','Three suits, secured in the rack.'):id==='innerHatch'?words('船内側のハッチ、異常なし。','Inner hatch checked. No faults.'):words('船外ハッチは閉鎖、ロックを確認した。','EVA hatch sealed. Locks checked.'));},
    healthEvent(event){
      if(event.type==='onset'){
        showMessage(event.kind==='fever'?words('寒気がする。熱もあるようだ。','I have chills. I think I am running a fever.'):event.source==='fitting'?words('点検中、金具で左腕を切った。手当てが要りそうだ。','I cut my left arm on a fitting. It needs dressing.'):words('足元がふらついて、左腕を壁で擦った。','I lost my footing and scraped my left arm against the wall.'));
        audio.tone(240,.25,.035);
      }else if(event.type==='worsened'){
        showMessage(event.stage==='critical'?words('もう作業を続けられない。医療区画へ向かう。','I cannot keep working. I am heading to the medical bay.'):words('具合が悪くなってきた。早く手当てを受けたい。','I am getting worse. I need treatment soon.'));
        audio.tone(190,.4,.045);
      }else if(event.type==='restricted')showMessage(words('今は先に手当てを受ける。','I need treatment first.'));
      else if(event.type==='interrupted')showMessage(words('手当ては、まだ終わっていない。','The treatment is not finished yet.'));
    },
    medicalResult(report){
      const advice={water:['水分を取っておこう。','I should get some water.'],rest:['少し休んだほうがよさそうだ。','I could use some rest.'],routine:['いつもの範囲に収まっている。','Readings are within my usual range.']};
      showMessage((report.treated?words('手当てが終わった。','Treatment complete. '):words('健診が終わった。','Checkup complete. '))+words(...advice[report.advice]));
    }
  }
};
const brain=new CabinBrain(scene,actor,{care,name:'MILO'});
const chess=new CabinChess({parent:$('observation'),refreshIcons,
  onClose(){brain.finishGame();previous=performance.now();accumulator=0;audio.pause(paused||document.hidden);updateHUD();},
  onMove(){audio.tone(340,.07,.02);},
  onResult(){brain.needs.fun=Math.min(100,brain.needs.fun+25);brain.rapport=Math.min(100,brain.rapport+5);}
});
care.onPhase=phase=>{
  if(phase==='queued'){pendingHQ=false;feedback.accept('console');}
  if(phase==='inbound'){showMessage(words('配送を受け付けた。補給ハッチへ搬入する。','Order received. Cargo is inbound to the supply hatch.'),'LOGISTICS');audio.tone(620,.15,.025);}
  if(phase==='unloading'){
    feedback.notify('hatch','unloading');showMessage(words('補給便が到着。ハッチを開放する。','Supply shipment docked. Opening the hatch.'),'LOGISTICS');
    for(const delay of [1360,1540,1720])scene.time.delayedCall(delay,()=>audio.tone(65,.35,.14,'triangle'));
  }
};
care.onDeliver=()=>{feedback.notify('hatch','delivered');showMessage(words('食料、水、猫餌を受領。備蓄を補充した。','Food, water and cat food received. Reserves replenished.'),'LOGISTICS');};

const needElements={};
for(const key of Object.keys(brain.statusNeeds)){
  const item=document.createElement('div');item.className='need';item.dataset.need=key;
  const row=document.createElement('div'),name=document.createElement('span'),value=document.createElement('b'),meter=document.createElement('progress');meter.max=100;
  row.append(name,value);item.append(row,meter);$('needs').append(item);needElements[key]={item,name,value,meter};
}
function updateHUD(){
  const minutes=Math.floor(brain.hour*60);$('ship-clock').textContent=`${String(Math.floor(minutes/60)).padStart(2,'0')}:${String(minutes%60).padStart(2,'0')}`;
  $('milo-mood').textContent=t('mood_'+brain.mood);
  $('milo-activity').textContent=chess.open?words('チェスで対局中','Playing chess'):paused?words('一時停止','Paused'):actor.waitingForHatch?words('船内ハッチの開放待ち','Waiting for inner hatch'):brain.gamePending?words('チェスをしにラウンジへ','Going to the lounge for chess'):currentAction(brain)==='gym'?words('ジムで運動中','Exercising in the gym'):currentAction(brain)==='medical'?(brain.health.treatment?words('医療区画で治療中','Treatment in progress'):words('医療区画で健診中','Checkup in progress')):brain.state==='orderingSupply'?words('コンソールで配送を依頼中','Ordering supplies at console'):brain.actStation?stationName(brain.actStation)+(actor.busy?words('へ移動中',' / en route'):['eva','airlock','innerHatch'].includes(brain.actStation)?words('を点検中',' / inspecting'):words('で過ごしている',' / occupied')):t('state_'+brain.actKey);
  for(const [key,nodes]of Object.entries(needElements)){const value=Math.round(brain.statusNeeds[key]);nodes.name.textContent=needName(key);nodes.value.textContent=value;nodes.meter.value=value;nodes.meter.setAttribute('aria-label',needName(key));nodes.item.classList.toggle('low',key==='health'?brain.health.needsCare:value<30);nodes.item.classList.toggle('critical',key==='health'&&brain.health.critical);}
  if(!paused&&brain.isSeatedInLounge()&&LEISURE_LABELS[brain.leisure])$('milo-activity').textContent=words(...LEISURE_LABELS[brain.leisure]);
  if(!paused&&brain.loungeExit)$('milo-activity').textContent=words('ラウンジから立ち上がる','Getting up from the lounge');
  updateHealthHUD();
  const catStates={play:['マイロと遊んでいる','Playing with Milo'],joinPlay:['マイロのそばへ','Joining Milo'],sleep:['眠っている','Sleeping'],groom:['毛づくろい','Grooming'],look:['周りを見ている','Looking around'],follow:['マイロについて歩く','Following Milo'],eat:['食事中','Eating'],fetch:['餌のところへ','Going to the bowl'],walk:['船内を散歩中','Exploring']};
  const passage=cat.motion.portal;
  $('cat-activity').textContent=passage?words(...(passage.phase==='transit'?['壁裏を移動中','In wall passage']:['turnIn','enter'].includes(passage.phase)?['猫穴に入る','Entering passage']:['猫穴から出る','Leaving passage'])):words(...catStates[cat.mode]);
  for(const [key,stock]of Object.entries(care.supplies)){
    $('stock-'+key).textContent=`${stock}/${care.capacity[key]}`;
    const button=document.querySelector(`[data-use="${key}"]`),labels={food:['食事','Eat'],water:['水を飲む','Drink'],catfood:['ルーシーに餌を出す','Feed Lucy']};
    button.setAttribute('aria-label',`${words(...labels[key])}: ${stock}/${care.capacity[key]}`);button.dataset.tip=words(...labels[key]);button.classList.toggle('empty',stock===0);
  }
  const idleSupply=care.depleted?['欠品あり','Out of stock']:care.needsDelivery?['補給可能','Restock available']:care.lastDelivery?['補充完了','Restocked']:['在庫あり','Stocked'];
  const deliveryLabels={idle:idleSupply,queued:['コンソールへ移動','Going to console'],transmitting:['配送依頼を送信中','Transmitting order'],inbound:[`配送中 ${Math.max(0,Math.ceil(12-(care.delivery?.age||0)))}秒`,`Inbound ${Math.max(0,Math.ceil(12-(care.delivery?.age||0)))}s`],unloading:['ハッチで荷受け中','Unloading at hatch']};
  $('delivery-status').textContent=words(...deliveryLabels[care.phase]);$('delivery-status').dataset.phase=care.phase;
  $('request-supply').disabled=Boolean(care.delivery)||!care.needsDelivery;
  $('request-supply').setAttribute('aria-label',words('コンソールから物資配送を依頼','Order supplies at console'));
  document.querySelectorAll('[id^="view-"]').forEach(button=>{if(!['view-all','view-milo','view-cat'].includes(button.id))return;const selected=button.id==='view-'+view?.mode;button.classList.toggle('active',selected);button.setAttribute('aria-pressed',String(selected));});
  $('camera-label').textContent={all:'CAM 01 / WIDE',milo:'CAM 02 / MILO',cat:'CAM 03 / LUCY',manual:'CAM / MANUAL'}[view?.mode]||'CAM 01 / WIDE';
  const signal=feedback.summary,status=$('station-status');status.hidden=!signal;
  if(signal){
    const phases={hover:['',''],inspect:['在庫確認','Inventory'],moving:['移動中','En route'],waiting:['指示待機','Queued'],active:['使用中','In use'],done:['完了','Completed'],blocked:['補給待ち','Supply required'],stocked:['在庫あり','Already stocked'],unloading:['荷受け中','Unloading'],delivered:['補給済み','Delivered'],acknowledged:['応答済み','Acknowledged']};
    status.dataset.station=signal.id;status.dataset.phase=signal.phase;status.style.setProperty('--signal-color','#'+SIGNAL_COLORS[signal.phase].toString(16));
    const name=stationName(signal.id),phase=words(...phases[signal.phase]);
    if($('station-name').textContent!==name)$('station-name').textContent=name;
    if($('station-phase').textContent!==phase)$('station-phase').textContent=phase;
  }
}
function updateHealthHUD(){
  const health=brain.health,stage=health.stage,medical=brain.actStation==='medical',exam=currentAction(brain)==='medical',course=health.treatment;
  const states={warning:['要手当て','Needs treatment'],urgent:['悪化','Deteriorating'],critical:['緊急','Critical'],treating:['治療中','Treating'],recovering:['回復中','Recovering']};
  $('health-alert').hidden=stage==='healthy';$('health-alert').dataset.stage=stage;
  const symptom=health.condition?.kind==='injury'?words('左腕の怪我','Left arm injury'):health.condition?words('発熱','Fever'):words('健康状態','Health');
  const title=stage==='healthy'?'':`${symptom} / ${words(...states[stage])}`;
  if($('health-title').textContent!==title)$('health-title').textContent=title;
  const seconds=course?Math.max(0,Math.ceil(course.duration-course.elapsed)):0;
  $('health-detail').textContent=course?words(`処置完了まで ${seconds}秒`,`Treatment completes in ${seconds}s`):exam?words('健康状態を測定中','Checking vital signs'):medical?words('医療区画へ移動中','En route to medical bay'):stage==='recovering'?words('処置済み。経過観察中','Treated. Under observation'):health.critical?words('作業中止・医療区画へ移動','Work stopped. Medical care required'):health.urgent?words('移動能力が低下','Mobility reduced'):words('症状が続いている','Symptoms persist');
  $('seek-treatment').disabled=medical;$('treatment-label').textContent=medical?(course?words('治療中','Treating'):exam?words('健診中','Checking'):words('移動中','En route')):words('医療区画へ','Medical bay');
}
function localize(){
  document.documentElement.lang=getLang();document.querySelectorAll('[data-ja]').forEach(el=>el.textContent=el.dataset[getLang()]);
  $('obs-lang').textContent=words('EN','JA');$('obs-lang').setAttribute('aria-label',words('Switch to English','日本語に切り替え'));
  $('obs-input').placeholder=words('マイロに話しかける','Talk to Milo');$('obs-input').setAttribute('aria-label',$('obs-input').placeholder);
  for(const [id,ja,en]of [['view-all','全景','Wide view'],['view-milo','マイロ','Follow Milo'],['view-cat','ルーシー','Follow Lucy'],['zoom-in','拡大','Zoom in'],['zoom-out','縮小','Zoom out'],['obs-fullscreen','全画面','Fullscreen'],['hq-message','司令部通信','Headquarters'],['obs-sound','船内音','Cabin audio'],['request-supply','コンソールから配送依頼','Order supplies at console']]){$(id).dataset.tip=words(ja,en);$(id).setAttribute('aria-label',words(ja,en));}
  const pauseLabel=paused?words('再開','Resume'):words('一時停止','Pause');$('obs-pause').setAttribute('aria-label',pauseLabel);$('obs-pause').dataset.tip=pauseLabel;
  $('play-chess').setAttribute('aria-label',words('マイロとチェス','Play chess with Milo'));$('play-chess').dataset.tip=words('マイロとチェス','Play chess with Milo');
  if(chess.open)chess.render();
  if(brain.isCalling())scene.obsUI.showWant(brain._wantText());updateHUD();
}
function setPause(next){paused=next;$('obs-pause').innerHTML=`<i data-lucide="${paused?'play':'pause'}"></i>`;$('obs-pause').setAttribute('aria-pressed',String(paused));audio.pause(paused);refreshIcons();localize();}
function confirmOrder(id){feedback.accept(id);feedback.update(0,brain,actor,paused);audio.tone(620,.1,.025);updateHUD();}
function acknowledge(){const reply=brain.acknowledge();if(brain.gamePending&&paused)setPause(false);showMessage(reply);if(brain.actStation)confirmOrder(brain.actStation);else feedback.notify('console','acknowledged');updateHUD();}
function requestGame(){
  pendingHQ=false;if(paused)setPause(false);
  if(brain.requestGame()){showMessage(words('チェスを一局やろう。ラウンジへ行くよ。','Let’s play chess. I will head to the lounge.'));confirmOrder('lounge');}
  else if(brain.actStation==='medical')confirmOrder('medical');
}
function loungeClick(){
  pendingHQ=false;
  const result=brain.clickLounge();
  if(result==='chess'){if(paused)setPause(false);showMessage(words('一局やろう。','Let’s play a round.'));}
  if(result==='relax'||result==='chess')confirmOrder('lounge');
  else if(result==='blocked'&&brain.actStation)confirmOrder(brain.actStation);
}
function requestSupply(){
  if(brain.requestSupplies()){showMessage(words('コンソールから配送を頼んでくる。','I will order supplies at the console.'));confirmOrder('console');}
  else if(brain.health.critical){showMessage(words('配送の前に、手当てを受ける。','I need treatment before arranging supplies.'));confirmOrder('medical');}
  else showMessage(care.delivery?words('配送は手配中だ。','The delivery is already being arranged.'):words('備蓄はまだ十分にある。','The reserves are full.'));
  updateHUD();
}
function useStation(id){
  const station=getStation(id);
  if(!station)return;
  if(!brain.health.critical&&station.supply&&!care.has(station.supply)){feedback.notify(id,'blocked');audio.tone(190,.18,.025);showMessage(words('在庫がない。コンソールから配送を頼もう。','No stock left. We need to order a shipment at the console.'));updateHUD();return;}
  pendingHQ=false;brain._go(station);confirmOrder(brain.actStation);
}
function useSupply(type){
  if(type==='catfood'){
    if(care.has(type)){cat.fetch();showMessage(words('ルーシーの餌皿へ出しておいた。',"Food is ready in Lucy's bowl."));}
    else showMessage(words('猫餌が切れている。配送を頼もう。','We are out of cat food. Time to order supplies.'));
    updateHUD();return;
  }
  useStation(type==='food'?'galley':'hydro');
}
function headquarters(){
  if(brain.isCalling()){acknowledge();return;}
  if(brain.requestCommand()){pendingHQ=true;showMessage(words('タライロン生活区画、定時通信。','Tarairon habitat, scheduled transmission.'),'HQ');}
  if(brain.actStation)confirmOrder(brain.actStation);
}
$('obs-pause').addEventListener('click',()=>setPause(!paused));
$('obs-lang').addEventListener('click',()=>{toggleLang();localize();});
$('obs-sound').addEventListener('click',async()=>{try{const enabled=await audio.toggle();audio.pause(paused);$('obs-sound').setAttribute('aria-pressed',String(enabled));$('obs-sound').innerHTML=`<i data-lucide="${enabled?'volume-2':'volume-x'}"></i>`;refreshIcons();}catch{showMessage(words('このブラウザでは船内音を再生できません。','Audio is unavailable in this browser.'),'SYSTEM');}});
$('obs-chat').addEventListener('submit',event=>{
  event.preventDefault();const text=$('obs-input').value.trim();if(!text)return;const version=actor.commandVersion;
  let reply;
  if(brain.isCalling()&&brain.want?.kind==='play'){
    if(/^(?:no|nope|あとで|また今度|今は無理|やめとく|いや)[!！。\s]*$/i.test(text))reply=brain.declineGame();
    else if(isGameAcceptance(text)||isChessRequest(text))reply=brain.acknowledge();
  }else if(brain.isCalling())brain.acknowledge();
  showMessage(reply||brain.handleChat(text));if(brain.gamePending&&paused)setPause(false);
  if(actor.commandVersion!==version)confirmOrder(brain.actStation);$('obs-input').value='';audio.tone(330,.08,.02);updateHUD();
});
$('play-chess').addEventListener('click',requestGame);
$('seek-treatment').addEventListener('click',()=>useStation('medical'));
$('dismiss-dialogue').addEventListener('click',dismissMessage);
$('acknowledge').addEventListener('click',acknowledge);
$('hq-message').addEventListener('click',headquarters);
document.querySelectorAll('[data-use]').forEach(button=>button.addEventListener('click',()=>useSupply(button.dataset.use)));
$('request-supply').addEventListener('click',requestSupply);
for(const mode of ['all','milo','cat'])$('view-'+mode).addEventListener('click',()=>view?.setMode(mode));
$('zoom-in').addEventListener('click',()=>view?.changeZoom(1.3));$('zoom-out').addEventListener('click',()=>view?.changeZoom(1/1.3));
if(!document.fullscreenEnabled)$('obs-fullscreen').hidden=true;
$('obs-fullscreen').addEventListener('click',async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await $('observation').requestFullscreen();}catch{showMessage(words('全画面に切り替えられませんでした。','Fullscreen is unavailable.'),'SYSTEM');}});
document.addEventListener('keydown',event=>{
  if(chess.open)return;
  if(event.target.closest('input,textarea,button')||event.metaKey||event.ctrlKey||event.altKey)return;
  const supply={f:'food',w:'water',c:'catfood'}[event.key.toLowerCase()];
  if(supply){event.preventDefault();useSupply(supply);}else if(event.code==='Space'){event.preventDefault();setPause(!paused);}else if(event.key==='Escape'){dismissMessage();view?.setMode('all');}
});
document.addEventListener('visibilitychange',()=>{previous=performance.now();accumulator=0;audio.pause(document.hidden||paused||chess.open);});
refreshIcons();localize();

async function start(){
  try{
    view=await ObservationView.create($('ship-view'));
    view.feedback=feedback;
    view.onModeChange=()=>updateHUD();
    view.onStation=id=>{
      if(id==='lounge'){loungeClick();return;}
      if(id==='console'){requestSupply();return;}
      if(id==='hatch'){feedback.notify(id,'inspect');showMessage(care.delivery?words('補給便の受け入れを準備中。','Preparing to receive the shipment.'):words('受け入れ待機中。配送の依頼はコンソールで。','Hatch on standby. Place supply orders at the console.'),'LOGISTICS');updateHUD();return;}
      useStation(id);
    };
    brain.catRoutine=cat;
    $('loading').hidden=true;
    function tick(now){
      const dt=Math.min((now-previous)/1000,.05);previous=now;
      if(!paused&&!document.hidden&&!chess.open){
        accumulator+=dt;
        // The shared 2D brain uses a 60 Hz tick for its social timer.
        while(accumulator>=1/60&&!chess.open){const step=1/60;elapsed+=step;care.update(step);airlock.update(step,actor);if(!actor.waitingForHatch)actor.update(step);cat.update(step,actor);brain.update(step);audio.update(step,actor.busy&&!actor.climbing&&!actor.waitingForHatch,actor.floor===PLANT.floor?Math.max(0,1-Math.abs(actor.x-PLANT.x)/220):0);for(let i=timers.length-1;i>=0;i--)if(timers[i].at<=elapsed){const timer=timers.splice(i,1)[0];timer.callback();}accumulator-=step;}
        if(pendingHQ&&brain.state==='reading'){pendingHQ=false;showMessage(line('hq'),'HQ');}
      }
      if(!document.hidden){feedback.update(dt,brain,actor,paused||chess.open);view.render(dt,elapsed,actor,brain,cat,care,paused||chess.open,airlock);}
      hudTime+=dt;if(hudTime>.15){updateHUD();hudTime=0;}
      frame=requestAnimationFrame(tick);
    }
    frame=requestAnimationFrame(tick);
  }catch(error){console.error(error);$('loading').hidden=true;$('obs-error').hidden=false;$('obs-error').textContent=words('船内映像を開けませんでした。WebGLが有効なブラウザで再読み込みしてください。','The habitat view could not load. Reload in a browser with WebGL enabled.');}
}
$('ship-view').addEventListener('webglcontextlost',event=>{event.preventDefault();setPause(true);$('obs-error').hidden=false;$('obs-error').textContent=words('映像接続が中断されました。ページを再読み込みしてください。','Graphics connection interrupted. Please reload the page.');});
window.addEventListener('pagehide',event=>{if(!event.persisted){cancelAnimationFrame(frame);chess.dispose();view?.dispose();audio.dispose();}});
start();
