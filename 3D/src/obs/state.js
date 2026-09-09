import {FLOORS,LADDER_X,getStation,CAT_PORT,CAT_BOWL} from './layout.js';

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
  constructor(options={}){super({floor:0,x:1035,walkSpeed:36,...options});this.z=CAT_PORT.walkZ;this.portalWalkDistance=0;this.portal=null;this.destination=null;this.onDestination=null;}
  get busy(){return Boolean(this.portal)||super.busy;}
  get climbing(){return false;}
  get hidden(){return this.portal?.phase==='transit';}
  goTo(target,onArrive){
    if(!target||!FLOORS[target.floor])return;
    this.commandVersion++;this.destination={floor:target.floor,x:target.x};this.onDestination=onArrive||null;
    // Finish an occupied passage before following a changed destination.
    if(!this.portal)this.plan();
  }
  plan(){
    if(!this.destination)return;
    const crossing=this.destination.floor!==this.floor;
    this.queue=[{type:'walk',x:crossing?CAT_PORT.x:this.destination.x}];
    this.onArrive=()=>{
      if(crossing){this.portal={from:this.floor,to:this.destination.floor,phase:'turnIn',age:0,duration:.4,yaw:this.facing*Math.PI/2};return;}
      const callback=this.onDestination;this.destination=null;this.onDestination=null;callback?.();
    };
  }
  update(dt){
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
  constructor(care){this.care=care;this.motion=new CatMotion();this.hunger=68;this.mode='sleep';this.modeTime=0;this.remaining=10;this.wanderIndex=0;}
  rest(mode,duration){this.mode=mode;this.modeTime=0;this.remaining=duration;}
  update(dt){
    this.modeTime+=dt;this.hunger=Math.max(0,this.hunger-dt*.36);this.motion.update(dt);
    if(this.mode==='fetch'||this.motion.busy)return;
    if(this.hunger<42&&this.care.has('catfood')){this.fetch();return;}
    this.remaining-=dt;if(this.remaining>0)return;
    if(this.mode==='eat'){this.rest('groom',7);return;}
    const places=[{floor:0,x:840},{floor:1,x:940},{floor:2,x:1155},{floor:1,x:510},{floor:0,x:1060}];
    const target=places[this.wanderIndex++%places.length];this.mode='walk';this.modeTime=0;this.motion.goTo(target,()=>this.rest(this.wanderIndex%2?'groom':'sleep',12+this.wanderIndex%3*4));
  }
  fetch(){if(this.mode==='fetch')return;this.mode='fetch';this.modeTime=0;this.motion.goTo({floor:CAT_BOWL.floor,x:CAT_BOWL.approachX},()=>{if(this.care.take('catfood')){this.motion.facing=-1;this.hunger=100;this.rest('eat',8);}else this.rest('groom',4);});}
}

export function currentAction(brain){return brain.state==='playingGame'?'lounge':['reading','orderingSupply'].includes(brain.state)?'console':brain.state==='performing'?brain.cur?.id:null;}
export {FLOORS,getStation};
