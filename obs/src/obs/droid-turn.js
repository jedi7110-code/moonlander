const clamp=t=>Math.max(0,Math.min(1,t));
const smooth=t=>{t=clamp(t);return t*t*(3-2*t);};
const mix=(a,b,t)=>a+(b-a)*t;
const rotate=([x,y,z],yaw)=>[x*Math.cos(yaw)+z*Math.sin(yaw),y,z*Math.cos(yaw)-x*Math.sin(yaw)];
const neutral=side=>[side*.137,.099,.045];

// Each pair brings both feet to the next heading, at most 30 degrees away.
// The body advances half of that angle per step instead of spinning in place.
export function planDroidTurn(from,to){
  const steps=2*Math.max(1,Math.ceil(Math.abs(to-from)/(Math.PI/6)));
  return {from,to,steps,duration:steps*.34};
}

export function sampleDroidTurn(turn,age,entryFeet=[neutral(-1),neutral(1)]){
  const {from,to,steps,duration}=turn;
  const progress=clamp(age/duration)*steps,step=Math.min(steps-1,Math.floor(progress));
  const phase=progress-step,swing=clamp((phase-.12)/.76),reach=smooth(swing);
  const increment=(to-from)/(steps/2),pair=Math.floor(step/2);
  const yaw=from+increment*(step+reach)/2;
  // Finish an already airborne walking foot first; otherwise open into the turn.
  const lead=entryFeet[0][1]>.100?-1:entryFeet[1][1]>.100?1:Math.sign(to-from)||1;
  const moving=step%2===0?lead:-lead,lift=Math.sin(Math.PI*swing);
  const feet=[],footYaws=[],planted=[];
  for(const side of [-1,1]){
    const index=side<0?0:1,done=pair+(step%2===1&&side===lead?1:0);
    const oldYaw=from+increment*done,newYaw=from+increment*(pair+1);
    const start=rotate(done?neutral(side):entryFeet[index],oldYaw);
    const goal=rotate(neutral(side),newYaw);
    const active=side===moving,heading=active?mix(oldYaw,newYaw,reach):oldYaw;
    const point=active?start.map((v,i)=>mix(v,goal[i],reach)):start;
    if(active)point[1]+=.055*lift;
    feet.push(rotate(point,-yaw));footYaws.push(heading-yaw);
    planted.push(point[1]<=.099+1e-8&&(!active||swing===0||swing===1));
  }
  const weight=smooth(phase/.12)*smooth((1-phase)/.12),support=moving<0?1:0;
  return {yaw,feet,footYaws,planted,step,swing,lift,bodyX:feet[support][0]*.18*weight};
}
