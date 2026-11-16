import {worldActor,worldCat,close,approaches,nextActor,nextDroid,CREW_CLEARANCE,CAT_CLEARANCE} from './curtis-traffic.js';
import {humanTripDistance,humanTripStride} from './human-stair-gait.js';
import {MiloWalker} from './milo-gait.js';
import {miloWalkData} from './mocap-walk.js';
import {angleDelta,turnSeconds} from './heading.js';
import {CABIN_FLOOR_Y as FLOORS,CABIN_AISLE,LOUNGE_TABLE,LOUNGE_ACCESS,getStation,ladderApproachDepth} from './layout.js';
import {crewWalkway} from './cabin-walkway.js';
import {crewLadderPath,ladderPathsConflict} from './ladder-traffic.js';
import {CREW_WALK_SPEED} from './pace.js';
import {CURTIS_COFFEE} from './curtis-coffee.js';
import {loungeWorldPose} from './lounge-conversation.js';

export const CURTIS_TIMING={first:[90,150],between:[180,360],prepareAhead:35};
export const CURTIS_WALK_SPEED=CREW_WALK_SPEED*.022;
export const CURTIS={top:13.4,seatX:6.05,coffeeX:10.085,roomX:-1.88,roomZ:-4.37};
export const CURTIS_LOUNGE_PASSAGE=Object.freeze({floor:1,x:CURTIS.seatX,
  halfWidth:(getStation('lounge').x-700)*.022+LOUNGE_ACCESS.sideX-CURTIS.seatX,depth:1.35});
export const CURTIS_LADDER_TRAFFIC=Object.freeze({waitX:2.2,crewWaitX:2.85,clearX:2.1,mergeX:1.75,bridgeX:.85,passZ:2.18});
// The planned walk (milo-gait.js; as Milo's, CREW_GAIT in state.js): the visitor walks from
// standing to standing, stops in step when held up and turns on the spot before he sets off.
export const CURTIS_GAIT=Object.freeze({
  bend:1.3,       // rad: a corner sharper than this ends a walk (he stops there and turns on the spot).
                  // The aisle's curves round the lounge table, sampled every 25 cm, bend up to about 1 rad.
  short:.1,       // m: a step this short (a small correction of depth) takes no part in the corners
  arrive:.04,     // m: this close to where a walk was to end, he has arrived
  startRoom:.6,   // m a walk needs to stop again after its first step: standing, he does not set off into less room
  look:.35,       // m ahead along the way he faces while walking (round the curves, not at their corners)
  turnFrom:.12,   // rad: facing this far off the way to go, he turns on the spot first
  turnSettle:.05, // s after that turn before the first step
  stairRun:.3,    // m of a stair trip's own first stretch a walk may still use to get into stride
  release:.35,    // s a walk held up goes on stopping after it is let go (no stop-and-go while the way clears)
});
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);
const smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};

// Keep the body and swinging arms in front of the table, with turns outside
// its inflated footprint. The same route works in both directions.
export function curtisWalkway(x,floor){
  const base=crewWalkway(x,floor).z;
  if(floor!==1)return base;
  const half=LOUNGE_TABLE.width/2+.45+.20;
  const blend=1-smooth((Math.abs(x-LOUNGE_TABLE.x)-half)/.65);
  return base+(LOUNGE_TABLE.z+LOUNGE_TABLE.depth/2+.45-base)*blend;
}

// Only this small schedule is part of startup. Appearance and its texture are
// imported later, and a failed load never interrupts the cabin simulation.
export class CurtisRoutine {
  // planned: walk in planned bouts (as the cabin's Milo) instead of sliding along at a constant speed
  constructor({random=Math.random,prepare=async()=>{},firstDelay,planned=false}={}){
    this.random=random;this.prepare=prepare;this.time=0;this.due=firstDelay??this.range(CURTIS_TIMING.first);
    this.ready=false;this.loading=false;this.disposed=false;this.active=false;this.visits=0;
    this.steps=[];this.age=0;this.walkDistance=0;this.position={x:0,y:CURTIS.top,z:ladderApproachDepth(0)};
    this.yaw=Math.PI;this.waiting=false;this.ladderClaim=false;this.error=null;
    this.planned=planned;this.gait=null;this.turn=null;this.viewYaw=null;this.bouts=0;this.stairPast=0;this.sideStep=false;
  }
  range([a,b]){return a+(b-a)*this.random();}
  get step(){return this.steps[0]??null;}
  get ladderPath(){return this.ladderClaim?{from:this.position.y,to:this.claimEnd}:null;}
  onStairTrip(){return this.active&&this.step?.kind==='stairs';}
  get approachingLadderPath(){
    let crosses=false;
    for(const step of this.steps){
      if(step.kind==='climb')return{from:step.from.y,to:step.to.y};
      if(step.kind!=='walk')break;
      crosses||=Math.min(Math.abs(step.from.x),Math.abs(step.to.x))<CURTIS_LADDER_TRAFFIC.bridgeX||step.from.x*step.to.x<0;
    }
    return crosses?{from:this.position.y,to:this.position.y}:null;
  }
  get floor(){return FLOORS.reduce((best,y,i)=>Math.abs(y-this.position.y)<Math.abs(FLOORS[best]-this.position.y)?i:best,0);}
  load(){
    if(this.loading||this.ready||this.disposed)return;
    this.loading=true;
    Promise.resolve().then(()=>this.prepare()).then(()=>{if(!this.disposed){this.ready=true;this.error=null;}},error=>{
      this.error=error;this.due=this.time+60;
      console.warn('Curtis will retry on a later visit.',error);
    }).finally(()=>{this.loading=false;});
  }
  add(kind,to,seconds,extra={}){
    const from={...(this.steps.at(-1)?.to??this.position)};
    if(kind==='walk'&&distance(from,to)<1e-7)return;
    this.steps.push({kind,from,to:{...(to??from)},duration:seconds??distance(from,to)/CURTIS_WALK_SPEED,...extra});
  }
  walk(x,y,z,extra={}){this.add('walk',{x,y,z},null,extra);}
  hold(kind,seconds,extra={}){this.add(kind,null,seconds,extra);}
  aisleTo(x,floor){
    const y=FLOORS[floor],last=this.steps.at(-1)?.to??this.position;
    // Follow the same solid bridge as Milo at the open ladder well.
    this.walk(last.x,y,curtisWalkway(last.x,floor));
    const direction=Math.sign(x-last.x)||1;
    for(let p=last.x+direction*.25;direction*(x-p)>0;p+=direction*.25)this.walk(p,y,curtisWalkway(p,floor));
    this.walk(x,y,curtisWalkway(x,floor));
  }
  climbTo(floor,{enter=false,leave=false}={}){
    const from=this.steps.at(-1)?.to??this.position,y=leave?CURTIS.top:FLOORS[floor];
    this.add('climb',{x:0,y,z:leave?ladderApproachDepth(0):ladderApproachDepth(floor)},Math.abs(y-from.y)/.46+2.4,{enter,leave,floor});
  }
  // Inside the cabin the visitor changes decks by the stair tower when it is
  // usable when he gets there; otherwise (or without stairs) by the ladder.
  changeDeck(from,to,toX=null){
    const at=this.steps.at(-1)?.to??this.position,trip=this.stairs?.trip(from,to,at.x,toX??at.x);
    // (when the ladder is the quicker way, the ladder: the towers stand at the ends of the cabin)
    if(!trip||this.stairs.ladderQuicker(trip,at.x,toX??at.x,{speed:CURTIS_WALK_SPEED,climb:.46,transfer:2.4})){this.aisleTo(0,from);this.climbTo(to);return;}
    this.aisleTo(trip.from.x,from);
    const last=this.steps.at(-1)?.to??this.position;
    this.steps.push({kind:'stairs',from:{...last},to:{x:trip.to.x,y:FLOORS[to],z:trip.to.z},duration:Infinity,trip,t:0,decided:false,fromFloor:from,floor:to});
  }
  // Replace the stairs step with the ladder, folding in the aisle walk that
  // followed the trip on the arrival deck (no detour back to the tower).
  stairsToLadder(s){
    const k=Math.max(0,this.steps.indexOf(s));
    let n=k+1,end=s.to;
    for(;n<this.steps.length;n++){
      const next=this.steps[n];
      if(next.kind!=='walk'||Math.abs(next.to.y-FLOORS[s.floor])>1e-6||Math.abs(next.to.z-curtisWalkway(next.to.x,s.floor))>1e-6)break;
      end=next.to;
    }
    const saved=this.steps;this.steps=[];
    this.aisleTo(0,s.fromFloor);this.climbTo(s.floor);this.aisleTo(end.x,s.floor);
    const ladder=this.steps;this.steps=saved;this.steps.splice(0,n,...ladder);this.age=0;
  }
  stairsStep(s,dt){
    // Back from the passing side-step onto the aisle before the trip starts.
    const offset=this.passOffset??0;
    if(!s.decided&&Math.abs(offset)>.005){
      const k=Math.min(Math.abs(offset),dt*.85);
      // (planned: not into someone at the entrance, also one who has just set off on the stairs)
      if(this.planned){
        const p=this.trafficPosition,to={...p,z:p.z-Math.sign(offset)*k};
        const blocked=q=>(this.stairs.bodies?.()??[]).some(b=>b.agent!==this&&approaches(p,q,b,b.small?CAT_CLEARANCE:CREW_CLEARANCE));
        if(blocked(to)){
          // (someone is coming to stand there: further aside, out of their way, while there is room)
          const out={...p,z:p.z+Math.sign(offset)*k};
          if(Math.abs(offset)+k<=Math.abs(CURTIS_LADDER_TRAFFIC.passZ-this.position.z)&&!blocked(out)){this.passOffset=offset+Math.sign(offset)*k;this.walkDistance+=k;this.yaw=offset>0?0:Math.PI;this.sideStep=true;}
          else this.waiting=true;
          return;
        }
      }
      this.passOffset=offset-Math.sign(offset)*k;
      this.walkDistance+=k;this.yaw=offset>0?Math.PI:0;this.sideStep=true;return;
    }
    if(!s.decided){
      s.decided=true;
      if(!this.stairs.available(this,s.trip)){this.stairsToLadder(s);return;}
    }
    // (planned: standing at the entrance, he sets off along the trip's first stretch, and the
    // trip takes over once the walk is in stride)
    if(this.planned&&!s.entered){this.steps.unshift({kind:'walk',from:{...this.position},to:{...this.position},duration:0});return;}
    if(!s.entered){s.entered=true;this.stairs.enter(this,'crew',s.trip,0);s.arrival={speed:CURTIS_WALK_SPEED,entry:this.walkDistance};}
    const want=CURTIS_WALK_SPEED*s.trip.pace(s.t,CURTIS_WALK_SPEED)*dt,{waiting,stuck}=this.stairs.advance(this,want,dt);
    if(stuck){this.stairs.giveUp(this);this.stairsToLadder(s);return;}
    this.waiting=waiting;s.t=this.stairs.walker(this).t;this.walkDistance=humanTripDistance(s.trip,s.t,s.arrival);
    const f=s.trip.frame(Math.min(s.t,s.trip.length));
    this.position={x:f.x,y:f.y,z:f.z};this.yaw=f.yaw;this.passOffset=0;
    if(s.t>=s.trip.length){this.stairs.leave(this);this.position={...s.to};this.steps.shift();this.age=0;if(this.planned)this.leaveStairs(s);}
  }
  // ---- The planned walk
  // The walk steps at the head of the schedule that join without a sharp corner (n of them,
  // `length` metres from here), the way they set off (yaw) and end (end), and what follows.
  // into: the walk goes on into the stair trip that follows, without stopping.
  bout(){
    // (a walk under way goes on from the way it has been going: steps too short to tell are no
    // corner, and the corner after them is)
    const G=CURTIS_GAIT;let n=0,length=0,yaw=null,end=this.gait?this.walkHeading??null:null,at=this.position;
    for(const s of this.steps){
      if(s.kind!=='walk')break;
      // (the way of the whole step, also when little of it is left: a corner just ahead is still one)
      const flat=Math.hypot(s.to.x-s.from.x,s.to.z-s.from.z);
      if(flat>G.short){
        const heading=Math.atan2(s.to.x-s.from.x,s.to.z-s.from.z);
        if(end!==null&&Math.abs(angleDelta(end,heading))>G.bend)break;
        yaw??=heading;end=heading;
      }
      length+=distance(at,s.to);at=s.to;n++;
      if(s.stopping)break;
    }
    const next=this.steps[n]??null,trip=next?.kind==='stairs'&&!next.entered?next.trip:null;
    const tripYaw=trip?Math.atan2(trip.frame(.2).x-trip.from.x,trip.frame(.2).z-trip.from.z):null;
    // (a trip that sets off the other way is entered from standing: stop at its start and turn)
    const into=Boolean(trip)&&!this.steps[n-1]?.stopping&&Math.abs(this.passOffset??0)<.005&&(end===null||Math.abs(angleDelta(end,tripYaw))<=G.bend);
    return {n,length,yaw:yaw??(into?tripYaw:null),end,next,into};
  }
  // How far ahead he still goes at least: as far as a walk under way needs to stop, or the room
  // a first step takes (m). He looks this far ahead for others; they look as far for him.
  get reach(){
    if(!this.planned||!this.active)return 0;
    if(this.gait)return this.gait.stopReach;
    return this.step?.kind==='walk'?Math.min(CURTIS_GAIT.startRoom,this.bout().length):0;
  }
  // The point `metres` ahead along the walk, up to where it ends (with the passing side-step).
  ahead(metres){
    let p={...this.position},left=metres;
    for(const s of this.steps.slice(0,this.bout().n)){
      if(left<=0)break;
      const d=distance(p,s.to);
      if(d>=left){const k=left/d;p={x:p.x+(s.to.x-p.x)*k,y:p.y+(s.to.y-p.y)*k,z:p.z+(s.to.z-p.z)*k};left=0;break;}
      p={...s.to};left-=d;
      if(s.stopping)break;
    }
    return {...p,z:p.z+(this.passOffset??0)};
  }
  // Where he would be at the end of this tick: legacy, one tick along the step; planned, as far
  // as the walk still goes, and never less than the room a walk needs to set off and stop again
  // (or a walk that is stopping, its reach shrinking, would be let go and stopped again: a creep).
  nextPoint(s,dt){
    if(this.planned)return this.ahead(Math.max(this.reach,CURTIS_GAIT.startRoom,CURTIS_WALK_SPEED*dt));
    const u=Math.min(1,(this.age+dt)/s.duration);
    return {x:s.from.x+(s.to.x-s.from.x)*u,y:s.from.y+(s.to.y-s.from.y)*u,z:s.from.z+(s.to.z-s.from.z)*u+(this.passOffset??0)};
  }
  // The schedule no longer goes on the way the walk under way goes (a route given up, a rest
  // skipped): the walk stops in step, straight on, before the new way is taken.
  // room: at most this far (the rest of the stop is taken up in the step's pose).
  stopAhead(room=Infinity){
    const walker=this.gait;if(!walker)return;
    walker.halt();
    const left=Math.min(room,Math.max(0,walker.remaining)),p=this.position;
    if(left<1e-3){this.gait=null;return;}
    const to={x:p.x+Math.sin(this.yaw)*left,y:p.y,z:p.z+Math.cos(this.yaw)*left};
    this.steps.unshift({kind:'walk',from:{...p},to,duration:left/CURTIS_WALK_SPEED,stopping:true});
  }
  keepWay(){
    if(!this.gait)return;
    const b=this.bout(),s=this.step,p=this.position;
    // (steps too short to tell a corner still tell a way back)
    const yaw=b.yaw??(s?.kind==='walk'&&Math.hypot(s.to.x-p.x,s.to.z-p.z)>.005?Math.atan2(s.to.x-p.x,s.to.z-p.z):null);
    if(b.n===0||(yaw!==null&&Math.abs(angleDelta(this.yaw,yaw))>CURTIS_GAIT.bend))this.stopAhead();
  }
  // At the end of a walk: the steps it covered are done.
  arrive(n){
    if(n>0){this.position={...this.steps[n-1].to};this.steps.splice(0,n);}
    this.age=0;this.finished();
  }
  finished(){if(!this.steps.length){this.active=false;this.ladderClaim=false;this.due=this.time+this.range(CURTIS_TIMING.between);}}
  // Move `metres` along the walk's steps (onto the stair trip's first stretch when it walks on into it).
  moveAlong(metres,b){
    let left=metres,count=b.n;
    while(left>1e-9){
      const s=this.step;if(s?.kind!=='walk')return;
      const d=distance(this.position,s.to);
      if(Math.hypot(s.to.x-s.from.x,s.to.z-s.from.z)>CURTIS_GAIT.short)this.walkHeading=Math.atan2(s.to.x-s.from.x,s.to.z-s.from.z);
      if(left<d){const k=left/d,p=this.position;this.position={x:p.x+(s.to.x-p.x)*k,y:p.y+(s.to.y-p.y)*k,z:p.z+(s.to.z-p.z)*k};break;}
      left-=d;this.position={...s.to};
      if(count>1){this.steps.shift();this.age=0;count--;continue;}
      if(b.into){this.steps.shift();this.age=0;this.stairPast=left;const f=b.next.trip.frame(left);this.position={x:f.x,y:f.y,z:f.z};}
      break;
    }
    // (he faces along the way a little ahead: round the curves rather than at their corners)
    const look=this.ahead(CURTIS_GAIT.look),p=this.trafficPosition;
    if(this.step?.kind==='walk'&&Math.hypot(look.x-p.x,look.z-p.z)>.05)this.yaw=Math.atan2(look.x-p.x,look.z-p.z);
  }
  // Held up while walking (or before setting off): the walk comes to a stop in step.
  holdWalk(dt){this.waiting=true;if(this.planned&&(this.gait||this.step?.kind==='walk'))this.walkPlanned(dt,true);}
  // A depth step out onto the aisle (from the rear room, the coffee machine or the sofa).
  outToAisle(s){
    // (for the step he is on, from where he is: its start may have been moved up to him)
    const fromZ=s===this.step?Math.min(s.from.z,this.position.z):s.from.z;
    return s?.kind==='walk'&&Math.abs(s.to.x-s.from.x)<1e-8&&Math.abs(this.position.x-s.to.x)<1e-6+(s===this.step?0:Infinity)&&s.to.z>fromZ+.1&&Math.abs(s.to.z-curtisWalkway(s.to.x,this.floor))<.06;
  }
  // The step out onto the aisle that the walk under way comes up to (after the one it is on),
  // and how far ahead it starts.
  aisleAhead(){
    if(!this.gait)return null;
    const b=this.bout();let at=this.position,run=0;
    for(const [i,s] of this.steps.slice(0,b.n).entries()){
      if(i>0&&this.outToAisle(s))return {step:s,distance:run};
      run+=distance(at,s.to);at=s.to;
    }
    return null;
  }
  // One tick of the walk at the head of the schedule.
  walkPlanned(dt,hold){
    const G=CURTIS_GAIT;
    this.heldFor=hold?G.release:Math.max(0,(this.heldFor??0)-dt);
    hold||=Boolean(this.gait?.halting&&this.heldFor>0);
    if(hold)this.waiting=true;
    if(this.gait)this.keepWay();
    let b=this.bout();
    if(!this.gait){
      if(b.length<=G.arrive&&!b.into){this.arrive(b.n);return;}
      // Turn to face the way first (the figure's own turn on the spot, milo-turn.js; the view
      // reports where it faces).
      const yaw=b.yaw??Math.atan2(this.step.to.x-this.position.x,this.step.to.z-this.position.z);
      if(this.turn&&Math.abs(angleDelta(yaw,this.turn.yaw))>.05)this.turn=null;
      if(!this.turn&&Number.isFinite(this.viewYaw)){
        const delta=angleDelta(this.viewYaw,yaw);
        if(Math.abs(delta)>G.turnFrom)this.turn={yaw,left:turnSeconds(delta)+G.turnSettle};
      }
      this.yaw=yaw;
      if(this.turn){this.turn.left-=dt;if(this.turn.left>0)return;this.turn=null;this.viewYaw=yaw;}
      if(hold)return;
      this.gait=MiloWalker.start(b.length,CURTIS_WALK_SPEED,{open:b.into,vary:++this.bouts});this.stairPast=0;this.walkHeading=b.yaw;
    }
    const walker=this.gait;walker.speed=CURTIS_WALK_SPEED;
    if(hold)walker.halt();
    else{
      // Someone may have come to stand at the stair entrance: decide for the ladder while the
      // walk can still stop short of it.
      if(b.into&&!b.next.decided&&walker.remaining<=walker.stopDistance+.15){
        b.next.decided=true;
        if(!this.stairs.available(this,b.next.trip)){this.stairsToLadder(b.next);this.keepWay();b=this.bout();}
      }
      if(b.length>G.arrive||!b.into)walker.retarget(b.length,{open:b.into});
    }
    this.moveAlong(walker.step(dt),b);
    this.walkDistance=walker.phaseDistance;
    if(walker.done){
      this.gait=null;
      const rest=this.bout();
      if(rest.length<=G.arrive&&!rest.into)this.arrive(rest.n);
      return;
    }
    if(b.into&&walker.open&&walker.remaining<=0)this.intoStairs(b.next);
  }
  // On the trip's first stretch, not yet handed over to it.
  runUp(s,dt){
    const walker=this.gait;walker.speed=CURTIS_WALK_SPEED;
    this.stairPast+=walker.step(dt);this.walkDistance=walker.phaseDistance;
    const f=s.trip.frame(this.stairPast);this.position={x:f.x,y:f.y,z:f.z};this.yaw=f.yaw;
    this.intoStairs(s);
  }
  // The walk goes on into the stair trip (which goes on in the plain cycle at this phase). A walk
  // that set off close to the entrance takes its next steps on the trip's own first stretch.
  intoStairs(s){
    const walker=this.gait,ready=walker.pose.plain>.99&&walker.pose.walk>.99;
    if(!ready&&this.stairPast<CURTIS_GAIT.stairRun)return;
    // (still exactly at the entrance: the walk step that led there is done)
    if(this.step!==s&&this.step?.kind==='walk'&&this.steps[1]===s)this.steps.shift();
    // (someone may have come to the entrance since he decided, or onto the stairs' end there)
    if(!this.stairs.available(this,s.trip)){
      // (stop short of them, not into them)
      const p=this.position,room=Math.min(Infinity,...(this.stairs.bodies?.()??[]).filter(b=>b.agent!==this).filter(b=>Math.abs(b.y-p.y)<1.2).map(b=>{
        const along=(b.x-p.x)*Math.sin(this.yaw)+(b.z-p.z)*Math.cos(this.yaw);
        return along>0?Math.max(0,Math.hypot(b.x-p.x,b.z-p.z)-CREW_CLEARANCE):Infinity;}));
      this.stairsToLadder(s);this.stopAhead(room);return;
    }
    s.decided=true;s.entered=true;s.t=this.stairPast;
    this.stairs.enter(this,'crew',s.trip,s.t);s.arrival={speed:CURTIS_WALK_SPEED,entry:this.walkDistance-s.t};
    // (the view takes up what little the two walks differ by at this moment)
    this.gait=null;this.poseSeam=true;this.stairPast=0;this.age=0;
  }
  // Out of a stair trip (walked in the plain cycle) into a planned walk that comes to rest.
  leaveStairs(s){
    const u=this.walkDistance/miloWalkData.cycleDistance,stride=humanTripStride(s.trip,s.trip.length,s.arrival);
    this.yaw=s.trip.frame(s.trip.length).yaw;
    const b=this.bout(),on=b.n>0&&b.length>CURTIS_GAIT.arrive&&(b.yaw===null||Math.abs(angleDelta(this.yaw,b.yaw))<=CURTIS_GAIT.bend);
    this.gait=MiloWalker.resume(u,on?b.length:0,CURTIS_WALK_SPEED,{stride});this.walkHeading=this.yaw;
    if(!on)this.stopAhead();
  }
  lounge(){
    this.aisleTo(CURTIS.seatX,1);
    this.walk(CURTIS.seatX,FLOORS[1],.43);
    this.add('sit',{x:CURTIS.seatX,y:FLOORS[1],z:.06},2.8);
    this.hold('relax',this.range([25,45]));
    this.add('stand',{x:CURTIS.seatX,y:FLOORS[1],z:.43},2.2);
    this.walk(CURTIS.seatX,FLOORS[1],CABIN_AISLE.crewZ);
  }
  coffee(){
    this.aisleTo(CURTIS.coffeeX,1);
    this.walk(CURTIS.coffeeX,FLOORS[1],-.38);
    this.hold('coffee',CURTIS_COFFEE.duration,{yaw:Math.PI});
    this.walk(CURTIS.coffeeX,FLOORS[1],CABIN_AISLE.crewZ);
  }
  beginVisit(){
    this.active=true;this.visits++;this.age=0;this.passOffset=0;this.position={x:0,y:CURTIS.top,z:ladderApproachDepth(0)};
    this.climbTo(1,{enter:true});
    if(this.random()<.5){this.lounge();this.coffee();}else{this.coffee();this.lounge();}
    this.changeDeck(1,0,CURTIS.roomX);this.aisleTo(CURTIS.roomX,0);
    // The rear room has an open portal and a raised 11 cm metal floor.
    this.walk(CURTIS.roomX,FLOORS[0],-1.30);
    this.walk(CURTIS.roomX,FLOORS[0]+.11,-1.85);
    this.walk(CURTIS.roomX,FLOORS[0]+.11,CURTIS.roomZ);
    const activities=this.random()<.5?['work','window']:['window','work'];
    for(const activity of activities)this.hold(activity,this.range(activity==='work'?[30,50]:[20,40]),{yaw:Math.PI});
    this.walk(CURTIS.roomX,FLOORS[0]+.11,-1.85);
    this.walk(CURTIS.roomX,FLOORS[0],-1.30);
    this.aisleTo(0,0);this.climbTo(0,{leave:true});
  }
  get trafficPosition(){return {...this.position,z:this.position.z+(this.passOffset??0)};}
  passageObstacle(from,clearance){
    const s=this.step,p=this.trafficPosition;
    if(s?.kind==='walk'&&Math.abs(s.to.x-s.from.x)<1e-8&&Math.abs(s.to.z-s.from.z)>.1){
      const low=Math.min(p.z,s.to.z),high=Math.max(p.z,s.to.z);
      const corridor={...p,z:Math.max(low,Math.min(high,from.z))};
      // Someone already passing the doorway finishes first. The real body
      // still blocks collisions, while Curtis waits inside the rear room.
      if(close(from,corridor,clearance)&&!close(from,p,clearance+.06))return p;
      return corridor;
    }
    return p;
  }
  blocksDroid(droid,dt=1/60){
    return this.active&&approaches(droid.position,nextDroid(droid,dt),this.passageObstacle(droid.position,.64),.64);
  }
  blocksCat(m,dt=1/60){
    if(!this.active||m.hidden)return false;
    const p=worldCat(m),s=m.queue?.[0],next={...p};
    if(s?.type==='walk')next.x+=Math.sign(s.x-m.x)*Math.min(Math.abs(s.x-m.x)*.022,m.walkSpeed*.022*dt);
    if(s?.type==='depth')next.z+=Math.sign(s.z-m.z)*Math.min(Math.abs(s.z-m.z),m.walkSpeed*.022*dt);
    // Reserve a sofa landing before a jump starts; a jump in progress has priority.
    // (planned: not while he stands waiting for her himself: then she goes first)
    if(m.hop?.phase==='prepare'&&!m.hop.started&&close(p,this.trafficPosition,1.4)&&!(this.planned&&this.waiting&&!this.gait))return true;
    if(m.crossing&&!m.crossing.active&&Math.abs(p.y-this.position.y)<.8&&Math.abs(p.x-this.position.x)<CAT_CLEARANCE+.06)return true;
    return approaches(p,next,this.trafficPosition,CAT_CLEARANCE);
  }
  blocksCrew(actor,dt=1/60){
    if(actor){
      const seated=this.active&&this.floor===1&&['sit','relax','stand'].includes(this.step?.kind);
      const x=(actor.x-700)*.022;
      if(seated&&actor.floor===1&&!actor.loungeAvoidance?.robot)actor.loungeAvoidance??=CURTIS_LOUNGE_PASSAGE;
      // Keep a route already in use until Milo is clear, even if Curtis rises.
      else if(actor.loungeAvoidance===CURTIS_LOUNGE_PASSAGE&&Math.abs(x-actor.loungeAvoidance.x)>=actor.loungeAvoidance.halfWidth)actor.loungeAvoidance=null;
    }
    if(this.active&&actor){
      const from=worldActor(actor),to=nextActor(actor,dt);
      if(approaches(from,to,this.passageObstacle(from,CREW_CLEARANCE),CREW_CLEARANCE))return true;
      // (planned: also where his walk still goes before it can stop)
      if(this.planned&&this.gait&&approaches(from,to,this.ahead(this.reach),CREW_CLEARANCE))return true;
    }
    if(!this.ladderClaim||!ladderPathsConflict(this.ladderPath,crewLadderPath(actor)))return false;
    if(actor.climbing)return true;
    const walk=actor.queue?.[0];if(walk?.type!=='walk')return false;
    const from=(actor.x-700)*.022,to=(walk.x-700)*.022;
    if(from*to>0&&Math.abs(to)>=Math.abs(from))return false;
    if(from*to>0&&Math.abs(to)>CURTIS_LADDER_TRAFFIC.crewWaitX)return false;
    return Math.max(0,Math.abs(from)-Math.max(actor.walkSpeed*dt,actor.reach??0)*.022)<=CURTIS_LADDER_TRAFFIC.crewWaitX;
  }
  update(dt,{actor=null,droid=null,cat=null,brain=null}={}){
    if(dt<=0||this.disposed)return;
    this.time+=dt;
    if(!this.active){
      if(this.time>=this.due-CURTIS_TIMING.prepareAhead)this.load();
      if(!this.ready||this.time<this.due)return;
      this.beginVisit();
    }
    let s=this.step;if(!s)return;
    this.waiting=false;this.sideStep=false;
    // (a walk under way whose next step is no walk any more first comes to a stop)
    if(this.planned&&this.gait&&!['walk','stairs'].includes(s.kind)){this.stopAhead();s=this.step;}
    if(s.kind==='stairs'){if(this.planned&&this.gait&&!s.entered)this.runUp(s,dt);else this.stairsStep(s,dt);return;}
    const obstacles=[];
    if(actor){
      const position=worldActor(actor);
      const lounging=Boolean(brain&&(brain.loungeEntry||brain.loungeExit||brain.loungeStow||brain.actStation==='lounge')&&!actor.busy);
      if(lounging){
        const pose=loungeWorldPose(brain);position.x=pose.x;position.z=pose.z;
      }
      // (planned: Milo cannot stop on the spot either: also where his walk still goes)
      const ahead=this.planned&&actor.planned&&actor.gait&&!lounging?nextActor(actor,dt):null;
      obstacles.push({p:position,r:CREW_CLEARANCE,crew:true,lounging,held:Boolean(actor.waitingForVisitor),ahead});
    }
    if(droid?.position)obstacles.push({p:droid.position,r:.64});
    if(cat?.motion&&!cat.motion.hidden)obstacles.push({p:worldCat(cat.motion),r:CAT_CLEARANCE});
    const path=this.approachingLadderPath;
    // Walking through the rear-room doorway does not enter the ladder shaft.
    // (a planned walk cannot stop on the spot: it looks as far ahead as it still goes)
    const near=this.planned&&s.kind==='walk'?this.ahead(this.reach):this.position;
    const approaching=s.kind==='walk'&&Math.abs(near.x)<=CURTIS_LADDER_TRAFFIC.waitX&&Math.abs(s.to.x)<Math.abs(this.position.x)-1e-8;
    const entering=s.kind==='climb'||approaching;
    if(path&&entering&&!this.ladderClaim){
      // (planned: Milo walking cannot stop on the spot: within where he waits for the shaft, and as far as he still goes)
      const crewNear=actor&&(actor.climbing||Math.abs((actor.x-700)*.022)<1.5||(this.planned&&actor.busy&&Math.abs((actor.x-700)*.022)<CURTIS_LADDER_TRAFFIC.crewWaitX+(actor.reach??0)*.022));
      const droidAtLanding=droid?.position&&Math.abs(droid.position.y-this.position.y)<1.4&&
        Math.abs(droid.position.x)<CURTIS_LADDER_TRAFFIC.clearX;
      if((crewNear&&ladderPathsConflict(path,crewLadderPath(actor)))||
          (droid?.ladderClaim&&ladderPathsConflict(path,droid.ladderPath))||droidAtLanding){
        this.waiting=true;
        if(this.planned&&this.gait){this.holdWalk(dt);return;}
        if(Math.abs(this.position.x)>CURTIS_LADDER_TRAFFIC.bridgeX){
          const position=this.trafficPosition,shift=Math.max(0,Math.min(CURTIS_LADDER_TRAFFIC.passZ-position.z,dt*.85));
          const next={...position,z:position.z+shift};
          if(shift>0&&!obstacles.some(obstacle=>approaches(position,next,obstacle.p,obstacle.r))){
            this.passOffset=(this.passOffset??0)+shift;this.walkDistance+=shift;this.yaw=0;this.waiting=false;this.sideStep=true;
          }else if(shift>0&&s.kind==='walk'&&this.floor===0&&(s.roomDeparture||Math.abs(s.from.x-CURTIS.roomX)<1e-8)&&Math.abs(position.x)<CURTIS_LADDER_TRAFFIC.crewWaitX){
            // If the exiting droid occupies the side-step, back away from the
            // landing first. Every step still obeys the normal body clearance.
            const retreat={...position,x:position.x+Math.sign(position.x)*dt*.85};
            if(!obstacles.some(obstacle=>approaches(position,retreat,obstacle.p,obstacle.r+.06))){
              this.position={...retreat};this.passOffset=0;s.from={...retreat};s.roomDeparture=true;this.age=0;
              s.duration=Math.max(.01,distance(s.from,s.to)/CURTIS_WALK_SPEED);
              this.walkDistance+=dt*.85;this.yaw=Math.sign(position.x)*Math.PI/2;this.waiting=false;this.sideStep=true;
            }
          }
        }
        return;
      }
      this.ladderClaim=true;this.claimEnd=path.to;
    }
    // Keep the shaft reserved until the arriving visitor has cleared its bridge.
    if(this.ladderClaim&&s.kind!=='climb'&&(Math.abs(this.position.x)>CURTIS_LADDER_TRAFFIC.clearX||
      (!path&&Math.abs(this.position.x)>CURTIS_LADDER_TRAFFIC.mergeX)))this.ladderClaim=false;
    if(s.kind==='walk'){
      // walking in the cabin, the visitor gives way to anyone on a stair trip
      if(this.stairs){
        const p=this.trafficPosition,next=this.nextPoint(s,dt);
        if(this.stairs.blocksBystander(this,p,next,dt)){this.holdWalk(dt);return;}
      }
      const near=(x,y,z,r)=>Math.abs(y-this.position.y)<1&&Math.hypot(x-this.position.x,z-this.position.z)<r;
      const cm=cat?.motion;
      // Only wait for crossings already in progress, so the other actor can finish.
      // (planned: not for a cat that is herself waiting for him to go by)
      if(cm?.crossing?.active&&!(this.planned&&(cm.visitorHold??0)>.5)){
        const p=this.trafficPosition,next=this.nextPoint(s,dt);
        const crossing={x:(cm.x-700)*.022,y:(870-cm.y)*.016,z:p.z};
        if(approaches(p,next,crossing,CAT_CLEARANCE+.12)||near(crossing.x,crossing.y,cm.z,.65)){
          this.holdWalk(dt);return;
        }
      }
    }
    // Check the full seated footprint before leaving the aisle.
    const approachingSeat=s.kind==='walk'&&s.to.x===CURTIS.seatX&&s.to.z===.43;
    if((approachingSeat||s.kind==='sit')&&((actor?.floor===1&&Math.abs((actor.x-700)*.022-CURTIS.seatX)<1.7)||
      obstacles.some(o=>close({x:CURTIS.seatX,y:FLOORS[1],z:.06},o.p,1.05)))){
      // Do not wait in Milo's sofa entrance. Skip this rest and continue the visit.
      const end=this.steps.findIndex(step=>step.kind==='stand');
      if(end>=0&&this.steps[end+1]){
        this.steps.splice(0,end+1);this.age=0;
        const exit=this.step;exit.from={...this.position};exit.duration=Math.max(.1,distance(exit.from,exit.to)/CURTIS_WALK_SPEED);
      }
      this.holdWalk(dt);return;
    }
    if(s.kind==='walk'){
      // Leave the temporary passing lane through a real depth walk. Carrying
      // its offset into the room made the visible and authored paths disagree.
      if(!s.depthTransfer&&Math.abs(s.to.x-s.from.x)<1e-8&&Math.abs(s.to.z-s.from.z)>.1){
        s.depthTransfer=true;s.from={...this.trafficPosition};this.position={...s.from};this.passOffset=0;
        s.duration=Math.max(.01,distance(s.from,s.to)/CURTIS_WALK_SPEED);this.age=0;
      }
      const p=this.trafficPosition,ahead=this.planned?this.nextPoint(s,dt):null;
      const onAisle=Math.abs(this.position.x)>CURTIS_LADDER_TRAFFIC.mergeX&&s.from.z>=.65&&s.to.z>=.65;
      const leavingBridge=this.ladderClaim&&Math.abs(this.position.x)>CURTIS_LADDER_TRAFFIC.bridgeX&&s.from.z>=.2&&s.to.z>=.2;
      const aisle=onAisle||leavingBridge;
      let offset=0,crowded=false;
      if(aisle){
        const nearby=obstacles.filter(o=>Math.abs(o.p.y-p.y)<1.4&&Math.abs(o.p.x-p.x)<2.2);
        // (a planned walk keeps the lane free where it still goes as well)
        const laneFree=z=>nearby.every(o=>!close({...p,z},o.p,o.r+(o.r===CREW_CLEARANCE?.08:.03))&&!(ahead&&close({...ahead,z},o.p,o.r+(o.r===CREW_CLEARANCE?.08:.03))));
        const current=this.position.z+(this.passOffset??0);
        crowded=!laneFree(this.position.z);
        if(crowded)offset=CURTIS_LADDER_TRAFFIC.passZ-this.position.z;
        else if(nearby.length&&laneFree(current))offset=Math.min(this.passOffset??0,Math.max(0,CURTIS_LADDER_TRAFFIC.passZ-this.position.z));
      }
      // (planned: someone passing him beside the bridge goes by first)
      if(this.ladderClaim&&Math.abs(this.position.x)<CURTIS_LADDER_TRAFFIC.mergeX&&Math.abs(s.to.x)<Math.abs(this.position.x)&&!(this.planned&&crowded))offset=0;
      const shift=Math.sign(offset-(this.passOffset??0))*Math.min(Math.abs(offset-(this.passOffset??0)),dt*.85);
      const lateral={...p,z:p.z+shift};
      // (planned: he steps aside standing; a walk under way first comes to its stop, and only
      // drifts back toward the aisle while walking)
      const outward=Math.abs((this.passOffset??0)+shift)>Math.abs(this.passOffset??0);
      const movingAside=Math.abs(shift)>1e-8&&!(this.planned&&this.gait&&outward)&&!obstacles.some(o=>approaches(p,lateral,o.p,o.r));
      if(movingAside){this.passOffset=(this.passOffset??0)+shift;this.walkDistance+=Math.abs(shift);}
      // (planned, standing: a step aside is walked in the plain cycle, before any turn or first step)
      if(this.planned&&!this.gait&&movingAside){this.turn=null;this.sideStep=true;this.yaw=shift>0?0:Math.PI;return;}
      const next=this.nextPoint(s,dt);
      const needsBridge=Math.abs(next.x)<=CURTIS_LADDER_TRAFFIC.bridgeX&&Math.abs(this.passOffset??0)>.02;
      // (planned: a step out onto the aisle is set off on, or walked up to, only while the crew is
      // not about its end, and once begun it is finished: the crew waits for it outside its
      // corridor, see passageObstacle. Not into someone already standing there.)
      const transfer=this.planned&&this.outToAisle(s)&&(Boolean(this.gait)||distance(this.position,s.from)>.02);
      // (crew already waiting for him outside the step's end lets him go first)
      const crewAbout=end=>obstacles.some(o=>o.crew&&!o.lounging&&close(o.p,end,o.r+.7)&&!(o.held&&!close(o.p,end,.45)));
      const coming=this.planned?this.aisleAhead():null;
      if(this.planned&&((this.outToAisle(s)&&!transfer&&crewAbout(s.to))||(coming&&coming.distance<=this.reach+.1&&crewAbout(coming.step.to)))){this.holdWalk(dt);return;}
      // (finishing it, he may come inside the usual clearance of someone who stopped by its end,
      // and closer still, short of touching, to someone who is waiting for him there: one of the
      // two has to move, and he is the one already under way)
      const finishes=o=>(transfer||(this.planned&&this.outToAisle(s)&&o.held))&&o.crew&&!close(o.p,s.to,o.held?.45:o.r-.12);
      // (planned: where the way comes out toward the passing lane, the side-step there will be
      // narrower: he may then be nearer the crew than `next` says)
      const narrowed=this.planned&&(this.passOffset??0)>0?{...next,z:Math.min(next.z,Math.max(next.z-(this.passOffset??0),CURTIS_LADDER_TRAFFIC.passZ))}:null;
      const into=(o,q)=>approaches(this.trafficPosition,q,o.p,o.r+.06)||(o.ahead&&approaches(this.trafficPosition,q,o.ahead,o.r+.06));
      if(needsBridge||obstacles.some(o=>!finishes(o)&&(into(o,next)||(narrowed&&o.crew&&into(o,narrowed))))){
        // (planned, standing: he steps aside in the plain cycle; walking: the walk stops in step)
        if(this.planned&&this.gait){this.holdWalk(dt);return;}
        this.waiting=!movingAside;if(movingAside){this.yaw=shift>0?0:Math.PI;this.sideStep=true;}
        if(this.planned&&!movingAside)this.walkPlanned(dt,true);
        return;
      }
      if(this.planned){this.walkPlanned(dt,false);return;}
    }
    // Wait through the guest's rise and passage as well as the conversation.
    // Stepping into the aisle while the guest walks past creates a mutual hold.
    const sharing=brain?.loungeCompanion?.peer===this&&(brain.loungeEntry||brain.loungeExit||brain.isSeatedInLounge());
    const passing=actor?.busy&&actor.floor===1&&Math.abs((actor.x-700)*.022-CURTIS.seatX)<1.7;
    if(s.kind==='relax'&&(sharing||passing))s.duration=Math.max(s.duration,this.age+dt+2);
    const before={...this.position};this.age=Math.min(s.duration,this.age+dt);
    let u=this.age/s.duration;
    // Ease ladder deck transfers while keeping the middle of the climb steady.
    if(s.kind==='climb')u=.12*smooth(u/.18)+.76*Math.max(0,Math.min(1,(u-.18)/.64))+.12*smooth((u-.82)/.18);
    if(['walk','climb'].includes(s.kind))for(const key of ['x','y','z'])this.position[key]=s.from[key]+(s.to[key]-s.from[key])*u;
    if(s.kind==='walk'){
      this.walkDistance+=distance(before,this.position);
      if(distance(s.from,s.to)>.001)this.yaw=Math.atan2(s.to.x-s.from.x,s.to.z-s.from.z);
    }
    if(this.age>=s.duration){
      this.position={...s.to};this.steps.shift();this.age=0;
      if(!this.steps.length){this.active=false;this.ladderClaim=false;this.due=this.time+this.range(CURTIS_TIMING.between);}
    }
  }
  dispose(){this.disposed=true;this.active=false;this.ladderClaim=false;}
}
