import {ASHTRAY,CABIN_AISLE} from './layout.js';
import {angleDelta,headingEase} from './heading.js';

const clamp=t=>Math.max(0,Math.min(1,t));
const smooth=t=>{t=clamp(t);return t*t*(3-2*t);};
const mix=(a,b,t)=>a+(b-a)*t;
const durations={turnIn:1.6,approach:2.8,settle:1.4,smoke:22,extinguish:3.8,turnOut:2.2,return:2.8,align:1.6};
export const SMOKING_SECONDS=Object.values(durations).reduce((a,b)=>a+b,0);
export const LOUNGE_SMOKING_SECONDS=durations.smoke+durations.extinguish;
export const SMOKING_INTERVAL={min:8*60,max:15*60};
const CIGARETTE_LIT_AT=3.45;

// Running time, not calendar time or a per-frame lottery. Reset after returning
// to the aisle, including interrupted visits, so one break cannot chain to another.
export class SmokingClock {
  constructor(random=Math.random){this.random=random;this.reset();}
  reset(){this.remaining=mix(SMOKING_INTERVAL.min,SMOKING_INTERVAL.max,this.random());}
  update(dt,occupied=false){if(Number.isFinite(dt)&&dt>0&&!occupied)this.remaining=Math.max(0,this.remaining-dt);}
  get due(){return this.remaining<=0;}
}

const weights=id=>['pocket','rest','mouth','ash'].map(key=>key===id?1:0);
const blend=(a,b,t)=>a.map((n,i)=>mix(n,b[i],smooth(t)));
const rests=weights('rest'),ash=weights('ash');
const gestures=[[0,'pocket'],[1.4,'rest'],[2.8,'mouth'],[4.8,'mouth'],[6,'rest'],[8,'rest'],[9.3,'mouth'],[11,'mouth'],[12.3,'rest'],[13.3,'ash'],[14,'ash'],[15,'rest'],[15.5,'rest'],[16.8,'mouth'],[18.6,'mouth'],[20,'rest'],[22,'rest']];
export function smokingGesture(time){
  let hand=rests;
  for(let i=1;i<gestures.length;i++)if(time<=gestures[i][0]){
    const [a,p]=gestures[i-1],[b,q]=gestures[i];hand=blend(weights(p),weights(q),(time-a)/(b-a));break;
  }
  const lighter=smooth((time-1.2)/1.6)*(1-smooth((time-4.1)/1.3));
  const exhale=[[5.8,7.4],[12,13.1],[19.6,21.2]].some(([a,b])=>time>=a&&time<b);
  return{hand,reach:smooth(time/.55),cigarette:time>=.45,lighter,lid:smooth((time-1.8)/.7)*(1-smooth((time-4.1)/.25)),strike:smooth((time-3.0)/.12),flame:time>=3.1&&time<4.22,lit:time>=CIGARETTE_LIT_AT,
    inhale:time>=CIGARETTE_LIT_AT&&hand[2]>.99,exhale,tap:time>=13.3&&time<=14?Math.sin((time-13.3)*Math.PI*6)*.012:0,
    label:time<4.1?'煙草に火をつける':hand[3]>.5?'灰を落とす':'灰皿の前で一服している'};
}

export class SmokingVisit {
  constructor({seated=false}={}){this.seated=seated;this.phase=seated?'smoke':'turnIn';this.age=0;this.startYaw=null;this.exitRequested=false;this.finishFrom=null;}
  requestExit(){
    this.exitRequested=true;
    if(this.phase==='smoke')this.finish();
  }
  finish(){this.finishFrom=smokingGesture(this.age);this.phase='extinguish';this.age=0;}
  update(dt){
    if(!Number.isFinite(dt)||dt<=0)return 0;
    let smokingTime=0;
    while(dt>0&&!this.done){
      const step=Math.min(dt,durations[this.phase]-this.age);
      if(this.phase==='smoke')smokingTime+=Math.max(0,this.age+step-Math.max(this.age,CIGARETTE_LIT_AT));
      this.age+=step;dt-=step;
      if(this.age<durations[this.phase]-1e-8)break;
      if(this.phase==='smoke'){this.finish();continue;}
      if(this.seated&&this.phase==='extinguish'){this.phase='done';this.age=0;break;}
      const order=Object.keys(durations),index=order.indexOf(this.phase);
      this.phase=this.phase==='settle'&&this.exitRequested?'turnOut':order[index+1]??'done';this.age=0;
    }
    return smokingTime;
  }
  get done(){return this.phase==='done';}
  get pose(){
    const phase=this.phase,u=this.done?1:clamp(this.age/durations[phase]);
    const start=this.startYaw??Math.PI/2,entry=start+angleDelta(start,Math.PI);
    const facing=entry+angleDelta(entry,-2.55),out=facing+angleDelta(facing,0),end=out+angleDelta(out,start);
    let depth=ASHTRAY.standZ,yaw=facing,turn=null,gesture=null;
    if(phase==='turnIn'){depth=CABIN_AISLE.crewZ;turn={from:start,to:entry};}
    if(phase==='approach'){depth=mix(CABIN_AISLE.crewZ,ASHTRAY.standZ,smooth(u));yaw=entry;}
    if(phase==='settle')turn={from:entry,to:facing};
    if(phase==='smoke')gesture=smokingGesture(this.age);
    if(phase==='extinguish'){
      const source=this.finishFrom,t=this.age,release=smooth((t-2.3)/1.5);
      gesture={...source,hand:blend(blend(source.hand,ash,t/1.4),rests,release),reach:1-release,
        lighter:source.lighter*(1-smooth(t/.8)),lid:(source.lid??0)*(1-smooth(t/.3)),flame:false,lit:source.lit&&t<1.8,inhale:false,exhale:false,
        cigarette:source.cigarette&&t<2.3,extinguish:smooth(t/1.4),tap:t>=1.4&&t<2.1?Math.sin(t*15)*.003:0,label:'灰皿で火を消す'};
    }
    if(phase==='turnOut')turn={from:facing,to:out};
    if(phase==='return'){depth=mix(ASHTRAY.standZ,CABIN_AISLE.crewZ,smooth(u));yaw=out;}
    if(phase==='align'){depth=CABIN_AISLE.crewZ;turn={from:out,to:end};}
    if(this.done){depth=CABIN_AISLE.crewZ;yaw=end;}
    if(turn){turn.progress=u;yaw=mix(turn.from,turn.to,headingEase(u));}
    const moving=phase==='approach'||phase==='return';
    return{phase,depth,yaw,turn,gesture,moving,walkDistance:Math.abs(CABIN_AISLE.crewZ-ASHTRAY.standZ)*smooth(u),
      walkWeight:moving?smooth(this.age/.32)*smooth((durations[phase]-this.age)/.32):0};
  }
}
