export const angleDelta=(from,to)=>Math.atan2(Math.sin(to-from),Math.cos(to-from));
export const headingEase=t=>{t=Math.max(0,Math.min(1,t));return t*t*t*(10+t*(-15+6*t));};

// Ordinary action changes share a finite, time-based turn. Authored contact
// sequences own their heading instead; never smooth a planted pose afterwards.
export function turnTowards(root,target,dt=1/60){
  if(dt<=0)return;
  let turn=root.userData.headingTurn;
  if(!turn||Math.abs(angleDelta(turn.target,target))>1e-7||Math.abs(angleDelta(turn.value,root.rotation.y))>1e-7){
    const delta=angleDelta(root.rotation.y,target);
    turn=root.userData.headingTurn={from:root.rotation.y,target,delta,age:0,duration:.45+.65*Math.abs(delta),value:root.rotation.y};
  }
  turn.age=Math.min(turn.duration,turn.age+Math.min(dt,.1));
  root.rotation.y=turn.value=turn.from+turn.delta*headingEase(turn.age/turn.duration);
}
