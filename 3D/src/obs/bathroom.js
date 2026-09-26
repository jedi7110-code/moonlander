import {animatePocketShutter} from './shutter.js';

const smooth=t=>t*t*(3-2*t);
const phases=[['reach',1.4],['open',.7],['enter',2.8],['close',.7],['use',Infinity],['reopen',1.8],['leave',2.8],['shut',.7]];
export const BATHROOM_OUTSIDE_DEPTH=.78,BATHROOM_INSIDE_DEPTH=-2.8;
// A longer visual turn must not charge extra hunger/thirst to the visit.
export const BATHROOM_TURN_DECAY={reach:.4/1.4,reopen:.7/1.8};

export function animateBathroom(fixture,pose=null){
  animatePocketShutter(fixture.door,pose?.opening??0);
  const {lamp}=fixture,material=lamp.material;
  // Pocket-door materials are cloned per fixture, so the other room and all
  // shared cyan indicators stay unchanged. Preserve the original idle glow.
  const available=lamp.userData.available??={color:material.color.clone(),emissive:material.emissive.clone()};
  if(pose?.inside){
    material.color.setHex(0xe23832);material.emissive.setHex(0xff1e14);
  }else{
    material.color.copy(available.color);material.emissive.copy(available.emissive);
  }
}

export class BathroomVisit {
  constructor(id,{entered,exited}={}){this.id=id;this.index=0;this.age=0;this.entered=entered;this.exited=exited;this.exitRequested=false;this.done=false;}
  get phase(){return phases[this.index][0];}
  requestExit(){this.exitRequested=true;if(this.phase==='use'){this.index=5;this.age=0;}}
  update(dt){
    while(dt>0&&!this.done){
      if(this.phase==='use')return;
      const duration=phases[this.index][1],step=Math.min(dt,duration-this.age);this.age+=step;dt-=step;
      if(this.age<duration)return;
      this.age=0;this.index++;
      if(this.index===4){if(this.exitRequested)this.index=5;else this.entered?.();}
      if(this.index===phases.length){this.index--;this.done=true;this.exited?.();}
    }
  }
  get pose(){
    if(this.done)return{opening:0,depth:.78,moving:false,inside:false,reach:0};
    const phase=this.phase,t=this.age/phases[this.index][1],s=smooth(t);
    const opening=phase==='open'||phase==='reopen'?s:phase==='close'||phase==='shut'?1-s:['enter','leave'].includes(phase)?1:0;
    const outside=BATHROOM_OUTSIDE_DEPTH,inside=BATHROOM_INSIDE_DEPTH;
    const depth=phase==='enter'?outside+(inside-outside)*s:phase==='leave'?inside+(outside-inside)*s:['close','use','reopen'].includes(phase)?inside:outside;
    // Automatic doors: turn toward the opening, then walk through the cleared frame.
    return{opening,depth,walkDistance:Math.abs(depth-(phase==='enter'?outside:inside)),moving:['enter','leave'].includes(phase),inside:depth<-1.72,reach:0,turn:phase==='reach'?s:1,yaw:phase==='reopen'?Math.PI*(1-s):['leave','shut'].includes(phase)?0:Math.PI,phase,turnProgress:t};
  }
}
