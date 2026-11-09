// Lucy on the stair tower (study only).
//
// Behaviour follows what real cats do on a ~30° domestic stair at a calm pace
// (see cat-motion-research.md): the ordinary lateral-sequence walk is kept
// (hind L, fore L, hind R, fore R), every paw advances exactly one tread per
// stride and lands inside a tread rather than on a nosing, left and right
// paws of a girdle step onto the same tread one after the other, the trunk
// rises with the flight in a crouch (forelimbs flexed going up, hindlimbs
// going down), the head is held lower to watch the treads ahead, forepaws are
// lifted over each riser going up and reach down past each nosing going down.
//
// Everything is a pure function of the route position, so scrubbing, pausing
// and reversing reproduce the same pose. The authored Walk clip still drives
// the spine, head, tail and paw curl; only the limb chains are re-aimed with a
// closed-form two-bone solve that keeps every bone length and the clip's own
// knee/elbow bend plane, so a joint can never flip.
import * as THREE from 'three';
import {animateLucy,LUCY} from '../../src/obs/lucy.js';
import {CAT_SCALE} from '../../src/obs/layout.js';
import {STAIRS,STAIR_SEGMENTS,STAIR_ROUTE_LENGTH,stairPoint} from './route.js';

const V=(...v)=>new THREE.Vector3(...v),Q=()=>new THREE.Quaternion(),UP=V(0,1,0);
const clamp=THREE.MathUtils.clamp,mix=THREE.MathUtils.lerp;
const smooth=t=>{t=clamp(t,0,1);return t*t*(3-2*t);};
const smoother=t=>{t=clamp(t,0,1);return t*t*t*(t*(t*6-15)+10);};
const L=STAIR_ROUTE_LENGTH,T=STAIRS.tread,RISE=STAIRS.rise;

export const CAT_STAIR_GAIT=Object.freeze({
  natural:LUCY.stride*LUCY.modelScale*CAT_SCALE, // flat stride of the cabin walk (m per cycle)
  tread:T,              // stride on a flight: one tread per cycle for every paw
  lane:.32,             // right-hand lane offset shared with the other walkers
  toe:.045,heel:.025,   // paw mesh reaches up to ~3.9 cm ahead of / 1.3-2.9 cm behind its contact
  riserBehind:.09,     // going down: room left to the riser behind the paw (elbow / hock clearance)
  clearance:{fore:.035,hind:.025},
  // Girdle lowered on the incline (fraction of standing height): forelimbs
  // flex going up, hindlimbs going down (Roberts 1967 via Carlson-Kuhta/Smith).
  crouch:{up:{fore:.20,hind:.10},down:{fore:.18,hind:.20}},
  headDown:{up:.45,down:.15}, // head pitched down by this share of the trunk pitch
  uprightHock:{up:0,down:.5}, // hind metatarsus blended toward vertical on the stair
  stepTime:.45,         // share of the swing spent rising onto / lowering to the next tread
  duty:.58,             // stance share on the stair rig (clip: .66); shorter stance on steep grades
  stairZone:{full:1.0,none:1.3}, // route distance to a flight where the stair rig is fully / not applied
  alignClear:.35,       // keep this much floor before/after a flight free of stride changes
});

const flights=STAIR_SEGMENTS.filter(s=>s.kind==='flight').map(s=>({...s,sign:Math.sign(s.b[0]-s.a[0]),run:Math.abs(s.b[0]-s.a[0])}));
const exitStart=STAIR_SEGMENTS.at(-2).start;

// Continuous floor path at the upper exit instead of the route's cusp. The
// curve is shorter than the route it replaces, so it is walked at arc-length
// speed that starts at the route speed and eases down toward the stop.
const EXIT=[V(STAIRS.right,RISE*40,STAIRS.back),V(-12.1,RISE*40,STAIRS.back),V(-12.8,RISE*40,STAIRS.front),V(-11.85,RISE*40,STAIRS.front)];
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
function catPoint(distance){
  if(distance<exitStart)return stairPoint(distance);
  const t=clamp((distance-exitStart)/(L-exitStart),0,1),k0=(L-exitStart)/EXIT_ARC.at(-1),k1=.5;
  const fraction=(t*t*t-2*t*t+t)*k0+(-2*t*t*t+3*t*t)+(t*t*t-t*t)*k1; // Hermite: route speed in, slower out
  const {p,tangent}=bezier(exitParameter(clamp(fraction,0,1)));
  return {x:p.x,y:p.y,z:p.z,dx:tangent.x,dz:tangent.z,kind:'landing'};
}
export function catFrame(s,direction){
  const p=catPoint(clamp(s,0,L)),dx=p.dx*direction,dz=p.dz*direction;
  return {x:p.x+dz*CAT_STAIR_GAIT.lane,y:p.y,z:p.z-dx*CAT_STAIR_GAIT.lane,dx,dz,yaw:Math.atan2(dx,dz),kind:p.kind};
}
const toS=(travel,direction)=>direction>0?travel:L-travel;
const flightGap=(f,s)=>Math.max(f.start-s,0,s-f.end);
export function nearestFlight(s){let best=flights[0],gap=Infinity;for(const f of flights){const g=flightGap(f,s);if(g<gap){gap=g;best=f;}}return {flight:best,gap};}

// ---- Stair geometry in a flight's own coordinate d (0 at the first riser,
// increasing uphill along the flight, `run` at the last riser).
const flightD=(f,x)=>(x-f.a[0])*f.sign;
const flightX=(f,d)=>f.a[0]+f.sign*d;
export function treadHeight(f,d){
  if(d<0)return f.a[1];if(d>=f.run-1e-9)return f.b[1];
  return f.a[1]+Math.min(9,Math.floor(d/T+1e-9)+1)*RISE;
}
const inFlightBand=(f,z)=>Math.abs(z-f.a[2])<=STAIRS.width/2+.12;
// Paws stay off nosings and keep their toes clear of the next riser.
function safeZone(f,d,ascending){
  const {toe,heel,riserBehind}=CAT_STAIR_GAIT,wall=ascending?toe:Math.max(heel,riserBehind),edge=ascending?heel:toe;
  if(d<0)return [-Infinity,-wall];
  if(d>=f.run)return [f.run+edge,Infinity];
  const k=Math.floor(d/T);return [k*T+edge,(k+1)*T-wall];
}
// Smoothed incline: the tread-centre line, eased into both landings.
function bodyGround(f,d){
  const line=f.a[1]+RISE*(d/T+.5),k=.2;
  const softMax=(a,b)=>{const h=clamp(.5+.5*(a-b)/k,0,1);return mix(b,a,h)+k*h*(1-h);};
  return -softMax(-softMax(line,f.a[1]),-f.b[1]);
}

// ---- Gait phase: one Walk cycle per natural stride on the floor, one per tread
// on a flight, re-phased on the approach so every paw lands inside a tread.
const PHASE_STEP=.005;
// Cadence follows the ground the paws actually cover on the walker's lane:
// horizontal distance per metre of route (less on a flight, more on the
// outside of a turn), one natural stride per cycle on floors, one tread on flights.
function rawRate(travel,direction){
  const s=toS(travel,direction),lo=clamp(s-.01,0,L),hi=clamp(s+.01,0,L);
  const p=catFrame(lo,direction),q=catFrame(hi,direction),ground=Math.hypot(q.x-p.x,q.z-p.z)/(hi-lo);
  for(const f of flights)if(s>=f.start&&s<=f.end)return ground/T;
  return ground/CAT_STAIR_GAIT.natural;
}
function buildPhase(direction,gait){
  const n=Math.ceil(L/PHASE_STEP),rate=new Float64Array(n+1),raw=new Float64Array(n+1);
  for(let i=0;i<=n;i++)rate[i]=rawRate(i*PHASE_STEP,direction);
  const blur=new Float64Array(n+1),half=Math.round(.15/PHASE_STEP);
  for(let i=0;i<=n;i++){let sum=0,count=0;for(let j=Math.max(0,i-half);j<=Math.min(n,i+half);j++){sum+=rate[j];count++;}blur[i]=sum/count;}
  for(let i=1;i<=n;i++)raw[i]=raw[i-1]+(blur[i-1]+blur[i])/2*PHASE_STEP;
  const ordered=direction>0?flights:[...flights].reverse();
  const table={direction,n,raw,phase:new Float64Array(n+1)},windows=[];
  const near=CAT_STAIR_GAIT.alignClear;
  let previous=0,floorFrom=-1.2;
  for(const f of ordered){
    const t0=direction>0?f.start:L-f.end,t1=direction>0?f.end:L-f.start;
    // Spread the re-phasing over the whole floor before this flight.
    const from=Math.min(floorFrom+near,t0-near-.6);
    let best=0,bestCost=Infinity;
    for(let c=-.5;c<.5;c+=.02){
      const offset=previous+c;
      table.phase.set(raw.map(v=>v+offset));
      let cost=Math.abs(c)*.002;const treads=gait.map(()=>new Map());
      const kFrom=Math.floor(phaseAt(table,t0-near))-2,kTo=Math.ceil(phaseAt(table,t1+.3))+2;
      gait.forEach((leg,j)=>{for(let k=kFrom;k<=kTo;k++){
        const t=travelAt(table,k+leg.touchdown+leg.duty/2);
        const p=plantRaw(leg,t,direction);if(!p.flight)continue;
        if(t>=t0-near&&t<=t1+.3)cost+=(p.d-p.snapped)**2;
        treads[j].set(k,p.snapped<0?-1:Math.min(9,Math.floor(p.snapped/T)));
      }});
      // Over the whole flight, the paws standing at any moment must span at
      // most one tread, and a girdle's two paws should share a tread: cats
      // step left/right onto the same tread one after the other.
      for(let phase=phaseAt(table,t0-near);phase<=phaseAt(table,t1+.3);phase+=.05){
        const standing=gait.map((leg,j)=>{const k=Math.floor(phase-leg.touchdown),q=phase-leg.touchdown-k;return q<leg.duty?treads[j].get(k):undefined;});
        const known=standing.filter(v=>v!==undefined);if(known.length<2)continue;
        cost+=Math.max(0,Math.max(...known)-Math.min(...known)-1);
        for(const rear of [false,true]){
          const pair=gait.map((leg,j)=>leg.rear===rear?standing[j]:undefined).filter(v=>v!==undefined);
          if(pair.length===2&&pair[0]!==pair[1])cost+=.2;
        }
      }
      if(cost<bestCost){bestCost=cost;best=offset;}
    }
    windows.push({from,to:t0-near,a:previous,b:best});previous=best;floorFrom=t1;
  }
  for(let i=0;i<=n;i++){
    const t=i*PHASE_STEP;let offset=0;
    for(const w of windows){if(t>=w.from)offset=w.a+(w.b-w.a)*smooth((t-w.from)/(w.to-w.from));}
    table.phase[i]=raw[i]+offset;
  }
  table.windows=windows;
  return table;
}
function phaseAt(table,travel){
  const f=clamp(travel/PHASE_STEP,0,table.n),i=Math.min(table.n-1,Math.floor(f));
  return mix(table.phase[i],table.phase[i+1],f-i);
}
function travelAt(table,phase){
  const p=table.phase;let lo=0,hi=table.n;
  if(phase<=p[0])return (phase-p[0])*CAT_STAIR_GAIT.natural;
  if(phase>=p[hi])return L+(phase-p[hi])*CAT_STAIR_GAIT.natural;
  while(hi-lo>1){const mid=(lo+hi)>>1;if(p[mid]<=phase)lo=mid;else hi=mid;}
  return (lo+(phase-p[lo])/(p[hi]-p[lo]))*PHASE_STEP;
}

// ---- Footfalls. A paw is planted where the authored Walk clip has it at
// mid-stance, then nudged into the safe part of the tread it falls on.
function plantRaw(leg,travel,direction){
  const s=toS(clamp(travel,0,L),direction),f=catFrame(s,direction);
  const sin=Math.sin(f.yaw),cos=Math.cos(f.yaw);
  const x=f.x+leg.contact.x*cos+leg.contact.z*sin,z=f.z-leg.contact.x*sin+leg.contact.z*cos;
  const {flight}=nearestFlight(s+direction*leg.contact.z);
  const out={x,z,y:f.y,flight:null,d:0,snapped:0};
  if(!inFlightBand(flight,z))return out;
  const d=flightD(flight,x),zone=safeZone(flight,d,direction>0),snapped=clamp(d,zone[0],zone[1]);
  Object.assign(out,{flight,d,snapped,x:flightX(flight,snapped),y:treadHeight(flight,snapped)});
  return out;
}
function plant(rig,leg,k,direction){
  const table=rig.phase[direction>0?0:1],travel=travelAt(table,k+leg.touchdown+leg.duty/2);
  return {...plantRaw(leg,travel,direction),travel};
}
function invert(fn,target){let lo=0,hi=1;for(let i=0;i<24;i++){const m=(lo+hi)/2;if(fn(m)<target)lo=m;else hi=m;}return (lo+hi)/2;}
// Swing: going up, the paw is lifted to the next tread before its toes reach
// the riser; a paw planted close to that riser rises nearly in place first.
// Going down, the paw is carried past the nosing before it is lowered, and a
// nosing close behind the landing spot makes it move ahead first. Either way
// the rise or drop takes at least `stepTime` of the swing, so no tread-high
// jump happens in a frame or two.
function swingPoint(leg,a,b,u,stairWeight){
  const f=b.flight??a.flight,{toe,heel,stepTime:W}=CAT_STAIR_GAIT,steps=[];
  let lag=0,lead=0;
  if(f&&inFlightBand(f,a.z)&&inFlightBand(f,b.z)){
    const da=flightD(f,a.x),db=flightD(f,b.x);
    if(Math.abs(db-da)>1e-6){
      const lo=Math.min(da,db),hi=Math.max(da,db),up=db>da;
      for(let i=0;i<=9;i++){
        const edge=i*T;if(edge<=lo-1e-9||edge>=hi+1e-9)continue;
        const step=treadHeight(f,edge+1e-6)-treadHeight(f,edge-1e-6);if(!step)continue;
        // share of the horizontal travel done when the toe meets the riser
        // (up) or the heel clears the nosing (down)
        const at=invert(smoother,clamp(up?(edge-toe-da)/(db-da):(da-(edge-heel))/(da-db),0,1));
        steps.push({step,up,at});
        if(up)lag=Math.max(lag,(W-at)/(1-at));else if(at>1-W)lead=Math.max(lead,1-(1-W)/at);
      }
    }
  }
  lag=Math.min(lag,.6);lead=Math.min(lead,.6-lag);
  const span=1-lag-lead,e=smoother((u-lag)/span);
  let y=steps.length?a.y:mix(a.y,b.y,e);
  for(const {step,up,at}of steps){
    const meet=lag+span*at;
    y+=up?step*smooth((u-Math.max(0,meet-W))/W):-step*smooth((u-Math.min(meet,1-W))/W);
  }
  const lift=(leg.rear?CAT_STAIR_GAIT.clearance.hind:CAT_STAIR_GAIT.clearance.fore)*(.45+.55*stairWeight);
  return {x:mix(a.x,b.x,e),y:y+lift*Math.sin(Math.PI*u),base:y,z:mix(a.z,b.z,e)};
}

// ---- Rig preparation: measure the authored Walk clip once.
function snapshot(model){const out=[];model.traverse(bone=>{if(bone.isBone)out.push({bone,position:bone.position.clone(),quaternion:bone.quaternion.clone()});});return out;}
const restore=pose=>pose.forEach(t=>{t.bone.position.copy(t.position);t.bone.quaternion.copy(t.quaternion);});
function prepare(root){
  const s=root.userData;if(s.stairRig)return s.stairRig;
  const position=root.position.clone(),rotation=root.quaternion.clone(),base=snapshot(s.model);
  root.position.set(0,0,0);root.quaternion.identity();root.updateMatrixWorld(true);
  const bones=s.ik.mesh.skeleton.bones;
  const legs=s.ik.iks.map(chain=>{
    const foot=bones[chain.target],rear=foot.name.startsWith('feet_'),side=foot.name.endsWith('_L')?1:-1;
    const links=chain.links.map(link=>bones[link.index]).reverse(),effector=bones[chain.effector],joints=[...links,effector];
    const lengths=joints.slice(1).map((b,i)=>b.getWorldPosition(V()).distanceTo(joints[i].getWorldPosition(V())));
    return {foot,rear,side,links,effector,lengths,samples:[]};
  });
  const settings=Object.entries(s.actions).map(([name,a])=>({a,time:a.time,weight:a.getEffectiveWeight(),name}));
  for(const {name,a}of settings)a.setEffectiveWeight(name==='Walk'?1:0);
  const N=120,hip=V(),shoulder=V();
  s.ikPose.forEach(({bone,rotation})=>bone.quaternion.copy(rotation));
  for(let i=0;i<N;i++){
    s.actions.Walk.time=i/N*LUCY.cycle;s.mixer.update(0);root.updateMatrixWorld(true);
    for(const leg of legs)leg.samples.push(leg.effector.getWorldPosition(V()));
    for(const leg of legs){const g=leg.links[0].getWorldPosition(V());(leg.rear?hip:shoulder).add(g.clone().multiplyScalar(1/(2*N)));(leg.girdle??=V()).add(g.multiplyScalar(1/N));}
  }
  for(const leg of legs){
    const ys=leg.samples.map(p=>p.y),ground=Math.min(...ys),stance=ys.map(y=>y<ground+.0015);
    let td=stance.findIndex((v,i)=>v&&!stance[(i-1+N)%N]);
    let count=stance.filter(Boolean).length;
    leg.touchdown=td/N;leg.clipDuty=count/N;leg.duty=CAT_STAIR_GAIT.duty;leg.ankle=ground;
    leg.reach=leg.lengths.reduce((a,b)=>a+b,0)*(leg.rear?.98:.995);
    // Plant where the clip has the paw at mid-stance: identical to touchdown on a
    // straight floor, and symmetric about the girdle on treads and in turns.
    const p=leg.samples[Math.round(td+count/2)%N];leg.contact={x:p.x,z:p.z};
    delete leg.samples;
  }
  settings.forEach(({a,time,weight})=>{a.time=time;a.setEffectiveWeight(weight);});s.mixer.update(0);restore(base);
  root.position.copy(position);root.quaternion.copy(rotation);root.updateMatrixWorld(true);
  const head=s.model.getObjectByName('Bone004');
  const rig={legs,head,hip:{y:hip.y,z:hip.z},shoulder:{y:shoulder.y,z:shoulder.z},sampledBones:snapshot(s.model)};
  rig.phase=[buildPhase(1,legs),buildPhase(-1,legs)];
  s.stairRig=rig;return rig;
}

// ---- Trunk: hip and shoulder heights over their own paws. The trunk pivots
// about its middle, so pitching it does not slide the girdles away from the
// paws planted under them.
function trunk(rig,s,direction,frame,deviation,feetWindow){
  const {flight,gap}=nearestFlight(s),sin=Math.sin(frame.yaw),cos=Math.cos(frame.yaw);
  const groundAt=forward=>bodyGround(flight,flightD(flight,frame.x+forward*sin));
  const {hip,shoulder}=rig,pivot={y:(hip.y+shoulder.y)/2,z:(hip.z+shoulder.z)/2};
  const a=shoulder.z-hip.z,b=shoulder.y-hip.y,r=Math.hypot(a,b),phi=Math.atan2(b,a);
  const at=(p,pitch)=>({f:pivot.z+(p.z-pivot.z)*Math.cos(pitch)-(p.y-pivot.y)*Math.sin(pitch),u:(p.y-pivot.y)*Math.cos(pitch)+(p.z-pivot.z)*Math.sin(pitch)});
  const crouch=CAT_STAIR_GAIT.crouch[direction>0?'up':'down'];
  let pitch=0,yh=0,ys=0;
  for(let i=0;i<4;i++){
    const incline=clamp(Math.abs(pitch)/.5,0,1);
    yh=groundAt(at(hip,pitch).f)+deviation.hind+hip.y*(1-crouch.hind*incline);
    ys=groundAt(at(shoulder,pitch).f)+deviation.fore+shoulder.y*(1-crouch.fore*incline);
    pitch=Math.asin(clamp((ys-yh)/r,-1,1))-phi;
  }
  // A standing paw left a tread lower (lateral-sequence walk) pulls its
  // girdle down so the limb still reaches the tread. Toward lift-off the pull
  // fades: the paw rolls onto its toes instead of dragging the body down. A
  // paw about to land on a lower tread starts the dip before touchdown, the
  // way a cat lowers its shoulders while reaching down a step.
  // Girdle positions are taken from the undipped trunk, so this is one pass.
  // The dip is averaged over a short stretch of the stride (tent window) so
  // it eases in and out instead of following each paw instant by instant.
  const desired={hip:yh,shoulder:ys},dip={hip:0,shoulder:0};let total=0;
  for(const {feet:sampled,weight:w} of feetWindow){
    const worst={hip:0,shoulder:0};
    for(const f of sampled){
      // a swinging paw is judged at the tread it is about to land on
      const pull=f.planted?1-smooth((f.stance-.5)/.45):smooth((f.swing-.6)/.35);if(!pull)continue;
      const p=f.planted?f:f.next,g=f.leg.girdle,ref=f.leg.rear?hip:shoulder,o=at(g,pitch),key=f.leg.rear?'hip':'shoulder';
      const gx=frame.x+g.x*cos+o.f*sin,gz=frame.z-g.x*sin+o.f*cos;
      const h=Math.min(Math.hypot(p.x-gx,p.z-gz),f.leg.reach*.9);
      const limit=p.y+f.leg.ankle+Math.sqrt(f.leg.reach**2-h*h)-(o.u-at(ref,pitch).u);
      worst[key]=Math.max(worst[key],pull*Math.max(0,desired[key]-limit));
    }
    dip.hip+=w*worst.hip;dip.shoulder+=w*worst.shoulder;total+=w;
  }
  yh=desired.hip-dip.hip/total;ys=desired.shoulder-dip.shoulder/total;
  pitch=Math.asin(clamp((ys-yh)/r,-1,1))-phi;
  const pivotY=yh-at(hip,pitch).u,c=Math.cos(pitch),sn=Math.sin(pitch);
  // root (ground-level origin of the rig) placed so the pivot keeps its flat position
  return {y:pivotY-(pivot.y*c+pivot.z*sn),forward:pivot.z-(pivot.z*c-pivot.y*sn),pitch,gap,flight,deviation};
}

// ---- Closed-form limb solve.
function aimBone(bone,from,to){
  // Rotate `bone` (world) so the joint currently at `from` moves to `to`.
  const origin=bone.getWorldPosition(V());
  const d0=from.clone().sub(origin).normalize(),d1=to.clone().sub(origin).normalize();
  const delta=Q().setFromUnitVectors(d0,d1),world=delta.multiply(bone.getWorldQuaternion(Q()));
  bone.quaternion.copy(bone.parent.getWorldQuaternion(Q()).invert().multiply(world));
  bone.updateWorldMatrix(false,true);
}
function twoBone(root,joint,end,target,l1,l2){
  // Joint position keeping the current bend plane (no flips).
  const axis=target.clone().sub(root),dist=clamp(axis.length(),Math.abs(l1-l2)+1e-5,l1+l2-1e-5);axis.normalize();
  const along=(l1*l1+dist*dist-l2*l2)/(2*dist),height=Math.sqrt(Math.max(0,l1*l1-along*along));
  const pole=joint.clone().sub(root);pole.addScaledVector(axis,-pole.dot(axis));
  if(pole.lengthSq()<1e-10){pole.set(0,0,1);if(Math.abs(axis.z)>.9)pole.set(1,0,0);pole.addScaledVector(axis,-pole.dot(axis));}
  pole.normalize();
  return root.clone().addScaledVector(axis,along).addScaledVector(pole,height);
}
function solveLeg(leg,target,metatarsus,upright=0){
  const [a,b,c]=leg.links,wp=o=>o.getWorldPosition(V());
  if(!leg.rear){
    const s=wp(a),e=wp(b),w=wp(leg.effector),elbow=twoBone(s,e,w,target,leg.lengths[0],leg.lengths[1]);
    aimBone(a,e,elbow);aimBone(b,wp(leg.effector),target);
  }else{
    const h=wp(a),k=wp(b),reach=leg.lengths[0]+leg.lengths[1];
    // Keep the clip's metatarsus angle, stood up somewhat on the stair so the
    // hock stays over the paw instead of reaching back into the riser behind;
    // bend it toward the hip only if needed to reach.
    let m=metatarsus.clone().lerp(V(0,-1,0),upright).normalize(),hock=target.clone().addScaledVector(m,-leg.lengths[2]);
    if(hock.distanceTo(h)>reach*.995){
      const n=target.clone().sub(h).normalize();
      const tryAt=l=>{const dir=m.clone().lerp(n,l).normalize();return target.clone().addScaledVector(dir,-leg.lengths[2]);};
      let lo=0,hi=1;for(let i=0;i<16;i++){const mid=(lo+hi)/2;if(tryAt(mid).distanceTo(h)>reach*.995)lo=mid;else hi=mid;}
      hock=tryAt(hi);
    }
    const knee=twoBone(h,k,wp(c),hock,leg.lengths[0],leg.lengths[1]);
    aimBone(a,k,knee);aimBone(b,wp(c),hock);aimBone(c,wp(leg.effector),target);
  }
  return wp(leg.effector).distanceTo(target);
}

const GIRDLE_SAMPLES=12,DIP_WINDOW=[[-.2,1],[-.15,2],[-.1,3],[-.05,4],[0,5],[.05,4],[.1,3],[.15,2],[.2,1]];
function feetAt(rig,phase,direction,weight){
  return rig.legs.map(leg=>{
    const k=Math.floor(phase-leg.touchdown),q=phase-leg.touchdown-k;
    const a=plant(rig,leg,k,direction);
    if(q<leg.duty)return {leg,...a,planted:true,swing:0,stance:q/leg.duty};
    const b=plant(rig,leg,k+1,direction),u=(q-leg.duty)/(1-leg.duty);
    return {leg,...swingPoint(leg,a,b,u,weight),planted:false,swing:u,stance:1,next:b};
  });
}
export function sampleCatStairs(root,agent){
  const rig=prepare(root),{s,direction}=agent,travel=direction>0?s:L-s,table=rig.phase[direction>0?0:1];
  const frame=catFrame(s,direction);
  if(agent.wait===Infinity){frame.x+=.35*(agent.exit??0);frame.z+=.48*(agent.exit??0);}
  const {gap}=nearestFlight(s),{full,none}=CAT_STAIR_GAIT.stairZone;
  const weight=agent.wait===Infinity?0:1-smooth((gap-full)/(none-full));
  const phase=phaseAt(table,travel),feet=feetAt(rig,phase,direction,weight);
  // Girdles follow the smoothed incline, offset by how far their own paws sit
  // below/above it, averaged over exactly one gait cycle (one tread per cycle,
  // so the average is constant mid-flight and only changes at the landings).
  const {flight}=nearestFlight(s),deviation={fore:0,hind:0};
  for(let j=0;j<GIRDLE_SAMPLES;j++){
    for(const f of feetAt(rig,phase+(j+.5)/GIRDLE_SAMPLES-.5,direction,weight))
      deviation[f.leg.rear?'hind':'fore']+=((f.base??f.y)-bodyGround(flight,flightD(flight,f.x)))/(2*GIRDLE_SAMPLES);
  }
  const feetWindow=DIP_WINDOW.map(([offset,w])=>({feet:offset?feetAt(rig,phase+offset,direction,weight):feet,weight:w}));
  const body=trunk(rig,s,direction,frame,deviation,feetWindow);
  return {center:frame,body,weight,phase,walkDistance:phase*CAT_STAIR_GAIT.natural,feet};
}

export function poseCatStairs(root,agent,time,dt){
  const rig=prepare(root),s=root.userData,sample=sampleCatStairs(root,agent),{center,body,weight,feet}=sample;
  restore(rig.sampledBones);
  const moving=agent.wait!==Infinity&&!agent.waiting;
  root.position.set(center.x,center.y,center.z);root.rotation.set(0,center.yaw,0,'YXZ');root.updateMatrixWorld(true);
  animateLucy(root,{time,dt:Math.max(dt,1/120),moving,yaw:center.yaw,headingControlled:true,mode:'idle',walkDistance:sample.walkDistance});
  rig.sampledBones.forEach(t=>{t.position.copy(t.bone.position);t.quaternion.copy(t.bone.quaternion);});
  root.updateMatrixWorld(true);
  const flat=feet.map(f=>({foot:f.leg.foot.getWorldPosition(V()),footQ:f.leg.foot.getWorldQuaternion(Q()),
    metatarsus:f.leg.rear?f.leg.effector.getWorldPosition(V()).sub(f.leg.links[2].getWorldPosition(V())).normalize():null}));
  // Contact markers show where the visible paws actually are.
  const marks=at=>feet.map(({leg,next,...f},i)=>{const p=at(leg,i);return {...f,x:p.x,y:p.y-leg.ankle,z:p.z,side:leg.side,rear:leg.rear};});
  const result={center,feet:marks((leg,i)=>flat[i].foot),pitch:0,stairWeight:weight,mode:'walk',maxReachError:0,body,walkDistance:sample.walkDistance};
  if(weight===0){s.stairRequests=[];return result;}
  root.position.set(center.x+center.dx*body.forward*weight,mix(center.y,body.y,weight),center.z+center.dz*body.forward*weight);
  root.rotation.set(-body.pitch*weight,center.yaw,0,'YXZ');root.updateMatrixWorld(true);
  const lateral=V(1,0,0).applyAxisAngle(UP,center.yaw);
  if(rig.head){
    const amount=(body.pitch>0?CAT_STAIR_GAIT.headDown.up:CAT_STAIR_GAIT.headDown.down)*Math.abs(body.pitch)*weight;
    const world=Q().setFromAxisAngle(lateral,amount).multiply(rig.head.getWorldQuaternion(Q()));
    rig.head.quaternion.copy(rig.head.parent.getWorldQuaternion(Q()).invert().multiply(world));rig.head.updateWorldMatrix(false,true);
  }
  const fk=rig.legs.map(leg=>[...leg.links].map(b=>b.quaternion.clone()));
  let maxReachError=0;const requests=[];
  feet.forEach((f,i)=>{
    const leg=f.leg,target=V(f.x,f.y+leg.ankle,f.z);
    const error=solveLeg(leg,target,flat[i].metatarsus,CAT_STAIR_GAIT.uprightHock[agent.direction>0?'up':'down']*weight);maxReachError=Math.max(maxReachError,error);
    if(weight<1){leg.links.forEach((b,j)=>b.quaternion.slerpQuaternions(fk[i][j],b.quaternion.clone(),weight));}
    root.updateMatrixWorld(true);
    // The visible paw is a separate deform bone driven by a control bone.
    const at=leg.effector.getWorldPosition(V());
    leg.foot.position.copy(leg.foot.parent.worldToLocal(at));
    leg.foot.quaternion.copy(leg.foot.parent.getWorldQuaternion(Q()).invert().multiply(flat[i].footQ));
    leg.foot.updateWorldMatrix(false,true);
    requests.push({leg,f,target,error});
  });
  root.updateMatrixWorld(true);s.stairRequests=requests;
  return {...result,feet:marks(leg=>leg.foot.getWorldPosition(V())),pitch:body.pitch*weight,mode:weight===1?'stairs':'transition',maxReachError};
}
