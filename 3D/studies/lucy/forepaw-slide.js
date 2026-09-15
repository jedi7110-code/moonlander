import {Vector3} from 'three';

// Shared front-paw action for lying down and stretching: both paws reach
// together along the floor, then retrace the same path. Reach distance follows
// each pose's shoulder position; neither action steps or lifts a paw.
export function forepawSlide(foot,weight,distance){
  return foot.origin.clone().add(new Vector3((foot.side==='L'?1:-1)*.008*weight,foot.clearance,distance*weight));
}
