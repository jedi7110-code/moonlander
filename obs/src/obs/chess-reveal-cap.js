import * as THREE from 'three';

// Close a horizontal slice using the actual mesh contours. Preserve recessed
// crowns and separate components rather than covering them with a convex disk.
export function createChessRevealCap(geometry,height){
  const positions=geometry.getAttribute('position'),index=geometry.index,segments=[],nodes=new Map();
  const count=index?index.count:positions.count,epsilon=1e-5;
  const node=point=>{
    const key=Math.round(point.x/epsilon)+','+Math.round(point.z/epsilon);
    if(!nodes.has(key))nodes.set(key,{point:new THREE.Vector2(point.x,-point.z),edges:[]});
    return nodes.get(key);
  };
  const a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3(),ab=new THREE.Vector3(),ac=new THREE.Vector3(),normal=new THREE.Vector3();
  for(let i=0;i<count;i+=3){
    a.fromBufferAttribute(positions,index?index.getX(i):i);b.fromBufferAttribute(positions,index?index.getX(i+1):i+1);c.fromBufferAttribute(positions,index?index.getX(i+2):i+2);
    const points=[];
    for(const [start,end]of [[a,b],[b,c],[c,a]]){
      if((start.y>height)===(end.y>height))continue;
      const t=(height-start.y)/(end.y-start.y),point=new THREE.Vector3().lerpVectors(start,end,t);
      if(!points.some(other=>other.distanceToSquared(point)<1e-16))points.push(point);
    }
    if(points.length!==2)continue;
    normal.crossVectors(ab.subVectors(b,a),ac.subVectors(c,a));
    // y-up cross the outward face normal gives the positive contour direction.
    if((points[1].x-points[0].x)*normal.z-(points[1].z-points[0].z)*normal.x<0)points.reverse();
    const from=node(points[0]),to=node(points[1]);if(from===to)continue;
    const edge={from,to,used:false};segments.push(edge);from.edges.push(edge);
  }
  const loops=[];
  for(const start of segments){
    if(start.used)continue;
    const contour=[];let edge=start,closed=false;
    while(edge&&!edge.used){
      edge.used=true;contour.push(edge.from.point);
      if(edge.to===start.from){closed=true;break;}
      edge=edge.to.edges.find(candidate=>!candidate.used);
    }
    if(closed&&contour.length>=3){
      const area=THREE.ShapeUtils.area(contour);
      if(Math.abs(area)>1e-10)loops.push({contour,area,holes:[]});
    }
  }
  const inside=(point,contour)=>{
    let result=false;
    for(let i=0,j=contour.length-1;i<contour.length;j=i++){
      const a=contour[i],b=contour[j];
      if((a.y>point.y)!==(b.y>point.y)&&point.x<(b.x-a.x)*(point.y-a.y)/(b.y-a.y)+a.x)result=!result;
    }
    return result;
  };
  const outer=loops.filter(loop=>loop.area>0);
  for(const hole of loops.filter(loop=>loop.area<0)){
    const parent=outer.filter(loop=>inside(hole.contour[0],loop.contour)).sort((a,b)=>a.area-b.area)[0];
    if(parent)parent.holes.push(hole.contour);
  }
  const vertices=[];
  for(const {contour,holes}of outer){
    const points=[contour,...holes].flat();
    for(const face of THREE.ShapeUtils.triangulateShape(contour,holes)){
      const [a,b,c]=face.map(i=>points[i]);
      const triangle=(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x)>0?[a,b,c]:[a,c,b];
      for(const point of triangle)vertices.push(point.x,height,-point.y);
    }
  }
  const cap=new THREE.BufferGeometry();cap.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
  const normals=new Float32Array(vertices.length);for(let i=1;i<normals.length;i+=3)normals[i]=1;
  cap.setAttribute('normal',new THREE.BufferAttribute(normals,3));cap.computeBoundingBox();cap.computeBoundingSphere();
  return cap;
}
