const clamp=value=>Math.max(0,Math.min(1,value));
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
export function sampleExteriorProbeFlight(seconds,{approachDuration=8,captureDuration=12,coreScale=2.6}={}){
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

export function applyExteriorProbePose(ship,pose){
  ship.dockedLander.visible=pose.visible;
  ship.dockedLander.position.fromArray(pose.position);
  ship.dockedLander.rotation.fromArray(pose.rotation);
}
