// Cabin-space lighting: a ceiling power-up mask plus always-on practical spill.
// No extra real-time lights or draw calls, including in Quest's culled-light mode.
import {LADDER_LIGHT_LAYOUT,EVA_SPOT_LAYOUT} from './lighting.js';
export const STARTUP_LIGHT_DELAY=1;
export const STARTUP_LIGHT_SECONDS=1.6;
export const STARTUP_TOTAL_SECONDS=STARTUP_LIGHT_DELAY+STARTUP_LIGHT_SECONDS;
export const STARTUP_CIRCUITS=24;
const clamp=x=>Math.max(0,Math.min(1,x));
const smooth=x=>{const t=clamp(x);return t*t*(3-2*t);};
const random=id=>{const n=Math.sin(id*127.1+37.7)*43758.5453;return n-Math.floor(n);};
export const circuitDelay=id=>random(id)*.065;

// Shader compilation alone does not upload the live poses/textures or warm the
// first shadow draw. Keep that expensive real draw behind the loading screen,
// then present a fresh dark frame before starting the short lighting clock.
export async function revealStartupScene({draw,reveal,nextFrame=()=>new Promise(resolve=>requestAnimationFrame(resolve))}){
  draw();
  await nextFrame();
  draw();reveal();
  await nextFrame();
}

export function circuitPower(id,time,reducedMotion=false){
  if(time>=STARTUP_TOTAL_SECONDS)return 1;
  const delay=circuitDelay(id),age=time-STARTUP_LIGHT_DELAY-delay;
  if(age<=0)return 0;
  if(reducedMotion)return smooth(age/(STARTUP_LIGHT_SECONDS-delay));
  // Power arrives everywhere together. Only the tubes' brief starter response
  // differs, by milliseconds; no room-by-room switching or theatrical delay.
  const second=.23+random(id+31)*.025,settle=.40+random(id+79)*.065;
  if(age<.15)return .68*smooth(age/.025)*(1-smooth((age-.085)/.065));
  if(age>=second&&age<second+.12)return .82*smooth((age-second)/.025)*(1-smooth((age-second-.07)/.05));
  // Keep the starter flashes brief, then settle over the requested 1.6 seconds.
  // All circuits reach full output at the same deadline despite tiny jitter.
  return smooth((age-settle)/(STARTUP_LIGHT_SECONDS-delay-settle));
}

const vertexHeader=`
  uniform float cabinBootActive;
  varying vec3 vCabinBootWorld;
`;
const vertexPosition=`
  vec4 bootPosition = vec4(transformed, 1.0);
  #ifdef USE_INSTANCING
    bootPosition = instanceMatrix * bootPosition;
  #endif
  vCabinBootWorld = (modelMatrix * bootPosition).xyz;
`;
const fragmentHeader=`
  uniform float cabinBootActive;
  uniform float cabinBootLevels[24];
  uniform float cabinBootRoomLevels[24];
  varying vec3 vCabinBootWorld;
  float cabinGrowPower() {
    vec3 p = vCabinBootWorld;
    float row = clamp(floor((p.y - 0.78) / 0.62 + 0.5), 0.0, 2.0);
    float height = p.y - (0.78 + row * 0.62);
    return (1.0 - smoothstep(1.03, 1.42, abs(p.x + 7.09)))
      * (1.0 - smoothstep(0.24, 0.42, abs(height)))
      * (1.0 - smoothstep(0.36, 0.85, abs(p.z + 0.66)));
  }
  float cabinBootPower() {
    float column = clamp((vCabinBootWorld.x + 10.65) / 3.05, 0.0, 7.0);
    float deck = clamp(floor((vCabinBootWorld.y + 0.08) / 3.392), 0.0, 2.0);
    #ifdef CABIN_BOOT_FIXTURE
      return mix(0.002, 1.0, cabinBootLevels[int(deck * 8.0 + floor(column + 0.5))]);
    #else
      float left = floor(column);
      float a = cabinBootRoomLevels[int(deck * 8.0 + left)];
      float b = cabinBootRoomLevels[int(deck * 8.0 + min(left + 1.0, 7.0))];
      return max(cabinGrowPower(), mix(0.025, 1.0, mix(a, b, smoothstep(0.0, 1.0, fract(column)))));
    #endif
  }
  #ifdef CABIN_PRACTICAL_SPILL
    float cabinSoftPool(vec3 offset) {
      float falloff = max(0.0, 1.0 - dot(offset, offset));
      return falloff * falloff;
    }
    float cabinLadderSpill(vec3 p, vec3 surfaceNormal) {
      // Evaluate just the nearest pair, not 24 additional real-time lights.
      // Finite, rounded pools leave a dim interval between fixture heights.
      if (abs(p.x) > 1.3 || abs(p.z - ${LADDER_LIGHT_LAYOUT.sourceZ.toFixed(2)}) > 0.8) return 0.0;
      float row = clamp(floor((p.y - ${LADDER_LIGHT_LAYOUT.firstY.toFixed(2)}) / ${LADDER_LIGHT_LAYOUT.spacing.toFixed(2)} + 0.5), 0.0, ${(LADDER_LIGHT_LAYOUT.count-1).toFixed(1)});
      float lightY = ${LADDER_LIGHT_LAYOUT.firstY.toFixed(2)} + row * ${LADDER_LIGHT_LAYOUT.spacing.toFixed(2)} + (${LADDER_LIGHT_LAYOUT.sourceYOffset.toFixed(2)});
      vec3 left = vec3(-${LADDER_LIGHT_LAYOUT.sourceX.toFixed(2)}, lightY, ${LADDER_LIGHT_LAYOUT.sourceZ.toFixed(2)}) - p;
      vec3 right = vec3(${LADDER_LIGHT_LAYOUT.sourceX.toFixed(2)}, lightY, ${LADDER_LIGHT_LAYOUT.sourceZ.toFixed(2)}) - p;
      float leftFacing = max(0.0, dot(surfaceNormal, left / max(length(left), 0.001)));
      float rightFacing = max(0.0, dot(surfaceNormal, right / max(length(right), 0.001)));
      return cabinSoftPool(left / vec3(0.82, 0.62, 0.80)) * leftFacing
        + cabinSoftPool(right / vec3(0.82, 0.62, 0.80)) * rightFacing;
    }
    float cabinEVASpill(vec3 p, vec3 surfaceNormal) {
      // Three fixed overhead spots: evaluate only the closest suit's cone.
      // Masked to the upper deck so no light leaks through into the cabin below.
      if (p.x < 7.15 || p.x > 10.95 || p.y < ${EVA_SPOT_LAYOUT.floorY.toFixed(3)} || p.y > ${(EVA_SPOT_LAYOUT.floorY+EVA_SPOT_LAYOUT.sourceY).toFixed(3)}) return 0.0;
      float slot = clamp(floor((p.x - ${EVA_SPOT_LAYOUT.suitX[0].toFixed(2)}) / ${(EVA_SPOT_LAYOUT.suitX[1]-EVA_SPOT_LAYOUT.suitX[0]).toFixed(2)} + 0.5), 0.0, 2.0);
      vec3 source = vec3(${EVA_SPOT_LAYOUT.suitX[0].toFixed(2)} + slot * ${(EVA_SPOT_LAYOUT.suitX[1]-EVA_SPOT_LAYOUT.suitX[0]).toFixed(2)}, ${(EVA_SPOT_LAYOUT.floorY+EVA_SPOT_LAYOUT.sourceY).toFixed(3)}, ${EVA_SPOT_LAYOUT.sourceZ.toFixed(2)});
      vec3 delta = source - p;
      float distanceToLight = length(delta);
      vec3 toLight = delta / max(distanceToLight, 0.001);
      vec3 reverseAxis = normalize(vec3(0.0, ${(EVA_SPOT_LAYOUT.sourceY-EVA_SPOT_LAYOUT.targetY).toFixed(2)}, ${(EVA_SPOT_LAYOUT.sourceZ-EVA_SPOT_LAYOUT.targetZ).toFixed(2)}));
      float cone = smoothstep(${Math.cos(EVA_SPOT_LAYOUT.outerAngle*Math.PI/180).toFixed(6)}, ${Math.cos(EVA_SPOT_LAYOUT.innerAngle*Math.PI/180).toFixed(6)}, dot(toLight, reverseAxis));
      float fade = 1.0 - smoothstep(0.8, ${EVA_SPOT_LAYOUT.range.toFixed(2)}, distanceToLight);
      return cone * fade * fade * max(0.0, dot(surfaceNormal, toLight));
    }
    vec3 cabinPracticalSpill(vec3 surfaceNormal) {
      vec3 p = vCabinBootWorld;
      // The cutaway removes the near wall and its orange emergency fixtures.
      // Retain their soft pools on the INBOARD floor, not glowing front fascia.
      float deck = clamp(floor((p.y + 0.08) / 3.392), 0.0, 2.0);
      float height = p.y - deck * 3.392;
      float spacing = abs(mod(p.x + 1.4, 2.8) - 1.4);
      float emergency = cabinSoftPool(vec3(spacing / 1.65, height / 0.66, (p.z - 2.55) / 1.75));
      emergency *= smoothstep(0.7, 1.05, abs(p.x)) * (1.0 - smoothstep(12.6, 13.0, abs(p.x)));
      emergency *= 1.0 - smoothstep(2.52, 2.75, p.z);
      // The access shaft is on a separate, steady safety circuit.
      float shaft = (1.0 - smoothstep(0.38, 0.95, abs(p.x))) * (1.0 - smoothstep(0.35, 1.6, abs(p.z - 0.15)));
      shaft *= smoothstep(-0.08, 0.12, p.y) * (1.0 - smoothstep(13.1, 13.4, p.y));
      // Three console screens and the tall monitor stack immediately to their
      // right. Rounded falloff keeps the green glow off unrelated rooms.
      vec3 consoleOffset = vec3(max(abs(p.x + 8.67) - 2.22, 0.0), max(abs(p.y - 8.514) - 0.32, 0.0), p.z + 0.45);
      vec3 monitorOffset = vec3(max(abs(p.x + 4.57) - 0.55, 0.0), max(abs(p.y - 8.204) - 0.70, 0.0), p.z + 1.30);
      // A recessed screen cannot light a bezel whose front faces AWAY from it.
      // Keep only the cosine-weighted bounce on surfaces facing the glass.
      vec3 consoleSource = vec3(clamp(p.x, -10.8, -6.54), clamp(p.y, 8.209, 8.819), -0.45);
      vec3 monitorSource = vec3(clamp(p.x, -5.15, -3.99), clamp(p.y, 7.439, 8.969), -1.30);
      float consoleFacing = max(0.0, dot(surfaceNormal, normalize(consoleSource - p + vec3(0.0, 0.00001, 0.0))));
      float monitorFacing = max(0.0, dot(surfaceNormal, normalize(monitorSource - p + vec3(0.0, 0.00001, 0.0))));
      float screens = max(cabinSoftPool(consoleOffset / vec3(1.35, 1.25, 1.75)) * consoleFacing, cabinSoftPool(monitorOffset / vec3(1.15, 1.10, 1.75)) * monitorFacing);
      // Spill from the grow shelf reaches the near aisle floor, not just leaves.
      float growFloor = cabinSoftPool(vec3((p.x + 7.09) / 2.1, p.y / 0.30, (p.z - 0.75) / 2.0));
      growFloor *= max(0.0, surfaceNormal.y);
      return vec3(0.85, 0.58, 0.25) * emergency + vec3(0.16, 0.12, 0.075) * shaft + vec3(0.90, 0.80, 0.63) * cabinLadderSpill(p, surfaceNormal) + vec3(1.35, 1.18, 0.94) * cabinEVASpill(p, surfaceNormal) + vec3(0.028, 0.15, 0.055) * screens + vec3(0.35, 0.42, 0.24) * cabinGrowPower() + vec3(0.95, 1.08, 0.85) * growFloor;
    }
  #endif
`;

export class CabinStartupLighting {
  constructor(roots,{reducedMotion=false,start=true}={}){
    this.reducedMotion=reducedMotion;this.time=0;this.done=false;this.materials=[];
    this.active={value:1};this.levels={value:new Float32Array(STARTUP_CIRCUITS)};
    this.roomLevels={value:new Float32Array(STARTUP_CIRCUITS)};
    const materials=new Set();
    for(const root of roots)root?.traverse(mesh=>{
      if(!mesh.isMesh||/toon outline$/.test(mesh.name))return;
      for(const material of Array.isArray(mesh.material)?mesh.material:[mesh.material]){
        if(material.userData.cabinAlwaysPowered)continue;
        if(material.isMeshStandardMaterial||material.isMeshToonMaterial||material.isMeshBasicMaterial)materials.add(material);
      }
    });
    for(const material of materials){
      const compile=material.onBeforeCompile,key=material.customProgramCacheKey,baseKey=key.call(material);
      const fixture=material.emissiveIntensity>1||/diffuser|light lens/i.test(material.name);
      const spill=!fixture&&!material.isMeshBasicMaterial;
      const effect=this;
      const wrapped=function(shader,renderer){
        compile.call(this,shader,renderer);
        // Custom ink shaders can intentionally omit the standard output chunks.
        if(!shader.vertexShader.includes('#include <project_vertex>')||!shader.fragmentShader.includes('#include <tonemapping_fragment>'))return;
        shader.uniforms.cabinBootActive=effect.active;shader.uniforms.cabinBootLevels=effect.levels;shader.uniforms.cabinBootRoomLevels=effect.roomLevels;
        shader.vertexShader=vertexHeader+shader.vertexShader.replace('#include <project_vertex>','#include <project_vertex>\n'+vertexPosition);
        shader.fragmentShader=(fixture?'#define CABIN_BOOT_FIXTURE\n':'')+(spill?'#define CABIN_PRACTICAL_SPILL\n':'')+fragmentHeader+shader.fragmentShader.replace('#include <tonemapping_fragment>',
          `if (cabinBootActive > 0.5) gl_FragColor.rgb *= cabinBootPower();
          #ifdef CABIN_PRACTICAL_SPILL
            gl_FragColor.rgb += diffuseColor.rgb * cabinPracticalSpill(inverseTransformDirection(normal, viewMatrix));
          #endif
          #include <tonemapping_fragment>`);
      };
      material.onBeforeCompile=wrapped;material.customProgramCacheKey=()=>baseKey+'-cabin-boot-v7-'+Number(fixture)+'-'+Number(spill);material.needsUpdate=true;
      this.materials.push({material,compile,key,wrapped});
    }
    if(!start)this.update(STARTUP_TOTAL_SECONDS);
  }
  restart(reducedMotion=this.reducedMotion){
    this.reducedMotion=reducedMotion;this.time=0;this.done=false;
    this.active.value=1;this.levels.value.fill(0);this.roomLevels.value.fill(0);
    // Reuse the uniform objects already bound to cached WebGL programs.
  }
  update(dt){
    if(this.done)return;
    // Use visible wall time, not the physics step: slow frames must not turn a
    // one-second starter response into a long sequence on Quest.
    if(Number.isFinite(dt))this.time=Math.min(STARTUP_TOTAL_SECONDS,this.time+Math.max(0,dt));
    for(let i=0;i<STARTUP_CIRCUITS;i++){
      const power=circuitPower(i,this.time,this.reducedMotion);this.levels.value[i]=power;
      // Most visible flicker belongs to the tubes, not blackouts of the walls.
      this.roomLevels.value[i]=this.reducedMotion?power:.88*smooth((this.time-STARTUP_LIGHT_DELAY)/STARTUP_LIGHT_SECONDS)+.12*power;
    }
    if(this.time>=STARTUP_TOTAL_SECONDS){this.done=true;this.active.value=0;}
    // Keep the compiled program: no end-of-intro shader compilation spike.
    // Only the ceiling mask is bypassed; safety and screen spill stay on.
  }
  dispose(){
    this.active.value=0;this.done=true;
    for(const {material,compile,key,wrapped} of this.materials){
      if(material.onBeforeCompile!==wrapped)continue;
      material.onBeforeCompile=compile;material.customProgramCacheKey=key;material.needsUpdate=true;
    }
    this.materials=[];
  }
}
