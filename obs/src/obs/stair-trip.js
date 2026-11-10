// A walk through the left stair tower from one cabin aisle to another.
//
// Every flight starts or ends at x = STAIRS.right (the tower side of the
// cabin) heading along x, so a trip is: a floor connector from the walker's
// aisle lane onto the stair lane, the stair route between the two floors,
// and a connector back onto the aisle lane of the arrival floor. Connectors
// shift sideways next to the tower (two arcs, at most 0.5 m radius, with a
// straight between them) and run straight on the cabin side, which keeps
// them clear of the top-deck charging dock, the ashtray ledge and the
// incinerator. A walker leaving the tower is back on its own aisle lane
// within two metres, away from the lanes of the others.
//
// The travel coordinate t is the route distance on the stair part (measured
// along the slope on flights, like the stair studies) and the walked
// distance on the connectors. Beyond either end a trip continues straight,
// so gaits can place footfalls before the start and after the end.
import {STAIRS,STAIR_SEGMENTS,stairPoint,HUMAN_PACE} from './stair-route.js';
import {CABIN_FLOOR_Y} from './layout.js';

export const STAIR_LANE=.32;          // walkers keep right of the route centre line
const CONNECTOR_RADIUS=.5,CONNECTOR_LEAD=.4,EXIT_RUN=1.75;
const smooth=t=>t*t*(3-2*t);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const FLIGHTS=STAIR_SEGMENTS.filter(s=>s.kind==='flight');
// Route distance where the route leaves a floor upward / arrives on it from below.
const LEAVE_UP={2:FLIGHTS[0].start,1:FLIGHTS[2].start};
const ARRIVE_UP={1:FLIGHTS[1].end,0:FLIGHTS[3].end};

export function laneFrame(s,direction,lane=STAIR_LANE){
  const p=stairPoint(s),dx=p.dx*direction,dz=p.dz*direction;
  return {x:p.x+dz*lane,y:p.y,z:p.z-dx*lane,dx,dz};
}

// Sideways shift between two parallel headings along x: optional straight,
// arc, straight across, arc, optional straight. `early` puts the shift at
// the start (leaving the tower), otherwise at the end (entering it).
function connector(from,to,heading,early){
  const shift=to.z-from.z,sz=Math.sign(shift)||1,run=Math.abs(to.x-from.x);
  const R=CONNECTOR_RADIUS,theta=Math.abs(shift)<=2*R?Math.acos(1-Math.abs(shift)/(2*R)):Math.PI/2;
  const cross=Math.max(0,Math.abs(shift)-2*R),span=2*R*Math.sin(theta),straight=Math.max(0,run-span);
  const arc=R*theta,pieces=[];
  if(!early&&straight>0)pieces.push({kind:'line',length:straight});
  pieces.push({kind:'arc',length:arc,turn:1});
  if(cross>0)pieces.push({kind:'line',length:cross});
  pieces.push({kind:'arc',length:arc,turn:-1});
  if(early&&straight>0)pieces.push({kind:'line',length:straight});
  const length=pieces.reduce((a,p)=>a+p.length,0);
  // integrate along: heading angle phi measured from the walking direction toward sz
  return {length,frame(u){
    let x=from.x,z=from.z,phi=0,left=clamp(u,0,length);
    const dirAt=a=>({dx:heading*Math.cos(a),dz:sz*Math.sin(a)});
    for(const p of pieces){
      const d=Math.min(left,p.length);
      if(p.kind==='line'){const {dx,dz}=dirAt(phi);x+=dx*d;z+=dz*d;}
      else{
        // circular arc of radius R turning phi by +-d/R
        const a0=phi,a1=phi+p.turn*d/R;
        x+=heading*R*(Math.sin(a1)-Math.sin(a0))*p.turn;z+=sz*R*(Math.cos(a0)-Math.cos(a1))*p.turn;phi=a1;
      }
      left-=d;if(left<=0)break;
    }
    const {dx,dz}=dirAt(phi);return {x,z,dx,dz};
  }};
}

const cache=new Map();
// fromFloor/toFloor: cabin floor indices (0 top, 1 middle, 2 bottom).
// aisle: {fromZ,toZ} lane depth of the walker in the cabin (crew 0.78,
// droid 1.48, cat 2.2).
export function stairTrip(fromFloor,toFloor,{fromZ=.78,toZ=fromZ,lane=STAIR_LANE}={}){
  const key=`${fromFloor}>${toFloor}:${fromZ}:${toZ}:${lane}`;
  if(cache.has(key))return cache.get(key);
  if(fromFloor===toFloor||![0,1,2].includes(fromFloor)||![0,1,2].includes(toFloor))throw new Error(`no stair trip ${fromFloor}->${toFloor}`);
  const direction=CABIN_FLOOR_Y[toFloor]>CABIN_FLOOR_Y[fromFloor]?1:-1;
  const s0=direction>0?LEAVE_UP[fromFloor]:ARRIVE_UP[fromFloor],s1=direction>0?ARRIVE_UP[toFloor]:LEAVE_UP[toFloor];
  const join=laneFrame(s0,direction,lane),leave=laneFrame(s1,direction,lane);
  // enter heading toward the tower (-x), leave heading back into the cabin (+x)
  const span=z=>{const s=Math.abs(z),R=CONNECTOR_RADIUS;return (s<=2*R?2*R*Math.sin(Math.acos(1-s/(2*R))):2*R)+CONNECTOR_LEAD;};
  // (the way out is at least EXIT_RUN long, so that the crew is back at its cabin speed when the trip ends)
  const arcs=z=>{const s=Math.abs(z),R=CONNECTOR_RADIUS,theta=s<=2*R?Math.acos(1-s/(2*R)):Math.PI/2;return 2*R*theta+Math.max(0,s-2*R);};
  const fromX=join.x+span(fromZ-join.z),toX=leave.x+span(toZ-leave.z)+Math.max(0,EXIT_RUN-arcs(toZ-leave.z)-CONNECTOR_LEAD);
  const enter=connector({x:fromX,z:fromZ},{x:join.x,z:join.z},-1,false);
  const exit=connector({x:leave.x,z:leave.z},{x:toX,z:toZ},1,true);
  const routeLength=Math.abs(s1-s0),y0=CABIN_FLOOR_Y[fromFloor],y1=CABIN_FLOOR_Y[toFloor];
  const length=enter.length+routeLength+exit.length;
  const flights=FLIGHTS.filter(f=>f.start>=Math.min(s0,s1)-1e-9&&f.end<=Math.max(s0,s1)+1e-9)
    .map(f=>{const a=enter.length+Math.abs((direction>0?f.start:f.end)-s0),b=enter.length+Math.abs((direction>0?f.end:f.start)-s0);return {flight:f,t0:a,t1:b,direction};});
  if(direction<0)flights.sort((a,b)=>a.t0-b.t0);
  const trip={
    key,fromFloor,toFloor,direction,length,lane,flights,
    from:{x:fromX,y:y0,z:fromZ},to:{x:toX,y:y1,z:toZ},
    enterLength:enter.length,exitStart:enter.length+routeLength,
    routeS(t){return t<enter.length||t>enter.length+routeLength?null:s0+direction*(t-enter.length);},
    tOfRouteS(s){return enter.length+direction*(s-s0);},
    // lane point and walking direction at travel t (straight beyond the ends)
    frame(t){
      let f,y;
      if(t<=enter.length){const p=enter.frame(Math.max(0,t)),e=Math.min(0,t);f={x:p.x+p.dx*e,z:p.z+p.dz*e,dx:p.dx,dz:p.dz};y=y0;}
      else if(t>=enter.length+routeLength){const u=t-enter.length-routeLength,p=exit.frame(Math.min(u,exit.length)),e=Math.max(0,u-exit.length);f={x:p.x+p.dx*e,z:p.z+p.dz*e,dx:p.dx,dz:p.dz};y=y1;}
      else{const p=laneFrame(s0+direction*(t-enter.length),direction,lane);f=p;y=p.y;}
      return {x:f.x,y,z:f.z,dx:f.dx,dz:f.dz,yaw:Math.atan2(f.dx,f.dz)};
    },
    // distance in t to the nearest flight (0 on a flight)
    flightGap(t){let gap=Infinity;for(const f of flights)gap=Math.min(gap,Math.max(f.t0-t,0,t-f.t1));return gap;},
    // between the trip's first and last flight (turn landings, a deck passed through)
    betweenFlights(t){return t>flights[0].t0&&t<flights.at(-1).t1;},
    // Crew walking pace relative to the walker's cabin speed `cabin` (m/s).
    // The flights are walked at the measured stair cadence whatever the cabin
    // speed is (a walker slower than the stair study keeps the study's
    // ratio instead, so nobody takes the stairs faster than the floor), the
    // floor next to them at the same horizontal speed, and the walker slows
    // down to it over slowDistance (longer from a faster walk, so that it
    // takes two or three shortening steps). Between two flights the walker
    // does not pick the full cabin speed up again. On the turn landings the
    // walked speed counts, not the route speed.
    slowDistance(speed=HUMAN_PACE.floor){return HUMAN_PACE.blend*Math.max(1,speed/HUMAN_PACE.floor);},
    // {stair: 0 away from the flights .. 1 on them, open: speed (m/s) away
    // from them, flight: horizontal speed on them, between: between two flights}
    paceParts(t,cabin=HUMAN_PACE.floor){
      let gap=Infinity,cos=1;
      for(const f of flights){const g=Math.max(f.t0-t,0,t-f.t1);if(g<gap){gap=g;cos=Math.abs(f.flight.b[0]-f.flight.a[0])/f.flight.length;}}
      const between=this.betweenFlights(t),open=between?Math.min(cabin,HUMAN_PACE.landing):cabin;
      const flight=(direction>0?HUMAN_PACE.up:HUMAN_PACE.down)*Math.min(cabin,HUMAN_PACE.floor)*cos;
      return {stair:1-smooth(Math.min(1,gap/this.slowDistance(open))),open,flight,between,onFlight:gap<=0,cos};
    },
    pace(t,cabin=HUMAN_PACE.floor){
      const {stair,open,flight,onFlight,cos}=this.paceParts(t,cabin);
      let turn=1;const s=this.routeS(t);
      if(s!==null){
        const seg=STAIR_SEGMENTS.find(g=>s>=g.start&&s<g.end);
        if(seg?.kind==='turn'){const p=laneFrame(s,direction,lane);turn=STAIRS.radius/Math.max(.2,Math.hypot(p.x-seg.x,p.z-.65));}
      }
      // (travel is measured along the slope on a flight)
      return turn*(open+stair*((onFlight?flight/cos:flight)-open))/cabin;
    },
  };
  cache.set(key,Object.freeze(trip));
  return trip;
}
