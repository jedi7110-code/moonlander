const smooth=(t,a,b)=>{const x=Math.max(0,Math.min(1,(t-a)/(b-a)));return x*x*(3-2*x);};
export const GYM_MOUNT_SECONDS=3.2;
export const GYM_BRAKE_SECONDS=1.2;
export const GYM_DISMOUNT_SECONDS=2.75;

export class GymVisit {
  constructor({pedalTime=0,entered=()=>{},exited=()=>{}}={}){
    this.phase='mount';this.age=0;this.pedalTime=pedalTime;this.entered=entered;this.exited=exited;this.exitRequested=false;
  }
  requestExit(){
    this.exitRequested=true;
    if(this.phase==='cycle'){this.brakeSpeed=smooth(this.age,0,1.2);this.phase='brake';this.age=0;}
  }
  update(dt){
    if(dt<=0||this.phase==='done')return;
    let remaining=dt;
    while(remaining>1e-8&&this.phase!=='done'){
      const duration={mount:GYM_MOUNT_SECONDS,brake:GYM_BRAKE_SECONDS,dismount:GYM_DISMOUNT_SECONDS}[this.phase]??Infinity;
      const step=Math.min(remaining,duration-this.age),before=this.age;
      this.age+=step;remaining-=step;
      // Integrate the smooth speed ramp so the rider and cranks share one phase.
      const integral=t=>{const x=Math.min(t/1.2,1);return 1.2*(x*x*x-.5*x*x*x*x)+Math.max(0,t-1.2);};
      if(this.phase==='cycle')this.pedalTime+=integral(this.age)-integral(before);
      if(this.phase==='brake')this.pedalTime+=this.brakeSpeed*(step-integral(this.age)+integral(before));
      if(this.age<duration)continue;
      if(this.phase==='mount'){
        this.phase='cycle';this.age=0;
        if(this.exitRequested)this.requestExit();else this.entered();
      }else if(this.phase==='brake'){this.phase='dismount';this.age=0;}
      else{this.phase='done';this.exited();}
    }
  }
  get pose(){
    const t=this.phase==='mount'?Math.max(0,this.age-.45):this.phase==='dismount'?GYM_DISMOUNT_SECONDS-this.age:this.phase==='done'?0:GYM_DISMOUNT_SECONDS;
    const weight=smooth(t,.65,2.3);
    return {pedalTime:this.pedalTime,turn:this.phase==='mount'?smooth(this.age,0,.45):1,weight,
      depth:.78-.48*weight,grip:smooth(t,0,.8),nearFoot:smooth(t,.35,1.3),farFoot:smooth(t,1.35,2.65)};
  }
}
