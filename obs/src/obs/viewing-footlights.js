import {CABIN_AISLE} from './layout.js';

// One concealed strip per wall panel. Shared by the aperture and its floor wash.
export const FOOTLIGHT={firstX:-11.8,spacing:1.52,count:16,width:1.34,height:.018,y:.105,inset:.045,wallFaceZ:CABIN_AISLE.deckFront-.098};

export function addFootlightWash(material,enabled){
  material.onBeforeCompile=shader=>{
    shader.uniforms.povFootlights=enabled;
    shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vPovDeckPosition;')
      .replace('#include <begin_vertex>','#include <begin_vertex>\nvPovDeckPosition = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 vPovDeckPosition;\nuniform float povFootlights;')
      .replace('#include <emissivemap_fragment>',`#include <emissivemap_fragment>
        float slot = clamp(floor((vPovDeckPosition.x - (${FOOTLIGHT.firstX})) / ${FOOTLIGHT.spacing} + 0.5), 0.0, ${FOOTLIGHT.count-1}.0);
        float dx = abs(vPovDeckPosition.x - ((${FOOTLIGHT.firstX}) + slot * ${FOOTLIGHT.spacing}));
        float across = 1.0 - smoothstep(${FOOTLIGHT.width/2-.08}, ${FOOTLIGHT.width/2+.16}, dx);
        float away = 1.0 - smoothstep(0.0, 0.60, max(0.0, ${FOOTLIGHT.wallFaceZ.toFixed(3)} - vPovDeckPosition.z));
        totalEmissiveRadiance += diffuseColor.rgb * vec3(0.85, 0.56, 0.30) * across * away * away * povFootlights;
      `);
  };
  material.customProgramCacheKey=()=> 'pov-recessed-footlight-wash-v1';
}
