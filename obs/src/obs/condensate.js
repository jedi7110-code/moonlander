import * as THREE from 'three';

// The return outlet maintains a standing one-third fill, even between drips.
export const CONDENSATE=Object.freeze({bottom:.50,top:.88,radius:.039,level:.50+(.88-.50)/3,nozzle:.847,releaseY:.847-.006*1.48-.0007,dropRadius:.006});
export const CONDENSATE_INTERVALS=Object.freeze([3.35,4.10,3.65,4.60,3.80,4.25]);
const loopSeconds=CONDENSATE_INTERVALS.reduce((sum,seconds)=>sum+seconds,0);
const gravity=9.81,fallSeconds=Math.sqrt(2*(CONDENSATE.releaseY-CONDENSATE.level-CONDENSATE.dropRadius)/gravity);
const quietSeconds=1.05,rippleSeconds=.88;
const clamp=x=>Math.max(0,Math.min(1,x));

// One clock drives both the visible impact and the optional cabin sound. Sampling
// by elapsed time also keeps pauses, low frame rates and study scrubbing stable.
export function sampleCondensate(time,out={}){
  const t=Math.max(0,time),loop=Math.floor(t/loopSeconds);
  let age=t-loop*loopSeconds,index=0;
  while(index<CONDENSATE_INTERVALS.length-1&&age>=CONDENSATE_INTERVALS[index])age-=CONDENSATE_INTERVALS[index++];
  const period=CONDENSATE_INTERVALS[index],release=period-quietSeconds-fallSeconds,impact=release+fallSeconds;
  const number=loop*CONDENSATE_INTERVALS.length+index,forming=age<release,falling=!forming&&age<impact;
  out.phase=forming?'forming':falling?'falling':'settling';
  out.impactIndex=number-(age<impact?1:0);
  out.impactAge=out.impactIndex<0?Infinity:age<impact?age+quietSeconds:age-impact;
  out.rippleAge=out.impactAge<rippleSeconds?out.impactAge:-1;
  const growth=clamp((age-.25)/(release-.25));
  out.radius=forming?.0015+(CONDENSATE.dropRadius-.0015)*Math.cbrt(growth):CONDENSATE.dropRadius;
  out.stretch=forming?1+.48*growth:falling?1+.48*Math.exp(-(age-release)*25):1;
  out.y=forming?CONDENSATE.nozzle-out.radius*out.stretch-.0007:falling?CONDENSATE.releaseY-.5*gravity*(age-release)**2:CONDENSATE.level;
  out.visible=forming||falling;
  out.neck=forming?clamp((growth-.55)/.45):0;
  return out;
}

function mesh(parent,name,geometry,material,x,y,z,order=0){
  const part=new THREE.Mesh(geometry,material);part.name=name;part.position.set(x,y,z);part.renderOrder=order;
  // Tiny wet surfaces neither cast opaque shadows nor need their own shadow pass.
  part.castShadow=false;part.receiveShadow=false;parent.add(part);return part;
}

function edgeTransparency(material){
  material.onBeforeCompile=shader=>{
    shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
      float condensateEdge = pow(1.0 - abs(dot(normal, normalize(vViewPosition))), 2.5);
      diffuseColor.a *= mix(0.18, 1.0, condensateEdge);
    `);
  };
  material.customProgramCacheKey=()=> 'condensate-edge-transparency-v1';
}

export function createCondensateSight(parent,metal){
  const root=new THREE.Group();root.name='Condensate inspection chamber';root.position.set(1.73,0,-.53);parent.add(root);
  const glassMaterial=new THREE.MeshStandardMaterial({name:'Clear condensate glass',color:0xd8e0dc,roughness:.075,metalness:.04,envMapIntensity:.9,transparent:true,opacity:.38,depthWrite:false});
  edgeTransparency(glassMaterial);
  const glass=mesh(root,'Condensate sight tube',new THREE.CylinderGeometry(.044,.044,CONDENSATE.top-CONDENSATE.bottom,32,1,true),glassMaterial,0,(CONDENSATE.top+CONDENSATE.bottom)/2,0,5);
  for(const y of [CONDENSATE.bottom,CONDENSATE.top])mesh(root,'Sight tube collar',new THREE.CylinderGeometry(.058,.058,.045,24),metal,0,y,0);
  mesh(root,'Condensate drip nozzle',new THREE.CylinderGeometry(.010,.008,.023,16),metal,0,CONDENSATE.nozzle+.0115,0);

  const waterMaterial=new THREE.MeshStandardMaterial({name:'Clear standing condensate',color:0xb0c5c5,roughness:.065,metalness:.08,envMapIntensity:1.1,transparent:true,opacity:.62,depthWrite:false});
  const height=CONDENSATE.level-CONDENSATE.bottom;
  const reservoir=mesh(root,'Standing condensate / lower third',new THREE.CylinderGeometry(CONDENSATE.radius,CONDENSATE.radius,height,40,1,true),waterMaterial,0,CONDENSATE.bottom+height/2,0,1);
  const surfaceMaterial=waterMaterial.clone();surfaceMaterial.name='Condensate water surface';surfaceMaterial.opacity=.65;surfaceMaterial.side=THREE.DoubleSide;surfaceMaterial.forceSinglePass=true;
  const surface=mesh(root,'Condensate meniscus and impact ripples',new THREE.RingGeometry(0,CONDENSATE.radius,40,10),surfaceMaterial,0,CONDENSATE.level,0,2);
  surface.rotation.x=-Math.PI/2;
  const positions=surface.geometry.attributes.position;
  positions.setUsage(THREE.DynamicDrawUsage);
  const radii=Array.from({length:positions.count},(_,i)=>Math.hypot(positions.getX(i),positions.getY(i)));
  // The contact line climbs the glass slightly, rather than a flat opaque disc.
  const rim=mesh(root,'Condensate meniscus reflection',new THREE.TorusGeometry(CONDENSATE.radius-.0006,.0006,4,40),surfaceMaterial,0,CONDENSATE.level+.0011,0,3);rim.rotation.x=Math.PI/2;
  const dropMaterial=waterMaterial.clone();dropMaterial.name='Filtered water droplet';dropMaterial.color.setHex(0xd1dddd);dropMaterial.opacity=.82;dropMaterial.envMapIntensity=1.4;
  // Keep the center clear, with stronger grazing reflections along the curved
  // edge. This avoids an opaque grey column without an extra refraction pass.
  edgeTransparency(waterMaterial);
  const drop=mesh(root,'Single filtered water droplet',new THREE.SphereGeometry(1,16,12),dropMaterial,0,CONDENSATE.releaseY,0,3);
  const neck=mesh(root,'Attached droplet neck',new THREE.CylinderGeometry(.0013,.001,.010,8),dropMaterial,0,CONDENSATE.nozzle-.005,0,3);
  const state={},result={root,glass,reservoir,surface,drop,state,update};
  let rippling=true;
  function update(time){
    sampleCondensate(time,state);
    drop.visible=state.visible;drop.position.y=state.y;
    drop.scale.set(state.radius/Math.sqrt(state.stretch),state.radius*state.stretch,state.radius/Math.sqrt(state.stretch));
    neck.visible=state.neck>0;neck.scale.x=neck.scale.z=.5+.5*state.neck;
    if(state.rippleAge>=0||rippling){
      const age=state.rippleAge;
      for(let i=0;i<positions.count;i++){
        const r=radii[i],edge=r/CONDENSATE.radius;
        const meniscus=.0015*Math.pow(edge,8);
        // A small impact dimple and an outward capillary wave, both dying away
        // against the wall. No continuous boiling, splash particles or glow.
        const dimple=age<0?0:-.0022*Math.cos(age*32)*Math.exp(-age*15-r*r/.000045);
        const distance=r-age*.12;
        const wave=age<0?0:.0016*Math.sin(distance*470)*Math.exp(-distance*distance/.000095-age*5)*(1-edge*edge);
        positions.setZ(i,meniscus+dimple+wave);
      }
      positions.needsUpdate=true;surface.geometry.computeVertexNormals();
      rippling=age>=0;
    }
  }
  update(0);return result;
}
