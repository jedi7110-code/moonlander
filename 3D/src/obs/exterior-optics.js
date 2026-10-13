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

// Measure the fixed propulsion section on screen. Rotating habitats are
// excluded so their changing silhouette cannot pulse the lens response.
// Projection includes zoom/FOV, core scale and actual depth; pixel width
// and height cancel the projection's aspect correction independently.
export function projectedShipSize(ship,camera,viewport){
  camera.updateMatrixWorld(true);
  const point=new THREE.Vector3();
  let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
  for(const engine of ship.engines)for(const y of [-1,1])for(const z of [-1,1]){
    const radius=engine.userData.throatRadius/.24;
    point.set(engine.userData.glowPoint[0],y*radius,z*radius);
    engine.localToWorld(point).applyMatrix4(camera.matrixWorldInverse);
    if(point.z>=-camera.near)continue;
    point.applyMatrix4(camera.projectionMatrix);
    minX=Math.min(minX,point.x);maxX=Math.max(maxX,point.x);
    minY=Math.min(minY,point.y);maxY=Math.max(maxY,point.y);
  }
  return Number.isFinite(minX)?Math.max((maxX-minX)*viewport.x/2,(maxY-minY)*viewport.y/2):0;
}

export function sampleExteriorOptics(ship,camera,viewport,{strength=.65,streakRatio=2.4,haloRatio=.16}={}){
  const size=projectedShipSize(ship,camera,viewport),position=new THREE.Vector3();
  return ship.engines.map(engine=>{
    position.fromArray(engine.userData.glowPoint);engine.localToWorld(position);
    const gain=engineFacingGain(camera.position,position)*engineDistanceGain(camera.position,position);
    return{strength:strength*gain,visible:size>0&&gain>.002,streakSize:size*streakRatio,haloSize:size*haloRatio};
  });
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
    update(camera,viewport,settings){
      const samples=sampleExteriorOptics(ship,camera,viewport,settings);
      for(const [index,source]of sources.entries()){
        const sample=samples[index];
        source.flare.visible=enabled&&sample.visible;
        source.elements.forEach((element,i)=>{
          element.color.copy(source.colors[i]).multiplyScalar(sample.strength);
          element.size=i===0?sample.streakSize:sample.haloSize;
        });
      }
    },
    dispose(){
      sources.forEach(({flare})=>{flare.removeFromParent();flare.dispose();flare.material.dispose();});
      Object.values(maps).forEach(map=>map.dispose());
    }
  };
}
