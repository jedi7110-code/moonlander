const smooth=t=>t*t*(3-2*t);
const phases=[['reach',.4],['open',.7],['enter',1.1],['close',.7],['use',Infinity],['reopen',.7],['leave',1.1],['shut',.7]];

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
    const depth=phase==='enter'?.78-1.08*s:phase==='leave'?-.30+1.08*s:['close','use','reopen'].includes(phase)?-.30:.78;
    return{opening,depth,moving:['enter','leave'].includes(phase),inside:depth<.4,reach:phase==='reach'?Math.sin(Math.PI*t):0,turn:phase==='reach'?s:1,yaw:phase==='reopen'?Math.PI*(1-s):['leave','shut'].includes(phase)?0:Math.PI,phase};
  }
}
