import {Brain} from '../../../js/obs/brain.js?v=15';
import {getStation} from './state.js';
import {getLang} from '../../../js/obs/i18n.js?v=15';
import {medicalReadings} from './medical.js';

const words=(ja,en)=>getLang()==='ja'?ja:en;
export const isChessRequest=text=>/チェス|chess|ゲーム|\bgame\b|\bplay\b|遊ぼ|遊び|遊んで/i.test(text);
export const isGameAcceptance=text=>/^(?:yes|yeah|sure|ok|okay|はい|うん|いいよ|いいね|やろう|やる|お願い|それで|了解|付き合う)[!！。\s]*$/i.test(text.trim());

// Keep the 2D behavior intact; the cabin uses local reserves and bulk deliveries.
export class CabinBrain extends Brain {
  constructor(...args){super(...args);this.exercise=64;this.gamePending=false;this.medicalSample=null;this.lastMedicalReport=null;}
  get statusNeeds(){return{...this.needs,exercise:this.exercise};}
  update(dt){
    if(this.state==='playingGame')return;
    const exercising=this.state==='performing'&&this.cur?.id==='gym';
    this.exercise=Math.max(0,Math.min(100,this.exercise+dt*(exercising?100/16:-.20)));
    if(exercising){
      for(const [need,rate]of [['energy',.6],['thirst',.35],['hygiene',.55]])this.needs[need]=Math.max(0,this.needs[need]-dt*rate);
    }
    super.update(dt);
    if(this.state==='orderingSupply'&&this.care.phase!=='transmitting')this._toIdle();
  }
  _maybeWant(){
    if(this.care.depleted&&!this.care.delivery){this.requestSupplies();return;}
    if(this.care.delivery)return;
    super._maybeWant();
  }
  _choose(){
    if(['goingToSupplyConsole','orderingSupply'].includes(this.state))return;
    const ready=this.needs.energy>30&&this.needs.thirst>25&&this.needs.hunger>25;
    if(ready&&this.exercise<48&&(this.exercise<25||this.exercise<=Math.min(...Object.values(this.needs)))){this._go(getStation('gym'));return;}
    super._choose();
  }
  _usable(station){return station.id!=='stereo'&&super._usable(station);}
  _go(station){
    station=getStation(station?.id);if(!station)return false;
    this.gamePending=false;
    this.care.cancel();this.want=null;this.scene.obsUI?.hideWant();
    this.cur=station;this.recoverNeed=null;this.state='goingTo';
    this.actKey='going';this.actStation=station.id;this.actor.setSymbol('');
    this.actor.goTo(station,()=>this._startPerform(station));
  }
  _startPerform(station){
    if(this.gamePending&&station.id==='lounge'){
      this.gamePending=false;this.state='playingGame';this.actKey='perform';this.actStation='lounge';this.cur=station;
      this.actor.setSymbol('');this.scene.obsUI?.openGame?.();return;
    }
    if(station.supply&&!this.care.take(station.supply)){
      this.cur=null;this._toIdle();this.requestSupplies();return;
    }
    // The shared brain owns six needs; exercise is maintained only in the 3D cabin.
    super._startPerform(station.id==='gym'?{...station,need:null}:station);
    if(station.id==='medical')this.medicalSample=medicalReadings(this.needs);
    if(['eva','airlock','innerHatch'].includes(station.id))this.scene.obsUI?.inspectEVA?.(station.id);
  }
  _endPerform(){
    if(this.cur?.id==='medical'){
      this.lastMedicalReport={...this.medicalSample};
      this.scene.obsUI?.medicalResult?.(this.lastMedicalReport);
    }
    super._endPerform();
  }
  requestSupplies(){
    if(!this.care.request())return false;
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
    if(['goingToSupplyConsole','orderingSupply'].includes(this.state))return false;
    this.gamePending=false;
    return super.requestCommand();
  }
  requestGame(){
    if(this.gamePending||this.state==='playingGame')return false;
    this._go(getStation('lounge'));this.gamePending=true;this.socialT=0;this.wantCoolT=30;return true;
  }
  finishGame(){
    if(this.state!=='playingGame')return;
    this.cur=null;this.recoverNeed=null;this.actor.setSymbol('');this.wantCoolT=30;this._toIdle();
  }
  acknowledge(){
    if(this.isCalling()&&this.want?.kind==='play'){
      this.rapport=Math.min(100,this.rapport+10);this.requestGame();
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
    if(/医療|医務|診察|健診|検診|健康診断|体調.*(?:調べ|確認)|medical|medbay|sickbay|check.?up/i.test(text)){
      this._go(getStation('medical'));return words('医療区画で健診を受けてくる。','I will run a checkup in the medical bay.');
    }
    if(/music|音楽|曲|レコード|stereo|オーディオ|tune/i.test(text))return words('音楽設備は撤去したんだ。休憩ならラウンジへ行こう。','The stereo is gone. We can take a break in the lounge.');
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
      this.requestGame();return words('チェスを一局やろう。ラウンジへ行くよ。','Let’s play a game of chess. I will head to the lounge.');
    }
    if(/運動|ジム|筋トレ|トレーニング|エアロバイク|exercise|work\s?out|gym|cycling/i.test(text)){
      this._go(getStation('gym'));return words('少し身体を動かしてくる。','I will get some exercise.');
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
