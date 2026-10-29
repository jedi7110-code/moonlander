import {sampleGrooming,GROOMING_DURATION,VANITY} from './grooming.js';
import {angleDelta,headingEase} from './heading.js';

const clamp=t=>Math.max(0,Math.min(1,t));
const smooth=t=>{t=clamp(t);return t*t*(3-2*t);};
const turn=(from,to,t)=>from+angleDelta(from,to)*headingEase(t);
export const GROOMING_TURN_SECONDS=2;
export const GROOMING_VISIT_SECONDS=GROOMING_DURATION+2*GROOMING_TURN_SECONDS;
export const HAIR_GROWTH_SECONDS=15*60;
export const AUTO_GROOMING_SECONDS=20*60;

// Count running seconds since the last completed haircut, independently of the
// ship calendar. Pausing, board games and the grooming visit suspend this clock.
export class HairGrowthClock {
  constructor(){this.age=0;}
  update(dt,grooming=false){if(Number.isFinite(dt)&&dt>0&&!grooming)this.age+=dt;}
  get progress(){return clamp(this.age/HAIR_GROWTH_SECONDS);}
  get due(){return this.age>=AUTO_GROOMING_SECONDS-1e-8;}
  reset(){this.age=0;}
}

export class GroomingVisit {
  constructor(progress){this.age=0;this.initialGrowth=clamp(progress);this.startYaw=null;}
  update(dt){
    if(!Number.isFinite(dt)||dt<=0)return;
    this.age=Math.min(GROOMING_VISIT_SECONDS,this.age+dt);
    if(GROOMING_VISIT_SECONDS-this.age<1e-8)this.age=GROOMING_VISIT_SECONDS;
  }
  get time(){return Math.max(0,Math.min(GROOMING_DURATION,this.age-GROOMING_TURN_SECONDS));}
  get done(){return this.age>=GROOMING_VISIT_SECONDS;}
  get pose(){
    const pose=sampleGrooming(this.time),start=this.startYaw??Math.PI;
    // Keep one continuous angle branch through the doorway, mirror and exit.
    const entryYaw=start+angleDelta(start,Math.PI),roomYaw=entryYaw+pose.yaw-Math.PI;
    const yaw=this.age<GROOMING_TURN_SECONDS?turn(start,entryYaw,this.age/GROOMING_TURN_SECONDS):this.time>=GROOMING_DURATION?turn(roomYaw,start,(this.age-GROOMING_TURN_SECONDS-GROOMING_DURATION)/GROOMING_TURN_SECONDS):roomYaw;
    // Step up inside the gate and back down before returning to the aisle.
    const standingTurn=this.age<GROOMING_TURN_SECONDS?{from:start,to:entryYaw,progress:this.age/GROOMING_TURN_SECONDS}:this.time>=GROOMING_DURATION?{from:roomYaw,to:start,progress:(this.age-GROOMING_TURN_SECONDS-GROOMING_DURATION)/GROOMING_TURN_SECONDS}:null;
    return {...pose,yaw,standingTurn,arrivalWeight:1-headingEase(this.age/.75),floor:VANITY.floor*smooth((-pose.z-1.20)/.40),
      hair:pose.hair*this.initialGrowth,beard:pose.beard*this.initialGrowth};
  }
}
