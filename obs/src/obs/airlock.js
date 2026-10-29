import {EVA_PASSAGE,FLOORS} from './layout.js';

// Both sides remain at cabin pressure. Only the inner door admits crew traffic.
export class AirlockPassage {
  constructor(){this.opening=0;}
  update(dt,actor){
    const {floor,x,approach,clearance,openTime}=EVA_PASSAGE;
    const onDeck=Math.abs(actor.y-FLOORS[floor].y)<.01;
    const walk=actor.queue[0]?.type==='walk'?actor.queue[0]:null;
    const distance=Math.abs(actor.x-x);
    const crossing=onDeck&&walk&&actor.x!==walk.x&&(actor.x-x)*(walk.x-x)<=0;
    const occupied=onDeck&&distance<clearance;
    const open=(crossing&&distance<=approach)||occupied;
    this.opening=Math.max(0,Math.min(1,this.opening+(open?1:-1)*dt/openTime));
    actor.waitingForHatch=Boolean(crossing&&distance<=clearance&&this.opening<.99);
  }
}
