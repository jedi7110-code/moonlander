export const IDLE_CAMERA_WAIT_MS=2*60*1000;
export const IDLE_CAMERA_FOLLOW_MS=2*60*1000;

// Wall-clock time, independent of cabin time and the render loop's clamped dt.
export class IdleCamera {
  constructor(view,{now=()=>performance.now(),random=Math.random}={}){
    this.view=view;this.now=now;this.random=random;
    this.idleSince=now();this.followSince=null;this.automaticMode=null;
    this.changingMode=false;this.heldPointers=new Set();
  }
  reset(now){this.idleSince=now;this.followSince=null;this.automaticMode=null;}
  setMode(mode){
    this.changingMode=true;
    try{this.view.setMode(mode);}finally{this.changingMode=false;}
  }
  modeChanged(){if(!this.changingMode)this.reset(this.now());}
  activity(now=this.now()){
    const returnToWide=this.automaticMode!==null&&this.view.mode===this.automaticMode;
    this.reset(now);
    if(returnToWide)this.setMode('all');
  }
  update(now=this.now(),{blocked=false}={}){
    if(blocked||this.heldPointers.size){this.activity(now);return;}
    if(this.automaticMode!==null){
      if(this.view.mode!==this.automaticMode){this.reset(now);return;}
      if(now-this.followSince>=IDLE_CAMERA_FOLLOW_MS)this.activity(now);
      return;
    }
    // The +/- buttons can change magnification while retaining the 'all' mode.
    if(this.view.mode!=='all'||Math.abs(this.view.zoom-1)>1e-6){this.idleSince=now;return;}
    if(now-this.idleSince<IDLE_CAMERA_WAIT_MS)return;
    this.automaticMode=this.random()<.5?'milo':'cat';this.followSince=now;
    this.setMode(this.automaticMode);
  }
  bindActivity(target){
    const events=['pointermove','pointerdown','pointerup','pointercancel','wheel','keydown','focusin','visibilitychange'];
    const options={capture:true,passive:true};
    const listener=event=>{
      if(event.type==='pointerdown')this.heldPointers.add(event.pointerId);
      if(event.type==='pointerup'||event.type==='pointercancel')this.heldPointers.delete(event.pointerId);
      if(event.type==='visibilitychange')this.heldPointers.clear();
      this.activity();
    };
    const blur=()=>{this.heldPointers.clear();this.activity();};
    events.forEach(type=>target.addEventListener(type,listener,options));
    target.defaultView?.addEventListener('blur',blur);
    return()=>{
      events.forEach(type=>target.removeEventListener(type,listener,options));
      target.defaultView?.removeEventListener('blur',blur);this.heldPointers.clear();
    };
  }
}
