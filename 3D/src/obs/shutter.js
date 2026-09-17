import {Plane,Vector3} from 'three';

export function configurePocketShutter(door,{left,right,travel,inset=.24,direction=-1}){
  door.userData.shutter={closed:door.position.clone(),travel,inset,direction};
  const pocketEdges=[new Plane(new Vector3(1,0,0),-left),new Plane(new Vector3(-1,0,0),right)];
  // Fixed world-space jambs hide the leaf and its shadow inside the wall pocket.
  door.traverse(part=>{
    if(!part.isMesh)return;
    part.material=part.material.clone();part.material.clippingPlanes=pocketEdges;part.material.clipShadows=true;
  });
}

const ease=value=>{const t=Math.max(0,Math.min(1,value));return t*t*(3-2*t);};
export function animatePocketShutter(door,opening){
  const shutter=door.userData.shutter;if(!shutter)return;
  const {closed,travel,inset,direction}=shutter;
  const t=Math.max(0,Math.min(1,opening));
  // First unplug into the wall; only then slide. Closing reverses both stages.
  door.rotation.set(0,0,0);
  door.position.set(closed.x+direction*travel*ease((t-.32)/.68),closed.y,closed.z-inset*ease(t/.32));
}
