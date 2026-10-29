import * as THREE from 'three';
import {mergeVertices} from 'three/addons/utils/BufferGeometryUtils.js';
import {createGroom} from './hair-groom.js';

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

export const MILO_HAIR_STYLES={
  reference:{label:'提供モデル',description:'提供OBJの毛束・頭皮・テクスチャを使用'},
  crop:{label:'A 現行・短髪',description:'今の短いクルーカット'},
  rough:{label:'B ラフクロップ',description:'不均一な束と立ち上がり。参照に最も近い'},
  fringe:{label:'C 乱れた前髪',description:'前方へ落ちる短い束を残す'},
  swept:{label:'D 流し気味',description:'片側へ流した少し整ったラフショート'},
};

function styleDisplacement(style,p,{top,edge,clump,front}){
  const crown=THREE.MathUtils.smoothstep(p.y,2.78,3.48),rim=1-edge;
  if(style==='rough'){
    const broken=.5+.5*Math.sin(p.x*17-p.z*11+Math.sin(p.y*9)*2.2);
    const spike=Math.max(0,Math.sin(p.x*11+p.z*7-p.y*3))**3;
    return{volume:.006+edge*(.012+top*(.16+.11*clump)),x:crown*edge*(clump-.5)*.18,y:crown*edge*(.06+.22*spike+.08*broken),z:crown*edge*(front*.12-.045)};
  }
  if(style==='fringe'){
    const fringe=front*(1-THREE.MathUtils.smoothstep(p.y,2.90,3.55));
    const split=.55+.45*Math.sin(p.x*8.5+1.2);
    return{volume:.005+edge*(.011+top*(.13+.09*clump)+fringe*.10),x:-top*edge*.03+p.x*fringe*rim*.10,y:-fringe*(.15+.42*rim)*split,z:fringe*(.34+.34*rim)-top*edge*.02};
  }
  if(style==='swept')return{volume:.005+edge*(.012+top*(.16+.07*clump)),x:-crown*edge*(.40+.10*clump),y:crown*edge*.07,z:crown*edge*.07};
  return{volume:.003+edge*(.008+top*(.12+.09*clump)),x:-top*edge*.17,y:0,z:-top*edge*.06};
}

export function createHair(scalp,style='crop',{hairline:edgeAt=hairline}={}){
  if(!MILO_HAIR_STYLES[style])style='crop';
  if(style!=='crop')return createGroom(scalp,style,hairline);
  const source=scalp.index?scalp.toNonIndexed():scalp,position=source.attributes.position,normal=source.attributes.normal,vertices=[],coverage=[];
  const signed=p=>p.y-Math.max(edgeAt(p.x,p.z)+.04,2.22+.08*Math.sin(p.x*4+p.z*3));
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
      const front=THREE.MathUtils.smoothstep(p.z,.55,1.75),d=styleDisplacement(style,p,{top,edge,clump,front});
      const v=p.clone().addScaledVector(n,d.volume);v.x+=d.x;v.y+=d.y;v.z+=d.z;
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
  material.customProgramCacheKey=()=> `milo-textured-hair-${style}-v2`;
  const mesh=new THREE.Mesh(geometry,material);mesh.name=`Milo hair ${style}`;mesh.userData.style=style;mesh.castShadow=true;mesh.receiveShadow=true;return mesh;
}
