import {BufferGeometry} from 'three';

// Raycasting needs only the triangles whose footprint can contain a hit.
// Returns a geometry that shares `position` and indexes the triangles whose
// bounding box overlaps `box` (use ±Infinity on the axis the rays travel).
// Triangle order is preserved, so equal-distance hits still sort identically
// and the nearest hit matches a raycast against the full surface.
export function triangleSubset(geometry,box,triangles=null){
  const position=geometry.attributes.position,index=triangles??geometry.index?.array??null;
  const count=index?index.length:position.count,filtered=[],{min,max}=box;
  for(let i=0;i<count;i+=3){
    const a=index?index[i]:i,b=index?index[i+1]:i+1,c=index?index[i+2]:i+2;
    const ax=position.getX(a),ay=position.getY(a),az=position.getZ(a);
    const bx=position.getX(b),by=position.getY(b),bz=position.getZ(b);
    const cx=position.getX(c),cy=position.getY(c),cz=position.getZ(c);
    if(Math.max(ax,bx,cx)<min.x||Math.min(ax,bx,cx)>max.x||Math.max(ay,by,cy)<min.y||Math.min(ay,by,cy)>max.y||Math.max(az,bz,cz)<min.z||Math.min(az,bz,cz)>max.z)continue;
    filtered.push(a,b,c);
  }
  const subset=new BufferGeometry();subset.setAttribute('position',position);subset.setIndex(filtered);
  return subset;
}
