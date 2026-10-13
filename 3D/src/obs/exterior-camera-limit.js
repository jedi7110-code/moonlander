import * as THREE from 'three';

// Raycast physical surfaces with both face directions, without changing any
// rendered material. This also finds the exit when the orbit target is inside
// the hull. Decals, glow sprites and gas do not define a camera boundary.
export function createExteriorCameraLimit({ship,camera,controls,clearance=2,minDistance=8}){
  const material=new THREE.MeshBasicMaterial({side:THREE.DoubleSide}),colliders=[];
  ship.root.traverse(source=>{
    if(!source.isMesh||source.isInstancedMesh||![].concat(source.material).some(m=>m.depthWrite&&m.opacity>0))return;
    const proxy=new THREE.Mesh(source.geometry,material);proxy.matrixAutoUpdate=false;
    colliders.push({source,proxy});
  });
  const box=new THREE.Box3(),direction=new THREE.Vector3(),ray=new THREE.Raycaster(),hits=[],active=[];
  const maxDistance=controls.maxDistance;
  controls.minDistance=minDistance;
  return{
    update(){
      ship.root.updateWorldMatrix(true,true);
      box.setFromObject(ship.root).expandByScalar(clearance);
      // Ordinary wide shots need no triangle tests. A proposed dolly/pan/orbit
      // position is constrained before it can be rendered inside the ship.
      let limit=minDistance;
      if(box.containsPoint(camera.position)){
        direction.copy(camera.position).sub(controls.target);
        if(direction.lengthSq()<1e-12)camera.getWorldDirection(direction).negate();else direction.normalize();
        active.length=0;
        for(const {source,proxy}of colliders){
          let visible=true;for(let parent=source;parent;parent=parent.parent)if(!parent.visible){visible=false;break;}
          if(!visible)continue;
          proxy.matrixWorld.copy(source.matrixWorld);active.push(proxy);
        }
        ray.set(controls.target,direction);hits.length=0;ray.intersectObjects(active,false,hits);
        if(hits.length)limit=Math.max(limit,hits.at(-1).distance+clearance);
        if(camera.position.distanceTo(controls.target)<limit){
          camera.position.copy(controls.target).addScaledVector(direction,limit);camera.lookAt(controls.target);
        }
      }
      controls.minDistance=limit;controls.maxDistance=Math.max(maxDistance,limit);
      return limit;
    },
    dispose(){material.dispose();colliders.length=0;},
  };
}
