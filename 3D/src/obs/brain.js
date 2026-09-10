import {Brain} from '../../../js/obs/brain.js?v=15';
import {getStation} from './state.js';
import {getLang} from '../../../js/obs/i18n.js?v=15';
import {medicalReadings} from './medical.js';
import {CrewHealth} from './health.js';
import {BathroomVisit} from './bathroom.js';
import {PlantBed} from './plant-state.js';
import {CABIN_PACE} from './pace.js';

const words=(ja,en)=>getLang()==='ja'?ja:en;
export const isChessRequest=text=>/チェス|chess|ゲーム|\bgame\b|\bplay\b|遊ぼ|遊び|遊んで/i.test(text);
export const isGameAcceptance=text=>/^(?:yes|yeah|sure|ok|okay|はい|うん|いいよ|いいね|やろう|やる|お願い|それで|了解|付き合う)[!！。\s]*$/i.test(text.trim());

// Keep the 2D behavior intact; the cabin uses local reserves and bulk deliveries.
export class CabinBrain extends Brain {
  constructor(...args){
    super(...args);
    const random=args[2]?.random??Math.random;
    this.random=random;this.leisure=null;this.lastLeisure=null;this.catRoutine=null;
    for(const need of Object.keys(this.needs))this.needs[need]=35+Math.floor(random()*56);
    this.exercise=35+Math.floor(random()*56);this.gamePending=false;this.medicalSample=null;this.lastMedicalReport=null;
    this.health=new CrewHealth({onEvent:event=>this.scene.obsUI?.healthEvent?.(event)});
    this.baseWalkSpeed=this.actor.walkSpeed;this.baseClimbSpeed=this.actor.climbSpeed;
    this.bathroom=null;this.afterActivity=null;
    this.plants=new PlantBed();
    this.dayMs=CABIN_PACE.dayMs;this.clock=8*this.dayMs/24;
  }
  get statusNeeds(){return{...this.needs,exercise:this.exercise,health:this.health.value};}
  _decayMul(need){return super._decayMul(need)*CABIN_PACE.needDecay;}
  update(dt){
    if(this.state==='playingGame')return;
    this.plants.update(dt);
    this.bathroom?.update(dt);
    this.health.update(dt,{needs:this.needs,activity:this.state==='performing'?this.cur?.id:null,moving:this.actor.busy,climbing:this.actor.climbing});
    this.actor.walkSpeed=this.baseWalkSpeed*this.health.speedFactor;this.actor.climbSpeed=this.baseClimbSpeed*this.health.speedFactor;
    const exercising=this.state==='performing'&&this.cur?.id==='gym';
    this.exercise=Math.max(0,Math.min(100,this.exercise+dt*(exercising?100/16:-.20*CABIN_PACE.needDecay)));
    if(exercising){
      for(const [need,rate]of [['energy',.6],['thirst',.35],['hygiene',.55]])this.needs[need]=Math.max(0,this.needs[need]-dt*rate);
    }
    super.update(dt);
    if(this.health.needsCare){this.sick=true;this.mood='sick';}
    if((this.health.critical||(this.health.needsCare&&exercising))&&this.actStation!=='medical')this._go(getStation('medical'));
    if(this.state==='orderingSupply'&&this.care.phase!=='transmitting')this._toIdle();
  }
  _maybeWant(){
    if(this.health.urgent){this._go(getStation('medical'));return;}
    if(this.care.depleted&&!this.care.delivery){this.requestSupplies();return;}
    if(this.care.delivery)return;
    super._maybeWant();
  }
  _choose(){
    if(this.health.urgent){this._go(getStation('medical'));return;}
    if(['goingToSupplyConsole','orderingSupply'].includes(this.state))return;
    if(this.plants.ready&&this.care.supplies.food<this.care.capacity.food&&Math.min(...Object.values(this.needs))>30&&!this.health.needsCare){this._go(getStation('plant'));return;}
    const ready=!this.health.needsCare&&this.needs.energy>30&&this.needs.thirst>25&&this.needs.hunger>25;
    if(ready&&this.exercise<48&&(this.exercise<25||this.exercise<=Math.min(...Object.values(this.needs)))){this._go(getStation('gym'));return;}
    if(Math.min(...Object.values(this.needs))>CABIN_PACE.autonomousNeedThreshold&&this.exercise>=48){this.idleT=0;return;}
    super._choose();
  }
  _usable(station){return station.id!=='stereo'&&!(station.id==='gym'&&this.health.needsCare)&&super._usable(station);}
  _go(station){
    station=getStation(station?.id);if(!station)return false;
    if(this.deferDeparture(()=>this._go(station)))return true;
    if(station.id==='medical'&&this.actStation==='medical')return true;
    if((this.health.critical&&station.id!=='medical')||(this.health.needsCare&&station.id==='gym')){
      this.scene.obsUI?.healthEvent?.({type:'restricted',stage:this.health.stage,kind:this.health.condition.kind});
      if(this.actStation!=='medical')this._go(getStation('medical'));return false;
    }
    this.health.cancelTreatment();
    this.gamePending=false;
    this.care.cancel();this.want=null;this.scene.obsUI?.hideWant();
    this.cur=station;this.recoverNeed=null;this.state='goingTo';
    this.actKey='going';this.actStation=station.id;this.actor.setSymbol('');
    this.actor.goTo(station,()=>this._startPerform(station));
    return true;
  }
  _startPerform(station){
    if(station.id==='lounge'&&!this.gamePending){
      const options=['book','music',...(this.catRoutine?.canPlayLounge()?['cat']:[])].filter(mode=>mode!==this.lastLeisure);
      this.leisure=options[Math.floor(this.random()*options.length)];this.lastLeisure=this.leisure;
      station={...station,dur:this.leisure==='cat'?40000:this.leisure==='book'?32000:36000};this.cur=station;
    }
    if(['shower','toilet'].includes(station.id)&&!this.bathroom){
      this.state='enteringBathroom';this.actKey='perform';
      this.bathroom=new BathroomVisit(station.id,{
        entered:()=>super._startPerform(station),
        exited:()=>{this.bathroom=null;super._endPerform();this.finishDeparture();}
      });return;
    }
    if(this.gamePending&&station.id==='lounge'){
      this.gamePending=false;this.state='playingGame';this.actKey='perform';this.actStation='lounge';this.cur=station;
      this.actor.setSymbol('');this.scene.obsUI?.openGame?.();return;
    }
    if(station.supply&&!this.care.take(station.supply)){
      this.cur=null;this._toIdle();this.requestSupplies();return;
    }
    // The shared brain owns six needs; exercise is maintained only in the 3D cabin.
    if(station.id==='medical'){
      station={...station,dur:this.health.duration*1000};this.cur=station;this.health.beginTreatment();
      this.medicalSample=medicalReadings(this.needs,this.health);
    }
    super._startPerform(station.id==='gym'?{...station,need:null}:station);
    if(station.id==='lounge'&&this.leisure==='cat')this.catRoutine.inviteLounge(this);
    if(['eva','airlock','innerHatch'].includes(station.id))this.scene.obsUI?.inspectEVA?.(station.id);
  }
  _endPerform(){
    if(this.cur?.id==='plant'){
      const count=this.plants.harvest(this.care);this.plants.tend();
      this.scene.obsUI?.plantResult?.(count);
    }
    if(this.bathroom){this.state='leavingBathroom';this.recoverNeed=null;this.bathroom.requestExit();return;}
    if(this.cur?.id==='medical'){
      const treated=this.health.finishTreatment();
      this.lastMedicalReport=treated?{...medicalReadings(this.needs,this.health),treated:true}:{...this.medicalSample};
      this.scene.obsUI?.medicalResult?.(this.lastMedicalReport);
    }
    super._endPerform();
    this.finishDeparture();
  }
  deferDeparture(callback){
    if(!this.bathroom&&!(this.state==='performing'&&['galley','hydro'].includes(this.cur?.id)))return false;
    this.afterActivity=callback;
    if(this.bathroom){this.state='leavingBathroom';this.recoverNeed=null;this.bathroom.requestExit();}
    return true;
  }
  finishDeparture(){const callback=this.afterActivity;this.afterActivity=null;callback?.();}
  requestSupplies(){
    if(this.deferDeparture(()=>this.requestSupplies()))return true;
    if(this.health.critical){this._go(getStation('medical'));return false;}
    if(!this.care.request())return false;
    this.health.cancelTreatment();
    this.gamePending=false;
    this.want=null;this.scene.obsUI?.hideWant();this.recoverNeed=null;this.cur=null;
    this.state='goingToSupplyConsole';this.actKey='going';this.actStation='console';this.actor.setSymbol('');
    this.actor.goTo(getStation('console'),()=>{
      if(!this.care.transmit())return;
      this.state='orderingSupply';this.actKey='reading';this.actStation='console';
    });
    return true;
  }
  requestCommand(){
    if(this.deferDeparture(()=>this.requestCommand()))return true;
    if(this.health.critical){this._go(getStation('medical'));return false;}
    if(['goingToSupplyConsole','orderingSupply'].includes(this.state))return false;
    this.health.cancelTreatment();
    this.gamePending=false;
    return super.requestCommand();
  }
  requestGame(){
    if(this.deferDeparture(()=>this.requestGame()))return true;
    if(this.health.urgent){this.scene.obsUI?.healthEvent?.({type:'restricted',kind:this.health.condition.kind,stage:this.health.stage});this._go(getStation('medical'));return false;}
    if(this.gamePending||this.state==='playingGame')return false;
    if(this.isSeatedInLounge()){
      this.leisure=null;this.gamePending=true;this.recoverNeed=null;this.want=null;this.socialT=0;this.wantCoolT=30;
      this.scene.obsUI?.hideWant();this._startPerform(getStation('lounge'));return true;
    }
    this._go(getStation('lounge'));this.gamePending=true;this.socialT=0;this.wantCoolT=30;return true;
  }
  isSeatedInLounge(){return this.state==='performing'&&this.cur?.id==='lounge'&&!this.actor.busy;}
  clickLounge(){
    if(this.isSeatedInLounge())return this.requestGame()?'chess':'blocked';
    if(this.gamePending||this.state==='playingGame')return 'pending';
    if(this.state==='goingTo'&&this.cur?.id==='lounge')return 'moving';
    return this._go(getStation('lounge'))?'relax':'blocked';
  }
  finishGame(){
    if(this.state!=='playingGame')return;
    this.cur=null;this.recoverNeed=null;this.actor.setSymbol('');this.wantCoolT=30;this._toIdle();
  }
  acknowledge(){
    if(this.isCalling()&&this.want?.kind==='play'){
      if(!this.requestGame())return this.health.urgent?words('今は先に手当てを受けたい。','I need treatment first.'):words('ラウンジで会おう。','I will meet you in the lounge.');
      this.rapport=Math.min(100,this.rapport+10);
      return words('チェスにしよう。ラウンジへ行くよ。','Chess, then. I will meet you in the lounge.');
    }
    return super.acknowledge();
  }
  declineGame(){
    if(this.want?.kind!=='play')return;
    this.want=null;this.actor.onArrive=null;this.scene.obsUI?.hideWant();this.wantCoolT=30;this._toIdle();
    return words('わかった。また今度にしよう。','All right. Another time.');
  }
  handleChat(text){
    if(/医療|医務|診察|健診|検診|健康診断|治療|手当|体調.*(?:調べ|確認)|medical|medbay|sickbay|check.?up|treat|first.?aid/i.test(text)){
      this._go(getStation('medical'));return this.health.needsCare?words('医療区画で手当てを受けてくる。','I will get treatment in the medical bay.'):words('医療区画で健診を受けてくる。','I will run a checkup in the medical bay.');
    }
    if(this.health.critical){this._go(getStation('medical'));return words('先に医療区画へ行く。もう作業を続けられない。','I need medical care first. I cannot keep working.');}
    if(/野菜|菜園|栽培|収穫|プラント|plant|harvest|garden|vegetable/i.test(text)){
      this._go(getStation('plant'));return words('栽培棚を見てくる。育った野菜は収穫しよう。','I will check the plants and harvest any mature greens.');
    }
    if(/music|音楽|曲|レコード|stereo|オーディオ|tune/i.test(text)){
      this.lastLeisure='book';this._go(getStation('lounge'));
      return words('ラウンジでひと休みしよう。ヘッドホンもある。','I will take a break in the lounge. There are headphones there.');
    }
    if(/内扉|船内ハッチ|左.*ハッチ|inner (?:hatch|door)|cabin hatch/i.test(text)){
      this._go(getStation('innerHatch'));return words('船内側のハッチを点検してくる。','I will inspect the inner hatch.');
    }
    if(/エアロック|船外|外へ出|airlock|spacewalk/i.test(text)){
      this._go(getStation('airlock'));return words('船外ハッチの閉鎖状態を見てくる。','I will check the EVA hatch seals.');
    }
    if(/宇宙服|スーツ|ラック|spacesuit|suit rack|\beva\b/i.test(text)){
      this._go(getStation('eva'));return words('宇宙服のラックを点検してくる。','I will check the suit rack.');
    }
    if(isChessRequest(text)){
      if(!this.requestGame())return this.health.urgent?words('今は先に手当てを受けたい。','I need treatment first.'):words('ラウンジで会おう。','I will meet you in the lounge.');
      return words('チェスを一局やろう。ラウンジへ行くよ。','Let’s play a game of chess. I will head to the lounge.');
    }
    if(/運動|ジム|筋トレ|トレーニング|エアロバイク|exercise|work\s?out|gym|cycling/i.test(text)){
      if(!this._go(getStation('gym')))return words('運動は控えて、先に手当てを受ける。','I will skip exercise and get treatment first.');
      return words('少し身体を動かしてくる。','I will get some exercise.');
    }
    if(this.cur?.id==='gym'&&/what are you doing|what're you|なにして|何して/i.test(text))return words('エアロバイクを漕いでいる。','I am using the exercise bike.');
    if(/補給|配送|物資|配達|resupply|deliver|supplies/i.test(text)){
      if(this.requestSupplies())return words('コンソールから配送を頼んでくる。','I will order supplies at the console.');
      return this.care.delivery?words('配送は手配中だ。','The delivery is already being arranged.'):words('備蓄はまだ十分にある。','The reserves are full.');
    }
    for(const [pattern,type]of [[/eat|food|hungry|食べ|食事|腹|めし|ごはん/i,'food'],[/drink|water|thirst|水|喉|のど/i,'water']]){
      if(pattern.test(text)&&!this.care.has(type)){
        if(this.requestSupplies())return words('在庫が切れている。コンソールから配送を頼んでくる。','We are out. I will order supplies at the console.');
        return words('補給便を待っている。届いたら用意しよう。','The shipment is on its way. We can have some when it arrives.');
      }
    }
    return super.handleChat(text);
  }
}
