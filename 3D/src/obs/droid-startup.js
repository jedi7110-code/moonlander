export const DROID_STARTUP_SECONDS=3.2;

// Use simulation age so pausing, study scrubbing and every new wake-up agree.
// Two failed strikes, a dark gap, then the existing amber glow warms up.
export function droidStartupLight(age){
  if(age<.16)return 0;
  if(age<.28)return .86;
  if(age<.51)return 0;
  if(age<.67)return 1;
  const u=Math.max(0,Math.min(1,(age-.85)/(DROID_STARTUP_SECONDS-.85)));
  return u*u*(3-2*u);
}
