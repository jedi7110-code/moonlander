import {Box3,Vector3} from 'three';

const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
function hull(points){
  const sorted=[...new Map(points.map(p=>[p.join(','),p])).values()].sort((a,b)=>a[0]-b[0]||a[1]-b[1]);
  const half=points=>{const out=[];for(const p of points){while(out.length>1&&cross(out.at(-2),out.at(-1),p)<=1e-12)out.pop();out.push(p);}return out;};
  return [...half(sorted).slice(0,-1),...half([...sorted].reverse()).slice(0,-1)];
}
function intersect(subject,clip){
  let out=subject;
  for(let i=0;i<clip.length&&out.length;i++){
    const a=clip[i],b=clip[(i+1)%clip.length],input=out;out=[];
    for(let j=0;j<input.length;j++){
      const p=input[j],q=input[(j+1)%input.length],dp=cross(a,b,p),dq=cross(a,b,q);
      if(dp>=0)out.push(p);
      if((dp>=0)!==(dq>=0)){const t=dp/(dp-dq);out.push(p.map((v,k)=>v+(q[k]-v)*t));}
    }
  }
  return out;
}
const area=points=>Math.abs(points.reduce((sum,p,i)=>{const q=points[(i+1)%points.length];return sum+p[0]*q[1]-p[1]*q[0];},0))/2;

// Inspect axis-aligned planar surfaces in world space, including rounded-box
// centers, cylinder caps, planes and extruded walls. Keep extruded triangles
// separate so apertures/concave outlines are not falsely filled by a convex hull.
// Shared edges, back-to-back joints and intentional depth-offset decals are safe.
export function coplanarSurfaces(roots,{tolerance=1e-5}={}){
  const faces=[],vertices=[new Vector3(),new Vector3(),new Vector3()],edge=new Vector3(),normal=new Vector3();
  for(const root of roots){
    root.updateMatrixWorld(true);
    root.traverseVisible(mesh=>{
      if(!mesh.isMesh||Array.isArray(mesh.material)||!mesh.material.visible||!mesh.material.depthTest)return;
      const {geometry}=mesh;
      if(!['BoxGeometry','RoundedBoxGeometry','PlaneGeometry','ExtrudeGeometry','CylinderGeometry','CircleGeometry'].includes(geometry.type))return;
      if(mesh.material.polygonOffset||!mesh.material.depthWrite)return;
      const convex=geometry.type==='BoxGeometry'||geometry.type==='RoundedBoxGeometry';
      const positions=geometry.attributes.position,index=geometry.index,groups=new Map();
      for(let i=0;i<(index?.count??positions.count);i+=3){
        for(let j=0;j<3;j++)vertices[j].fromBufferAttribute(positions,index?index.getX(i+j):i+j).applyMatrix4(mesh.matrixWorld);
        normal.subVectors(vertices[1],vertices[0]).cross(edge.subVectors(vertices[2],vertices[0]));
        if(normal.lengthSq()<1e-16)continue;normal.normalize();
        const axis=['x','y','z'].find(axis=>Math.abs(normal[axis])>1-1e-10);if(!axis)continue;
        const plane=vertices[0][axis];if(vertices.some(v=>Math.abs(v[axis]-plane)>tolerance))continue;
        const sign=Math.sign(normal[axis]),key=axis+sign+':'+Math.round(plane/tolerance),axes=['x','y','z'].filter(a=>a!==axis);
        let face=groups.get(key);
        if(!face){face={mesh,axis,sign,plane,axes,points:[],polygons:[],min:[Infinity,Infinity],max:[-Infinity,-Infinity]};groups.set(key,face);}
        if(!convex)face.polygons.push(hull(vertices.map(v=>axes.map(axis=>v[axis]))));
        for(const v of vertices){face.points.push(axes.map(axis=>v[axis]));for(let a=0;a<2;a++){face.min[a]=Math.min(face.min[a],v[axes[a]]);face.max[a]=Math.max(face.max[a],v[axes[a]]);}}
      }
      for(const face of groups.values())if(convex)face.polygons=[hull(face.points)];
      faces.push(...groups.values());
    });
  }
  const overlaps=[];
  faces.sort((a,b)=>a.plane-b.plane);
  for(let i=0;i<faces.length;i++)for(let j=i+1;j<faces.length&&faces[j].plane-faces[i].plane<tolerance;j++){
    const a=faces[i],b=faces[j];if(a.mesh===b.mesh||a.axis!==b.axis||a.sign!==b.sign)continue;
    const min=a.min.map((v,k)=>Math.max(v,b.min[k])),max=a.max.map((v,k)=>Math.min(v,b.max[k]));
    if(max.some((v,k)=>v-min[k]<=tolerance))continue;
    let overlapArea=0,point;
    for(const ap of a.polygons)for(const bp of b.polygons){
      const polygon=intersect(ap,bp),pieceArea=area(polygon);if(pieceArea<tolerance*tolerance)continue;
      const center=new Vector3();center[a.axis]=(a.plane+b.plane)/2;
      a.axes.forEach((axis,k)=>center[axis]=polygon.reduce((sum,p)=>sum+p[k],0)/polygon.length);
      if([a,b].some(f=>f.mesh.material.clippingPlanes?.some(p=>p.distanceToPoint(center)<0)))continue;
      point=center;overlapArea+=pieceArea;
    }
    if(point)overlaps.push({a,b,point,area:overlapArea,min,max});
  }
  return overlaps;
}

export function describeFace(face){
  const mesh=face.mesh,path=[];let node=mesh;while(node){if(node.name)path.unshift(node.name);node=node.parent;}
  return{path:path.join(' / '),material:mesh.material.name,position:mesh.getWorldPosition(new Vector3()).toArray().map(v=>+v.toFixed(4)),size:new Box3().setFromObject(mesh).getSize(new Vector3()).toArray().map(v=>+v.toFixed(4))};
}
