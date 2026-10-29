import {Vector3} from 'three';

// km and seconds throughout. Constants: JPL DE440 / IAU astronomical unit.
export const AU_KM=149597870.7;
const SOLAR_MU=1.32712440041279419e11,EARTH_MU=398600.435507;
export const circularPeriod=(radiusKm,mu)=>2*Math.PI*Math.sqrt(radiusKm**3/mu);
export const orbitAngle=(seconds,period)=>((seconds%period+period)%period)/period*2*Math.PI;
const star=Object.freeze({name:'S-01',massSolar:.8,radiusKm:556560,luminositySolar:.4,temperatureK:5100,mu:SOLAR_MU*.8});
const specifications=[
  {id:'rust',name:'S-01 b',kind:'岩石惑星',orbitAU:.75,radiusKm:4200,massEarth:.32,dayHours:30,tilt:18,inclination:0,node:0,phase:0,albedo:.2,color:0xc29a78},
  {id:'current',name:'S-01 c',kind:'海洋惑星',orbitAU:3.6,radiusKm:7200,massEarth:1.4,dayHours:27,tilt:21,inclination:1,node:190,phase:235,albedo:.3,color:0x8fb6cd},
  {id:'ochre',name:'S-01 d',kind:'ガス惑星',orbitAU:1.35,radiusKm:58000,massEarth:105,dayHours:11.4,tilt:7,inclination:2,node:45,phase:55,albedo:.45,color:0xd4be8e},
  {id:'ice',name:'S-01 e',kind:'氷の惑星',orbitAU:7.2,radiusKm:24500,massEarth:15,dayHours:18,tilt:28,inclination:4,node:290,phase:310,albedo:.5,color:0xbbdce4}
];
const planets=Object.freeze(specifications.map(p=>Object.freeze({...p,
  orbitKm:p.orbitAU*AU_KM,mu:p.massEarth*EARTH_MU,
  periodSeconds:circularPeriod(p.orbitAU*AU_KM,star.mu+p.massEarth*EARTH_MU)
})));
export const EXTERIOR_SYSTEM=Object.freeze({
  name:'S-01 恒星系',region:'架空銀河・外縁域',epoch:Date.UTC(2026,9,16,8)/1000,
  star,planets,
  shipOrbit:Object.freeze({radiusKm:13600,periodSeconds:circularPeriod(13600,planets[0].mu)})
});

// An analytic hierarchy of circular Kepler orbits, not a many-body integrator.
// Each planet orbits the luminous star. The observer orbits planet b. Render
// coordinates are derived later; no AU-sized Float32 positions enter WebGL.
export function createExteriorEphemeris({sunDirection=new Vector3(64,-110,92),planetDirection,clock=()=>Date.now()/1000}={}){
  const radial=sunDirection.clone().normalize().negate();
  const normal=new Vector3(0,1,0).addScaledVector(radial,-radial.y).normalize();
  const tangent=new Vector3().crossVectors(normal,radial).normalize();
  const observerOffset=(planetDirection?.clone()??radial.clone()).normalize().negate().multiplyScalar(EXTERIOR_SYSTEM.shipOrbit.radiusKm);
  const shipNormal=normal.clone().addScaledVector(observerOffset,-normal.dot(observerOffset)/observerOffset.lengthSq()).normalize();
  const frame={time:0,star:new Vector3(),observer:new Vector3(),planetPositions:planets.map(()=>new Vector3()),spinAngles:planets.map(()=>0)};
  function planetPosition(index,time,out){
    const p=planets[index],theta=orbitAngle(time-EXTERIOR_SYSTEM.epoch,p.periodSeconds)+p.phase*Math.PI/180;
    return out.copy(radial).multiplyScalar(Math.cos(theta)*p.orbitKm)
      .addScaledVector(tangent,Math.sin(theta)*p.orbitKm)
      .applyAxisAngle(radial,p.inclination*Math.PI/180).applyAxisAngle(normal,p.node*Math.PI/180);
  }
  return{normal,radial,tangent,planetPosition,
    sample(time=clock()){
      frame.time=time;const elapsed=time-EXTERIOR_SYSTEM.epoch;
      planets.forEach((p,i)=>{planetPosition(i,time,frame.planetPositions[i]);frame.spinAngles[i]=orbitAngle(elapsed,p.dayHours*3600);});
      frame.observer.copy(observerOffset).applyAxisAngle(shipNormal,orbitAngle(elapsed,EXTERIOR_SYSTEM.shipOrbit.periodSeconds)).add(frame.planetPositions[0]);
      return frame;
    }
  };
}

// Fraction of the stellar disc left visible during a planetary transit.
export function visibleDiscFraction(sourceRadius,occluderRadius,separation){
  const r=sourceRadius,R=occluderRadius,d=separation;
  if(d>=r+R)return 1;
  if(d<=Math.abs(R-r))return R>=r?0:1-R*R/(r*r);
  const overlap=r*r*Math.acos(Math.max(-1,Math.min(1,(d*d+r*r-R*R)/(2*d*r))))
    +R*R*Math.acos(Math.max(-1,Math.min(1,(d*d+R*R-r*r)/(2*d*R))))
    -.5*Math.sqrt(Math.max(0,(-d+r+R)*(d+r-R)*(d-r+R)*(d+r+R)));
  return Math.max(0,Math.min(1,1-overlap/(Math.PI*r*r)));
}
