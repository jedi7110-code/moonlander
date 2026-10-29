// Match Moonlander's title-dialup-on: 1.2 seconds, steps(10, end),
// with 40px outside the image reserved for its CRT glow.
export const EXTERIOR_LOGO=Object.freeze({start:2.4,resolve:1.2,steps:10,glowPadding:40,hold:5.8,end:7.4});
export const LOGO_SETTLED=EXTERIOR_LOGO.start+EXTERIOR_LOGO.resolve;
const ease=value=>{const t=Math.max(0,Math.min(1,value));return t*t*(3-2*t);};

// Sample the console animation directly so seeking never leaves half a logo.
export function sampleExteriorLogo(seconds){
  const time=Number.isFinite(seconds)?Math.max(0,seconds):0;
  const progress=time>=LOGO_SETTLED?1:Math.max(0,(time-EXTERIOR_LOGO.start)/EXTERIOR_LOGO.resolve);
  const reveal=Math.floor(progress*EXTERIOR_LOGO.steps+1e-9)/EXTERIOR_LOGO.steps;
  const margin=EXTERIOR_LOGO.glowPadding;
  return{opacity:time<EXTERIOR_LOGO.start?0:ease((EXTERIOR_LOGO.end-time)/(EXTERIOR_LOGO.end-EXTERIOR_LOGO.hold)),
    reveal,clipPath:`inset(-${margin}px -${margin}px calc(${(1-reveal)*100}% - ${margin*reveal}px) -${margin}px)`};
}
