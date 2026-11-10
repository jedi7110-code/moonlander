// Shared traffic on the left stair tower.
//
// Walkers (crew, droid, cat, visitor) register while they follow a stair
// trip (stair-trip.js). Each step they ask how far they may advance: a
// walker keeps its distance behind anyone in front of it in its own lane;
// opposite traffic keeps right on the separate lane and passes. Where the
// tower meets a deck, one kind of stream (entering, leaving, passing) crosses
// at a time; if two walkers still hold each other, the walker that entered
// first goes on once the other has stopped.
//
// Before a walker starts a trip it asks whether the stairs are usable. They
// are not when someone stands at its entrance, when two others already walk
// the same way on its part of the stairs, or when someone has been stopped
// on its path for a while. A walker that waits at its entrance for
// STAIR_TRAFFIC.stuck seconds gives up, avoids the stairs for a while and
// takes the central ladder instead (the cat takes its wall passage).
//
// The cabin also tells the stairs where everybody is (`bodies`), so that
// trips and people who are not on a trip keep off each other: the robot at
// work next to an entrance, someone crossing a trip on the way to a station.
// - Someone standing where a trip starts makes the stairs crowded.
// - A walker on a trip does not step closer than STAIR_TRAFFIC.body.space
//   to such a bystander (for at most `limit` seconds: standing work can
//   take longer than anyone should wait).
// - A bystander does not walk closer than `giveWay` to a walker on a trip,
//   nor closer than `clear` to the stretch of the trip just ahead of it
//   (blocksBystander, asked by the cabin's own walking). Where two paths
//   cross, the bystander therefore stops short and the walker on the trip
//   goes by without stopping.
import {nearestStairTrip} from './stair-trip.js';

export const STAIR_TRAFFIC=Object.freeze({
  clearance:{default:1.0,cat:.7}, // distance kept behind the walker in front (m)
  width:.42,          // lateral distance below which two walkers share a lane
  height:1.2,         // vertical distance beyond which walkers are on other flights
  entrance:1.5,       // someone this close to an entrance makes the stairs crowded
  sameWay:2,          // this many others on the same stretch, same direction: crowded
  stopped:1.5,        // someone stopped this long on the path makes it crowded (s)
  stuck:2.5,          // waiting this long at the entrance: take the ladder (s)
  turnBack:1.0,       // ... while no further than this into the trip (m)
  patience:20,        // a walker that has stood this long goes on whatever is in the way (s)
  yieldAfter:.5,      // a walker stopped this long lets earlier walkers pass (s)
  crossing:3,         // wait this long outside a deck crossing used by another stream (s)
  crossingLimit:8,    // ... and no longer than this, whoever is in it (s)
  // people who are not on a trip (m, s); a trip is crowded when someone is within `start` of its first `reach` metres
  body:{space:.5,giveWay:.8,brush:.4,clear:.62,path:2.5,cat:.38,start:.6,reach:2.6,limit:10},
  avoid:12,           // then keep off the stairs for this long (s)
});

const T=STAIR_TRAFFIC;
// Where the tower meets each deck, paths cross: walkers entering the stairs
// from the aisle, walkers leaving them for the aisle and (on the middle deck)
// walkers passing between the outer decks. One kind of stream uses a deck's
// crossing at a time; walkers of the same kind follow each other in file.
const DECKS=[[0,6.784],[1,3.392],[2,0]];
// (the crossing of a deck at either tower: `${side}:${deck}`, side -1 left, 1 right)
const crossingDeck=p=>{const x=Math.abs(p.x),side=Math.sign(p.x);if(x<11.6||x>13.45)return null;for(const [deck,y] of DECKS)if(Math.abs(p.y-y)<.06)return `${side}:${deck}`;return null;};
const role=(trip,crossing)=>{const deck=+crossing.split(':')[1];return trip.fromFloor===deck?'enter':trip.toFloor===deck?'exit':`through${trip.direction}`;};
// both trips by the same tower (their route distances are comparable)
const sameTower=(a,b)=>(a.side??-1)===(b.side??-1);
const near=(a,b,r)=>Math.abs(a.y-b.y)<T.height&&Math.hypot(a.x-b.x,a.z-b.z)<r;
const routeSpan=trip=>{const a=trip.routeS(trip.enterLength),b=trip.routeS(trip.exitStart);return [Math.min(a,b),Math.max(a,b)];};

export class CabinStairs {
  // `right`: the cabin also has the right stair tower (LEVEL 3 <-> LEVEL 2).
  constructor({right=false}={}){this.walkers=new Map();this.time=0;this.order=0;this.avoid=new Map();this.bodies=null;this.gaveWay=new Map();this.right=right;}
  // The trip between two floors for a walk from x `fromX` to x `toX` (world
  // metres): by the nearer tower that serves both floors.
  trip(fromFloor,toFloor,fromX,toX,options={}){return nearestStairTrip(fromFloor,toFloor,fromX,toX,{right:this.right,...options});}
  // everybody the cabin reports who is not on a stair trip (and is not `agent`)
  bystanders(agent){return this.bodies?this.bodies().filter(b=>b.agent!==agent&&!this.walkers.has(b.agent)):[];}
  // May someone who is not on a trip walk from `from` to `to` this step? Not
  // when that brings them closer than T.body.giveWay to a walker on a trip,
  // or closer than T.body.clear to the next T.body.path metres of its way
  // (so the walker's way stays open and it need not stop for them). A walker
  // that has itself stopped for a bystander is only kept at T.body.space.
  // Nobody gives way for more than T.body.limit seconds in a row.
  blocksBystander(agent,from,to,dt,small=false){
    let held=false;
    if(!this.walkers.has(agent)){
      const shrink=small?T.body.space-T.body.cat:0;
      const gaps=p=>Math.abs(p.y-to.y)>T.height?null:[Math.hypot(from.x-p.x,from.z-p.z),Math.hypot(to.x-p.x,to.z-p.z)];
      for(const w of this.walkers.values()){
        const g=gaps(this.position(w));if(!g)continue;
        // its way ahead: someone already in it walks on to get out of it, someone outside stays out
        let before=Infinity,after=Infinity;
        for(let d=.1;d<=T.body.path;d+=.1){const a=gaps(w.trip.frame(w.t+d));if(a){before=Math.min(before,a[0]);after=Math.min(after,a[1]);}}
        const inWay=before<T.body.clear-shrink,stopped=(w.bodyWait??0)>T.yieldAfter;
        if(!inWay&&!stopped&&after<T.body.clear-shrink)held=true;
        // the walker itself: at giveWay; at arm's length when it has stopped for a bystander; and someone
        // clearing its way may brush past (the walker waits for them at arm's length meanwhile)
        const r=(inWay?T.body.brush:stopped?T.body.space:T.body.giveWay)-shrink;
        if(g[1]<r&&g[1]<g[0]-1e-9)held=true;
      }
    }
    // (a count that was not asked about for a while starts again)
    const last=this.gaveWay.get(agent),waited=held?(last&&this.time-last.at<.25?last.waited:0)+dt:0;
    if(held)this.gaveWay.set(agent,{waited,at:this.time});else this.gaveWay.delete(agent);
    return held&&waited<T.body.limit;
  }
  // Is someone who is not on a trip standing where `trip` starts?
  blockedAtStart(agent,trip){
    const others=this.bystanders(agent);
    if(others.length)for(let t=0;t<=T.body.reach;t+=.2){const q=trip.frame(t);if(others.some(b=>near(b,q,T.body.start)))return true;}
    return false;
  }
  update(dt){
    this.time+=dt;
    // Forget a walker whose own plan no longer has it on the stairs (e.g. a
    // scripted wake-up that clears the crew queue).
    for(const [agent] of this.walkers)if(agent.onStairTrip&&!agent.onStairTrip())this.walkers.delete(agent);
  }
  get count(){return this.walkers.size;}
  walker(agent){return this.walkers.get(agent)??null;}
  position(walker){return walker.trip.frame(walker.t);}
  avoiding(agent){return (this.avoid.get(agent)??-Infinity)>this.time;}

  // May `agent` start `trip` now? (false: crowded or recently stuck)
  available(agent,trip){
    if(this.avoiding(agent))return false;
    const start=trip.frame(0),entry=trip.frame(trip.enterLength),[lo,hi]=routeSpan(trip);
    const samples=[];for(let t=0;t<=trip.length;t+=.5)samples.push(trip.frame(t));
    if(this.blockedAtStart(agent,trip))return false;
    let sameWay=0;
    for(const w of this.walkers.values()){
      if(w.agent===agent)continue;
      const p=this.position(w);
      if(near(p,start,T.entrance)||near(p,entry,T.entrance))return false;
      const s=w.trip.routeS(w.t);
      if(sameTower(w.trip,trip)&&w.trip.direction===trip.direction&&s!==null&&s>=lo-1e-9&&s<=hi+1e-9)sameWay++;
      if(w.waiting>=T.stopped&&samples.some(q=>near(p,q,.6)))return false;
    }
    return sameWay<T.sameWay;
  }
  enter(agent,kind,trip,t=0){
    const walker={agent,kind,trip,t,waiting:0,order:this.order++};
    this.walkers.set(agent,walker);return walker;
  }
  leave(agent){this.walkers.delete(agent);}
  giveUp(agent){this.leave(agent);this.avoid.set(agent,this.time+T.avoid);}

  // Walkers in front of `walker` within its lane: [{other, gap}] (gap along
  // the walking direction, from the walker's next position).
  blockers(walker,want){
    const me=walker.trip.frame(walker.t+want),out=[];
    for(const other of this.walkers.values()){
      if(other===walker)continue;
      const p=this.position(other);if(Math.abs(p.y-me.y)>T.height)continue;
      const dx=p.x-me.x,dz=p.z-me.z,along=dx*me.dx+dz*me.dz,across=Math.abs(dx*me.dz-dz*me.dx);
      const clearance=walker.kind==='cat'||other.kind==='cat'?T.clearance.cat:T.clearance.default;
      // (on the stairs themselves the two directions keep to their own lanes)
      if(other.trip.direction!==walker.trip.direction&&other.trip.routeS(other.t)!==null&&Math.abs(p.y-me.y)>.05)continue;
      if(along>-.05&&along<clearance&&across<T.width)out.push({other,gap:along,clearance});
    }
    return out;
  }
  // Advance `agent` by up to `want` metres of travel; returns
  // {travel, waiting, stuck} where `stuck` asks the walker to take the ladder.
  advance(agent,want,dt){
    const walker=this.walkers.get(agent);if(!walker)return {travel:want,waiting:false,stuck:false};
    let travel=Math.max(0,want);
    // A walker that has stood T.patience seconds stops waiting for anyone, so
    // no ring of walkers holding each other can last.
    const impatient=walker.waiting>=T.patience;
    // Wait outside a deck's crossing while another kind of stream uses it.
    // After T.crossing seconds the walker goes on (and keeps going until it
    // is in the crossing) if those in it have stopped and it entered the
    // stairs before them; it gives way longer to walkers still moving and
    // to earlier ones, but never beyond T.crossingLimit.
    const here=crossingDeck(walker.trip.frame(walker.t)),ahead=crossingDeck(walker.trip.frame(walker.t+travel+.35));
    const using=ahead!==null&&here!==ahead?[...this.walkers.values()].filter(o=>
      o!==walker&&crossingDeck(this.position(o))===ahead&&role(o.trip,ahead)!==role(walker.trip,ahead)):[];
    if(!using.length||impatient)walker.crossingWait=0;
    else{
      const wait=walker.crossingWait??0,giveWay=using.some(o=>o.waiting<T.yieldAfter||o.order<walker.order);
      if(wait<T.crossing||(giveWay&&wait<T.crossingLimit)){travel=0;walker.crossingWait=wait+dt;}
    }
    for(const {other,gap,clearance} of this.blockers(walker,travel)){
      // Where paths cross on a landing two walkers may hold each other. A
      // walker that has already stopped yields to anyone who entered before
      // it: the earliest walker in any such ring goes on, so none can lock.
      // (not through someone who can still turn back at its entrance: it does so by itself)
      if(other.waiting>=T.yieldAfter&&other.order>walker.order&&other.t>=Math.min(other.trip.enterLength,T.turnBack))continue;
      // (nobody stands on the stairs for good: see T.patience)
      if(impatient)continue;
      travel=Math.min(travel,Math.max(0,travel-(clearance-gap)));
    }
    // Do not step closer to someone who is not on a trip.
    if(travel>0&&!impatient){
      const from=walker.trip.frame(walker.t),to=walker.trip.frame(walker.t+travel);let held=false;
      for(const b of this.bystanders(agent)){
        if(Math.abs(b.y-to.y)>T.height)continue;
        const r=b.small||walker.kind==='cat'?T.body.cat:T.body.space;
        const before=Math.hypot(from.x-b.x,from.z-b.z),after=Math.hypot(to.x-b.x,to.z-b.z);
        if(after<r&&after<before-1e-9)held=true;
      }
      // (a wait that ended while the walker stood for another reason starts again)
      const wait=held&&this.time-(walker.bodyAt??-1)<.25?walker.bodyWait??0:0;
      if(held){walker.bodyAt=this.time;walker.bodyWait=wait+dt;if(wait<T.body.limit)travel=0;}else walker.bodyWait=0;
    }
    walker.t+=travel;
    const waiting=travel<want*.3;
    walker.waiting=waiting?walker.waiting+dt:0;
    // only give up before reaching the stair itself; once on it, keep going
    // (and only near the aisle: further in, a walker that turned back would stand in the way of those coming out)
    const stuck=waiting&&walker.waiting>=T.stuck&&walker.t<Math.min(walker.trip.enterLength,T.turnBack);
    return {travel,waiting,stuck};
  }
}

// Positions of everybody in the cabin for CabinStairs.bodies (world metres).
// The robot on its charging dock is left out: the trips are laid out around it.
export function cabinBodies({actor,droid=null,catMotion=null,curtis=null,crewDepth=()=>.78}){
  return ()=>{
    const out=[{agent:actor,x:(actor.x-700)*.022,y:(870-actor.y)*.016,z:crewDepth(actor)}];
    if(droid&&!droid.docked)out.push({agent:droid,x:droid.position.x,y:droid.position.y,z:droid.position.z});
    if(catMotion&&!catMotion.hidden)out.push({agent:catMotion,small:true,x:(catMotion.x-700)*.022,y:(870-catMotion.y)*.016+(catMotion.elevation??0),z:catMotion.z});
    if(curtis?.active){const p=curtis.trafficPosition;out.push({agent:curtis,x:p.x,y:p.y,z:p.z});}
    return out;
  };
}
