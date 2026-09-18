import {MathUtils} from 'three';

// Sample in undeformed skin coordinates, not screen/world space: the mottling
// must stay attached to the arm through bending, walking and treatment.
export const armBruiseShader=/* glsl */`
float miloBruiseHash(vec2 p){
  vec3 h=fract(vec3(p.xyx)*.1031);
  h+=dot(h,h.yzx+33.33);
  return fract((h.x+h.y)*h.z);
}
float miloBruiseNoise(vec2 p){
  vec2 cell=floor(p),f=fract(p);
  f=f*f*(3.0-2.0*f);
  return mix(mix(miloBruiseHash(cell),miloBruiseHash(cell+vec2(1,0)),f.x),
    mix(miloBruiseHash(cell+vec2(0,1)),miloBruiseHash(cell+vec2(1,1)),f.x),f.y);
}
vec3 miloBruisedSkin(vec3 skin,vec2 p,float mask,float strength){
  if(mask<.001||strength<.001)return skin;
  float islands=miloBruiseNoise(p*3.8+vec2(8.2,2.9));
  float mottling=miloBruiseNoise(p*14.0+vec2(3.6,9.1));
  float grain=miloBruiseNoise(p*73.0+vec2(17.1,4.2));
  float fine=miloBruiseNoise(p*157.0+vec2(2.3,19.4));
  float field=.50*islands+.34*mottling+.16*grain;

  // A diffuse ochre undertone around/between the darker subcutaneous islands.
  // Keep the skin underneath visible; this is not an opaque wound decal.
  float edge=smoothstep(.0,.26,mask)*(1.0-smoothstep(.35,.85,mask));
  float halo=mask*.18+edge*.34;
  vec3 ochre=skin*vec3(.92,.78,.48);
  vec3 surface=mix(skin,ochre,halo*strength*(.65+.35*islands));

  // Uneven pale centre, with purple/burgundy concentrations rather than a ring.
  vec2 centre=(p-vec2(.12,-.10))/vec2(.34,.43);
  float clearing=exp(-dot(centre,centre)*1.8)*(.55+.35*mottling);
  float coverage=smoothstep(.08,.72,mask+(field-.5)*.40);
  float density=coverage*(.40+.60*smoothstep(.25,.72,field))*(1.0-.82*clearing);
  density*=.88+.12*fine;
  vec3 plum=vec3(.064,.019,.052),burgundy=vec3(.155,.034,.050);
  vec3 pigment=mix(plum,burgundy,smoothstep(.25,.72,mottling));
  pigment*=.84+.30*grain;
  surface=mix(surface,pigment,strength*density*.89);
  return mix(surface,ochre,clearing*coverage*strength*.32);
}
`;

// Pigment on the injured forearm, not a raised wound or a floating decal.
export function armBruiseMask(x,y,z,armRegion){
  if(x>=0||armRegion<.9)return 0;
  const a=(y-1.13)/.055,b=(z+.003)/.045;
  const radius=Math.hypot(a,b)+.06*Math.sin(a*7+b*4)+.045*Math.sin(b*11-a*3);
  return (1-MathUtils.smoothstep(radius,.40,1.12))*MathUtils.smoothstep(-x,.190,.225)*MathUtils.smoothstep(armRegion,.9,.98);
}

// The back of the same hand is +Z in bind space; -Z is the palm.
// Keep the patch between the knuckles and wrist, away from the thumb/fingers.
export function handBruiseMask(x,y,z,armRegion){
  if(x>=0||armRegion<.9||z<=.001)return 0;
  const a=(y-.892)/.025,b=(x+.212)/.023;
  const radius=Math.hypot(a,b)+.08*Math.sin(a*5-b*7)+.04*Math.sin(a*11+b*3);
  return (1-MathUtils.smoothstep(radius,.32,1.1))*MathUtils.smoothstep(z,.001,.012)*MathUtils.smoothstep(armRegion,.9,.98);
}

export function injuryBruiseStrength(health){
  if(health?.condition?.kind==='injury'){
    const course=health.treatment;
    return course?.kind==='injury'?1-.35*MathUtils.smoothstep(course.elapsed/course.duration,0,1):1;
  }
  // Match the existing recovery period, fading away after treatment.
  return .65*MathUtils.smoothstep((health?.bandageTime??0)/180,0,1);
}

export function updateInjuryAppearance(root,health){
  const strength=injuryBruiseStrength(health);
  root.userData.bruiseStrength=strength;
  const uniform=root.userData.bodySkin?.material.userData.bruiseStrength;
  if(uniform)uniform.value=strength;
}
