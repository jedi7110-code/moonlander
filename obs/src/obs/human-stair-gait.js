// Milo (and Curtis) on the stair tower: the stair study and cabin trips.
//
// Behaviour follows measured human stair gait on a stair close to this one
// (17 cm riser / 29 cm tread, ~30°). Sources and numbers are in
// studies/stairs/human-motion-research.md:
// - step-over-step, one tread per step, cadence ~90 steps/min up and
//   ~105 down (the walker slows on the flights, see humanPace in route.js);
// - going up, the leading foot lands on its forefoot with the knee bent ~70°
//   and the body is then pulled up over it during its single stance; the
//   trailing heel rises before it leaves. Toes clear each nosing by ~5 cm;
// - going down, the body is lowered on the bent trailing leg before the
//   leading foot lands toe first (plantarflexed ~20°) a little past the
//   nosing, then the fall is caught as the heel comes down;
// - the trunk leans ~11° forward going up and stays nearly upright going
//   down; the gaze drops to 3-5 treads ahead (up) or 1-2 (down); arm swing
//   is smaller than on the floor.
//
// Everything is a pure function of the route position, so scrubbing, pausing
// and reversing reproduce the same pose.
import * as THREE from 'three';
import {animateMilo} from './characters.js';
import {applyLoungeSpine,updateMiloSpine} from './milo-spine.js';
import {sampleWalk,miloWalkData} from './mocap-walk.js';
import {CREW_WALK_SPEED} from './pace.js';
import {STAIRS,STAIR_SEGMENTS,STAIR_ROUTE_LENGTH,stairPoint,EXIT_START,HUMAN_EXIT,humanExitPoint} from './stair-route.js';

const V=(...v)=>new THREE.Vector3(...v),UP=V(0,1,0);
const clamp=THREE.MathUtils.clamp,mix=THREE.MathUtils.lerp;
const smooth=t=>{t=clamp(t,0,1);return t*t*(3-2*t);};
const smoother=t=>{t=clamp(t,0,1);return t*t*t*(t*(t*6-15)+10);};
const L=STAIR_ROUTE_LENGTH,T=STAIRS.tread,RISE=STAIRS.rise;

export const HUMAN_STAIR_GAIT=Object.freeze({
  lane:.32,spread:.10,turnSpread:.035, // half the step width; extra on a curve
  foot:{heel:.101,toe:.183,sole:.107}, // ankle to heel / toe / sole of the laced boot mesh
  natural:.45,          // floor step length (m), a calm 0.66 m/s walk
  toeGap:.05,           // up: toe stops this far short of the next riser
  toeOver:.02,          // down: shoe tip lands this far past the nosing (F14: 0-47 mm)
  topEdge:.035,         // down: last landing step keeps its tip behind the edge (F14: 15-55 mm)
  lead:{up:.23,down:.12,floor:.25,stop:.20}, // landing ankle ahead of the pelvis
  doubleSupport:{up:.26,down:.16,floor:.20,stand:.20}, // share of a step; stance 63% / 58% / 60% of a stride
  hip:{floor:.94,up:.963,down:.93}, // hip joint above the supporting sole (m)
  bob:.02,              // floor walking: hip lowest at each heel strike
  // The body rises over the new step during the leading foot's stance (up)
  // or is lowered before it lands and caught after (down); windows in steps
  // around that foot's contact.
  rise:[0,.95],drop:[-.55,.40],
  clearance:{up:.05,down:.035,floor:.03},
  // swing timing: [horizontal start, horizontal end, lift-off done, set-down starts]
  swing:{up:[.08,.94,.22,.84],down:[.02,.86,.22,.82],floor:[0,1,.45,.55]},
  swingWindow:.10,      // share of the swing the clearance is held before / after an edge
  // foot pitch (+ = heel up / toe down, about the toe; - = toe up, about the heel)
  // `stand`: the first and last footfalls, both feet flat side by side
  contact:{up:.12,down:.35,floor:-.20,stand:0},settle:{up:.12,down:.22,floor:.12,stand:1},
  pushOff:{up:.46,down:.14,floor:.45,stand:0},heelRise:{up:.72,down:.72,floor:.55,stand:1},
  swingPitch:{up:-.10,down:.10,floor:.02},
  lean:{up:.19,down:.04,floor:.025},leanWave:{up:.035,down:.015,floor:0}, // trunk flexion (rad)
  gaze:{up:.28,down:.34,floor:.06},  // head pitched down (rad, relative to the body)
  armSwing:{stairs:.11,floor:.27},
  stairZone:.8,         // route distance over which the stair posture blends in
  exit:.55,             // walk-off after the route end while StairTraffic's exit runs, then stop
});
const G=HUMAN_STAIR_GAIT;

const flights=STAIR_SEGMENTS.filter(s=>s.kind==='flight').map(s=>{
  const run=Math.abs(s.b[0]-s.a[0]);return{...s,sign:Math.sign(s.b[0]-s.a[0]),run,cos:run/s.length};
});
const flightX=(f,d)=>f.a[0]+f.sign*d;
const treadHeight=(f,d)=>d<0?f.a[1]:d>=f.run-1e-9?f.b[1]:f.a[1]+Math.min(9,Math.floor(d/T+1e-9)+1)*RISE;
// route distance of the point at flight coordinate d on the route's centre line
const routeAt=(f,d)=>d<0?f.start+d:d>f.run?f.end+(d-f.run):f.start+d/f.cos;
const toTravel=(s,dir)=>dir>0?s:L-s,toS=toTravel;

// Lane point at a walking distance along the route in the walking direction.
// Beyond the route ends the floor continues straight: the walk starts
// mid-stride and, after the route, walks G.exit further out and stops.
export function travelFrame(travel,direction){
  const f=laneFrame(toS(clamp(travel,0,L),direction),direction),extra=travel<0?travel:Math.max(0,travel-L);
  return {...f,x:f.x+f.dx*extra,z:f.z+f.dz*extra};
}
export function laneFrame(s,direction){
  s=clamp(s,0,L);
  if(s>=EXIT_START){
    // the crew exit path is already on the lane and in the walking direction
    const share=direction>0?(s-EXIT_START)/(L-EXIT_START):(L-s)/(L-EXIT_START);
    const p=humanExitPoint(share*(direction>0?HUMAN_EXIT.up:HUMAN_EXIT.down).length,direction);
    return {...p,yaw:Math.atan2(p.dx,p.dz)};
  }
  const p=stairPoint(s),dx=p.dx*direction,dz=p.dz*direction;
  return {x:p.x+dz*G.lane,y:p.y,z:p.z-dx*G.lane,dx,dz,yaw:Math.atan2(dx,dz)};
}

// Height of the highest stair or floor surface under (x,z) that is not above
// `below` (flights are stacked, so the one overhead is ignored); `floor` is
// the walking level away from the flights.
export function groundAt(x,z,below,floor){
  let best=floor;
  for(const f of flights){
    if(Math.abs(z-f.a[2])>STAIRS.width/2+.1)continue;
    const d=(x-f.a[0])*f.sign;if(d<-1.2||d>f.run+1.2)continue;
    const h=treadHeight(f,d);if(h<=below&&h>best)best=h;
  }
  return best;
}

// ---- Walking paths. A path is the lane a walker follows in travel order:
// {key, direction, length, frame(t), flights:[{flight,t0,t1}], tOfRouteS(s),
// flightGap(t), stop}. The study walks the whole route and stops after a
// short walk-off; cabin trips (stair-trip.js) hand over to the cabin walk at
// their end, so their footfalls simply continue past it.
const flightByStart=new Map(flights.map(f=>[f.start,f]));
const studyPaths={};
export function studyPath(direction){
  const dir=direction>0?1:-1;
  if(studyPaths[dir])return studyPaths[dir];
  const order=(dir>0?flights:[...flights].reverse()).map(f=>({flight:f,t0:toTravel(dir>0?f.start:f.end,dir),t1:toTravel(dir>0?f.end:f.start,dir)}));
  return studyPaths[dir]={key:`study${dir}`,direction:dir,length:L,stop:true,flights:order,
    frame:t=>travelFrame(t,dir),tOfRouteS:s=>toTravel(s,dir),
    flightGap(t){let gap=Infinity;for(const f of order)gap=Math.min(gap,Math.max(f.t0-t,0,t-f.t1));return gap;}};
}

// ---- The cabin walk (motion capture) that a cabin trip joins and leaves:
// one step is half its cycle; each foot strikes at a fixed phase of the cycle
// with the ankle `lead` ahead of the hips.
let cabinCycle=null;
export function cabinWalkCycle(){
  if(cabinCycle)return cabinCycle;
  const d=miloWalkData,N=560,contact={},leads=[];
  for(const [side,foot] of [[-1,'LeftFoot'],[1,'RightFoot']]){
    let best=-Infinity,at=0;
    for(let i=0;i<N;i++){const p=sampleWalk(d,i/N*d.duration),z=p[foot].z-p.Hips.z;if(z>best){best=z;at=i/N;}}
    contact[side]=at;leads.push(best);
  }
  return cabinCycle={cycle:d.cycleDistance,step:d.cycleDistance/2,contact,lead:(leads[0]+leads[1])/2};
}
const MIN_STEP=.28,LEAD_STEP=.07; // shortest step onto the stair approach (m); change of lead per step leaving the stairs
const LEG={floor:.855,full:.860}; // hip joint to ankle: knee a little bent / straight (m)
const HIP_DROP=.3; // hips lowered per metre a step lands further from the last than G.natural (long steps next to the cabin walk)

// ---- Footfall schedule: every step's landing spot and the pelvis travel at
// its contact, along one path. Feet alternate strictly.
//
// `walk` ({speed, entry}) is given for a cabin trip. The walker arrives in the
// cabin walk at `speed` (m/s) with that walk's distance counter at `entry`
// where the trip starts. The footfalls before the stairs are then the cabin
// walk's own. From where the walker starts to slow down, the steps shorten
// from the cabin walk's length to one tread at the stair (the step rate goes
// from the cabin walk's to the stair's; they are close at the usual cabin
// speed), and they lengthen again after it until they are the cabin walk's.
// Every step also carries `distance`, the cabin walk's counter at its contact:
// driving the cabin walk with it (steps.distance(t)) keeps both walks in step,
// so they can be blended and the cabin walk can take over on the floor.
function buildSchedule(path,walk=null){
  const steps=[],up=path.direction>0,P=path.length,order=path.flights.map(x=>flightByStart.get(x.flight.start));
  const at=(t,ground,base,yaw,extra={})=>({t,ground,base,yaw,...extra});
  const C=walk?cabinWalkCycle():null,natural=walk?C.step:G.natural;
  const frameAt=travel=>path.frame(travel),E=path.stop?P+G.exit:P+3*natural;
  // distance actually walked along the lane (longer than the route on the
  // outside of a turn, shorter on the inside)
  const lane=[0],DT=.01,N=Math.ceil(E/DT);
  for(let i=1;i<=N;i++){const a=frameAt((i-1)*DT),b=frameAt(Math.min(E,i*DT));lane.push(lane[i-1]+Math.hypot(b.x-a.x,b.z-a.z));}
  const walked=t=>t<=0?t:t>=E?lane[N]+(t-E):mix(lane[Math.floor(t/DT)],lane[Math.min(N,Math.floor(t/DT)+1)],t/DT-Math.floor(t/DT));
  const travelOf=w=>{if(w<=0)return w;if(w>=lane[N])return E+(w-lane[N]);let lo=0,hi=N;while(hi-lo>1){const m=(lo+hi)>>1;if(lane[m]<=w)lo=m;else hi=m;}return (lo+(w-lane[lo])/Math.max(1e-9,lane[hi]-lane[lo]))*DT;};
  // (a trip continues straight past its end, where the cabin walk goes on)
  const floorStep=(t,lead=G.lead.floor)=>{const w=walk?walked(t)+lead:Math.min(walked(t)+lead,walked(E)),frame=frameAt(travelOf(w));return at(t,frame.y,frame,frame.yaw,{w,lead});};
  // Steps taken by the time the pelvis is at travel t, at the step rate of
  // the place: the cabin walk's away from the flights (short G.natural steps
  // between two flights), one tread per step at them.
  const speedAt=t=>walk.speed*path.pace(clamp(t,0,P),walk.speed);
  const rateAt=t=>{const p=path.paceParts(clamp(t,0,P),walk.speed);return mix(p.open/(p.between?G.natural:C.step),p.flight/T,p.stair);};
  const count=[0];
  if(walk)for(let i=1;i<=N;i++){const a=(i-1)*DT,b=Math.min(E,i*DT);count.push(count[i-1]+DT*(rateAt(a)/speedAt(a)+rateAt(b)/speedAt(b))/2);}
  const countOf=t=>t<=0?t/C.step:t>=E?count[N]+(t-E)/C.step:mix(count[Math.floor(t/DT)],count[Math.min(N,Math.floor(t/DT)+1)],t/DT-Math.floor(t/DT));
  const tOfCount=x=>{if(x<=0)return x*C.step;if(x>=count[N])return E+(x-count[N])*C.step;let lo=0,hi=N;while(hi-lo>1){const m=(lo+hi)>>1;if(count[m]<=x)lo=m;else hi=m;}return (lo+(x-count[lo])/Math.max(1e-9,count[hi]-count[lo]))*DT;};
  // the lead of a floor step by its length: the floor walk's for a short
  // step, the cabin walk's for a step of the cabin walk's length
  const leadFor=length=>clamp(mix(G.lead.floor,C.lead,(length-G.natural)/(C.step-G.natural)),G.lead.floor,C.lead);
  // pelvis travel at which the pelvis is `lead` behind the ankle along the
  // walking direction (exact on the curved lane next to a flight)
  const travelBehind=(ankle,dx,dz,lead,guess)=>{
    let lo=guess-1.5,hi=guess+1.5;
    for(let i=0;i<50;i++){const m=(lo+hi)/2,f=frameAt(m);if((f.x-ankle.x)*dx+(f.z-ankle.z)*dz+lead<0)lo=m;else hi=m;}
    return (lo+hi)/2;
  };
  const blocks=order.map(f=>{
    const block=[],dx=f.sign*path.direction,yaw=Math.atan2(dx,0),z=f.a[2]-dx*G.lane;
    // going up, the floor steps before the first riser are left to the even
    // approach below (no forced step against the riser, which would make one
    // quick, long step onto the stair)
    for(let i=up?1:0;i<=10;i++){
      const j=up?i:10-i;
      // virtual tread j spans d in [(j-1)T, jT]; 0 and 10 are the floors
      const ankle=up?j*T-G.toeGap-G.foot.toe
        :j===10?f.run+G.topEdge+G.foot.toe:(j-1)*T-G.toeOver+G.foot.toe;
      const lead=j===0||j===10?(up?G.lead.up:G.lead.down):G.lead[up?'up':'down'];
      const pelvis=ankle-(up?lead:-lead);
      const ground=j===0?f.a[1]:j===10?f.b[1]:f.a[1]+j*RISE;
      const guess=path.tOfRouteS(routeAt(f,pelvis));
      const t=j>0&&j<10?guess:travelBehind({x:flightX(f,ankle),z},dx,0,lead,guess);
      block.push(at(t,ground,{x:flightX(f,ankle),z,dx,dz:0},yaw,{flight:f,tread:j,lead,w:walked(t)+lead}));
    }
    return block;
  });
  // even floor steps between two footfalls, spaced by where the feet land
  const fill=(ta,tb)=>{
    if(walk){
      // The whole number of steps nearest the step rate of the place, evenly
      // in step count. The lead goes over evenly from the last step's to the
      // next footfall's, so the feet land evenly too.
      const from=steps.at(-1),a=countOf(ta),b=countOf(tb);let n=Math.max(1,Math.round(b-a));
      while(n>1&&(pending.w-from.w)/n<MIN_STEP)n--; // rather one step fewer than very short ones
      for(let i=1;i<n;i++)steps.push(floorStep(tOfCount(mix(a,b,i/n)),mix(from.lead,pending.lead,i/n)));
      return;
    }
    const wa=walked(ta)+(steps.at(-1)?.lead??G.lead.floor),wb=walked(tb)+(pending?.lead??G.lead.floor),n=Math.max(1,Math.round((wb-wa)/G.natural));
    for(let i=1;i<n;i++)steps.push(floorStep(travelOf(mix(wa,wb,i/n)-G.lead.floor)));
  };
  let pending=null,firstSide=-1,last=0;
  if(walk){
    // The cabin walk's own footfalls: all of them until the walker starts to
    // slow down and the next one after that (so the walk counter runs on
    // unchanged up to there), unless that one would land less than MIN_STEP
    // or half a step in time before the first stair footfall. The first
    // footfall inside the trip always has that room (it is within one cabin
    // step of the start).
    const slow=walked(Math.max(0,(path.flights[0]?.t0??E)-path.slowDistance(walk.speed))),arriving=[];
    const first=blocks[0]?.[0],room=first?Math.min(first.w-MIN_STEP,walked(tOfCount(countOf(first.t)-.5))+C.lead):Infinity;
    for(const side of [-1,1])for(let j=Math.ceil((walk.entry-2.2*C.step)/C.cycle-C.contact[side]);;j++){
      const w=(C.contact[side]+j)*C.cycle-walk.entry;arriving.push({w,side});if(w>=slow)break;
    }
    arriving.sort((a,b)=>a.w-b.w);
    const next=arriving.findIndex(a=>a.w>=slow);
    arriving.length=arriving[next].w<0||arriving[next].w+C.lead<=room?next+1:next;
    firstSide=arriving[0].side;
    for(const {w} of arriving)steps.push(floorStep(travelOf(w),C.lead));
    last=steps.at(-1).t;
  }else steps.push(floorStep(-G.natural),floorStep(0));
  for(const block of blocks){pending=block[0];fill(last,block[0].t);steps.push(...block);last=block.at(-1).t;}
  pending=null;
  if(path.stop){
    // come to a stop: one foot lands at the end with the usual lead, the other
    // is then brought alongside it
    const end=frameAt(E),settle=travelOf(walked(E)-G.lead.stop);
    pending={lead:G.lead.floor};fill(last,settle);pending=null;
    steps.push(at(settle,end.y,end,end.yaw,{w:walked(E)}),at(E,end.y,end,end.yaw,{w:walked(E)}));
  }else if(walk){
    // keep walking past the end; the steps lengthen to the cabin walk's as
    // the walker picks its cabin speed up again
    // (the lead grows with the steps, by no more than LEAD_STEP a step)
    for(let x=countOf(last)+1,n=0;n<2||tOfCount(x)<=E;x++,n++){
      const t=tOfCount(x),from=steps.at(-1);
      steps.push(floorStep(t,from.lead+clamp(leadFor(walked(t)-walked(from.t))-from.lead,-LEAD_STEP,LEAD_STEP)));
    }
  }else{
    // keep walking past the end: the cabin walk takes over there
    fill(last,E);steps.push(floorStep(travelOf(walked(E)-G.lead.floor)));
  }
  steps.laneAt=w=>frameAt(travelOf(w));
  steps.forEach((step,k)=>{
    const side=k%2===0?firstSide:-firstSide,b=step.base;step.side=side;
    // feet are set a little wider on a curve, where consecutive footprints
    // are turned against each other
    let curve=0;
    // (not on the floor steps that lead onto or off a flight)
    const level=[steps[k-2],steps[k+2]].every(n=>!n||Math.abs(n.ground-step.ground)<1e-6);
    if(step.w!=null&&!step.flight&&level){const a=frameAt(travelOf(step.w-.05)),c=frameAt(travelOf(step.w+.05));curve=Math.abs(Math.atan2(Math.sin(c.yaw-a.yaw),Math.cos(c.yaw-a.yaw)))/.1;}
    step.lateral=G.spread+G.turnSpread*Math.min(1,curve*.7);
    step.ankle=V(b.x+b.dz*side*step.lateral,step.ground+G.foot.sole,b.z-b.dx*side*step.lateral);
  });
  for(let k=0;k<steps.length;k++){
    const next=steps[k+2],prev=steps[k-2],kind=(a,b)=>!a||!b||Math.abs(b.ground-a.ground)<1e-6?'floor':b.ground>a.ground?'up':'down';
    steps[k].out=next?kind(steps[k],next):'stand';steps[k].in=k===steps.length-1?'stand':prev?kind(prev,steps[k]):'floor'; // the walk starts mid-stride
    steps[k].ds=G.doubleSupport[steps[k].out];
  }
  // hip height above the support: stair value on a tread, floor value on the floor
  // (a little lower on a curve, where the feet are set wider)
  steps.forEach((step,k)=>{
    const stride=walk&&k>0?Math.max(0,step.w-steps[k-1].w-G.natural)*HIP_DROP:0;
    step.hip=step.flight&&step.tread>0&&step.tread<10?G.hip[up?'up':'down']:G.hip.floor-(step.lateral-G.spread)*.4-stride;
  });
  if(walk){
    // the cabin walk's distance counter at each contact
    steps[0].distance=walk.entry+walked(steps[0].t);
    for(let k=1;k<steps.length;k++)steps[k].distance=steps[k-1].distance+(((C.contact[steps[k].side]-C.contact[steps[k-1].side])%1+1)%1||1)*C.cycle;
    steps.distance=t=>{
      if(t<=steps[0].t)return steps[0].distance+walked(t)-walked(steps[0].t);
      const phi=stepPhase(steps,t),k=Math.min(Math.floor(phi),steps.length-2);
      return mix(steps[k].distance,steps[k+1].distance,phi-k);
    };
    // Length of the steps at travel t relative to the cabin walk's: the floor
    // walked per unit of the counter, from one step to the next, smoothed
    // between the middles of consecutive steps.
    const ratio=steps.slice(0,-1).map((step,k)=>(walked(steps[k+1].t)-walked(step.t))/(steps[k+1].distance-step.distance));
    steps.stride=t=>{
      if(t<=steps[0].t)return 1;
      const x=stepPhase(steps,t)-.5,i=Math.floor(x),at=k=>ratio[clamp(k,0,ratio.length-1)];
      return mix(at(i),at(i+1),x-i);
    };
  }
  for(let k=1;k<steps.length;k++)if(!(steps[k].t>steps[k-1].t))throw new Error(`human stair schedule out of order at ${k}`);
  for(const step of steps)if(step.out!=='stand')step.swing=buildSwing(step,steps[steps.indexOf(step)+2]);
  return steps;
}

// ---- Foot placement with heel / toe roll.
function footPose(step,pitch){
  const {heel,toe,sole}=G.foot,yaw=step.yaw,fx=Math.sin(yaw),fz=Math.cos(yaw);
  const a=step.ankle;if(Math.abs(pitch)<1e-9)return {ankle:a.clone(),pitch:0,yaw};
  const pivot=pitch>0?toe:-heel,c=Math.cos(pitch),s=Math.sin(pitch);
  // ankle relative to the pivot (pivot is at the sole, `pivot` ahead of the ankle)
  const along=-pivot*c+sole*s,upv=sole*c+pivot*s;
  return {ankle:V(a.x+fx*(pivot+along),a.y-sole+upv,a.z+fz*(pivot+along)),pitch,yaw};
}
export function soleExtremes(pose){
  const {heel,toe,sole}=G.foot,fx=Math.sin(pose.yaw),fz=Math.cos(pose.yaw),c=Math.cos(pose.pitch),s=Math.sin(pose.pitch);
  const point=along=>V(pose.ankle.x+fx*(along*c-sole*s),pose.ankle.y-sole*c-along*s,pose.ankle.z+fz*(along*c-sole*s));
  return {heel:point(-heel),toe:point(toe)};
}
function stancePitch(step,v){
  const contact=G.contact[step.in]*(1-smooth(v/G.settle[step.in]));
  // the heel leaves as early as the surface it stands on allows (a floor step
  // before a flight rolls off like a floor step), the push-off is the next step's
  const lift=step.in==='floor'&&step.out!=='stand'?Math.max(G.pushOff[step.out],G.pushOff.floor):G.pushOff[step.out];
  const start=Math.min(G.heelRise[step.out],G.heelRise[step.in]),push=lift*smooth((v-start)/(1-start));
  return contact+push;
}

// The swing path: the clearance needed over the stair under the whole foot
// is sampled along the swing in time, then dilated and blurred in time, so the
// foot is already high before it reaches a riser (up) and stays high until it
// has passed a nosing (down), and never dips below the envelope.
const SWING_SAMPLES=64;
const swingPitch=(start,end,mode,u)=>{const m=G.swingPitch[mode];return u<.5?mix(start,m,smooth(u/.5)):mix(m,end,smooth((u-.5)/.5));};
function buildSwing(from,to){
  const mode=from.out,[h0,h1]=G.swing[mode],c=G.clearance[mode],{heel,toe,sole}=G.foot;
  const start=footPose(from,stancePitch(from,1)),end=footPose(to,G.contact[to.in]);
  const below=Math.max(from.ground,to.ground)+.3,floor=Math.min(from.ground,to.ground);
  const turn=Math.atan2(Math.sin(end.yaw-start.yaw),Math.cos(end.yaw-start.yaw)),req=[];
  for(let i=0;i<=SWING_SAMPLES;i++){
    const u=i/SWING_SAMPLES,xi=smoother((u-h0)/(h1-h0)),p=swingPitch(start.pitch,end.pitch,mode,u),cp=Math.cos(p),sp=Math.sin(p);
    const yaw=start.yaw+turn*xi,fx=Math.sin(yaw),fz=Math.cos(yaw),ax=mix(start.ankle.x,end.ankle.x,xi),az=mix(start.ankle.z,end.ankle.z,xi);
    // lowest ankle height that keeps every sole point (heel..toe) clear
    let need=-Infinity;
    for(let k=0;k<=10;k++){
      const along=-heel+(heel+toe)*k/10,off=along*cp-sole*sp;
      need=Math.max(need,groundAt(ax+fx*off,az+fz*off,below,floor)+sole*cp+along*sp);
    }
    req.push(need+c);
  }
  const radius=Math.round(G.swingWindow*SWING_SAMPLES);
  const window=(arr,i,max)=>{let out=max?-Infinity:0;for(let j=i-radius;j<=i+radius;j++){const v=arr[clamp(j,0,arr.length-1)];out=max?Math.max(out,v):out+v/(2*radius+1);}return out;};
  const dilated=req.map((_,i)=>window(req,i,true)),path=dilated.map((_,i)=>window(dilated,i,false));
  return {mode,path};
}

const schedules=new Map();
// schedule for a path, or for the study route in a direction (+1 / -1)
// (`walk`: {speed, entry, key} as made by tripWalk below; see buildSchedule).
// The study's two schedules are kept; of the cabin trips' (one per trip,
// speed and arrival phase) only the WALK_SCHEDULES used last.
const WALK_SCHEDULES=48,walkSchedules=new Map();
export function humanSchedule(path,walk=null){
  if(typeof path==='number')path=studyPath(path);
  if(!walk){
    if(!schedules.has(path.key))schedules.set(path.key,buildSchedule(path));
    return schedules.get(path.key);
  }
  const key=`${path.key}|${walk.key}`;let steps=walkSchedules.get(key);
  if(steps)walkSchedules.delete(key);else steps=buildSchedule(path,walk);
  walkSchedules.set(key,steps);
  if(walkSchedules.size>WALK_SCHEDULES)walkSchedules.delete(walkSchedules.keys().next().value);
  return steps;
}
// The arrival of a cabin walker ({speed m/s, entry: its walk distance counter
// where the trip starts}) reduced to one of WALK_PHASES arrival phases, so
// that schedules can be shared; `base` + `shift` is what was taken off.
const WALK_PHASES=32;
function tripWalk({speed=CREW_WALK_SPEED*.022,entry=0}={}){
  const {cycle}=cabinWalkCycle(),phase=((entry/cycle)%1+1)%1,bin=Math.round(phase*WALK_PHASES)%WALK_PHASES;
  let shift=phase-bin/WALK_PHASES;shift-=Math.round(shift);
  return {speed,entry:bin/WALK_PHASES*cycle,key:`${speed.toFixed(3)}:${bin}`,base:entry-(bin/WALK_PHASES+shift)*cycle,shift:shift*cycle};
}
// The cabin walk's distance counter at travel t of a trip: it continues from
// `entry` and follows the trip's footfalls (see buildSchedule).
export function humanTripDistance(trip,t,arrival){
  const walk=tripWalk(arrival);
  return walk.base+humanSchedule(trip,walk).distance(t)+walk.shift*(1-smooth(t));
}
// The cabin walk's stride on the floor of a trip (1 away from the stairs,
// shorter where the steps shorten): see applyMocapWalk.
export function humanTripStride(trip,t,arrival){
  return clamp(humanSchedule(trip,tripWalk(arrival)).stride(t),.3,1.15);
}

function stepPhase(steps,t){
  if(t<=steps[0].t)return 0;if(t>=steps.at(-1).t)return steps.length-1;
  let lo=0,hi=steps.length-1;while(hi-lo>1){const m=(lo+hi)>>1;if(steps[m].t<=t)lo=m;else hi=m;}
  return lo+(t-steps[lo].t)/(steps[lo+1].t-steps[lo].t);
}

function swingPose(from,to,u,laneAt){
  const [h0,h1,liftEnd,dropStart]=G.swing[from.out];
  const start=footPose(from,stancePitch(from,1)),end=footPose(to,G.contact[to.in]);
  const xi=smoother((u-h0)/(h1-h0));
  let y;
  if(from.swing){
    const f=u*SWING_SAMPLES,i=Math.min(SWING_SAMPLES-1,Math.floor(f)),path=from.swing.path;y=mix(path[i],path[i+1],f-i);
  }else y=Math.max(start.ankle.y,end.ankle.y)+G.clearance.floor;
  y=mix(start.ankle.y,y,smooth(u/liftEnd));
  y=mix(y,end.ankle.y,smooth((u-dropStart)/(1-dropStart)));
  const pitch=swingPitch(start.pitch,end.pitch,from.out,u);
  let dyaw=end.yaw-start.yaw;dyaw=Math.atan2(Math.sin(dyaw),Math.cos(dyaw));
  // on a turn the foot follows the curve of its own side of the lane instead
  // of the chord between its footfalls, which would cut across the other foot
  let bx=0,bz=0;
  if(laneAt&&from.w!=null&&to.w!=null&&Math.abs(dyaw)>1e-3){
    const at=(w,lateral)=>{const f=laneAt(w),side=from.side*lateral;return {x:f.x+f.dz*side,z:f.z-f.dx*side};};
    const a=at(from.w,from.lateral),b=at(to.w,to.lateral),m=at(mix(from.w,to.w,xi),mix(from.lateral,to.lateral,xi));bx=m.x-mix(a.x,b.x,xi);bz=m.z-mix(a.z,b.z,xi);
  }
  return {ankle:V(mix(start.ankle.x,end.ankle.x,xi)+bx,y,mix(start.ankle.z,end.ankle.z,xi)+bz),pitch,yaw:start.yaw+dyaw*xi};
}

function footAt(steps,phi,parity){
  // latest footfall of this foot at or before phi
  let k=Math.floor(phi);if(((k%2)+2)%2!==parity)k--;
  if(k<0)k+=2;
  const step=steps[k],v=(phi-k)/(1+step.ds);
  if(v<=1||!steps[k+2])return {...footPose(step,stancePitch(step,Math.min(v,1))),planted:true,step:k,side:step.side,ground:step.ground};
  const u=(phi-k-1-step.ds)/(1-step.ds);
  return {...swingPose(step,steps[k+2],clamp(u,0,1),steps.laneAt),planted:false,step:k,side:step.side,swing:u,ground:step.ground};
}

function bodyHeight(steps,phi){
  const i=Math.floor(phi),k0=Math.max(0,i-1),next=steps[Math.min(steps.length-1,i+1)];
  let g=mix(steps[i].hip,next.hip,smooth(phi-i))+steps[Math.max(0,k0-1)].ground;
  for(let k=k0;k<=Math.min(steps.length-1,i+1);k++){
    if(k===0)continue;const delta=steps[k].ground-steps[k-1].ground;if(Math.abs(delta)<1e-9)continue;
    // rise: steady pull-up (cubic); drop: faster lowering then a quick catch
    const [a,b]=delta>0?G.rise:G.drop,u=(phi-k-a)/(b-a);g+=delta*(delta>0?smooth(u):smoother(u));
  }
  return g;
}

// How far the hips at travel t are above where both legs (hip joint to ankle
// no longer than LEG) can still reach their feet.
const REACH_BLUR=[[-.12,1/9],[-.06,2/9],[0,3/9],[.06,2/9],[.12,1/9]];
function reachShortfall(path,steps,t,parities){
  const phi=stepPhase(steps,t),frame=path.frame(t),w=1-smooth(path.flightGap(t)/G.stairZone);
  const hip=bodyHeight(steps,phi)-G.bob*Math.cos(2*Math.PI*phi)*(1-w),rx=Math.cos(frame.yaw),rz=-Math.sin(frame.yaw);
  // the knee stays a little bent on the floor and may straighten at the stair
  const leg=mix(LEG.floor,LEG.full,w);let reach=hip;
  for(const i of [0,1]){
    const foot=footAt(steps,phi,parities[i]),side=i?1:-1,d=Math.hypot(foot.ankle.x-(frame.x+rx*side*.10),foot.ankle.z-(frame.z+rz*side*.10));
    reach=Math.min(reach,foot.ankle.y+Math.sqrt(Math.max(0,leg*leg-d*d)));
  }
  return hip-reach;
}
// Pure pose description (no rig) at travel t on a path: pelvis, hip joints,
// feet and posture.
export function sampleHumanPath(path,t,walk=null){
  const steps=humanSchedule(path,walk);
  const phi=stepPhase(steps,t),frame=path.frame(t),w=1-smooth(path.flightGap(t)/G.stairZone),mode=path.direction>0?'up':'down';
  const floorBob=-G.bob*Math.cos(2*Math.PI*phi)*(1-w);
  const rx=Math.cos(frame.yaw),rz=-Math.sin(frame.yaw);
  const parities=steps[0].side===-1?[0,1]:[1,0];
  const feet=[-1,1].map((side,i)=>footAt(steps,phi,parities[i]));
  let hipY=bodyHeight(steps,phi)+floorBob;
  // On a cabin trip the floor steps can be as long as the cabin walk's: the
  // hips come down by what the legs lack to reach their feet. The shortfall
  // is averaged over a short stretch of the walk, because the leg trailing
  // far behind asks for it abruptly just before it leaves the floor.
  if(walk)hipY-=REACH_BLUR.reduce((sum,[offset,share])=>sum+share*reachShortfall(path,steps,t+offset,parities),0);
  const pelvis={x:frame.x,y:hipY,z:frame.z,yaw:frame.yaw};
  const hips=[-1,1].map(side=>V(pelvis.x+rx*side*.10,hipY,pelvis.z+rz*side*.10));
  // leg forwardness (+1 just landed, -1 about to lift) drives the opposite arm
  const forward=feet.map(f=>Math.cos(Math.PI*(phi-f.step)));
  const lean=mix(G.lean.floor,G.lean[mode],w)+G.leanWave[mode]*w*Math.cos(2*Math.PI*phi);
  return {phi,pelvis,hips,feet,forward,weight:w,mode,lean,gaze:mix(G.gaze.floor,G.gaze[mode],w),
    armSwing:mix(G.armSwing.floor,G.armSwing.stairs,w),
    center:frame};
}
// The stair study: the whole route, then the walk-off. StairTraffic raises
// exit by 0.6/s; leave the route end at the walking speed (2 x 0.55 m x
// 0.6/s = 0.66 m/s) and slow down evenly to a stop.
export function sampleHumanStairs(agent){
  const dir=agent.direction>0?1:-1,e=agent.wait===Infinity?clamp(agent.exit??0,0,1):0;
  return sampleHumanPath(studyPath(dir),toTravel(clamp(agent.s,0,L),dir)+G.exit*(1-(1-e)**2));
}

// ---- Rig
function solveLeg(rig,target,pole,bootWorld){
  const {leg,knee,boot}=rig,origin=leg.position.clone(),delta=target.clone().sub(origin),distance=delta.length();
  const upper=knee.position.length(),lower=boot.position.length();
  const d=Math.min(distance,upper+lower-.001),axis=delta.normalize();
  pole=pole.clone().addScaledVector(axis,-pole.dot(axis)).normalize();
  const along=(upper*upper+d*d-lower*lower)/(2*d),height=Math.sqrt(Math.max(0,upper*upper-along*along));
  const joint=origin.clone().addScaledVector(axis,along).addScaledVector(pole,height);
  leg.quaternion.setFromUnitVectors(knee.position.clone().normalize(),joint.clone().sub(origin).normalize());
  const shank=new THREE.Quaternion().setFromUnitVectors(boot.position.clone().normalize(),target.clone().sub(joint).normalize());
  knee.quaternion.copy(leg.quaternion).invert().multiply(shank);
  boot.quaternion.copy(shank).invert().multiply(bootWorld);
  return distance-d;
}

export function poseHumanStairs(root,agent,time){
  return poseHumanSample(root,sampleHumanStairs(agent),time,{moving:agent.wait!==Infinity&&!agent.waiting,waiting:agent.waiting,walkDistance:agent.s});
}
export function poseHumanPath(root,path,t,time,{walk=null,...options}={}){
  return poseHumanSample(root,sampleHumanPath(path,t,walk),time,{walkDistance:t,...options});
}
function poseHumanSample(root,sample,time,{moving=true,waiting=false,walkDistance=0,skipAnimate=false}={}){
  const {pelvis,feet}=sample,yaw=pelvis.yaw;
  if(!skipAnimate)animateMilo(root,{moving,waiting,climbing:false,facing:1,walkYaw:yaw,walkStyle:'legacy',walkDistance,time,dt:1/60});
  const {body,legs,arms}=root.userData;
  body.position.set(0,-.075,0);body.quaternion.identity();
  root.position.set(pelvis.x,pelvis.y-.895,pelvis.z);root.rotation.set(0,yaw,0);
  let reach=0;
  for(const rig of legs){
    const foot=feet[rig.side<0?0:1],local=foot.ankle.clone().sub(root.position).applyAxisAngle(UP,-yaw).sub(body.position);
    const dy=foot.yaw-yaw,pole=V(Math.sin(dy),-.1,Math.cos(dy));
    const bootWorld=new THREE.Quaternion().setFromEuler(new THREE.Euler(foot.pitch,dy,0,'YXZ'));
    reach=Math.max(reach,solveLeg(rig,local,pole,bootWorld));
  }
  for(const {arm,elbow,side} of arms){
    const swing=sample.forward[side<0?0:1];
    arm.rotation.x=sample.armSwing*swing-.04;elbow.rotation.x=-.19-.08*(1-swing)-.06*sample.weight;
  }
  applyLoungeSpine(root,sample.lean,0,sample.gaze);updateMiloSpine(root);
  root.userData.updateWristTwists?.();root.updateMatrixWorld(true);
  return {center:sample.center,feet:feet.map(f=>({x:f.ankle.x,y:f.ankle.y-G.foot.sole,z:f.ankle.z,planted:f.planted})),sample,maxReachError:reach};
}

// ---- Cabin trips: the cabin walk up to the stairs and away from them.
// Away from the flights a trip is walked in the cabin walk itself (cabinPose
// applies it with animateMilo, driven by the distance counter and with the
// stride it is given: walkDistance and walkStride).
// The stair walk is mixed in from where the walker starts to slow down
// (trip.slowDistance) and is used alone within `full` metres of the first
// and last flight and between two flights. While the walker slows down the
// cabin walk's step no longer matches the ground (it cannot shorten), so it
// takes them with a shortened stride and fades out as they shorten.
export const HUMAN_TRIP_POSE=Object.freeze({full:.5});
export function humanTripWeight(trip,t,speed=CREW_WALK_SPEED*.022){
  if(trip.betweenFlights(t))return 1;
  return 1-smooth((trip.flightGap(t)-HUMAN_TRIP_POSE.full)/(trip.slowDistance(speed)-HUMAN_TRIP_POSE.full));
}
function blendJoints(root){
  const {body,chest,head,arms,legs}=root.userData;
  return [body,chest,head,...legs.flatMap(l=>[l.leg,l.knee,l.boot]),...arms.flatMap(a=>[a.arm,a.elbow,a.hand])];
}
// `arrival`: {speed, entry} of the walker (see humanTripDistance; without it
// the crew's usual cabin speed and a walk counter of 0 are assumed).
export function poseHumanTrip(root,trip,t,time,{cabinPose=null,arrival,moving=true,waiting=false}={}){
  const walk=tripWalk(arrival),distance=humanTripDistance(trip,t,arrival),w=cabinPose?humanTripWeight(trip,t,walk.speed):1;
  let saved=null;
  if(w<1){
    cabinPose(distance,humanTripStride(trip,t,arrival));
    if(w<=0)return {handover:0,walkDistance:distance};
    saved={position:root.position.clone(),rotation:root.rotation.clone(),
      joints:blendJoints(root).map(joint=>({joint,position:joint.position.clone(),quaternion:joint.quaternion.clone()}))};
  }
  const result=poseHumanPath(root,trip,t,time,{moving,waiting,walk});
  if(saved){
    const stair=new Map(saved.joints.map(({joint})=>[joint,joint.quaternion.clone()]));
    root.position.lerpVectors(saved.position,root.position,w);
    // Blend the heading as a yaw angle. The cabin animation only ever writes
    // root.rotation.y; a quaternion blend would be read back as Euler angles
    // with x and z at pi, and every later cabin pose would face backwards.
    const from=saved.rotation.y,turn=Math.atan2(Math.sin(root.rotation.y-from),Math.cos(root.rotation.y-from));
    root.rotation.set(saved.rotation.x,from+turn*w,saved.rotation.z);
    // (slerp toward a copy: slerpQuaternions overwrites its target before reading the second argument)
    for(const {joint,position,quaternion} of saved.joints){joint.position.lerpVectors(position,joint.position,w);joint.quaternion.copy(quaternion).slerp(stair.get(joint),w);}
    const curve=root.userData.spineCurve;if(curve){curve.lean*=w;curve.curl*=w;}
    updateMiloSpine(root);root.userData.updateWristTwists?.();root.updateMatrixWorld(true);
  }
  return {...result,handover:w,walkDistance:distance};
}
