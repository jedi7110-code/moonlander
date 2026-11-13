// A walk from standing to standing, built on the measured walk cycle.
//
// The cabin walk (applyMocapWalk) plays one measured cycle at whatever speed the
// figure moves and switches between standing and mid-stride in one frame. This
// module plans a whole walk instead:
//   - step length and cadence follow the speed, as people's do (step length
//     grows with speed to the power 0.42, Grieve 1968; the cycle itself is the
//     anchor: 0.777 m steps at 1.39 m/s);
//   - a short walk does not reach the cruising speed (peak speed over a bout of
//     D metres falls short of the long-walk speed, the more the shorter it is);
//   - the walk starts from standing: the weight shifts onto the standing leg
//     as the other foot rolls off the floor and goes forward in one movement,
//     for a shorter, slower first step, and the body sets off with it;
//   - it ends with a shorter last step and the trailing foot set down beside
//     the leading one;
//   - arm swing, the turning of pelvis and trunk and the rise and fall of the
//     hips shrink with speed, while the side-to-side sway grows.
//
// It keeps the measured motion. The cycle's forward (ground) coordinate is
// warped so that its footfalls land on the planned ones: a planted foot sits on
// a fixed point of the warp, so it slides no more than in the measured cycle.
// At the start two of the cycle's footfalls are warped onto one place (the feet
// stand together); the first foot then follows the measured push-off and swing
// over its own, shorter way to its first landing, and the hips are let go
// ahead of the cycle so that the body moves from the start. At the end the
// warp brings the trailing foot to rest beside the other one, and it is
// lowered as it arrives.
//
// Sources and numbers: studies/milo/walk-research.md.
// The cabin walks with MiloWalker (below): the same plan, followed step by step, which can be
// given a new end while it is under way. The study (studies/milo/walk.html) shows whole plans.
import {sampleWalk,applyMocapSample,miloWalkData} from './mocap-walk.js';
import {updateMiloSpine} from './milo-spine.js';
import {updateMiloNeck} from './milo-neck.js';

export const MILO_GAIT=Object.freeze({
  // step length = the cycle's step x (speed / the cycle's speed)^stepPower
  stepPower:.42,
  // A short walk does not reach the long-walk speed. Measured peak speeds of bouts of D metres
  // follow 1-exp(-D/boutLength); the start and the stop below already take part of that, so the
  // cruising speed planned here is the square root of it. Steps are never slower than leastRate
  // (cycles/s): over a metre or two people take brisk short steps, not slow ones.
  boutLength:1.877,leastRate:.78,
  // Step lengths at the ends of a walk, as fractions of the steady step. The body comes to rest
  // over the last footfall, so it covers the last step while losing all its speed: that step is
  // the shortest (a longer one would have the body speed up before it brakes).
  firstStep:.80,secondStep:.96,beforeLast:.92,lastStep:.62,
  // step-to-step variation of step length (coefficient of variation, healthy adults: 2%)
  variation:.02,
  // The step rate starts at `startRate` of its cruising value and reaches it over `accelerate`
  // seconds; it falls to `endRate` over the last `decelerate` seconds. (The body itself starts
  // and stops smoothly whatever the rate: at both ends the feet move on the spot.)
  startRate:.5,endRate:.5,accelerate:1.20,decelerate:.50,
  // seconds at each end in which nothing moves yet: the legs pass between the standing rig's
  // exact pose and the solver's (whose knee is a centimetre further forward)
  rest:.10,
  // cycles: the standing pose gives way to the walk from `early` after the start, over
  // `leaveStand`; it has returned when the trailing foot arrives
  early:.03,leaveStand:.32,enterStand:.28,
  // The first step is one movement: the foot goes forward from the moment it leaves the floor
  // (it does not rise on the spot first) and the body sets off with it. From standing the foot
  // has not been trailing behind, so it is lifted less than in mid-walk: `firstLift` of the
  // measured height at the start of its swing, the full height by its landing.
  firstLift:.5,
  // cycles over which the first foot starts to roll off the floor; the trailing foot comes down
  // over the last part of its way (from `closeFrom` of it) and the walk is over `settle` cycles later
  footOff:.17,closeFrom:.5,settle:.03,
  standHalfWidth:.100,
  // metres the hips move over the standing leg before the first step
  weightShift:.028,
  // hips rise a little when the steps are short (the legs stay straighter)
  shortStepLift:.03,
  // least roll of the foot, as a fraction of the measured one, where the steps shrink to nothing
  leastRoll:.35,
  naturalSpeed:miloWalkData.cycleDistance/miloWalkData.duration,
  naturalStep:miloWalkData.cycleDistance/2,
});

const smooth=x=>{const t=Math.min(1,Math.max(0,x));return t*t*(3-2*t);};
const smoothArea=x=>{const t=Math.min(1,Math.max(0,x));return t*t*t-t*t*t*t/2;};      // integral of smooth from 0
const lerp=(a,b,t)=>a+(b-a)*t;
const other=foot=>foot==='Left'?'Right':'Left';

// Step length a person of this build takes at a speed (m, m/s).
export function naturalStepLength(speed,gait=MILO_GAIT){return gait.naturalStep*Math.pow(Math.max(0,speed)/gait.naturalSpeed,gait.stepPower);}
// Peak speed of a walk of `distance` metres whose long-walk speed is `speed`.
export function boutSpeed(distance,speed,gait=MILO_GAIT){return speed*Math.sqrt(1-Math.exp(-Math.max(0,distance)/gait.boutLength));}

// ---- What the measured cycle does, in ground coordinates -------------------
// u counts cycles; the cycle moves cycleDistance per cycle, so a joint's ground
// coordinate is its sample z plus cycleDistance*u.
const analyses=new WeakMap();
function analyse(data){
  if(analyses.has(data))return analyses.get(data);
  const C=data.cycleDistance,N=data.count,index=name=>data.names.indexOf(name)*3;
  const feet={};let centre=0;
  for(const foot of ['Left','Right']){
    const a=index(foot+'Foot'),t=index(foot+'ToeBase'),planted=[];
    const ground=f=>data.frames[(f%N+N)%N][a+2]+C*f/N;
    for(let f=0;f<N;f++){
      const frame=data.frames[f],clear=Math.min(frame[a+1]-data.ankleHeight,frame[t+1]-data.toeHeight)-.003;
      if(clear<=.0005&&Math.abs(ground(f+1)-ground(f-1))*N/2<.12*C)planted.push(f);
    }
    // the planted frames may wrap round the end of the cycle: bring them to one stretch
    const start=planted.find(f=>!planted.includes((f-1+N)%N))??planted[0];
    const stretch=planted.map(f=>f<start?f+N:f).sort((x,y)=>x-y),values=stretch.map(ground).sort((x,y)=>x-y);
    const landing=values[Math.floor(values.length/2)];
    const side=stretch.reduce((sum,f)=>sum+data.frames[f%N][a],0)/stretch.length;
    feet[foot]={landing,landed:start/N,side};centre+=side/2;
  }
  // Left's landing after Right's (one step on): bring the pair into order
  while(feet.Left.landing<feet.Right.landing){feet.Left.landing+=C;feet.Left.landed+=1;}
  while(feet.Left.landing-feet.Right.landing>C){feet.Left.landing-=C;feet.Left.landed-=1;}
  const result={C,feet,centre,sample:u=>sampleWalk(data,(u-Math.floor(u))*data.duration)};
  result.ground=(p,name,u)=>p[name].z+C*u;
  // when (cycles) a foot is planted on the landing at ground coordinate g
  result.landsAt=(foot,g)=>(g-feet[foot].landing)/C+feet[foot].landed;
  // the phase (cycles) at which the swinging foot's ankle passes ground coordinate g
  result.passing=(foot,g,from,to)=>{
    let a=from,b=to;
    for(let i=0;i<40;i++){const mid=(a+b)/2;if(result.ground(result.sample(mid),foot+'Foot',mid)<g)a=mid;else b=mid;}
    return (a+b)/2;
  };
  analyses.set(data,result);return result;
}

// Monotone cubic through (x,y) knots (Fritsch-Carlson). Outside the knots it is
// constant, or (open) goes on straight at the end slope. Between two knots of
// equal y it is flat. `fixed`: [index, slope] pairs of knots whose slope is given.
function monotone(xs,ys,{openStart=false,openEnd=false,fixed=null}={}){
  const n=xs.length,d=[],m=new Array(n);
  for(let i=0;i<n-1;i++)d.push((ys[i+1]-ys[i])/(xs[i+1]-xs[i]));
  m[0]=d[0];m[n-1]=d[n-2];
  for(let i=1;i<n-1;i++)m[i]=d[i-1]*d[i]<=0?0:2*d[i-1]*d[i]/(d[i-1]+d[i]);
  // (a slope given for a knot is kept as far as the curve stays monotone)
  // (and it carries over to the knots close by: the curve does not change its slope at once there)
  if(fixed)for(const [i,slope] of fixed)for(let k=1;k<n-1;k++){
    const near=1-Math.min(1,Math.abs(xs[k]-xs[i])/.15);
    if(near>0)m[k]=Math.max(0,Math.min(m[k]+(slope-m[k])*near,3*d[k-1],3*d[k]));
  }
  return x=>{
    if(x<=xs[0])return openStart?{y:ys[0]+m[0]*(x-xs[0]),slope:m[0]}:{y:ys[0],slope:0};
    if(x>=xs[n-1])return openEnd?{y:ys[n-1]+m[n-1]*(x-xs[n-1]),slope:m[n-1]}:{y:ys[n-1],slope:0};
    let i=0;while(x>xs[i+1])i++;
    const h=xs[i+1]-xs[i],t=(x-xs[i])/h,t2=t*t,t3=t2*t;
    return {y:(2*t3-3*t2+1)*ys[i]+(t3-2*t2+t)*h*m[i]+(-2*t3+3*t2)*ys[i+1]+(t3-t2)*h*m[i+1],
      slope:((6*t2-6*t)*ys[i]+(3*t2-4*t+1)*h*m[i]+(-6*t2+6*t)*ys[i+1]+(3*t2-2*t)*h*m[i+1])/h};
  };
}

// A repeatable number in -1..1 for step k of a walk.
function scatter(seed,k){let h=(Math.imul(seed|0,2654435761)^Math.imul(k+1,1597334677))>>>0;h=Math.imul(h^(h>>>15),2246822519)>>>0;h=(h^(h>>>13))>>>0;return h/2147483648-1;}

// Step lengths of a walk of `count` steps, as fractions of the steady step.
function stepShape(count,gait,vary){
  const {firstStep,secondStep,beforeLast,lastStep,variation}=gait;
  if(count===1)return [1];
  if(count===2)return [firstStep,lastStep];
  const shape=new Array(count).fill(1);shape[0]=firstStep;shape[count-1]=lastStep;
  if(count===3)shape[1]=(secondStep+beforeLast)/2;else{shape[1]=secondStep;shape[count-2]=count===4?(secondStep+beforeLast)/2:beforeLast;}
  if(count===4)shape[1]=shape[2];
  if(vary!==false&&vary!==null)for(let k=1;k<count-1;k++)shape[k]*=1+variation*1.4*scatter(vary,k);
  return shape;
}

// Plan a straight walk of `distance` metres from standing with the feet
// together to standing with the feet together. `speed` is the long-walk
// (cruising) speed in m/s.
//   first      the foot that takes the first step
//   stepLength steady step length to aim for (default: natural for the speed reached)
//   bout       false: reach `speed` however short the walk
//   vary       seed of the step-to-step variation, or false for none
// In the plan, `footfalls` are where the feet land (m): [0] and [1] are the two
// feet standing at the start (the first foot, then the other), the last two are
// both feet at the end, and `count` steps lie between.
export function planMiloWalk(distance,speed,{first='Left',stepLength=null,bout=true,vary=1,data=miloWalkData,gait=MILO_GAIT}={}){
  if(!(distance>0)||!(speed>0))throw new Error('planMiloWalk needs a distance and a speed');
  const cycle=analyse(data),C=cycle.C,second=other(first);
  const cruise=bout?boutSpeed(distance,speed,gait):speed,aim=stepLength??naturalStepLength(cruise,gait);
  // number of steps whose steady length comes closest to the one aimed for
  let best=null;
  for(let count=1;count<=Math.ceil(distance/aim)+3;count++){
    const shape=stepShape(count,gait,vary),steady=distance/shape.reduce((a,b)=>a+b,0),error=Math.abs(Math.log(steady/aim));
    if(!best||error<best.error)best={count,shape,steady,error};
  }
  const {count,shape,steady}=best,trailing=count%2?second:first;
  // the landings of the measured cycle, in turn: the first foot's own (it stands on it at the
  // start), the other foot's, then `count` steps, then one more by the trailing foot
  const base=cycle.feet[second].landing,toFirst=((cycle.feet[first].landing-base)%C+C)%C;
  const landing=k=>base+Math.floor(k/2)*C+(((k%2)+2)%2?toFirst:0);
  const knots=[],footfalls=[];
  for(let k=-1;k<=count+1;k++){
    knots.push(landing(k));
    footfalls.push(k<=0?0:k>=count?distance:footfalls.at(-1)+shape[k-1]*steady);
  }
  const owners=knots.map((g,i)=>i%2?second:first),stride=steady/(C/2);
  const plan=finishPlan({data,gait,cycle,knots,footfalls,owners,fromStanding:true,toStanding:true,
    nominal:knots.map(()=>stride),plain:knots.map(()=>0)});
  const {u0,u1}=plan;
  // step rate: builds up, holds, dies away, and brings the cycle to u1 exactly
  const rate=Math.max(Math.min(gait.leastRate,speed/(2*steady)),cruise/(2*steady)),phase=u1-u0,{startRate,endRate}=gait;let {accelerate,decelerate}=gait;
  const ramps=((1+startRate)*accelerate+(1+endRate)*decelerate)/2;                                // cycles/rate spent in the two ramps
  if(phase/rate<ramps){const shrink=phase/rate/ramps;accelerate*=shrink;decelerate*=shrink;}
  const walking=phase/rate+((1-startRate)*accelerate+(1-endRate)*decelerate)/2;
  return Object.freeze({...plan,distance,speed,cruise,count,steady,cadence:rate*120,rate,pace:rate*2*steady,accelerate,decelerate,walking,
    duration:walking+2*gait.rest,stride});
}

// The other foot's first landing in the measured cycle after ground coordinate g.
function nextLanding(cycle,foot,g){
  const base=cycle.feet[other(foot)].landing,C=cycle.C;
  let next=base+Math.ceil((g-base)/C-1e-9)*C;if(next<=g+1e-9)next+=C;
  return next;
}

// Complete a plan from its footfalls. `knots` are successive landings of the measured cycle
// (ground coordinates, the feet in turn: `owners`), `footfalls` where they come down on the
// floor (m). fromStanding: the first two knots are the two feet standing together;
// toStanding: so are the last two. An end that is not standing is "open": the figure is
// (or goes on) walking there. `nominal` is the step scale the step rate counts on at each
// knot, `plain` 0..1 how far the walk there is the plain measured cycle.
function finishPlan(plan){
  const {cycle,knots,footfalls,owners,gait}=plan,last=knots.length-1;
  plan.lands=knots.map((g,i)=>cycle.landsAt(owners[i],g));
  // `anchor` {g,y,slope}: a point the warp also passes through, with that slope (where the hips
  // were when the plan was changed under way: they go on from there at the speed they had)
  const xs=[...knots],ys=[...footfalls];let fixed=null;
  if(plan.anchor){
    const at=xs.findIndex(g=>g>plan.anchor.g),on=xs.findIndex(g=>Math.abs(g-plan.anchor.g)<=1e-3);
    // (at a knot itself, it is that knot's slope)
    if(on>=0)fixed=[[on,plan.anchor.slope]];
    else if(at>0&&plan.anchor.y>=ys[at-1]&&plan.anchor.y<=ys[at]){xs.splice(at,0,plan.anchor.g);ys.splice(at,0,plan.anchor.y);fixed=[[at,plan.anchor.slope]];}
  }
  plan.warp=monotone(xs,ys,{openStart:!plan.fromStanding,openEnd:!plan.toStanding,fixed});
  plan.first=plan.second=plan.trailing=null;plan.u0=plan.lands[0];plan.uClose=plan.u1=Infinity;plan.behind=0;
  if(plan.fromStanding){
    // start: the standing foot is planted (in the cycle it has just landed, a step ahead of the
    // first foot, which is rolling off: warped onto one place). The first foot passes it at uPass.
    plan.first=owners[0];plan.second=owners[1];plan.u0=plan.lands[1];plan.firstLands=plan.lands[2];
    plan.uPass=cycle.passing(plan.first,knots[1],plan.firstLands-.62,plan.firstLands-.02);
    // the cycle's hips are this far behind the standing foot at the start, and catch up by the first landing
    const start=cycle.sample(plan.u0);plan.behind=knots[1]-cycle.ground(start,'Hips',plan.u0);
    // (the first foot is already rolling off its footfall in the cycle: its way starts from there)
    plan.firstFrom=cycle.ground(start,plan.first+'Foot',plan.u0);
  }
  if(plan.toStanding){
    // End: the trailing foot passes the last landing at uClose and lands beside it.
    plan.trailing=owners[last];
    plan.uClose=cycle.passing(plan.trailing,knots[last-1],plan.lands[last]-.62,plan.lands[last]-.02);plan.u1=plan.uClose+gait.settle;
  }
  return plan;
}

// Cycles walked at time t (s) of a plan, and the step rate there (cycles/s).
function planPhase(plan,t){
  const {u0,rate,accelerate:a,decelerate:d,walking:T,gait:{startRate:r0,endRate:r1,rest}}=plan,time=Math.min(T,Math.max(0,t-rest));
  const up=Math.min(time,a),down=Math.max(0,time-(T-d));
  const rising=r0*up+(1-r0)*a*smoothArea(up/a),cruise=Math.max(0,Math.min(time,T-d)-a);
  const falling=r1*down+(1-r1)*d*(.5-smoothArea((d-down)/d));
  return {u:u0+rate*(rising+cruise+falling),rate:rate*Math.min(r0+(1-r0)*smooth(time/a),r1+(1-r1)*smooth((T-time)/d))};
}

// Which of its own footfalls a foot is between (indices into plan.footfalls).
function footSpan(plan,foot,ground){
  const {knots,owners}=plan;let from=null,to=null;
  for(let i=0;i<knots.length;i++){if(owners[i]!==foot)continue;if(from===null||knots[i]<=ground+1e-9)from=i;else if(to===null)to=i;}
  return {from,to:to??from};
}

// How far the figure walks rather than stands at phase u of a plan (0..1).
function walkWeight(plan,u){
  const {gait}=plan,leaving=plan.fromStanding?smooth((u-plan.u0-gait.early)/gait.leaveStand):1,entering=plan.toStanding?smooth((plan.uClose-u)/gait.enterStand):1;
  return leaving*entering;
}

// The walk at phase u (cycles) of a plan: where the figure is and what its pose needs.
// `rate`: the step rate there (cycles/s); `walk`: the walk weight, when it is not the plan's own.
function stateAt(plan,u,rate,walk=walkWeight(plan,u)){
  const {cycle,gait,u0,uPass,warp,knots,first,second,trailing}=plan;
  const p=cycle.sample(u),last=knots.length-1;
  // the root follows the hips: the warp holds them over the feet at both ends
  // (at the start they are let go ahead of the cycle, in which they would wait behind the
  // standing foot: the lead shrinks to nothing by the first landing)
  const setOff=plan.fromStanding?smooth((u-u0)/(plan.firstLands-u0)):1;
  const hips=warp(cycle.ground(p,'Hips',u)+plan.behind*(1-setOff)),x=hips.y;
  // footfalls where the figure stands rather than walks: the feet are at the standing width
  // and the toes point straight ahead
  const stood=i=>(plan.fromStanding&&i<=1)||(plan.toStanding&&i>=last-1);
  const feet={};
  for(const foot of ['Left','Right']){
    const ground=cycle.ground(p,foot+'Foot',u),{from,to}=footSpan(plan,foot,ground);
    // (the trailing foot's last way ends beside the other foot, not a step beyond it)
    const closing=foot===trailing&&to===last&&from!==to,arrival=closing?Math.min(1,Math.max(0,(ground-knots[from])/(knots[last-1]-knots[from]))):0;
    const progress=to===from?0:closing?smooth(arrival):smooth((ground-knots[from])/(knots[to]-knots[from]));
    const sign=foot==='Left'?-1:1,walking=cycle.feet[foot].side-cycle.centre,standing=sign*gait.standHalfWidth;
    const lateral=i=>stood(i)?standing:walking,walked=lerp(stood(from)?0:1,stood(to)?0:1,progress);
    const swingAside=(p[foot+'Foot'].x-cycle.feet[foot].side)*walk;
    // The first foot rolls off the floor and the trailing foot comes down onto it as measured;
    // every other standing foot is flat for as long as the figure stands.
    const leavesFloor=plan.fromStanding&&foot===first&&from===0,comesDown=foot===trailing&&to===last?(from===last?1:smooth(progress*6)):0;
    let lift=to===from?walk:1;                 // (on its last footfall a foot stays down, whatever the cycle does next)
    if(plan.fromStanding&&foot===first)lift=Math.min(lift,smooth((u-u0)/gait.footOff));
    if(leavesFloor)lift*=lerp(gait.firstLift,1,progress);
    // It comes down as it arrives. The warp slows it to rest there, so the way left shrinks with
    // the square of what is left of the cycle's own way: lowering it in proportion to the latter
    // brings it to the floor only where it stops. The foot itself is level well before that.
    const coming=closing?Math.max(0,(arrival-gait.closeFrom)/(1-gait.closeFrom)):0,level=closing?1-smooth(coming/.8):1;
    if(closing)lift=Math.min(lift,1-coming);
    // a shorter step rolls the foot less (heel strike and push-off are flatter), by the same
    // factor as the warp shortens the ankle's travel over the planted heel and toe
    // (the first foot goes straight from where it stands to its first landing)
    // (its roll grows to that of the walk it lands in)
    const way=leavesFloor?knots[2]-plan.firstFrom:1,landing=leavesFloor?warp(knots[2]).slope:0;
    // (eased, so that it does not drag forward while the heel is still coming up)
    const placed=leavesFloor?{y:plan.footfalls[2]*Math.pow(Math.min(1,Math.max(0,ground-plan.firstFrom)/way),1.5),slope:lerp(plan.footfalls[2]/way,landing,progress)}:warp(ground);
    const roll=Math.min(1,Math.max(gait.leastRoll,placed.slope));
    feet[foot]={x:lerp(lateral(from),lateral(to),progress)+swingAside,z:placed.y-x,lift,pitch:Math.min(lift,level)*roll*(leavesFloor?1:Math.max(walk,walked,comesDown)),
      turnout:walked,stride:placed.slope,world:placed.y,from,to,rest:0};
  }
  // forward speed without the sway of the hips inside each step (m/s)
  const pace=rate*cycle.C*hips.slope;
  // before the first step the hips move over the standing leg; they come back as the walk takes over
  const aside=plan.fromStanding?(second==='Left'?-1:1)*gait.weightShift*smooth((u-u0)/Math.max(1e-6,uPass-u0))*(1-smooth((u-uPass)/Math.max(1e-6,plan.firstLands-uPass))):0;
  return {u,phase:u-Math.floor(u),x,walk,feet,sample:p,localStride:hips.slope,pace,aside,plain:0,forward:0};
}

// The walk at time t (s) of a plan from standing to standing.
export function miloWalkState(plan,t){
  const {gait}=plan,{u,rate}=planPhase(plan,t),state=stateAt(plan,u,rate);
  // In the still moments at both ends the legs are the standing rig's own, exactly.
  const still=Math.max(1-smooth(Math.max(0,t)/gait.rest),smooth((t-(plan.duration-gait.rest))/gait.rest));
  for(const foot of ['Left','Right'])state.feet[foot].rest=still;
  return {...state,t,done:t>=plan.duration,stride:plan.stride,count:plan.count};
}

// Speed of the root at time t (m/s), including the sway of the hips inside each step.
export function miloWalkSpeed(plan,t,h=1/240){
  const a=Math.max(0,t-h),b=Math.min(plan.duration,t+h);
  return b>a?(miloWalkState(plan,b).x-miloWalkState(plan,a).x)/(b-a):0;
}

// Pose `root` for time t of the plan. The caller first poses the standing figure
// (animateMilo, not moving) and places the root: along the walk it is at state.x. `swing`: let arm swing, trunk turning, hip bob and
// side sway follow the speed (false: as measured at the cycle's own speed).
export function poseMiloWalk(root,plan,t,options){
  const state=miloWalkState(plan,t);
  poseMiloGait(root,state,{...options,data:plan.data,gait:plan.gait});
  return state;
}

// Pose `root` from a walk state (of a plan or of a MiloWalker). `breath`: the standing
// figure's rise and fall (m), kept for as far as it stands.
export function poseMiloGait(root,state,{swing=true,breath=0,data=miloWalkData,gait=MILO_GAIT}={}){
  const cycle=analyse(data),{head,body}=root.userData,idleHead=head.quaternion.clone();
  const pace=Math.min(1.15,Math.max(0,state.pace/gait.naturalSpeed)),short=Math.min(1,Math.max(0,state.stride)),plain=state.plain??0;
  // (where the walk is the plain measured cycle, nothing is scaled)
  const scaled=value=>swing?lerp(value,1,plain):1;
  applyMocapSample(root,data,state.sample,{walk:state.walk,
    sway:scaled(.60+.40*pace),arms:scaled(.45+.55*pace),bob:scaled(.35+.65*pace),sideSway:scaled(Math.min(1.7,1+1.1*(1-pace))),
    lift:gait.shortStepLift*(1-short*short)*state.walk*(1-plain),centre:cycle.centre*(1-plain),aside:state.aside,forward:state.forward??0,
    feet:{Left:state.feet.Left,Right:state.feet.Right}});
  body.position.y+=breath*(1-state.walk);
  // standing, the head keeps whatever the caller's standing pose gave it (it looks about)
  if(state.walk<1)head.quaternion.slerp(idleHead,1-state.walk);
  // The caller's standing pose has already fitted the skin of the trunk and the neck to the
  // standing chest. Fit them again to this pose, or the trunk stays upright under a head
  // that follows the walking chest and the neck comes apart.
  updateMiloSpine(root);updateMiloNeck(root);
  return state;
}

// ---- A walk followed step by step ------------------------------------------
// The cabin does not know a whole walk in advance: Milo is held up by the cat
// or the robot, is sent somewhere else on the way, walks on into a stair trip
// (which is walked in the plain measured cycle) or comes out of one. A
// MiloWalker follows a plan a tick at a time and can be given a new end while
// it is under way: the footfalls already on the floor stay, the ones to come
// are planned anew, and what changes in the pose is taken up over a moment.
export const MILO_WALKER=Object.freeze({
  blend:.25,         // s over which a change of plan is taken up
  weightRate:5,      // the walk weight changes at most this fast (1/s)
  brake:.55,         // the hips come to rest over this share of the way they would have gone on at their speed
  longestStep:.84,   // m (a longer one straightens the leading leg with a snap)
  doubleSupport:.2,  // share of the time between two landings before the foot behind leaves the floor
  closeBefore:.15,   // up to this share of it, the foot behind may simply be set down beside the other one
  shortest:.08,      // m: no real step is shorter
  late:.08,          // cycles before the feet close after which the plan is no longer changed
  plainSteps:2.2,    // steps on both sides of the place where the plain cycle takes over that are the cycle's own
});
const clamp=(x,a,b)=>Math.min(b,Math.max(a,x));
const smoother=x=>{const t=clamp(x,0,1);return t*t*t*(10+t*(-15+6*t));};

function stopShape(n,gait){const shape=new Array(n).fill(1);if(n>=2)shape[n-1]=gait.lastStep;if(n>=3)shape[n-2]=gait.beforeLast;return shape;}
// Steps that bring the walk to rest `gap` metres beyond the planted foot. The step under way
// can only be between lo and hi long. One step may have to go further than asked.
function stopSteps(gap,aim,half,gait,lo,hi){
  let best=null;const consider=option=>{if(!best||option.error<best.error)best=option;};
  for(let n=1;n<=Math.ceil(gap/aim)+3;n++){
    const shape=stopShape(n,gait),sum=shape.reduce((a,b)=>a+b,0),first=clamp(shape[0]*gap/sum,lo,hi);
    if(n===1){
      // (one step cannot go that far, or would be longer than a step should be)
      if(gap>hi+1e-6||(gap>MILO_WALKER.longestStep&&lo<=MILO_WALKER.longestStep))continue;
      const length=Math.max(first,gap);
      // (the body comes to rest over this step: like a planned walk's last one it is best a short
      // one, or the body speeds up before it brakes)
      consider({lengths:[length],scale:aim/half,error:Math.abs(Math.log(Math.max(length,.05)/(gait.lastStep*aim)))});continue;
    }
    const steady=(gap-first)/(sum-shape[0]);if(!(steady>.04))continue;
    const lengths=[first,...shape.slice(1).map(s=>s*steady)];
    if(Math.max(...lengths)>MILO_WALKER.longestStep)continue;
    consider({lengths,scale:(n>=3?steady:aim)/half,error:Math.abs(Math.log(steady/aim))+.5*Math.abs(Math.log(Math.max(first,.05)/(shape[0]*steady)))});
  }
  if(!best){const n=Math.max(2,Math.ceil(gap/MILO_WALKER.longestStep)),first=clamp(gap/n,lo,hi);best={lengths:[first,...new Array(n-1).fill((gap-first)/(n-1))],scale:aim/half};}
  // (a step longer than the usual one is taken at a slower rate: the speed stays the walk's)
  return best.lengths.map(length=>({length,nominal:Math.max(best.scale,length/half),plain:0}));
}
// Steps that walk on past a place `gap` metres beyond the planted foot, where the plain cycle
// (with step scale `scale`) takes over: around it the steps are the cycle's own.
function openSteps(gap,aim,half,scale,lo,hi,prefix=[]){
  const out=[],plainStep=half*scale,zone=MILO_WALKER.plainSteps*plainStep;let position=0;
  while(position<gap+zone){
    const plain=position+plainStep>gap-zone;
    let length=plain?plainStep:aim*(prefix[out.length]??1);
    if(!out.length)length=clamp(length,lo,hi);
    out.push({length,nominal:plain?scale:Math.max(aim,length)/half,plain:plain?1:0});position+=length;
  }
  return out;
}
// The plan `base` up to its knot j, then `steps`, then (toStanding) the feet closing.
function extend(base,j,steps,toStanding,anchor=null){
  const {cycle}=base,keep=array=>array.slice(0,j+1),knots=keep(base.knots),footfalls=keep(base.footfalls),owners=keep(base.owners),nominal=keep(base.nominal),plain=keep(base.plain);
  const add=(length,scale,cycles)=>{
    knots.push(nextLanding(cycle,owners.at(-1),knots.at(-1)));owners.push(other(owners.at(-1)));
    footfalls.push(footfalls.at(-1)+length);nominal.push(scale);plain.push(cycles);
  };
  for(const step of steps)add(step.length,step.nominal,step.plain);
  if(toStanding)add(0,nominal.at(-1),0);
  return finishPlan({data:base.data,gait:base.gait,cycle,pace:base.pace,accelerate:base.accelerate,decelerate:base.decelerate,
    fromStanding:base.fromStanding,toStanding,knots,footfalls,owners,nominal,plain,anchor});
}

export class MiloWalker{
  constructor(plan,{u,clock=0,speed,factor=1,target,open=false,aim}){
    this.plan=plan;this.u=u;this.clock=clock;this.speed=speed;this.factor=factor;this.target=target;this.open=open;this.aim=aim;
    this.rate=0;this.ending=0;this.done=false;this.halting=false;this.offsets=null;this.walk=walkWeight(plan,u);this.pace=plan.pace;
    this.x=-Infinity;this.pose=null;this.refresh(0);
  }
  // From standing with the feet together to `distance` metres ahead. open: do not stop there
  // but walk on, in the plain measured cycle (a stair trip takes over).
  static start(distance,speed,{first='Left',open=false,vary=1,data=miloWalkData,gait=MILO_GAIT}={}){
    if(!open){
      const plan=planMiloWalk(distance,speed,{first,vary,data,gait});
      return new MiloWalker(plan,{u:plan.u0,clock:-gait.rest,speed,factor:gait.startRate,target:distance,aim:plan.steady});
    }
    const cycle=analyse(data),C=cycle.C,second=other(first),k1=cycle.feet[second].landing,aim=naturalStepLength(speed,gait);
    const k0=k1-C+((cycle.feet[first].landing-k1)%C+C)%C,scale=aim/(C/2);
    const stub={data,gait,cycle,pace:speed,accelerate:gait.accelerate,decelerate:gait.decelerate,fromStanding:true,
      knots:[k0,k1],footfalls:[0,0],owners:[first,second],nominal:[scale,scale],plain:[0,0]};
    const plan=extend(stub,1,openSteps(distance,aim,C/2,1,0,Infinity,[gait.firstStep,gait.secondStep]),false);
    return new MiloWalker(plan,{u:plan.u0,clock:-gait.rest,speed,factor:gait.startRate,target:distance,open:true,aim});
  }
  // Out of the plain measured cycle at phase u (cycles; its step scale `stride`), to
  // `distance` metres ahead.
  static resume(u,distance,speed,{stride=1,open=false,data=miloWalkData,gait=MILO_GAIT}={}){
    const cycle=analyse(data),C=cycle.C;
    // the cycle's last landings up to u: the planted foot's, the other foot's before it, and one more
    const at=foot=>{const turns=Math.floor(u-cycle.feet[foot].landed+1e-9);return {foot,u:cycle.feet[foot].landed+turns,g:cycle.feet[foot].landing+turns*C};};
    const [older,planted]=[at('Left'),at('Right')].sort((a,b)=>a.u-b.u);
    // (and the landing the foot under way is going to)
    const knots=[planted.g-C,older.g,planted.g,older.g+C];
    const plan=finishPlan({data,gait,cycle,pace:speed,accelerate:gait.accelerate,decelerate:gait.decelerate,fromStanding:false,toStanding:false,
      knots,footfalls:knots.map(g=>stride*(g-C*u)),owners:[planted.foot,older.foot,planted.foot,older.foot],nominal:knots.map(()=>stride),plain:knots.map(()=>1)});
    const walker=new MiloWalker(plan,{u,speed,target:Infinity,open:true,aim:naturalStepLength(speed,gait)});
    walker.retarget(distance,{open,force:true});
    return walker;
  }
  get remaining(){return this.target-this.x;}
  // distance counter of the plain cycle at this phase (m)
  get phaseDistance(){return this.u*this.plan.cycle.C;}
  // the last knot landed on
  knot(){const {lands,fromStanding}=this.plan;let j=fromStanding?1:0;while(j+2<lands.length&&lands[j+1]<=this.u+1e-9)j++;return j;}
  at(array){
    const {lands}=this.plan,j=this.knot();
    return lerp(array[j],array[j+1],smooth((this.u-lands[j])/(lands[j+1]-lands[j])));
  }
  cruiseRate(){return this.pace/(this.plan.cycle.C*this.at(this.plan.nominal));}
  // the step rate dies away over the last of the phase left (as a share of the cruising rate)
  fall(){
    const P=this.plan;if(!P.toStanding)return 1;
    const left=P.u1-this.u,rate=this.cruiseRate(),d=P.decelerate,r1=P.gait.endRate;
    if(left>=rate*d*(r1+(1-r1)/2))return 1;
    let a=0,b=d;
    for(let i=0;i<30;i++){const mid=(a+b)/2;if(rate*(r1*mid+(1-r1)*d*smoothArea(mid/d))<left)a=mid;else b=mid;}
    return r1+(1-r1)*smooth((a+b)/2/d);
  }
  // Where the walk can come to rest soonest: the planted foot's knot, how far beyond that foot
  // the root must still go, and the window for the length of the step under way.
  soonest(){
    const P=this.plan,W=MILO_WALKER,j=this.knot(),F=P.footfalls[j];
    const progress=clamp((this.u-P.lands[j])/(P.lands[j+1]-P.lands[j]),0,1),swing=clamp((progress-W.doubleSupport)/(1-W.doubleSupport),0,1);
    const old=P.footfalls[j+1]-F,room=this.aim*(1-swing),lo=Math.max(0,old-room);
    // (a step under way is made shorter freely, but hardly longer: reaching further in mid-step
    // pulls the hips forward with a surge. A foot that was only closing may still step out.)
    const hi=old+(old>.05?Math.min(room,.12):room);
    // The walk can stop where the foot under way lands, not before: until then the hips lose their
    // speed evenly if they go about half as far as they would have at that speed.
    const hips=this.anchor(),brake=W.brake*hips.slope*(P.knots[j+1]-hips.g);
    return {j,F,progress,lo,hi,gap:Math.max(lo,hips.y+brake-F)};
  }
  // metres the root still travels if the walk is stopped now
  get stopDistance(){
    const P=this.plan;if(this.done)return 0;
    if(P.fromStanding&&this.u-P.u0<.02)return 0;
    if(P.toStanding&&this.u>P.uClose-MILO_WALKER.late)return Math.max(0,this.remaining);
    const {F,gap,progress}=this.soonest(),least=gap<=.03&&progress<MILO_WALKER.closeBefore?0:Math.max(gap,MILO_WALKER.shortest);
    return Math.min(P.toStanding?Math.max(0,this.remaining):Infinity,Math.max(0,F+least-this.x));
  }
  // How far ahead those who keep out of the walk's way have to look (m): at least as far as it
  // would go if stopped now, and as far as a walk in full stride ever needs (the stopping
  // distance itself grows by a third of a metre at each footfall).
  get stopReach(){
    const P=this.plan,stop=this.stopDistance;
    if(this.done||(P.fromStanding&&this.u-P.u0<.02)||(P.toStanding&&this.u>P.uClose-MILO_WALKER.late))return stop;
    const most=MILO_WALKER.brake*this.anchor().slope*.75*P.cycle.C;
    return Math.max(stop,Math.min(most,P.toStanding?Math.max(0,this.remaining):Infinity));
  }
  // Stop as soon as it can be done in step.
  halt(){
    if(this.done||this.halting)return;
    this.retarget(0);this.halting=true;
  }
  // Give the walk a new end: `remaining` metres ahead of where the root is now (it comes to rest
  // there, or, open, walks on past it). The end may come out further away when the walk cannot
  // stop that soon (see `remaining` afterwards). False: too late, the feet are closing.
  retarget(remaining,{open=false,force=false}={}){
    if(this.done)return false;
    const P=this.plan,g=P.gait,W=MILO_WALKER,half=P.cycle.C/2;remaining=Math.max(0,remaining);
    this.halting=false;
    if(P.fromStanding&&this.u-P.u0<.02){
      // not off the floor yet: plan the walk anew, or do not walk at all
      if(!force&&open===this.open&&Math.abs(remaining-this.target)<.02)return true;
      if(remaining<.04){this.done=true;return true;}
      const fresh=MiloWalker.start(remaining,this.speed,{first:P.first,open,data:P.data,gait:g});
      this.adopt(fresh.plan);this.target=remaining;this.open=open;this.aim=fresh.aim;this.pace=fresh.plan.pace;return true;
    }
    if(P.toStanding&&this.u>P.uClose-W.late)return false;
    if(!force&&open===this.open&&Math.abs(this.x+remaining-this.target)<.02)return true;
    // (where the walk is going to stop anyway, it can stop: only a nearer end has to be far enough)
    const soonest=this.soonest(),{j,F,progress,lo,hi}=soonest,least=P.toStanding?Math.min(soonest.gap,Math.max(lo,this.target-F)):soonest.gap;
    // A walk that set out for a place close by and is sent far takes the far walk's steps and
    // speed from here on (never shorter or slower ones: a nearer end is reached by fewer steps).
    const cruise=open?this.speed:boutSpeed(Math.max(0,this.x+remaining),this.speed,g),stride=naturalStepLength(cruise,g);
    if(stride>this.aim)this.aim=stride;
    const pace=Math.max(P.pace,open?this.speed:Math.max(Math.min(g.leastRate*2*stride,this.speed),cruise));
    // (an end the walk goes on past needs no room to stop in, and is where it was asked for,
    // wherever the feet are)
    const gap=open?this.x+remaining-F:Math.max(this.x+remaining-F,least);
    let steps,target;
    if(open){steps=openSteps(gap,this.aim,half,1,lo,hi);target=this.x+remaining;}
    else{
      // (the foot behind, still on the floor, is simply set down beside the planted one)
      steps=gap<=.03&&progress<W.closeBefore?[]:stopSteps(Math.max(gap,W.shortest),this.aim,half,g,lo,hi);
      target=F+steps.reduce((sum,step)=>sum+step.length,0);
    }
    if(!force&&open===this.open&&Math.abs(target-this.target)<.02)return true;
    this.adopt(extend({...P,pace},j,steps,!open,this.anchor()));this.target=target;this.open=open;
    return true;
  }
  // Where the hips are in the plan now: the next plan's warp goes through this point.
  anchor(){
    const P=this.plan,p=P.cycle.sample(this.u),setOff=P.fromStanding?smooth((this.u-P.u0)/(P.firstLands-P.u0)):1;
    const g=P.cycle.ground(p,'Hips',this.u)+P.behind*(1-setOff),at=P.warp(g);
    return {g,y:at.y,slope:at.slope};
  }
  // Go on in another plan. The hips go on from where they are (the plan's anchor); what the
  // plan changes for the feet at this moment, and in their speed, is taken up gradually.
  adopt(plan){
    const shown=this.pose,before=this.velocity;this.plan=plan;this.ending=0;this.offsets=null;
    const now=this.compose(),h=1/240,u=this.u;
    this.u=Math.min(plan.u1,u+this.rate*h);const next=this.compose();this.u=u;
    const offsets={age:0,aside:shown.aside-now.aside,plain:shown.plain-now.plain};
    for(const foot of ['Left','Right']){
      const a=shown.feet[foot],b=now.feet[foot],speed=before?clamp(before[foot]-(next.feet[foot].world-b.world)/h,-3,3):0;
      offsets[foot]={world:a.world-b.world,worldSpeed:speed,x:a.x-b.x,lift:a.lift-b.lift,pitch:a.pitch-b.pitch,turnout:a.turnout-b.turnout,stride:a.stride-b.stride};
    }
    this.offsets=offsets;this.pose=this.compose();
  }
  // The pose state of this moment (the plan's, and what is left of an earlier plan's).
  compose(){
    const P=this.plan,g=P.gait,o=this.offsets,w=o?1-smoother(o.age/MILO_WALKER.blend):0;
    const raw=stateAt(P,this.u,this.rate,this.walk),plain=clamp(this.at(P.plain)+(o?o.plain*w:0),0,1);
    // (in the plain cycle the root is not at the hips: they go a little ahead of it and behind it in each step)
    const forward=plain*raw.sample.Hips.z,x=raw.x-forward;
    const still=Math.max(P.fromStanding?1-smooth((this.clock+g.rest)/g.rest):0,P.toStanding?smooth(this.ending/g.rest):0);
    const feet={};
    for(const foot of ['Left','Right']){
      const f=raw.feet[foot],d=o?.[foot],add=key=>f[key]+(d?d[key]*w:0),world=add('world')+(d?d.worldSpeed*o.age*w:0);
      feet[foot]={x:add('x')+plain*P.cycle.centre,world,z:world-x,lift:clamp(add('lift'),0,1),pitch:clamp(add('pitch'),0,1),
        turnout:clamp(add('turnout'),0,1),stride:add('stride'),rest:still,ahead:.30*(1-plain)};
    }
    return {x,u:this.u,walk:this.walk,feet,sample:raw.sample,pace:raw.pace,aside:raw.aside+(o?o.aside*w:0),plain,forward,stride:this.at(P.nominal)};
  }
  refresh(dt){
    const natural=walkWeight(this.plan,this.u),limit=dt>0?MILO_WALKER.weightRate*dt:Infinity,last=this.pose;
    this.walk+=clamp(natural-this.walk,-limit,limit);
    if(this.offsets){this.offsets.age+=dt;if(this.offsets.age>=MILO_WALKER.blend)this.offsets=null;}
    const pose=this.compose();
    // (the root never goes back; the pose keeps the hips where they are)
    this.x=Math.max(this.x,pose.x);
    if(pose.x!==this.x){for(const foot of ['Left','Right'])pose.feet[foot].z=pose.feet[foot].world-this.x;pose.forward+=pose.x-this.x;pose.x=this.x;}
    if(last&&dt>0)this.velocity={Left:(pose.feet.Left.world-last.feet.Left.world)/dt,Right:(pose.feet.Right.world-last.feet.Right.world)/dt};
    this.pose=pose;
  }
  // One tick: returns the metres the root moves.
  step(dt){
    if(this.done||!(dt>0))return 0;
    const g=this.plan.gait,before=this.x;
    if(this.clock<0)this.clock=Math.min(0,this.clock+dt);
    else if(this.u>=this.plan.u1)this.ending+=dt;
    else{
      // an open walk never runs out of footfalls
      if(!this.plan.toStanding&&this.u>this.plan.lands.at(-3))this.retarget(Math.max(0,this.remaining),{open:true,force:true});
      const P=this.plan,rise=P.fromStanding?g.startRate+(1-g.startRate)*smooth(this.clock/P.accelerate):1,want=Math.min(rise,this.fall());
      const up=1.6*(1-g.startRate)/P.accelerate*dt,down=1.6*(1-g.endRate)/P.decelerate*dt;
      this.factor=Math.min(this.factor+up,Math.max(this.factor-down,want));
      // (the walk's speed follows its plan's at 1.5 m/s per second)
      this.pace+=clamp(P.pace-this.pace,-1.5*dt,1.5*dt);
      this.rate=this.cruiseRate()*this.factor;
      this.u=Math.min(P.u1,this.u+this.rate*dt);this.clock+=dt;
    }
    this.refresh(dt);
    if(this.plan.toStanding&&this.u>=this.plan.u1&&this.ending>=g.rest&&this.walk<1e-3)this.done=true;
    return this.x-before;
  }
}
