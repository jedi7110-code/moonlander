import {worldActor,worldCat,close,approaches,nextActor,nextDroid,CREW_CLEARANCE,CAT_CLEARANCE} from './curtis-traffic.js';
import {CABIN_FLOOR_Y as FLOORS,CABIN_AISLE,LOUNGE_TABLE,ladderApproachDepth} from './layout.js';
import {crewWalkway} from './cabin-walkway.js';
import {crewLadderPath,ladderPathsConflict} from './ladder-traffic.js';
import {CREW_WALK_SPEED} from './pace.js';
import {CURTIS_COFFEE} from './curtis-coffee.js';

export const CURTIS_TIMING={first:[90,150],between:[180,360],prepareAhead:35};
export const CURTIS_WALK_SPEED=CREW_WALK_SPEED*.022;
export const CURTIS={top:13.4,seatX:6.05,coffeeX:10.085,roomX:-1.88,roomZ:-4.37};
export const CURTIS_LADDER_TRAFFIC=Object.freeze({waitX:2.2,crewWaitX:2.85,clearX:2.1,mergeX:1.75,bridgeX:.85,passZ:2.18});
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
  constructor({random=Math.random,prepare=async()=>{},firstDelay}={}){
    this.random=random;this.prepare=prepare;this.time=0;this.due=firstDelay??this.range(CURTIS_TIMING.first);
    this.ready=false;this.loading=false;this.disposed=false;this.active=false;this.visits=0;
    this.steps=[];this.age=0;this.walkDistance=0;this.position={x:0,y:CURTIS.top,z:ladderApproachDepth(0)};
    this.yaw=Math.PI;this.waiting=false;this.ladderClaim=false;this.error=null;
  }
  range([a,b]){return a+(b-a)*this.random();}
  get step(){return this.steps[0]??null;}
  get ladderPath(){return this.ladderClaim?{from:this.position.y,to:this.claimEnd}:null;}
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
    this.aisleTo(0,1);this.climbTo(0);this.aisleTo(CURTIS.roomX,0);
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
    if(m.hop?.phase==='prepare'&&!m.hop.started&&close(p,this.trafficPosition,1.4))return true;
    if(m.crossing&&!m.crossing.active&&Math.abs(p.y-this.position.y)<.8&&Math.abs(p.x-this.position.x)<CAT_CLEARANCE+.06)return true;
    return approaches(p,next,this.trafficPosition,CAT_CLEARANCE);
  }
  blocksCrew(actor,dt=1/60){
    if(this.active&&actor){
      const from=worldActor(actor),to=nextActor(actor,dt);
      // Hold Milo outside the sofa approach until Curtis has stood and cleared it.
      if(this.floor===1&&['sit','relax','stand'].includes(this.step?.kind)&&actor.floor===1&&
          Math.abs(to.x-CURTIS.seatX)<1.5&&Math.abs(to.x-CURTIS.seatX)<Math.abs(from.x-CURTIS.seatX))return true;
      if(approaches(from,to,this.passageObstacle(from,CREW_CLEARANCE),CREW_CLEARANCE))return true;
    }
    if(!this.ladderClaim||!ladderPathsConflict(this.ladderPath,crewLadderPath(actor)))return false;
    if(actor.climbing)return true;
    const walk=actor.queue?.[0];if(walk?.type!=='walk')return false;
    const from=(actor.x-700)*.022,to=(walk.x-700)*.022;
    if(from*to>0&&Math.abs(to)>=Math.abs(from))return false;
    if(from*to>0&&Math.abs(to)>CURTIS_LADDER_TRAFFIC.crewWaitX)return false;
    return Math.max(0,Math.abs(from)-actor.walkSpeed*.022*dt)<=CURTIS_LADDER_TRAFFIC.crewWaitX;
  }
  update(dt,{actor=null,droid=null,cat=null,brain=null}={}){
    if(dt<=0||this.disposed)return;
    this.time+=dt;
    if(!this.active){
      if(this.time>=this.due-CURTIS_TIMING.prepareAhead)this.load();
      if(!this.ready||this.time<this.due)return;
      this.beginVisit();
    }
    const s=this.step;if(!s)return;
    this.waiting=false;
    const obstacles=[];
    if(actor){
      const position=worldActor(actor);
      if(brain&&(brain.loungeEntry||brain.loungeExit||brain.loungeStow||brain.actStation==='lounge')&&!actor.busy){position.x=CURTIS.seatX;position.z=.06;}
      obstacles.push({p:position,r:CREW_CLEARANCE});
    }
    if(droid?.position)obstacles.push({p:droid.position,r:.64});
    if(cat?.motion&&!cat.motion.hidden)obstacles.push({p:worldCat(cat.motion),r:CAT_CLEARANCE});
    const path=this.approachingLadderPath;
    // Walking through the rear-room doorway does not enter the ladder shaft.
    const approaching=s.kind==='walk'&&Math.abs(this.position.x)<=CURTIS_LADDER_TRAFFIC.waitX&&Math.abs(s.to.x)<Math.abs(this.position.x)-1e-8;
    const entering=s.kind==='climb'||approaching;
    if(path&&entering&&!this.ladderClaim){
      const crewNear=actor&&(actor.climbing||Math.abs((actor.x-700)*.022)<1.5);
      const droidAtLanding=droid?.position&&Math.abs(droid.position.y-this.position.y)<1.4&&
        Math.abs(droid.position.x)<CURTIS_LADDER_TRAFFIC.clearX;
      if((crewNear&&ladderPathsConflict(path,crewLadderPath(actor)))||
          (droid?.ladderClaim&&ladderPathsConflict(path,droid.ladderPath))||droidAtLanding){
        this.waiting=true;
        if(Math.abs(this.position.x)>CURTIS_LADDER_TRAFFIC.bridgeX){
          const position=this.trafficPosition,shift=Math.max(0,Math.min(CURTIS_LADDER_TRAFFIC.passZ-position.z,dt*.85));
          const next={...position,z:position.z+shift};
          if(shift>0&&!obstacles.some(obstacle=>approaches(position,next,obstacle.p,obstacle.r))){
            this.passOffset=(this.passOffset??0)+shift;this.walkDistance+=shift;this.yaw=0;this.waiting=false;
          }else if(shift>0&&s.kind==='walk'&&this.floor===0&&(s.roomDeparture||Math.abs(s.from.x-CURTIS.roomX)<1e-8)&&Math.abs(position.x)<CURTIS_LADDER_TRAFFIC.crewWaitX){
            // If the exiting droid occupies the side-step, back away from the
            // landing first. Every step still obeys the normal body clearance.
            const retreat={...position,x:position.x+Math.sign(position.x)*dt*.85};
            if(!obstacles.some(obstacle=>approaches(position,retreat,obstacle.p,obstacle.r+.06))){
              this.position={...retreat};this.passOffset=0;s.from={...retreat};s.roomDeparture=true;this.age=0;
              s.duration=Math.max(.01,distance(s.from,s.to)/CURTIS_WALK_SPEED);
              this.walkDistance+=dt*.85;this.yaw=Math.sign(position.x)*Math.PI/2;this.waiting=false;
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
      const near=(x,y,z,r)=>Math.abs(y-this.position.y)<1&&Math.hypot(x-this.position.x,z-this.position.z)<r;
      const cm=cat?.motion;
      // Only wait for crossings already in progress, so the other actor can finish.
      if(cm?.crossing?.active){
        const p=this.trafficPosition,u=Math.min(1,(this.age+dt)/s.duration);
        const next={x:s.from.x+(s.to.x-s.from.x)*u,y:s.from.y+(s.to.y-s.from.y)*u,z:s.from.z+(s.to.z-s.from.z)*u+(this.passOffset??0)};
        const crossing={x:(cm.x-700)*.022,y:(870-cm.y)*.016,z:p.z};
        if(approaches(p,next,crossing,CAT_CLEARANCE+.12)||near(crossing.x,crossing.y,cm.z,.65)){
          this.waiting=true;return;
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
      this.waiting=true;return;
    }
    if(s.kind==='walk'){
      // Leave the temporary passing lane through a real depth walk. Carrying
      // its offset into the room made the visible and authored paths disagree.
      if(!s.depthTransfer&&Math.abs(s.to.x-s.from.x)<1e-8&&Math.abs(s.to.z-s.from.z)>.1){
        s.depthTransfer=true;s.from={...this.trafficPosition};this.position={...s.from};this.passOffset=0;
        s.duration=Math.max(.01,distance(s.from,s.to)/CURTIS_WALK_SPEED);this.age=0;
      }
      const p=this.trafficPosition;
      const onAisle=Math.abs(this.position.x)>CURTIS_LADDER_TRAFFIC.mergeX&&s.from.z>=.65&&s.to.z>=.65;
      const leavingBridge=this.ladderClaim&&Math.abs(this.position.x)>CURTIS_LADDER_TRAFFIC.bridgeX&&s.from.z>=.2&&s.to.z>=.2;
      const aisle=onAisle||leavingBridge;
      let offset=0;
      if(aisle){
        const nearby=obstacles.filter(o=>Math.abs(o.p.y-p.y)<1.4&&Math.abs(o.p.x-p.x)<2.2);
        const laneFree=z=>nearby.every(o=>!close({...p,z},o.p,o.r+(o.r===CREW_CLEARANCE?.08:.03)));
        const current=this.position.z+(this.passOffset??0);
        if(!laneFree(this.position.z))offset=CURTIS_LADDER_TRAFFIC.passZ-this.position.z;
        else if(nearby.length&&laneFree(current))offset=Math.min(this.passOffset??0,Math.max(0,CURTIS_LADDER_TRAFFIC.passZ-this.position.z));
      }
      if(this.ladderClaim&&Math.abs(this.position.x)<CURTIS_LADDER_TRAFFIC.mergeX&&Math.abs(s.to.x)<Math.abs(this.position.x))offset=0;
      const shift=Math.sign(offset-(this.passOffset??0))*Math.min(Math.abs(offset-(this.passOffset??0)),dt*.85);
      const lateral={...p,z:p.z+shift};
      const movingAside=Math.abs(shift)>1e-8&&!obstacles.some(o=>approaches(p,lateral,o.p,o.r));
      if(movingAside){this.passOffset=(this.passOffset??0)+shift;this.walkDistance+=Math.abs(shift);}
      const u=Math.min(1,(this.age+dt)/s.duration);
      const next={x:s.from.x+(s.to.x-s.from.x)*u,y:s.from.y+(s.to.y-s.from.y)*u,z:s.from.z+(s.to.z-s.from.z)*u+(this.passOffset??0)};
      const needsBridge=Math.abs(next.x)<=CURTIS_LADDER_TRAFFIC.bridgeX&&Math.abs(this.passOffset??0)>.02;
      if(needsBridge||obstacles.some(o=>approaches(this.trafficPosition,next,o.p,o.r+.06))){
        this.waiting=!movingAside;if(movingAside)this.yaw=shift>0?0:Math.PI;return;
      }
    }
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
