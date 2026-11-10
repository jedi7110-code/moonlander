import {FLOORS,LADDER_X,getStation,CAT_PORT,CAT_BOWL,CAT_SOFA,LOUNGE_SEAT,CABIN_AISLE} from './layout.js';
import {CAT_RISE_TIME} from './cat-rest.js';
import {CABIN_PACE,CREW_WALK_SPEED,LADDER_PACE,LADDER_LANDING,LADDER_ENTRY} from './pace.js';
import {createCatTurn,sampleCatTurn,angleDelta} from './cat-turn.js';
import {APPROVED_RESTS,approvedRestRelease} from './cat-approved-rest.js';
import {BUNK_PHASE_SECONDS} from './bunk-visit.js';
import {actorWalkway,LOUNGE_TABLE_PASSAGE} from './cabin-walkway.js';
import {worldActor,nextActor} from './curtis-traffic.js';
import {CabinMouseChase} from './mouse-chase.js';
import {humanTripDistance} from './human-stair-gait.js';

const toPx=x=>x/.022+700,toPxY=y=>870-y/.016;

export const CAT_WALK_SPEED=18;
const CAT_FREE_REST_MODES=new Set(['look','groom','sleep','stretch','prone']);
const CAT_REST_YAWS=Array.from({length:8},(_,i)=>i*Math.PI/4);
const CAT_WAKE_PREP_SECONDS=.3,CAT_WAKE_LAND_SECONDS=.45;

// Where the robot stands at work in or next to the crew's aisle lane (the
// galley, the incinerator), the crew walks round it: the lane bends away from
// the robot the way it bends round the lounge sofa (crewWalkway). The bend is
// only set or taken away while Milo is outside it, so he never jumps sideways.
export const ROBOT_DETOUR=Object.freeze({near:.56,clear:.62,halfWidth:1.25,drift:.4,space:.5,brush:.4,limit:10,moment:1.5});
function robotDetour(actor,droid,dt){
  const route=actor.loungeAvoidance;
  if(route&&!route.robot)return;
  const p=droid?.position,x=(actor.x-700)*.022,D=ROBOT_DETOUR;
  if(route){
    // Keep the bend while Milo is in it. If the robot moves on to a work
    // spot next to the first one meanwhile, the bend drifts over to it.
    if(Math.abs(x-route.x)<route.halfWidth&&route.floor===actor.floor){
      if(p&&droid.step?.kind==='work'&&Math.abs(p.y-(870-FLOORS[actor.floor].y)*.016)<.6&&Math.abs(p.z-CABIN_AISLE.crewZ)<D.near&&Math.abs(p.x-route.x)<D.halfWidth){
        const step=D.drift*dt,toward=(a,b)=>a+Math.max(-step,Math.min(step,b-a));
        actor.loungeAvoidance={...route,x:toward(route.x,p.x),depth:toward(route.depth,p.z+D.clear)};
      }
      return;
    }
    actor.loungeAvoidance=null;
  }
  const walk=actor.queue[0];
  if(!p||droid.docked||!['work','turn'].includes(droid.step?.kind)||walk?.type!=='walk')return;
  if(Math.abs(p.y-(870-FLOORS[actor.floor].y)*.016)>.6||Math.abs(p.z-CABIN_AISLE.crewZ)>=D.near||Math.abs(x-p.x)<D.halfWidth)return;
  // only to walk past: where Milo is going to stop next to the robot (a
  // station, the start of a stair trip) he stays on his lane
  if(Math.abs((walk.x-700)*.022-p.x)<D.halfWidth)return;
  actor.loungeAvoidance={robot:true,floor:actor.floor,x:p.x,halfWidth:D.halfWidth,depth:p.z+D.clear};
}

export function advanceCabinTraffic(actor,cat,dt,droid=null){
  if(dt<=0)return;
  robotDetour(actor,droid,dt);
  actor.waitingForCat=cat.motion.blocksCrew(actor,dt);
  // walking in the cabin, the crew gives way to anyone on a stair trip
  actor.waitingForStairs=Boolean(actor.queue[0]?.type==='walk'&&actor.stairs?.blocksBystander(actor,worldActor(actor),nextActor(actor,dt),dt));
  // ... and does not walk into the robot (the robot goes first: it crosses
  // the lane, Milo walks along it). After ROBOT_DETOUR.limit seconds Milo
  // goes on; on the way to the stairs he takes the ladder instead when the
  // robot is at them.
  let blocked=false;
  if(!actor.waitingForStairs&&actor.queue[0]?.type==='walk'&&droid&&!droid.docked&&!droid.onStairTrip?.()){
    const from=worldActor(actor),to=nextActor(actor,dt),p=droid.position;
    const before=Math.hypot(from.x-p.x,from.z-p.z),after=Math.hypot(to.x-p.x,to.z-p.z),level=Math.abs(p.y-from.y)<.6;
    // The stretch the robot is about to walk: Milo stays out of it; if he is
    // already in it he walks on to clear it and may brush past the robot.
    const goal=droid.step?.kind==='walk'?droid.step.to:null;let inWay=false;
    if(goal&&level){
      const dx=goal.x-p.x,dz=goal.z-p.z,length=Math.hypot(dx,dz),reach=Math.min(length,2.5);
      const gap=q=>{const u=length<1e-6?0:Math.max(0,Math.min(reach,((q.x-p.x)*dx+(q.z-p.z)*dz)/length));return Math.hypot(q.x-p.x-dx/Math.max(length,1e-6)*u,q.z-p.z-dz/Math.max(length,1e-6)*u);};
      inWay=gap(from)<ROBOT_DETOUR.clear;
      blocked=!inWay&&gap(to)<ROBOT_DETOUR.clear;
    }
    actor.inRobotWay=inWay;
    if(!blocked)blocked=level&&after<(inWay?ROBOT_DETOUR.brush:ROBOT_DETOUR.space)&&after<before-1e-9;
  }else actor.inRobotWay=false;
  actor.robotWait=blocked?(actor.robotWait??0)+dt:0;
  // (a robot that is itself held up is not going to move out of the way: Milo only waits a moment for it)
  const patience=droid?.waiting?ROBOT_DETOUR.moment:ROBOT_DETOUR.limit;
  if(blocked&&actor.robotWait>1&&actor.queue[1]?.type==='stairs'&&!actor.queue[1].entered)actor.stairsFallback(actor.queue[1]);
  else if(blocked&&actor.robotWait<patience)actor.waitingForStairs=true;
  if(!actor.waitingForHatch&&!actor.waitingForCat&&!actor.waitingForDroid&&!actor.waitingForVisitor&&!actor.waitingForStairs)actor.update(dt);
  cat.update(dt,actor,droid);
}

export class CrewMotion {
  constructor({floor=getStation('console').floor,x=360,walkSpeed=CREW_WALK_SPEED,climbSpeed=38*LADDER_PACE}={}) {
    this.floor=floor;this.x=x;this.y=FLOORS[floor].y;this.walkSpeed=walkSpeed;this.climbSpeed=climbSpeed;
    this.walkDistance=0;
    this.queue=[];this.onArrive=null;this.facing=1;this.symbol='';this.knockTime=0;this.commandVersion=0;
  }
  get busy(){return this.queue.length>0;}
  get climbing(){return this.queue[0]?.type==='climb';}
  // walking a stair trip (between two decks by the left stair tower)
  get onStairs(){const s=this.queue[0];return s?.type==='stairs'&&s.entered?s:null;}
  onStairTrip(){return this.queue[0]?.type==='stairs';}
  setSymbol(symbol){this.symbol=symbol;}
  knock(){this.knockTime=.7;}
  goTo(target,onArrive) {
    // Shared 2D brain callbacks still supply their original station objects.
    // Resolve named destinations to the 3D layout without changing the 2D data.
    target=getStation(target?.id)??target;
    if(!target||!FLOORS[target.floor])return;
    this.commandVersion++;
    // A stair trip in progress is finished first; plan the rest from its end.
    const current=this.onStairs;
    if(current){
      // (a jam before the stair itself re-plans to this newest target)
      current.target=target;
      this.queue=[current,...(current.floor===target.floor?[{type:'walk',x:target.x}]:[{type:'replan',target}])];
      this.onArrive=onArrive||null;return;
    }
    if(target.loungeAccess)this.loungeTableAccess=true;
    else if(this.loungeTableAccess){
      // Leave the adjacent cushion by its own left-side entrance, then
      // rejoin the table bypass. Switching lanes beside the cushion snaps
      // the body into the table route while it is still next to the seat.
      this.queue=[{type:'walk',x:toPx(LOUNGE_TABLE_PASSAGE.x-LOUNGE_TABLE_PASSAGE.halfWidth)},
        {type:'replan',target,leaveLoungeAccess:true}];
      this.onArrive=onArrive||null;return;
    }
    this.queue=this.planRoute(target);this.onArrive=onArrive||null;
  }
  // Floor changes take the stair tower when a shared CabinStairs is attached
  // and the stairs are usable; otherwise (and in plain studies) the ladder.
  planRoute(target,{ladder=false}={}){
    const queue=[],atFloor=this.y===FLOORS[this.floor].y;
    if(!ladder&&this.stairs&&atFloor&&target.floor!==this.floor){
      const trip=this.stairs.trip(this.floor,target.floor,(this.x-700)*.022,(target.x-700)*.022);
      if(this.stairs.available(this,trip)){
        if(this.x!==toPx(trip.from.x))queue.push({type:'walk',x:toPx(trip.from.x)});
        queue.push({type:'stairs',trip,floor:target.floor,t:0,entered:false,target});
        queue.push({type:'walk',x:target.x});return queue;
      }
    }
    // Retargeting on a ladder preserves the current height, including mid-climb.
    if(this.y!==FLOORS[target.floor].y){
      if(this.x!==LADDER_X)queue.push({type:'walk',x:LADDER_X});
      queue.push({type:'climb',floor:target.floor,y:FLOORS[target.floor].y,startY:this.y,
        mounting:this.y===FLOORS[this.floor].y});
    }
    queue.push({type:'walk',x:target.x});return queue;
  }
  stairsFallback(seg){this.queue=[...this.planRoute(seg.target,{ladder:true})];}
  // Travel wanted on a stair trip this step. The trip is walked at the cabin
  // speed the walker arrived with (a change of health takes effect after it).
  stairTravel(seg,dt){const speed=seg.arrival.speed;return speed*seg.trip.pace(seg.t,speed)*dt;}
  // The crew walks onto and off a stair trip without breaking step.
  get walksThrough(){return true;}
  // The walk counter (which drives the walk cycle and the footstep sounds)
  // follows the trip's footfalls: they slow down and shorten at the stairs.
  beginStairWalk(seg){seg.arrival={speed:this.walkSpeed*.022,entry:this.walkDistance*.022};}
  stairWalk(seg){this.walkDistance=humanTripDistance(seg.trip,Math.min(seg.t,seg.trip.length),seg.arrival)/.022;}
  // One step along the stair trip at the head of the queue.
  stairStep(seg,dt){
    if(!seg.entered){
      // (someone may have come to stand at the entrance since the route was planned)
      if(this.stairs.blockedAtStart(this,seg.trip)){this.stairsFallback(seg);return;}
      this.stairs.enter(this,this.stairKind??'crew',seg.trip,seg.t);seg.entered=true;this.beginStairWalk(seg);
    }
    const want=this.stairTravel(seg,Math.max(0,dt));
    const {travel,waiting,stuck}=this.stairs.advance(this,want,dt);
    this.stairWaiting=waiting;
    if(stuck){
      // The stairs are jammed at the entrance: take the ladder from here.
      this.stairs.giveUp(this);this.stairWaiting=false;this.stairsFallback(seg);return;
    }
    seg.t=this.stairs.walker(this).t;
    const f=seg.trip.frame(Math.min(seg.t,seg.trip.length));
    this.x=toPx(f.x);this.y=toPxY(f.y);this.stairWalk(seg,travel);
    if(Math.abs(f.dx)>.2)this.facing=Math.sign(f.dx);
    if(seg.t>=seg.trip.length){
      const over=(seg.t-seg.trip.length)/(this.walkSpeed*.022),through=this.walksThrough;
      this.stairs.leave(this);this.floor=seg.floor;this.x=toPx(seg.trip.to.x);this.y=FLOORS[seg.floor].y;
      this.queue.shift();
      if(!this.busy){const callback=this.onArrive;this.onArrive=null;callback?.();}
      // walking straight on into the cabin (or to a route planned on the
      // stairs): spend the rest of this step there
      else if(through&&over>0&&['walk','replan'].includes(this.queue[0].type))this.advance(over);
    }
  }
  get curvedCrewWalk(){return Boolean(this.loungeAvoidance)||(!this.loungeTableAccess&&this.floor===1&&
    Math.abs((this.x-700)*.022-LOUNGE_TABLE_PASSAGE.x)<LOUNGE_TABLE_PASSAGE.halfWidth+1);}
  walkStep(dt){
    const s=this.queue[0],step=this.walkSpeed*Math.max(0,dt);
    if(s?.type!=='walk'||!this.curvedCrewWalk)return step;
    const direction=Math.sign(s.x-this.x),limit=Math.min(Math.abs(s.x-this.x),step);
    if(!limit)return 0;
    const x=(this.x-700)*.022,from=actorWalkway(this,x).z;
    const distance=dx=>Math.hypot(dx,(actorWalkway(this,x+direction*dx*.022).z-from)/.022);
    if(distance(limit)<=step+1e-9)return limit;
    // Solve the actual displacement, including tight turns at the table,
    // rather than estimating their changing slope with one full step.
    let low=0,high=limit;
    for(let i=0;i<22;i++){const mid=(low+high)/2;if(distance(mid)>step)high=mid;else low=mid;}
    return low;
  }

  update(dt) {
    this.knockTime=Math.max(0,this.knockTime-dt);
    this.advance(dt);
  }
  advance(dt){
    const seg=this.queue[0];if(!seg)return;
    if(seg.type==='stairs'){this.stairStep(seg,dt);return;}
    if(seg.type==='replan'){
      if(seg.leaveLoungeAccess)this.loungeTableAccess=false;
      const callback=this.onArrive;this.queue=this.planRoute(getStation(seg.target?.id)??seg.target);this.onArrive=callback;
      if(this.walksThrough&&this.queue[0]?.type==='walk')this.advance(dt);
      return;
    }
    const key=seg.type==='climb'?'y':'x',speed=seg.type==='climb'?this.climbSpeed:this.walkSpeed;
    const delta=seg[key]-this[key];let landingSpeed=1;
    if(seg.type==='climb'){
      // Ease into the final weight transfer in both directions; keep the rest of the climb's pace.
      const remaining=Math.abs(delta)*.016,t=Math.max(0,Math.min(1,(remaining-LADDER_LANDING.height)/(LADDER_LANDING.slowFrom-LADDER_LANDING.height)));
      const finalSpeed=LADDER_LANDING.height/.016/LADDER_LANDING.seconds/speed;
      landingSpeed=finalSpeed+(1-finalSpeed)*t*t*(3-2*t);
    }
    const mounting=seg.type==='climb'&&seg.mounting&&Math.abs(this.y-seg.startY)*.016<LADDER_ENTRY.miloHeight-1e-8;
    const step=mounting?Math.min(LADDER_ENTRY.miloHeight/.016-Math.abs(this.y-seg.startY),LADDER_ENTRY.miloHeight/.016/LADDER_ENTRY.seconds*dt):(seg.type==='walk'?this.walkStep(dt):speed*landingSpeed*dt);
    if(key==='x'){
      const dx=Math.sign(delta)*Math.min(Math.abs(delta),step),x=(this.x-700)*.022;
      const from=actorWalkway(this,x).z;
      const to=actorWalkway(this,x+dx*.022).z;
      this.walkDistance+=this.curvedCrewWalk?Math.hypot(dx,(to-from)/.022):Math.abs(dx);
    }
    if(key==='x'&&Math.abs(delta)>.01)this.facing=Math.sign(delta);
    if(Math.abs(delta)<=step){
      this[key]=seg[key];if(seg.type==='climb')this.floor=seg.floor;this.queue.shift();if(!this.busy){const callback=this.onArrive;this.onArrive=null;callback?.();}
      // walking straight on into a stair trip: spend the rest of this step on it
      else if(this.walksThrough&&seg.type==='walk'&&this.queue[0].type==='stairs'&&step>0)this.advance(dt*(1-Math.abs(delta)/step));
    }
    else this[key]+=Math.sign(delta)*step;
  }
}

// A cat held by the visitor this long turns back this far along its lane
// (kept inside the aisle, in pixels) to let him pass.
export const CAT_GIVE_WAY=Object.freeze({after:2.5,distance:1.4,min:30,max:1370});
export class CatMotion extends CrewMotion {
  constructor({turns=false,...options}={}){super({floor:CAT_SOFA.floor,x:1035,walkSpeed:CAT_WALK_SPEED,...options});this.turns=turns;this.heading=null;this.turn=null;this.onSofa=this.floor===CAT_SOFA.floor&&this.x>=CAT_SOFA.seatX;this.elevation=this.onSofa?LOUNGE_SEAT.top:0;this.z=this.onSofa?LOUNGE_SEAT.centerDepth:CAT_PORT.walkZ;this.hop=null;this.portalWalkDistance=0;this.depthWalkDistance=0;this.portal=null;this.destination=null;this.onDestination=null;this.waitingForCrew=false;}
  get busy(){return Boolean(this.chase||this.turn||this.portal||this.hop)||super.busy;}
  face(yaw){
    if(!this.turns)return false;
    if(this.heading===null){this.heading=yaw;return false;}
    if(this.turn){this.pendingHeading=yaw;return true;}
    if(Math.abs(angleDelta(this.heading,yaw))<1e-7){this.heading+=angleDelta(this.heading,yaw);return false;}
    this.turn=createCatTurn(this.heading,yaw);return true;
  }
  get turnPose(){
    if(this.turn)return sampleCatTurn(this.turn);
    const p=this.portal;
    if(this.turns&&p&&['turnIn','turnOut'].includes(p.phase)){
      const turn=createCatTurn(p.phase==='turnIn'?p.yaw:0,p.phase==='turnIn'?Math.PI:this.facing*Math.PI/2,{duration:p.duration});
      turn.age=p.age;return sampleCatTurn(turn);
    }
    return null;
  }
  get climbing(){return false;}
  get stairKind(){return 'cat';}
  get curvedCrewWalk(){return false;}
  // A calm cat keeps about 0.5 m/s up and down the flights (stair study).
  stairTravel(seg,dt){return this.walkSpeed*.022*1.25*dt;}
  get walksThrough(){return false;}
  beginStairWalk(){}
  stairWalk(seg,travel){this.walkDistance+=travel/.022;}
  // Jammed stairs: the cat takes its wall passage instead (stairs avoided now).
  stairsFallback(){this.queue=[];this.plan();}
  stairStep(seg,dt){
    super.stairStep(seg,dt);
    if(this.queue[0]===seg){const f=seg.trip.frame(seg.t);this.z=f.z;this.heading=f.yaw;}
    else if(this.floor===seg.floor&&this.y===FLOORS[seg.floor].y){this.z=seg.trip.to.z;this.heading=seg.trip.frame(seg.trip.length).yaw;}
  }
  get passageWalkSeconds(){return Math.abs(CAT_PORT.walkZ-CAT_PORT.turnInset-CAT_PORT.insideZ)/(this.walkSpeed*.022);}
  get hidden(){return ['close','transit','reopen'].includes(this.portal?.phase);}
  goTo(target,onArrive){
    if(!target||!FLOORS[target.floor])return;
    this.commandVersion++;this.destination={floor:target.floor,x:target.x,z:target.z??CAT_PORT.walkZ};this.onDestination=onArrive||null;
    // Finish an occupied passage or stair trip before following a changed
    // destination (a trip re-plans from its end: onArrive -> plan()).
    if(this.onStairTrip())this.onArrive=()=>this.plan();
    else if(!this.portal&&!this.hop)this.plan();
  }
  plan(){
    if(!this.destination)return;
    const wantsSofa=this.destination.floor===CAT_SOFA.floor&&this.destination.x>=CAT_SOFA.seatX;
    if(this.onSofa!==wantsSofa&&this.floor===CAT_SOFA.floor){
      const up=!this.onSofa;
      this.queue=[];
      if(up&&this.z!==CAT_PORT.walkZ)this.queue.push({type:'depth',z:CAT_PORT.walkZ});
      this.queue.push({type:'walk',x:up?CAT_SOFA.floorX:CAT_SOFA.seatX});
      if(up)this.queue.push({type:'depth',z:CAT_SOFA.approachZ});
      this.onArrive=()=>{this.facing=up?1:-1;this.hop={up,phase:'prepare',age:0,duration:.14};};return;
    }
    const crossing=this.destination.floor!==this.floor;
    // Change decks by the stair tower when it is usable (not from the sofa);
    // the wall passage otherwise.
    if(crossing&&this.stairs&&!this.onSofa&&this.y===FLOORS[this.floor].y){
      const trip=this.stairs.trip(this.floor,this.destination.floor,(this.x-700)*.022,(this.destination.x-700)*.022,{fromZ:CAT_PORT.walkZ,toZ:CAT_PORT.walkZ});
      if(this.stairs.available(this,trip)){
        this.queue=[];
        if(this.z!==CAT_PORT.walkZ)this.queue.push({type:'depth',z:CAT_PORT.walkZ});
        if(this.x!==toPx(trip.from.x))this.queue.push({type:'walk',x:toPx(trip.from.x)});
        this.queue.push({type:'stairs',trip,floor:this.destination.floor,t:0,entered:false,target:this.destination});
        this.onArrive=()=>this.plan();return;
      }
    }
    this.queue=[];
    if(!this.onSofa&&this.z!==CAT_PORT.walkZ&&(crossing||this.destination.x!==this.x))this.queue.push({type:'depth',z:CAT_PORT.walkZ});
    this.queue.push({type:'walk',x:crossing?CAT_PORT.x:this.destination.x});
    if(!crossing&&!this.onSofa&&(this.destination.z!==CAT_PORT.walkZ||(this.destination.x===this.x&&this.z!==this.destination.z)))this.queue.push({type:'depth',z:this.destination.z});
    this.onArrive=()=>{
      if(crossing){this.portal={from:this.floor,to:this.destination.floor,phase:'turnIn',age:0,duration:4,yaw:this.heading??this.facing*Math.PI/2};return;}
      const callback=this.onDestination;this.destination=null;this.onDestination=null;callback?.();
    };
  }
  get laneYaw(){const segment=this.queue[0];return segment?.type==='depth'?(segment.z<this.z?Math.PI:0):null;}
  get crossing(){
    // On the stair tower the stair traffic keeps the distances.
    if(this.onStairs)return null;
    const segment=this.queue[0];
    let min=this.x,max=this.x,seconds=0,active=false;
    if(this.hop){min=CAT_SOFA.floorX;max=CAT_SOFA.seatX;seconds=1;active=this.hop.up||this.hop.started||this.hop.phase!=='prepare';}
    else if(this.portal&&!this.hidden){seconds=this.portal.duration-this.portal.age;active=this.portal.age>0;}
    else if(segment?.type==='depth'&&Math.abs(segment.z-this.z)>.001){
      if(Math.min(this.z,segment.z)>CABIN_AISLE.catZ-.08&&!segment.started)return null;
      seconds=Math.abs(segment.z-this.z)/(this.walkSpeed*.022)+.4;active=Boolean(segment.started)||this.z<CABIN_AISLE.catZ-.08;
      if(this.floor===CAT_SOFA.floor&&this.destination?.x>=CAT_SOFA.seatX){max=CAT_SOFA.seatX;seconds+=1;}
    }else if(!this.onSofa&&!this.portal&&this.z<CABIN_AISLE.catZ-.08){active=true;}
    else return null;
    const clearance=!this.busy?60:CABIN_AISLE.crossingClearance;
    return{min:min-clearance,max:max+clearance,seconds,active};
  }
  crewInCrossing(actor,seconds){
    const crossing=this.crossing;
    if(!crossing||!actor||actor.floor!==this.floor||Math.abs(actor.y-this.y)>45)return false;
    const target=actor.queue[0]?.type==='walk'?actor.queue[0].x:actor.x;
    const end=actor.x+Math.sign(target-actor.x)*Math.min(Math.abs(target-actor.x),actor.walkSpeed*seconds);
    return Math.max(actor.x,end)>=crossing.min&&Math.min(actor.x,end)<=crossing.max;
  }
  blocksCrew(actor,dt){return Boolean(this.crossing?.active&&this.crewInCrossing(actor,dt));}
  droidInCrossing(droid,seconds){
    const crossing=this.crossing;if(!crossing||!droid?.position)return false;
    const floorY=(870-this.y)*.016,minX=(crossing.min-LADDER_X)*.022,maxX=(crossing.max-LADDER_X)*.022;
    const intersects=(a,b)=>Math.max(a.x,b.x)>=minX&&Math.min(a.x,b.x)<=maxX&&
      Math.max(a.y,b.y)>=floorY-.45&&Math.min(a.y,b.y)<=floorY+.55&&
      Math.max(a.z,b.z)>=Math.min(this.z,CAT_PORT.insideZ)-.4&&Math.min(a.z,b.z)<=CAT_PORT.walkZ+.4;
    let from=droid.position,remaining=Math.max(0,seconds);
    if(intersects(from,from))return true;
    // Reserve the entire crossing, including an approaching turn/next segment.
    for(let i=0;i<droid.steps.length&&remaining>0;i++){
      const step=droid.steps[i],age=i===0?droid.age:0,duration=step.duration-age;
      const used=Math.min(remaining,duration),u=step.to?Math.min(1,(age+used)/step.duration):0;
      const to=step.to?{x:step.from.x+(step.to.x-step.from.x)*u,y:step.from.y+(step.to.y-step.from.y)*u,z:step.from.z+(step.to.z-step.from.z)*u}:from;
      if(intersects(from,to))return true;
      remaining-=used;from=to;
    }
    return false;
  }
  blocksDroid(droid,dt){return Boolean(this.crossing?.active&&this.droidInCrossing(droid,dt));}
  update(dt,actor=null,droid=null){
    if(dt<=0)return;
    // On the stair tower only the stair traffic holds the cat.
    if(!this.onStairTrip()&&this.visitor?.blocksCat(this,dt)){
      // Met head-on in the aisle (the visitor's path round the lounge table
      // runs too close to the cat's lane to pass): after a moment the cat turns
      // back and gives way, then goes on to where it was going.
      this.visitorHold=(this.visitorHold??0)+dt;
      const s=this.queue[0];
      if(this.visitorHold>=CAT_GIVE_WAY.after&&s?.type==='walk'&&!this.retreating&&!this.turn&&!this.hop&&!this.portal&&!this.chase){
        const away=Math.sign(this.x-700-(this.visitor.trafficPosition.x/.022))||-Math.sign(s.x-this.x)||1;
        const x=Math.max(CAT_GIVE_WAY.min,Math.min(CAT_GIVE_WAY.max,this.x+away*CAT_GIVE_WAY.distance/.022));
        if(Math.abs(x-this.x)>4){this.queue.unshift({type:'walk',x,giveWay:true});this.retreating=true;this.visitorHold=0;}
      }
      return;
    }
    this.visitorHold=0;
    if(this.retreating&&this.queue[0]?.giveWay!==true)this.retreating=false;
    if(this.turn){
      this.turn.age=Math.min(this.turn.duration,this.turn.age+dt);this.heading=sampleCatTurn(this.turn).yaw;
      if(this.turn.age===this.turn.duration){
        this.turn=null;
        if(this.pendingHeading!==undefined){const target=this.pendingHeading;delete this.pendingHeading;this.face(target);}
      }
      return;
    }
    if(this.turns&&!this.portal){
      const segment=this.queue[0];let desired=null;
      if(this.hop){const sign=this.hop.up?1:-1;desired=Math.atan2((CAT_SOFA.seatX-CAT_SOFA.floorX)*.022*sign,(LOUNGE_SEAT.centerDepth-CAT_SOFA.approachZ)*sign);}
      else if(segment?.type==='depth'&&Math.abs(segment.z-this.z)>.001)desired=segment.z<this.z?Math.PI:0;
      else if(segment?.type==='walk'&&Math.abs(segment.x-this.x)>.001)desired=Math.sign(segment.x-this.x)*Math.PI/2;
      if(desired!==null&&(!this.hop||this.hop.phase==='prepare')&&this.face(desired))return;
    }
    const crossing=this.crossing;
    this.waitingForCrew=Boolean(crossing&&!crossing.active&&!actor?.waitingForCat&&this.crewInCrossing(actor,crossing.seconds));
    this.waitingForDroid=Boolean(crossing&&!crossing.active&&!droid?.waitingForCat&&this.droidInCrossing(droid,crossing.seconds));
    if(this.waitingForCrew||this.waitingForDroid)return;
    if(this.hop){
      this.hop.started=true;
      while(dt>0&&this.hop){
        const h=this.hop,step=Math.min(dt,h.duration-h.age);h.age+=step;dt-=step;
        if(h.phase==='flight'){
          const t=h.age/h.duration,from=h.up?CAT_SOFA.floorX:CAT_SOFA.seatX,to=h.up?CAT_SOFA.seatX:CAT_SOFA.floorX;
          this.x=from+(to-from)*t;
          this.z=(h.up?CAT_SOFA.approachZ:LOUNGE_SEAT.centerDepth)+(h.up?1:-1)*(LOUNGE_SEAT.centerDepth-CAT_SOFA.approachZ)*t;
          this.elevation=(h.up?LOUNGE_SEAT.top*t:LOUNGE_SEAT.top*(1-t))+4*(h.up?.30:.20)*t*(1-t);
        }
        if(h.age<h.duration)break;
        h.age=0;
        if(h.phase==='prepare'){h.phase='flight';h.duration=.56;}
        else if(h.phase==='flight'){h.phase='land';h.duration=.18;this.onSofa=h.up;this.elevation=h.up?LOUNGE_SEAT.top:0;this.z=h.up?LOUNGE_SEAT.centerDepth:CAT_SOFA.approachZ;}
        else{this.hop=null;this.plan();}
      }
      if(dt<=0||this.hop)return;
    }
    if(!this.portal){
      const segment=this.queue[0];
      if(segment?.type==='depth'){
        segment.started=true;
        const delta=segment.z-this.z,step=Math.min(Math.abs(delta),this.walkSpeed*.022*dt);
        this.z+=Math.sign(delta)*step;this.depthWalkDistance+=step;
        if(Math.abs(delta)<=step){this.z=segment.z;this.queue.shift();if(!this.busy){const callback=this.onArrive;this.onArrive=null;callback?.();}}
      }else super.update(dt);
      return;
    }
    while(dt>0&&this.portal){
      const p=this.portal,step=Math.min(dt,p.duration-p.age);p.age+=step;dt-=step;
      const t=p.age/p.duration,s=t*t*(3-2*t),previousZ=this.z;
      const turnZ=CAT_PORT.walkZ-CAT_PORT.turnInset;
      if(p.phase==='enter')this.z=t===1?CAT_PORT.insideZ:turnZ+(CAT_PORT.insideZ-turnZ)*t;
      if(p.phase==='transit')this.y=FLOORS[p.from].y+(FLOORS[p.to].y-FLOORS[p.from].y)*s;
      if(p.phase==='exit')this.z=CAT_PORT.insideZ+(turnZ-CAT_PORT.insideZ)*t;
      // Step inward while turning; the nose/tail never swing into the front wall.
      if(p.phase==='turnIn'||p.phase==='turnOut')this.z=CAT_PORT.walkZ-CAT_PORT.turnInset*Math.abs(Math.cos(this.passagePose.yaw));
      if(p.phase!=='transit')this.portalWalkDistance+=Math.abs(this.z-previousZ);
      // Navigation owns the same heading as the rendered passage. In particular
      // the final turn-out frame must survive removal of the portal object.
      this.heading=this.passagePose.yaw;
      if(p.age<p.duration)break;
      p.age=0;
      if(p.phase==='turnIn'){p.phase='open';p.duration=CAT_PORT.doorSeconds;return;}
      else if(p.phase==='open'){p.phase='enter';p.duration=this.passageWalkSeconds;return;}
      else if(p.phase==='enter'){p.phase='close';p.duration=CAT_PORT.doorSeconds;}
      else if(p.phase==='close'){p.phase='transit';p.duration=1.6+Math.abs(p.to-p.from)*1.5;}
      else if(p.phase==='transit'){this.floor=p.to;this.y=FLOORS[p.to].y;p.phase='reopen';p.duration=CAT_PORT.doorSeconds;}
      else if(p.phase==='reopen'){p.phase='exit';p.duration=this.passageWalkSeconds;return;}
      else if(p.phase==='exit'){p.phase='shut';p.duration=CAT_PORT.doorSeconds;}
      else if(p.phase==='shut'){p.phase='turnOut';p.duration=4;this.facing=Math.sign(this.destination.x-CAT_PORT.x)||1;}
      else{this.portal=null;this.z=CAT_PORT.walkZ;this.plan();}
    }
  }
  get passagePose(){
    const p=this.portal;if(!p)return null;
    const t=p.age/p.duration,s=t*t*(3-2*t);
    const yaw=this.turnPose?.yaw??(p.phase==='turnIn'?p.yaw+Math.atan2(Math.sin(Math.PI-p.yaw),Math.cos(Math.PI-p.yaw))*s:['open','enter','close'].includes(p.phase)?Math.PI:p.phase==='turnOut'?this.facing*Math.PI/2*s:0);
    // Walk upright across the cabin and only duck at the low duct opening.
    const nearMouth=Math.max(0,Math.min(1,(CAT_PORT.wallZ+.9-this.z)/.9));
    const crouch=nearMouth*nearMouth*(3-2*nearMouth);
    return{phase:p.phase,yaw,crouch};
  }
}

export class Supplies {
  constructor(){
    this.capacity={food:3,water:4,catfood:3};this.supplies={...this.capacity};
    this.delivery=null;this.deliveryCount=0;this.lastDelivery=null;this.onPhase=null;this.onDeliver=null;
    this.catBowl=0;
  }
  has(type){return type==='music'||this.supplies[type]>0;}
  take(type){if(type==='music')return true;if(!this.has(type))return false;this.supplies[type]--;if(type==='food')this.preparedMeals=0;return true;}
  fillCatBowl(){if(this.catBowl>0||!this.take('catfood'))return false;this.catBowl=1;return true;}
  eatCatFood(){if(this.catBowl>0){this.catBowl--;return true;}return this.take('catfood');}
  get depleted(){return Object.keys(this.capacity).some(type=>!this.has(type));}
  get needsDelivery(){return Object.keys(this.capacity).some(type=>this.supplies[type]<this.capacity[type]);}
  get phase(){return this.delivery?.phase||'idle';}
  request(){if(this.delivery||!this.needsDelivery)return false;this.delivery={id:++this.deliveryCount,phase:'queued',age:0};this.onPhase?.('queued');return true;}
  cancel(){if(!['queued','transmitting'].includes(this.phase))return false;this.delivery=null;this.onPhase?.('cancelled');return true;}
  transmit(){if(this.phase!=='queued')return false;this.setPhase('transmitting');return true;}
  setPhase(phase){this.delivery.phase=phase;this.delivery.age=0;this.onPhase?.(phase);}
  update(dt){
    if(!this.delivery||this.phase==='queued')return;
    const durations={transmitting:3,inbound:12,unloading:4};
    // Carry surplus time across stages so pausing/frame rate cannot change the order.
    while(dt>0&&this.delivery){
      const stage=this.delivery,step=Math.min(dt,durations[stage.phase]-stage.age);
      stage.age+=step;dt-=step;
      if(stage.phase==='unloading'&&stage.age>=2.1&&!stage.received){
        stage.received=true;this.supplies={...this.capacity};this.lastDelivery=stage.id;this.onDeliver?.();
      }
      if(stage.age<durations[stage.phase])break;
      if(stage.phase==='transmitting')this.setPhase('inbound');
      else if(stage.phase==='inbound')this.setPhase('unloading');
      else{this.delivery=null;this.onPhase?.('complete');}
    }
  }
}

export class CatRoutine {
  constructor(care,{random=Math.random,turns=false,mouseChase=false}={}){
    this.care=care;this.random=random;this.motion=new CatMotion({turns});
    // The cabin clears this until Lucy's grooming surface correction has loaded.
    this.groomAvailable=true;
    this.hunger=this.between(48,90);this.energy=this.between(35,80);this.groomNeed=this.between(20,80);this.curiosity=this.between(30,90);
    this.rest('sleep',this.between(8,16));this.companion=null;this.followLeft=0;this.retargetIn=0;
    this.bunkWake=null;
    this.mouseChase=mouseChase?new CabinMouseChase({random}):null;
  }
  beginBunkWake(visit){
    this.mouseChase?.cancel(this);
    this.energy=100; // Lucy shares the same rested opening as Milo.
    const bunk=getStation('bunk');
    this.motion.floor=bunk.floor;this.motion.x=bunk.x+24;this.motion.y=FLOORS[bunk.floor].y;
    this.motion.queue=[];this.motion.onArrive=null;this.motion.destination=null;this.motion.onDestination=null;
    this.motion.portal=null;this.motion.hop=null;this.motion.turn=null;delete this.motion.pendingHeading;this.motion.onSofa=false;this.motion.elevation=0;this.motion.z=CAT_PORT.walkZ;
    this.mode='sleep';this.modeTime=4;this.remaining=100;this.pendingMove=null;this.playHost=null;this.playRelease=null;
    this.restYaw=-Math.PI/2;this.motion.heading=this.restYaw;this.bunkWake={visit};
  }
  finishBunkWake(){
    if(!this.bunkWake)return;
    this.bunkWake=null;this.motion.facing=1;
    this.mode='walk';this.modeTime=0;this.remaining=0;this.restYaw=null;this.pendingMove=null;
    this.motion.walkSpeed=CAT_WALK_SPEED;
    // Leave along the front aisle while Milo is still getting out of bed.
    // Preserve the landing heading: normal stepping turns handle the departure.
    this.motion.goTo({floor:CAT_SOFA.floor,x:CAT_SOFA.floorX},()=>this.rest('look',this.between(3,6)));
    this.motion.face(Math.PI/2);
  }
  get bunkHop(){
    const visit=this.bunkWake?.visit;if(!visit)return null;
    const prepareAt=BUNK_PHASE_SECONDS.waking-CAT_WAKE_PREP_SECONDS;
    if(visit.phase==='waking'&&visit.age>=prepareAt)return{up:false,phase:'prepare',age:visit.age-prepareAt,duration:CAT_WAKE_PREP_SECONDS,yaw:0};
    if(visit.phase==='leaving')return{up:false,phase:'flight',age:visit.age,duration:BUNK_PHASE_SECONDS.leaving,yaw:0};
    if(visit.phase==='rising'&&visit.age<CAT_WAKE_LAND_SECONDS)return{up:false,phase:'land',age:visit.age,duration:CAT_WAKE_LAND_SECONDS,yaw:0};
    return null;
  }
  between(min,max){return min+(max-min)*this.random();}
  get poseYaw(){return this.motion.turns?(this.motion.turnPose?.yaw??this.motion.heading):!this.motion.busy&&CAT_FREE_REST_MODES.has(this.mode)?this.restYaw:this.motion.laneYaw;}
  canPlayLounge(){return !this.mouseChase?.controlled&&this.motion.floor===CAT_SOFA.floor&&!this.motion.portal&&!this.motion.hop&&this.hunger>35&&this.energy>25&&this.mode!=='fetch'&&!this.pendingMove&&Math.abs(this.motion.x-CAT_SOFA.seatX)<220;}
  inviteLounge(brain){
    this.playHost=brain;
    this.depart(()=>{
      if(this.playHost!==brain||!brain.isSeatedInLounge()||brain.leisure!=='cat')return;
      this.mode='joinPlay';this.modeTime=0;
      this.motion.goTo({floor:CAT_SOFA.floor,x:CAT_SOFA.seatX},()=>{
        if(this.playHost===brain&&brain.isSeatedInLounge()&&brain.leisure==='cat'){this.motion.facing=1;this.rest('play',40);}
        else this.rest('look',6);
      });
    },'play');
  }
  rest(mode,duration){
    if(APPROVED_RESTS[mode])duration=mode==='stretch'?8:Math.max(12,duration);
    this.mode=mode;this.modeTime=0;this.remaining=duration;this.motion.walkSpeed=CAT_WALK_SPEED;this.pendingMove=null;
    this.restYaw=null;
    if(CAT_FREE_REST_MODES.has(mode)){
      // Choose once on entry, not while resting. Navigation and bowl-facing stay separate.
      const choices=CAT_REST_YAWS.filter(yaw=>yaw!==this.lastRestYaw);
      this.restYaw=choices[Math.floor(this.random()*choices.length)];this.lastRestYaw=this.restYaw;
    }
    this.motion.face(this.restYaw??this.motion.facing*Math.PI/2);
  }
  depart(run,kind){
    if(kind!=='mouse')this.mouseChase?.cancel(this);
    if(this.mode==='play'&&!this.motion.busy){this.pendingMove={run,kind};this.playHost=null;this.playRelease??={age:0};return;}
    if(!this.motion.busy&&APPROVED_RESTS[this.mode]&&this.remaining>0){
      this.pendingMove={run,kind};this.remaining=Math.min(this.remaining,approvedRestRelease(this.mode,this.modeTime));return;
    }
    if(!this.motion.busy&&['sleep','look','eat','groom'].includes(this.mode)&&this.remaining>0){
      this.pendingMove={run,kind};this.remaining=Math.min(this.remaining,CAT_RISE_TIME);return;
    }
    run();
  }
  canFollow(){
    const actor=this.companion;
    return actor?.busy&&!actor.climbing&&!actor.waitingForHatch&&actor.floor===this.motion.floor&&!this.motion.onSofa&&!this.motion.portal&&!this.motion.hop&&(actor.x-this.motion.x)*actor.facing>40;
  }
  follow(){
    this.depart(()=>{if(!this.canFollow()){this.rest('look',6);return;}this.mode='follow';this.modeTime=0;this.followLeft=this.between(8,18);this.retargetIn=0;},'follow');
  }
  endFollow(){this.motion.goTo({floor:this.motion.floor,x:this.motion.x});this.rest('look',this.between(5,9));}
  choose(){
    // Fulfil actual needs, but sample their weights instead of repeating a fixed tour.
    const choices=[['fetch',(this.care.catBowl>0||this.care.has('catfood'))&&this.hunger<70?(100-this.hunger)**2/100:0],['sleep',1+(100-this.energy)**2/100],['groom',this.groomAvailable?1+this.groomNeed**2/100:0],['look',12+this.curiosity*.15],['stretch',8],['prone',10],['follow',this.canFollow()?18:0],['walk',5+this.curiosity**2/100]];
    let draw=this.random()*choices.reduce((sum,[,weight])=>sum+weight,0),mode='walk';
    for(const [candidate,weight]of choices){draw-=weight;if(draw<0){mode=candidate;break;}}
    if(mode==='fetch'){this.fetch();return;}
    if(mode==='follow'){this.follow();return;}
    if(mode!=='walk'){this.rest(mode,this.between(mode==='sleep'?12:6,mode==='sleep'?25:13));return;}
    const places=[{floor:CAT_SOFA.floor,x:840},{floor:getStation('medical').floor,x:940},{floor:2,x:1155},{floor:getStation('console').floor,x:510},{floor:CAT_SOFA.floor,x:1060}].filter(place=>place.floor!==this.motion.floor||Math.abs(place.x-this.motion.x)>40);
    const target=places[Math.floor(this.random()*places.length)];
    this.depart(()=>{this.mode='walk';this.modeTime=0;
      this.motion.goTo(target,()=>{const rest=this.random()<.35?'look':this.random()<(100-this.energy)/(100-this.energy+this.groomNeed+1)?'sleep':this.groomAvailable?'groom':'look';this.rest(rest,this.between(7,18));});
    },'walk');
  }
  update(dt,actor=null,droid=null){
    if(dt<=0)return;
    this.companion=actor;
    const chasing=this.mouseChase?.update(dt,this);
    if(this.waitForDroidFood&&!this.care.catBowlFilling){this.waitForDroidFood=false;this.fetch();}
    const wake=this.bunkWake?.visit;
    if(wake&&((wake.phase==='rising'&&wake.age>=CAT_WAKE_LAND_SECONDS)||['seated','standing','retracting','sealing','departing','done'].includes(wake.phase)))this.finishBunkWake();
    if(this.bunkWake){
      const {visit}=this.bunkWake;
      if(visit.phase==='sleeping'){this.mode='sleep';this.modeTime+=dt;this.remaining=100;}
      else if(visit.phase==='waking'){
        // Rise first, then plant the paws and face the landing before jumping.
        this.mode='sleep';this.modeTime+=dt;this.remaining=Math.max(0,CAT_RISE_TIME-visit.age);
        if(visit.age>=CAT_RISE_TIME){
          const turn=this.bunkWake.turn??=createCatTurn(this.motion.heading,0,{duration:BUNK_PHASE_SECONDS.waking-CAT_RISE_TIME-CAT_WAKE_PREP_SECONDS});
          turn.age=Math.min(turn.duration,visit.age-CAT_RISE_TIME);
          this.motion.heading=sampleCatTurn(turn).yaw;
          this.motion.turn=turn.age<turn.duration?turn:null;
        }
      }else{this.mode='idle';this.modeTime=0;this.remaining=100;this.motion.turn=null;this.motion.heading=0;}
      return;
    }
    const bounded=value=>Math.max(0,Math.min(100,value)),resting=!this.motion.busy;
    if(!this.motion.turnPose)this.modeTime+=dt;this.hunger=bounded(this.hunger-dt*.36*CABIN_PACE.catDecay);
    this.energy=bounded(this.energy+dt*(resting&&this.mode==='sleep'?3:-.25*CABIN_PACE.catDecay));
    this.groomNeed=bounded(this.groomNeed+dt*(resting&&this.mode==='groom'?-4:.22*CABIN_PACE.catDecay));
    this.curiosity=bounded(this.curiosity+dt*(this.motion.busy?-.8:.3));
    if(chasing)return;
    const hostSeated=this.playHost?.isSeatedInLounge()&&this.playHost.leisure==='cat';
    if(this.playHost&&!hostSeated&&this.mode!=='play'){
      this.playHost=null;
      if(this.pendingMove?.kind==='play')this.pendingMove=null;
      if(this.mode==='joinPlay'){
        this.mode='walk';this.modeTime=0;
        this.motion.goTo({floor:this.motion.floor,x:CAT_SOFA.floorX},()=>this.rest('look',6));
      }
    }
    // A seated host is behind the walking lane and beside the sofa landing.
    // Keep normal crossing reservations for standing crew and the droid.
    const joiningSeatedHost=this.mode==='joinPlay'&&hostSeated&&this.playHost.actor===actor;
    this.motion.update(dt,joiningSeatedHost?null:actor,droid);
    if(this.motion.portal)this.motion.heading=this.motion.passagePose.yaw;
    if(this.motion.turn)return;
    if((actor?.waitingForCat||droid?.waitingForCat)&&!this.motion.busy&&!this.motion.onSofa&&this.motion.z!==CAT_PORT.walkZ&&!this.pendingMove){
      this.depart(()=>{this.mode='walk';this.modeTime=0;this.motion.goTo({floor:this.motion.floor,x:this.motion.x},()=>this.rest('look',5));},'yield');
    }
    if(this.mode==='play'){
      if(this.playRelease){
        this.playRelease.age=Math.min(1.2,this.playRelease.age+dt);
        if(this.playRelease.age===1.2){this.playRelease=null;this.mode='look';this.modeTime=Math.min(this.modeTime,1.5);this.remaining=this.pendingMove?CAT_RISE_TIME:5;}
        return;
      }
      if(this.playHost?.isSeatedInLounge()&&this.playHost.leisure==='cat'&&this.hunger>25){this.remaining=5;this.curiosity=bounded(this.curiosity-dt*2);return;}
      this.playHost=null;this.playRelease={age:0};return;
    }
    if(this.mode==='follow'){
      this.followLeft-=dt;this.retargetIn-=dt;
      if(!actor?.busy||actor.climbing||actor.waitingForHatch||actor.floor!==this.motion.floor||this.followLeft<=0||this.hunger<25||(actor.x-this.motion.x)*actor.facing<25){this.endFollow();return;}
      this.motion.walkSpeed=Math.min(CAT_WALK_SPEED*1.6,actor.walkSpeed*1.12);
      if(this.retargetIn<=0){
        const x=Math.max(170,Math.min(this.motion.floor===CAT_SOFA.floor?CAT_SOFA.floorX:1220,actor.x-actor.facing*48));
        if(Math.abs(x-this.motion.x)>12)this.motion.goTo({floor:actor.floor,x});
        this.retargetIn=.6;
      }
      return;
    }
    if(this.mode==='fetch'||this.motion.busy)return;
    if(this.pendingMove){this.remaining-=dt;if(this.remaining<=0){const {run}=this.pendingMove;this.pendingMove=null;run();}return;}
    if(this.hunger<25&&(this.care.catBowl>0||this.care.has('catfood'))){this.fetch();return;}
    this.remaining-=dt;if(this.remaining>0)return;
    if(this.mode==='eat')this.groomNeed=Math.min(100,this.groomNeed+25);
    this.choose();
  }
  fetch(){if(this.care.catBowlFilling){this.waitForDroidFood=true;return;}if(this.mode==='fetch'||this.pendingMove?.kind==='fetch')return;this.depart(()=>{this.mode='fetch';this.modeTime=0;this.motion.walkSpeed=CAT_WALK_SPEED;this.motion.goTo({floor:CAT_BOWL.floor,x:CAT_BOWL.approachX,z:CAT_BOWL.depth},()=>{if(this.care.eatCatFood()){this.motion.facing=-1;this.hunger=100;this.rest('eat',8);}else this.rest(this.groomAvailable?'groom':'look',4);});},'fetch');}
}

export function currentAction(brain){return brain.bathroom?.id??brain.reclineExit?.id??(brain.hatchRepair?brain.cur?.id:brain.smokingVisit?(brain.smokingVisit.seated?'lounge':'smoking'):brain.bunkVisit?'bunk':brain.gymVisit?'gym':brain.loungeEntry||brain.loungeStow||brain.loungeExit||brain.state==='playingGame'?'lounge':['reading','orderingSupply'].includes(brain.state)?'console':brain.state==='performing'?brain.cur?.id:null);}
export {FLOORS,getStation};
