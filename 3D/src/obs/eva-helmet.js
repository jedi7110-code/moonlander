import * as THREE from 'three';
import {ball,pipe} from './materials.js';

export const EVA_HELMET={base:1.69,scale:.75,width:.55,height:.61,depth:.52};
const signedPower=(value,power)=>Math.sign(value)*Math.abs(value)**power;

function helmetPoint(latitude,longitude,offset=0){
  const radius=Math.max(0,Math.cos(latitude))**.46,vertical=signedPower(Math.sin(latitude),.72);
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
  const seal=visorSurface(m.rubber,{bottom:-.88,top:.90,angle:1.36,offset:.003});seal.name='Visor perimeter gasket';root.add(seal);
  const visor=visorSurface(m.evaVisor,{bottom:-.84,top:.86,angle:1.30,offset:.007});visor.name='Continuous face visor';root.add(visor);
  const rim=Array.from({length:65},(_,i)=>helmetPoint(-1.01,-Math.PI+i*Math.PI/32,.003).toArray());
  pipe(root,m.metal,rim,.009).name='Lower helmet rim';
  for(const side of [-1,1]){
    ball(root,m.rubber,side*.259,.293,-.128,.025,.132,.082).name='Oval side seal';
    ball(root,m.evaHelmet,side*.278,.293,-.128,.021,.113,.064).name='Oval side housing';
    ball(root,m.dark,side*.296,.293,-.128,.009,.084,.042).name='Recessed oval side panel';
    for(let i=0;i<4;i++){
      const latitude=-.46+i*.25;
      pipe(root,m.rubber,[1.97,2.10,2.23].map(angle=>helmetPoint(latitude,side*angle,.004).toArray()),.005).name='Rear cooling groove';
    }
    pipe(root,m.dark,[.75,.92,1.08,1.24].map(latitude=>helmetPoint(latitude,side*1.72,.003).toArray()),.0045).name='Crown panel joint';
  }
  return root;
}
