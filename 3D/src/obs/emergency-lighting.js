// The toon bands discard light chroma, so apply the emergency circuit in the
// cabin materials, before tone mapping. Surface normals still shape the red
// ceiling spill; screens, ink and the space background keep their own output.
// Uniform-only changes add no lights, draw calls or shader recompilation.
import {CABIN_SOUNDS} from './sound-library.js';

export const EMERGENCY_LIGHT_PERIOD=CABIN_SOUNDS.hatchAlarm.duration;
export const EMERGENCY_LIGHT_BRIGHT_TIME=.30;
export const EMERGENCY_LIGHT_FADE={on:.35,off:1.2};
const smooth=t=>t*t*(3-2*t);
export function emergencyLightPower(time,reducedMotion=false){
  if(reducedMotion)return .82;
  const phase=((time%EMERGENCY_LIGHT_PERIOD)+EMERGENCY_LIGHT_PERIOD)%EMERGENCY_LIGHT_PERIOD;
  // The recording has a quick attack, a strong first half-second and a
  // decaying tail. Keep the dim interval until its next three-second warning.
  const attack=smooth(Math.min(1,phase/.12)),release=smooth(Math.max(0,Math.min(1,(phase-.55)/1.05)));
  return .15+1.10*attack*(1-release);
}

export class CabinEmergencyLighting {
  constructor(roots,{reducedMotion=false,workCenter=null}={}){
    this.reducedMotion=reducedMotion;this.time=0;this.level=0;this.fault=false;this.disposed=false;
    this.amount={value:0};this.power={value:emergencyLightPower(0,reducedMotion)};this.workCenter={value:workCenter?.clone()};this.materials=[];
    const materials=new Set();
    for(const root of roots)root?.traverse(mesh=>{
      if(!mesh.isMesh||/toon outline$/.test(mesh.name))return;
      for(const material of [].concat(mesh.material??[]))materials.add(material);
    });
    for(const material of materials){
      const fixture=material.emissiveIntensity>1||/diffuser|light lens/i.test(material.name);
      const surface=material.isMeshStandardMaterial||material.isMeshToonMaterial;
      if(!surface&&!(material.isMeshBasicMaterial&&fixture))continue;
      const workLight=Boolean(workCenter)&&surface&&!fixture;
      const compile=material.onBeforeCompile,key=material.customProgramCacheKey,baseKey=key.call(material),effect=this;
      const wrapped=function(shader,renderer){
        compile.call(this,shader,renderer);
        if(shader.uniforms.cabinEmergencyAmount===effect.amount||!shader.fragmentShader.includes('#include <tonemapping_fragment>')||!shader.vertexShader.includes('#include <project_vertex>'))return;
        shader.uniforms.cabinEmergencyAmount=effect.amount;shader.uniforms.cabinEmergencyPower=effect.power;
        if(workLight){
          shader.uniforms.cabinEmergencyWorkCenter=effect.workCenter;
          // Use the deformed world position so hands and instanced fittings
          // share the same small, fixed pool around the hatch service point.
          shader.vertexShader='varying vec3 vCabinEmergencyWorld;\n'+shader.vertexShader.replace('#include <project_vertex>',`#include <project_vertex>
            vec4 emergencyPosition = vec4(transformed, 1.0);
            #ifdef USE_INSTANCING
              emergencyPosition = instanceMatrix * emergencyPosition;
            #endif
            vCabinEmergencyWorld = (modelMatrix * emergencyPosition).xyz;`);
          shader.fragmentShader='varying vec3 vCabinEmergencyWorld;\nuniform vec3 cabinEmergencyWorkCenter;\n'+shader.fragmentShader;
        }
        shader.fragmentShader='uniform float cabinEmergencyAmount;\nuniform float cabinEmergencyPower;\n'+shader.fragmentShader.replace('#include <tonemapping_fragment>',`
          if (cabinEmergencyAmount > 0.0) {
            ${fixture?`
              float lamp = max(max(gl_FragColor.r, gl_FragColor.g), gl_FragColor.b);
              vec3 emergencyLit = vec3(1.0, 0.025, 0.012) * lamp * cabinEmergencyPower;
            `:`
              vec3 emergencyNormal = inverseTransformDirection(normal, viewMatrix);
              float ceilingFacing = 0.28 + 0.72 * max(0.0, dot(emergencyNormal, normalize(vec3(-0.25, 0.80, 0.50))));
              vec3 emergencyLit = gl_FragColor.rgb * vec3(0.30, 0.16, 0.14)
                + diffuseColor.rgb * vec3(1.0, 0.025, 0.012) * cabinEmergencyPower * ceilingFacing;
              ${workLight?`
                // Retain the normally shaded, warm task light at the hands.
                // It stays steady while the surrounding red circuit pulses.
                vec3 workOffset = (vCabinEmergencyWorld - cabinEmergencyWorkCenter) / vec3(0.70, 0.55, 0.65);
                float workPool = 1.0 - smoothstep(0.25, 1.0, length(workOffset));
                emergencyLit = mix(emergencyLit, gl_FragColor.rgb, workPool);
              `:''}
            `}
            gl_FragColor.rgb = mix(gl_FragColor.rgb, emergencyLit, cabinEmergencyAmount);
          }
          #include <tonemapping_fragment>`);
      };
      material.onBeforeCompile=wrapped;material.customProgramCacheKey=()=>baseKey+'-cabin-emergency-v2-'+Number(fixture)+'-'+Number(workLight);material.needsUpdate=true;
      this.materials.push({material,compile,key,wrapped});
    }
  }
  update(dt,environment,audioPhase=null){
    if(this.disposed)return;
    const fault=Boolean(environment?.fault),step=Number.isFinite(dt)?Math.max(0,dt):0;
    if(fault&&!this.fault&&this.level===0)this.time=0;
    this.fault=fault;
    this.level=Math.max(0,Math.min(1,this.level+(fault?step/EMERGENCY_LIGHT_FADE.on:-step/EMERGENCY_LIGHT_FADE.off)));
    if(fault)this.time=Number.isFinite(audioPhase)?((audioPhase%EMERGENCY_LIGHT_PERIOD)+EMERGENCY_LIGHT_PERIOD)%EMERGENCY_LIGHT_PERIOD:(this.time+step)%EMERGENCY_LIGHT_PERIOD;
    this.amount.value=smooth(this.level);
    this.power.value=emergencyLightPower(this.time,this.reducedMotion);
  }
  dispose(){
    this.amount.value=0;this.disposed=true;
    for(const {material,compile,key,wrapped} of this.materials){
      if(material.onBeforeCompile!==wrapped)continue;
      material.onBeforeCompile=compile;material.customProgramCacheKey=key;material.needsUpdate=true;
    }
    this.materials=[];
  }
}
