import * as THREE from 'three';
import {createMonsterArm} from './monster-arm.js';
import {createMonsterFace} from './monster-face.js';
import {createMonsterFeet} from './monster-feet.js';
import {createCarapace} from './carapace.js';
import {createTearingClothes} from './tearing-cloth.js';
import {createCreatureNeck} from './creature-neck.js';

const smooth=(a,b,x)=>THREE.MathUtils.smoothstep(x,a,b);
const growthField=`
float spreadThreshold(vec3 p,float arm){
  float torso=.06+abs(p.x+.19)*.42+max(0.,1.44-p.y)*.52;
  float leg=.38+max(0.,.98-p.y)*.42+smoothstep(-.04,.10,p.x)*.10;
  float oppositeArm=.30+max(0.,1.48-p.y)*.38;
  return mix(mix(torso,leg,1.-smoothstep(.94,1.04,p.y)),oppositeArm,arm*smoothstep(.08,.18,p.x));
}
float spreadAmount(vec3 p,float arm,float progress){
  float threshold=spreadThreshold(p,arm);
  float ripples=.025*sin(p.y*89.+p.x*67.)*sin(p.z*113.-p.x*31.);
  return smoothstep(threshold,threshold+.18,progress+ripples);
}
`;

function hookMaterial(material,key,callback){
  const previous=material.onBeforeCompile,cacheKey=material.customProgramCacheKey();
  material.onBeforeCompile=function(shader,...args){previous.call(this,shader,...args);callback(shader);};
  material.customProgramCacheKey=()=>`${cacheKey}-${key}`;material.needsUpdate=true;
}

function shellShader(material,spread,details,depth=false){
  hookMaterial(material,`creature-shell-${depth}`,shader=>{
    shader.uniforms.bodySpread=spread;
    shader.uniforms.surfaceDetail=details;
    shader.vertexShader=shader.vertexShader.replace('#include <common>',`#include <common>
      attribute float mutationOnset;attribute float mutationMask;
      varying float vMutationOnset;varying float vMutationMask;varying vec3 vMutationPosition;`)
      .replace('#include <begin_vertex>',`#include <begin_vertex>
      vMutationOnset=mutationOnset;vMutationMask=mutationMask;vMutationPosition=position;`);
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`#include <common>
      uniform float bodySpread;uniform float surfaceDetail;varying float vMutationOnset;varying float vMutationMask;varying vec3 vMutationPosition;`)
      .replace('#include <clipping_planes_fragment>',`#include <clipping_planes_fragment>
      float noise=.027*sin(vMutationPosition.y*89.+vMutationPosition.x*67.)*sin(vMutationPosition.z*113.);
      if(vMutationMask<.4||bodySpread+noise<vMutationOnset+.035)discard;`);
    if(!depth)shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
      float tendon=pow(.5+.5*sin(vMutationPosition.y*74.+sin(vMutationPosition.x*37.)*2.+vMutationPosition.z*44.),5.);
      float mottling=.5+.5*sin(vMutationPosition.y*109.)*sin(vMutationPosition.x*83.+vMutationPosition.z*71.);
      diffuseColor.rgb*=mix(vec3(1.),mix(vec3(.49,.59,.48),vec3(1.19,1.10,.87),tendon*.65+mottling*.30),surfaceDetail);`);
  });
}

export function createFullBodyInfection(root,mutatedArm){
  const {bodySkin:skin,arms}=root.userData;
  const spread={value:0},details={value:1};
  const geometry=skin.geometry.clone(),p=geometry.attributes.position,n=geometry.attributes.normal;
  const region=geometry.attributes.armRegion,positions=p.array.slice(),onsets=[],masks=[];
  for(let i=0;i<p.count;i++){
    const x=p.getX(i),y=p.getY(i),z=p.getZ(i),arm=region.getX(i);
    const torso=.06+Math.abs(x+.19)*.42+Math.max(0,1.44-y)*.52;
    const leg=.38+Math.max(0,.98-y)*.42+smooth(-.04,.10,x)*.10;
    const threshold=THREE.MathUtils.lerp(THREE.MathUtils.lerp(torso,leg,1-smooth(.94,1.04,y)),.30+Math.max(0,1.48-y)*.38,arm*smooth(.08,.18,x));
    // Both elongated arms have their own continuous hide. Keep the collar
    // inside the neck and let this shell cover the torso and legs.
    const originalArm=arm*(1-smooth(1.23,1.36,y));
    const mask=(1-originalArm)*smooth(.13,.20,y)*(1-smooth(1.535,1.57,y));
    const shoulder=Math.exp(-Math.pow((y-1.44)/.15,2)),back=1-smooth(-.02,.08,z);
    const flank=Math.exp(-Math.pow((y-1.25)/.25,2))*(1-arm);
    const thigh=Math.exp(-Math.pow((y-.76)/.25,2)),calf=Math.exp(-Math.pow((y-.35)/.17,2));
    const tendon=Math.pow(.5+.5*Math.sin(y*70.+Math.sin(x*33.)*1.8+z*36.),4);
    const bulk=(.018+shoulder*(.047+back*.045)+flank*(.024+back*.025)+thigh*.042+calf*.027+arm*.013);
    const handTaper=arm*(1-smooth(.94,1.08,y));
    const distance=(bulk+.011*tendon)*mask*(1-handTaper*.84);
    positions[i*3]+=n.getX(i)*distance;positions[i*3+1]+=n.getY(i)*distance;positions[i*3+2]+=n.getZ(i)*distance;
    onsets.push(threshold);masks.push(mask);
  }
  const target=geometry.clone();target.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));target.computeVertexNormals();
  geometry.morphAttributes.position=[target.attributes.position.clone()];
  geometry.morphAttributes.normal=[target.attributes.normal.clone()];target.dispose();
  geometry.setAttribute('mutationOnset',new THREE.Float32BufferAttribute(onsets,1));
  geometry.setAttribute('mutationMask',new THREE.Float32BufferAttribute(masks,1));
  const hide=new THREE.MeshStandardMaterial({color:'#73745a',roughness:.87,side:THREE.DoubleSide});
  shellShader(hide,spread,details);
  const shell=new THREE.SkinnedMesh(geometry,hide);shell.name='Curtis spreading organic hide';
  shell.bind(skin.skeleton,skin.bindMatrix);skin.parent.add(shell);shell.frustumCulled=false;shell.castShadow=true;
  shell.customDepthMaterial=new THREE.MeshDepthMaterial({depthPacking:THREE.RGBADepthPacking});shellShader(shell.customDepthMaterial,spread,details,true);
  const clothing=createTearingClothes(root,spread,hookMaterial);
  hookMaterial(skin.material,'infection-underlying-surface',shader=>{
    shader.uniforms.bodySpread=spread;shader.uniforms.bodySurfaceDetail=details;
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`#include <common>
      uniform float bodySpread;uniform float bodySurfaceDetail;${growthField}`)
      .replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
      // The white tee and trousers are painted into the original body shader.
      // Replace that surface too, including gaps around the neck and joints.
      float bodyInfection=max(spreadAmount(vBodyPosition,vArmRegion,bodySpread),smoothstep(.84,1.,bodySpread));
      float hideGrain=.5+.5*sin(vBodyPosition.y*74.+sin(vBodyPosition.x*37.)*2.+vBodyPosition.z*44.);
      vec3 creatureSkin=vec3(.172,.175,.102)*mix(.72,1.12,hideGrain*bodySurfaceDetail);
      diffuseColor.rgb=mix(diffuseColor.rgb,creatureSkin,bodyInfection);
      roughnessFactor=mix(roughnessFactor,.87,bodyInfection);
      float leftInfection=smoothstep(.22,.88,bodySpread)*smoothstep(.12,.20,vBodyPosition.x)*smoothstep(.55,.95,vArmRegion);
      diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.11,.14,.075),leftInfection*bodySurfaceDetail*.94);`);
  });

  const carapace=createCarapace(root);

  const face=createMonsterFace(root);
  const neck=createCreatureNeck(root);
  const other=arms.find(a=>a!==mutatedArm),otherHandRest=other.hand.scale.clone();
  const otherMonster=createMonsterArm(root,other);
  const feet=createMonsterFeet(root);
  return {
    prepare(progress){
      // Move the second elbow and wrist through the weighted skin just like
      // the first arm. Parent scaling would distort the moving hinge.
      const amount=smooth(.22,.88,progress);
      other.elbow.position.add(new THREE.Vector3(.045*amount,-.13*amount,-.045*amount));
      other.hand.position.y-=.28*amount;
      other.hand.scale.copy(otherHandRest).multiply(new THREE.Vector3(1+amount*.32,1+amount*.25,1+amount*.28));
      other.fingers.forEach((finger,i)=>{
        const length=amount*(1+[.1,.4,.25,0][i]);
        finger.rotation.x=-.08-amount*.12;finger.rotation.z=(i-1.5)*(.025+amount*.06);
        finger.userData.links.forEach((link,j)=>{link.position.y-=(j?.012:.018)*length;link.rotation.x=j?.03+amount*.65:.28+amount*.5;});
      });
      other.thumb.scale.y=1+amount*.25;
    },
    update(progress,surfaceEnabled,showJoints){
      spread.value=progress;details.value=surfaceEnabled?1:0;
      shell.visible=progress>.005;shell.morphTargetInfluences[0]=smooth(0,.94,progress);
      carapace.update(progress);
      const armAmount=smooth(.22,.88,progress);
      otherMonster.update(armAmount,showJoints&&armAmount>.05);
      face.update(smooth(.38,1,progress),surfaceEnabled);
      neck.update(progress);
      clothing.update(progress);
      feet.update(progress);
    }
  };
}
