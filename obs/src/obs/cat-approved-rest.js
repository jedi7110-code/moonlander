// Entry/exit timing is shared by the routine and the baked study playback.
export const APPROVED_RESTS={stretch:{duration:8,entry:2.6,exit:3.3,hold:4.7},prone:{duration:12,entry:2.8,exit:3.5,hold:4}};
export function approvedRestTime(mode,age,remaining=Infinity){
  const clip=APPROVED_RESTS[mode];if(!clip)return null;
  return remaining<clip.exit?Math.min(clip.duration,clip.duration-Math.max(0,remaining)):Math.min(Math.max(0,age),clip.hold);
}
export function approvedRestRelease(mode,age){
  const clip=APPROVED_RESTS[mode];return clip?Math.max(0,clip.entry-age)+clip.exit:null;
}
