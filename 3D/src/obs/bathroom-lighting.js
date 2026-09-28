import {Group,MeshBasicMaterial,Vector3} from 'three';
import {box,batchStatic} from './materials.js';

export function createBathroomCeilingLight(m,x,y,type){
  const housing=new Group(),strips=new Group();
  const diffuser=new MeshBasicMaterial({name:`${type} ceiling cove diffuser`,color:0x171c1b,toneMapped:false});
  diffuser.userData.cabinAlwaysPowered=true;diffuser.userData.castShadow=false;
  // Separate the light slot, its lower lip and the ceiling by real depth.
  // End strips fit between the side strips so their corner faces never overlap.
  for(const side of [-1,1]){
    box(housing,m.dark,side*.687,2.451,-2.87,.024,.026,1.50);
    box(strips,diffuser,side*.721,2.477,-2.87,.036,.006,1.58);
    box(housing,m.dark,0,2.451,-2.87+side*.738,1.35,.026,.024);
    box(strips,diffuser,0,2.477,-2.87+side*.772,1.406,.006,.036);
  }
  const root=batchStatic(strips);root.name=`${type} indirect ceiling light`;root.position.set(x,y,0);
  housing.name=`${type} ceiling cove lip`;housing.position.copy(root.position);
  const light={root,housing,diffuser,power:{value:0},origin:{value:new Vector3(x,y,0)}};
  root.userData.bathroomLighting={power:light.power,origin:light.origin};
  return light;
}

export function updateBathroomCeilingLight(light,pose){
  if(!light)return;
  // Occupancy keeps the room lit through closing, use and reopening for exit.
  // Eased opening may round to 1 just before the opening phase has ended.
  const on=pose?.inside||(pose?.opening>=1&&!['open','reopen','close','shut'].includes(pose?.phase));
  light.power.value=on?1:0;
  light.diffuser.color.setRGB(...(on?[1,.89,.70]:[.009,.012,.011]));
}

// Local indirect bounce shares the ceiling's live switch. Evaluate only inside
// the two cubicles; no additional realtime lights, shadow maps or glow planes.
export function applyBathroomLightingShader(shader,rooms){
  if(!rooms.length)return;
  const declarations=[],sections=[];
  rooms.forEach((room,i)=>{
    shader.uniforms[`bathroomPower${i}`]=room.power;
    shader.uniforms[`bathroomOrigin${i}`]=room.origin;
    declarations.push(`uniform float bathroomPower${i}; uniform vec3 bathroomOrigin${i};`);
    sections.push(`{
      vec3 p = vCabinBootWorld - bathroomOrigin${i};
      if (abs(p.x) < 0.807 && p.y > 0.035 && p.y < 2.50 && p.z > -3.775 && p.z < -1.86) {
        float upperWall = smoothstep(1.10, 2.48, p.y);
        float edgeDistance = min(abs(abs(p.x) - 0.721), abs(abs(p.z + 2.87) - 0.772));
        float cove = exp(-edgeDistance * 16.0) * smoothstep(1.85, 2.48, p.y);
        vec3 warmBounce = albedo * vec3(1.0, 0.86, 0.66) * (0.18 + upperWall * 0.35 + cove * 0.72);
        vec3 lit = shaded * 0.88 + warmBounce;
        float interior = 1.0 - smoothstep(-2.08, -1.86, p.z);
        return mix(shaded, mix(shaded * 0.18, lit, bathroomPower${i}), interior);
      }
    }`);
  });
  // Append below vCabinBootWorld's existing declaration.
  shader.fragmentShader=shader.fragmentShader.replace('void main() {',`
    ${declarations.join('\n')}
    vec3 bathroomIndirectLight(vec3 shaded, vec3 albedo) {
      ${sections.join('\n')}
      return shaded;
    }
    void main() {`);
  shader.fragmentShader=shader.fragmentShader.replace('#include <tonemapping_fragment>',
    'gl_FragColor.rgb = bathroomIndirectLight(gl_FragColor.rgb, diffuseColor.rgb);\n#include <tonemapping_fragment>');
}
