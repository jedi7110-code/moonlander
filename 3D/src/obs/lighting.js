// Approximate sRGB tints; the display environment also affects perceived warmth.
export const CABIN_LIGHT_COLOR=0xffd4ad; // Around 4200 K for general lighting.
export const CABIN_WARM_LIGHT_COLOR=0xffb16e; // Around 3000 K for living-area fixtures.
export const CABIN_PIXEL_RATIO=1.25;
export const CABIN_SHADOW_SIZE=1024;

// Forward rendering evaluates every visible light on every lit surface.
// Keep new fixture lenses while restoring the original pair of lights per deck.
export function limitCabinLights(root){
  const litGates=new Set();
  root.traverse(light=>{
    if(!light.isLight)return;
    light.visible=false;light.castShadow=false;
    if(light.isPointLight&&['Legacy deck light','Legacy deck fill'].includes(light.name)){
      light.visible=true;
    }else if(light.isRectAreaLight&&light.name.startsWith('Plant grow light')){
      light.visible=true;
    }else if(light.isPointLight&&light.name==='Ladder shaft fill'){
      light.visible=true;
    }else if(light.isPointLight&&light.parent.name==='Bulkhead gate lights'&&!litGates.has(light.parent)){
      light.visible=true;litGates.add(light.parent);
    }
  });
}
