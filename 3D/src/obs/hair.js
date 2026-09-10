import * as THREE from 'three';
import {mergeVertices} from 'three/addons/utils/BufferGeometryUtils.js';

export function hairline(x,z){
  const edge=1.20+THREE.MathUtils.smoothstep(z,-1.1,1.65)*1.54+THREE.MathUtils.smoothstep(Math.abs(x),.95,1.65)*.18
    -.14*Math.exp(-((x+.35)**2)*3)*THREE.MathUtils.smoothstep(z,1,1.7)+.018*Math.sin(x*19+z*7);
  return Math.max(edge,2.22*THREE.MathUtils.smoothstep(Math.abs(x),1.2,1.6));
}
export const HAIRLINE_GLSL=`
float hairline = 1.20 + smoothstep(-1.1, 1.65, vHeadPosition.z) * 1.54
  + smoothstep(0.95, 1.65, abs(vHeadPosition.x)) * 0.18
  - 0.14 * exp(-pow(vHeadPosition.x + 0.35, 2.0) * 3.0) * smoothstep(1.0, 1.7, vHeadPosition.z)
  + 0.018 * sin(vHeadPosition.x * 19.0 + vHeadPosition.z * 7.0);
hairline = max(hairline, 2.22 * smoothstep(1.2, 1.6, abs(vHeadPosition.x)));`;

export function createHair(scalp){
  const source=scalp.index?scalp.toNonIndexed():scalp,position=source.attributes.position,normal=source.attributes.normal,vertices=[],coverage=[];
  const signed=p=>p.y-Math.max(hairline(p.x,p.z)+.04,2.22+.08*Math.sin(p.x*4+p.z*3));
  // Clip the cap to an irregular hairline rather than leaving entire scan triangles at its edge.
  for(let i=0;i<position.count;i+=3){
    const polygon=[];
    for(let j=0;j<3;j++){
      const a=(i+j),b=i+(j+1)%3,p=new THREE.Vector3().fromBufferAttribute(position,a),q=new THREE.Vector3().fromBufferAttribute(position,b);
      const n=new THREE.Vector3().fromBufferAttribute(normal,a),m=new THREE.Vector3().fromBufferAttribute(normal,b),da=signed(p),db=signed(q);
      if(da>=0)polygon.push({p,n});
      if((da>=0)!==(db>=0)){const t=da/(da-db);polygon.push({p:p.clone().lerp(q,t),n:n.clone().lerp(m,t).normalize()});}
    }
    for(let j=1;j<polygon.length-1;j++)for(const {p,n}of [polygon[0],polygon[j],polygon[j+1]]){
      const top=THREE.MathUtils.smoothstep(p.y,2.25,3.5),edge=THREE.MathUtils.smoothstep(signed(p),0,.32);
      const sweep=p.x*10+p.z*4+Math.sin(p.z*6)*.45,clump=.5+.5*Math.sin(sweep);
      const volume=.003+edge*(.008+top*(.12+.09*clump));
      const v=p.clone().addScaledVector(n,volume);v.x-=top*edge*.17;v.z-=top*edge*.06;
      vertices.push(v.x,v.y,v.z);
      coverage.push(THREE.MathUtils.smoothstep(signed(p),0,.32));
    }
  }
  if(source!==scalp)source.dispose();
  const raw=new THREE.BufferGeometry();raw.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
  raw.setAttribute('hairCoverage',new THREE.Float32BufferAttribute(coverage,1));
  const geometry=mergeVertices(raw,1e-4);raw.dispose();geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();
  const material=new THREE.MeshStandardMaterial({color:0x29211b,roughness:.95,envMapIntensity:.12,transparent:true,depthWrite:false});
  material.onBeforeCompile=shader=>{
    shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vHair;\nattribute float hairCoverage;\nvarying float vHairCoverage;').replace('#include <begin_vertex>','#include <begin_vertex>\nvHair = position;\nvHairCoverage = hairCoverage;');
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 vHair;\nvarying float vHairCoverage;').replace('#include <color_fragment>',`#include <color_fragment>
      float strand = sin(vHair.x * 310.0 + vHair.z * 112.0 + sin(vHair.y * 22.0) * 4.0);
      float lock = sin(vHair.x * 9.0 + vHair.z * 2.8);
      float grain = fract(sin(dot(vHair, vec3(127.1,311.7,74.7))) * 43758.5453);
      diffuseColor.rgb *= 0.85 + 0.035 * strand + 0.035 * lock + grain * 0.12;
      diffuseColor.a *= vHairCoverage;
    `);
  };
  material.customProgramCacheKey=()=> 'milo-textured-crop-v1';
  const mesh=new THREE.Mesh(geometry,material);mesh.name='Milo textured short crop';mesh.castShadow=true;mesh.receiveShadow=true;return mesh;
}
