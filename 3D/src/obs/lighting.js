// Approximate sRGB tints; the display environment also affects perceived warmth.
export const CABIN_LIGHT_COLOR=0xffcb9c; // Around 3800 K for general lighting.
export const CABIN_WARM_LIGHT_COLOR=0xffa967; // Around 2800 K for living-area fixtures.
export const CABIN_AMBIENCE={exposure:1.16,environment:.21,sky:0xeee3d4,ground:0x2e3030,ambient:.90,key:0xffe4c4,keyPower:2.25,fill:0xd8d5cc,fillPower:.68};
export const CABIN_DECK_LIGHT={color:0xffdfbb,fillColor:0xe9dfcf,power:40,livingPower:10.8,fillPower:28};
// Keep CSS-sized ink while reducing high-DPI fragment work in the cabin.
export const CABIN_PIXEL_RATIO=1.1;
export const CABIN_SHADOW_SIZE=1024;
// Shared by the visible ladder fixtures and their low-cost local light spill.
export const LADDER_LIGHT_LAYOUT=Object.freeze({firstY:.54,spacing:1.12,count:12,sourceX:.46,sourceYOffset:-.01,sourceZ:.21});
export const EVA_SPOT_LAYOUT=Object.freeze({suitX:Object.freeze([7.85,9.05,10.25]),floorY:6.784,sourceY:2.91,sourceZ:-.05,targetY:1.95,targetZ:-.67,innerAngle:16,outerAngle:26,range:3.15});

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
