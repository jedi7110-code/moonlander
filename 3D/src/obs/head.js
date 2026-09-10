import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {createHair,HAIRLINE_GLSL} from './hair.js';

function smoothstepSlope(value,low,high){
  const t=THREE.MathUtils.clamp((value-low)/(high-low),0,1);return 6*t*(1-t)/(high-low);
}

export function headGeometry(source){
  const indexed=source.clone(),position=indexed.attributes.position,indices=indexed.index.array,kept=[];
  // Remove the scan's shoulders below the existing character's neck joint.
  for(let i=0;i<indices.length;i+=3)if([indices[i],indices[i+1],indices[i+2]].every(v=>position.getY(v)>=-1.05))kept.push(indices[i],indices[i+1],indices[i+2]);
  // Carry the taper up the nape instead of ending it abruptly below the skull.
  const normal=indexed.attributes.normal;
  for(let i=0;i<position.count;i++){
    const x=position.getX(i),y=position.getY(i),z=position.getZ(i);
    const height=1-THREE.MathUtils.smoothstep(y,-1.05,.85),rear=1-THREE.MathUtils.smoothstep(z,.5,1.6),blend=height*rear;
    if(!blend)continue;
    const sx=1-.32*blend,sz=1-.62*blend;
    position.setXYZ(i,x*sx,y,z*sz);
    // Inverse-transpose of the tapered surface, including its changing slope.
    const dy=-smoothstepSlope(y,-1.05,.85)*rear,dz=-height*smoothstepSlope(z,.5,1.6);
    const nx=normal.getX(i)/sx,nz=(normal.getZ(i)+.32*x*dz*nx)/(sz-.62*z*dz);
    const ny=normal.getY(i)+.32*x*dy*nx+.62*z*dy*nz,length=Math.hypot(nx,ny,nz)||1;
    normal.setXYZ(i,nx/length,ny/length,nz/length);
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
  const mouthMotion={value:0};
  material.onBeforeCompile=shader=>{
    shader.uniforms.mouthMotion=mouthMotion;
    shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vHeadPosition;\nuniform float mouthMotion;').replace('#include <begin_vertex>',`#include <begin_vertex>
      vHeadPosition = position;
      float lipLine = 0.45 - pow(abs(position.x + 0.11), 2.0) * 0.20;
      float jaw = (1.0 - smoothstep(lipLine - 0.025, lipLine + 0.025, position.y))
        * smoothstep(-0.9, -0.2, position.y) * smoothstep(1.6, 2.1, position.z)
        * (1.0 - smoothstep(0.55, 0.95, abs(position.x + 0.11)));
      transformed.y -= mouthMotion * 0.20 * jaw;
    `);
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 vHeadPosition;').replace('#include <color_fragment>',`#include <color_fragment>
      vec2 leftEye = (vHeadPosition.xy - vec2(-0.81, 1.72)) / vec2(0.285, 0.115);
      vec2 rightEye = (vHeadPosition.xy - vec2(0.65, 1.70)) / vec2(0.285, 0.115);
      if (vHeadPosition.z > 1.4 && min(dot(leftEye, leftEye), dot(rightEye, rightEye)) < 1.0) discard;
      ${HAIRLINE_GLSL}
      float hairMask = smoothstep(hairline - 0.16, hairline + 0.10, vHeadPosition.y);
      hairMask *= mix(0.30, 1.0, smoothstep(hairline, max(hairline + 0.25, 2.55), vHeadPosition.y));
      float grain = fract(sin(dot(vHeadPosition, vec3(127.1, 311.7, 74.7))) * 43758.5453);
      float cheekLine = 0.53 + smoothstep(0.35, 1.45, abs(vHeadPosition.x)) * 0.54;
      float beard = (1.0 - smoothstep(cheekLine - 0.15, cheekLine + 0.13, vHeadPosition.y))
        * smoothstep(-0.85, -0.43, vHeadPosition.y) * smoothstep(0.45, 1.2, vHeadPosition.z);
      float moustache = smoothstep(0.50, 0.64, vHeadPosition.y) * (1.0 - smoothstep(0.88, 1.02, vHeadPosition.y))
        * (1.0 - smoothstep(0.38, 0.69, abs(vHeadPosition.x + 0.11))) * smoothstep(1.8, 2.15, vHeadPosition.z);
      float lips = exp(-pow((vHeadPosition.y - 0.44) / 0.13, 2.0))
        * (1.0 - smoothstep(0.35, 0.60, abs(vHeadPosition.x + 0.11))) * smoothstep(1.8, 2.1, vHeadPosition.z);
      float facialHair = max(beard * (1.0 - lips), moustache);
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.033, 0.026, 0.020), facialHair * (0.42 + grain * 0.22));
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.022, 0.018, 0.015) * (0.75 + grain * 0.45), hairMask);
    `);
  };
  material.customProgramCacheKey=()=> 'obs-milo-scan-v5';
  const source=gltf.scene.getObjectByName('LeePerrySmith');
  if(!source?.isMesh)throw new Error('Milo head mesh is missing');
  const group=new THREE.Group(),mesh=new THREE.Mesh(headGeometry(source.geometry),material);mesh.name='Milo scanned head';mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);group.scale.setScalar(.055);
  group.add(createHair(mesh.geometry));
  const mouth=new THREE.Mesh(new THREE.SphereGeometry(1,24,12),new THREE.MeshStandardMaterial({color:0x25140f,roughness:1}));
  mouth.position.set(-.11,.405,2.285);mouth.visible=false;group.add(mouth);
  group.userData.setMouthMotion=(open,chew)=>{mouthMotion.value=open+chew*.28;mouth.visible=open>.04;mouth.scale.set(.43,.075*open,.025);};
  eye(group,-.81,1.72,1.55);eye(group,.65,1.70,1.54);
  gltf.scene.traverse(object=>{object.geometry?.dispose();if(object.material)(Array.isArray(object.material)?object.material:[object.material]).forEach(m=>m.dispose());});
  return group;
}
