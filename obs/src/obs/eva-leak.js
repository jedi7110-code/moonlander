import * as THREE from 'three';
import {EVA_BAY,EVA_HATCH_FIT} from './eva.js';

// Visibility aid: short dust-tracer streaks, not visible air or a smoke cloud.
// Pressure and direction are driven by the compartment model. The trajectories
// are illustrative streamlines, not CFD; all terminate on the outer seal.
export const EVA_LEAK={count:44,segments:5,
  outlet:{x:EVA_BAY.hatchX-.085,y:EVA_HATCH_FIT.centerY+.65,z:EVA_BAY.depth},
  left:EVA_BAY.innerX+.35,back:-1.30,front:2.10};
const noise=i=>{const x=Math.sin(i*127.1+311.7)*43758.5453;return x-Math.floor(x);};

export function evaLeakPoint(index,t,out=new THREE.Vector3()){
  const startX=EVA_LEAK.left+noise(index+3)*.65;
  const startY=.35+noise(index+19)*2.30,startZ=EVA_LEAK.back+noise(index+53)*(EVA_LEAK.front-EVA_LEAK.back);
  const u=THREE.MathUtils.clamp(t,0,1),spread=Math.pow(1-u,.75),advance=Math.pow(u,1.6),end=EVA_LEAK.outlet;
  return out.set(startX+(end.x-startX)*advance,end.y+(startY-end.y)*spread,end.z+(startZ-end.z)*spread);
}

export function createEVALeak(floorY,{reducedMotion=false}={}){
  const layout=EVA_LEAK,sample=evaLeakPoint;
  const count=layout.count*layout.segments*2;
  const positions=new Float32Array(count*3),colors=new Float32Array(count*3);
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.BufferAttribute(positions,3).setUsage(THREE.DynamicDrawUsage));
  geometry.setAttribute('color',new THREE.BufferAttribute(colors,3));
  for(let i=0;i<count;i++){
    const segment=Math.floor(i/2)%layout.segments,head=(segment+i%2)/layout.segments;
    const fade=Math.sin(Math.PI*head)*(.58+.42*noise(Math.floor(i/(layout.segments*2))+91));
    colors.set([.76*fade,.87*fade,fade],i*3);
  }
  const material=new THREE.LineBasicMaterial({name:'EVA leak / illuminated tracer streaks',color:0xffffff,
    vertexColors:true,transparent:true,opacity:0,depthWrite:false,blending:THREE.AdditiveBlending,toneMapped:false});
  const root=new THREE.LineSegments(geometry,material);root.name='EVA bay / escaping dust tracers';root.position.y=floorY;
  root.castShadow=root.receiveShadow=false;root.visible=false;root.frustumCulled=false;
  const point=new THREE.Vector3();let lastClock=null,lastFlow=0,level=0;
  return {root,update(environment){
    const clock=environment?.clock??0,flow=environment?.leakFlow??0;
    const dt=lastClock===null?0:Math.max(0,clock-lastClock);
    if(lastClock===clock&&lastFlow===flow)return false;
    lastClock=clock;lastFlow=flow;
    level=flow>0?Math.min(1,level+dt*3):Math.max(0,level-dt*3);
    // A first rendered snapshot during a leak must not wait for a second clock.
    if(flow>0&&dt===0)level=1;
    root.visible=level>.001;material.opacity=level*Math.min(.55,.16+.24*flow);
    if(!root.visible)return false;
    const time=reducedMotion?0:clock;
    let offset=0;
    for(let i=0;i<layout.count;i++){
      const head=(noise(i+7)+time*(.30+.22*noise(i+31)))%1;
      const length=.035+.045*noise(i+61);
      for(let segment=0;segment<layout.segments;segment++)for(const u of [segment,segment+1]){
        // Clamp the tail instead of wrapping it to the outlet: no line may
        // teleport across the room or pass through the healthy inner hatch.
        sample(i,Math.max(0,head-length+length*u/layout.segments),point);
        positions[offset++]=point.x;positions[offset++]=point.y;positions[offset++]=point.z;
      }
    }
    geometry.attributes.position.needsUpdate=true;return true;
  }};
}
