// A slow four-beat knuckle walk. The long support phase keeps two or three
// limbs planted while the next hand or foot swings forward.
export const WALK_CYCLE_SECONDS=1.85;
export function knuckleWalk(time){
  const cycle=time/WALK_CYCLE_SECONDS;
  function step(offset,stride,lift){
    const phase=((cycle+offset)%1+1)%1,duty=.74;
    if(phase<duty)return {z:stride*(.5-phase/duty),lift:0,planted:true};
    const swing=(phase-duty)/(1-duty),ease=swing*swing*(3-2*swing);
    return {z:stride*(ease-.5),lift:lift*Math.sin(Math.PI*swing)**2,planted:false};
  }
  return {
    phase:((cycle%1)+1)%1,
    hands:[step(0,.22,.10),step(.5,.22,.10)],
    feet:[step(.75,.22,.065),step(.25,.22,.065)],
    sway:.023*Math.sin(cycle*Math.PI*2),
    bob:.010*Math.cos(cycle*Math.PI*4),
    lean:.025*Math.sin(cycle*Math.PI*2),
  };
}
