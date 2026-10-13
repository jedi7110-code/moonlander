import * as THREE from 'three';
import {Lensflare,LensflareElement} from 'three/addons/objects/Lensflare.js';

// A lens response, kept separate from the recessed engine emission.
function opticalTexture(kind){
  const canvas=document.createElement('canvas');canvas.width=canvas.height=512;
  const c=canvas.getContext('2d');c.translate(256,256);
  if(kind==='streak'){
    c.scale(1,.014);const g=c.createRadialGradient(0,0,0,0,0,256);
    g.addColorStop(0,'rgba(240,250,255,.78)');g.addColorStop(.08,'rgba(170,220,255,.36)');
    g.addColorStop(.42,'rgba(95,170,255,.14)');g.addColorStop(1,'rgba(70,145,255,0)');
    c.fillStyle=g;c.fillRect(-256,-256,512,512);
  }else{
    const g=c.createRadialGradient(0,0,0,0,0,230);
      g.addColorStop(0,'rgba(210,240,255,.35)');g.addColorStop(.12,'rgba(130,195,255,.12)');
      g.addColorStop(.45,'rgba(85,155,255,.025)');
    g.addColorStop(1,'rgba(65,140,255,0)');c.fillStyle=g;c.fillRect(-256,-256,512,512);
  }
  const map=new THREE.CanvasTexture(canvas);map.name='Engine lens / '+kind;return map;
}

export function engineFacingGain(cameraPosition,sourcePosition){
  const dx=sourcePosition.x-cameraPosition.x,dy=sourcePosition.y-cameraPosition.y,dz=sourcePosition.z-cameraPosition.z;
  const length=Math.hypot(dx,dy,dz);return length?THREE.MathUtils.smoothstep(dx/length,.65,.96):0;
}

export function engineDistanceGain(cameraPosition,sourcePosition){
  const distance=Math.hypot(sourcePosition.x-cameraPosition.x,sourcePosition.y-cameraPosition.y,sourcePosition.z-cameraPosition.z);
  return Math.min(1,(200/Math.max(200,distance))**2);
}

export function createExteriorOptics(ship){
  const maps={streak:opticalTexture('streak'),halo:opticalTexture('halo')};
  const sources=ship.engines.map((engine,index)=>{
    const flare=new Lensflare();flare.name='Blue anamorphic engine flare / '+index;
    flare.position.fromArray(engine.userData.glowPoint);flare.castShadow=false;engine.add(flare);
    const elements=[new LensflareElement(maps.streak,340,0,new THREE.Color(0x80baff)),
      new LensflareElement(maps.halo,54,0,new THREE.Color(0x91caff))];
    elements.forEach(element=>flare.addElement(element));
    return{flare,elements,colors:elements.map(element=>element.color.clone()),position:new THREE.Vector3(),index};
  });
  let enabled=true;
  return{
    setEnabled(value){enabled=Boolean(value);},
    update(camera,width){
      for(const source of sources){
        source.flare.getWorldPosition(source.position);
        const distanceGain=engineDistanceGain(camera.position,source.position),scale=Math.sqrt(distanceGain);
        const gain=engineFacingGain(camera.position,source.position)*distanceGain;
        source.flare.visible=enabled&&gain>.002;
        source.elements.forEach((element,i)=>{
          const strength=.65*gain;
          element.color.copy(source.colors[i]).multiplyScalar(strength);
          element.size=(i===0?width*.82:54)*scale;
        });
      }
    },
    dispose(){
      sources.forEach(({flare})=>{flare.removeFromParent();flare.dispose();flare.material.dispose();});
      Object.values(maps).forEach(map=>map.dispose());
    }
  };
}
