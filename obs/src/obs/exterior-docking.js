import * as THREE from 'three';
import {addDockCaptureClaws} from './exterior-docking-lock.js';

export const PROBE_DOCK=Object.freeze({clearDiameter:1.20,tubeRadius:.66,coreX:10.4,matingY:5.65,
  probeHatchY:5.15,motherHatchY:7.55,roofY:7.25,suitHeight:1.85,suitWidth:.80,suitDepth:.72});
const clamp=value=>Math.max(0,Math.min(1,value));

export function cutDockPassage(mesh,transform,{centerX=0,radius=.63,minY,maxY,normalSign=0}){
  const source=mesh.geometry,attributes=Object.entries(source.attributes),positions=source.attributes.position;
  const output=Object.fromEntries(attributes.map(([name])=>[name,[]])),index=source.index;
  const count=index?.count??positions.count,edges=24,polygon=Array.from({length:edges},(_,edge)=>{
    const angle=edge/edges*Math.PI*2;return[centerX+Math.cos(angle)*radius,Math.sin(angle)*radius];
  });
  const append=vertices=>{
    for(let triangle=1;triangle<vertices.length-1;triangle++)for(const vertex of [vertices[0],vertices[triangle],vertices[triangle+1]])
      for(const [name]of attributes)output[name].push(...vertex.values[name]);
  };
  for(let offset=0;offset<count;offset+=3){
    const triangle=[0,1,2].map(corner=>{
      const vertex=index?index.getX(offset+corner):offset+corner;
      const values=Object.fromEntries(attributes.map(([name,attribute])=>[name,Array.from({length:attribute.itemSize},(_,component)=>attribute.array[vertex*attribute.itemSize+component])]));
      return{values,point:new THREE.Vector3(...values.position).applyMatrix4(transform)};
    });
    const normal=new THREE.Vector3().crossVectors(triangle[1].point.clone().sub(triangle[0].point),triangle[2].point.clone().sub(triangle[0].point)).normalize();
    if(triangle.some(vertex=>vertex.point.y<minY||vertex.point.y>maxY)||Math.abs(normal.y)<.9||normalSign&&Math.sign(normal.y)!==normalSign){append(triangle);continue;}
    let inside=triangle;
    for(let edge=0;edge<edges&&inside.length;edge++){
      const start=polygon[edge],end=polygon[(edge+1)%edges],kept=[],outside=[];
      const distance=vertex=>(end[0]-start[0])*(vertex.point.z-start[1])-(end[1]-start[1])*(vertex.point.x-start[0]);
      for(let vertex=0;vertex<inside.length;vertex++){
        const current=inside[vertex],next=inside[(vertex+1)%inside.length],from=distance(current),to=distance(next);
        (from>=0?kept:outside).push(current);
        if((from>=0)!==(to>=0)){
          const fraction=from/(from-to),intersection={point:current.point.clone().lerp(next.point,fraction),values:{}};
          for(const [name]of attributes)intersection.values[name]=current.values[name].map((value,component)=>THREE.MathUtils.lerp(value,next.values[name][component],fraction));
          kept.push(intersection);outside.push(intersection);
        }
      }
      append(outside);inside=kept;
    }
  }
  const geometry=new THREE.BufferGeometry();
  for(const [name,attribute]of attributes)geometry.setAttribute(name,new THREE.Float32BufferAttribute(output[name],attribute.itemSize,attribute.normalized));
  geometry.computeBoundingBox();geometry.computeBoundingSphere();mesh.geometry=geometry;source.dispose();
}

function annulus(parent,material,y,outer,inner,depth,name,addMesh){
  const shape=new THREE.Shape(),hole=new THREE.Path(),segments=24;
  for(let edge=0;edge<segments;edge++){
    const angle=edge/segments*Math.PI*2,point=[Math.cos(angle)*outer,Math.sin(angle)*outer];
    if(edge)shape.lineTo(...point);else shape.moveTo(...point);
    const reverse=-angle,clear=inner/Math.cos(Math.PI/segments),inside=[Math.cos(reverse)*clear,Math.sin(reverse)*clear];
    if(edge)hole.lineTo(...inside);else hole.moveTo(...inside);
  }
  shape.closePath();hole.closePath();shape.holes.push(hole);
  const mesh=addMesh(parent,new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:false,curveSegments:1}),material,name,[0,y,0]);
  mesh.rotation.x=-Math.PI/2;return mesh;
}

function pressureHatch(parent,m,y,openingSign,{addMesh,box,rod,bake}){
  const hinge=new THREE.Group();hinge.name=openingSign>0?'Probe inward-opening pressure hatch':'Mother ship inward-opening pressure hatch';
  hinge.position.set(.76,y,0);parent.add(hinge);
  addMesh(hinge,new THREE.CylinderGeometry(.65,.65,.075,24),m.steel,'Pressure hatch leaf',[-.76,0,0]);
  box(hinge,m.steel,[-.76,-.065,0],[.30,.10,.14],'Pressure hatch manual handle');
  for(const z of [-.38,.38])rod(hinge,m.steel,[-.47,-.05,z],[-1.05,-.05,z],.032,'Pressure hatch stiffening rib');
  bake(hinge);hinge.userData.panelDetailExclude=true;
  return {hinge,setOpen(value){hinge.rotation.z=value?openingSign*Math.PI/2:0;}};
}

export function addProbeDockPort(lander,m,build){
  const {addMesh,box,rod}=build;
  annulus(lander,m.steel,5.30,.91,.60,.10,'Probe pressure-roof reinforcement',addMesh);
  annulus(lander,m.patch,5.40,.81,.60,.15,'Probe pressure docking neck',addMesh);
  annulus(lander,m.pipe,5.55,1.02,.60,.10,'Probe hard-capture mating flange',addMesh);
  for(const radius of [.71,.76]){
    const seal=addMesh(lander,new THREE.TorusGeometry(radius,.018,4,24),m.dark,'Concentric docking pressure seal',[0,5.645,0]);seal.rotation.x=Math.PI/2;
  }
  for(let index=0;index<6;index++){
    const angle=index*Math.PI/3,x=Math.cos(angle),z=Math.sin(angle);
    const latch=box(lander,m.steel,[x*.94,5.49,z*.94],[.16,.18,.20],'Probe docking latch hardpoint');latch.rotation.y=-angle;
    rod(lander,m.pipe,[x*.87,5.31,z*.87],[x*.87,5.45,z*.87],.045,'Probe roof flange bolt');
  }
  const hatch=pressureHatch(lander,m,PROBE_DOCK.probeHatchY,1,build);
  lander.userData.docking={...PROBE_DOCK};return hatch;
}

export function addMotherDockPort(cradle,m,build){
  const {addMesh,box,rod,bake}=build;
  annulus(cradle,m.pipe,PROBE_DOCK.matingY,1.02,.60,.10,'Mother ship hard-capture flange',addMesh);
  const profile=[[.79,5.75],[.79,7.52],[.66,7.52],[.66,5.75],[.79,5.75]];
  addMesh(cradle,new THREE.LatheGeometry(profile.map(([radius,y])=>new THREE.Vector2(radius,y)),24),m.patch,'Hollow crew-transfer pressure tunnel');
  annulus(cradle,m.steel,7.08,1.10,.60,.28,'Conformal docking pressure bulkhead flange',addMesh);
  annulus(cradle,m.pipe,7.40,.86,.60,.10,'Mother ship isolation-hatch frame',addMesh);
  for(const x of [-1,1]){
    rod(cradle,m.pipe,[x*.64,5.88,0],[x*.64,7.28,0],.020,'Crew-transfer internal handrail');
    for(const y of [5.95,7.20])rod(cradle,m.steel,[x*.64,y,0],[x*.78,y,0],.025,'Handrail stand-off');
  }
  const capture=addDockCaptureClaws(cradle,m,build);
  for(const x of [-1,1])for(const z of [-1,1]){
    rod(cradle,m.steel,[x*.81,5.91,z*.69],[x*.86,7.10,z*.78],.085,'Docking thrust-frame diagonal');
    box(cradle,m.steel,[x*.87,7.10,z*.78],[.34,.24,.32],'Hull docking-frame hardpoint');
    rod(cradle,m.pipe,[x*.87,6.98,z*.78],[x*.87,7.31,z*.78],.055,'Docking frame through bolt');
  }
  const hatch=pressureHatch(cradle,m,PROBE_DOCK.motherHatchY,-1,build);bake(cradle);
  const buffers=cradle.children.filter(mesh=>mesh.isMesh).map(mesh=>({mesh,rest:mesh.geometry.attributes.position.array.slice()}));
  const roofOffset=(scale,x)=>{
    const hullX=PROBE_DOCK.coreX+x/scale;
    const bottom=hullX<11?-2.8+(hullX-8.8)*.15/2.2:-2.65+(hullX-11)*.45/2.4;
    return scale*(bottom+2.65);
  };
  return {hatch,capture,setScale(scale){
    for(const {mesh,rest}of buffers){
      const positions=mesh.geometry.attributes.position;
      for(let index=0;index<positions.count;index++){
        const x=rest[index*3],y=rest[index*3+1],z=rest[index*3+2];
        const vertical=clamp((y-6.15)/.95),radial=clamp((Math.hypot(x,z)-.85)/.12),factor=1+(scale-1)*vertical*radial;
        const nextX=x*factor;positions.setXYZ(index,nextX,y+vertical*roofOffset(scale,nextX),z*factor);
      }
      positions.needsUpdate=true;mesh.geometry.computeVertexNormals();mesh.geometry.computeBoundingBox();mesh.geometry.computeBoundingSphere();
    }
    hatch.hinge.position.y=PROBE_DOCK.motherHatchY+roofOffset(scale,0);
  }};
}
