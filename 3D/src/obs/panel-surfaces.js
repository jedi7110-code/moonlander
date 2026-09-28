import * as THREE from 'three';

// A printed face REPLACES the enclosure's front cap. Never stack a decal
// a millimetre above an intact cap: the distant OBS camera loses that depth.
export function removeFrontCap(geometry){
  const normals=geometry.attributes.normal,source=geometry.index,indices=[];
  for(let i=0;i<(source?.count??normals.count);i+=3){
    const tri=[0,1,2].map(j=>source?source.getX(i+j):i+j);
    if(tri.every(j=>normals.getZ(j)>.999))continue;
    indices.push(...tri);
  }
  geometry.setIndex(indices);geometry.clearGroups();return geometry;
}

export function openPanelBox(parent,material,x,y,z,w,h,d){
  const mesh=new THREE.Mesh(removeFrontCap(new THREE.BoxGeometry(w,h,d)),material);
  mesh.position.set(x,y,z);mesh.castShadow=mesh.receiveShadow=true;parent.add(mesh);return mesh;
}

// holes use artwork coordinates: x/y start at the upper-left, in [0,1].
export function panelFaceGeometry(w,h,holes=[],corner=0){
  const a=w/2,b=h/2,k=Math.min(corner,a,b),shape=new THREE.Shape();
  const points=k?[[a-k,b],[-a+k,b],[-a,b-k],[-a,-b+k],[-a+k,-b],[a-k,-b],[a,-b+k],[a,b-k]]:[[a,b],[-a,b],[-a,-b],[a,-b]];
  points.forEach(([x,y],i)=>i?shape.lineTo(x,y):shape.moveTo(x,y));shape.closePath();
  for(const [x,y,width,height] of holes){
    const left=(x-.5)*w,right=(x+width-.5)*w,top=(.5-y)*h,bottom=(.5-y-height)*h;
    const hole=new THREE.Path();hole.moveTo(left,top).lineTo(right,top).lineTo(right,bottom).lineTo(left,bottom).closePath();shape.holes.push(hole);
  }
  const geometry=new THREE.ShapeGeometry(shape),position=geometry.attributes.position,uv=geometry.attributes.uv;
  for(let i=0;i<uv.count;i++)uv.setXY(i,position.getX(i)/w+.5,position.getY(i)/h+.5);
  return geometry;
}
