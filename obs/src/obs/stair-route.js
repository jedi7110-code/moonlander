import * as THREE from 'three';
const V=(...v)=>new THREE.Vector3(...v),clamp=THREE.MathUtils.clamp;
import {CABIN_FLOOR_Y} from './layout.js';

export const STAIRS=Object.freeze({right:-13.3,left:-15.91,outerLeft:-17.76,front:1.6,back:-.3,width:1.4,radius:.95,tread:.29,risers:20,rise:(CABIN_FLOOR_Y[0]-CABIN_FLOOR_Y[1])/20,headroom:2.10});
const mix=(a,b,t)=>a+(b-a)*t;
const smooth=t=>t*t*(3-2*t);
const segments=[];
const line=(a,b,kind='landing',extra={})=>segments.push({a,b,kind,length:Math.hypot(...a.map((v,i)=>b[i]-v)),...extra});
line([-11.85,0,STAIRS.front],[STAIRS.right,0,STAIRS.front]);
for(let level=0;level<2;level++){
  const y=level*STAIRS.rise*20;
  line([STAIRS.right,y,STAIRS.front],[STAIRS.left,y+STAIRS.rise*10,STAIRS.front],'flight',{level,half:0});
  segments.push({kind:'turn',left:true,x:STAIRS.left,y:y+STAIRS.rise*10,length:Math.PI*STAIRS.radius});
  line([STAIRS.left,y+STAIRS.rise*10,STAIRS.back],[STAIRS.right,y+STAIRS.rise*20,STAIRS.back],'flight',{level,half:1});
  segments.push({kind:'turn',left:false,x:STAIRS.right,y:y+STAIRS.rise*20,length:Math.PI*STAIRS.radius});
}
line([STAIRS.right,CABIN_FLOOR_Y[0],STAIRS.front],[-11.85,CABIN_FLOOR_Y[0],STAIRS.front]);
let offset=0;
export const STAIR_SEGMENTS=Object.freeze(segments.map(s=>{const out={...s,start:offset,end:offset+s.length};offset+=s.length;return Object.freeze(out);}));
export const STAIR_ROUTE_LENGTH=offset;
// The top flight is at the rear. Start the robot on its approach, instead of
// walking toward the guarded front edge where no downward stair exists.
export const ROBOT_ROUTE_LENGTH=STAIR_SEGMENTS.filter(s=>s.kind==='flight').at(-1).end+.55;
export const stairRouteLength=id=>id==='robot'?ROBOT_ROUTE_LENGTH:STAIR_ROUTE_LENGTH;

// Continuous floor path at the upper exit instead of the route's cusp (the
// last turn ends heading back toward the stairs). Walkers that place feet use
// walkPoint; the robot and the traffic spacing keep the plain route.
export const EXIT_START=STAIR_SEGMENTS.at(-2).start;

// The
// curve is shorter than the route it replaces, so it is walked at arc-length
// speed that starts at the route speed and eases down toward the stop.
const EXIT=[V(STAIRS.right,STAIRS.rise*40,STAIRS.back),V(-12.1,STAIRS.rise*40,STAIRS.back),V(-12.8,STAIRS.rise*40,STAIRS.front),V(-11.85,STAIRS.rise*40,STAIRS.front)];
function bezier(t){
  const u=1-t,[a,b,c,d]=EXIT;
  return {p:a.clone().multiplyScalar(u*u*u).addScaledVector(b,3*u*u*t).addScaledVector(c,3*u*t*t).addScaledVector(d,t*t*t),
    tangent:b.clone().sub(a).multiplyScalar(3*u*u).addScaledVector(c.clone().sub(b),6*u*t).addScaledVector(d.clone().sub(c),3*t*t).normalize()};
}
const EXIT_ARC=(()=>{const n=400,arc=[0];for(let i=1;i<=n;i++)arc.push(arc[i-1]+bezier(i/n).p.distanceTo(bezier((i-1)/n).p));return arc;})();
function exitParameter(fraction){
  const arc=EXIT_ARC,n=arc.length-1,target=fraction*arc[n];let lo=0,hi=n;
  while(hi-lo>1){const m=(lo+hi)>>1;if(arc[m]<=target)lo=m;else hi=m;}
  return (lo+(target-arc[lo])/Math.max(1e-9,arc[hi]-arc[lo]))/n;
}
export function walkPoint(distance){
  if(distance<EXIT_START)return stairPoint(distance);
  const t=clamp((distance-EXIT_START)/(STAIR_ROUTE_LENGTH-EXIT_START),0,1),k0=(STAIR_ROUTE_LENGTH-EXIT_START)/EXIT_ARC.at(-1),k1=.5;
  const fraction=(t*t*t-2*t*t+t)*k0+(-2*t*t*t+3*t*t)+(t*t*t-t*t)*k1; // Hermite: route speed in, slower out
  const {p,tangent}=bezier(exitParameter(clamp(fraction,0,1)));
  return {x:p.x,y:p.y,z:p.z,dx:tangent.x,dz:tangent.z,kind:'landing'};
}

// The crew's own exit path, laid out directly on the walking lane (0.32 m
// right of the route): the cat curve offset by a lane would pinch to a ~0.1 m
// inner radius. Two quarter turns of radius 0.70 m joined by straights, walked
// at constant speed. Up: off the last flight, across to the front aisle; down:
// the same in reverse into the top of the last flight.
export const HUMAN_EXIT=(()=>{
  const R=.70,lane=.32,top=stairPoint(STAIR_ROUTE_LENGTH),start=stairPoint(EXIT_START);
  const path=(from,to,heading)=>{
    const shift=to.z-from.z,run=Math.abs(to.x-from.x);
    return {from,heading,sz:Math.sign(shift),cross:Math.abs(shift)-2*R,run:run-2*R,R,y:top.y,length:Math.PI*R+Math.abs(shift)-2*R+run-2*R};
  };
  return {
    up:path({x:start.x,z:start.z-lane},{x:top.x,z:top.z-lane},1),
    down:path({x:top.x,z:top.z+lane},{x:start.x,z:start.z+lane},-1),
  };
})();
export function humanExitPoint(arc,direction){
  const e=direction>0?HUMAN_EXIT.up:HUMAN_EXIT.down,{R,sz,from}=e,sx=e.heading,q=R*Math.PI/2;
  let a=clamp(arc,0,e.length),x,z,dx,dz;
  if(a<q){const t=a/R;x=from.x+sx*R*Math.sin(t);z=from.z+sz*R*(1-Math.cos(t));dx=sx*Math.cos(t);dz=sz*Math.sin(t);}
  else if((a-=q)<e.cross){x=from.x+sx*R;z=from.z+sz*(R+a);dx=0;dz=sz;}
  else if((a-=e.cross)<q){const t=a/R;x=from.x+sx*R*(2-Math.cos(t));z=from.z+sz*(R+e.cross+R*Math.sin(t));dx=sx*Math.sin(t);dz=sz*Math.cos(t);}
  else{a-=q;x=from.x+sx*(2*R+a);z=from.z+sz*(2*R+e.cross);dx=sx;dz=0;}
  return {x,y:e.y,z,dx,dz,kind:'landing'};
}

export function stairPoint(distance,{contact=false}={}){
  const d=Math.max(0,Math.min(STAIR_ROUTE_LENGTH,distance));
  const segment=STAIR_SEGMENTS.find(s=>d<s.end-1e-10)??STAIR_SEGMENTS.at(-1);
  const u=Math.max(0,Math.min(1,(d-segment.start)/segment.length));
  if(segment.kind==='turn'){
    const theta=u*Math.PI,sign=segment.left?-1:1;
    return {x:segment.x+sign*STAIRS.radius*Math.sin(theta),y:segment.y,z:.65-sign*STAIRS.radius*Math.cos(theta),
      dx:sign*Math.cos(theta),dz:sign*Math.sin(theta),pitch:0,kind:'landing',segment};
  }
  let point=segment.a.map((v,i)=>mix(v,segment.b[i],u));
  const sign=Math.sign(segment.b[0]-segment.a[0])||-1;
  if(contact&&segment.kind==='flight'){
    const step=Math.min(9,Math.floor(u*9)+1);
    point=[segment.a[0]+sign*(step-.5)*STAIRS.tread,segment.a[1]+step*STAIRS.rise,segment.a[2]];
  }
  const pitch=segment.kind==='flight'?Math.atan2(segment.b[1]-segment.a[1],Math.abs(segment.b[0]-segment.a[0])):0;
  return{x:point[0],y:point[1],z:point[2],dx:sign,dz:0,pitch,kind:segment.kind,segment};
}

export function stairContact(distance,direction=1,lateral=0){
  const p=stairPoint(distance,{contact:true}),dx=p.dx*direction,dz=p.dz*direction;
  return {...p,x:p.x+dz*lateral,z:p.z-dx*lateral,dx,dz,yaw:Math.atan2(dx,dz)};
}

export function stairFoot(distance,direction,side,{cycle=.65,stance=.62,forward=0,lane=.32,spread=.10,lift=.16,phase=side<0?.5:0}={}){
  const travel=direction>0?distance:STAIR_ROUTE_LENGTH-distance;
  const q=(travel+forward)/cycle+phase,index=Math.floor(q),u=q-index;
  const plantTravel=(index-phase)*cycle+cycle*.28;
  const swing=u<stance?0:(u-stance)/(1-stance);
  const a=stairContact(direction>0?plantTravel:STAIR_ROUTE_LENGTH-plantTravel,direction,lane+side*spread);
  const b=stairContact(direction>0?plantTravel+cycle:STAIR_ROUTE_LENGTH-plantTravel-cycle,direction,lane+side*spread);
  const t=smooth(swing);
  return {x:mix(a.x,b.x,t),y:mix(a.y,b.y,t)+Math.sin(Math.PI*swing)*lift,z:mix(a.z,b.z,t),planted:u<stance,phase:u,swing};
}

// Crew pace on the flights from measured stair cadence with one tread per
// step (~90 steps/min up, ~105 down; studies/stairs/human-motion-research.md), blended in
// over the floor next to each flight. The cabin floor pace stays 0.66 m/s.
// `up` / `down` are relative to `floor`, the pace of the stair study. In the
// cabin the crew walks faster; a trip (stair-trip.js) keeps the same absolute
// speed on the flights and no more than `landing` between two flights.
export const HUMAN_PACE=Object.freeze({up:.52/.66,down:.60/.66,blend:.9,floor:.66,landing:.72});
export function humanPace(distance,direction){
  let gap=Infinity,cos=1;
  for(const s of STAIR_SEGMENTS)if(s.kind==='flight'){const g=Math.max(s.start-distance,0,distance-s.end);if(g<gap){gap=g;cos=Math.abs(s.b[0]-s.a[0])/s.length;}}
  const w=1-smooth(Math.min(1,gap/HUMAN_PACE.blend));
  // the route speed on a flight is measured along the slope; on the floor next
  // to it the target is the same horizontal speed, so the walker does not
  // jolt forward or back where the stair begins or ends
  const flight=(direction>0?HUMAN_PACE.up:HUMAN_PACE.down)*(gap>0?cos:1);
  // On a turn the lane is offset from the route, and the crew exit path is
  // shorter than the route it replaces: keep the walked speed, not the route
  // speed.
  let turn=1;const seg=STAIR_SEGMENTS.find(s=>distance>=s.start&&distance<s.end);
  if(distance>=EXIT_START)turn=(STAIR_ROUTE_LENGTH-EXIT_START)/(direction>0?HUMAN_EXIT.up:HUMAN_EXIT.down).length;
  else if(seg?.kind==='turn'){
    const p=stairPoint(distance),dx=p.dx*direction,dz=p.dz*direction,r=Math.hypot(p.x+dz*.32-seg.x,p.z-dx*.32-.65);
    turn=STAIRS.radius/r;
  }
  return turn*(1+w*(flight-1));
}

export class StairTraffic {
  constructor(){this.reset();}
  reset(){this.agents=[{id:'human',s:0,direction:1,speed:.66,wait:0},{id:'robot',s:ROBOT_ROUTE_LENGTH,direction:-1,speed:.58,wait:0},{id:'cat',s:STAIR_ROUTE_LENGTH*.48,direction:1,speed:.50,wait:0}];}
  update(dt){
    for(const a of this.agents){
      a.waiting=false;
      if(a.wait>0){a.wait=Math.max(0,a.wait-dt);a.exit=Math.min(1,(a.exit??0)+dt*.6);continue;}
      // the crew pace changes where the stair or a turn begins: evaluate it at
      // the middle of the frame's travel so a frame straddling the change does
      // not overshoot
      const pace=s=>a.id==='human'?humanPace(s,a.direction):1;
      const speed=a.speed*pace(a.s+a.direction*a.speed*pace(a.s)*dt/2);
      let travel=speed*dt;
      for(const b of this.agents)if(a!==b&&b.wait!==Infinity&&a.direction===b.direction){
        const gap=(b.s-a.s)*a.direction,clearance=a.id==='cat'||b.id==='cat'?.75:1.12;
        if(gap>0)travel=Math.min(travel,Math.max(0,gap-clearance));
      }
      a.waiting=travel<speed*dt*.5;
      const end=stairRouteLength(a.id),target=a.s+a.direction*travel;
      a.s=Math.max(0,Math.min(end,target));
      if(a.s===0||a.s===end){
        // the part of the frame left after reaching the end already counts
        // toward the walk-off, so the walker does not hesitate for a frame
        a.wait=Infinity;a.exit=(a.exit??0)+.6*Math.abs(target-a.s)/Math.max(1e-9,speed);
      }
    }
  }
}
