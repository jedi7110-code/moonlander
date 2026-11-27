import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';

const smooth=(a,b,x)=>THREE.MathUtils.smoothstep(x,a,b);

export function createMonsterFace(root){
  const {head}=root.userData,face=head.getObjectByName('Milo scanned head');
  const forward=head.userData.faceForward/.055;
  const geometry=face.geometry=face.geometry.clone(),p=geometry.attributes.position,n=geometry.attributes.normal;
  const delta=new Float32Array(p.count*3),normalDelta=new Float32Array(p.count*3);
  function deform(x,y,z){
    const cx=x+.11,depth=z-forward,front=smooth(.55,1.7,depth);
    const jaw=(1-smooth(.65,1.25,y))*smooth(-1.25,-.25,y)*front;
    const chin=(1-smooth(.05,.55,y))*smooth(-1.20,-.45,y)*front;
    const cheek=Math.exp(-Math.pow((y-1.03)/.50,2))*smooth(.55,1.18,Math.abs(cx))*front;
    const brow=Math.exp(-Math.pow((y-2.03)/.36,2))*front;
    const temple=smooth(.95,1.5,Math.abs(cx))*smooth(.9,1.8,y)*(1-smooth(2.8,3.4,y));
    const nose=Math.exp(-Math.pow(cx/.48,2))*Math.exp(-Math.pow((y-1.24)/.45,2))*front;
    return new THREE.Vector3(
      x+cx*(jaw*.48+cheek*.24+temple*.16),
      y-jaw*(.72+.22*(1-smooth(-.8,.6,x)))-chin*.35+brow*.11,
      z+jaw*.85+chin*.22+cheek*.43+brow*.63-nose*.35
    );
  }
  // Keep the existing neck anchor at morph slot 0. Add a separate face morph
  // with transformed normals so the enlarged jaw stays smoothly lit.
  const epsilon=.0002,jacobian=new THREE.Matrix3(),normal=new THREE.Vector3();
  for(let i=0;i<p.count;i++){
    const x=p.getX(i),y=p.getY(i),z=p.getZ(i),point=deform(x,y,z);
    delta.set([point.x-x,point.y-y,point.z-z],i*3);
    const dx=deform(x+epsilon,y,z).sub(deform(x-epsilon,y,z)).multiplyScalar(.5/epsilon);
    const dy=deform(x,y+epsilon,z).sub(deform(x,y-epsilon,z)).multiplyScalar(.5/epsilon);
    const dz=deform(x,y,z+epsilon).sub(deform(x,y,z-epsilon)).multiplyScalar(.5/epsilon);
    jacobian.set(dx.x,dy.x,dz.x,dx.y,dy.y,dz.y,dx.z,dy.z,dz.z).invert().transpose();
    normal.fromBufferAttribute(n,i).applyMatrix3(jacobian).normalize();
    normalDelta.set([normal.x-n.getX(i),normal.y-n.getY(i),normal.z-n.getZ(i)],i*3);
  }
  const morphIndex=geometry.morphAttributes.position.length;
  geometry.morphAttributes.position.push(new THREE.Float32BufferAttribute(delta,3));
  geometry.morphAttributes.normal.push(new THREE.Float32BufferAttribute(normalDelta,3));
  geometry.morphTargetsRelative=true;face.updateMorphTargets();
  face.morphTargetInfluences[0]=root.userData.neckProtraction?.weight??0;
  const colorAmount={value:0},formAmount={value:0},material=face.material,previous=material.onBeforeCompile;
  const oldKey=material.customProgramCacheKey();
  material.onBeforeCompile=function(shader,...args){
    previous.call(this,shader,...args);shader.uniforms.monsterFaceColor=colorAmount;shader.uniforms.monsterFaceForm=formAmount;
    shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vCreatureFace;')
      .replace('#include <begin_vertex>','#include <begin_vertex>\nvCreatureFace=position;');
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nuniform float monsterFaceColor;uniform float monsterFaceForm;varying vec3 vCreatureFace;')
      .replace('#include <color_fragment>',`#include <color_fragment>
        float mottling=.5+.5*sin(vCreatureFace.x*19.+vCreatureFace.y*12.)*sin(vCreatureFace.z*17.);
        float grooves=pow(.5+.5*sin(vCreatureFace.x*13.+vCreatureFace.y*9.+sin(vCreatureFace.y*14.+vCreatureFace.z*5.)*2.),8.);
        vec3 hide=mix(vec3(.12,.15,.075),vec3(.045,.062,.035),grooves*.65+mottling*.20);
        diffuseColor.rgb=mix(diffuseColor.rgb,hide,monsterFaceColor*.96);
        vec2 eyeOffset=vec2((abs(vCreatureFace.x+.11)-.66)/.46,(vCreatureFace.y-1.58)/.19);
        float socketMask=(1.-smoothstep(.65,1.,length(eyeOffset)))*smoothstep(1.6,2.1,vCreatureFace.z);
        diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.008,.014,.006),socketMask*monsterFaceForm);
        float mouth=1.-smoothstep(.72,1.,length(vec2((vCreatureFace.x+.11)/.90,(vCreatureFace.y-.42)/.19)));
        mouth*=smoothstep(2.0,2.4,vCreatureFace.z);
        diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.009,.013,.008),mouth*monsterFaceForm);
      `);
  };
  material.customProgramCacheKey=()=>`${oldKey}-monster-face-v2`;material.needsUpdate=true;

  const ridges=new THREE.Group();ridges.name='Curtis creature facial plates';head.add(ridges);
  const hide=new THREE.MeshStandardMaterial({color:'#60684a',roughness:.88});
  const socket=new THREE.MeshStandardMaterial({color:'#141b12',roughness:.85});
  const eyeMat=new THREE.MeshStandardMaterial({color:'#b8ab67',roughness:.46});
  const toothMat=new THREE.MeshStandardMaterial({color:'#9c9d7b',roughness:.82});
  const parts=[];
  function addPart(name,rest,scale,mat,rotation=0){
    const shape=name.includes('tooth')?new RoundedBoxGeometry(2,2,2,2,.23):new THREE.SphereGeometry(1,24,16);
    const mesh=new THREE.Mesh(shape,mat);mesh.name=name;mesh.castShadow=true;mesh.rotation.z=rotation;
    ridges.add(mesh);parts.push({mesh,rest:new THREE.Vector3(...rest),scale:new THREE.Vector3(...scale)});return mesh;
  }
  for(const side of [-1,1]){
    addPart('Broad brow ridge',[side*.78-.11,2.02,forward+2.04],[.70,.12,.10],hide,side*.12);
    addPart('Cheek carapace',[side*1.29-.11,.94,forward+1.47],[.24,.42,.08],hide,-side*.20);
    addPart('Sunken eye socket',[side*.66-.11,1.58,forward+2.13],[.43,.17,.10],socket,side*.10);
    addPart('Narrow creature eye',[side*.66-.11,1.57,forward+2.24],[.24,.067,.035],eyeMat,side*.10);
    addPart('Split chin plate',[side*.43-.11,-.16,forward+1.96],[.51,.25,.14],hide,side*.20);
  }
  addPart('Flattened nasal bridge',[-.11,1.30,forward+2.37],[.33,.48,.12],hide);
  // Broad, worn dental plates emphasize the widened mouth without long fangs.
  for(let i=0;i<6;i++){
    const x=-.73+i*.245;
    addPart('Blunt upper tooth',[x,.53,forward+2.40],[.115,.12,.09],toothMat);
    addPart('Blunt lower tooth',[x,.32,forward+2.40],[.12,.13,.09],toothMat);
  }
  // Seat facial features on the actual sculpted surface, especially the eyes:
  // fixed guessed depths can bury them beneath the expanding brow.
  const startGeometry=geometry.clone(),endGeometry=geometry.clone();
  startGeometry.morphAttributes={};endGeometry.morphAttributes={};
  const endPositions=endGeometry.attributes.position;
  for(let i=0;i<p.count;i++)endPositions.setXYZ(i,p.getX(i)+delta[i*3],p.getY(i)+delta[i*3+1],p.getZ(i)+delta[i*3+2]);
  endGeometry.computeBoundingSphere();
  const probeMaterial=new THREE.MeshBasicMaterial({side:THREE.DoubleSide});
  const startProbe=new THREE.Mesh(startGeometry,probeMaterial),endProbe=new THREE.Mesh(endGeometry,probeMaterial);
  const ray=new THREE.Raycaster(new THREE.Vector3(),new THREE.Vector3(0,0,-1));
  function surfaceDepth(mesh,point){
    ray.ray.origin.set(point.x,point.y,10);
    return ray.intersectObject(mesh,false)[0]?.point.z??point.z;
  }
  for(const part of parts){
    const offset=part.mesh.name==='Narrow creature eye'?.18:part.mesh.name.includes('socket')?.025:part.mesh.name.includes('tooth')?.035:-.045;
    part.rest.z=surfaceDepth(startProbe,part.rest)+offset;
    part.end=deform(part.rest.x,part.rest.y,part.rest.z);
    part.end.z=surfaceDepth(endProbe,part.end)+offset;
  }
  startGeometry.dispose();endGeometry.dispose();probeMaterial.dispose();
  const humanEyes=[];head.traverse(o=>{if(o.name==='Fitted Milo eye surface')humanEyes.push(o);});
  const afro=head.getObjectByName('Visitor afro');
  return {update(amount,surfaceEnabled){
    face.morphTargetInfluences[morphIndex]=amount;colorAmount.value=surfaceEnabled?amount:0;formAmount.value=amount;
    const armor=smooth(.20,.92,amount);ridges.visible=armor>.002;
    for(const part of parts){
      part.mesh.position.copy(part.rest).lerp(part.end,amount);
      part.mesh.scale.copy(part.scale).multiplyScalar(armor);
    }
    // The skull comes forward while the characteristic hair mass remains.
    if(afro)afro.scale.set(1-.10*amount,1-.12*amount,1-.04*amount);
    humanEyes.forEach(eye=>{eye.visible=amount<.60;});
  }};
}
