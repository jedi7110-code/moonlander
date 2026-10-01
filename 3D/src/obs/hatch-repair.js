import {CABIN_AISLE} from './layout.js';
import {angleDelta,headingEase} from './heading.js';

// Keep the working shoulder beside the new lock, on the crew-lane side.
export const HATCH_REPAIR_DEPTH=CABIN_AISLE.crewZ+.14;
export const HATCH_REPAIR_PHASES={turnIn:1.4,approach:2.0,align:1.4,inspect:4,repair:10,verify:4,release:1.2,turnOut:1.4,return:2.0,alignOut:1.4};
const order=Object.keys(HATCH_REPAIR_PHASES);
const clamp=t=>Math.max(0,Math.min(1,t));
const smooth=t=>{t=clamp(t);return t*t*(3-2*t);};
const mix=(a,b,t)=>a+(b-a)*t;
export const HATCH_REPAIR_LABELS={
  turnIn:['船内ハッチを点検に向かう','Approaching the inner hatch'],approach:['船内ハッチを点検に向かう','Approaching the inner hatch'],align:['船内ハッチを点検に向かう','Approaching the inner hatch'],
  inspect:['扉のロックを点検中','Inspecting the hatch lock'],repair:['扉のロックを修理中','Repairing the hatch lock'],verify:['ロックの復旧を確認中','Checking the repaired lock'],
  release:['工具をしまう','Putting the tool away'],turnOut:['ハッチの点検を終える','Finishing the hatch check'],return:['通路に戻る','Returning to the aisle'],alignOut:['通路に戻る','Returning to the aisle'],done:['点検完了','Inspection complete'],
};

export class HatchRepairVisit {
  constructor(serial){this.serial=serial;this.phase='turnIn';this.age=0;this.startYaw=null;this.cancelled=false;this.repaired=false;this.releaseFrom=null;}
  requestExit(){
    if(this.done||['release','turnOut','return','alignOut'].includes(this.phase))return;
    this.cancelled=true;
    // Finish any step/turn first. Hands always withdraw before walking away.
    if(['inspect','repair','verify'].includes(this.phase)){this.releaseFrom=this.pose;this.phase='release';this.age=0;}
  }
  update(dt){
    if(!Number.isFinite(dt)||dt<=0)return;
    while(dt>0&&!this.done){
      const duration=HATCH_REPAIR_PHASES[this.phase],step=Math.min(dt,duration-this.age);
      this.age+=step;dt-=step;
      if(this.age<duration-1e-8)break;
      if(this.phase==='verify'&&!this.cancelled)this.repaired=true;
      if(['verify','align'].includes(this.phase))this.releaseFrom=this.pose;
      this.phase=this.phase==='align'&&this.cancelled?'release':order[order.indexOf(this.phase)+1]??'done';this.age=0;
    }
  }
  get done(){return this.phase==='done';}
  get pose(){
    const phase=this.phase,duration=HATCH_REPAIR_PHASES[phase]??1,u=clamp(this.age/duration);
    const start=this.startYaw??Math.PI/2,into=start+angleDelta(start,Math.PI),face=into+angleDelta(into,Math.PI/2),out=face+angleDelta(face,0),end=out+angleDelta(out,start);
    let depth=HATCH_REPAIR_DEPTH,yaw=face,turn=null,reach=0,tool=false,twist=0;
    if(phase==='turnIn'){depth=CABIN_AISLE.crewZ;turn={from:start,to:into};}
    if(phase==='approach'){depth=mix(CABIN_AISLE.crewZ,HATCH_REPAIR_DEPTH,smooth(u));yaw=into;}
    if(phase==='align')turn={from:into,to:face};
    if(phase==='inspect')reach=.6*smooth(this.age/1.3)*(1-smooth((this.age-2.8)/1.2));
    if(phase==='repair'){reach=smooth(this.age/1.4)*(1-smooth((this.age-8.6)/1.4));tool=true;twist=Math.sin(this.age*3.2)*.28*reach;}
    if(phase==='verify')reach=smooth(this.age/1.2)*(1-smooth((this.age-2.8)/1.2));
    if(phase==='release'&&this.releaseFrom){reach=this.releaseFrom.reach*(1-smooth(u));tool=this.releaseFrom.tool;twist=this.releaseFrom.twist*(1-smooth(u));}
    if(phase==='turnOut')turn={from:face,to:out};
    if(phase==='return'){depth=mix(HATCH_REPAIR_DEPTH,CABIN_AISLE.crewZ,smooth(u));yaw=out;}
    if(phase==='alignOut'){depth=CABIN_AISLE.crewZ;turn={from:out,to:end};}
    if(this.done){depth=CABIN_AISLE.crewZ;yaw=end;}
    if(turn){turn.progress=u;yaw=mix(turn.from,turn.to,headingEase(u));}
    const moving=['approach','return'].includes(phase);
    return{phase,depth,yaw,turn,reach,tool,twist,moving,
      walkDistance:Math.abs(CABIN_AISLE.crewZ-HATCH_REPAIR_DEPTH)*smooth(u),
      walkWeight:moving?smooth(this.age/.3)*smooth((duration-this.age)/.3):0};
  }
}
