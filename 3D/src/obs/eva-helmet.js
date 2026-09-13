import * as THREE from 'three';
import {box,cylinder,pipe} from './materials.js';

export const EVA_HELMET={base:1.69,scale:.75,width:.55,height:.61,depth:.52};
const signedPower=(value,power)=>Math.sign(value)*Math.abs(value)**power;

function helmetPoint(latitude,longitude,offset=0){
  const radius=Math.max(0,Math.cos(latitude))**.72,vertical=signedPower(Math.sin(latitude),.85);
  const x=radius*signedPower(Math.sin(longitude),.85),z=radius*signedPower(Math.cos(longitude),.85);
  const point=new THREE.Vector3(x*EVA_HELMET.width/2,(vertical+1)*EVA_HELMET.height/2,z*EVA_HELMET.depth/2-.035-.018*vertical);
  return point.addScaledVector(new THREE.Vector3(x,vertical,z).normalize(),offset);
}

function visorSurface(material,{bottom,top,angle,offset}){
  const columns=64,rows=40,vertices=[],uvs=[],indices=[];
  for(let row=0;row<=rows;row++)for(let col=0;col<=columns;col++){
    const v=row/rows,u=col/columns;
    // Rounded upper/lower corners, while the middle of the face remains tall and broad.
    const corner=Math.max(0,1-Math.min(v,1-v)/.13),span=angle*(1-.18*corner*corner);
    vertices.push(...helmetPoint(THREE.MathUtils.lerp(bottom,top,v),(u*2-1)*span,offset));uvs.push(u,v);
    if(row<rows&&col<columns){const a=row*(columns+1)+col,b=a+1,c=a+columns+1,d=c+1;indices.push(a,b,c,b,d,c);}
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));geometry.setIndex(indices);geometry.computeVertexNormals();
  const mesh=new THREE.Mesh(geometry,material);mesh.castShadow=true;mesh.receiveShadow=true;return mesh;
}

export function createEVAHelmet(m){
  const root=new THREE.Group();root.name='Full-face EVA helmet';root.position.y=EVA_HELMET.base;root.scale.setScalar(EVA_HELMET.scale);
  // Deform a closed sphere into a rounded, upright shell, preserving its poles and UVs.
  const geometry=new THREE.SphereGeometry(1,80,56),positions=geometry.attributes.position;
  for(let i=0;i<positions.count;i++){
    const latitude=Math.asin(THREE.MathUtils.clamp(positions.getY(i),-1,1)),longitude=Math.atan2(positions.getX(i),positions.getZ(i));
    const point=helmetPoint(latitude,longitude);positions.setXYZ(i,point.x,point.y,point.z);
  }
  geometry.computeVertexNormals();
  const shell=new THREE.Mesh(geometry,m.evaHelmet);shell.name='Metal helmet shell';shell.castShadow=true;shell.receiveShadow=true;root.add(shell);
  const seal=visorSurface(m.rubber,{bottom:-1.00,top:.74,angle:1.18,offset:.003});seal.name='Visor perimeter gasket';root.add(seal);
  const glass=m.evaVisor.clone();glass.color.setHex(0x18241e);glass.roughness=.20;glass.metalness=.28;glass.clearcoat=.7;
  const visor=visorSurface(glass,{bottom:-.94,top:.66,angle:1.10,offset:.007});visor.name='Continuous face visor';root.add(visor);
  pipe(root,m.dark,Array.from({length:33},(_,i)=>helmetPoint(.75,(i/32*2-1)*1.02,.005).toArray()),.009).name='Brow visor seal';
  const rim=Array.from({length:65},(_,i)=>helmetPoint(-1.01,-Math.PI+i*Math.PI/32,.003).toArray());
  pipe(root,m.metal,rim,.009).name='Lower helmet rim';
  for(const side of [-1,1]){
    const pivot=new THREE.Group();pivot.position.set(side*.262,.365,-.100);pivot.rotation.z=side*Math.PI/2;root.add(pivot);
    cylinder(pivot,m.rubber,0,0,0,.097,.031,.097,40).name='Circular visor hinge';
    cylinder(pivot,m.metal,0,-side*.021,0,.080,.016,.080,40);
    cylinder(pivot,m.dark,0,-side*.033,0,.066,.012,.066,40);
    for(let i=0;i<4;i++){
      const angle=i*Math.PI/2+.3;
      cylinder(pivot,m.metal,Math.cos(angle)*.083,-side*.019,Math.sin(angle)*.083,.006,.010,.006,8);
    }
    pipe(root,m.evaHelmet,[[-.88,side*1.24],[-.57,side*1.42],[-.25,side*1.64]].map(([latitude,longitude])=>helmetPoint(latitude,longitude,.007).toArray()),.014).name='Cheek visor surround';
    const latch=box(root,m.dark,side*.204,.134,.071,.039,.053,.021,.007);latch.rotation.y=side*.95;latch.rotation.z=-side*.35;
    for(let i=0;i<4;i++){
      const latitude=-.46+i*.25;
      pipe(root,m.rubber,[1.97,2.10,2.23].map(angle=>helmetPoint(latitude,side*angle,.004).toArray()),.005).name='Rear cooling groove';
    }
    pipe(root,m.dark,[.75,.92,1.08,1.24].map(latitude=>helmetPoint(latitude,side*1.72,.003).toArray()),.0045).name='Crown panel joint';
  }
  return root;
}
