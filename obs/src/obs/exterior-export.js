import {sampleExteriorCinemaFrame} from './exterior-cinematic.js';

// Scene 01 was composed inside the cinema's 8% top and bottom masks.
// A full-bleed export must frame that active image, rather than uncovering
// the approaching hull in the old upper mask before the logo appears.
export function sampleExteriorExportFrame(seconds,options){
  const frame=sampleExteriorCinemaFrame(seconds,options);
  const fit=shot=>shot?.id==='overhead'?{...shot,
    fov:2*Math.atan(Math.tan(shot.fov*Math.PI/360)*.84)*180/Math.PI}:shot;
  return{...frame,shot:fit(frame.shot),from:fit(frame.from),to:fit(frame.to)};
}
