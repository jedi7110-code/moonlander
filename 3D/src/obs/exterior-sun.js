import * as THREE from 'three';
import {EXTERIOR_SUN_LENS,SUN_GHOST_COUNT,sunLensGhosts} from './exterior-sun-lens.js';

// An angular sky proxy: the nearby directional-light helper is only for the
// shadow map. The visible star stays at infinity along that light's direction.
export function createExteriorSun(light,{ship=null,distance=1200,visibility=()=>1}={}){
  const angularRadius=.035;
  const geometry=new THREE.PlaneGeometry(2,2);
  const material=new THREE.ShaderMaterial({uniforms:{transmission:{value:1}},transparent:true,depthTest:true,depthWrite:false,
    blending:THREE.CustomBlending,blendSrc:THREE.OneFactor,blendDst:THREE.OneFactor,
    blendSrcAlpha:THREE.OneFactor,blendDstAlpha:THREE.OneMinusSrcAlphaFactor,
    vertexShader:`varying vec2 p;void main(){p=uv*2.-1.;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader:`
      varying vec2 p;
      uniform float transmission;
      void main(){
        float r=length(p);
        float core=exp(-pow(r/.020,1.45))*18.;
        float bloom=exp(-r/.15)*1.2;
        float halo=exp(-r/.28)*.035;
        float ray=exp(-abs(p.x)/.40-pow(p.y/.009,2.))*.12;
        vec3 color=vec3(1.,.98,.94)*(core+bloom)+vec3(1.,.90,.72)*(halo+ray);
        color*=1.-smoothstep(.4,1.,r);
        // Mark only the luminous footprint for the shared cinema grade.
        gl_FragColor=vec4(color,clamp(core+bloom,0.,1.))*transmission;
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`});
  const mesh=new THREE.Mesh(geometry,material);mesh.name='Distant star / ship sunlight';
  mesh.renderOrder=2;mesh.scale.setScalar(distance*Math.tan(angularRadius));
  const lens=sunLensGhosts();
  const uniforms={source:{value:new THREE.Vector2()},aspect:{value:1},tanHalfFov:{value:1},exposure:{value:0},
    ghosts:{value:lens.ghosts.map(ghost=>new THREE.Vector4(ghost.axis,ghost.radius,ghost.strength,ghost.softness))}};
  const glareMaterial=new THREE.ShaderMaterial({uniforms,transparent:true,depthTest:false,depthWrite:false,
    blending:THREE.CustomBlending,blendSrc:THREE.OneFactor,blendDst:THREE.OneFactor,
    blendSrcAlpha:THREE.OneFactor,blendDstAlpha:THREE.OneMinusSrcAlphaFactor,
    vertexShader:`varying vec2 screen;void main(){screen=position.xy;gl_Position=vec4(position.xy,0.,1.);}`,
    fragmentShader:`
      varying vec2 screen;
      uniform vec2 source;
      uniform float aspect,tanHalfFov,exposure;
      uniform vec4 ghosts[${SUN_GHOST_COUNT}];
      void main(){
        // Lens angles, rather than viewport pixels, keep portrait and DPR stable.
        vec2 d=(screen-source)*vec2(aspect,1.)*tanHalfFov;
        float r=length(d);
        float bloom=exp(-pow(r/.011,1.35))*6.;
        float halo=exp(-r/.065)*.55;
        float veil=exp(-r/.32)*.075;
        // A finite optical streak, with a long soft taper and a true zero tail.
        // Its angular length is independent of the canvas edges and resolution.
        float taper=1.-smoothstep(.09,.23,abs(d.x));
        float streakWidth=.0018+.0017*exp(-pow(d.x/.065,2.));
        float streak=exp(-pow(abs(d.x)/.115,1.25)-pow(d.y/streakWidth,2.))*1.15*taper;
        float shoulder=exp(-abs(d.x)/.09-pow(d.y/.010,2.))*.25*taper;

        vec2 lens=screen*vec2(aspect,1.)*tanHalfFov;
        vec2 light=source*vec2(aspect,1.)*tanHalfFov;
        float offAxis=length(light);
        // The historic 3-group lens supplies separate two-reflection paths.
        vec2 axis=(light+vec2(.00001,0.))/max(length(light+vec2(.00001,0.)),.00001);
        float reflected=0.;
        for(int i=0;i<${SUN_GHOST_COUNT};i++){
          vec4 path=ghosts[i];
          vec2 q=lens-light*path.x;
          float distance=length(q),angle=distance>.000001?atan(q.y,q.x):0.;
          // A softly rounded nine-blade aperture, rather than identical rings.
          float sector=6.28318530718/${EXTERIOR_SUN_LENS.blades}.;
          float polygon=cos(sector*.5)/cos(mod(angle+sector*.5,sector)-sector*.5);
          float aperture=mix(1.,polygon,.65);
          float radius=path.y*(1.+offAxis*.25);
          float radial=distance/(radius*aperture);
          float rim=exp(-pow((radial-1.)/path.w,2.));
          float fill=(1.-smoothstep(.25,1.05,radial))*.16;
          float arc=.18+.82*pow(clamp(.5+.5*dot(q/max(distance,.00001),-axis),0.,1.),1.7);
          reflected+=(rim*arc+fill)*path.z;
        }
        reflected*=.55+.45*smoothstep(.01,.12,offAxis);
        vec3 color=(vec3(1.,.98,.92)*(bloom+halo)+
          vec3(1.,.82,.56)*(veil+streak+shoulder+reflected))*exposure;
        gl_FragColor=vec4(color,clamp(max(color.r,max(color.g,color.b)),0.,1.));
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`});
  const glare=new THREE.Mesh(geometry,glareMaterial);glare.name='Sunlight / veiling glare and anamorphic streak';
  glare.frustumCulled=false;glare.renderOrder=1000;glare.userData.lens={...EXTERIOR_SUN_LENS,paths:lens.paths.length,visibleGhosts:lens.ghosts.length};
  const direction=new THREE.Vector3(),target=new THREE.Vector3(),view=new THREE.Vector3();
  const right=new THREE.Vector3(),up=new THREE.Vector3(),rayDirection=new THREE.Vector3(),ray=new THREE.Raycaster();
  const surfaces=[];ship?.root.traverse(object=>{if(object.isMesh&&object.castShadow&&!Array.isArray(object.material)&&!object.material.transparent)surfaces.push(object);});
  const samples=[[0,0],[-1,0],[1,0],[0,-1],[0,1]];
  return{mesh,glare,
    update(camera){
      const transmission=THREE.MathUtils.clamp(visibility(),0,1);
      material.uniforms.transmission.value=transmission;mesh.visible=transmission>0;
      light.getWorldPosition(direction);light.target.getWorldPosition(target);direction.sub(target).normalize();
      mesh.position.copy(camera.position).addScaledVector(direction,distance);
      mesh.quaternion.copy(camera.quaternion);
      camera.updateMatrixWorld(true);view.copy(direction).transformDirection(camera.matrixWorldInverse);
      uniforms.exposure.value=0;
      glare.visible=view.z<0&&transmission>0;
      if(!glare.visible)return;
      const tanHalfFov=Math.tan(THREE.MathUtils.degToRad(camera.fov/2))/camera.zoom;
      // The image boundary is not a lens hood. Let off-screen light keep
      // producing ghosts, then fade over an angular margin before culling.
      const outsideAngle=Math.max(0,
        Math.atan2(Math.abs(view.x),-view.z)-Math.atan(tanHalfFov*camera.aspect),
        Math.atan2(Math.abs(view.y),-view.z)-Math.atan(tanHalfFov));
      const edgeTransmission=1-THREE.MathUtils.smootherstep(outsideAngle,0,.32);
      glare.visible=edgeTransmission>0;
      if(!glare.visible)return;
      uniforms.aspect.value=camera.aspect;uniforms.tanHalfFov.value=tanHalfFov;
      uniforms.source.value.set(view.x/-view.z/camera.aspect/tanHalfFov,view.y/-view.z/tanHalfFov);
      let visible=1;
      if(ship){
        ship.root.updateMatrixWorld(true);
        right.setFromMatrixColumn(camera.matrixWorld,0);up.setFromMatrixColumn(camera.matrixWorld,1);
        let clear=0;
        for(const [x,y] of samples){
          rayDirection.copy(direction).addScaledVector(right,x*.0005).addScaledVector(up,y*.0005).normalize();
          ray.set(camera.position,rayDirection);ray.far=distance;
          const blocked=ray.intersectObjects(surfaces,false).some(hit=>{
            for(let object=hit.object;object;object=object.parent)if(!object.visible)return false;
            return true;
          });
          if(!blocked)clear++;
        }
        visible=clear/samples.length;
      }
      const gaze=THREE.MathUtils.smoothstep(-view.z,.80,.995);
      uniforms.exposure.value=visible*(.30+.70*gaze)*edgeTransmission*transmission;
    },
    dispose(){mesh.removeFromParent();glare.removeFromParent();geometry.dispose();material.dispose();glareMaterial.dispose();}
  };
}
