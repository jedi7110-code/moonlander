import * as THREE from 'three';
import {cylinder} from './materials.js';

const lower=.995,upper=1.100,thickness=.0018;

function bandageMaterial(source){
  const material=source.clone();material.name='Medical gauze';
  material.color.setHex(0xe8e5da);material.map=null;material.roughness=.95;
  material.bumpScale=.0005;
  material.onBeforeCompile=shader=>{
    shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying float vBandageHeight;')
      .replace('#include <begin_vertex>',`#include <begin_vertex>\nvBandageHeight=(position.y-${lower})/${upper-lower};`);
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying float vBandageHeight;')
      .replace('#include <clipping_planes_fragment>','#include <clipping_planes_fragment>\nif(vBandageHeight<0.0||vBandageHeight>1.0)discard;')
      .replace('#include <color_fragment>',`#include <color_fragment>
        float wrap=fract(vBandageHeight*4.0);
        float seam=1.0-smoothstep(.025,.095,wrap);
        diffuseColor.rgb*=1.0-.075*seam;
      `);
  };
  material.customProgramCacheKey=()=> 'milo-fitted-gauze-v1';return material;
}

export function attachMiloBandage(root,m){
  const {bodySkin:skin,arms}=root.userData;
  if(!skin){
    const bandage=new THREE.Group();bandage.position.y=-.13;arms[0].elbow.add(bandage);
    cylinder(bandage,m.cloth,0,0,0,.049,.105,.049,24);
    for(const y of [-.037,-.013,.013,.037])cylinder(bandage,m.white,0,y,0,.050,.009,.050,24);
    bandage.visible=false;root.userData.bandage=bandage;return bandage;
  }
  const {position,armRegion}=skin.geometry.attributes,indices=skin.geometry.index.array;
  const vertices=[],triangles=[],lookup=new Map();
  for(let i=0;i<indices.length;i+=3){
    const face=[indices[i],indices[i+1],indices[i+2]],ys=face.map(j=>position.getY(j));
    if(Math.min(...ys)>upper||Math.max(...ys)<lower||face.some(j=>position.getX(j)>=0||armRegion.getX(j)<.95))continue;
    for(const j of face){if(!lookup.has(j)){lookup.set(j,vertices.length);vertices.push(j);}triangles.push(lookup.get(j));}
  }
  const geometry=new THREE.BufferGeometry();
  for(const [name,size]of [['position',3],['normal',3],['uv',2],['skinWeight',4]])geometry.setAttribute(name,new THREE.Float32BufferAttribute(new Float32Array(vertices.length*size),size));
  geometry.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(new Uint16Array(vertices.length*4),4));geometry.setIndex(triangles);
  const bandage=new THREE.SkinnedMesh(geometry,bandageMaterial(m.cloth));
  bandage.name='Milo right forearm bandage';bandage.frustumCulled=false;bandage.receiveShadow=true;
  // Use the same parent, bind transform and joint weights as the visible arm.
  skin.parent.add(bandage);bandage.bind(skin.skeleton,skin.bindMatrix);
  bandage.userData.skinVertices=vertices;root.userData.bandage=bandage;
  updateMiloBandage(root);bandage.visible=false;
  return bandage;
}

export function updateMiloBandage(root){
  const {bandage,bodySkin:skin}=root.userData;if(!bandage?.isSkinnedMesh||!skin)return;
  const source=skin.geometry.attributes,target=bandage.geometry.attributes,data=bandage.userData;
  const attributes=['position','normal','uv','skinIndex','skinWeight'];
  if(data.sources?.every((attribute,i)=>attribute===source[attributes[i]]&&data.versions[i]===attribute.version))return;
  const normal=new THREE.Vector3();
  for(let i=0;i<data.skinVertices.length;i++){
    const j=data.skinVertices[i];normal.fromBufferAttribute(source.normal,j).normalize();
    target.position.setXYZ(i,source.position.getX(j)+normal.x*thickness,source.position.getY(j)+normal.y*thickness,source.position.getZ(j)+normal.z*thickness);
    target.normal.setXYZ(i,normal.x,normal.y,normal.z);
    target.uv.setXY(i,source.uv.getX(j),source.uv.getY(j));
    for(const name of ['skinIndex','skinWeight'])for(let k=0;k<4;k++)target[name].array[i*4+k]=source[name].array[j*4+k];
  }
  attributes.forEach(name=>target[name].needsUpdate=true);
  data.sources=attributes.map(name=>source[name]);data.versions=data.sources.map(attribute=>attribute.version);
}
