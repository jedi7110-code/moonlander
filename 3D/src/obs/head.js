import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {createHair,HAIRLINE_GLSL,MILO_HAIR_STYLES} from './hair.js';
import {loadSuppliedHair} from './supplied-hair.js';

export const MILO_BEARD_STYLES={
  none:{label:'なし',strength:0},
  light:{label:'薄い無精髭',strength:.42},
  rough:{label:'濃い無精髭',strength:1},
};

function smoothstepSlope(value,low,high){
  const t=THREE.MathUtils.clamp((value-low)/(high-low),0,1);return 6*t*(1-t)/(high-low);
}

// Metres at the character scale: advance the skull, not the neck joint.
export const MILO_HEAD_FORWARD=.025;
export function headGeometry(source,forward=0){
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
    const angle=Math.atan2(v.position[2],v.position[0]),blend=THREE.MathUtils.smoothstep(t,0,1);
    const y=cut-.90*t;
    // Carry the scan's tangent through the seam instead of starting a vertical
    // extension there. Hermite blending then settles gradually into the collar.
    const radial=v.normal[0]*Math.cos(angle)+v.normal[2]*Math.sin(angle);
    const tangent=THREE.MathUtils.clamp(.90*v.normal[1]/Math.max(.25,radial),-.6,.6)*t*(1-t)*(1-t);
    const x=THREE.MathUtils.lerp(v.position[0],Math.cos(angle)*1.34,blend)+Math.cos(angle)*tangent;
    const z=THREE.MathUtils.lerp(v.position[2],Math.sin(angle)*(Math.sin(angle)>0?1.42:1.22),blend)+Math.sin(angle)*tangent;
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
  if(forward){
    const p=geometry.attributes.position,n=geometry.attributes.normal;
    for(let i=0;i<p.count;i++){
      const y=p.getY(i),z=p.getZ(i),front=THREE.MathUtils.smoothstep(z,.5,1.6);
      const backWeight=THREE.MathUtils.smoothstep(y,-1.25,.55),frontWeight=THREE.MathUtils.smoothstep(y,-1.25,-.55);
      const weight=THREE.MathUtils.lerp(backWeight,frontWeight,front);
      p.setZ(i,p.getZ(i)+forward*weight);
      const dy=THREE.MathUtils.lerp(smoothstepSlope(y,-1.25,.55),smoothstepSlope(y,-1.25,-.55),front);
      const dz=smoothstepSlope(z,.5,1.6)*(frontWeight-backWeight);
      const nx=n.getX(i),nz=n.getZ(i)/(1+forward*dz),ny=n.getY(i)-forward*dy*nz,length=Math.hypot(nx,ny,nz);
      n.setXYZ(i,nx/length,ny/length,nz/length);
    }
  }
  indexed.dispose();geometry.computeBoundingBox();geometry.computeBoundingSphere();return geometry;
}

export const MILO_EYE_OPENINGS=[
  {x:-.73,y:1.69,halfWidth:.27,halfHeight:.086},
  {x:.51,y:1.69,halfWidth:.27,halfHeight:.086},
];
const eyeOpeningMask=MILO_EYE_OPENINGS.map(({x,y,halfWidth,halfHeight},i)=>
  `vec2 eyeOpening${i}=(vHeadPosition.xy-vec2(${x.toFixed(4)},${y.toFixed(4)}))/vec2(${halfWidth.toFixed(4)},${halfHeight.toFixed(4)});`
).join('\n')+'\nif(vHeadPosition.z>1.4&&min(dot(eyeOpening0,eyeOpening0),dot(eyeOpening1,eyeOpening1))<1.0)discard;';

let miloEyeEnvironment;
function eyeEnvironment(){
  if(miloEyeEnvironment)return miloEyeEnvironment;
  // Eye-only studio reflection: two broad, soft lights in a dark room.
  // Linear HDR data is filtered by Three's PMREM, not painted on the iris.
  const w=256,h=128,data=new Float32Array(w*h*4);
  for(let j=0;j<h;j++)for(let i=0;i<w;i++){
    const u=i/w,v=j/h;
    const box=(cx,cy,sx,sy)=>Math.exp(-Math.pow((u-cx)/sx,8)-Math.pow((v-cy)/sy,8));
    const key=box(.68,.66,.036,.052)*5,fill=box(.26,.58,.075,.018)*1.2;
    const k=(j*w+i)*4;
    data[k]=.025+key+fill*.75;data[k+1]=.03+key+fill*.87;data[k+2]=.04+key+fill;data[k+3]=1;
  }
  miloEyeEnvironment=new THREE.DataTexture(data,w,h,THREE.RGBAFormat,THREE.FloatType);
  miloEyeEnvironment.mapping=THREE.EquirectangularReflectionMapping;
  miloEyeEnvironment.needsUpdate=true;
  return miloEyeEnvironment;
}

export function createMiloEye(source,{x,y,halfWidth,halfHeight}){
  const scanMaterial=new THREE.MeshBasicMaterial({side:THREE.DoubleSide}),scan=new THREE.Mesh(source,scanMaterial);
  const ray=new THREE.Raycaster(new THREE.Vector3(),new THREE.Vector3(0,0,-1));
  const depthAt=(px,py)=>{
    ray.ray.origin.set(px,py,4);
    const hit=ray.intersectObject(scan,false)[0];
    if(!hit)throw new Error('Milo eyelid surface is missing');
    return hit.point.z;
  };
  const segments=128,rings=16,centerDepth=depthAt(x,y)+.030;
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
  const material=new THREE.MeshPhysicalMaterial({color:0xffffff,roughness:.24,metalness:0,clearcoat:1,clearcoatRoughness:.055,envMap:eyeEnvironment(),envMapIntensity:.65});
  material.onBeforeCompile=shader=>{
    shader.uniforms.eyeCenter={value:new THREE.Vector2(x,y)};
    shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nuniform vec2 eyeCenter; varying vec2 vEyeOffset;').replace('#include <begin_vertex>','#include <begin_vertex>\nvEyeOffset=position.xy-eyeCenter;');
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`#include <common>
      varying vec2 vEyeOffset;
      float eyeHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float eyeNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(eyeHash(i),eyeHash(i+vec2(1,0)),f.x),mix(eyeHash(i+vec2(0,1)),eyeHash(i+vec2(1,1)),f.x),f.y);}
    `).replace('#include <color_fragment>',`#include <color_fragment>
      vec2 ep=vEyeOffset-vec2(0.0,.008);
      float radius=length(ep),angle=atan(ep.y,ep.x),r=radius/.138;
      float iris=1.0-smoothstep(.134,.141,radius);
      float radialNoise=eyeNoise(vec2(cos(angle),sin(angle))*44.0+vec2(r*2.0));
      float fibers=pow(.5+.5*sin(angle*113.0+radialNoise*5.0+r*13.0),2.0);
      float fine=.5+.5*sin(angle*317.0+radialNoise*9.0-r*21.0);
      float crypt=eyeNoise(vec2(cos(angle),sin(angle))*24.0+vec2(r*11.0));
      float ring=.47+.035*sin(angle*19.0)+.025*radialNoise;
      float collarette=exp(-pow((r-ring)/.047,2.0));
      vec3 irisTone=mix(vec3(.018,.040,.037),vec3(.12,.18,.115),fibers*.65+fine*.20);
      irisTone*=.65+.55*crypt;
      irisTone=mix(irisTone,vec3(.17,.12,.045),collarette*.48);
      irisTone*=1.0-.65*smoothstep(.85,1.02,r);
      irisTone*=.70+.30*smoothstep(.34,.53,r);
      float pupil=1.0-smoothstep(.047,.051,radius+.0006*sin(angle*37.0));
      vec2 lid=vEyeOffset/vec2(${halfWidth.toFixed(5)},${halfHeight.toFixed(5)});
      float rim=smoothstep(.48,1.02,length(lid));
      float corner=smoothstep(.55,1.0,abs(lid.x));
      vec3 sclera=mix(vec3(.58,.56,.51),vec3(.39,.22,.19),corner*.55);
      float vessel=pow(.5+.5*sin(ep.x*210.0+sin(ep.y*190.0)*2.5),24.0)*corner;
      sclera=mix(sclera,vec3(.30,.10,.08),vessel*.10);
      diffuseColor.rgb=mix(sclera,irisTone,iris);
      diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.001,.0015,.002),pupil);
      float lidShade=(1.0-rim*.60)*(1.0-.40*smoothstep(.1,.95,lid.y));
      diffuseColor.rgb*=lidShade;
      // A narrow warm waterline seats the globe inside the eyelids; avoid the
      // hard black/white cut-out edge of the original eye replacement.
      float waterline=smoothstep(.87,1.015,length(lid));
      diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.16,.074,.052),waterline*.75);
    `).replace('#include <clearcoat_normal_fragment_begin>',`#include <clearcoat_normal_fragment_begin>
      // The wet cornea has a smooth optical surface independent of the scan's
      // small bumps. Tangents keep its reflection responsive to camera motion.
      vec3 eyeDx=dFdx(vViewPosition),eyeDy=dFdy(vViewPosition);
      vec2 uvDx=dFdx(vEyeOffset),uvDy=dFdy(vEyeOffset);
      vec3 eyeT=normalize(eyeDx*uvDy.y-eyeDy*uvDx.y);
      vec3 eyeB=normalize(-eyeDx*uvDy.x+eyeDy*uvDx.x);
      vec2 corneaSlope=ep*2.4;
      clearcoatNormal=normalize(geometryNormal-eyeT*corneaSlope.x-eyeB*corneaSlope.y);
    `);
  };
  material.customProgramCacheKey=()=> 'milo-fitted-eye-v3-fibers';
  const eye=new THREE.Mesh(geometry,material);eye.name='Fitted Milo eye surface';eye.receiveShadow=true;return eye;
}

// Head-local coordinates keep the nape mark attached during every head turn.
// Mirror the projection axis, not the artwork: it reads normally from behind.
export const MILO_NAPE_TATTOO={width:1.5,height:.30,centerY:-.70};
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
  const mouthMotion={value:0},facialHairStrength={value:1},proceduralHair={value:1};
  material.onBeforeCompile=shader=>{
    shader.uniforms.mouthMotion=mouthMotion;
    shader.uniforms.facialHairStrength=facialHairStrength;
    shader.uniforms.proceduralHair=proceduralHair;
    shader.uniforms.napeTattoo={value:napeTattoo};
    shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vHeadPosition;\nuniform float mouthMotion;').replace('#include <begin_vertex>',`#include <begin_vertex>
      vHeadPosition = position;
      float lipLine = 0.45 - pow(abs(position.x + 0.11), 2.0) * 0.20;
      float jaw = (1.0 - smoothstep(lipLine - 0.025, lipLine + 0.025, position.y))
        * smoothstep(-0.9, -0.2, position.y) * smoothstep(1.6, 2.1, position.z)
        * (1.0 - smoothstep(0.55, 0.95, abs(position.x + 0.11)));
      transformed.y -= mouthMotion * 0.20 * jaw;
    `);
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 vHeadPosition;\nuniform sampler2D napeTattoo;\nuniform float facialHairStrength;\nuniform float proceduralHair;').replace('#include <color_fragment>',`#include <color_fragment>
      ${eyeOpeningMask}
      ${HAIRLINE_GLSL}
      float hairMask = smoothstep(hairline - 0.16, hairline + 0.10, vHeadPosition.y);
      hairMask *= mix(0.30, 1.0, smoothstep(hairline, max(hairline + 0.25, 2.55), vHeadPosition.y));
      hairMask *= proceduralHair;
      float grain = fract(sin(dot(vHeadPosition, vec3(127.1, 311.7, 74.7))) * 43758.5453);
      float cheekLine = 0.53 + smoothstep(0.35, 1.45, abs(vHeadPosition.x)) * 0.54;
      float beard = (1.0 - smoothstep(cheekLine - 0.15, cheekLine + 0.13, vHeadPosition.y))
        * smoothstep(-0.85, -0.43, vHeadPosition.y) * smoothstep(0.45, 1.2, vHeadPosition.z);
      float moustache = smoothstep(0.50, 0.64, vHeadPosition.y) * (1.0 - smoothstep(0.88, 1.02, vHeadPosition.y))
        * (1.0 - smoothstep(0.38, 0.69, abs(vHeadPosition.x + 0.11))) * smoothstep(1.8, 2.15, vHeadPosition.z);
      float lips = exp(-pow((vHeadPosition.y - 0.44) / 0.13, 2.0))
        * (1.0 - smoothstep(0.35, 0.60, abs(vHeadPosition.x + 0.11))) * smoothstep(1.8, 2.1, vHeadPosition.z);
      float facialHair = max(beard * (1.0 - lips), moustache);
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.033, 0.026, 0.020), clamp(facialHair * facialHairStrength * (0.42 + grain * 0.22), 0.0, 1.0));
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.022, 0.018, 0.015) * (0.75 + grain * 0.45), hairMask);
      ${NAPE_TATTOO_GLSL}
    `);
  };
  material.customProgramCacheKey=()=> 'obs-milo-scan-v9-nape-tattoo';
  const source=gltf.scene.getObjectByName('LeePerrySmith');
  if(!source?.isMesh)throw new Error('Milo head mesh is missing');
  const suppliedHair=await loadSuppliedHair(base+'supplied-hair/');
  const forward=MILO_HEAD_FORWARD/.055,hairSource=headGeometry(source.geometry);
  const group=new THREE.Group(),mesh=new THREE.Mesh(headGeometry(source.geometry,forward),material);mesh.name='Milo scanned head';mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);group.scale.setScalar(.055);
  group.userData.faceForward=MILO_HEAD_FORWARD;
  mesh.customDepthMaterial=new THREE.MeshDepthMaterial({depthPacking:THREE.RGBADepthPacking});
  mesh.customDepthMaterial.onBeforeCompile=shader=>{
    shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vHeadPosition;').replace('#include <begin_vertex>','#include <begin_vertex>\nvHeadPosition=position;');
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 vHeadPosition;').replace('#include <clipping_planes_fragment>',`#include <clipping_planes_fragment>
      ${eyeOpeningMask}
    `);
  };
  mesh.customDepthMaterial.customProgramCacheKey=()=> 'milo-open-eyelid-shadow-v2';
  let hair=createHair(hairSource);hair.position.z=forward;group.add(hair);
  const mouth=new THREE.Mesh(new THREE.SphereGeometry(1,24,12),new THREE.MeshStandardMaterial({color:0x25140f,roughness:1}));
  mouth.position.set(-.11,.405,2.285+forward);mouth.visible=false;group.add(mouth);
  group.userData.setMouthMotion=(open,chew)=>{mouthMotion.value=open+chew*.28;mouth.visible=open>.04;mouth.scale.set(.43,.075*open,.025);};
  group.userData.appearance={hair:'crop',beard:'rough'};
  group.userData.setAppearance=({hair:nextHair=group.userData.appearance.hair,beard=group.userData.appearance.beard}={})=>{
    if(!MILO_HAIR_STYLES[nextHair])nextHair='crop';
    if(!MILO_BEARD_STYLES[beard])beard='rough';
    if(nextHair!==group.userData.appearance.hair){
      group.remove(hair);
      if(hair!==suppliedHair)hair.traverse(part=>{part.geometry?.dispose();part.material?.dispose();});
      hair=nextHair==='reference'?suppliedHair:createHair(hairSource,nextHair);hair.position.z=forward;group.add(hair);
    }
    proceduralHair.value=nextHair==='reference'?0:1;
    facialHairStrength.value=MILO_BEARD_STYLES[beard].strength;
    group.userData.appearance={hair:nextHair,beard};
  };
  group.add(...MILO_EYE_OPENINGS.map(opening=>{const eye=createMiloEye(source.geometry,opening);eye.position.z=forward;return eye;}));
  gltf.scene.traverse(object=>{object.geometry?.dispose();if(object.material)(Array.isArray(object.material)?object.material:[object.material]).forEach(m=>m.dispose());});
  return group;
}
