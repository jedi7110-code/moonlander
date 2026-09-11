import {BUNK_BED,BUNK_TRAY} from './recline.js';

export const BUNK_LIFT_SECONDS=.9;
export const BUNK_PHASE_SECONDS={approaching:1,opening:2.4,extending:1.4,sitting:1.8,settled:.35,lowering:3,entering:1.4,closing:2.7,waking:2.7,leaving:1.4,rising:3,seated:.35,standing:1.8,retracting:1.4,sealing:2.4,departing:1};
export const BUNK_TRANSITION_DECAY=2.76/Object.values(BUNK_PHASE_SECONDS).reduce((sum,seconds)=>sum+seconds,0);
const smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};

export class BunkVisit {
  constructor({entered=()=>{},exited=()=>{}}={}){
    this.phase='approaching';this.age=0;this.entered=entered;this.exited=exited;this.exitRequested=false;
  }
  requestExit(){
    this.exitRequested=true;
    if(this.phase==='sleeping'){this.phase='waking';this.age=0;}
  }
  update(dt){
    let remaining=Math.max(0,dt);
    while(remaining>0&&this.phase!=='sleeping'&&this.phase!=='done'){
      const duration=BUNK_PHASE_SECONDS[this.phase],step=Math.min(remaining,duration-this.age);
      this.age+=step;remaining-=step;
      if(this.age<duration-1e-9)break;
      const next={approaching:'opening',opening:'extending',extending:'sitting',sitting:'settled',settled:'lowering',lowering:'entering',entering:'closing',closing:'sleeping',waking:'leaving',leaving:'rising',rising:'seated',seated:'standing',standing:'retracting',retracting:'sealing',sealing:'departing',departing:'done'};
      const cancelled={approaching:'departing',opening:'sealing',extending:'retracting',sitting:'standing',settled:'standing',lowering:'rising',entering:'leaving',closing:'waking'};
      this.phase=(this.exitRequested&&cancelled[this.phase])||next[this.phase];this.age=0;
      if(this.phase==='sleeping'){
        if(this.exitRequested){this.phase='waking';}else this.entered();
      }
      if(this.phase==='done')this.exited();
    }
  }
  get pose(){
    const phase=this.phase,t=smooth(this.age/(BUNK_PHASE_SECONDS[phase]??1));
    const recline=phase==='lowering'?t:phase==='rising'?1-t:['entering','closing','sleeping','waking','leaving'].includes(phase)?1:0;
    const tray=['extending','leaving'].includes(phase)?t:['entering','retracting'].includes(phase)?1-t:['sitting','settled','lowering','rising','seated','standing'].includes(phase)?1:0;
    const seat=phase==='sitting'?t:phase==='standing'?1-t:['settled','lowering','entering','closing','sleeping','waking','leaving','rising','seated'].includes(phase)?1:0;
    const approach=phase==='approaching'?t:phase==='departing'?1-t:phase==='done'?0:1;
    const turn=smooth((recline-.24)/.48),trayDepth=BUNK_BED.depth+BUNK_TRAY.travel*tray;
    const standing=BUNK_TRAY.walkDepth+(BUNK_TRAY.standingDepth-BUNK_TRAY.walkDepth)*approach;
    const depth=(standing+(BUNK_TRAY.seatDepth-standing)*seat)*(1-turn)+trayDepth*turn;
    const opening=phase==='opening'||phase==='waking',closing=phase==='closing'||phase==='sealing';
    const turnSeconds=BUNK_PHASE_SECONDS[phase]-BUNK_LIFT_SECONDS;
    const raised=!['approaching','sleeping','departing','done'].includes(phase)?1:0;
    // Lift the entire head hinge before rotating; lower it only after the lid is level.
    const open=opening?smooth((this.age-BUNK_LIFT_SECONDS)/turnSeconds):closing?1-smooth(this.age/turnSeconds):raised;
    const lift=opening?smooth(this.age/BUNK_LIFT_SECONDS):closing?1-smooth((this.age-turnSeconds)/BUNK_LIFT_SECONDS):raised;
    return {phase,age:this.age,approach,seat,recline,turn,tray,depth,open,lift,occupied:seat>0,light:phase==='sleeping'?.05:phase==='closing'?1-.95*t:phase==='waking'?.05+.95*t:1};
  }
}
