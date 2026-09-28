import {MouseChase} from './lucy-run-motion.js';
import {CAT_PORT,FLOORS} from './layout.js';
import {createCatTurn,angleDelta} from './cat-turn.js';
import {MOUSE_ROUTES} from './mouse-route.js';

const toWorld=x=>(x-700)*.022,toCabin=x=>700+x/.022;
const INTERRUPTIBLE=new Set(['idle','look','sleep','groom','stretch','prone','walk','follow']);

// Neither animal changes decks during pursuit.
export class CabinMouseChase {
  constructor({random=Math.random}={}){
    this.random=random;this.sim=new MouseChase({random});this.sim.wait=Infinity;
    this.wait=75+random()*85;this.center=0;this.controlled=false;this.preparing=false;
  }
  get mouse(){return {...this.sim.mouse,x:this.center+this.sim.mouse.x};}
  get direction(){return this.sim.direction;}
  get pose(){return this.controlled?this.sim.cat:null;}
  canReact(cat){
    const m=cat.motion;
    return !cat.bunkWake&&!cat.pendingMove&&!cat.playHost&&!m.onSofa&&!m.hop&&!m.portal&&!m.turn
      &&!m.waitingForCrew&&!m.waitingForDroid&&m.elevation===0&&Math.abs(m.z-CAT_PORT.walkZ)<.001
      &&cat.hunger>25&&cat.energy>20&&INTERRUPTIBLE.has(cat.mode);
  }
  sync(cat){
    const m=cat.motion,c=this.sim.cat;
    Object.assign(c,{x:toWorld(m.x)-this.center,floor:m.floor,z:m.z,yaw:cat.poseYaw??m.facing*Math.PI/2,speed:0});
  }
  appear(cat,floor=Math.min(FLOORS.length-1,Math.floor(this.random()*FLOORS.length))){
    if(this.sim.active||!FLOORS[floor])return false;
    this.sim.route=MOUSE_ROUTES[floor];
    this.center=this.sim.route.center;this.sync(cat);
    this.sim.appear(floor);this.sim.cat.floor=-1;
    if(floor===cat.motion.floor&&this.canReact(cat)){
      this.preparing=true;
      cat.depart(()=>this.begin(cat),'mouse');
    }
    return true;
  }
  begin(cat){
    this.preparing=false;
    if(!this.sim.active||!this.sim.mouse.visible||this.sim.mouse.floor!==cat.motion.floor||!this.canReact(cat))return;
    this.sync(cat);
    const c=this.sim.cat,m=cat.motion;
    this.sim.startYaw=c.yaw;this.sim.turnDelta=angleDelta(c.yaw,this.direction*Math.PI/2);this.sim.turnAge=0;
    c.phase=this.sim.mouse.phase==='run'?'notice':'watch';c.age=0;c.distance=0;
    this.controlled=true;m.chase=c;m.queue=[];m.onArrive=null;m.destination=null;m.onDestination=null;
    delete m.pendingHeading;m.waitingForCrew=false;m.waitingForDroid=false;
    cat.mode='chase';cat.modeTime=0;cat.remaining=0;cat.restYaw=null;
  }
  cancel(cat){
    if(this.controlled){cat.motion.chase=null;cat.motion.turn=null;cat.mode='idle';cat.modeTime=0;cat.remaining=0;}
    if(cat.pendingMove?.kind==='mouse')cat.pendingMove=null;
    this.controlled=false;this.preparing=false;this.sim.cat.floor=-1;this.sim.cat.speed=0;this.sim.cat.phase='idle';
  }
  update(dt,cat){
    if(!(dt>0))return false;
    if(!this.sim.active){
      this.wait-=dt;
      if(this.wait<=0)this.appear(cat);
      return this.controlled;
    }
    const wasControlled=this.controlled,previous=this.sim.cat.distance;
    this.sim.update(dt);
    if(this.controlled){
      const c=this.sim.cat,m=cat.motion;
      m.x=toCabin(this.center+c.x);m.heading=c.yaw;m.facing=this.direction;
      m.walkDistance+=(c.distance-previous)/.022;
      if(c.phase==='turn'){
        m.turn=createCatTurn(this.sim.startYaw,this.sim.startYaw+this.sim.turnDelta,{duration:1.15});m.turn.age=this.sim.turnAge;
      }else m.turn=null;
    }
    if(!this.sim.active){
      this.cancel(cat);this.wait=75+this.random()*85;
      if(wasControlled){
        // Hold the final heading through the stop, then let ordinary needs pick
        // the next action. Do not immediately turn to a random resting heading.
        cat.mode='idle';cat.modeTime=0;cat.remaining=2.5;
      }
    }
    return wasControlled||this.controlled;
  }
}
