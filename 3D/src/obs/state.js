import {FLOORS,LADDER_X,getStation,CAT_PORT,CAT_BOWL,CAT_SOFA,LOUNGE_SEAT} from './layout.js';
import {CAT_RISE_TIME} from './cat-rest.js';
import {CABIN_PACE} from './pace.js';

export class CrewMotion {
  constructor({floor=1,x=360,walkSpeed=54,climbSpeed=38}={}) {
    this.floor=floor;this.x=x;this.y=FLOORS[floor].y;this.walkSpeed=walkSpeed;this.climbSpeed=climbSpeed;
    this.walkDistance=0;
    this.queue=[];this.onArrive=null;this.facing=1;this.symbol='';this.knockTime=0;this.commandVersion=0;
  }
  get busy(){return this.queue.length>0;}
  get climbing(){return this.queue[0]?.type==='climb';}
  setSymbol(symbol){this.symbol=symbol;}
  knock(){this.knockTime=.7;}
  goTo(target,onArrive) {
    if(!target||!FLOORS[target.floor])return;
    this.commandVersion++;
    const queue=[];
    // Retargeting on a ladder preserves the current height, including mid-climb.
    if(this.y!==FLOORS[target.floor].y){
      if(this.x!==LADDER_X)queue.push({type:'walk',x:LADDER_X});
      queue.push({type:'climb',floor:target.floor,y:FLOORS[target.floor].y});
    }
    queue.push({type:'walk',x:target.x});this.queue=queue;this.onArrive=onArrive||null;
  }
  update(dt) {
    this.knockTime=Math.max(0,this.knockTime-dt);
    const seg=this.queue[0];if(!seg)return;
    const key=seg.type==='climb'?'y':'x',speed=seg.type==='climb'?this.climbSpeed:this.walkSpeed;
    const delta=seg[key]-this[key],step=speed*dt;
    if(key==='x')this.walkDistance+=Math.min(Math.abs(delta),step);
    if(key==='x'&&Math.abs(delta)>.01)this.facing=Math.sign(delta);
    if(Math.abs(delta)<=step){this[key]=seg[key];if(seg.type==='climb')this.floor=seg.floor;this.queue.shift();if(!this.busy){const callback=this.onArrive;this.onArrive=null;callback?.();}}
    else this[key]+=Math.sign(delta)*step;
  }
}

export class CatMotion extends CrewMotion {
  constructor(options={}){super({floor:0,x:1035,walkSpeed:36,...options});this.onSofa=this.floor===0&&this.x>=CAT_SOFA.seatX;this.elevation=this.onSofa?LOUNGE_SEAT.top:0;this.z=this.onSofa?LOUNGE_SEAT.centerDepth:CAT_PORT.walkZ;this.hop=null;this.portalWalkDistance=0;this.portal=null;this.destination=null;this.onDestination=null;}
  get busy(){return Boolean(this.portal||this.hop)||super.busy;}
  get climbing(){return false;}
  get hidden(){return this.portal?.phase==='transit';}
  goTo(target,onArrive){
    if(!target||!FLOORS[target.floor])return;
    this.commandVersion++;this.destination={floor:target.floor,x:target.x};this.onDestination=onArrive||null;
    // Finish an occupied passage before following a changed destination.
    if(!this.portal&&!this.hop)this.plan();
  }
  plan(){
    if(!this.destination)return;
    const wantsSofa=this.destination.floor===0&&this.destination.x>=CAT_SOFA.seatX;
    if(this.onSofa!==wantsSofa&&this.floor===0){
      const up=!this.onSofa;
      this.queue=[{type:'walk',x:up?CAT_SOFA.floorX:CAT_SOFA.seatX}];
      this.onArrive=()=>{this.facing=up?1:-1;this.hop={up,phase:'prepare',age:0,duration:.14};};return;
    }
    const crossing=this.destination.floor!==this.floor;
    this.queue=[{type:'walk',x:crossing?CAT_PORT.x:this.destination.x}];
    this.onArrive=()=>{
      if(crossing){this.portal={from:this.floor,to:this.destination.floor,phase:'turnIn',age:0,duration:.4,yaw:this.facing*Math.PI/2};return;}
      const callback=this.onDestination;this.destination=null;this.onDestination=null;callback?.();
    };
  }
  update(dt){
    if(this.hop){
      while(dt>0&&this.hop){
        const h=this.hop,step=Math.min(dt,h.duration-h.age);h.age+=step;dt-=step;
        if(h.phase==='flight'){
          const t=h.age/h.duration,from=h.up?CAT_SOFA.floorX:CAT_SOFA.seatX,to=h.up?CAT_SOFA.seatX:CAT_SOFA.floorX;
          this.x=from+(to-from)*t;
          this.z=(h.up?CAT_PORT.walkZ:LOUNGE_SEAT.centerDepth)+(h.up?1:-1)*(LOUNGE_SEAT.centerDepth-CAT_PORT.walkZ)*t;
          this.elevation=(h.up?LOUNGE_SEAT.top*t:LOUNGE_SEAT.top*(1-t))+4*(h.up?.30:.20)*t*(1-t);
        }
        if(h.age<h.duration)break;
        h.age=0;
        if(h.phase==='prepare'){h.phase='flight';h.duration=.56;}
        else if(h.phase==='flight'){h.phase='land';h.duration=.18;this.onSofa=h.up;this.elevation=h.up?LOUNGE_SEAT.top:0;this.z=h.up?LOUNGE_SEAT.centerDepth:CAT_PORT.walkZ;}
        else{this.hop=null;this.plan();}
      }
      if(dt<=0||this.hop)return;
    }
    if(!this.portal){super.update(dt);return;}
    while(dt>0&&this.portal){
      const p=this.portal,step=Math.min(dt,p.duration-p.age);p.age+=step;dt-=step;
      const t=p.age/p.duration,s=t*t*(3-2*t),previousZ=this.z;
      if(p.phase==='enter')this.z=CAT_PORT.walkZ+(CAT_PORT.insideZ-CAT_PORT.walkZ)*s;
      if(p.phase==='transit')this.y=FLOORS[p.from].y+(FLOORS[p.to].y-FLOORS[p.from].y)*s;
      if(p.phase==='exit')this.z=CAT_PORT.insideZ+(CAT_PORT.walkZ-CAT_PORT.insideZ)*s;
      if(p.phase==='enter'||p.phase==='exit')this.portalWalkDistance+=Math.abs(this.z-previousZ);
      if(p.age<p.duration)break;
      p.age=0;
      if(p.phase==='turnIn'){p.phase='enter';p.duration=2.8;}
      else if(p.phase==='enter'){p.phase='transit';p.duration=1.6+Math.abs(p.to-p.from)*1.5;}
      else if(p.phase==='transit'){this.floor=p.to;this.y=FLOORS[p.to].y;p.phase='exit';p.duration=2.8;}
      else if(p.phase==='exit'){p.phase='turnOut';p.duration=.4;this.facing=Math.sign(this.destination.x-CAT_PORT.x)||1;}
      else{this.portal=null;this.z=CAT_PORT.walkZ;this.plan();}
    }
  }
  get passagePose(){
    const p=this.portal;if(!p)return null;
    const t=p.age/p.duration,s=t*t*(3-2*t);
    const yaw=p.phase==='turnIn'?p.yaw+Math.atan2(Math.sin(Math.PI-p.yaw),Math.cos(Math.PI-p.yaw))*s:p.phase==='enter'?Math.PI:p.phase==='turnOut'?this.facing*Math.PI/2*s:0;
    const crouch=p.phase==='turnIn'?s:p.phase==='turnOut'?1-s:1;
    return{phase:p.phase,yaw,crouch};
  }
}

export class Supplies {
  constructor(){
    this.capacity={food:3,water:4,catfood:3};this.supplies={...this.capacity};
    this.delivery=null;this.deliveryCount=0;this.lastDelivery=null;this.onPhase=null;this.onDeliver=null;
  }
  has(type){return type==='music'||this.supplies[type]>0;}
  take(type){if(type==='music')return true;if(!this.has(type))return false;this.supplies[type]--;return true;}
  get depleted(){return Object.keys(this.capacity).some(type=>!this.has(type));}
  get needsDelivery(){return Object.keys(this.capacity).some(type=>this.supplies[type]<this.capacity[type]);}
  get phase(){return this.delivery?.phase||'idle';}
  request(){if(this.delivery||!this.needsDelivery)return false;this.delivery={id:++this.deliveryCount,phase:'queued',age:0};this.onPhase?.('queued');return true;}
  cancel(){if(!['queued','transmitting'].includes(this.phase))return false;this.delivery=null;this.onPhase?.('cancelled');return true;}
  transmit(){if(this.phase!=='queued')return false;this.setPhase('transmitting');return true;}
  setPhase(phase){this.delivery.phase=phase;this.delivery.age=0;this.onPhase?.(phase);}
  update(dt){
    if(!this.delivery||this.phase==='queued')return;
    const durations={transmitting:3,inbound:12,unloading:4};
    // Carry surplus time across stages so pausing/frame rate cannot change the order.
    while(dt>0&&this.delivery){
      const stage=this.delivery,step=Math.min(dt,durations[stage.phase]-stage.age);
      stage.age+=step;dt-=step;
      if(stage.phase==='unloading'&&stage.age>=2.1&&!stage.received){
        stage.received=true;this.supplies={...this.capacity};this.lastDelivery=stage.id;this.onDeliver?.();
      }
      if(stage.age<durations[stage.phase])break;
      if(stage.phase==='transmitting')this.setPhase('inbound');
      else if(stage.phase==='inbound')this.setPhase('unloading');
      else{this.delivery=null;this.onPhase?.('complete');}
    }
  }
}

export class CatRoutine {
  constructor(care,{random=Math.random}={}){
    this.care=care;this.random=random;this.motion=new CatMotion();
    this.hunger=this.between(48,90);this.energy=this.between(35,80);this.groomNeed=this.between(20,80);this.curiosity=this.between(30,90);
    this.mode='sleep';this.modeTime=0;this.remaining=this.between(8,16);this.pendingMove=null;this.companion=null;this.followLeft=0;this.retargetIn=0;
  }
  between(min,max){return min+(max-min)*this.random();}
  canPlayLounge(){return this.motion.floor===0&&!this.motion.portal&&!this.motion.hop&&this.hunger>35&&this.energy>25&&this.mode!=='fetch'&&!this.pendingMove&&Math.abs(this.motion.x-CAT_SOFA.seatX)<220;}
  inviteLounge(brain){
    this.playHost=brain;
    this.depart(()=>{
      if(this.playHost!==brain||!brain.isSeatedInLounge()||brain.leisure!=='cat')return;
      this.mode='joinPlay';this.modeTime=0;
      this.motion.goTo({floor:0,x:CAT_SOFA.seatX},()=>{
        if(this.playHost===brain&&brain.isSeatedInLounge()&&brain.leisure==='cat'){this.motion.facing=1;this.rest('play',40);}
        else this.rest('look',6);
      });
    },'play');
  }
  rest(mode,duration){this.mode=mode;this.modeTime=0;this.remaining=duration;this.motion.walkSpeed=36;this.pendingMove=null;}
  depart(run,kind){
    if(this.mode==='play'&&!this.motion.busy){this.pendingMove={run,kind};this.playHost=null;this.playRelease??={age:0};return;}
    if(!this.motion.busy&&['sleep','look','eat','groom'].includes(this.mode)&&this.remaining>0){
      this.pendingMove={run,kind};this.remaining=Math.min(this.remaining,CAT_RISE_TIME);return;
    }
    run();
  }
  canFollow(){
    const actor=this.companion;
    return actor?.busy&&!actor.climbing&&!actor.waitingForHatch&&actor.floor===this.motion.floor&&!this.motion.onSofa&&!this.motion.portal&&!this.motion.hop&&(actor.x-this.motion.x)*actor.facing>40;
  }
  follow(){
    this.depart(()=>{if(!this.canFollow()){this.rest('look',6);return;}this.mode='follow';this.modeTime=0;this.followLeft=this.between(8,18);this.retargetIn=0;},'follow');
  }
  endFollow(){this.motion.goTo({floor:this.motion.floor,x:this.motion.x});this.rest('look',this.between(5,9));}
  choose(){
    // Fulfil actual needs, but sample their weights instead of repeating a fixed tour.
    const choices=[['fetch',this.care.has('catfood')&&this.hunger<70?(100-this.hunger)**2/100:0],['sleep',1+(100-this.energy)**2/100],['groom',1+this.groomNeed**2/100],['look',12+this.curiosity*.15],['follow',this.canFollow()?18:0],['walk',5+this.curiosity**2/100]];
    let draw=this.random()*choices.reduce((sum,[,weight])=>sum+weight,0),mode='walk';
    for(const [candidate,weight]of choices){draw-=weight;if(draw<0){mode=candidate;break;}}
    if(mode==='fetch'){this.fetch();return;}
    if(mode==='follow'){this.follow();return;}
    if(mode!=='walk'){this.rest(mode,this.between(mode==='sleep'?12:6,mode==='sleep'?25:13));return;}
    const places=[{floor:0,x:840},{floor:1,x:940},{floor:2,x:1155},{floor:1,x:510},{floor:0,x:1060}].filter(place=>place.floor!==this.motion.floor||Math.abs(place.x-this.motion.x)>40);
    const target=places[Math.floor(this.random()*places.length)];
    this.depart(()=>{this.mode='walk';this.modeTime=0;
      this.motion.goTo(target,()=>{const rest=this.random()<.35?'look':this.random()<(100-this.energy)/(100-this.energy+this.groomNeed+1)?'sleep':'groom';this.rest(rest,this.between(7,18));});
    },'walk');
  }
  update(dt,actor=null){
    if(dt<=0)return;
    this.companion=actor;
    const bounded=value=>Math.max(0,Math.min(100,value)),resting=!this.motion.busy;
    this.modeTime+=dt;this.hunger=bounded(this.hunger-dt*.36*CABIN_PACE.catDecay);
    this.energy=bounded(this.energy+dt*(resting&&this.mode==='sleep'?3:-.25*CABIN_PACE.catDecay));
    this.groomNeed=bounded(this.groomNeed+dt*(resting&&this.mode==='groom'?-4:.22*CABIN_PACE.catDecay));
    this.curiosity=bounded(this.curiosity+dt*(this.motion.busy?-.8:.3));
    this.motion.update(dt);
    if(this.mode==='play'){
      if(this.playRelease){
        this.playRelease.age=Math.min(1.2,this.playRelease.age+dt);
        if(this.playRelease.age===1.2){this.playRelease=null;this.mode='look';this.modeTime=Math.min(this.modeTime,1.5);this.remaining=this.pendingMove?CAT_RISE_TIME:5;}
        return;
      }
      if(this.playHost?.isSeatedInLounge()&&this.playHost.leisure==='cat'&&this.hunger>25){this.remaining=5;this.curiosity=bounded(this.curiosity-dt*2);return;}
      this.playHost=null;this.playRelease={age:0};return;
    }
    if(this.mode==='follow'){
      this.followLeft-=dt;this.retargetIn-=dt;
      if(!actor?.busy||actor.climbing||actor.waitingForHatch||actor.floor!==this.motion.floor||this.followLeft<=0||this.hunger<25||(actor.x-this.motion.x)*actor.facing<25){this.endFollow();return;}
      this.motion.walkSpeed=Math.min(68,actor.walkSpeed*1.12);
      if(this.retargetIn<=0){
        const x=Math.max(170,Math.min(this.motion.floor===0?CAT_SOFA.floorX:1220,actor.x-actor.facing*48));
        if(Math.abs(x-this.motion.x)>12)this.motion.goTo({floor:actor.floor,x});
        this.retargetIn=.6;
      }
      return;
    }
    if(this.mode==='fetch'||this.motion.busy)return;
    if(this.pendingMove){this.remaining-=dt;if(this.remaining<=0){const {run}=this.pendingMove;this.pendingMove=null;run();}return;}
    if(this.hunger<25&&this.care.has('catfood')){this.fetch();return;}
    this.remaining-=dt;if(this.remaining>0)return;
    if(this.mode==='eat')this.groomNeed=Math.min(100,this.groomNeed+25);
    this.choose();
  }
  fetch(){if(this.mode==='fetch'||this.pendingMove?.kind==='fetch')return;this.depart(()=>{this.mode='fetch';this.modeTime=0;this.motion.walkSpeed=36;this.motion.goTo({floor:CAT_BOWL.floor,x:CAT_BOWL.approachX},()=>{if(this.care.take('catfood')){this.motion.facing=-1;this.hunger=100;this.rest('eat',8);}else this.rest('groom',4);});},'fetch');}
}

export function currentAction(brain){return brain.bathroom?.id??brain.reclineExit?.id??(brain.bunkVisit?'bunk':brain.gymVisit?'gym':brain.loungeEntry||brain.loungeExit||brain.state==='playingGame'?'lounge':['reading','orderingSupply'].includes(brain.state)?'console':brain.state==='performing'?brain.cur?.id:null);}
export {FLOORS,getStation};
