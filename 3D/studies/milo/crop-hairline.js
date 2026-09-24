import * as THREE from 'three';
import {createHair,HAIRLINE_GLSL} from '../../src/obs/hair.js';

// The marked reference carries the horizontal side edge forward, then turns
// upward into the frontal hairline. Length and the central edge stay fixed.
const TEMPLE_RECESS=.16;
const TEMPLE_STEP={side:2.22,front:3.02,start:.82,end:1.38};
export function studyCropHairline(x,z){
  const s=THREE.MathUtils.smoothstep,side=Math.abs(x);
  const temples=TEMPLE_RECESS*Math.exp(-(((side-.98)/.40)**2))*s(z,.15,1.2);
  const original=1.20+s(z,-1.1,1.65)*1.70+s(side,.95,1.65)*.18+temples;
  const step=THREE.MathUtils.lerp(TEMPLE_STEP.side,TEMPLE_STEP.front,s(z,TEMPLE_STEP.start,TEMPLE_STEP.end));
  const edge=THREE.MathUtils.lerp(original,step,s(side,.75,1.20)*s(z,-.45,.05));
  return Math.max(edge,2.22*s(side,1.2,1.6));
}

export function applyStudyCropHairline(head){
  const previous=head.getObjectByName('Milo hair crop'),face=head.getObjectByName('Milo scanned head');
  const forward=head.userData.faceForward/head.scale.x;
  const scalp=face.geometry.clone();scalp.translate(0,0,-forward);
  const crop=createHair(scalp,'crop',{hairline:studyCropHairline});scalp.dispose();
  crop.position.copy(previous.position);head.remove(previous);head.add(crop);
  previous.geometry.dispose();previous.material.dispose();
  const compile=face.material.onBeforeCompile,key=face.material.customProgramCacheKey();
  face.material.onBeforeCompile=(shader,renderer)=>{
    compile.call(face.material,shader,renderer);
    shader.fragmentShader=shader.fragmentShader.replace(HAIRLINE_GLSL,`
      float cropX=abs(vHeadPosition.x),cropZ=vHeadPosition.z-${forward.toFixed(8)};
      float temples=${TEMPLE_RECESS.toFixed(3)}*exp(-pow((cropX-.98)/.40,2.0))*smoothstep(.15,1.2,cropZ);
      float hairline=1.20+smoothstep(-1.1,1.65,cropZ)*1.70
        +smoothstep(.95,1.65,cropX)*.18+temples;
      float templeStep=mix(${TEMPLE_STEP.side.toFixed(3)},${TEMPLE_STEP.front.toFixed(3)},
        smoothstep(${TEMPLE_STEP.start.toFixed(3)},${TEMPLE_STEP.end.toFixed(3)},cropZ));
      hairline=mix(hairline,templeStep,smoothstep(.75,1.20,cropX)*smoothstep(-.45,.05,cropZ));
      hairline=max(hairline,2.22*smoothstep(1.2,1.6,cropX));
    `).replace('smoothstep(hairline - 0.16, hairline + 0.10, vHeadPosition.y)',
      'smoothstep(hairline - 0.035, hairline + 0.10, vHeadPosition.y)');
  };
  face.material.customProgramCacheKey=()=>key+'-study-crop-m-hairline-v3';
  face.material.needsUpdate=true;
  return crop;
}
