import * as THREE from 'three';
import {cylinder,pipe} from './materials.js';
import {HELMET_WINDOW,windowPoint,windowContains,helmetFrame,helmetPanels,helmetLiner} from './eva-helmet-detail.js';

const scale=.59,radius=.295,origin=new THREE.Vector3(0,1.65,-.040);
const collarNormal=new THREE.Vector3(0,1,.30).normalize();
const collarTop=new THREE.Vector3(0,1.629,-.044).addScaledVector(collarNormal,.032).sub(origin).divideScalar(scale);
// Place the sphere on the collar's 133 mm upper radius without stretching it.
const sphereCentre=collarTop.clone().addScaledVector(collarNormal,Math.sqrt(radius**2-(.133/scale)**2));
const lateralFit=.90,depthFit=.88;
export const EVA_HELMET={base:origin.y,scale,radius,lateralFit,depthFit,width:radius*2*lateralFit,height:radius*2,depth:radius*2*depthFit,depthOffset:origin.z,axisDepth:sphereCentre.z,centreHeight:sphereCentre.y};

function helmetPoint(latitude,longitude,offset=0){
  // Retain the smooth spherical crown, but reduce the oversized horizontal
  // bulge. Fade the fit above the neck plane so its circular seat is unchanged.
  const radius=EVA_HELMET.radius+offset,ring=Math.cos(latitude)*radius;
  const point=new THREE.Vector3(
    Math.sin(longitude)*ring,
    EVA_HELMET.centreHeight+Math.sin(latitude)*radius,
    EVA_HELMET.axisDepth+Math.cos(longitude)*ring,
  );
  const fit=THREE.MathUtils.smoothstep(point.clone().sub(collarTop).dot(collarNormal),0,.16);
  point.x*=THREE.MathUtils.lerp(1,lateralFit,fit);
  point.z=EVA_HELMET.axisDepth+(point.z-EVA_HELMET.axisDepth)*THREE.MathUtils.lerp(1,depthFit,fit);
  return point;
}

function helmetSeatPoint(angle){
  // Intersect the sphere with the existing inclined neck plane; do not tilt
  // or stretch the ball itself to make it fit the collar.
  const centre=new THREE.Vector3(0,EVA_HELMET.centreHeight,EVA_HELMET.axisDepth);
  const distance=centre.clone().sub(collarTop).dot(collarNormal);
  const circleCentre=centre.addScaledVector(collarNormal,-distance);
  const radius=Math.sqrt(EVA_HELMET.radius**2-distance**2);
  return circleCentre.addScaledVector(new THREE.Vector3(1,0,0),Math.sin(angle)*radius)
    .addScaledVector(new THREE.Vector3(0,-.30,1).normalize(),Math.cos(angle)*radius);
}

function visorSurface(material,{bottom,top,angle,offset}){
  const columns=64,rows=40,vertices=[],uvs=[],indices=[];
  for(let row=0;row<=rows;row++)for(let col=0;col<=columns;col++){
    const v=row/rows,u=col/columns;
    // Rounded upper/lower corners, while the middle of the face remains tall and broad.
    vertices.push(...windowPoint(helmetPoint,u,v,{bottom,top,angle,offset}));uvs.push(u,v);
    if(row<rows&&col<columns){const a=row*(columns+1)+col,b=a+1,c=a+columns+1,d=c+1;indices.push(a,b,c,b,d,c);}
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));geometry.setIndex(indices);geometry.computeVertexNormals();
  const mesh=new THREE.Mesh(geometry,material);mesh.castShadow=true;mesh.receiveShadow=true;return mesh;
}

export function helmetHoseSocket(side){
  const latitude=-.16,longitude=side*(Math.PI-.43),position=helmetPoint(latitude,longitude,.007);
  const along=helmetPoint(latitude,longitude+.001).sub(helmetPoint(latitude,longitude-.001));
  const up=helmetPoint(latitude+.001,longitude).sub(helmetPoint(latitude-.001,longitude));
  const axis=along.cross(up).normalize();
  return{position,axis,outlet:position.clone().addScaledVector(axis,.055)};
}

export function createEVAHelmet(m,{red=false}={}){
  const root=new THREE.Group();root.name='Full-face EVA helmet';root.position.set(0,EVA_HELMET.base,EVA_HELMET.depthOffset);root.scale.setScalar(EVA_HELMET.scale);
  const shellPaint=m.evaHelmet.clone();shellPaint.color.setHex(red?0x962229:0xd4d7d2);shellPaint.roughness=.52;shellPaint.metalness=.19;
  shellPaint.roughnessMap=m.enamel.map;shellPaint.bumpMap=m.enamel.bumpMap;shellPaint.bumpScale=.0004;
  const hardware=new THREE.MeshStandardMaterial({color:0x62655d,roughness:.32,metalness:.78});
  const edge=new THREE.MeshStandardMaterial({color:0xa2a69b,roughness:.28,metalness:.8});
  const black=new THREE.MeshStandardMaterial({color:0x141914,roughness:.57,metalness:.26});
  const panel=shellPaint.clone();panel.color.setHex(red?0x7e2025:0xc3c6bb);
  const seam=m.evaSeam.clone();seam.color.setHex(0x687064);
  const padding=m.evaCloth.clone();padding.color.setHex(0x182119);padding.roughness=.99;padding.metalness=0;
  const detail={paint:shellPaint,panel,metal:hardware,edge,black,seam,padding,rubber:m.rubber};
  // Fit a spherical base without reintroducing a long cylinder or pointed crown.
  const geometry=new THREE.SphereGeometry(1,80,56),positions=geometry.attributes.position;
  const unitPositions=positions.clone(),indices=[];
  for(let i=0;i<geometry.index.count;i+=3){
    const triangle=[0,1,2].map(j=>geometry.index.getX(i+j));
    const centre=new THREE.Vector3(),corners=triangle.map(vertex=>new THREE.Vector3().fromBufferAttribute(unitPositions,vertex));
    for(const corner of corners)centre.add(corner);centre.normalize();
    // There is a real opening behind the glass, not a white sphere hidden by
    // an opaque black decal. The gasket covers the cut's tessellated edge.
    const entersWindow=p=>windowContains(Math.asin(THREE.MathUtils.clamp(p.y,-1,1)),Math.atan2(p.x,p.z),.025);
    if(!entersWindow(centre)&&!corners.some(entersWindow))indices.push(...triangle);
  }
  for(let i=0;i<positions.count;i++){
    const latitude=Math.asin(THREE.MathUtils.clamp(positions.getY(i),-1,1)),longitude=Math.atan2(positions.getX(i),positions.getZ(i));
    const point=helmetPoint(latitude,longitude);positions.setXYZ(i,point.x,point.y,point.z);
  }
  geometry.computeVertexNormals();geometry.setIndex(indices);
  const shell=new THREE.Mesh(geometry,shellPaint);shell.name='Metal helmet shell';shell.castShadow=true;shell.receiveShadow=true;root.add(shell);
  helmetLiner(root,helmetPoint,detail,new THREE.Vector3(0,EVA_HELMET.centreHeight,EVA_HELMET.axisDepth));
  helmetFrame(root,helmetPoint,detail);helmetPanels(root,helmetPoint,detail);
  const glass=new THREE.MeshPhysicalMaterial({color:0x101a13,roughness:.18,metalness:.10,clearcoat:1,clearcoatRoughness:.10,transparent:true,opacity:.84,depthWrite:false});
  glass.userData.castShadow=false;
  const visor=visorSurface(glass,{...HELMET_WINDOW,offset:.012});visor.name='Continuous face visor';visor.castShadow=false;root.add(visor);
  const rim=Array.from({length:65},(_,i)=>helmetSeatPoint(-Math.PI+i*Math.PI/32).toArray());
  pipe(root,m.metal,rim,.009).name='Lower helmet rim';
  for(const side of [-1,1]){
    const pivot=new THREE.Group();pivot.position.set(side*EVA_HELMET.width/2,EVA_HELMET.centreHeight+.035,EVA_HELMET.axisDepth-.070*depthFit);pivot.rotation.z=-side*Math.PI/2;root.add(pivot);
    cylinder(pivot,hardware,0,0,0,.075,.028,.075,48).name='Circular visor hinge';
    cylinder(pivot,edge,0,.022,0,.061,.016,.061,48);
    cylinder(pivot,black,0,.033,0,.051,.012,.051,48).name='Hinge recessed locking ring';
    cylinder(pivot,hardware,0,.041,0,.040,.008,.040,48).name='Hinge centre cap';
    const hingeRing=new THREE.Mesh(new THREE.TorusGeometry(.057,.0028,8,48),hardware);hingeRing.rotation.x=Math.PI/2;hingeRing.position.y=.033;pivot.add(hingeRing);
    for(let i=0;i<8;i++){
      const angle=i*Math.PI/4+.3;
      cylinder(pivot,black,Math.cos(angle)*.066,.017,Math.sin(angle)*.066,.004,.010,.004,8);
    }
    const socket=helmetHoseSocket(side),port=new THREE.Group();port.name='Rear helmet hose port';port.userData.side=side;
    port.position.copy(socket.position);port.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),socket.axis);root.add(port);
    cylinder(port,hardware,0,0,0,.048,.015,.048,40).name='Rear port flange';
    cylinder(port,m.dark,0,.017,0,.033,.024,.033,32);
    cylinder(port,hardware,0,.032,0,.030,.012,.030,32);
    cylinder(port,m.rubber,0,.047,0,.025,.022,.025,32);
    for(let i=0;i<6;i++){const a=i*Math.PI/3;cylinder(port,m.dark,Math.cos(a)*.039,.010,Math.sin(a)*.039,.0035,.009,.0035,8);}
    const outlet=new THREE.Object3D();outlet.name='Helmet hose outlet';outlet.position.y=.055;port.add(outlet);
  }
  return root;
}
