import {EVA_PASSAGE,FLOORS} from './layout.js';

// The inner door admits crew traffic only with no leak and equal pressure.
export class AirlockPassage {
  constructor(){this.opening=0;}
  update(dt,actor,environment=null){
    // (a planned walk cannot stop on the spot: the door opens for it early enough to walk through)
    const {floor,x,clearance,openTime}=EVA_PASSAGE,approach=EVA_PASSAGE.approach+(actor.planned?EVA_PASSAGE.plannedApproach:0);
    const onDeck=Math.abs(actor.y-FLOORS[floor].y)<.01;
    const walk=actor.queue[0]?.type==='walk'?actor.queue[0]:null;
    const distance=Math.abs(actor.x-x);
    const crossing=onDeck&&walk&&actor.x!==walk.x&&(actor.x-x)*(walk.x-x)<=0;
    const occupied=onDeck&&distance<clearance;
    if(environment)environment.equalizationRequested=Boolean((crossing&&distance<=approach)||occupied);
    const interlocked=Boolean(environment?.airlockInterlocked);
    const open=!interlocked&&((crossing&&distance<=approach)||occupied);
    this.opening=Math.max(0,Math.min(1,this.opening+(open?1:-1)*dt/openTime));
    // (a walk under way stops short of the door: it needs its stopping distance)
    actor.waitingForHatch=Boolean(crossing&&distance<=clearance+(actor.reach??0)&&this.opening<.99);
    if(environment)environment.innerDoorOpening=this.opening;
  }
}
