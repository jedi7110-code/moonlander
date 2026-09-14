import * as THREE from 'three';

let bodyData=null;
export async function loadMiloBody(url=`${import.meta.env.BASE_URL}assets/obs/milo/body.json`){
  if(bodyData)return bodyData;
  const response=await fetch(url);if(!response.ok)throw new Error('Milo body could not be loaded');
  bodyData=await response.json();return bodyData;
}

// The animation controllers remain the authoritative joints. Bones live below
// those controllers, so walking, IK, sitting and reaching deform the same skin.
export function attachMiloBody(root,m,pants,legacy){
  if(!bodyData)return null;
  const {body,chest,head,arms,legs}=root.userData,data=bodyData;
  const drivers={body,chest,head},wrists=[];
  for(let i=0;i<arms.length;i++){
    const prefix=arms[i].side<0?'L':'R';
    for(const key of ['arm','elbow','hand'])drivers[prefix+'_'+key]=arms[i][key];
    for(const key of ['leg','knee','boot'])drivers[prefix+'_'+key]=legs[i][key];
    arms[i].fingers.forEach((finger,j)=>{
      [finger,...finger.userData.links].forEach((link,k)=>drivers[`${prefix}_finger${j}_${k}`]=link);
    });
    drivers[prefix+'_thumb']=arms[i].thumb;
    for(let j=1;j<=2;j++){
      const driver=new THREE.Group();driver.position.copy(arms[i].hand.position);arms[i].elbow.add(driver);
      drivers[`${prefix}_wrist${j}`]=driver;wrists.push({driver,hand:arms[i].hand,fraction:j/3});
    }
  }
  const bones=data.bones.map(spec=>{const bone=new THREE.Bone();bone.name='Milo skin '+spec.name;drivers[spec.name].add(bone);return bone;});
  const inverses=data.bones.map(spec=>new THREE.Matrix4().makeTranslation(...spec.target.map(v=>-v)));
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(data.positions,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(data.uvs,2));
  geometry.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(data.joints,4));geometry.setAttribute('skinWeight',new THREE.Float32BufferAttribute(data.weights,4));
  geometry.setIndex(data.indices);geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();
  geometry.setAttribute('armRegion',new THREE.Float32BufferAttribute(data.armRegions,1));
  const material=m.skin.clone();material.roughness=.84;
  material.onBeforeCompile=shader=>{
    shader.uniforms.shirtColor={value:m.cloth.color};shader.uniforms.trouserColor={value:pants.color};
    shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nattribute float armRegion; varying float vArmRegion; varying vec3 vBodyPosition;').replace('#include <begin_vertex>','#include <begin_vertex>\nvBodyPosition=position;vArmRegion=armRegion;');
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nuniform vec3 shirtColor;uniform vec3 trouserColor;varying float vArmRegion;varying vec3 vBodyPosition;').replace('#include <color_fragment>',`#include <color_fragment>
      float side=abs(vBodyPosition.x);
      float neckline=vBodyPosition.z>0.0?1.535+.050*smoothstep(0.0,.075,side):1.558+.027*smoothstep(0.0,.075,side);
      float sleeve=mix(1.0,smoothstep(1.293,1.297,vBodyPosition.y),smoothstep(.20,.50,vArmRegion));
      float shirt=(1.0-smoothstep(neckline-.001,neckline+.001,vBodyPosition.y))*sleeve;
      float collar=smoothstep(neckline-.014,neckline-.010,vBodyPosition.y)*shirt;
      float cuff=(1.0-smoothstep(1.303,1.310,vBodyPosition.y))*smoothstep(.5,.8,vArmRegion)*shirt;
      float trousers=(1.0-smoothstep(1.073,1.077,vBodyPosition.y))*(1.0-smoothstep(.2,.5,vArmRegion));
      diffuseColor.rgb=mix(mix(diffuseColor.rgb,shirtColor*(1.0-.09*max(collar,cuff)),shirt),trouserColor,trousers);
    `);
  };
  material.customProgramCacheKey=()=> 'milo-continuous-body-tshirt-v2';
  const mesh=new THREE.SkinnedMesh(geometry,material);mesh.name='Continuous sample-based human body';
  mesh.castShadow=true;mesh.receiveShadow=true;mesh.frustumCulled=false;body.add(mesh);
  mesh.bind(new THREE.Skeleton(bones,inverses),new THREE.Matrix4());mesh.normalizeSkinWeights();
  for(const surface of legacy)surface.visible=false;
  root.userData.updateWristTwists=()=>{for(const {driver,hand,fraction}of wrists){driver.position.copy(hand.position);driver.quaternion.identity().slerp(hand.quaternion,fraction);}};
  root.userData.bodySkin=mesh;root.userData.bodySource=data.source;return mesh;
}
