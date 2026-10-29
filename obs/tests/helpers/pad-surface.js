import {Box3,Triangle,Vector3,Raycaster} from 'three';
import {createPadModel} from '../../src/obs/pad-terminal.js';

// Measure the actual unbatched solid surfaces, including the side ribs and
// thicker rear panel, instead of the former 16 mm rounded-box approximation.
const model=createPadModel().root;model.rotation.y=Math.PI;model.updateMatrixWorld(true);
const parts=model.children.filter(m=>m.isMesh&&m.castShadow).map(mesh=>{
  const g=mesh.geometry,p=g.attributes.position,index=g.index,triangles=[];
  for(let i=0;i<(index?.count??p.count);i+=3)triangles.push(new Triangle(...[0,1,2].map(j=>new Vector3().fromBufferAttribute(p,index?index.getX(i+j):i+j).applyMatrix4(mesh.matrixWorld))));
  return{mesh,box:new Box3().setFromObject(mesh),triangles};
});
const nearest=new Vector3(),ray=new Raycaster();
export function padSurfaceDistance(point){
  let best=Infinity;
  for(const {mesh,box,triangles} of parts){
    const bound=box.distanceToPoint(point);if(bound>Math.max(0,best))continue;
    let distance=Infinity;
    for(const triangle of triangles){triangle.closestPointToPoint(point,nearest);distance=Math.min(distance,point.distanceTo(nearest));}
    if(box.containsPoint(point)){
      ray.set(new Vector3(point.x,1,point.z),new Vector3(0,-1,0));const top=ray.intersectObject(mesh,false)[0];
      ray.set(new Vector3(point.x,-1,point.z),new Vector3(0,1,0));const bottom=ray.intersectObject(mesh,false)[0];
      if(top&&bottom&&point.y<top.point.y&&point.y>bottom.point.y)distance=-distance;
    }
    best=Math.min(best,distance);
  }
  return best;
}
