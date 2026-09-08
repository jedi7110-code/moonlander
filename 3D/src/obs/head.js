import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';

export function headGeometry(source){
  const indexed=source.clone(),position=indexed.attributes.position,indices=indexed.index.array,kept=[];
  // Remove the scan's shoulders below the existing character's neck joint.
  for(let i=0;i<indices.length;i+=3)if([indices[i],indices[i+1],indices[i+2]].every(v=>position.getY(v)>=-1.05))kept.push(indices[i],indices[i+1],indices[i+2]);
  // Blend the cropped nape into the body without narrowing the jaw or face.
  const normal=indexed.attributes.normal;
  for(let i=0;i<position.count;i++){
    const x=position.getX(i),y=position.getY(i),z=position.getZ(i),blend=(1-THREE.MathUtils.smoothstep(y,-1.05,.05))*(1-THREE.MathUtils.smoothstep(z,.5,1.6)),sx=1-.18*blend,sz=1-.4*blend;
    position.setXYZ(i,x*sx,y,z*sz);
    const nx=normal.getX(i)/sx,ny=normal.getY(i),nz=normal.getZ(i)/sz,length=Math.hypot(nx,ny,nz)||1;normal.setXYZ(i,nx/length,ny/length,nz/length);
  }
  indexed.setIndex(kept);const geometry=indexed.toNonIndexed();indexed.dispose();geometry.computeBoundingBox();geometry.computeBoundingSphere();return geometry;
}

function eye(parent,x,y,z){
  const group=new THREE.Group();group.position.set(x,y,z);parent.add(group);
  const sclera=new THREE.MeshPhysicalMaterial({color:0xbfbcb0,roughness:.28,metalness:0,clearcoat:.8,clearcoatRoughness:.12,envMapIntensity:.35});
  const globe=new THREE.Mesh(new THREE.SphereGeometry(.32,32,24),sclera);group.add(globe);
  const irisMaterial=new THREE.MeshStandardMaterial({color:0x646e59,roughness:.4,metalness:0,envMapIntensity:.35});
  for(const [radius,angle,material] of [[.322,.43,irisMaterial],[.324,.17,new THREE.MeshStandardMaterial({color:0x090b0c,roughness:.17,envMapIntensity:.25})]]){
    const cap=new THREE.Mesh(new THREE.SphereGeometry(radius,32,12,0,Math.PI*2,0,angle),material);cap.rotation.x=Math.PI/2;group.add(cap);
  }
}

export async function loadMiloHead(){
  const base=`${import.meta.env.BASE_URL}assets/obs/head/`,loader=new THREE.TextureLoader();
  const [gltf,map,normalMap]=await Promise.all([new GLTFLoader().loadAsync(base+'LeePerrySmith.glb'),loader.loadAsync(base+'Map-COL.jpg'),loader.loadAsync(base+'Infinite-Level_02_Tangent_SmoothUV.jpg')]);
  map.colorSpace=THREE.SRGBColorSpace;map.anisotropy=4;normalMap.anisotropy=4;
  const material=new THREE.MeshStandardMaterial({color:0xd2c8bd,map,normalMap,normalScale:new THREE.Vector2(.45,.45),roughness:.74,metalness:0,envMapIntensity:.3});
  material.onBeforeCompile=shader=>{
    shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vHeadPosition;').replace('#include <begin_vertex>','#include <begin_vertex>\nvHeadPosition = position;');
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 vHeadPosition;').replace('#include <color_fragment>',`#include <color_fragment>
      vec2 leftEye = (vHeadPosition.xy - vec2(-0.81, 1.72)) / vec2(0.285, 0.115);
      vec2 rightEye = (vHeadPosition.xy - vec2(0.65, 1.70)) / vec2(0.285, 0.115);
      if (vHeadPosition.z > 1.4 && min(dot(leftEye, leftEye), dot(rightEye, rightEye)) < 1.0) discard;
      float hairline = 1.45 + smoothstep(-1.2, 1.8, vHeadPosition.z) * 1.34 + pow(abs(vHeadPosition.x) / 1.8, 2.0) * 0.20;
      float hairMask = smoothstep(hairline - 0.055, hairline + 0.045, vHeadPosition.y);
      float grain = fract(sin(dot(vHeadPosition, vec3(127.1, 311.7, 74.7))) * 43758.5453);
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.022, 0.018, 0.015) * (0.75 + grain * 0.45), hairMask);
    `);
  };
  material.customProgramCacheKey=()=> 'obs-milo-scan-v1';
  const source=gltf.scene.getObjectByName('LeePerrySmith');
  if(!source?.isMesh)throw new Error('Milo head mesh is missing');
  const group=new THREE.Group(),mesh=new THREE.Mesh(headGeometry(source.geometry),material);mesh.name='Milo scanned head';mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);group.scale.setScalar(.055);
  eye(group,-.81,1.72,1.55);eye(group,.65,1.70,1.54);
  gltf.scene.traverse(object=>{object.geometry?.dispose();if(object.material)(Array.isArray(object.material)?object.material:[object.material]).forEach(m=>m.dispose());});
  return group;
}
