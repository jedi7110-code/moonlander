import * as THREE from 'three';

// Raycast physical surfaces with both face directions, without changing any
// rendered material. This also finds the exit when the orbit target is inside
// the hull. Decals, glow sprites and gas do not define a camera boundary.
export function createExteriorCameraLimit({ship,camera,controls,clearance=2,minDistance=8,minShipDistance=0}){
  const material=new THREE.MeshBasicMaterial({side:THREE.DoubleSide}),colliders=[];
  ship.root.traverse(source=>{
    if(!source.isMesh||source.isInstancedMesh||![].concat(source.material).some(m=>m.depthWrite&&m.opacity>0))return;
    const proxy=new THREE.Mesh(source.geometry,material);proxy.matrixAutoUpdate=false;
    colliders.push({source,proxy});
  });
  const box=new THREE.Box3(),direction=new THREE.Vector3(),centerOffset=new THREE.Vector3(),ray=new THREE.Raycaster(),hits=[],active=[];
  const maxDistance=controls.maxDistance;
  controls.minDistance=minDistance;
  return{
    bounds:box,
    update(){
      ship.root.updateWorldMatrix(true,true);
      box.setFromObject(ship.root).expandByScalar(clearance);
      direction.copy(camera.position).sub(controls.target);
      if(direction.lengthSq()<1e-12)camera.getWorldDirection(direction).negate();else direction.normalize();
      ray.set(controls.target,direction);
      // Set the zoom stop while still outside the hull, so a fast wheel input
      // cannot jump through a thin panel or a separate habitat. Rays missing
      // the entire ship bounds do not need triangle queries.
      let limit=minDistance;
      if(minShipDistance>0){
        ship.root.getWorldPosition(centerOffset);centerOffset.sub(controls.target);
        const along=centerOffset.dot(direction),disc=minShipDistance**2-centerOffset.lengthSq()+along**2;
        // Use the outer exit, including when the orbit target has been panned
        // away from the ship. Its distance alone is not a ship clearance.
        if(disc>=0)limit=Math.max(limit,along+Math.sqrt(disc));
      }
      if(ray.ray.intersectsBox(box)){
        active.length=0;
        for(const {source,proxy}of colliders){
          let visible=true;for(let parent=source;parent;parent=parent.parent)if(!parent.visible){visible=false;break;}
          if(!visible)continue;
          proxy.matrixWorld.copy(source.matrixWorld);active.push(proxy);
        }
        hits.length=0;ray.intersectObjects(active,false,hits);
        if(hits.length)limit=Math.max(limit,hits.at(-1).distance+clearance);
      }
      if(camera.position.distanceTo(controls.target)<limit){
        camera.position.copy(controls.target).addScaledVector(direction,limit);camera.lookAt(controls.target);
      }
      controls.minDistance=limit;controls.maxDistance=Math.max(maxDistance,limit);
      return limit;
    },
    dispose(){material.dispose();colliders.length=0;},
  };
}
