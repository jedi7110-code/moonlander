import * as THREE from 'three';
import {materials} from './materials.js';
import {loadMiloHead} from './head.js';
import {loadMiloBody} from './milo-body.js';
import {createMiloSteps,animateMilo} from './characters.js';
import {runPreparationSteps,nextPreparationFrame} from './background-preparation.js';

function reshapeVisitorNose(head){
  const mesh=head.getObjectByName('Milo scanned head');
  mesh.geometry=mesh.geometry.clone();
  const geometry=mesh.geometry,p=geometry.attributes.position,n=geometry.attributes.normal;
  const forward=head.userData.faceForward/.055;
  const deform=(x,y,z)=>{
    const dx=x+.11,depth=z-forward;
    const vertical=THREE.MathUtils.smoothstep(y,.70,.91)*(1-THREE.MathUtils.smoothstep(y,1.55,1.92));
    const lateral=1-THREE.MathUtils.smoothstep(Math.abs(dx),.30,.62);
    const front=THREE.MathUtils.smoothstep(depth,1.95,2.30);
    const mask=vertical*lateral*front;
    return new THREE.Vector3(x+dx*.30*mask,y,z-.19*mask);
  };
  const epsilon=.0001,jacobian=new THREE.Matrix3(),normal=new THREE.Vector3();
  for(let i=0;i<p.count;i++){
    const x=p.getX(i),y=p.getY(i),z=p.getZ(i),point=deform(x,y,z);
    if(point.x===x&&point.z===z)continue;
    const dx=deform(x+epsilon,y,z).sub(deform(x-epsilon,y,z)).multiplyScalar(.5/epsilon);
    const dy=deform(x,y+epsilon,z).sub(deform(x,y-epsilon,z)).multiplyScalar(.5/epsilon);
    const dz=deform(x,y,z+epsilon).sub(deform(x,y,z-epsilon)).multiplyScalar(.5/epsilon);
    jacobian.set(dx.x,dy.x,dz.x,dx.y,dy.y,dz.y,dx.z,dy.z,dz.z).invert().transpose();
    normal.fromBufferAttribute(n,i).applyMatrix3(jacobian).normalize();
    p.setXYZ(i,point.x,point.y,point.z);n.setXYZ(i,normal.x,normal.y,normal.z);
  }
  p.needsUpdate=true;n.needsUpdate=true;geometry.computeBoundingBox();geometry.computeBoundingSphere();
}

function addAfro(head){
  head.traverse(o=>{if(o.name.startsWith('Milo hair '))o.visible=false;});
  const group=new THREE.Group();group.name='Visitor afro';head.add(group);
  const material=new THREE.MeshStandardMaterial({color:0x17130f,roughness:1,flatShading:true});
  // Rounded picked-out crown, with a continuous lower boundary: forehead,
  // temples, exposed ears, then the low natural nape. No spherical cut edge.
  const forward=head.userData.faceForward/.055;
  const surface=(u,v)=>{
    const a=u*Math.PI*2,front=Math.cos(a);
    const limit=1.68+.66*(1-front)/2;
    const t=v*limit,s=Math.sin(t);
    const ripple=1+.012*Math.sin(a*7+t*9)+.009*Math.sin(a*13-t*5);
    const crownLowering=.48*Math.pow(Math.max(0,Math.cos(t)),2);
    const forehead=Math.pow(Math.max(0,front),4);
    const frontRoundness=.28*Math.pow(Math.sin(Math.PI*v),2)*forehead;
    const hairlineLift=.12*Math.pow(v,6)*forehead;
    return new THREE.Vector3(2.36*s*Math.sin(a)*ripple,2.75+2.42*Math.cos(t)-crownLowering+hairlineLift,forward-.12+2.22*s*front*ripple+frontRoundness);
  };
  // Roll the open rim inward and close it inside the scalp. A rounded return
  // gives the hair volume underneath instead of leaving a hollow cap edge.
  const underside=(u,t)=>{
    const edge=surface(u,1),blend=t*t*(3-2*t);
    const radius=Math.cos(t*Math.PI/2);
    const forehead=Math.pow(Math.max(0,Math.cos(u*Math.PI*2)),4);
    const hairlineReturn=forehead*(1.2*blend+.5*Math.sin(Math.PI*t))*(1-THREE.MathUtils.smoothstep(t,.65,1));
    return new THREE.Vector3(
      edge.x*radius,
      THREE.MathUtils.lerp(edge.y,1.8,blend)-.35*Math.sin(Math.PI*t)+hairlineReturn,
      forward-.12+(edge.z-forward+.12)*radius
    );
  };
  const positions=[],indices=[],rows=14,cols=32;
  for(let j=0;j<=rows;j++)for(let i=0;i<=cols;i++){
    positions.push(...surface(i/cols,j/rows).toArray());
    if(j<rows&&i<cols){const a=j*(cols+1)+i,b=a+1,c=a+cols+1;indices.push(a,b,c,b,c+1,c);}
  }
  const returnRows=6;
  for(let j=1;j<=returnRows;j++)for(let i=0;i<=cols;i++){
    positions.push(...underside(i/cols,j/returnRows).toArray());
    if(i<cols){const a=(rows+j-1)*(cols+1)+i,b=a+1,c=a+cols+1;indices.push(a,b,c,b,c+1,c);}
  }
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.setIndex(indices);geo.computeVertexNormals();
  const base=new THREE.Mesh(geo,material);base.material.side=THREE.DoubleSide;group.add(base);
  // Low-poly scalp patches replace thousands of individual curls. Cluster
  // nearby scalp vertices, keeping fitted sideburns and the nape in one mesh.
  const scalpGeometry=head.getObjectByName('Milo scanned head').geometry;
  const scalp=scalpGeometry.attributes.position,normals=scalpGeometry.attributes.normal;
  const clusters=new Map(),patchVertices=[],patchIndices=[];
  const vertex=(i)=>{
    const x=scalp.getX(i)+normals.getX(i)*.055;
    const y=scalp.getY(i)+normals.getY(i)*.055;
    const z=scalp.getZ(i)+normals.getZ(i)*.055;
    const key=[x,y,z].map(v=>Math.round(v/.14)).join(',');
    if(!clusters.has(key)){
      clusters.set(key,patchVertices.length/3);patchVertices.push(x,y,z);
    }
    return clusters.get(key);
  };
  for(let i=0;i<scalp.count;i+=3){
    const y=scalp.getY(i),z=scalp.getZ(i)-forward,x=Math.abs(scalp.getX(i));
    const sideburn=x>1.18&&x<1.70&&z>.42&&z<1.30&&y>.35&&y<2.85;
    const nape=z<-.4&&y>-.28&&y<2.1;
    if(!sideburn&&!nape)continue;
    const a=vertex(i),b=vertex(i+1),c=vertex(i+2);
    if(a!==b&&b!==c&&c!==a)patchIndices.push(a,b,c);
  }
  const patchGeometry=new THREE.BufferGeometry();
  patchGeometry.setAttribute('position',new THREE.Float32BufferAttribute(patchVertices,3));
  patchGeometry.setIndex(patchIndices);patchGeometry.computeVertexNormals();
  const patches=new THREE.Mesh(patchGeometry,material);
  patches.name='Low-poly fitted sideburns and nape';group.add(patches);
  group.userData.triangleCount=(indices.length+patchIndices.length)/3;

}


// Keep the original artwork and density. Vary its vertical phase across the
// fabric so repeated motifs do not form a horizontal band.
const alohaPrintGLSL=`
vec3 alohaPrint(sampler2D atlas,vec2 uv){
  uv.y += .23*sin(uv.x*3.7+.8)+.09*sin(uv.x*8.3+2.1);
  return texture2D(atlas,uv).rgb;
}
`;

function addLongHem(parent,map){
  const positions=[],uvs=[],indices=[],rows=18,cols=96;
  for(let row=0;row<=rows;row++)for(let col=0;col<=cols;col++){
    const t=row/rows,angle=.24+col/cols*(Math.PI*2-.48),y=1.14-t*.225;
    const width=.170+.060*t,depth=.128+.060*t,fold=.0015*Math.sin(angle*17+t*3)*t;
    const x=Math.sin(angle)*(width+fold),z=Math.cos(angle)*(depth+fold);
    positions.push(x,y,z);uvs.push(x*2.7,y*2.7);
    if(row<rows&&col<cols){const a=row*(cols+1)+col,b=a+1,c=a+cols+1,d=c+1;indices.push(a,c,b,b,c,d);}
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));geometry.setIndex(indices);geometry.computeVertexNormals();
  const hem=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({map,roughness:.94,side:THREE.DoubleSide}));hem.name='Aloha untucked long hem';
  hem.material.onBeforeCompile=shader=>{
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\n'+alohaPrintGLSL)
      .replace('#include <map_fragment>','diffuseColor.rgb *= alohaPrint(map,vMapUv);');
  };
  hem.material.customProgramCacheKey=()=> 'curtis-staggered-hem-v2';parent.add(hem);
}


export function finishCurtisBoots(visitor){
  const materials=new Map();
  const leatherParts=new Set(['Continuous leather boot upper','Foot-shaped stitched boot welt']);
  const laceParts=new Set(['Crossed boot lace','Tightened top lace','Tied boot lace loop','Boot lace end']);
  visitor.traverse(object=>{
    const leather=leatherParts.has(object.name);
    if(!object.isMesh||(!leather&&!laceParts.has(object.name)))return;
    const source=object.material;
    if(!materials.has(source)){
      const material=source.clone();material.color.set(leather?'#151719':'#202123');
      material.roughness=leather?.62:.96;material.metalness=0;materials.set(source,material);
    }
    object.material=materials.get(source);
  });
}

export async function createCurtis(){
  const [m,head,,map]=await Promise.all([materials(),loadMiloHead(),loadMiloBody(),
    new THREE.TextureLoader().loadAsync(`${import.meta.env?.BASE_URL??'/3D/'}assets/obs/curtis-space-print-no-rockets.png`)]);
  map.colorSpace=THREE.SRGBColorSpace;
  map.wrapS=map.wrapT=THREE.RepeatWrapping;map.anisotropy=8;
  await nextPreparationFrame();
  m.skin=m.skin.clone();m.skin.color.set('#76513b');
  head.userData.setAppearance({hair:'crop',beard:'none'});
  head.traverse(o=>{if(o.isMesh&&o.material?.map){o.material=o.material.clone();o.material.map=null;o.material.color.set('#76513b');o.material.needsUpdate=true;}});
  reshapeVisitorNose(head);
  addAfro(head);
  const visitor=await runPreparationSteps(createMiloSteps(m,head));visitor.name='Curtis';
  finishCurtisBoots(visitor);
  animateMilo(visitor,{moving:false,climbing:false,facing:1,time:0});visitor.rotation.y=0;
  const skin=visitor.userData.bodySkin;
  const original=skin.material.onBeforeCompile;
  skin.material.onBeforeCompile=function(shader,...rest){original.call(this,shader,...rest);shader.uniforms.shirtColor.value.set('#eeeae1');shader.uniforms.tattooStrength.value=0;shader.uniforms.shirtBackPrintStrength.value=0;};
  skin.material.customProgramCacheKey=()=> 'visitor-white-tee-v1';

  const garment=skin.clone();garment.name='Open space-print aloha shirt';garment.material=skin.material.clone();garment.skeleton=skin.skeleton;garment.bindMatrix.copy(skin.bindMatrix);garment.bindMatrixInverse.copy(skin.bindMatrixInverse);
  garment.material.side=THREE.DoubleSide;
  garment.material.onBeforeCompile=function(shader,...rest){
    original.call(this,shader,...rest);shader.uniforms.tattooStrength.value=0;shader.uniforms.shirtBackPrintStrength.value=0;shader.uniforms.spacePrint={value:map};
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\ntransformed+=normal*(.009+.007*smoothstep(.4,.8,armRegion));');
    shader.fragmentShader=shader.fragmentShader.replace('smoothstep(1.293,1.297,vBodyPosition.y)','smoothstep(1.203,1.207,vBodyPosition.y)').replace('smoothstep(1.303,1.310,vBodyPosition.y)','smoothstep(1.213,1.220,vBodyPosition.y)');
    shader.fragmentShader=shader.fragmentShader.replace('uniform vec3 shirtColor;','uniform sampler2D spacePrint;uniform vec3 shirtColor;\n'+alohaPrintGLSL);
    shader.fragmentShader=shader.fragmentShader.replace('vec3 shirtSurface=shirtColor*heather*(1.0-.09*max(collar,cuff));',`
      float opening=.039;
      if(shirt<.5||vBodyPosition.y<1.135||(vBodyPosition.z>.025&&abs(vBodyPosition.x)<opening))discard;
      vec2 printUv=vec2(vBodyPosition.x*2.7,vBodyPosition.y*2.7);
      if(vArmRegion>.4)printUv.x+=vBodyPosition.z*2.7;
      vec3 shirtSurface=alohaPrint(spacePrint,printUv)*heather;
    `);
  };
  garment.material.customProgramCacheKey=()=> 'visitor-aloha-v6-staggered';skin.parent.add(garment);
  addLongHem(visitor.userData.body,map);

  visitor.userData.curtisPrint=map;
  return visitor;
}

