import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {SVGLoader} from 'three/addons/loaders/SVGLoader.js';
import taraironWordmark from './tarairon-wordmark.js';
import {HABITAT_ENVELOPE,HABITAT_FLOORS,HABITAT_WINDOWS,cabinToHabitat} from './habitat-envelope.js';

const referenceCircumference=200,referenceRadius=referenceCircumference/(2*Math.PI);
export const EXTERIOR=Object.freeze({radius:referenceRadius-HABITAT_ENVELOPE.centerY,
  gravityRadius:referenceRadius,circumference:referenceCircumference,rpm:Math.sqrt(9.80665/referenceRadius)*60/(2*Math.PI),rotorX:-1.6,
  podLength:HABITAT_ENVELOPE.right-HABITAT_ENVELOPE.left,
  podWidth:HABITAT_ENVELOPE.front+HABITAT_ENVELOPE.rearRoomBack,
  podDepth:HABITAT_ENVELOPE.top-HABITAT_ENVELOPE.bottom,bowX:17.3,sternX:-23.3});
export const rotationGravity=(rpm,radius=EXTERIOR.gravityRadius)=>(rpm*2*Math.PI/60)**2*radius/9.80665;
export const exteriorAngle=(seconds,rpm=EXTERIOR.rpm)=>seconds*rpm*Math.PI/30;
const V=(...values)=>new THREE.Vector3(...values);
function random(seed=817){return()=>{seed=(Math.imul(1664525,seed)+1013904223)>>>0;return seed/4294967296;};}

function paintMap(worn,habitat=false){
  if(typeof document==='undefined')return null;
  const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=512;
  const c=canvas.getContext('2d'),r=random(283);c.fillStyle='#c7c1ac';c.fillRect(0,0,1024,512);
  const panels=[];
  if(habitat){
    const xs=[0,180,490,750,1024];
    for(let i=0;i<4;i++){const split=i%2?310:170;
      panels.push([xs[i],0,xs[i+1]-xs[i],split],[xs[i],split,xs[i+1]-xs[i],512-split]);}
  }else for(let row=0;row<4;row++)for(let col=0;col<8;col++)panels.push([col*128,row*128,128,128]);
  for(const [x,y,w,h]of panels){
    const shade=Math.floor(r()*14);
    c.fillStyle=`rgb(${198-shade},${191-shade},${169-shade})`;c.fillRect(x+2,y+2,w-4,h-4);
    c.strokeStyle='#918c7e';c.lineWidth=1.2;c.strokeRect(x+1,y+1,w-2,h-2);
    c.strokeStyle='#e1dbc6';c.strokeRect(x+3,y+3,w-7,h-7);
    for(const dx of [8,w-8])for(const dy of [8,h-8]){c.fillStyle='#6b695f';c.fillRect(x+dx,y+dy,2,2);}
  }
  if(worn){
    for(let i=0;i<90;i++){
      const x=r()*1024,y=r()*512,rx=9+r()*55,ry=4+r()*30;
      c.save();c.translate(x,y);c.rotate(r()*Math.PI);c.scale(1,ry/rx);
      const g=c.createRadialGradient(0,0,1,0,0,rx);g.addColorStop(0,`rgba(42,39,33,${.06+r()*.19})`);g.addColorStop(1,'rgba(42,39,33,0)');
      c.fillStyle=g;c.fillRect(-rx,-rx,rx*2,rx*2);c.restore();
    }
    for(let i=0;i<1700;i++){
      const x=r()*1024,y=r()*512,l=1+r()*9,a=r()*Math.PI*2;
      c.strokeStyle=i%5===0?'#e0d8be88':'#66635855';c.lineWidth=.3+r()*.8;c.beginPath();c.moveTo(x,y);c.lineTo(x+Math.cos(a)*l,y+Math.sin(a)*l);c.stroke();
    }
    for(let i=0;i<400;i++){c.fillStyle='#3d3d3538';c.fillRect(r()*1024,r()*512,.5+r()*2,.5+r()*2);}
  }
  const map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;map.anisotropy=4;map.name=worn?'Aged beige / seams and abrasion':'Beige / service panels';return map;
}
function sootMap(){
  if(typeof document==='undefined')return null;
  const canvas=document.createElement('canvas');canvas.width=canvas.height=256;const c=canvas.getContext('2d'),r=random(415);
  for(let i=0;i<80;i++){
    const x=95+r()*65,y=60+r()*125,rx=18+r()*44;
    const g=c.createRadialGradient(x,y,0,x,y,rx);g.addColorStop(0,'rgba(26,25,22,.08)');g.addColorStop(1,'rgba(26,25,22,0)');c.fillStyle=g;c.fillRect(x-rx,y-rx,rx*2,rx*2);
  }
  return new THREE.CanvasTexture(canvas);
}
function ignitionMap(){
  if(typeof document==='undefined')return null;
  const canvas=document.createElement('canvas');canvas.width=canvas.height=256;const c=canvas.getContext('2d'),r=random(651);
  c.fillStyle='#000';c.fillRect(0,0,256,256);
  const g=c.createRadialGradient(125,131,4,128,128,119);g.addColorStop(0,'#e5f6ff');g.addColorStop(.27,'#9cc6de');
  g.addColorStop(.65,'#294b68');g.addColorStop(1,'#000');c.fillStyle=g;c.fillRect(0,0,256,256);
  for(let i=0;i<90;i++){
    const x=70+r()*116,y=68+r()*120;c.fillStyle=`rgba(5,20,35,${.08+r()*.18})`;
    c.beginPath();c.ellipse(x,y,2+r()*7,3+r()*14,r()*Math.PI,0,Math.PI*2);c.fill();
  }
  const map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;map.name='Low ignition / uneven blue-white heat';return map;
}
function addMesh(parent,geometry,material,name,position=[0,0,0]){
  const mesh=new THREE.Mesh(geometry,material);mesh.name=name;mesh.position.set(...position);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;
}
function box(parent,m,p,size,name='Equipment enclosure'){return addMesh(parent,new THREE.BoxGeometry(...size),m,name,p);}
function rod(parent,m,a,b,r=.07,name='Pipe'){
  const p=V(...a),q=V(...b),d=q.clone().sub(p);
  const mesh=addMesh(parent,new THREE.CylinderGeometry(r,r,d.length(),6),m,name,p.add(q).multiplyScalar(.5).toArray());
  mesh.quaternion.setFromUnitVectors(V(0,1,0),d.normalize());return mesh;
}
function pipe(parent,m,points,r=.07,name='Service line'){for(let i=1;i<points.length;i++)rod(parent,m,points[i-1],points[i],r,name);}
function axisCylinder(parent,m,x,r,length,name,segments=16){
  const mesh=addMesh(parent,new THREE.CylinderGeometry(r,r,length,segments),m,name,[x,0,0]);mesh.rotation.z=-Math.PI/2;return mesh;
}
function axisRing(parent,m,x,r,t,name,segments=48){
  const mesh=addMesh(parent,new THREE.TorusGeometry(r,t,6,segments),m,name,[x,0,0]);mesh.rotation.y=Math.PI/2;return mesh;
}
function loft(parent,m,sections,name,segments=8){
  const positions=[],uvs=[],indices=[];
  for(let i=0;i<sections.length;i++){
    const [x,ry,rz]=sections[i];
    for(let j=0;j<=segments;j++){const a=j/segments*Math.PI*2+Math.PI/8;positions.push(x,Math.cos(a)*ry,Math.sin(a)*rz);uvs.push(i/(sections.length-1),j/segments);}
  }
  for(let i=0;i<sections.length-1;i++)for(let j=0;j<segments;j++){
    const a=i*(segments+1)+j,b=a+segments+1;indices.push(a,a+1,b,b,a+1,b+1);
  }
  for(const [offset,reverse]of [[0,true],[(sections.length-1)*(segments+1),false]])for(let j=1;j<segments-1;j++)indices.push(offset,offset+(reverse?j+1:j),offset+(reverse?j:j+1));
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));g.setIndex(indices);g.computeVertexNormals();return addMesh(parent,g,m,name);
}
function facetedHull(parent,m,sections,name){
  const positions=[],uvs=[],indices=[];
  for(const [i,[x,bottom,top,width,cut]]of sections.entries()){
    const ring=[[bottom,-width+cut],[bottom+cut,-width],[top-cut,-width],[top,-width+cut],
      [top,width-cut],[top-cut,width],[bottom+cut,width],[bottom,width-cut]];
    for(const [j,[y,z]]of ring.entries()){positions.push(x,y,z);uvs.push(i/(sections.length-1),j/8);}
  }
  for(let i=0;i<sections.length-1;i++)for(let j=0;j<8;j++){
    const a=i*8+j,next=i*8+(j+1)%8,b=a+8;indices.push(a,next,b,b,next,next+8);
  }
  for(const [offset,reverse]of [[0,true],[(sections.length-1)*8,false]])
    for(let j=1;j<7;j++)indices.push(offset,offset+(reverse?j+1:j),offset+(reverse?j:j+1));
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));geometry.setIndex(indices);geometry.computeVertexNormals();
  return addMesh(parent,geometry,m,name);
}
function chamferBox(parent,m,p,size,name){
  const [w,h,d]=size,c=Math.min(w,h)*.14,shape=new THREE.Shape();
  const points=[[-w/2+c,-h/2],[w/2-c,-h/2],[w/2,-h/2+c],[w/2,h/2-c],[w/2-c,h/2],[-w/2+c,h/2],[-w/2,h/2-c],[-w/2,-h/2+c]];
  points.forEach(([x,y],i)=>i?shape.lineTo(x,y):shape.moveTo(x,y));shape.closePath();
  const geometry=new THREE.ExtrudeGeometry(shape,{depth:d,bevelEnabled:false,steps:1});geometry.translate(0,0,-d/2);
  // ExtrudeGeometry's world-unit UVs would clamp this paint texture over most
  // of a large module. Give each face a usable sheet of panels and wear.
  const positions=geometry.attributes.position,normals=geometry.attributes.normal,uv=geometry.attributes.uv;
  for(let i=0;i<positions.count;i++){
    const x=positions.getX(i),y=positions.getY(i),z=positions.getZ(i);
    if(Math.abs(normals.getZ(i))>.5)uv.setXY(i,x/w+.5,y/h+.5);
    else if(Math.abs(normals.getX(i))>.5)uv.setXY(i,z/d+.5,y/h+.5);
    else uv.setXY(i,x/w+.5,z/d+.5);
  }
  return addMesh(parent,geometry,m,name,p);
}
function label(parent,text,p,w,h,{rotation=[0,0,0],color='#45473c',background=null,size=64}={}){
  if(typeof document==='undefined')return;
  const canvas=document.createElement('canvas');canvas.width=512;canvas.height=128;const c=canvas.getContext('2d');
  if(background){c.fillStyle=background;c.fillRect(0,0,512,128);}
  c.fillStyle=color;c.textAlign='center';c.textBaseline='middle';c.font=`700 ${size}px Arial`;c.fillText(text,256,66,490);
  const map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;
  const material=new THREE.MeshStandardMaterial({map,transparent:true,roughness:.9,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2});
  const mesh=addMesh(parent,new THREE.PlaneGeometry(w,h),material,'Hull stencil / '+text,p);mesh.rotation.set(...rotation);mesh.castShadow=false;return mesh;
}
function shipWordmark(parent,p,width,rotation){
  if(typeof document==='undefined')return;
  const group=new THREE.Group();group.name='Original TARAIRON wordmark';
  group.position.set(...p);group.rotation.set(0,rotation,0);parent.add(group);
  const material=new THREE.MeshStandardMaterial({color:0x45473c,roughness:.9,side:THREE.DoubleSide,
    polygonOffset:true,polygonOffsetFactor:-2});material.name='TARAIRON wordmark ink';
  const scale=width/1417;
  for(const path of new SVGLoader().parse(taraironWordmark).paths)for(const shape of SVGLoader.createShapes(path)){
    const geometry=new THREE.ShapeGeometry(shape,8);geometry.translate(-713.5,-685,0);geometry.scale(scale,-scale,1);geometry.computeVertexNormals();
    const mesh=addMesh(group,geometry,material,'TARAIRON original letter');mesh.castShadow=false;
  }
}
function outline(Type,left,right,bottom,top,cut=.4){
  const shape=new Type(),points=[[left+cut,bottom],[right-cut,bottom],[right,bottom+cut],[right,top-cut],[right-cut,top],[left+cut,top],[left,top-cut],[left,bottom+cut]];
  points.forEach(([x,y],i)=>i?shape.lineTo(x,y):shape.moveTo(x,y));shape.closePath();return shape;
}
function opening(Type,x,y,w,h,cut=.12){return outline(Type,x-w/2,x+w/2,y-h/2,y+h/2,Math.min(cut,w/4,h/4));}
function pressureFace(parent,material,{left,right,bottom,top,z,holes=[],name='Habitat pressure wall',depth=.20}){
  const shape=outline(THREE.Shape,left,right,bottom,top);
  for(const hole of holes)shape.holes.push(opening(THREE.Path,hole.x,hole.y,hole.width,hole.height,hole.cut??0));
  const geometry=new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:false,curveSegments:1});
  const p=geometry.attributes.position,uv=geometry.attributes.uv;
  for(let i=0;i<p.count;i++)uv.setXY(i,(p.getX(i)-left)/(right-left),(p.getY(i)-bottom)/(top-bottom));
  return addMesh(parent,geometry,material,name,[0,0,z]);
}
function habitatShell(pod,m,index,stain){
  const e=HABITAT_ENVELOPE,half=EXTERIOR.podDepth/2,front=-e.front,back=e.rearRoomBack;
  const paint=m.habitat;
  const windows=HABITAT_WINDOWS.map(window=>({...window,...cabinToHabitat(window)}));
  pod.userData.windows=windows;pod.userData.cabinScale=1;
  pressureFace(pod,paint,{left:e.left,right:e.right,bottom:-half,top:half,z:front,
    holes:windows.filter(w=>w.face==='corridor'),name:'Three-deck corridor pressure wall'});
  // A continuous rear skin encloses the deepest service room across the whole cabin.
  pressureFace(pod,paint,{left:e.left,right:e.right,bottom:-half,top:half,z:back-.20,
    holes:windows.filter(w=>w.face==='rear'),name:'Continuous rear pressure wall'});
  const mid=(front+back)/2,depth=back-front;
  for(const y of [-half+.10,half-.10])box(pod,paint,[0,y,mid],[EXTERIOR.podLength,.20,depth],'Habitat outer deck / roof');
  for(const x of [e.left+.10,e.right-.10])box(pod,paint,[x,0,mid],[.20,EXTERIOR.podDepth-.20,depth],'Habitat axial end wall');
  // The cabin remains rectangular inside a separate, folded service skin.
  for(const sign of [-1,1]){
    const points=[[sign*half,front-.12],[sign*(half+.95),front+1.25],
      [sign*(half+.95),back-1.25],[sign*half,back+.12]];
    for(let j=0;j<3;j++){
      const [y,z]=points[j],[nextY,nextZ]=points[j+1];
      const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute([
        e.left,y,z,e.right,y,z,e.right,nextY,nextZ,e.left,nextY,nextZ],3));
      geometry.setAttribute('uv',new THREE.Float32BufferAttribute([0,0,1,0,1,1,0,1],2));
      geometry.setIndex(sign<0?[0,1,2,0,2,3]:[0,2,1,0,3,2]);geometry.computeVertexNormals();
      addMesh(pod,geometry,j===1?paint:m.patch,'Folded habitat service skin');
    }
  }
  for(const side of [-1,1]){
    const x=side<0?e.left:e.right;
    const sections=side<0?[[x-1.8,-half+1.25,half-1.25,depth/2-.50,.85],
      [x-.10,-half-.95,half+.95,depth/2+.12,1.25],[x+.65,-half,half,depth/2,.65]]:
      [[x-.65,-half,half,depth/2,.65],[x+.10,-half-.95,half+.95,depth/2+.12,1.25],
      [x+1.8,-half+1.25,half-1.25,depth/2-.50,.85]];
    const end=facetedHull(pod,paint,sections,'Tapered habitat end casing');end.position.z=mid;
  }
  for(const window of windows){
    const outside=window.face==='corridor'?front-.10:back+.02;
    if(window.face==='rear'){
      // Preserve the actual cabin glass depth inside an open, deep reveal.
      const reveal=opening(THREE.Shape,window.x,window.y,window.width+.12,window.height+.12,.15);
      reveal.holes.push(opening(THREE.Path,window.x,window.y,window.width,window.height,window.cut));
      addMesh(pod,new THREE.ExtrudeGeometry(reveal,{depth:outside-window.z,bevelEnabled:false,curveSegments:1}),paint,
        'Recessed rear window reveal / '+window.id,[0,0,window.z]);
    }
    const frame=opening(THREE.Shape,window.x,window.y,window.width+.25,window.height+.25,.17);
    frame.holes.push(opening(THREE.Path,window.x,window.y,window.width,window.height,window.cut));
    addMesh(pod,new THREE.ExtrudeGeometry(frame,{depth:.09,bevelEnabled:false,curveSegments:1}),m.steel,'OBS window rim / '+window.id,[0,0,outside]);
    const glass=addMesh(pod,new THREE.ShapeGeometry(opening(THREE.Shape,0,0,window.width,window.height,window.cut)),m.glass,'OBS glass / '+window.id,[window.x,window.y,window.z]);
    if(window.face==='corridor')glass.rotation.y=Math.PI;
  }
  const guides=new THREE.Group();guides.name='OBS three-floor alignment';guides.visible=false;pod.add(guides);guides.userData.bakeBoundary=true;
  const guideMaterial=new THREE.LineBasicMaterial({color:0xd4c19a,transparent:true,opacity:.55,depthTest:false,depthWrite:false});
  for(const [level,floor]of HABITAT_FLOORS.entries()){
    const y=e.centerY-floor;
    box(pod,m.dark,[0,y+.08,mid],[27.1,.16,depth-.40],`OBS / LEVEL ${level+1} structural floor`);
    const geometry=new THREE.BoxGeometry(26.3,.05,depth-.45),edges=new THREE.EdgesGeometry(geometry);geometry.dispose();
    const line=new THREE.LineSegments(edges,guideMaterial);line.position.set(0,y,mid);line.name=`OBS / LEVEL ${level+1} outline`;guides.add(line);
    label(pod,`LEVEL ${level+1}`,[e.left+.85,y-.76,front-.12],1.25,.28,{rotation:[0,Math.PI,0],size:53});
  }
  // Retention ribs and equipment stay clear of every real window.
  for(const x of [-12.9,-5.8,2.6,12.9])for(const z of [front-.05,back+.06])box(pod,m.steel,[x,0,z],[.12,EXTERIOR.podDepth-.7,.10],'Habitat longitudinal retention rib');
  for(let j=0;j<5;j++){
    const x=-10.8+j*5.25;
    box(pod,j===2?m.red:m.patch,[x,half+1.04,.10],[3.9,.10,2.20],'Underdeck external service panel');
    box(pod,m.dark,[x,half+1.12,1.0],[2.7,.14,.65],'Underdeck cooling recess');
    for(let k=0;k<10;k++)box(pod,m.pipe,[x-1.2+k*.26,half+1.22,1.0],[.075,.06,.60],'Underdeck cooling louvre');
  }
  pipe(pod,m.pipe,[[-13.2,half+1.26,-1.9],[-11.8,half+1.38,-1.9],[11.8,half+1.38,-1.9],[13.2,half+1.20,-1.1]],.10,'Underdeck coolant main');
  for(const x of [-12,-6,0,6,12])box(pod,m.steel,[x,half+1.40,-1.9],[.13,.24,.36],'Coolant pipe restraint');
  for(const side of [-1,1]){
    const end=new THREE.Group();end.position.set(side*(EXTERIOR.podLength/2+1.84),0,mid);end.rotation.y=side*Math.PI/2;pod.add(end);
    chamferBox(end,m.steel,[0,-.5,0],[2.1,2.9,.15],'End servicing hatch');
    chamferBox(end,m.patch,[0,-.5,.11],[1.72,2.48,.10],'End manual pressure cover');
    box(end,m.ochre,[.45,.40,.19],[.30,.20,.08],'End manual latch');
    box(end,m.dark,[-1.35,-1.15,.10],[.36,1.4,.12],'End cooling grille');
    label(end,'SERVICE',[0,.20,.18],1.0,.20,{size:50});
  }
  label(pod,`HAB / 0${index+1}`,[7,half+1.13,-.20],3.8,.70,{rotation:[-Math.PI/2,0,0]});
  const residue=addMesh(pod,new THREE.PlaneGeometry(5.4,2.4),stain,'Local vent stain',[.5,half+1.26,1.3]);residue.rotation.x=-Math.PI/2;residue.castShadow=false;
  bake(pod);return guides;
}
function bake(group){
  group.updateWorldMatrix(true,true);const inverse=group.matrixWorld.clone().invert(),batches=new Map(),original=[];
  group.traverse(mesh=>{
    if(!mesh.isMesh||mesh.material.transparent)return;
    for(let parent=mesh.parent;parent&&parent!==group;parent=parent.parent)if(parent.userData.bakeBoundary)return;
    const geometry=mesh.geometry.index?mesh.geometry.toNonIndexed():mesh.geometry.clone();
    geometry.applyMatrix4(inverse.clone().multiply(mesh.matrixWorld));
    // Extruded shells carry additional normal/UV attributes only; drop groups
    // before merging because each batch owns one material.
    geometry.clearGroups();const geometries=batches.get(mesh.material)??[];geometries.push(geometry);batches.set(mesh.material,geometries);original.push(mesh);
  });
  for(const [material,geometries]of batches){const geometry=mergeGeometries(geometries,false);if(!geometry)throw new Error('Exterior mesh batching failed');addMesh(group,geometry,material,'Batched / '+material.name);geometries.forEach(g=>g.dispose());}
  const disposed=new Set();for(const mesh of original){mesh.removeFromParent();if(!disposed.has(mesh.geometry)){mesh.geometry.dispose();disposed.add(mesh.geometry);}}
  group.userData.bakeBoundary=true;
}

export function createExteriorMothership(){
  const clean=paintMap(false),worn=paintMap(true),habitatClean=paintMap(false,true),habitatWorn=paintMap(true,true),soot=sootMap(),ignition=ignitionMap();
  const material=(name,color,metalness=0,roughness=.78,map=null)=>{const m=new THREE.MeshStandardMaterial({color,metalness,roughness,map,flatShading:true});m.name=name;return m;};
  const m={paint:material('Aged Macintosh beige',0xffffff,.16,.86,worn),patch:material('Replacement panel',0xcfc9b5,.12,.80),ochre:material('Faded service ochre',0xa58b52,.18),
    steel:material('Unpainted structure',0x555953,.65,.6),dark:material('Recessed machinery',0x252b28,.38,.75),black:material('Nozzle throat',0x121717,.45,.82),
    pipe:material('Warm service metal',0x8e8b77,.70,.48),red:material('Oxide maintenance paint',0x79554a,.2),glass:material('Small pressure window',0x1d3338,.48,.3),white:material('Worn insulation',0x9e9b8b,.05,.94),
    habitat:material('Habitat service skin',0xe0ded0,.16,.86,habitatWorn)};
  m.black.emissive.set(0x9edcff);m.black.emissiveIntensity=.30;m.black.emissiveMap=ignition;
  m.igniter=new THREE.MeshBasicMaterial({color:new THREE.Color(0x639ac0).multiplyScalar(.22),toneMapped:true});m.igniter.name='Recessed blue-white igniter';
  const stain=new THREE.MeshStandardMaterial({map:soot,transparent:true,roughness:1,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-3});stain.name='Local exhaust residue';
  const root=new THREE.Group();root.name='TARAIRON / exterior study';
  let probe=null,probePromise=null,disposed=false;
  const core=new THREE.Group();core.name='Fixed central hull';root.add(core);
  const machinery=new THREE.Group();machinery.name='Exposed service equipment';core.add(machinery);
  const marks=new THREE.Group();marks.name='Localized soot and grease';root.add(marks);
  const rotor=new THREE.Group();rotor.name='Three connected gravity sections';rotor.position.x=EXTERIOR.rotorX;root.add(rotor);
  const frame=new THREE.Group();frame.name='Connected rotating structure';rotor.add(frame);
  const pods=[],floorGuides=[],spokes=[],evaHatches=[];
  const hub=new THREE.Group();hub.name='Adjustable rotating bearing hub';frame.add(hub);

  // A fixed axial spine through a rotating bearing. The aft body grows to
  // contain the propulsion equipment; the bow carries small pressure windows.
  loft(core,m.paint,[[-15.5,4.85,8.5],[-11.8,4.95,8.3],[-8.8,3.45,3.45],[-5.9,3.25,3.25],[6.1,3.25,3.25],[9.0,3.0,3.1]],'Faceted pressure hull');
  // Shoulders, lower chines and the roof change angle independently along the bow.
  facetedHull(core,m.paint,[[8.8,-2.8,2.8,3.08,.9],[11,-2.65,2.4,3.0,.85],
    [13.4,-2.2,2.05,2.85,.75],[15.6,-1.7,1.5,2.2,.65],[17.3,-1.15,1.0,1.45,.45]],'Multi-facet forward pressure hull');
  facetedHull(core,m.paint,[[9.3,1.2,2.4,1.95,.30],[10.4,1.15,3.15,2.3,.40],
    [12.8,1.15,3.3,2.3,.48],[14.25,1.05,2.95,2.05,.40],[15.6,.95,2.45,1.65,.35]],'Sloping faceted command module');
  for(const side of [-1,1]){
    chamferBox(core,m.patch,[11.9,-.10,side*3.0],[2.8,2.9,.28],'Rear bridge armour cheek');
    const cheek=chamferBox(core,m.patch,[14.15,.10,side*2.63],[1.9,1.65,.22],'Swept forward armour cheek');cheek.rotation.y=side*.28;
    const observation=new THREE.Group();observation.position.set(14.25,2.13,side*2.16);observation.rotation.y=side*.29;core.add(observation);
    box(observation,m.steel,[0,0,0],[1.18,.62,.14],'Forward observation frame');
    box(observation,m.glass,[0,0,side*.09],[.96,.40,.05],'Forward observation window');
    pipe(machinery,m.pipe,[[9.5,1.1,side*2.58],[10.3,1.1,side*2.67],[11.6,.65,side*2.73],[12.65,.65,side*2.73]],.08,'Bridge service feed');
  }
  const windshield=new THREE.Group();windshield.position.set(14.925,2.81,0);windshield.rotation.z=Math.atan2(-.50,1.35);core.add(windshield);
  chamferBox(windshield,m.steel,[0,0,0],[1.40,.12,2.65],'Inclined forward bridge visor');
  box(windshield,m.glass,[0,.085,0],[1.10,.035,2.35],'Inclined forward bridge glass');
  for(let i=0;i<3;i++)box(windshield,m.patch,[0,.12,-.78+i*.78],[1.40,.055,.085],'Bridge pressure mullion');
  for(const x of [-10.2,-7.2,5.7,8.9]){
    const collar=axisRing(core,m.steel,x,x<-8?4.3:3.27,.12,'Hull structural collar',16);
    if(x<-8)collar.scale.x=1.36;
  }
  // Replaceable cladding, boxed service bays and restrained identification.
  for(const side of [-1,1]){
    const panel=chamferBox(core,m.patch,[9.7,side*2.4,0],[6.2,.18,4.1],'Forward maintenance cover');
    panel.rotation.x=side>0?0:Math.PI;
    for(let i=0;i<6;i++)box(machinery,m.steel,[9.0+i*.52,side*2.53,.25],[.26,.1,2.3],'Cooling slot');
    for(let i=0;i<4;i++){
      box(core,m.steel,[11.9,.90-i*.62,side*3.17],[1.92,.40,.10],'Bridge window frame');
      box(core,m.glass,[11.9,.90-i*.62,side*3.24],[1.66,.24,.055],'Inset bridge glass');
    }
    label(core,'T / 03',[10.9,-1.25,side*2.98],2.1,.42,{rotation:[0,side>0?0:Math.PI,0]});
  }
  for(const side of [-1,1]){
    const hatch=new THREE.Group();hatch.name='EVA airlock hatch / '+(side>0?'starboard':'port');
    hatch.position.set(4.0,.02,side*3.10);core.add(hatch);evaHatches.push(hatch);
    chamferBox(hatch,m.steel,[0,0,0],[1.70,2.36,.22],'EVA pressure frame');
    chamferBox(hatch,m.dark,[0,0,side*.13],[1.46,2.12,.10],'EVA perimeter seal');
    chamferBox(hatch,m.patch,[0,0,side*.21],[1.30,1.94,.12],'EVA hatch leaf');
    addMesh(hatch,new THREE.TorusGeometry(.22,.034,6,12),m.pipe,'EVA locking handwheel',[.18,-.19,side*.31]);
    for(const y of [-.72,0,.72])box(hatch,m.steel,[-.74,y,side*.15],[.15,.20,.24],'EVA hinge block');
    for(const x of [-.69,.69])for(const y of [-.93,.93])box(hatch,m.ochre,[x,y,side*.15],[.10,.10,.10],'EVA frame fastener');
    rod(hatch,m.steel,[.59,-.55,side*.31],[.59,.45,side*.31],.045,'EVA grab rail');
    label(hatch,'EVA / AIRLOCK',[0,.60,side*.29],.95,.20,{rotation:[0,side>0?0:Math.PI,0],size:45});
    box(hatch,m.ochre,[0,-.89,side*.29],[.75,.08,.04],'EVA caution stripe');
    bake(hatch);
  }
  // Bearing races sit outside the pressure spine, with a narrow mechanical seam.
  for(const x of [-3.72,.52])axisRing(core,m.steel,x,3.6,.23,'Fixed bearing race');
  axisCylinder(hub,m.dark,0,3.72,3.65,'Rotating service hub',16);
  for(const x of [-1.88,1.88])axisRing(hub,m.pipe,x,3.84,.16,'Rotating bearing race');
  for(let i=0;i<24;i++){
    const a=i*Math.PI/12;box(hub,m.ochre,[0,Math.cos(a)*3.78,Math.sin(a)*3.78],[2.0,.13,.25],'Hub drive teeth').rotation.x=a;
  }
  // An enclosed pressure tunnel around the ring, braced by two separated rails.
  const tunnel=EXTERIOR.radius-EXTERIOR.podDepth/2-.45;
  for(const x of [-2.15,2.15]){
    axisRing(frame,m.steel,x,tunnel,.15,'Circumferential structural rail');
    axisRing(frame,m.pipe,x,tunnel+.6,.07,'Ring coolant return');
  }
  const ring=axisRing(frame,m.patch,0,tunnel,.42,'Enclosed connecting passage');ring.userData.pressureTunnel=true;
  for(let i=0;i<48;i++){
    const a=i*Math.PI/24,b=(i+1)*Math.PI/24;
    const p=(x,r,a)=>[x,Math.cos(a)*r,Math.sin(a)*r];
    rod(frame,m.steel,p(-2.15,tunnel,a),p(2.15,tunnel,b),.055,'Diagonal ring brace');
    if(i%2===0)rod(frame,m.steel,p(-2.15,tunnel,a),p(2.15,tunnel,a),.075,'Ring cross tie');
  }
  for(let i=0;i<3;i++){
    const angle=i*Math.PI*2/3,pod=new THREE.Group();pod.name=`Gravity section ${i+1}`;
    pod.rotation.x=angle;pod.position.set(0,Math.cos(angle)*EXTERIOR.radius,Math.sin(angle)*EXTERIOR.radius);rotor.add(pod);pods.push(pod);
    const truss=new THREE.Group();truss.name='Adjustable radial support';truss.rotation.x=angle;frame.add(truss);spokes.push(truss);
    const spokeEnd=EXTERIOR.radius-EXTERIOR.podDepth/2+.30;
    for(const x of [-1.75,1.75]){
      rod(truss,m.steel,[x,3.75,0],[x,spokeEnd,0],.19,'Load-bearing radial spar');
      rod(truss,m.pipe,[x,4.1,.34],[x,spokeEnd,.34],.09,'Spoke utilities');
    }
    const count=Math.ceil((spokeEnd-4)/1.7),pitch=(spokeEnd-4)/count;
    for(let j=0;j<count;j++){
      const y=4+j*pitch;rod(truss,m.steel,[-1.75,y,0],[1.75,y+pitch,0],.08,'Spoke diagonal');
      rod(truss,m.steel,[-1.75,y,0],[1.75,y,0],.08,'Spoke crossbeam');
    }
    box(truss,m.white,[0,(spokeEnd+3.7)/2,0],[.68,spokeEnd-3.7,.70],'Radial access tunnel');
    bake(truss);floorGuides.push(habitatShell(pod,m,i,stain));
  }

  // Exposed machinery is grouped around real interfaces and service bays.
  for(const side of [-1,1]){
    const z=side*3.08;
    // Service runs follow the flat hull facets and stop before the EVA frames.
    pipe(machinery,m.pipe,[[-5.2,-.85,z],[-3.8,-.85,z+side*.16],[-.9,-.85,z+side*.16],[1.6,-.45,z+side*.16]],.065,'External cable conduit');
    pipe(machinery,m.steel,[[-5.0,.88,z],[-3.9,.88,z+side*.21],[-1.5,1.0,z+side*.21],[1.2,1.0,z+side*.21]],.09,'External coolant branch');
    for(const x of [-4.2,-2.3,-.6,1.0])box(machinery,m.steel,[x,-.84,z+side*.18],[.10,.26,.22],'Conduit restraint');
    for(const [x,y,w,h]of [[-4.6,.04,.82,.82],[1.35,-.15,1.14,.74],[-6.8,.30,.68,.95],[6.0,.15,1.0,1.18]]){
      chamferBox(machinery,m.steel,[x,y,z+side*.10],[w+.12,h+.12,.16],'Recessed service frame');
      chamferBox(machinery,m.dark,[x,y,z+side*.20],[w,h,.12],'Hull equipment recess');
      box(machinery,m.patch,[x-w*.17,y+.08,z+side*.29],[w*.43,h*.66,.10],'Replaceable service cartridge');
      for(let j=0;j<4;j++)box(machinery,m.pipe,[x+w*.30,y-h*.30+j*h*.19,z+side*.29],[w*.16,.045,.08],'Service bay cooling fin');
    }
    for(const x of [-5.25,1.35,5.9]){
      chamferBox(core,m.patch,[x,-1.18,z-side*.13],[.95,.44,.13],'Small replacement hull cover');
      for(const dx of [-.35,.35])box(core,m.steel,[x+dx,-1.18,z-side*.04],[.055,.055,.06],'Inspection cover bolt');
    }
    for(let i=0;i<5;i++){
      box(machinery,m.dark,[-7.3+i*.7,.6,z],[.45,.85,.25],'Forward utility bay');
      box(machinery,m.pipe,[-7.3+i*.7,.65,z+side*.2],[.18,.62,.25],'Replaceable pump cartridge');
    }
    pipe(machinery,m.pipe,[[-10.2,1.4,side*4.1],[-8.2,1.4,z],[-6.8,1.4,z],[-5.5,1.8,z]],.11,'Coolant plumbing');
    pipe(machinery,m.steel,[[4.8,-1.1,z],[6.0,-1.1,z],[7.4,-.7,z],[9.1,-.7,side*2.92]],.075,'Forward service conduits');
    for(let i=0;i<4;i++){
      const x=-14.1+i*.75;
      box(machinery,m.dark,[x,1.5,side*7.3],[.52,2.6,1.2],'Engine heat exchanger');
      for(let j=0;j<6;j++)box(machinery,m.pipe,[x,1.0+j*.34,side*8.01],[.42,.10,.08],'Cooling fins');
    }
    // Paint the name below the four exchangers on the broad aft hull facet.
    // Its shallow taper changes Z along X; match that plane rather than
    // leaving a flat stencil floating in front of the pressure hull.
    const logoX=-13.50,facet=Math.cos(Math.PI/8),slope=facet*(8.3-8.5)/3.7;
    const logoZ=facet*8.5+slope*(logoX+15.5),tilt=Math.atan(-slope);
    shipWordmark(core,[logoX,-.90,side*(logoZ+.006)],3.0,side>0?tilt:Math.PI-tilt);
  }
  // Tanks and their saddles remain behind the rotor sweep.
  for(const side of [-1,1]){
    const tank=new THREE.Group();tank.position.set(-12.1,side*5.35,0);machinery.add(tank);
    axisCylinder(tank,m.white,0,.70,5.1,'Pressurant tank',12);
    for(const x of [-1.7,1.7])axisRing(tank,m.steel,x,.73,.07,'Tank retaining band',16);
    pipe(machinery,m.pipe,[[-12.1,side*5.4,.7],[-14.8,side*5.4,.7],[-16.2,side*3.8,.7]],.1,'Pressurant feed');
  }
  // A wide, shallow aft shoulder; the bells themselves stay circular.
  // The forward cap must stop before the pressure hull's x=-15.5 cap;
  // coincident caps were competing for the same depth values.
  loft(core,m.dark,[[-16.7,4.85,8.5],[-15.55,4.85,8.5]],'Engine mounting bulkhead',16);
  const engines=[];
  const nozzle=(y,z,r,length,index)=>{
    const group=new THREE.Group();group.name=`Rocket engine ${index}`;group.position.set(-16.4,y,z);core.add(group);engines.push(group);
    group.userData.glowPoint=[-1.73,0,0];group.userData.throatRadius=r*.24;
    axisCylinder(group,m.steel,-.6,r*.64,1.2,'Combustion chamber',12);
    // Lathed bell with a recessed open mouth, not a glowing solid disc.
    const profile=[[r*.33,0],[r*.35,.55],[r*.47,1.05],[r*.77,1.65],[r,length],[r-.08,length],[r*.70,1.65],[r*.40,1.02],[r*.26,.55]];
    const bell=addMesh(group,new THREE.LatheGeometry(profile.map(([r,x])=>new THREE.Vector2(r,x)),16),m.steel,'Open rocket bell',[-1.2,0,0]);bell.rotation.z=Math.PI/2;
    const inner=addMesh(group,new THREE.CylinderGeometry(r*.24,r*.24,.04,16),m.black,'Deep nozzle throat',[-1.66,0,0]);inner.rotation.z=Math.PI/2;
    axisRing(group,m.igniter,-1.78,r*.27,.028,'Recessed ignition ring',16);
    axisRing(group,m.pipe,-1.2-length,r,.055,'Nozzle lip');
    for(let k=0;k<8;k++){
      const a=k*Math.PI/4;rod(group,m.pipe,[-.75,Math.cos(a)*r*.62,Math.sin(a)*r*.62],[-1.2-length+.2,Math.cos(a)*(r+.04),Math.sin(a)*(r+.04)],.035,'Bell cooling jacket ribs');
    }
    pipe(group,m.pipe,[[.15,r*.5,0],[-.6,r*.82,0],[-1.5,r*.56,0]],.075,'Turbopump fuel line');
    for(const a of [0,Math.PI/2,Math.PI,Math.PI*1.5])rod(group,m.steel,[.1,Math.cos(a)*r,Math.sin(a)*r],[-.8,Math.cos(a)*r*.6,Math.sin(a)*r*.6],.09,'Engine mount');
  };
  nozzle(0,0,2.22,5.7,0);
  for(let i=0;i<6;i++){const a=i*Math.PI/3;nozzle(Math.sin(a)*3.35,Math.cos(a)*5.9,1.42,3.95,i+1);}
  for(let i=0;i<12;i++){
    const a=i*Math.PI/6;box(machinery,m.ochre,[-16.75,Math.cos(a)*4.7,Math.sin(a)*8.15],[.08,.2,.5],'Engine perimeter service marking').rotation.x=a;
  }
  // Directional residue beside aft plumbing and attitude-control outlets.
  for(const side of [-1,1]){
    const residue=addMesh(marks,new THREE.PlaneGeometry(5.8,4.1),stain,'Aft service bay residue',[-13.1,0,side*7.86]);residue.rotation.y=side>0?0:Math.PI;residue.castShadow=false;
    const rcs=new THREE.Group();rcs.position.set(11.3,side*2.25,1.75);machinery.add(rcs);
    box(rcs,m.dark,[0,0,0],[.7,.62,.78],'Attitude thruster block');
    for(const dx of [-.22,.22])addMesh(rcs,new THREE.CylinderGeometry(.105,.16,.32,8),m.steel,'Small attitude-control nozzle',[dx,side*.35,0]);
    const burn=addMesh(marks,new THREE.PlaneGeometry(2.1,1.4),stain,'Attitude thruster residue',[10.9,side*2.47,1.55]);burn.rotation.x=side>0?-Math.PI/2:Math.PI/2;burn.castShadow=false;
  }
  // Small comms dishes mounted on the fixed forward hull.
  for(const [x,z,r]of [[6.8,.65,.7],[8.3,-1.0,.36]]){
    rod(machinery,m.steel,[x,2.8,z],[x,4.3,z],.08,'Antenna pedestal');
    const dish=addMesh(machinery,new THREE.ConeGeometry(r,.35,12,1,true),m.patch,'Communications dish',[x,4.3,z]);dish.rotation.x=.5;
    rod(machinery,m.pipe,[x,4.3,z],[x,4.9,z],.03,'Antenna feed');
  }
  bake(machinery);bake(hub);bake(frame);engines.forEach(bake);bake(core);
  const bounds=new THREE.Box3().setFromObject(root),dimensions=bounds.getSize(new THREE.Vector3());
  let coreScale=1;
  const ship={root,core,rotor,pods,frame,engines,machinery,dimensions,floorGuides,hub,spokes,evaHatches,
    get dockedLander(){return probe?.lander??null;},get probeDock(){return probe?.dock??null;},get probeThrusters(){return probe?.thrusters??null;},
    addProbe(factory){
      if(disposed||probe)return ship;
      probe=factory(root,m,{random,addMesh,box,rod,pipe,axisRing,chamferBox,label,bake});
      if(probe)probe.dock.position.set((10.4-EXTERIOR.rotorX)*coreScale+EXTERIOR.rotorX,-2.65*coreScale-7.25,0);
      bounds.setFromObject(root).getSize(dimensions);return ship;
    },
    prepareProbe(){
      return probePromise??=import('./exterior-probe.js').then(({createExteriorProbe})=>ship.addProbe(createExteriorProbe));
    },
    get coreScale(){return coreScale;},
    setCoreScale(value){
      coreScale=THREE.MathUtils.clamp(Number(value)||1,1,2.8);
      core.scale.setScalar(coreScale);core.position.x=EXTERIOR.rotorX*(1-coreScale);
      marks.scale.copy(core.scale);marks.position.copy(core.position);hub.scale.setScalar(coreScale);
      if(probe)probe.dock.position.set((10.4-EXTERIOR.rotorX)*coreScale+EXTERIOR.rotorX,-2.65*coreScale-7.25,0);
      const end=EXTERIOR.radius-EXTERIOR.podDepth/2+.30;
      const stretch=(end-3.75*coreScale)/(end-3.75),offset=end*(1-stretch);
      for(const [i,spoke]of spokes.entries()){
        const angle=i*Math.PI*2/3;spoke.scale.set(coreScale,stretch,1);
        spoke.position.set(0,Math.cos(angle)*offset,Math.sin(angle)*offset);
      }
      bounds.setFromObject(root).getSize(dimensions);return coreScale;
    },
    setFloorGuides(value){floorGuides.forEach(group=>{group.visible=Boolean(value);});},
    setWear(value){m.paint.map=value?worn:clean;m.paint.needsUpdate=true;m.habitat.map=value?habitatWorn:habitatClean;m.habitat.needsUpdate=true;for(const material of probe?.paintedMaterials??[]){material.map=value?worn:clean;material.needsUpdate=true;}marks.visible=Boolean(value);for(const pod of pods)pod.traverse(o=>{if(o.name==='Local vent stain')o.visible=Boolean(value);});},
    setServices(value){machinery.visible=Boolean(value);},
    setAngle(angle){rotor.rotation.x=angle;},
    dispose(){disposed=true;probe?.thrusters.dispose();const geometries=new Set(),materials=new Set(),maps=new Set([clean,worn,habitatClean,habitatWorn,soot,ignition]);root.traverse(o=>{if(o.geometry)geometries.add(o.geometry);for(const material of [].concat(o.material??[])){materials.add(material);for(const map of [material.map,material.bumpMap])if(map)maps.add(map);}});geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());maps.forEach(m=>m?.dispose());}
  };
  return ship;
}
