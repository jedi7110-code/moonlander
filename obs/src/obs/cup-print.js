import {Float32BufferAttribute} from 'three';
import {whiteCeramic} from './cabin-fixtures.js';

const cache=new WeakMap();
export const MUG_LOGO_WIDTH=.064;
export const MUG_LOGO_HEIGHT=MUG_LOGO_WIDTH*754/1427;

// Print into the ceramic shading itself. No decal mesh, extra draw or parallel
// surface: the logo follows the existing tapered cup wall, even when carried.
export function printMugLogo(cup,map,{centerY=.067}={}){
  if(!map?.isTexture)return cup;
  if(!cache.has(map)){
    const material=whiteCeramic.clone();material.name='TARAIRON / printed white porcelain';
    material.userData.cupPrint=true;
    // Expose the shared texture to the scene's normal resource disposal pass.
    material.mugLogoMap=map;
    material.onBeforeCompile=shader=>{
      shader.uniforms.mugLogoMap={value:map};
      shader.vertexShader=shader.vertexShader.replace('#include <common>',
        '#include <common>\nattribute vec3 cupPrintUV; varying vec3 vCupPrintUV;').replace('#include <begin_vertex>',
        '#include <begin_vertex>\nvCupPrintUV = cupPrintUV;');
      shader.fragmentShader=shader.fragmentShader.replace('#include <common>',
        '#include <common>\nuniform sampler2D mugLogoMap; varying vec3 vCupPrintUV;').replace('#include <map_fragment>',`#include <map_fragment>
        if(vCupPrintUV.z > 0.999 && all(greaterThanEqual(vCupPrintUV.xy, vec2(0.0))) && all(lessThanEqual(vCupPrintUV.xy, vec2(1.0)))) {
          float ink = texture2D(mugLogoMap, vCupPrintUV.xy).a;
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.012, 0.022, 0.021), ink);
        }
      `);
    };
    material.customProgramCacheKey=()=> 'tarairon-ceramic-print-v1';cache.set(map,material);
  }
  const position=cup.geometry.attributes.position,profile=cup.geometry.parameters.points,uv=[];
  for(let i=0;i<position.count;i++){
    const x=position.getX(i),y=position.getY(i),z=position.getZ(i),row=i%profile.length;
    // Only the outer wall between the foot and rim; never print in the cup,
    // on its handle, or across the rear-side angular seam.
    const radius=Math.hypot(x,z),outer=(row===2||row===3)&&Math.abs(z)>radius*.5;
    // Matching front/back prints stay readable when the resting cup is turned
    // handle-left or Milo lifts it; keep the handle-side seams unprinted.
    const angle=z<0?Math.atan2(-x,-z):Math.atan2(x,z);
    uv.push(.5+angle*radius/MUG_LOGO_WIDTH,.5+(y-centerY)/MUG_LOGO_HEIGHT,outer?1:0);
  }
  cup.geometry.setAttribute('cupPrintUV',new Float32BufferAttribute(uv,3));
  cup.material=cache.get(map);cup.userData.cupPrint=true;return cup;
}
