import {Plane,Vector3} from 'three';

export function configureVerticalShutter(door,{closedY,top,travel}){
  door.userData.closedY=closedY;door.userData.shutterTravel=travel;
  const pocketLip=new Plane(new Vector3(0,-1,0),top);
  // The fixed lip hides the panel inside its pocket, including its cast shadow.
  door.traverse(part=>{
    if(!part.isMesh)return;
    part.material=part.material.clone();part.material.clippingPlanes=[pocketLip];part.material.clipShadows=true;
  });
}

export function animateVerticalShutter(door,opening,travel=door.userData.shutterTravel){
  door.rotation.set(0,0,0);
  door.position.y=(door.userData.closedY??0)+travel*Math.max(0,Math.min(1,opening));
}
