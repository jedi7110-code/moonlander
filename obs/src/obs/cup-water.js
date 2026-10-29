import {Mesh,BufferGeometry,Float32BufferAttribute,MeshPhysicalMaterial,DynamicDrawUsage,Vector3,MathUtils} from 'three';

const SEGMENTS=64,SLOPE=.006/.109,CLEARANCE=.0006;
const up=new Vector3(0,1,0);

function geometry(ring=false){
  const result=new BufferGeometry(),count=ring?SEGMENTS*2:SEGMENTS+1,indices=[];
  result.setAttribute('position',new Float32BufferAttribute(new Float32Array(count*3),3).setUsage(DynamicDrawUsage));
  result.setAttribute('normal',new Float32BufferAttribute(new Float32Array(count*3),3).setUsage(DynamicDrawUsage));
  for(let i=0;i<SEGMENTS;i++){
    const next=(i+1)%SEGMENTS;
    if(ring)indices.push(i*2,i*2+1,next*2,next*2,i*2+1,next*2+1);
    else indices.push(0,next+1,i+1);
  }
  result.setIndex(indices);return result;
}

export function createCupWater(){
  const material=new MeshPhysicalMaterial({name:'Cup / clear drinking water',color:0x65838a,
    metalness:0,roughness:.09,ior:1.333,envMapIntensity:.45,
    transparent:true,opacity:.78,depthWrite:false,clearcoat:.35,clearcoatRoughness:.08});
  const water=new Mesh(geometry(),material);water.name='Cup liquid surface';water.userData.cupWater=true;
  const edgeMaterial=new MeshPhysicalMaterial({name:'Cup / water meniscus',color:0x3e656d,
    metalness:0,roughness:.11,ior:1.333,envMapIntensity:.7,transparent:true,opacity:.58,depthWrite:false});
  const edge=new Mesh(geometry(true),edgeMaterial);edge.name='Cup water meniscus';edge.userData.cupWater=true;
  water.add(edge);water.userData.edge=edge;water.renderOrder=2;edge.renderOrder=3;
  updateCupWater(water,.047);return water;
}

// Intersect a level liquid plane with the cup's tapered inner wall. The boundary
// changes with tilt rather than stretching a blob through the ceramic or hiding it.
export function updateCupWater(water,fill,normal=up){
  const dx=-normal.x/normal.y,dz=-normal.z/normal.y,slope=Math.hypot(dx,dz);
  const level=MathUtils.clamp(fill,-.051+slope*.033,.056-slope*.039);
  const radius=.033+(level+.052)*SLOPE-CLEARANCE;
  const surface=water.geometry,edge=water.userData.edge.geometry;
  const p=surface.attributes.position,n=surface.attributes.normal,ep=edge.attributes.position,en=edge.attributes.normal;
  water.position.y=level;water.visible=true;
  p.setXYZ(0,0,0,0);n.setXYZ(0,normal.x,normal.y,normal.z);
  for(let i=0;i<SEGMENTS;i++){
    const angle=i/SEGMENTS*Math.PI*2,c=Math.cos(angle),s=Math.sin(angle),gradient=dx*c+dz*s;
    const r=radius/(1-SLOPE*gradient),y=gradient*r;
    p.setXYZ(i+1,c*r,y,s*r);n.setXYZ(i+1,normal.x,normal.y,normal.z);
    for(let side=0;side<2;side++){
      const rr=r-side*.0010;
      ep.setXYZ(i*2+side,c*rr,gradient*rr+.00025,s*rr);en.setXYZ(i*2+side,normal.x,normal.y,normal.z);
    }
  }
  for(const attribute of [p,n,ep,en])attribute.needsUpdate=true;
  surface.computeBoundingSphere();edge.computeBoundingSphere();
}
