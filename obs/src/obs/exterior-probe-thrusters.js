import * as THREE from 'three';
import {sampleExteriorProbeKinematics,PROBE_EXHAUST_TAIL} from './exterior-probe-flight.js';

// Free expansion: angular spread with inverse-square dilution, rather than
// the game's screen-facing beads. The visibility gain is an artistic aid;
// this is a cold-gas density visualization, not a combustion/emission model.
export const PROBE_GAS=Object.freeze({length:3.4,width:4.8,speed:3.4/PROBE_EXHAUST_TAIL,slices:48,spread:.31,
  pulsePeriod:.28,valveRamp:.009,opticalGain:2.7});
const normalize=values=>{const length=Math.hypot(...values);return values.map(value=>value/length);};
export const PROBE_JETS=Object.freeze([
  ...[-1,1].flatMap(side=>[-1,1].map(front=>({id:`brake-${side}-${front}`,kind:'brake',side,front,
    position:[side*1.65,2.85,front*1.42],direction:normalize([side*.55,1,front*.55]),nozzle:true}))),
  ...[-1,1].flatMap(side=>[-1,1].map(front=>({id:`lateral-${side}-${front}`,kind:'lateral',side,front,
    position:[side*2.0,3.10,front*.48],direction:[side,0,0],nozzle:true}))),
  {id:'ascent',kind:'ascent',position:[0,.39,0],direction:[0,-1,0],nozzle:false},
]);
const power=(force,scale)=>force>0?1-Math.exp(-force/scale):0;
const clamp=value=>Math.max(0,Math.min(1,value));
function controlFor(motion){
  if(motion.pose.latched)return PROBE_JETS.map(()=>0);
  return PROBE_JETS.map(jet=>{
    if(jet.kind==='brake'){
      const roll=power(Math.abs(motion.angularAcceleration[2]),.002)*Math.sign(motion.angularAcceleration[2]);
      return clamp(power(-motion.acceleration[1],.1)-jet.side*roll*.45);
    }
    if(jet.kind==='lateral')return clamp(power(-jet.side*motion.acceleration[0],.09)+
      .5*power(-jet.side*jet.front*motion.angularAcceleration[1],.005));
    return power(motion.acceleration[1],.12);
  });
}
export function sampleExteriorProbeControl(seconds,options={}){
  const motion=sampleExteriorProbeKinematics(seconds,options);
  return{...motion,strengths:controlFor(motion)};
}
const orientation=rotation=>new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation));
const smooth=value=>{const u=clamp(value);return u*u*(3-2*u);};
function valve(strength,seconds,index){
  if(strength<.015||seconds<0)return 0;
  // Strong braking is sustained; fine corrections use short valve openings.
  // Duty changes with force, while average pulse amplitude follows force.
  const duty=.28+.72*strength,period=PROBE_GAS.pulsePeriod;
  const phase=(seconds+index*.037)%period,on=duty*period;
  return Math.min(1,strength/duty)*smooth(phase/PROBE_GAS.valveRamp)*
    (duty>.995?1:smooth((on-phase)/PROBE_GAS.valveRamp));
}

// Retarded emission along the plume: gas leaves its birth pose with the
// probe's inherited velocity and keeps flying freely, even during rotation.
// All slices share the film clock, so both dissolve views and rewinds agree.
export function sampleExteriorProbeGas(seconds,options={}){
  const contactTime=(options.approachDuration??8)+(options.captureDuration??12)-(options.advance??0);
  if(seconds<0||seconds>=contactTime+PROBE_EXHAUST_TAIL)return[];
  const current=sampleExteriorProbeControl(seconds,options);
  const inverse=orientation(current.pose.rotation).invert(),currentPosition=new THREE.Vector3(...current.pose.position);
  const history=Array.from({length:PROBE_GAS.slices},(_,slice)=>{
    const distance=slice*PROBE_GAS.length/(PROBE_GAS.slices-1),age=distance/PROBE_GAS.speed,birth=seconds-age;
    const motion=sampleExteriorProbeControl(birth,options);
    return{distance,age,birth,motion,rotation:orientation(motion.pose.rotation)};
  });
  return PROBE_JETS.map((jet,index)=>{
    const axis=new THREE.Vector3(...jet.direction),basis=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),axis).invert();
    const slices=history.map(({distance,age,birth,motion,rotation})=>{
      const position=new THREE.Vector3(...jet.position).addScaledVector(axis,distance).applyQuaternion(rotation)
        .add(new THREE.Vector3(...motion.pose.position)).addScaledVector(new THREE.Vector3(...motion.velocity),age)
        .sub(currentPosition).applyQuaternion(inverse).sub(new THREE.Vector3(...jet.position)).applyQuaternion(basis);
      const thinning=1-smooth(age/PROBE_EXHAUST_TAIL);
      return{distance,strength:valve(motion.strengths[index],birth,index)*thinning,offset:[position.x,position.y-distance,position.z]};
    });
    return{jet:jet.id,index,slices};
  }).filter(plume=>plume.slices.some(slice=>slice.strength>.001));
}

export function createExteriorProbeThrusters(lander,{nozzleMaterial,rimMaterial}){
  const root=new THREE.Group();root.name='Probe cold-gas attitude control';root.userData.bakeBoundary=true;lander.add(root);
  // Closed metal shell, lip annulus, inner wall and recessed throat. The old
  // one-sided open cylinder disappeared when seen from inside its outlet.
  const nozzleGeometry=new THREE.LatheGeometry([
    [.085,-.08],[.045,.08],[0,.08],[0,.045],[.033,.045],[.073,-.08],[.085,-.08],
  ].map(([radius,y])=>new THREE.Vector2(radius,y)),10);
  const rimGeometry=new THREE.TorusGeometry(.085,.012,5,12);
  const physicalJets=PROBE_JETS.filter(jet=>jet.nozzle);
  const nozzles=new THREE.InstancedMesh(nozzleGeometry,nozzleMaterial,physicalJets.length),rims=new THREE.InstancedMesh(rimGeometry,rimMaterial,physicalJets.length);
  nozzles.name='Cold-gas nozzles';rims.name='Cold-gas nozzle lips';root.add(nozzles,rims);
  const matrix=new THREE.Matrix4(),rotation=new THREE.Quaternion(),unitScale=new THREE.Vector3(1,1,1);
  for(const [index,jet]of physicalJets.entries()){
    const direction=new THREE.Vector3(...jet.direction),lip=new THREE.Vector3(...jet.position);
    rotation.setFromUnitVectors(new THREE.Vector3(0,-1,0),direction);
    matrix.compose(lip.clone().addScaledVector(direction,-.08),rotation,unitScale);nozzles.setMatrixAt(index,matrix);
    rotation.setFromUnitVectors(new THREE.Vector3(0,0,1),direction);
    matrix.compose(lip,rotation,unitScale);rims.setMatrixAt(index,matrix);
  }
  nozzles.instanceMatrix.needsUpdate=true;rims.instanceMatrix.needsUpdate=true;
  // One instanced box per nozzle, containing a ray-integrated density field.
  // Boxes are only integration bounds: their surfaces are never shaded.
  const geometry=new THREE.BoxGeometry(1,1,1);
  geometry.setAttribute('plumeIndex',new THREE.InstancedBufferAttribute(Float32Array.from(PROBE_JETS,(_,i)=>i),1));
  const data=new Float32Array(PROBE_GAS.slices*PROBE_JETS.length*4);
  const history=new THREE.DataTexture(data,PROBE_GAS.slices,PROBE_JETS.length,THREE.RGBAFormat,THREE.FloatType);
  history.minFilter=history.magFilter=THREE.NearestFilter;history.generateMipmaps=false;history.needsUpdate=true;
  const material=new THREE.ShaderMaterial({name:'Vacuum control gas / volumetric density',transparent:true,
    depthWrite:false,side:THREE.BackSide,toneMapped:false,
    uniforms:{history:{value:history},plumeSize:{value:new THREE.Vector3(PROBE_GAS.width,PROBE_GAS.length,PROBE_GAS.width)},
      opticalGain:{value:PROBE_GAS.opticalGain},spread:{value:PROBE_GAS.spread},
      sceneDepth:{value:null},depthEnabled:{value:false},viewport:{value:new THREE.Vector2(1,1)},cameraRange:{value:new THREE.Vector2(.1,2400)}},
    vertexShader:`
      attribute float plumeIndex;
      varying vec3 rayOrigin; varying vec3 rayExit; varying float jetIndex; varying float exitViewZ;
      void main(){
        mat4 view=modelViewMatrix*instanceMatrix;
        vec3 translation=-view[3].xyz;
        rayOrigin=vec3(dot(translation,view[0].xyz)/dot(view[0].xyz,view[0].xyz),
          dot(translation,view[1].xyz)/dot(view[1].xyz,view[1].xyz),
          dot(translation,view[2].xyz)/dot(view[2].xyz,view[2].xyz));
        rayExit=position;jetIndex=plumeIndex;
        exitViewZ=(view*vec4(position,1.0)).z;
        gl_Position=projectionMatrix*view*vec4(position,1.0);
      }`,
    fragmentShader:`
      uniform sampler2D history; uniform vec3 plumeSize; uniform float opticalGain; uniform float spread;
      uniform sampler2D sceneDepth; uniform bool depthEnabled; uniform vec2 viewport; uniform vec2 cameraRange;
      varying vec3 rayOrigin; varying vec3 rayExit; varying float jetIndex; varying float exitViewZ;
      vec4 emission(float u){
        float sampleIndex=clamp(u,0.0,1.0)*${PROBE_GAS.slices-1}.0;
        float low=floor(sampleIndex),row=(jetIndex+.5)/${PROBE_JETS.length}.0;
        vec4 a=texture2D(history,vec2((low+.5)/${PROBE_GAS.slices}.0,row));
        vec4 b=texture2D(history,vec2((min(low+1.0,${PROBE_GAS.slices-1}.0)+.5)/${PROBE_GAS.slices}.0,row));
        return mix(a,b,fract(sampleIndex));
      }
      void main(){
        vec3 direction=normalize(rayExit-rayOrigin);
        vec3 safeDirection=(step(vec3(0.0),direction)*2.0-1.0)*max(abs(direction),vec3(.00001));
        vec3 t0=(-vec3(.5)-rayOrigin)/safeDirection,t1=(vec3(.5)-rayOrigin)/safeDirection;
        vec3 enter=min(t0,t1),leave=max(t0,t1);
        float start=max(0.0,max(enter.x,max(enter.y,enter.z)));
        float end=min(leave.x,min(leave.y,leave.z));
        // Clip the integration at the actual opaque surface, rather than
        // depth-testing the box's far wall and losing gas in front of it.
        if(depthEnabled){
          float depth=texture2D(sceneDepth,gl_FragCoord.xy/viewport).r;
          float surfaceZ=-cameraRange.x*cameraRange.y/(cameraRange.y-depth*(cameraRange.y-cameraRange.x));
          end=min(end,length(rayExit-rayOrigin)*surfaceZ/exitViewZ);
        }
        if(end<=start)discard;
        float stepSize=(end-start)/64.0;
        float physicalStep=length(direction*plumeSize)*stepSize,opticalDepth=0.0;
        for(int i=0;i<64;i++){
          vec3 point=(rayOrigin+direction*(start+(float(i)+.5)*stepSize))*plumeSize;
          float distance=point.y+plumeSize.y*.5;
          vec4 state=emission(distance/plumeSize.y);
          distance-=state.b;
          float radius=.055+max(0.0,distance)*spread;
          float radial=length(point.xz-state.ga)/radius;
          float dilution=pow(.18/(.18+max(0.0,distance)),2.0);
          float edge=smoothstep(0.0,.025,distance)*(1.0-smoothstep(plumeSize.y*.72,plumeSize.y,distance));
          opticalDepth+=state.r*exp(-radial*radial*1.5)*dilution*edge*physicalStep;
        }
        float alpha=1.0-exp(-opticalDepth*opticalGain);
        if(alpha<.001)discard;
        // Neutral scattered-light appearance; no flame, additive glow or dots.
        gl_FragColor=vec4(.76,.82,.87,alpha);
      }`});
  const gas=new THREE.InstancedMesh(geometry,material,PROBE_JETS.length);gas.name='Free-expanding vacuum gas';
  gas.frustumCulled=false;gas.visible=false;
  // Render-only volume must not enlarge the physical probe's bounds/collisions.
  gas.boundingBox=new THREE.Box3();root.add(gas);
  const volumeScale=new THREE.Vector3(PROBE_GAS.width,PROBE_GAS.length,PROBE_GAS.width);
  for(const [index,jet]of PROBE_JETS.entries()){
    const direction=new THREE.Vector3(...jet.direction);
    rotation.setFromUnitVectors(new THREE.Vector3(0,1,0),direction);
    matrix.compose(new THREE.Vector3(...jet.position).addScaledVector(direction,PROBE_GAS.length/2),rotation,volumeScale);
    gas.setMatrixAt(index,matrix);
  }
  gas.instanceMatrix.needsUpdate=true;
  return{root,gas,dispose(){history.dispose();},update(pose){
    if(!pose.visible||!pose.thrusterClock){gas.visible=false;return;}
    const {seconds,...options}=pose.thrusterClock,plumes=sampleExteriorProbeGas(seconds,options);
    gas.visible=plumes.length>0;data.fill(0);
    for(const plume of plumes)for(const [slice,state]of plume.slices.entries()){
      const offset=(plume.index*PROBE_GAS.slices+slice)*4;
      data[offset]=state.strength;data.set(state.offset,offset+1);
    }
    history.needsUpdate=true;
  }};
}
