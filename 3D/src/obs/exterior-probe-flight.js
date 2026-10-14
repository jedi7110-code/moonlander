const clamp=value=>Math.max(0,Math.min(1,value));
// Brief visual tail so the nozzle cut-off and outward-clearing gas remain
// readable at normal frame rates. This is not the molecular exhaust speed.
export const PROBE_EXHAUST_TAIL=.14;
const smooth=value=>value*value*value*(value*(value*6-15)+10);
const hermite=(from,to,outgoing,incoming,u)=>{
  const u2=u*u,u3=u2*u;
  return(2*u3-3*u2+1)*from+(u3-2*u2+u)*outgoing+(-2*u3+3*u2)*to+(u3-u2)*incoming;
};

export function probeApproachLane(coreScale=2.6){
  const dockX=12*coreScale-1.6;
  // Keep the approach ahead of the rotating habitat even with a smaller hull.
  return Math.max(4,20-dockX);
}

// The wide approach and close docking are one continuous flight. The shared
// clock is sampled by both cameras during their cross dissolve.
function sampleProbePose(seconds,{approachDuration=8,captureDuration=12,coreScale=2.6}={}){
  const lane=probeApproachLane(coreScale),arrivalTangent=6.4;
  if(seconds<approachDuration){
    const u=clamp(seconds/approachDuration),departureTangent=1.8*173;
    const y=seconds<0?-180+seconds*departureTangent/approachDuration:hermite(-180,-7,departureTangent,arrivalTangent,u);
    return{visible:true,position:[lane,y,0],rotation:[0,.10,-.035],latched:false};
  }
  const u=clamp((seconds-approachDuration)/captureDuration);
  if(u===1)return{visible:true,position:[0,0,0],rotation:[0,0,0],latched:true};
  const remaining=1-smooth(u);
  return{visible:true,
    position:[lane*remaining**3,hermite(-7,0,arrivalTangent*captureDuration/approachDuration,0,u),0],
    rotation:[0,.10*remaining**2,-.035*remaining**2],latched:u===1};
}

// The edit advances the old capture clock to reach the approved close-up.
// Applying that warp to vertical flight made the craft accelerate, then brake
// almost all at once. Plan braking directly on the film clock instead: ease
// the closing velocity down over the entire approach and match capture's
// position, velocity and acceleration at the join. The film compresses real
// rendezvous time; its metre-per-film-second values are not real flight speeds.
function sampleControlledPose(seconds,{advance=0,approachDuration=8,captureDuration=12,coreScale=2.6}={}){
  const options={approachDuration,captureDuration,coreScale};
  const u=clamp(seconds/approachDuration);
  const pose=sampleProbePose(seconds+advance*smooth(u),options);
  if(seconds>=approachDuration)return pose;
  const captureU=clamp(advance/captureDuration),tangent=6.4*captureDuration/approachDuration;
  const end=hermite(-7,0,tangent,0,captureU);
  const endVelocity=((6*captureU*captureU-6*captureU)*-7+(3*captureU*captureU-4*captureU+1)*tangent)/captureDuration;
  const endAcceleration=((12*captureU-6)*-7+(6*captureU-4)*tangent)/(captureDuration*captureDuration);
  // Start a little nearer so the probe enters scene 03 earlier, while the
  // same velocity/acceleration conditions still join the approved close-up.
  const initial=-140,entryVelocity=2*(end-initial)/approachDuration-endVelocity;
  // Integral of quintic smoothstep; accelerating/decelerating thrust ramps
  // smoothly at each end. The small correction matches capture acceleration.
  const integral=u**4*(2.5-3*u+u*u);
  pose.position[1]=seconds<0?initial+seconds*entryVelocity:
    initial+approachDuration*(entryVelocity*u+(endVelocity-entryVelocity)*integral)+
    .5*endAcceleration*approachDuration**2*u**3*(1-u)**2;
  return pose;
}

export function sampleExteriorProbeFlight(seconds,{approachDuration=8,captureDuration=12,coreScale=2.6,controlTime=seconds,controlAdvance=0}={}){
  const options={approachDuration,captureDuration,coreScale};
  const pose=sampleControlledPose(controlTime,{...options,advance:controlAdvance});
  const contactTime=approachDuration+captureDuration-controlAdvance;
  if(!pose.latched||controlTime<contactTime+PROBE_EXHAUST_TAIL)
    pose.thrusterClock={seconds:controlTime,advance:controlAdvance,...options};
  return pose;
}

export function sampleExteriorProbeKinematics(seconds,{advance=0,...options}={}){
  // Differentiate the exact displayed path, including lateral/attitude capture,
  // so opposing gas jets remain synchronized with the planned braking.
  const sample=time=>sampleControlledPose(time,{...options,advance});
  const step=.01,pose=sample(seconds),before=sample(seconds-step),after=sample(seconds+step);
  const velocity=pose.position.map((value,i)=>(after.position[i]-before.position[i])/(2*step));
  const acceleration=pose.position.map((value,i)=>(after.position[i]-2*value+before.position[i])/(step*step));
  const angularAcceleration=pose.rotation.map((value,i)=>(after.rotation[i]-2*value+before.rotation[i])/(step*step));
  return{pose,velocity,acceleration,angularAcceleration};
}

export function applyExteriorProbePose(ship,pose){
  if(!ship.dockedLander)return;
  ship.dockedLander.visible=pose.visible;
  ship.dockedLander.position.fromArray(pose.position);
  ship.dockedLander.rotation.fromArray(pose.rotation);
  ship.probeThrusters?.update(pose);
}
