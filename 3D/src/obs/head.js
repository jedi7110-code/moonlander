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
  // Keep a gentle nape transition without narrowing an adult neck into a stem.
  // The jaw/face is excluded by the front mask and stays unchanged.
  const neckWidthTaper=.12,neckDepthTaper=.38;
  const normal=indexed.attributes.normal;
  for(let i=0;i<position.count;i++){
    const x=position.getX(i),y=position.getY(i),z=position.getZ(i);
    const height=1-THREE.MathUtils.smoothstep(y,-1.05,.85),rear=1-THREE.MathUtils.smoothstep(z,.5,1.6),blend=height*rear;
    if(!blend)continue;
    const sx=1-neckWidthTaper*blend,sz=1-neckDepthTaper*blend;
    position.setXYZ(i,x*sx,y,z*sz);
    // Inverse-transpose of the tapered surface, including its changing slope.
    const dy=-smoothstepSlope(y,-1.05,.85)*rear,dz=-height*smoothstepSlope(z,.5,1.6);
    const nx=normal.getX(i)/sx,nz=(normal.getZ(i)+neckWidthTaper*x*dz*nx)/(sz-neckDepthTaper*z*dz);
    const ny=normal.getY(i)+neckWidthTaper*x*dy*nx+neckDepthTaper*z*dy*nz,length=Math.hypot(nx,ny,nz)||1;
    normal.setXYZ(i,nx/length,ny/length,nz/length);
  }
  indexed.setIndex(kept);const geometry=indexed.toNonIndexed();
  const attributes=['position','normal','uv'],arrays=Object.fromEntries(attributes.map(name=>[name,Array.from(geometry.attributes[name].array)]));
  const vertex=i=>Object.fromEntries(attributes.map(name=>{const a=indexed.attributes[name];return[name,Array.from(a.array.slice(i*a.itemSize,(i+1)*a.itemSize))];}));
  const interpolate=(a,b,t)=>Object.fromEntries(attributes.map(name=>[name,a[name].map((v,i)=>THREE.MathUtils.lerp(v,b[name][i],t))]));
  const emit=(...triangle)=>{for(const v of triangle)for(const name of attributes)arrays[name].push(...v[name]);};
  const cut=-1.05,segments=[];
  // Clip crossing triangles at the plane instead of dropping whole faces.
  // The old crop left a saw-toothed edge immediately under the jaw.
  for(let i=0;i<indices.length;i+=3){
    const triangle=[indices[i],indices[i+1],indices[i+2]].map(vertex);
    if(triangle.every(v=>v.position[1]>=cut)||triangle.every(v=>v.position[1]<cut))continue;
    const polygon=[];
    for(let j=0;j<3;j++){
      const a=triangle[j],b=triangle[(j+1)%3],inside=a.position[1]>=cut,next=b.position[1]>=cut;
      if(inside)polygon.push(a);
      if(inside!==next){const v=interpolate(a,b,(cut-a.position[1])/(b.position[1]-a.position[1]));v.position[1]=cut;polygon.push(v);}
    }
    for(let j=1;j<polygon.length-1;j++)emit(polygon[0],polygon[j],polygon[j+1]);
    for(let j=0;j<polygon.length;j++){
      const a=polygon[j],b=polygon[(j+1)%polygon.length];
      if(a.position[1]===cut&&b.position[1]===cut)segments.push([a,b]);
    }
  }
  // Continue the scan down inside the T-shirt collar. This hides the overlap
  // beneath fabric rather than ending two different necks under the chin.
  const lower=(v,t)=>{
    const angle=Math.atan2(v.position[2],v.position[0]),blend=THREE.MathUtils.smoothstep(t,0,1);
    const out=interpolate(v,v,0);
    out.position=[THREE.MathUtils.lerp(v.position[0],Math.cos(angle)*1.34,blend),cut-.90*t,THREE.MathUtils.lerp(v.position[2],Math.sin(angle)*1.22,blend)];
    const n=new THREE.Vector3(...v.normal).lerp(new THREE.Vector3(Math.cos(angle),0,Math.sin(angle)),blend).normalize();out.normal=n.toArray();
    return out;
  };
  for(const [a,b]of segments)for(let row=0;row<8;row++){
    const at=lower(a,row/8),bt=lower(b,row/8),ab=lower(a,(row+1)/8),bb=lower(b,(row+1)/8);
    emit(bt,at,ab);emit(bt,ab,bb);
  }
  for(const name of attributes)geometry.setAttribute(name,new THREE.Float32BufferAttribute(arrays[name],name==='uv'?2:3));
  indexed.dispose();geometry.computeBoundingBox();geometry.computeBoundingSphere();return geometry;
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

export async function loadMiloHead(base=`${import.meta.env.BASE_URL}assets/obs/head/`){
  const loader=new THREE.TextureLoader();
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
