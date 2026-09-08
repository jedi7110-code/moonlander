import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export async function materials() {
  const loader = new THREE.TextureLoader();
  const maps = await Promise.all(['enamel','steel','twill','fur'].map(name => loader.loadAsync(`${import.meta.env.BASE_URL}assets/obs/${name}.webp`)));
  maps.forEach(map => { map.colorSpace=THREE.SRGBColorSpace; map.wrapS=map.wrapT=THREE.RepeatWrapping; map.anisotropy=4; });
  const standard = (color, roughness=.65, metalness=.15, more={}) => new THREE.MeshStandardMaterial({color,roughness,metalness,...more});
  const fur=standard(0x252b31,.97,0,{map:maps[3],bumpMap:maps[3],bumpScale:.003});
  const furLight=standard(0xd8d6cc,.97,0,{map:maps[3],bumpMap:maps[3],bumpScale:.003});
  const furGinger=standard(0xa86735,.97,0,{map:maps[3],bumpMap:maps[3],bumpScale:.002});
  const furBody=furLight.clone();
  furBody.onBeforeCompile=shader=>{
    shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nattribute vec3 coatPosition;\nvarying vec3 vCoatPosition;').replace('#include <begin_vertex>','#include <begin_vertex>\nvCoatPosition = coatPosition;');
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 vCoatPosition;').replace('#include <map_fragment>',`#include <map_fragment>
      vec3 p = vCoatPosition;
      float edge = 0.075 * sin(p.y * 48.0 + p.z * 32.0) * sin(p.x * 43.0 - p.z * 19.0);
      float gingerDistance = min(length((p - vec3(-0.13, 0.39, -0.27)) / vec3(0.22, 0.20, 0.18)), length((p - vec3(0.14, 0.43, -0.015)) / vec3(0.21, 0.19, 0.18)));
      float blackDistance = min(length((p - vec3(-0.13, 0.43, 0.045)) / vec3(0.21, 0.17, 0.145)), length((p - vec3(0.14, 0.44, -0.28)) / vec3(0.20, 0.19, 0.15)));
      float ginger = 1.0 - smoothstep(0.94, 1.04, gingerDistance + edge);
      float black = 1.0 - smoothstep(0.94, 1.04, blackDistance - edge);
      diffuseColor.rgb *= mix(mix(vec3(1.0), vec3(0.53, 0.245, 0.080), ginger), vec3(0.028, 0.031, 0.030), black);
    `);
  };
  furBody.customProgramCacheKey=()=> 'obs-calico-body-v1';
  const furFace=furLight.clone();
  // The tapered white blaze follows the head, including when it turns.
  furFace.onBeforeCompile=shader=>{
    shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vCoatPosition;').replace('#include <begin_vertex>','#include <begin_vertex>\nvCoatPosition = position;');
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 vCoatPosition;').replace('#include <map_fragment>',`#include <map_fragment>
      float blazeWidth = 0.045 + 0.58 * (1.0 - smoothstep(-0.45, 0.78, vCoatPosition.y));
      float blaze = (1.0 - smoothstep(blazeWidth - 0.035, blazeWidth + 0.035, abs(vCoatPosition.x))) * smoothstep(0.04, 0.28, vCoatPosition.z);
      vec3 cap = mix(vec3(0.028, 0.031, 0.030), vec3(0.53, 0.245, 0.080), smoothstep(-0.10, 0.10, vCoatPosition.x));
      diffuseColor.rgb *= mix(cap, vec3(1.0), blaze);
    `);
  };
  furFace.customProgramCacheKey=()=> 'obs-calico-face-v1';
  const furTail=furGinger.clone();
  furTail.onBeforeCompile=shader=>{
    shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec2 vTailUv;').replace('#include <begin_vertex>','#include <begin_vertex>\nvTailUv = uv;');
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec2 vTailUv;').replace('#include <map_fragment>',`#include <map_fragment>
      float darkTip = smoothstep(0.64, 0.70, vTailUv.x + 0.035 * sin(vTailUv.y * 18.85));
      diffuseColor.rgb *= mix(vec3(1.0), vec3(0.055, 0.095, 0.18), darkTip);
    `);
  };
  furTail.customProgramCacheKey=()=> 'obs-calico-tail-v1';
  return {
    enamel: standard(0xd9dedb,.64,.35,{map:maps[0],bumpMap:maps[0],bumpScale:.009}),
    dark:standard(0x343d3e,.66,.6,{map:maps[1]}),
    metal:standard(0xaab8ba,.38,.83,{map:maps[1]}),
    white:standard(0xcbd1c8,.83,.05),
    rubber:standard(0x151c1d,.93,.02),
    olive:standard(0x859273,.93,0,{map:maps[2],bumpMap:maps[2],bumpScale:.005}),
    cloth:standard(0xe1ded1,.95,0,{bumpMap:maps[2],bumpScale:.002}),
    evaCloth:standard(0xd8dad0,.91,.02,{bumpMap:maps[2],bumpScale:.004}),
    evaVisor:standard(0x252e2b,.14,.82),
    evaWindow:new THREE.MeshBasicMaterial({color:0x020406}),
    cushion:standard(0x4b5957,.9,.01,{bumpMap:maps[2],bumpScale:.014}),
    skin:standard(0xb8896e,.75,0),
    hair:standard(0x332e28,.98,0),
    fur,
    furBody,
    furGinger,
    furTail,
    furEar:standard(0xffffff,.97,0,{map:maps[3],bumpMap:maps[3],bumpScale:.0006,vertexColors:true}),
    furFace,
    furLight,
    catEye:standard(0xc3a351,.25,0),
    pink:standard(0xbc8b87,.88,0),
    eye:standard(0x899b60,.24,0),
    black:standard(0x080d0d,.36,.1),
    red:standard(0x963f32,.56,.25),
    yellow:standard(0xc0a349,.7,.2),
    teal:standard(0x406c68,.72,.2),
    amber:standard(0xb89646,.4,.1,{emissive:0xffae4b,emissiveIntensity:.7}),
    green:standard(0x4b9982,.3,.1,{emissive:0x6fddaa,emissiveIntensity:.6}),
    lamp:standard(0xe3eddf,.35,0,{emissive:0xeaffdd,emissiveIntensity:2.2}),
    coolLamp:standard(0xc6e0de,.35,0,{emissive:0xbdeaf3,emissiveIntensity:1.8}),
    glass:new THREE.MeshPhysicalMaterial({color:0x98bbc0,metalness:.1,roughness:.25,transparent:true,opacity:.2,depthWrite:false}),
  };
}

const boxGeo = new THREE.BoxGeometry();
const ballGeo = new THREE.SphereGeometry(1,24,16);
export function box(parent,mat,x,y,z,w,h,d,r=0) {
  const mesh=new THREE.Mesh(r ? new RoundedBoxGeometry(w,h,d,2,r) : boxGeo,mat);
  if(!r)mesh.scale.set(w,h,d);
  mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;
}
export function ball(parent,mat,x,y,z,w,h,d) {
  const mesh=new THREE.Mesh(ballGeo,mat);mesh.position.set(x,y,z);mesh.scale.set(w,h,d);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;
}
export function cylinder(parent,mat,x,y,z,r,h,top=r,segments=16) {
  const mesh=new THREE.Mesh(new THREE.CylinderGeometry(top,r,h,segments),mat);mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;
}
export function pipe(parent,mat,points,r=.04) {
  const curve=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)));
  const mesh=new THREE.Mesh(new THREE.TubeGeometry(curve,Math.max(8,points.length*5),r,8,false),mat);mesh.castShadow=true;parent.add(mesh);return mesh;
}
export function rod(parent,mat,a,b,r=.035) {
  const from=new THREE.Vector3(...a),to=new THREE.Vector3(...b);
  const mesh=new THREE.Mesh(new THREE.CylinderGeometry(r,r,from.distanceTo(to),10),mat);
  mesh.position.copy(from).add(to).multiplyScalar(.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),to.sub(from).normalize());mesh.castShadow=true;parent.add(mesh);return mesh;
}
export function label(parent,text,x,y,z,w,h,{fg='#d4dbcc',bg='#232b2b',size=48}={}) {
  const canvas=document.createElement('canvas');canvas.width=512;canvas.height=Math.max(64,Math.round(512*h/w));const ctx=canvas.getContext('2d');
  ctx.fillStyle=bg;ctx.fillRect(0,0,canvas.width,canvas.height);ctx.fillStyle=fg;ctx.font=`600 ${size}px monospace`;ctx.textAlign='center';ctx.textBaseline='middle';
  const lines=text.split('\n');lines.forEach((line,i)=>ctx.fillText(line,256,canvas.height/2+(i-(lines.length-1)/2)*size*1.3,490));
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
  const mesh=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshStandardMaterial({map:texture,roughness:.75,emissive:0xaaaaaa,emissiveMap:texture,emissiveIntensity:.1}));mesh.position.set(x,y,z);parent.add(mesh);return mesh;
}
export function screen(parent,x,y,z,w=.85,h=.58,seed=0) {
  const canvas=document.createElement('canvas');canvas.width=384;canvas.height=256;const ctx=canvas.getContext('2d');ctx.fillStyle='#081c19';ctx.fillRect(0,0,384,256);ctx.strokeStyle='#7bdbc0';ctx.lineWidth=2;
  ctx.font='14px monospace';ctx.fillStyle='#93d4b2';ctx.fillText(seed%2?'BARRAMUNDI / STATUS':'UAC 7710 / TELEMETRY',18,25);
  for(let row=0;row<9;row++){ctx.fillStyle=row%3?'#558879':'#a8c892';ctx.fillText(`${String(seed+row).padStart(2,'0')}  ${['LINK: NOMINAL','BUS  28.4 V','O2   21.0 %','TEMP 294.5 K','COOLANT LOOP','PUMP 14 ACTIVE'][row%6]}`,18,56+row*19);}
  ctx.strokeRect(235,44,128,150);for(let row=0;row<5;row++){ctx.beginPath();for(let i=0;i<125;i++){const py=65+row*26+Math.sin(i*.14+row+seed)*9; i?ctx.lineTo(237+i,py):ctx.moveTo(237+i,py);}ctx.stroke();}
  ctx.fillStyle='#00000040';for(let y0=0;y0<256;y0+=3)ctx.fillRect(0,y0,384,1);
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
  const mesh=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({map:texture}));mesh.position.set(x,y,z);parent.add(mesh);return mesh;
}

// Ship fixtures are static; merge by material so rivets and switches stay inexpensive.
export function batchStatic(root) {
  root.updateMatrixWorld(true);
  const grouped=new Map();
  root.traverse(mesh=>{if(!mesh.isMesh || Array.isArray(mesh.material))return;const geometry=mesh.geometry.index?mesh.geometry.toNonIndexed():mesh.geometry.clone();geometry.applyMatrix4(mesh.matrixWorld);geometry.deleteAttribute('uv2');const key=mesh.material.uuid;
    if(!grouped.has(key))grouped.set(key,{mat:mesh.material,geometries:[]});grouped.get(key).geometries.push(geometry);
  });
  const merged=new THREE.Group();for(const {mat,geometries} of grouped.values()){const geometry=mergeGeometries(geometries,false);if(!geometry)throw new Error('Invalid ship geometry');const mesh=new THREE.Mesh(geometry,mat);mesh.castShadow=true;mesh.receiveShadow=true;merged.add(mesh);geometries.forEach(g=>g.dispose());}return merged;
}
