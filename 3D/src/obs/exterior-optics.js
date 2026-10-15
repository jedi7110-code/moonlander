import * as THREE from 'three';

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

// Test the recessed source through the physical nozzle mouth. A fixed pixel
// occlusion square makes brightness depend on resolution, DPR and framing.
export function engineApertureVisibility(engine,cameraPosition){
  const observer=engine.worldToLocal(cameraPosition.clone()),{glowPoint,throatRadius,nozzleLipX,nozzleRadius}=engine.userData;
  if(observer.x>=nozzleLipX)return 0;
  const t=(nozzleLipX-glowPoint[0])/(observer.x-glowPoint[0]);
  let visibility=0;
  for(let i=0;i<9;i++){
    const angle=(i-1)*Math.PI/4,radius=i===0?0:throatRadius*.65;
    const y=Math.cos(angle)*radius,z=Math.sin(angle)*radius;
    const clearance=nozzleRadius-Math.hypot(y+(observer.y-y)*t,z+(observer.z-z)*t);
    visibility+=THREE.MathUtils.smoothstep(clearance,-nozzleRadius*.04,nozzleRadius*.04);
  }
  return visibility/9;
}

export function sampleExteriorOptics(ship,camera,viewport,{strength=.65,streakRatio=2.4,haloRatio=.16,referenceEye}={}){
  const size=projectedShipSize(ship,camera,viewport),position=new THREE.Vector3();
  const observer=referenceEye?new THREE.Vector3(...referenceEye).add(ship.root.getWorldPosition(new THREE.Vector3())):camera.position;
  return ship.engines.map(engine=>{
    position.fromArray(engine.userData.glowPoint);engine.localToWorld(position);
    const gain=engineFacingGain(observer,position)*engineDistanceGain(observer,position)*engineApertureVisibility(engine,observer);
    return{strength:strength*gain,visible:size>0&&gain>.002,streakSize:size*streakRatio,haloSize:size*haloRatio};
  });
}

export function createExteriorOptics(ship){
  const maps={streak:opticalTexture('streak'),halo:opticalTexture('halo')};
  const geometry=new THREE.PlaneGeometry(2,2);
  const sources=ship.engines.map((engine,index)=>{
    const flare=new THREE.Group();flare.name='Blue anamorphic engine flare / '+index;
    flare.position.fromArray(engine.userData.glowPoint);flare.castShadow=false;engine.add(flare);
    const elements=[['streak',0x80baff],['halo',0x91caff]].map(([kind,color])=>{
      const material=new THREE.RawShaderMaterial({
        name:'Resolution independent engine lens / '+kind,
        uniforms:{map:{value:maps[kind]},color:{value:new THREE.Color(color)},
          center:{value:new THREE.Vector3()},pixelSize:{value:0},viewport:{value:new THREE.Vector2()}},
        vertexShader:`precision highp float;
          attribute vec3 position;attribute vec2 uv;varying vec2 vUV;
          uniform vec3 center;uniform float pixelSize;uniform vec2 viewport;
          void main(){vUV=uv;gl_Position=vec4(center.xy+position.xy*pixelSize/viewport,center.z,1.0);}`,
        fragmentShader:`precision highp float;uniform sampler2D map;uniform vec3 color;varying vec2 vUV;
          void main(){vec4 texel=texture2D(map,vUV);gl_FragColor=vec4(texel.rgb*color,texel.a);}`,
        blending:THREE.AdditiveBlending,transparent:true,depthTest:false,depthWrite:false,toneMapped:false,
      });
      const mesh=new THREE.Mesh(geometry,material);mesh.frustumCulled=false;mesh.renderOrder=Infinity;flare.add(mesh);
      return{material,color:material.uniforms.color.value};
    });
    return{flare,elements,colors:elements.map(element=>element.color.clone()),position:new THREE.Vector3(),index};
  });
  let enabled=true;
  return{
    setEnabled(value){enabled=Boolean(value);},
    update(camera,viewport,settings){
      const samples=sampleExteriorOptics(ship,camera,viewport,settings);
      for(const [index,source]of sources.entries()){
        const sample=samples[index];
        source.flare.getWorldPosition(source.position).project(camera);
        source.flare.visible=enabled&&sample.visible&&source.position.z>=-1&&source.position.z<=1;
        source.elements.forEach((element,i)=>{
          element.color.copy(source.colors[i]).multiplyScalar(sample.strength);
          const uniforms=element.material.uniforms;
          uniforms.center.value.copy(source.position);uniforms.viewport.value.copy(viewport);
          uniforms.pixelSize.value=i===0?sample.streakSize:sample.haloSize;
        });
      }
    },
    dispose(){
      sources.forEach(({flare,elements})=>{flare.removeFromParent();elements.forEach(element=>element.material.dispose());});
      geometry.dispose();
      Object.values(maps).forEach(map=>map.dispose());
    }
  };
}
