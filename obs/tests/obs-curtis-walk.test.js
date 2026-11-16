// Curtis's planned walk (curtis-routine.js, CURTIS_GAIT): as Milo, he walks from standing to
// standing, comes to a stop in step when held up, turns on the spot before setting off, and walks
// on into a stair trip and out of it without breaking step.
import test from 'node:test';
import assert from 'node:assert/strict';
import {CurtisRoutine,CURTIS,CURTIS_GAIT,CURTIS_WALK_SPEED} from '../src/obs/curtis-routine.js';
import {CabinStairs} from '../src/obs/stair-traffic.js';
import {stairTrip} from '../src/obs/stair-trip.js';
import {CrewMotion,Supplies,CatRoutine,advanceCabinTraffic} from '../src/obs/state.js';
import {DroidRoutine} from '../src/obs/droid-routine.js';
import {CabinBrain} from '../src/obs/brain.js';

const dt=1/60;
const flat=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);

// A whole visit; the view's figure turns toward where he faces at a person's pace.
function visit({seed=.3,stairs=new CabinStairs(),each=()=>{}}={}){
  const c=new CurtisRoutine({random:()=>seed,firstDelay:0,planned:true});c.ready=true;c.stairs=stairs;
  let yaw=Math.PI;
  for(let i=0;i<900*60;i++){
    stairs?.update(dt);const before={...c.position},kind=c.step?.kind;c.update(dt);
    const d=Math.atan2(Math.sin(c.yaw-yaw),Math.cos(c.yaw-yaw));yaw+=Math.sign(d)*Math.min(Math.abs(d),3*dt);c.viewYaw=yaw;
    each(c,before,kind,i);
    if(c.visits>0&&!c.active)break;
  }
  return c;
}

test('a planned visit walks every stretch from standing to standing and finishes, by the stairs and by the ladder',()=>{
  for(const [seed,stairs] of [[.3,new CabinStairs()],[.7,new CabinStairs()],[.3,null]]){
    let fastest=0,walks=0,last=null,stops=[],usedStairs=false;
    const c=visit({seed,stairs,each:(c,before,kind)=>{
      usedStairs||=c.step?.kind==='stairs'&&c.step.entered;
      if(c.gait&&kind==='walk'&&c.step?.kind==='walk')fastest=Math.max(fastest,flat(c.position,before)/dt);
      if(c.gait&&c.gait!==last&&c.gait.plan.fromStanding)walks++;
      if(!c.gait&&last&&last.plan.toStanding)stops.push(last);
      last=c.gait;
    }});
    assert.equal(c.active,false,'the visit finishes');
    assert.equal(usedStairs,Boolean(stairs));
    assert.ok(walks>=5,`${walks} walks from standing`);
    // (his walking speed, not faster: the walk is the measured cycle at the cabin pace)
    assert.ok(fastest<CURTIS_WALK_SPEED*1.35,`${fastest.toFixed(2)} m/s`);
    for(const walk of stops)assert.ok(walk.done,'each walk comes to rest');
  }
});

test('a walk sets off and comes to rest gradually, not at full speed at once',()=>{
  const c=new CurtisRoutine({planned:true,firstDelay:Infinity});c.active=true;
  c.position={x:2,y:3.392,z:.78};c.aisleTo(5,1);c.hold('coffee',30);
  const speeds=[];
  for(let i=0;i<8*60&&c.step?.kind==='walk';i++){const before={...c.position};c.update(dt);speeds.push(flat(c.position,before)/dt);}
  assert.equal(c.step.kind,'coffee');assert.ok(Math.abs(c.position.x-5)<1e-6);
  const moving=speeds.findIndex(v=>v>1e-4);
  assert.ok(Math.max(...speeds.slice(moving,moving+6))<.5,'the first tenth of a second is slow');
  assert.ok(Math.max(...speeds)>1,'and the walk gets into its stride');
  const last=speeds.findLastIndex(v=>v>1e-4);
  assert.ok(Math.max(...speeds.slice(last-5,last+1))<.6,'the last tenth of a second is slow');
});

test('a sharp corner ends a walk; the curves round the lounge table do not',()=>{
  const c=new CurtisRoutine({planned:true,firstDelay:Infinity});c.active=true;
  c.position={x:-8,y:6.784,z:.78};c.aisleTo(CURTIS.roomX,0);c.walk(CURTIS.roomX,6.784,-1.3);
  assert.equal(c.bout().n,c.steps.length-1,'he stops at the doorway before turning in');
  c.steps=[];c.position={x:3,y:3.392,z:.78};c.aisleTo(9,1);
  assert.equal(c.bout().n,c.steps.length,'round the table in one walk');
  assert.ok(CURTIS_GAIT.bend<Math.PI/2);
});

test('standing facing away, he turns on the spot before the first step',()=>{
  const c=new CurtisRoutine({planned:true,firstDelay:Infinity});c.active=true;
  c.position={x:2,y:3.392,z:.78};c.aisleTo(5,1);c.hold('coffee',30);c.viewYaw=-Math.PI/2;
  c.update(dt);
  assert.ok(c.turn,'turning');assert.equal(c.gait,null);
  const start={...c.position};
  for(let i=0;i<30&&c.turn;i++)c.update(dt);
  assert.equal(flat(c.position,start),0,'no travel while turning');
  for(let i=0;i<240&&!c.gait;i++)c.update(dt);
  assert.ok(c.gait,'then he sets off');
});

test('held up while walking, he comes to a stop in step, short of the one in his way',()=>{
  const c=new CurtisRoutine({planned:true,firstDelay:Infinity});c.active=true;
  c.position={x:2.5,y:6.784,z:.78};c.aisleTo(11,0);c.hold('coffee',30);
  for(let i=0;i<4*60;i++)c.update(dt);
  assert.ok(c.gait&&c.gait.pose.walk>.99,'in full stride');
  // the droid stops in the aisle ahead, inside what he can still walk before he stops
  const reach=c.reach,p={...c.position},droid={position:{x:p.x+reach+.72,y:6.784,z:p.z}};
  let travelled=0,closest=Infinity,stopped=false;
  for(let i=0;i<4*60;i++){
    const before={...c.position};c.update(dt,{droid});
    if(!stopped)travelled+=flat(c.position,before);
    // (once standing he steps aside into the passing lane and walks by)
    closest=Math.min(closest,flat(c.trafficPosition,droid.position));stopped||=!c.gait;
  }
  assert.ok(stopped,'the walk comes to rest');
  assert.ok(travelled<=reach+.05,`${travelled.toFixed(2)} m after the hold (reach ${reach.toFixed(2)})`);
  assert.ok(closest>.64,`and keeps clear of the droid, also passing it (${closest.toFixed(2)} m)`);
});

test('he walks on into a stair trip and out of it without breaking step',()=>{
  let entering=null,leaving=null,biggest=0,last=null,previous={};
  visit({each:(c,before,kind)=>{
    const s=c.step,onStairs=s?.kind==='stairs'&&Boolean(s.entered);
    if(last!==null&&['walk','stairs'].includes(kind)&&['walk','stairs'].includes(s?.kind)){
      const jump=Math.abs(c.walkDistance-last);
      if(kind==='walk'&&onStairs&&!entering)entering={jump};
      if(kind==='stairs'&&s.kind==='walk'&&!leaving)leaving={jump,gait:Boolean(c.gait)};
      // (one walk going on, or handing over to or from a stair trip; a new walk from standing sets off at its own phase)
      if((c.gait&&c.gait===previous.gait)||(onStairs&&(previous.onStairs||previous.gait))||(c.gait&&previous.onStairs))biggest=Math.max(biggest,jump);
    }
    last=c.walkDistance;previous={gait:c.gait,onStairs};
  }});
  assert.ok(entering,'walked onto the stairs');assert.ok(entering.jump<.05,`phase on entering (${entering.jump.toFixed(3)})`);
  assert.ok(leaving?.gait,'and off them into a planned walk');assert.ok(leaving.jump<.05,`phase on leaving (${leaving.jump.toFixed(3)})`);
  assert.ok(biggest<.05,`the walk's phase never jumps (${biggest.toFixed(3)} m)`);
});

test('with the stairs taken, he decides for the ladder before the entrance and finishes the visit',()=>{
  const stairs=new CabinStairs();stairs.enter({},'droid',stairTrip(1,0),.2);
  let used=false,climbs=0,lastKind=null;
  const c=visit({stairs,each:c=>{const k=c.step?.kind;used||=k==='stairs'&&c.step.entered;if(k==='climb'&&lastKind!=='climb')climbs++;lastKind=k;}});
  assert.equal(used,false);assert.equal(climbs,3,'down, between the decks, and out');assert.equal(c.active,false);
});

test('in the cabin with Milo walking as planned too, no prolonged mutual hold forms',()=>{
  const originalRandom=Math.random;
  try{
    for(const seed of [3,5,7,8,12,14,25,36,39]){
      let rng=seed;const random=()=>((rng=(Math.imul(rng,1664525)+1013904223)>>>0)/4294967296);Math.random=random;
      const care=new Supplies(),actor=new CrewMotion({planned:true}),cat=new CatRoutine(care,{random,turns:true,mouseChase:true});
      const scene={time:{delayedCall(){}},sound:{add:()=>({play(){},once(){},destroy(){}})},obsUI:new Proxy({},{get:()=>()=>{}})};
      const brain=new CabinBrain(scene,actor,{care,random});brain.beginWakeUp();brain.catRoutine=cat;
      const droid=new DroidRoutine({care,brain,actor,cat});brain.droidRoutine=droid;
      const curtis=new CurtisRoutine({random,planned:true});curtis.ready=true;droid.visitor=curtis;cat.motion.visitor=curtis;
      let held=0,waited=0;
      for(let i=0;i<1800*60;i++){
        curtis.update(dt,{actor,droid,cat,brain});
        actor.waitingForVisitor=curtis.blocksCrew(actor,dt);actor.waitingForDroid=droid.blocksCrew(actor,dt);
        advanceCabinTraffic(actor,cat,dt,droid);brain.update(dt);droid.update(dt);care.update(dt);
        held=curtis.waiting&&actor.waitingForVisitor&&actor.busy?held+1:0;
        waited=curtis.active&&curtis.waiting?waited+1:0;
        assert.ok(held<45*60,`mutual hold at seed ${seed}, ${curtis.time.toFixed(1)}s: ${JSON.stringify(curtis.trafficPosition)}`);
        assert.ok(waited<90*60,`Curtis stuck at seed ${seed}, ${curtis.time.toFixed(1)}s: ${JSON.stringify(curtis.trafficPosition)}`);
      }
      assert.ok(curtis.visits>1,'the visitor completes and repeats his visit');
    }
  }finally{Math.random=originalRandom;}
});
