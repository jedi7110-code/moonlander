import {AdditiveBlending,BufferGeometry,Float32BufferAttribute,Mesh,ShaderMaterial} from 'three';

// Soft glass glow inside seven recessed apertures, not a full-screen bloom pass.
// One draw, depth-tested behind the bezels: never paint a halo over a front panel.
export function createScreenGlow(){
  const positions=[],uvs=[],indices=[];
  const panels=[
    [-10.3,8.514,-.445,.9984,.61],[-8.67,8.514,-.445,.9984,.61],[-7.04,8.514,-.445,.9984,.61],
    ...Array.from({length:4},(_,i)=>[-4.57,7.574+i*.42,-1.295,1.16,.27]),
  ];
  for(const [x,y,z,w,h] of panels){
    const offset=positions.length/3;
    for(const [u,v] of [[0,0],[1,0],[1,1],[0,1]]){positions.push(x+(u-.5)*w,y+(v-.5)*h,z);uvs.push(u,v);}
    indices.push(offset,offset+1,offset+2,offset,offset+2,offset+3);
  }
  const geometry=new BufferGeometry();
  geometry.setAttribute('position',new Float32BufferAttribute(positions,3));
  geometry.setAttribute('uv',new Float32BufferAttribute(uvs,2));geometry.setIndex(indices);
  const material=new ShaderMaterial({
    name:'Telemetry soft green halo',transparent:true,depthTest:true,depthWrite:false,
    blending:AdditiveBlending,toneMapped:false,
    vertexShader:`varying vec2 vGlowUv;
      void main(){vGlowUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
    fragmentShader:`varying vec2 vGlowUv;
      void main(){
        vec2 p=vGlowUv*2.0-1.0;
        float radius=length(p);
        float glow=exp(-dot(p,p)*3.8)*(1.0-smoothstep(0.65,1.0,radius));
        gl_FragColor=vec4(vec3(0.12,0.52,0.26),glow*0.16);
        #include <colorspace_fragment>
      }`,
  });
  const mesh=new Mesh(geometry,material);mesh.name='Telemetry screen halos';
  mesh.castShadow=false;mesh.receiveShadow=false;mesh.raycast=()=>{};
  return mesh;
}
