import {Group,Plane,Vector3} from 'three';
import {box} from './materials.js';

export function addPocketShutterFrame(parent,m,x,y,z,{width=1.54,height=2.43,name='Pocket door'}={}){
  const frame=new Group();frame.name=`${name} fixed frame`;frame.position.set(x,y,z);
  frame.scale.set(width/1.54,height/2.43,Math.min(width/1.54,height/2.43));parent.add(frame);
  for(const side of [-1,1]){
    box(frame,m.metal,side*.787,1.27,0,.055,2.43,.15,.012);
    for(const h of [.32,2.19])box(frame,m.dark,side*.787,h,.01,.10,.13,.12);
  }
  box(frame,m.dark,0,2.51,-.03,1.70,.10,.17,.025).name=`${name} fixed lintel`;
  return frame;
}

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
