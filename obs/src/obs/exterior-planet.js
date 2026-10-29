import * as THREE from 'three';
import {EXTERIOR_SYSTEM,createExteriorEphemeris,visibleDiscFraction} from './exterior-system.js';

export const EXTERIOR_PLANET_VARIANTS=Object.freeze([
  {id:'current',label:'青灰の海洋惑星',description:'暗い海と岩の大陸、薄い雲。'},
  {id:'ochre',label:'A · 琥珀色のガス惑星',description:'黄土色と灰褐色の大気。緩い帯状の雲が流れる印象。'},
  {id:'rust',label:'B · 赤褐色の岩石惑星',description:'乾いた赤い地表と暗い盆地。大気と雲を控えめに。'},
  {id:'ice',label:'C · 淡い氷の惑星',description:'青白い氷原と暗い亀裂。冷たい薄い大気。'},
]);
const variantIndex=id=>Math.max(0,EXTERIOR_PLANET_VARIANTS.findIndex(variant=>variant.id===id));

// Apparent disc diameters in degrees for the optional visual study. Physical
// orbital positions, illumination and occultation calculations stay unchanged.
export const EXTERIOR_PLANET_EMPHASIS=Object.freeze({ochre:.5,current:1.1,ice:.35});

// An angular background proxy keeps planetary depth out of the small-scale
// ship's depth buffer. No fetched maps or time-dependent texture generation.
export function createExteriorPlanet({variant='current',background=false}={}){
  const geometry=new THREE.SphereGeometry(4200,96,64);
  const material=new THREE.ShaderMaterial({
    depthTest:!background,depthWrite:!background,
    uniforms:{pattern:{value:variantIndex(variant)},lightDirection:{value:new THREE.Vector3(64,-110,92).normalize()}},
    vertexShader:`
      varying vec3 vSurface;
      varying vec3 vWorld;
      varying vec3 vNormal;
      void main(){
        vSurface=position;
        vec4 world=modelMatrix*vec4(position,1.0);
        vWorld=world.xyz;vNormal=mat3(modelMatrix)*normal;
        gl_Position=projectionMatrix*viewMatrix*world;
        ${background?'gl_Position.z=gl_Position.w*.99999;':''}
      }`,
    fragmentShader:`
      uniform vec3 lightDirection;
      uniform float pattern;
      varying vec3 vSurface;
      varying vec3 vWorld;
      varying vec3 vNormal;
      float hash(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}
      float noise(vec3 p){
        vec3 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);
        return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),
                       mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),
                   mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),
                       mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);
      }
      float fbm(vec3 p){
        float value=0.0,weight=.5;
        for(int i=0;i<5;i++){value+=weight*noise(p);p=p*2.03+vec3(3.1,-1.7,2.4);weight*=.5;}
        return value;
      }
      void main(){
        vec3 surface=normalize(vSurface),normal=normalize(vNormal);
        vec3 warp=vec3(fbm(surface*3.7),fbm(surface*3.7+7.1),fbm(surface*3.7-5.3));
        float land=fbm(surface*3.0+warp*1.4);
        vec3 ocean=mix(vec3(.021,.048,.069),vec3(.037,.081,.104),land);
        vec3 rock=mix(vec3(.072,.082,.076),vec3(.151,.153,.126),fbm(surface*27.0));
        vec3 color=mix(ocean,rock,smoothstep(.49,.57,land));
        float clouds=smoothstep(.43,.66,fbm(surface*8.0+warp*2.3));
        color=mix(color,vec3(.43,.48,.49),clouds*.83);
        vec3 atmosphere=vec3(.055,.135,.20);
        if(pattern>.5&&pattern<1.5){
          float latitude=surface.y*26.0+(warp.x-.5)*3.6;
          float bands=.5+.5*sin(latitude+fbm(surface*12.0)*1.8);
          float wisps=fbm(surface*32.0+warp);
          color=mix(vec3(.105,.078,.049),vec3(.38,.30,.19),smoothstep(.1,.9,bands));
          color=mix(color,vec3(.44,.40,.32),wisps*.3);
          atmosphere=vec3(.16,.12,.07);
        }else if(pattern>1.5&&pattern<2.5){
          float terrain=fbm(surface*7.0+warp*1.6);
          color=mix(vec3(.052,.034,.027),vec3(.30,.135,.068),smoothstep(.28,.7,terrain));
          color*=.86+.28*fbm(surface*55.0);
          color=mix(color,vec3(.36,.27,.18),clouds*.10);
          atmosphere=vec3(.055,.025,.012);
        }else if(pattern>2.5){
          float ice=fbm(surface*10.0+warp*2.6);
          float cracks=1.0-smoothstep(.012,.055,abs(ice-.48));
          color=mix(vec3(.16,.23,.26),vec3(.43,.49,.50),smoothstep(.28,.68,ice));
          color=mix(color,vec3(.045,.09,.115),cracks*.65);
          color=mix(color,vec3(.48,.51,.52),clouds*.22);
          atmosphere=vec3(.07,.16,.21);
        }
        float sun=max(0.0,dot(normal,normalize(lightDirection)));
        color*=.008+sun*1.6;
        float rim=pow(1.0-max(0.0,dot(normal,normalize(cameraPosition-vWorld))),5.0);
        color+=atmosphere*rim*(.15+sun*.6);
        gl_FragColor=vec4(color,1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  material.name='Distant blue-grey planet / stationary sunlight';
  const body=new THREE.Mesh(geometry,material);body.name='Planet background';body.visible=false;
  // Stars are an infinite-distance field with no depth writes. Draw this
  // opaque background after them, while keeping the nearer ship's depth.
  body.renderOrder=background?-8:1;
  if(background)body.frustumCulled=false;
  return{body,setVariant(id){material.uniforms.pattern.value=variantIndex(id);},show(position){body.visible=Boolean(position);if(position)body.position.fromArray(position);},
    dispose(){geometry.dispose();material.dispose();}};
}

// Physical positions are kept in kilometres around the star. Only angular
// proxies enter the ship's metre-scale render scene, preserving depth precision.
export function createExteriorSkyPlanet({light=null,ship=null,clock=()=>Date.now()/1000,emphasis=false}={}){
  const worldUp=new THREE.Vector3(0,1,0),initialSun=new THREE.Vector3(64,-110,92).normalize(),target=new THREE.Vector3();
  if(light){light.getWorldPosition(initialSun);light.target.getWorldPosition(target);initialSun.sub(target).normalize();}
  const lightDistance=light?light.position.distanceTo(light.target.position):1;
  const right=new THREE.Vector3().crossVectors(worldUp,initialSun);
  if(right.lengthSq()<1e-6)right.set(0,0,1).cross(initialSun);
  right.normalize();const up=new THREE.Vector3().crossVectors(initialSun,right).normalize(),tilt=35*Math.PI/180;
  const initialView=initialSun.clone().multiplyScalar(-Math.cos(tilt))
    .addScaledVector(right,Math.sin(tilt)*Math.SQRT1_2).addScaledVector(up,-Math.sin(tilt)*Math.SQRT1_2);
  right.crossVectors(initialView,worldUp).normalize();up.crossVectors(right,initialView).normalize();
  const initialPlacement=initialView.clone().addScaledVector(right,.22).addScaledVector(up,.07).normalize();
  const ephemeris=createExteriorEphemeris({sunDirection:initialSun,planetDirection:initialPlacement,clock});
  const root=new THREE.Group();root.name='S-01 / four physical planetary orbits';
  const pixels=new Uint8Array(16*16*4);
  for(let y=0;y<16;y++)for(let x=0;x<16;x++){
    const i=(y*16+x)*4,r=Math.hypot(x-7.5,y-7.5)/7.5;
    pixels[i]=pixels[i+1]=pixels[i+2]=255;pixels[i+3]=Math.round(Math.exp(-r*r*6)*255);
  }
  const pointTexture=new THREE.DataTexture(pixels,16,16);pointTexture.needsUpdate=true;
  pointTexture.magFilter=pointTexture.minFilter=THREE.LinearFilter;
  const entries=EXTERIOR_SYSTEM.planets.map(spec=>{
    const planet=createExteriorPlanet({variant:spec.id,background:true});
    const marker=new THREE.Sprite(new THREE.SpriteMaterial({map:pointTexture,color:spec.color,
      transparent:true,depthTest:false,depthWrite:false,toneMapped:false,blending:THREE.AdditiveBlending}));
    marker.name=`${spec.name} / unresolved reflected light`;marker.renderOrder=-7;marker.frustumCulled=false;
    const spinAxis=ephemeris.normal.clone().applyAxisAngle(ephemeris.radial,spec.tilt*Math.PI/180);
    root.add(planet.body,marker);
    return{...planet,spec,marker,spinAxis,direction:new THREE.Vector3(),distanceKm:0,angularRadius:0,displayAngularRadius:0};
  });
  const observer=new THREE.Vector3(),shipCenter=new THREE.Vector3(),starDirection=new THREE.Vector3(),relative=new THREE.Vector3(),rotation=new THREE.Quaternion();
  let frame=ephemeris.sample(),sunVisibility=1;
  function sample(){frame=ephemeris.sample();relative.copy(frame.planetPositions[0]).sub(frame.observer).normalize();return relative;}
  function follow(camera,height=1000){
    sample();observer.copy(frame.observer);
    if(ship){ship.root.getWorldPosition(shipCenter);observer.addScaledVector(relative.copy(camera.position).sub(shipCenter),.001);}
    starDirection.copy(observer).negate().normalize();sunVisibility=1;
    const starDistance=observer.length(),starRadius=Math.asin(EXTERIOR_SYSTEM.star.radiusKm/starDistance);
    const proxyDistance=13600,tanHalfFov=Math.tan(camera.fov*Math.PI/360)/camera.zoom;
    entries.forEach((entry,i)=>{
      relative.copy(frame.planetPositions[i]).sub(observer);entry.distanceKm=relative.length();entry.direction.copy(relative).normalize();
      entry.angularRadius=Math.asin(entry.spec.radiusKm/entry.distanceKm);
      const emphasizedDiameter=emphasis?EXTERIOR_PLANET_EMPHASIS[entry.spec.id]??0:0;
      entry.displayAngularRadius=Math.max(entry.angularRadius,emphasizedDiameter*Math.PI/360);
      entry.body.position.copy(camera.position).addScaledVector(entry.direction,proxyDistance);
      entry.body.scale.setScalar(proxyDistance*Math.sin(entry.displayAngularRadius)/4200);
      entry.body.quaternion.setFromAxisAngle(entry.spinAxis,frame.spinAngles[i]);
      entry.body.material.uniforms.lightDirection.value.copy(frame.planetPositions[i]).negate().normalize();
      if(entry.distanceKm<starDistance)sunVisibility*=visibleDiscFraction(starRadius,entry.angularRadius,entry.direction.angleTo(starDirection));
      const discPixels=height*Math.tan(entry.displayAngularRadius)/tanHalfFov;
      entry.marker.position.copy(entry.body.position);entry.marker.scale.setScalar(2*proxyDistance*tanHalfFov/height*2);
      const phase=entry.body.material.uniforms.lightDirection.value.angleTo(relative.copy(observer).sub(frame.planetPositions[i]).normalize());
      const lambert=(Math.sin(phase)+(Math.PI-phase)*Math.cos(phase))/Math.PI;
      const flux=EXTERIOR_SYSTEM.star.luminositySolar/entry.spec.orbitAU**2*entry.spec.albedo*lambert*(entry.spec.radiusKm/entry.distanceKm)**2;
      const magnitude=-26.74-2.5*Math.log10(Math.max(1e-30,flux));
      entry.marker.material.opacity=THREE.MathUtils.clamp(10**(-.4*(magnitude+1))*.7,0,.9)*(1-THREE.MathUtils.smoothstep(discPixels,.5,2));
      entry.marker.visible=discPixels<2;entry.body.visible=discPixels>=.5;
    });
    for(const entry of entries){
      if(entries.some(other=>other!==entry&&other.distanceKm<entry.distanceKm&&entry.direction.angleTo(other.direction)+entry.angularRadius<other.angularRadius)){
        entry.body.visible=false;entry.marker.visible=false;
      }
    }
    if(light){
      // The small directional-light offset serves only the ship's shadow map.
      light.position.copy(light.target.position).addScaledVector(starDirection,lightDistance);
    }
  }
  return{root,body:entries[0].body,entries,ephemeris,
    setEmphasis(value){emphasis=Boolean(value);},
    get sunVisibility(){return sunVisibility;},
    getDirection(output){return output.copy(sample());},
    getBodyDirection(index,output){sample();return output.copy(frame.planetPositions[index]).sub(frame.observer).normalize();},
    getViewDirection(output){rotation.setFromUnitVectors(initialPlacement,sample());return output.copy(initialView).applyQuaternion(rotation);},
    follow,
    dispose(){entries.forEach(entry=>{entry.dispose();entry.marker.material.dispose();});pointTexture.dispose();root.removeFromParent();}
  };
}
