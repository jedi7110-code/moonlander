import {crewWalkway} from './cabin-walkway.js';

export const CREW_CLEARANCE=.72,CAT_CLEARANCE=.62;
export const worldActor=a=>({x:(a.x-700)*.022,y:(870-a.y)*.016,z:crewWalkway((a.x-700)*.022,a.floor,a.facing,a.loungeAvoidance).z});
export const worldCat=m=>({x:(m.x-700)*.022,y:(870-m.y)*.016,z:m.z});
export const close=(a,b,r)=>Math.abs(a.y-b.y)<1.4&&Math.hypot(a.x-b.x,a.z-b.z)<r;
// Permit an already-close actor to leave, but never to move farther into a body.
export function approaches(from,to,obstacle,r){
  if(Math.abs(to.y-obstacle.y)>=1.4)return false;
  const before=Math.hypot(from.x-obstacle.x,from.z-obstacle.z),after=Math.hypot(to.x-obstacle.x,to.z-obstacle.z);
  return after<r&&after<before+1e-8;
}
export function nextActor(a,dt){
  const from=worldActor(a),s=a.queue?.[0];
  if(s?.type!=='walk')return from;
  const x=a.x+Math.sign(s.x-a.x)*Math.min(Math.abs(s.x-a.x),a.walkStep?.(dt)??a.walkSpeed*dt);
  return worldActor({...a,x});
}
export function nextDroid(d,dt){
  const s=d.step;if(!s?.to)return d.position;
  const u=Math.min(1,(d.age+dt)/s.duration);
  return Object.fromEntries(['x','y','z'].map(k=>[k,s.from[k]+(s.to[k]-s.from[k])*u]));
}
