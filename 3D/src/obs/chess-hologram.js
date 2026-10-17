import * as THREE from 'three';

export const CHESS_HOLOGRAM_SETTINGS=Object.freeze({translucency:30,glow:70});

// A soft annulus on one quad avoids coplanar ring triangles and thin hard edges.
// Screen-space derivatives keep both edges filtered even at grazing angles.
export function createChessFootGlowMaterial(color=0x6d9e78,glow=CHESS_HOLOGRAM_SETTINGS.glow){
  return new THREE.ShaderMaterial({
    transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,
    extensions:{derivatives:true},
    polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1,
    uniforms:{tint:{value:new THREE.Color(color)},strength:{value:.25*Math.sqrt(THREE.MathUtils.clamp(glow,0,100)/100)}},
    vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader:[
      'varying vec2 vUv;uniform vec3 tint;uniform float strength;',
      'void main(){',
      'float r=length(vUv-0.5)*2.0;',
      'float feather=max(0.045,fwidth(r)*1.5);',
      'float ring=1.0-smoothstep(0.055-feather,0.055+feather,abs(r-0.60));',
      'float halo=exp(-20.0*(r-0.60)*(r-0.60))*(1.0-smoothstep(0.85,1.0,r));',
      'gl_FragColor=vec4(tint,(ring*1.8+halo*0.18)*strength);',
      '#include <tonemapping_fragment>',
      '#include <colorspace_fragment>',
      '}'
    ].join('\n')
  });
}

// The study and the board share the same surface and slider scales.
export function createChessHologram({
  color=0x477b57,emissive=0x245035,tint=new THREE.Color(.20,.48,.26),
  translucency=CHESS_HOLOGRAM_SETTINGS.translucency,glow=CHESS_HOLOGRAM_SETTINGS.glow,
}={}){
  const uniforms={holoOpacity:{value:1-translucency/100},holoGlow:{value:glow/100},holoTint:{value:tint}};
  const material=new THREE.MeshPhysicalMaterial({color,emissive,emissiveIntensity:.18,roughness:1,metalness:0,clearcoat:0,specularIntensity:0,transparent:true,depthWrite:false});
  material.onBeforeCompile=shader=>{
    Object.assign(shader.uniforms,uniforms);
    shader.vertexShader='varying vec3 vHoloPosition;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvHoloPosition=transformed;');
    shader.fragmentShader='varying vec3 vHoloPosition;\nuniform float holoOpacity;\nuniform float holoGlow;\nuniform vec3 holoTint;\n'+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <emissivemap_fragment>',[
      '#include <emissivemap_fragment>',
      'float holoRim=pow(1.0-clamp(dot(normal,normalize(vViewPosition)),0.0,1.0),2.2);',
      'float holoScan=pow(0.5+0.5*sin(vHoloPosition.y*205.0),18.0);',
      'totalEmissiveRadiance+=holoTint*holoGlow*(holoRim*2.1+holoScan*0.10+0.06);'
    ].join('\n'));
    shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>','diffuseColor.a=clamp(holoOpacity+(1.0-holoOpacity)*holoRim*0.65,0.1,1.0);\n#include <opaque_fragment>');
  };
  material.customProgramCacheKey=()=> 'chess-hologram-2';
  return{material,uniforms};
}
