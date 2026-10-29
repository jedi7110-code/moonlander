const clamp=x=>Math.max(0,Math.min(1,x));
const ease=x=>{const t=clamp(x);return t*t*t*(10+t*(-15+6*t));};
export const angleDelta=(from,to)=>Math.atan2(Math.sin(to-from),Math.cos(to-from));
export function createCatTurn(from,to,{duration=null}={}){
  const delta=angleDelta(from,to);
  return {from,delta,age:0,duration:duration??(.75+.65*Math.abs(delta)),steps:Math.max(1,Math.ceil(Math.abs(delta)/(Math.PI/6)))};
}
export function sampleCatTurn(turn){
  const u=clamp(turn.age/turn.duration),weight=Math.sin(Math.PI*u)**2;
  const phase=(start,end)=>clamp((u-start)/(end-start));
  const head=phase(0,.76),front=phase(.07,.84),rear=phase(.16,.93),tail=phase(.28,1);
  const at=t=>turn.from+turn.delta*ease(t);
  const headYaw=at(head),frontYaw=at(front),rearYaw=at(rear),tailYaw=at(tail),yaw=(frontYaw+rearYaw)/2;
  const feet={};
  for(const side of ['L','R'])for(const rear of [false,true]){
    const pair=side===(turn.delta>=0?'L':'R')?0:1;
    const progress=rear?phase(.16,.93):phase(.07,.84);
    const step=Math.min(turn.steps-1,Math.floor(progress*turn.steps)),within=progress*turn.steps-step;
    const t=clamp((within-(pair?.51:.04))/.43);
    feet[(rear?'rear':'front')+side]={yaw:at(step/turn.steps)+(at((step+1)/turn.steps)-at(step/turn.steps))*ease(t),lift:.018*Math.sin(Math.PI*t)**2};
  }
  return {...turn,yaw,headYaw,frontYaw,rearYaw,tailYaw,progress:u,weight,twist:Math.sign(turn.delta)*Math.min(1,Math.abs(turn.delta)/(Math.PI/2))*weight,feet};
}
