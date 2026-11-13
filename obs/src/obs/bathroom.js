import {animatePocketShutter} from './shutter.js';
import {updateBathroomCeilingLight} from './bathroom-lighting.js';
import {planMiloWalk,miloWalkState} from './milo-gait.js';
import {CREW_WALK_SPEED} from './pace.js';

const smooth=t=>t*t*(3-2*t);
export const BATHROOM_OUTSIDE_DEPTH=.78,BATHROOM_INSIDE_DEPTH=-2.8;
// The way in and out is a planned walk from standing to standing (milo-gait.js), at the
// cabin's walking speed: Milo sets off, takes his steps and stops with the feet together.
export const BATHROOM_PASSAGE=planMiloWalk(BATHROOM_OUTSIDE_DEPTH-BATHROOM_INSIDE_DEPTH,CREW_WALK_SPEED*.022);
const phases=[['reach',1.4],['open',.7],['enter',BATHROOM_PASSAGE.duration],['close',.7],['use',Infinity],['reopen',1.8],['leave',BATHROOM_PASSAGE.duration],['shut',.7]];
// A longer visual turn must not charge extra hunger/thirst to the visit.
// (nor must the walk through the door, which takes its natural time now instead of 2.8 seconds)
export const BATHROOM_TURN_DECAY={reach:.4/1.4,reopen:.7/1.8,enter:2.8/BATHROOM_PASSAGE.duration,leave:2.8/BATHROOM_PASSAGE.duration};

export function animateBathroom(fixture,pose=null,dt=0){
  animatePocketShutter(fixture.door,pose?.opening??0);
  updateBathroomCeilingLight(fixture.ceilingLight,pose,dt);
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
    const moving=['enter','leave'].includes(phase),gait=moving?miloWalkState(BATHROOM_PASSAGE,this.age):null;
    const depth=phase==='enter'?outside-gait.x:phase==='leave'?inside+gait.x:['close','use','reopen'].includes(phase)?inside:outside;
    // Automatic doors: turn toward the opening, then walk through the cleared frame.
    // (walkDistance counts the walk cycle's phase: a footfall sounds where a foot lands)
    return{opening,depth,gait,walkDistance:gait?gait.u*BATHROOM_PASSAGE.cycle.C:0,moving,inside:depth<-1.72,reach:0,turn:phase==='reach'?s:1,yaw:phase==='reopen'?Math.PI*(1-s):['leave','shut'].includes(phase)?0:Math.PI,phase,turnProgress:t};
  }
}
