import {Vector3} from 'three';

// Keep the pelvis inside the reach spheres of all planted contacts. Blending
// torso poses alone raises it before the trailing foot has left the deck.
export function fitLadderEntryBody(position,contacts){
  const fitted=position.clone();
  for(let pass=0;pass<48;pass++){
    let error=0;
    for(const {target,offset,length}of contacts){
      const center=target.clone().sub(offset),dx=fitted.x-center.x;
      const radius=Math.sqrt(Math.max(0,length*length-dx*dx));
      const delta=new Vector3(0,fitted.y-center.y,fitted.z-center.z),distance=delta.length();
      if(distance>radius){error=Math.max(error,distance-radius);fitted.addScaledVector(delta,radius/distance-1);}
    }
    if(error<1e-8)break;
  }
  return fitted;
}
