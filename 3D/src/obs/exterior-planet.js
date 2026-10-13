import * as THREE from 'three';

// An angular background proxy keeps planetary depth out of the small-scale
// ship's depth buffer. No fetched maps or time-dependent texture generation.
export function createExteriorPlanet(){
  const geometry=new THREE.SphereGeometry(4200,96,64);
  const material=new THREE.ShaderMaterial({
    uniforms:{lightDirection:{value:new THREE.Vector3(64,-110,92).normalize()}},
    vertexShader:`
      varying vec3 vSurface;
      varying vec3 vWorld;
      varying vec3 vNormal;
      void main(){
        vSurface=position;
        vec4 world=modelMatrix*vec4(position,1.0);
        vWorld=world.xyz;vNormal=mat3(modelMatrix)*normal;
        gl_Position=projectionMatrix*viewMatrix*world;
      }`,
    fragmentShader:`
      uniform vec3 lightDirection;
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
        float sun=max(0.0,dot(normal,normalize(lightDirection)));
        color*=.008+sun*1.6;
        float rim=pow(1.0-max(0.0,dot(normal,normalize(cameraPosition-vWorld))),5.0);
        color+=vec3(.055,.135,.20)*rim*(.15+sun*.6);
        gl_FragColor=vec4(color,1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  material.name='Distant blue-grey planet / stationary sunlight';
  const body=new THREE.Mesh(geometry,material);body.name='Planet background';body.visible=false;
  // Stars are an infinite-distance field with no depth writes. Draw this
  // opaque background after them, while keeping the nearer ship's depth.
  body.renderOrder=1;
  return{body,show(position){body.visible=Boolean(position);if(position)body.position.fromArray(position);},
    dispose(){geometry.dispose();material.dispose();}};
}
