import {chessSquarePosition} from './chess-geometry.js';

// A transition belongs to one exact rule-engine move. Loading, undoing, and
// selecting a square must never accidentally replay the last move.
export function chessMoveTransition(previous,next){
  const move=next.move;
  if(!move||!previous.positionKey||move.before!==previous.positionKey||move.after!==next.positionKey||previous.positionKey===next.positionKey)return null;
  const moving=previous.pieces.find(piece=>piece.square===move.from);
  const landed=next.pieces.find(piece=>piece.square===move.to);
  if(!moving||!landed||moving.type!==move.piece||moving.color!==move.color||landed.color!==move.color)return null;
  const steps=[{from:move.from,to:move.to,type:moving.type,promotion:move.promotion||null}];
  if(move.flags.includes('k')||move.flags.includes('q')){
    const rank=move.from[1],kingSide=move.flags.includes('k'),from=(kingSide?'h':'a')+rank,to=(kingSide?'f':'d')+rank;
    if(!previous.pieces.some(piece=>piece.square===from&&piece.type==='r'&&piece.color===move.color)||!next.pieces.some(piece=>piece.square===to&&piece.type==='r'&&piece.color===move.color))return null;
    steps.push({from,to,type:'r',promotion:null});
  }
  const capturedSquare=move.captured?(move.flags.includes('e')?move.to[0]+move.from[1]:move.to):null;
  const captured=capturedSquare?previous.pieces.find(piece=>piece.square===capturedSquare&&piece.color!==move.color):null;
  const movers=steps.map(step=>{
    const from=chessSquarePosition(step.from),to=chessSquarePosition(step.to),distance=from.distanceTo(to);
    return{...step,fromPosition:from,toPosition:to,lift:step.type==='n'?1.12:.55+Math.min(distance,7)*.06};
  });
  const distance=movers[0].fromPosition.distanceTo(movers[0].toPosition);
  return{movers,captured,duration:Math.min(.92,.62+distance*.04)};
}

// Sample by progress rather than accumulating deltas: every frame, including
// the landing, is reproducible and independent of the display's frame rate.
export function chessArcPosition(mover,progress,target){
  const t=Math.max(0,Math.min(1,progress)),eased=t*t*(3-2*t);
  target.lerpVectors(mover.fromPosition,mover.toPosition,eased);
  target.y+=4*eased*(1-eased)*mover.lift;
  return target;
}

export function chessCaptureScale(progress){
  const t=Math.max(0,Math.min(1,(progress-.12)/.5)),eased=t*t*(3-2*t);
  return 1-eased;
}
