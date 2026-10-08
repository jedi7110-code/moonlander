// Slow physiological depletion, not walking, handling props or recovery animations.
export const CABIN_PACE={dayMs:15*60*1000,needDecay:.35,catDecay:.60,autonomousNeedThreshold:65};
// Authored droid gait. Motion and contact sounds share the same full L/R cycle;
// DROID_PACE scales travel speed, not the distance between foot landings.
export const DROID_GAIT=Object.freeze({speed:.58,period:1.4,stance:.64});
export const DROID_WALK_CYCLE_DISTANCE=DROID_GAIT.speed*DROID_GAIT.period;
// Approved ladder tempo: 20% faster in both directions, without changing gait geometry.
export const LADDER_PACE=1.2;
export const LADDER_LANDING={height:.42,slowFrom:.65,seconds:3};
export const DROID_LADDER_LANDING={height:.4,seconds:3};
// Time to turn, establish a handhold, then transfer each foot from the deck.
export const LADDER_ENTRY={seconds:3,miloHeight:.42,droidHeight:.4};
