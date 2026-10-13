// Moon's console title: ten horizontal bands load downwards in 1.2 seconds.
export const EXTERIOR_LOGO=Object.freeze({start:.8,resolve:1.2,steps:10,hold:4.2,end:5.2,flickerPeriod:4.5});
export const LOGO_SETTLED=EXTERIOR_LOGO.start+EXTERIOR_LOGO.resolve;
const ease=value=>{const t=Math.max(0,Math.min(1,value));return t*t*(3-2*t);};

// Sample the console animation directly so seeking never leaves half a logo.
export function sampleExteriorLogo(seconds){
  const time=Number.isFinite(seconds)?Math.max(0,seconds):0;
  const progress=Math.max(0,Math.min(1,(time-EXTERIOR_LOGO.start)/EXTERIOR_LOGO.resolve));
  const phase=Math.max(0,time-EXTERIOR_LOGO.start)/EXTERIOR_LOGO.flickerPeriod%1;
  const flicker=phase<.72||phase>=.74?1:phase<.73?1-(phase-.72)*15:.85+(phase-.73)*15;
  return{opacity:time<EXTERIOR_LOGO.start?0:ease((EXTERIOR_LOGO.end-time)/(EXTERIOR_LOGO.end-EXTERIOR_LOGO.hold)),
    reveal:Math.floor(progress*EXTERIOR_LOGO.steps+1e-9)/EXTERIOR_LOGO.steps,flicker};
}
