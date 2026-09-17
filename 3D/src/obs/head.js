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
  const filled=new Set(),savedNormals=normal.array.slice();
  for(let i=0;i<position.count;i++){
    const x=position.getX(i),y=position.getY(i),z=position.getZ(i);
    const front=THREE.MathUtils.smoothstep(z,.05,.55)*(1-THREE.MathUtils.smoothstep(y,-.85,-.45));
    const envelope=.14+1.28*Math.sqrt(Math.max(0,1-(x/1.20)**2));
    if(front&&envelope>z){position.setZ(i,THREE.MathUtils.lerp(z,envelope,front));filled.add(i);}
  }
  indexed.computeVertexNormals();
  for(let i=0;i<normal.count;i++)if(!filled.has(i))normal.setXYZ(i,...savedNormals.slice(i*3,i*3+3));
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
  const lowerPosition=(v,t)=>{
    const angle=Math.atan2(v.position[2],v.position[0]),blend=THREE.MathUtils.smoothstep(t,0,.5);
    const y=cut-.90*t;
    const x=THREE.MathUtils.lerp(v.position[0],Math.cos(angle)*1.34,blend);
    const z=THREE.MathUtils.lerp(v.position[2],Math.sin(angle)*(Math.sin(angle)>0?1.42:1.22),blend);
    return [x,y,z];
  };
  const lower=(v,t)=>{
    const angle=Math.atan2(v.position[2],v.position[0]);
    const out=interpolate(v,v,0);
    out.position=lowerPosition(v,t);
    const before=lowerPosition(v,Math.max(0,t-.001)),after=lowerPosition(v,Math.min(1,t+.001));
    const slope=((after[0]-before[0])*Math.cos(angle)+(after[2]-before[2])*Math.sin(angle))/(before[1]-after[1]);
    const n=new THREE.Vector3(...v.normal).lerp(new THREE.Vector3(Math.cos(angle),slope,Math.sin(angle)).normalize(),THREE.MathUtils.smoothstep(t,0,.25)).normalize();out.normal=n.toArray();
    return out;
  };
  for(const [a,b]of segments)for(let row=0;row<16;row++){
    const at=lower(a,row/16),bt=lower(b,row/16),ab=lower(a,(row+1)/16),bb=lower(b,(row+1)/16);
    emit(bt,at,ab);emit(bt,ab,bb);
  }
  for(const name of attributes)geometry.setAttribute(name,new THREE.Float32BufferAttribute(arrays[name],name==='uv'?2:3));
  indexed.dispose();geometry.computeBoundingBox();geometry.computeBoundingSphere();return geometry;
}

export const MILO_EYE_OPENINGS=[
  {x:-.73,y:1.69,halfWidth:.27,halfHeight:.086},
  {x:.51,y:1.69,halfWidth:.27,halfHeight:.086},
];
const eyeOpeningMask=MILO_EYE_OPENINGS.map(({x,y,halfWidth,halfHeight},i)=>
  `vec2 eyeOpening${i}=(vHeadPosition.xy-vec2(${x.toFixed(4)},${y.toFixed(4)}))/vec2(${halfWidth.toFixed(4)},${halfHeight.toFixed(4)});`
).join('\n')+'\nif(vHeadPosition.z>1.4&&min(dot(eyeOpening0,eyeOpening0),dot(eyeOpening1,eyeOpening1))<1.0)discard;';

export function createMiloEye(source,{x,y,halfWidth,halfHeight}){
  const scanMaterial=new THREE.MeshBasicMaterial({side:THREE.DoubleSide}),scan=new THREE.Mesh(source,scanMaterial);
  const ray=new THREE.Raycaster(new THREE.Vector3(),new THREE.Vector3(0,0,-1));
  const depthAt=(px,py)=>{
    ray.ray.origin.set(px,py,4);
    const hit=ray.intersectObject(scan,false)[0];
    if(!hit)throw new Error('Milo eyelid surface is missing');
    return hit.point.z;
  };
  const segments=128,rings=16,centerDepth=depthAt(x,y)+.006;
  const boundary=Array.from({length:segments},(_,i)=>{
    const angle=i/segments*Math.PI*2;
    return depthAt(x+halfWidth*Math.cos(angle),y+halfHeight*Math.sin(angle));
  });
  const profile=[0,0,0,0,0];
  for(let i=0;i<segments;i++){
    const angle=i/segments*Math.PI*2,z=boundary[i]/segments;
    profile[0]+=z;profile[1]+=2*z*Math.cos(angle);profile[2]+=2*z*Math.sin(angle);
    profile[3]+=2*z*Math.cos(2*angle);profile[4]+=2*z*Math.sin(2*angle);
  }
  const positions=[x,y,centerDepth],indices=[];
  // A convex eye surface meets the actual scanned lid, with a buried overlap
  // outside the opening. A clipped free-floating globe leaves side-view holes.
  for(let row=1;row<=rings+1;row++){
    const r=row<=rings?row/rings:1.025;
    for(let i=0;i<segments;i++){
      const angle=i/segments*Math.PI*2,px=x+halfWidth*r*Math.cos(angle),py=y+halfHeight*r*Math.sin(angle);
      const dome=centerDepth+r*(profile[1]*Math.cos(angle)+profile[2]*Math.sin(angle))+r*r*(profile[0]-centerDepth+profile[3]*Math.cos(2*angle)+profile[4]*Math.sin(2*angle));
      const edge=THREE.MathUtils.lerp(centerDepth,boundary[i],r*r);
      const z=row<=rings?THREE.MathUtils.lerp(dome,edge,THREE.MathUtils.smoothstep(r,.70,1)):depthAt(px,py)-.004;
      positions.push(px,py,z);
      const a=1+(row-1)*segments+i,b=1+(row-1)*segments+(i+1)%segments;
      if(row===1)indices.push(0,a,b);
      else{const c=a-segments,d=b-segments;indices.push(c,a,b,c,b,d);}
    }
  }
  scanMaterial.dispose();
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setIndex(indices);
  geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();
  const material=new THREE.MeshPhysicalMaterial({color:0xbfbcb0,roughness:.28,metalness:0,clearcoat:.8,clearcoatRoughness:.12,envMapIntensity:.35});
  material.onBeforeCompile=shader=>{
    shader.uniforms.eyeCenter={value:new THREE.Vector2(x,y)};shader.uniforms.irisColor={value:new THREE.Color(0x646e59)};
    shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nuniform vec2 eyeCenter; varying vec2 vEyeOffset;').replace('#include <begin_vertex>','#include <begin_vertex>\nvEyeOffset=position.xy-eyeCenter;');
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nuniform vec3 irisColor; varying vec2 vEyeOffset;').replace('#include <color_fragment>',`#include <color_fragment>
      float radius=length(vEyeOffset),angle=atan(vEyeOffset.y,vEyeOffset.x);
      float iris=1.0-smoothstep(.120,.125,radius),pupil=1.0-smoothstep(.040,.044,radius);
      float fibers=.90+.07*sin(angle*41.0+radius*160.0)+.03*sin(angle*73.0-radius*95.0);
      vec3 irisTone=irisColor*fibers*(1.0-.45*smoothstep(.104,.123,radius));
      diffuseColor.rgb=mix(diffuseColor.rgb,irisTone,iris);
      diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.003,.004,.005),pupil);
    `);
  };
  material.customProgramCacheKey=()=> 'milo-fitted-eye-v2';
  const eye=new THREE.Mesh(geometry,material);eye.name='Fitted Milo eye surface';eye.receiveShadow=true;return eye;
}

// Head-local coordinates keep the nape mark attached during every head turn.
// Mirror the projection axis, not the artwork: it reads normally from behind.
export const MILO_NAPE_TATTOO={width:1.5,height:.30,centerY:-.35};
export const NAPE_TATTOO_GLSL=`
  vec2 napeUv=vec2(.5-vHeadPosition.x/${MILO_NAPE_TATTOO.width.toFixed(4)},.5+(vHeadPosition.y-(${MILO_NAPE_TATTOO.centerY.toFixed(4)}))/${MILO_NAPE_TATTOO.height.toFixed(4)});
  float napeFrame=1.0-smoothstep(.96,1.0,max(abs(napeUv.x-.5),abs(napeUv.y-.5))*2.0);
  float napeRear=1.0-smoothstep(-.6,-.35,vHeadPosition.z);
  if(napeFrame*napeRear>0.001){
    vec4 mark=texture2D(napeTattoo,vec2(.19,.32)+clamp(napeUv,0.0,1.0)*vec2(.62,.36));
    float pigment=min(mark.r,min(mark.g,mark.b));
    float red=clamp((mark.r-max(mark.g,mark.b))*2.5,0.0,1.0);
    vec3 inkColor=diffuseColor.rgb*mix(vec3(.15,.19,.18),vec3(.80,.055,.035),red);
    float ink=mark.a*(1.0-smoothstep(.40,.96,pigment))*napeFrame*napeRear*.88;
    diffuseColor.rgb=mix(diffuseColor.rgb,inkColor,ink);
  }
`;

export async function loadMiloHead(base=`${import.meta.env?.BASE_URL??'/3D/'}assets/obs/head/`){
  const loader=new THREE.TextureLoader();
  const [gltf,map,normalMap,napeTattoo]=await Promise.all([new GLTFLoader().loadAsync(base+'LeePerrySmith.glb'),loader.loadAsync(base+'Map-COL.jpg'),loader.loadAsync(base+'Infinite-Level_02_Tangent_SmoothUV.jpg'),loader.loadAsync(base+'tattoo-naval-barcode.png')]);
  napeTattoo.colorSpace=THREE.NoColorSpace;napeTattoo.anisotropy=4;
  map.colorSpace=THREE.SRGBColorSpace;map.anisotropy=4;normalMap.anisotropy=4;
  const material=new THREE.MeshStandardMaterial({color:0xd2c8bd,map,normalMap,normalScale:new THREE.Vector2(.45,.45),roughness:.74,metalness:0,envMapIntensity:.3});
  const mouthMotion={value:0};
  material.onBeforeCompile=shader=>{
    shader.uniforms.mouthMotion=mouthMotion;
    shader.uniforms.napeTattoo={value:napeTattoo};
    shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vHeadPosition;\nuniform float mouthMotion;').replace('#include <begin_vertex>',`#include <begin_vertex>
      vHeadPosition = position;
      float lipLine = 0.45 - pow(abs(position.x + 0.11), 2.0) * 0.20;
      float jaw = (1.0 - smoothstep(lipLine - 0.025, lipLine + 0.025, position.y))
        * smoothstep(-0.9, -0.2, position.y) * smoothstep(1.6, 2.1, position.z)
        * (1.0 - smoothstep(0.55, 0.95, abs(position.x + 0.11)));
      transformed.y -= mouthMotion * 0.20 * jaw;
    `);
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 vHeadPosition;\nuniform sampler2D napeTattoo;').replace('#include <color_fragment>',`#include <color_fragment>
      ${eyeOpeningMask}
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
      ${NAPE_TATTOO_GLSL}
    `);
  };
  material.customProgramCacheKey=()=> 'obs-milo-scan-v9-nape-tattoo';
  const source=gltf.scene.getObjectByName('LeePerrySmith');
  if(!source?.isMesh)throw new Error('Milo head mesh is missing');
  const group=new THREE.Group(),mesh=new THREE.Mesh(headGeometry(source.geometry),material);mesh.name='Milo scanned head';mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);group.scale.setScalar(.055);
  mesh.customDepthMaterial=new THREE.MeshDepthMaterial({depthPacking:THREE.RGBADepthPacking});
  mesh.customDepthMaterial.onBeforeCompile=shader=>{
    shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vHeadPosition;').replace('#include <begin_vertex>','#include <begin_vertex>\nvHeadPosition=position;');
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 vHeadPosition;').replace('#include <clipping_planes_fragment>',`#include <clipping_planes_fragment>
      ${eyeOpeningMask}
    `);
  };
  mesh.customDepthMaterial.customProgramCacheKey=()=> 'milo-open-eyelid-shadow-v2';
  group.add(createHair(mesh.geometry));
  const mouth=new THREE.Mesh(new THREE.SphereGeometry(1,24,12),new THREE.MeshStandardMaterial({color:0x25140f,roughness:1}));
  mouth.position.set(-.11,.405,2.285);mouth.visible=false;group.add(mouth);
  group.userData.setMouthMotion=(open,chew)=>{mouthMotion.value=open+chew*.28;mouth.visible=open>.04;mouth.scale.set(.43,.075*open,.025);};
  group.add(...MILO_EYE_OPENINGS.map(opening=>createMiloEye(source.geometry,opening)));
  gltf.scene.traverse(object=>{object.geometry?.dispose();if(object.material)(Array.isArray(object.material)?object.material:[object.material]).forEach(m=>m.dispose());});
  return group;
}
