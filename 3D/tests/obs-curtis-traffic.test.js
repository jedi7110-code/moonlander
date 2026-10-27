import test from 'node:test';
import assert from 'node:assert/strict';
import {CurtisRoutine,CURTIS,CURTIS_LADDER_TRAFFIC} from '../src/obs/curtis-routine.js';
import {CrewMotion,CatMotion,Supplies} from '../src/obs/state.js';
import {worldActor} from '../src/obs/curtis-traffic.js';
import {DroidRoutine,DROID_FLOORS} from '../src/obs/droid-routine.js';
import {PlantBed} from '../src/obs/plant-state.js';
import {crewLadderPath,ladderPathsConflict} from '../src/obs/ladder-traffic.js';
const dt=1/60;
function visitor(x=3){const c=new CurtisRoutine();c.active=true;c.position={x,y:3.392,z:.78};c.walk(10,3.392,.78);return c;}

function ladderTraffic({side=1,crewSide=-1,first='droid',droidFrom=0,droidTo=1,curtisTo=0,crewTo=0,tickSeconds=dt}={}){
  const actor=new CrewMotion({floor:1,x:700+crewSide*4/.022});
  const curtis=new CurtisRoutine({firstDelay:Infinity});
  const droid=new DroidRoutine({care:new Supplies(),brain:{plants:new PlantBed(),actStation:null},actor,cat:{mode:'sleep'}});
  droid.position={x:side*3,y:DROID_FLOORS[droidFrom],z:1.48,floor:droidFrom,yaw:0};droid.plan={...droid.position};droid.job='feed';droid.visitor=curtis;
  droid.travel(droidTo,side*3,1.48);let droidDone=false;
  droid.add('done',.01,()=>{droidDone=true;droid.job=null;droid.restUntil=Infinity;});
  const startCurtis=()=>{
    curtis.active=true;curtis.position={x:side*3,y:DROID_FLOORS[1],z:.78};
    curtis.aisleTo(0,1);curtis.climbTo(curtisTo);curtis.aisleTo(side*3,curtisTo);
  };
  if(first==='droid'){
    while(!droid.ladderClaim)droid.update(dt);
    startCurtis();
  }else{
    startCurtis();
    for(let frame=0;frame<600&&!curtis.ladderClaim;frame++)curtis.update(dt,{actor,droid});
  }
  actor.goTo({floor:crewTo,x:700+crewSide*3/.022});
  const tick=()=>{
    curtis.update(tickSeconds,{actor,droid});
    actor.waitingForVisitor=curtis.blocksCrew(actor,tickSeconds);actor.waitingForDroid=droid.blocksCrew(actor,tickSeconds);
    if(!actor.waitingForVisitor&&!actor.waitingForDroid)actor.update(tickSeconds);
    droid.update(tickSeconds);
    if(curtis.ladderClaim&&droid.ladderClaim)assert.equal(ladderPathsConflict(curtis.ladderPath,droid.ladderPath),false);
    if(curtis.ladderClaim&&actor.climbing)assert.equal(ladderPathsConflict(curtis.ladderPath,crewLadderPath(actor)),false);
    const position=curtis.trafficPosition;
    if(curtis.active&&Math.abs(position.y-droid.position.y)<1.4)assert.ok(Math.hypot(position.x-droid.position.x,position.z-droid.position.z)>=.63);
    const crew=worldActor(actor);
    if(curtis.active&&Math.abs(position.y-crew.y)<1.4)assert.ok(Math.hypot(position.x-crew.x,position.z-crew.z)>=.71,JSON.stringify({first,side,crewSide,position,crew,step:curtis.step?.kind,claim:curtis.ladderClaim,offset:curtis.passOffset}));
  };
  return{actor,curtis,droid,tick,get done(){return !actor.busy&&!curtis.active&&droidDone;}};
}

test('three travellers approaching the middle landing finish without a ladder standoff',()=>{
  for(const first of ['droid','curtis'])for(const side of [-1,1])for(const crewSide of [-1,1]){
    const state=ladderTraffic({first,side,crewSide});
    for(let frame=0;frame<180*60&&!state.done;frame++)state.tick();
    const {curtis,droid,actor}=state;
    assert.ok(state.done,JSON.stringify({first,side,crewSide,curtis:{position:curtis.trafficPosition,step:curtis.step?.kind,claim:curtis.ladderClaim},droid:{position:droid.position,step:droid.step?.kind,claim:droid.ladderClaim},actor:{position:worldActor(actor),queue:actor.queue,waitingForVisitor:actor.waitingForVisitor,waitingForDroid:actor.waitingForDroid}}));
  }
});

test('middle-deck ladder traffic stays live across route directions and slower frames',()=>{
  const routes=[[0,1],[0,2],[1,0],[1,2],[2,0],[2,1]];
  for(const [droidFrom,droidTo] of routes)for(const curtisTo of [0,2])for(const crewTo of [0,2])for(const first of ['droid','curtis']){
    const state=ladderTraffic({droidFrom,droidTo,curtisTo,crewTo,first,tickSeconds:.05});
    for(let frame=0;frame<180/.05&&!state.done;frame++)state.tick();
    assert.ok(state.done,JSON.stringify({droidFrom,droidTo,curtisTo,crewTo,first,curtis:state.curtis.trafficPosition,step:state.curtis.step?.kind}));
  }
});

test('waiting stays beside the ladder, pauses without drift, and the next visit resets its passing lane',()=>{
  const state=ladderTraffic();let held=false;
  for(let frame=0;frame<600;frame++){
    state.tick();
    if(!state.curtis.ladderClaim&&state.curtis.waiting){held=true;break;}
  }
  assert.equal(held,true);assert.ok(Math.abs(state.curtis.position.x)>CURTIS_LADDER_TRAFFIC.clearX);
  const before={position:state.curtis.trafficPosition,age:state.curtis.age,distance:state.curtis.walkDistance};
  for(let frame=0;frame<60;frame++)state.curtis.update(0,{actor:state.actor,droid:state.droid});
  assert.deepEqual({position:state.curtis.trafficPosition,age:state.curtis.age,distance:state.curtis.walkDistance},before);
  state.curtis.passOffset=1.4;state.curtis.steps=[];state.curtis.beginVisit();assert.equal(state.curtis.passOffset,0);
});
test('Milo and Curtis pass head-on without overlap or mutual deadlock',()=>{
  const c=visitor(),a=new CrewMotion({floor:1,x:700+8/.022});a.goTo({floor:1,x:700+2/.022});
  for(let i=0;i<1200&&c.active;i++){
    c.update(dt,{actor:a});if(!c.blocksCrew(a,dt))a.update(dt);
    const p=c.trafficPosition,q=worldActor(a);
    assert.ok(Math.hypot(p.x-q.x,p.z-q.z)>=.71);
  }
  assert.equal(c.active,false);assert.equal(a.busy,false);
});
test('Curtis waits before sitting in an occupied sofa',()=>{
  const c=visitor(CURTIS.seatX);c.steps=[];c.walk(CURTIS.seatX,3.392,.43);
  const a=new CrewMotion({floor:1,x:700+CURTIS.seatX/.022});
  c.update(dt,{actor:a,brain:{actStation:'lounge'}});
  assert.equal(c.waiting,true);assert.equal(c.age,0);
  a.x=700;c.update(dt,{actor:a});assert.ok(c.age>0);
});
test('Droid cannot walk into Curtis but can move away',()=>{
  const c=visitor(5),p={x:4.3,y:3.392,z:.78};
  const d={position:p,age:0,step:{from:p,to:{...p,x:6},duration:1}};
  assert.equal(c.blocksDroid(d,.1),true);
  d.step.to.x=3;assert.equal(c.blocksDroid(d,.1),false);
});
test('Cat approaching Curtis stops and resumes after he clears',()=>{
  const c=visitor(5);c.passOffset=1.42;
  const m=new CatMotion({floor:1,x:700+4.4/.022});m.onSofa=false;m.z=2.2;m.queue=[{type:'walk',x:700+6/.022}];m.visitor=c;
  const before=m.x;m.update(dt);assert.equal(m.x,before);
  c.position.x=8;m.update(dt);assert.ok(m.x>before);
});
test('Curtis and an oncoming droid both clear their separate lanes',()=>{
  const c=visitor();const from={x:9,y:3.392,z:1.48},to={...from,x:2};
  const d={position:{...from},age:0,step:{from,to,duration:7}};
  for(let i=0;i<1800&&(c.active||d.age<7);i++){
    c.update(dt,{droid:d});
    if(!c.blocksDroid(d,dt)){d.age=Math.min(7,d.age+dt);d.position.x=9-d.age;}
    assert.ok(Math.hypot(c.trafficPosition.x-d.position.x,c.trafficPosition.z-d.position.z)>=.63);
  }
  assert.equal(c.active,false);assert.equal(d.age,7);
});
test('both visit orders keep the whole walking route in front of the table',()=>{
  for(const random of [()=>0,()=>.99]){
    const c=new CurtisRoutine({random});c.beginVisit();
    let samples=0;
    for(const step of c.steps){
      if(step.kind!=='walk'||Math.abs(step.from.y-3.392)>.01)continue;
      for(let i=0;i<=100;i++){
        const u=i/100,x=step.from.x+(step.to.x-step.from.x)*u,z=step.from.z+(step.to.z-step.from.z)*u;
        if(Math.abs(x-8.25)<1.51/2+.45){assert.ok(z>=1.03+.80/2+.44,`table clearance at ${x}, ${z}`);samples++;}
      }
    }
    assert.ok(samples>0);
  }
});
