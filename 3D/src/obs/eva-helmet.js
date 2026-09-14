import * as THREE from 'three';
import {box,cylinder,pipe} from './materials.js';

export const EVA_HELMET={base:1.65,scale:.59,width:.49,height:.56,depth:.56};
const signedPower=(value,power)=>Math.sign(value)*Math.abs(value)**power;

function helmetPoint(latitude,longitude,offset=0,crown=false){
  const vertical=signedPower(Math.sin(latitude),.98);
  // The dome is rounded only above the temples. Below them the shell keeps
  // its width down to the chin band; the hidden underside closes into a pole.
  const radius=latitude>=0?Math.max(0,Math.cos(latitude))**.96:
    (.90+.10*THREE.MathUtils.smoothstep(latitude,-1.35,0))*THREE.MathUtils.smoothstep(latitude,-Math.PI/2,-1.43);
  const x=radius*signedPower(Math.sin(longitude),.85),z=radius*signedPower(Math.cos(longitude),.85);
  const lower=1-THREE.MathUtils.smoothstep(latitude,-1.25,.15);
  const rear=Math.max(0,-Math.cos(longitude));
  const depth=z*EVA_HELMET.depth/2*(1-.12*lower*Math.max(0,Math.cos(longitude)))+.085*lower*rear-.035-.018*vertical;
  // The chin slopes forward, but that tilt must fade below the occiput.
  // Carrying it into the rear crown lifts the shell into a pointed shoulder.
  const frontSlope=1-THREE.MathUtils.smoothstep(latitude,.6,Math.PI/2);
  const rearSlope=1-THREE.MathUtils.smoothstep(latitude,-.6,.55);
  const slope=THREE.MathUtils.lerp(frontSlope,rearSlope,rear*rear);
  const point=new THREE.Vector3(x*EVA_HELMET.width/2,(vertical+1)*EVA_HELMET.height/2-.30*(depth+.035)*slope,depth);
  if(rear>0){
    // Author the rear as an oval rather than adding a bump to the dome.
    // Its widest section has a vertical tangent and joins the crown smoothly.
    const h=(vertical+1)/2,oval=(h-.47)/(h>.47?.53:.72);
    const closure=THREE.MathUtils.smoothstep(latitude,-Math.PI/2,-1.43);
    const rearDepth=-.035-.018*vertical-.250*Math.sqrt(Math.max(0,1-oval*oval))*closure;
    const rearHeight=h*EVA_HELMET.height+.060*(1-THREE.MathUtils.smoothstep(h,0,.30));
    point.z=THREE.MathUtils.lerp(point.z,rearDepth,rear*rear);
    point.y=THREE.MathUtils.lerp(point.y,rearHeight,rear*rear);
  }
  if(crown){
    const lip=THREE.MathUtils.smoothstep(latitude,.69,.74)*(1-THREE.MathUtils.smoothstep(latitude,.74,1.10));
    point.z+=.054*lip*Math.max(0,Math.cos(longitude))**2;
  }
  if(latitude<-1.43){
    const closure=THREE.MathUtils.smoothstep(latitude,-Math.PI/2,-1.43);
    point.lerpVectors(new THREE.Vector3(0,0,-.017),point.clone(),closure);
  }
  return point.addScaledVector(new THREE.Vector3(x,vertical,z).normalize(),offset);
}

function visorSurface(material,{bottom,top,angle,offset}){
  const columns=64,rows=40,vertices=[],uvs=[],indices=[];
  for(let row=0;row<=rows;row++)for(let col=0;col<=columns;col++){
    const v=row/rows,u=col/columns;
    // Rounded upper/lower corners, while the middle of the face remains tall and broad.
    const corner=Math.max(0,1-Math.min(v,1-v)/.13),span=angle*(1-(v<.5?.05:.18)*corner*corner);
    vertices.push(...helmetPoint(THREE.MathUtils.lerp(bottom,top,v),(u*2-1)*span,offset));uvs.push(u,v);
    if(row<rows&&col<columns){const a=row*(columns+1)+col,b=a+1,c=a+columns+1,d=c+1;indices.push(a,b,c,b,d,c);}
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));geometry.setIndex(indices);geometry.computeVertexNormals();
  const mesh=new THREE.Mesh(geometry,material);mesh.castShadow=true;mesh.receiveShadow=true;return mesh;
}

export function createEVAHelmet(m){
  const root=new THREE.Group();root.name='Full-face EVA helmet';root.position.y=EVA_HELMET.base;root.scale.setScalar(EVA_HELMET.scale);
  // Keep the sphere's closed topology, with a broad chin and cylindrical lower shell.
  const geometry=new THREE.SphereGeometry(1,80,56),positions=geometry.attributes.position;
  for(let i=0;i<positions.count;i++){
    const latitude=Math.asin(THREE.MathUtils.clamp(positions.getY(i),-1,1)),longitude=Math.atan2(positions.getX(i),positions.getZ(i));
    const point=helmetPoint(latitude,longitude,0,true);positions.setXYZ(i,point.x,point.y,point.z);
  }
  geometry.computeVertexNormals();
  const shell=new THREE.Mesh(geometry,m.evaHelmet);shell.name='Metal helmet shell';shell.castShadow=true;shell.receiveShadow=true;root.add(shell);
  const seal=visorSurface(m.rubber,{bottom:-1.00,top:.69,angle:1.18,offset:.003});seal.name='Visor perimeter gasket';root.add(seal);
  const glass=m.evaVisor.clone();glass.color.setHex(0x18241e);glass.roughness=.20;glass.metalness=.28;glass.clearcoat=.7;
  const visor=visorSurface(glass,{bottom:-.94,top:.66,angle:1.10,offset:.007});visor.name='Continuous face visor';root.add(visor);
  const rim=Array.from({length:65},(_,i)=>helmetPoint(-1.01,-Math.PI+i*Math.PI/32,.003).toArray());
  pipe(root,m.metal,rim,.009).name='Lower helmet rim';
  for(const side of [-1,1]){
    const pivot=new THREE.Group();pivot.position.set(side*.232,.335,-.075);pivot.rotation.z=-side*Math.PI/2;root.add(pivot);
    cylinder(pivot,m.evaHelmet,0,0,0,.075,.028,.075,8).name='Circular visor hinge';
    cylinder(pivot,m.metal,0,.022,0,.061,.016,.061,32);
    cylinder(pivot,m.dark,0,.033,0,.045,.012,.045,32);
    for(let i=0;i<4;i++){
      const angle=i*Math.PI/2+.3;
      cylinder(pivot,m.dark,Math.cos(angle)*.066,.017,Math.sin(angle)*.066,.004,.010,.004,8);
    }
    pipe(root,m.evaHelmet,[[-.88,side*1.24],[-.57,side*1.42],[-.25,side*1.64]].map(([latitude,longitude])=>helmetPoint(latitude,longitude,.007).toArray()),.014).name='Cheek visor surround';
    const latchPoint=helmetPoint(-.96,side*.98,.012);
    const latch=box(root,m.dark,...latchPoint,.039,.042,.021,.005);latch.rotation.y=side*.95;latch.rotation.z=-side*.35;
    for(let i=0;i<4;i++){
      const latitude=-.46+i*.25;
      pipe(root,m.evaSeam,[1.97,2.10,2.23].map(angle=>helmetPoint(latitude,side*angle,.002).toArray()),.0018).name='Rear cooling groove';
    }
    pipe(root,m.evaSeam,[.75,.92,1.08,1.24].map(latitude=>helmetPoint(latitude,side*1.72,.002).toArray()),.0015).name='Crown panel joint';
  }
  return root;
}
