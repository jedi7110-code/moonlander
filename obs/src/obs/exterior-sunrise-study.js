import * as THREE from 'three';

// Fraction of a small stellar disc above a locally straight planetary limb.
// Continuous area, rather than a binary ray test, prevents a flashing flare.
export function stellarDiscVisibility(clearance,radius){
  const x=THREE.MathUtils.clamp(clearance/radius,-1,1);
  return (Math.acos(-x)+x*Math.sqrt(Math.max(0,1-x*x)))/Math.PI;
}

// Study only. Angular units keep this lens response stable across resolutions.
export function createSunriseStudy(){
  const uniforms={sunDirection:{value:new THREE.Vector3()},
    visibility:{value:0},aspect:{value:16/9},tanHalfFov:{value:1},gain:{value:.65},spread:{value:1}};
  const sunRadius=.0035;
  const material=new THREE.ShaderMaterial({uniforms,transparent:true,blending:THREE.AdditiveBlending,depthTest:false,depthWrite:false,
    vertexShader:`varying vec2 screen;void main(){screen=position.xy;gl_Position=vec4(position.xy,0.,1.);}`,
    fragmentShader:`
      varying vec2 screen;
      uniform vec3 sunDirection;
      uniform float visibility,aspect,tanHalfFov,gain,spread;
      void main(){
        vec2 source=sunDirection.xy/(-sunDirection.z)/vec2(aspect,1.)/tanHalfFov;
        vec2 d=(screen-source)*vec2(aspect,1.);
        // Unresolved, overexposed lens response: no hard-edged stellar disc.
        // The exposed sliver feeds a soft white bloom across the planetary edge.
        float whiteBloom=exp(-pow(length(d*vec2(.85,1.3))/.023,1.35))*4.8;
        float halo=exp(-length(d)/.065)*.24;
        float streak=exp(-abs(d.x)/.27-pow(d.y/.0035,2.))*.36;
        vec3 local=(vec3(1.,.94,.83)*whiteBloom+vec3(1.,.58,.25)*(halo+streak))*visibility*gain;
        // Broad lens scatter lifts black levels across the image. This is
        // optical veiling glare, so it also spills over the planet silhouette.
        // No solid stellar disc or world-space fog is drawn.
        float veil=exp(-length(d*vec2(.55,.8))/.95)*.10;
        float wideHalo=exp(-pow(length(d*vec2(.7,1.))/.65,1.2))*.24;
        float wideBloom=exp(-pow(length(d*vec2(.8,1.15))/.16,1.25))*2.8;
        float wideStreak=exp(-abs(d.x)/1.3-pow(d.y/.012,2.))*.34;
        float exposure=clamp(visibility/.282,0.,1.);
        vec3 wide=(vec3(1.,.87,.66)*wideBloom+vec3(1.,.50,.18)*(veil+wideHalo)+vec3(1.,.24,.055)*wideStreak)*exposure*gain;
        vec3 color=mix(local,wide,spread);
        gl_FragColor=vec4(color,1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`});
  const mesh=new THREE.Mesh(new THREE.PlaneGeometry(2,2),material);mesh.frustumCulled=false;mesh.renderOrder=10000;mesh.name='Study / restrained planetary sunrise';
  const center=new THREE.Vector3(),tangent=new THREE.Vector3(),sun=new THREE.Vector3();
  return{mesh,update(camera,planet,time,{enabled=true,strength=.65,spread=true,direction=[.62,-.78],reveal=[44.5,52.5]}={}){
    camera.updateMatrixWorld(true);planet.updateWorldMatrix(true,false);
    const radius=planet.geometry.parameters.radius*planet.scale.x;
    center.copy(planet.position).applyMatrix4(camera.matrixWorldInverse);
    const angularRadius=Math.asin(radius/center.length());center.normalize();
    // Camera-space limb direction: 02 lower-right, 04 upper-left shadow edge.
    tangent.set(direction[0],direction[1],0);
    tangent.addScaledVector(center,-tangent.dot(center)).normalize();
    const rise=THREE.MathUtils.smoothstep(time,...reveal);
    // Hold most of the star behind the limb; even at the end only a sliver
    // contributes light. It never becomes a detached, round dot in space.
    const clearance=THREE.MathUtils.lerp(-1.5,-.35,rise)*sunRadius;
    const angle=angularRadius+clearance;
    sun.copy(center).multiplyScalar(Math.cos(angle)).addScaledVector(tangent,Math.sin(angle));
    uniforms.sunDirection.value.copy(sun);
    uniforms.visibility.value=stellarDiscVisibility(clearance,sunRadius);
    uniforms.spread.value=spread?1:0;
    uniforms.aspect.value=camera.aspect;uniforms.tanHalfFov.value=Math.tan(THREE.MathUtils.degToRad(camera.fov/2));uniforms.gain.value=strength;
    mesh.visible=enabled;return uniforms.visibility.value;
  },lightDirection(camera,target){return target.copy(sun).transformDirection(camera.matrixWorld);},
    dispose(){mesh.geometry.dispose();material.dispose();}};
}
