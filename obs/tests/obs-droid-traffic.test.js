import test from 'node:test';
import assert from 'node:assert/strict';
import {DroidRoutine,DROID_FLOORS,DROID_LADDER_TRAFFIC} from '../src/obs/droid-routine.js';
import {CrewMotion,Supplies} from '../src/obs/state.js';
import {PlantBed} from '../src/obs/plant-state.js';
import {LADDER_X,CABIN_AISLE} from '../src/obs/layout.js';
import {crewLadderPath,ladderPathsConflict,LADDER_BODY_CLEARANCE} from '../src/obs/ladder-traffic.js';

function setup({from=0,to=2,droidSide=-1,crewFrom=2,crewTo=0,crewSide=1,crewExit=1}={}){
  const actor=new CrewMotion({floor:crewFrom,x:LADDER_X+crewSide*150});
  const routine=new DroidRoutine({care:new Supplies(),brain:{plants:new PlantBed(),actStation:null},actor,cat:{mode:'sleep'}});
  routine.position={x:droidSide*3,y:DROID_FLOORS[from],z:1.48,floor:from,yaw:0};
  routine.plan={...routine.position};routine.job='feed';
  routine.travel(to,droidSide*3,1.48);
  let finished=false,arrivals=0;
  routine.add('release',.1,()=>{routine.job=null;finished=true;});
  const launch=()=>actor.goTo({floor:crewTo,x:LADDER_X+crewExit*150},()=>arrivals++);
  const tick=dt=>{
    actor.waitingForDroid=routine.blocksCrew(actor,dt);
    const before=[actor.x,actor.y,actor.walkDistance];
    if(!actor.waitingForDroid)actor.update(dt);
    else assert.deepEqual([actor.x,actor.y,actor.walkDistance],before);
    if(!finished)routine.update(dt);
    if(actor.climbing&&routine.ladderClaim)assert.equal(ladderPathsConflict(routine.ladderPath,crewLadderPath(actor)),false,'concurrent climbs must have separated remaining routes');
    if(actor.waitingForDroid){
      assert.ok(Math.abs(actor.x-LADDER_X)*.022>=DROID_LADDER_TRAFFIC.crewWaitX-1e-8,'crew stops beside the ladder before crossing the hold boundary');
      assert.equal(actor.climbing,false,'waiting must not strand Milo on the rungs');
    }
    if(routine.waiting&&routine.step?.ladderEntry){
      assert.equal(Math.abs(routine.position.x),DROID_LADDER_TRAFFIC.droidWaitX);
      assert.equal(routine.pose.walking,false);
      assert.equal(routine.ladderClaim,false,'waiting droid must not block the crew it is yielding to');
    }
    if(Math.abs((870-actor.y)*.016-routine.position.y)<1.7){
      const gap=Math.hypot((actor.x-LADDER_X)*.022-routine.position.x,CABIN_AISLE.crewZ-routine.position.z);
      assert.ok(gap>=.68,`bodies need lateral clearance at a shared landing: ${gap}`);
    }
  };
  return{actor,routine,launch,tick,get done(){return finished&&!actor.busy;},get arrivals(){return arrivals;}};
}

test('Milo goes first while the droid waits beside the shaft until the landing is clear',()=>{
  for(const [from,to]of [[0,2],[2,0],[0,1],[1,2]])for(const side of [-1,1]){
    const s=setup({from,to,droidSide:side,crewFrom:to,crewTo:from,crewExit:side});
    s.actor.x=LADDER_X;s.launch();let waited=false,resumed=false;
    for(let i=0;i<12000&&!s.done;i++){
      s.tick(1/60);waited||=s.routine.waiting;
      if(waited&&s.routine.ladderClaim){resumed=true;assert.ok(Math.abs(s.actor.x-LADDER_X)*.022>=DROID_LADDER_TRAFFIC.crewClearX);}
    }
    assert.ok(waited&&resumed);assert.ok(s.done,'both travellers must complete without deadlock');assert.equal(s.arrivals,1);
  }
});

test('droid reserves the approach and keeps Milo at a side hold through climbing and exit',()=>{
  for(const [from,to]of [[0,2],[2,0],[0,1],[1,2]])for(const crewSide of [-1,1]){
    const s=setup({from,to,crewFrom:to,crewTo:from,crewSide});
    while(!s.routine.ladderClaim)s.tick(1/60);
    assert.equal(s.routine.step.kind,'ladder-wait','reservation begins before the droid enters the centre');
    s.launch();let waited=false,exitHeld=false;
    for(let i=0;i<12000&&!s.done;i++){
      s.tick(1/60);waited||=s.actor.waitingForDroid;
      if(s.routine.position.floor===to&&s.routine.ladderClaim&&s.routine.position.z>.92){
        exitHeld=true;assert.equal(s.actor.waitingForDroid,true,'Milo still waits while the droid steps sideways off the landing');
      }
    }
    assert.ok(waited&&exitHeld);assert.ok(s.done);assert.equal(s.arrivals,1);
  }
});

test('simultaneous approaches, same-floor crossings and frame-rate changes keep a clear hold without deadlock',()=>{
  for(const dt of [1/120,1/60,1/30,.1])for(const crewTo of [0,2])for(const crewSide of [-1,1]){
    const s=setup({crewFrom:0,crewTo,crewSide,crewExit:-crewSide});s.launch();
    for(let i=0;i<150/dt&&!s.done;i++)s.tick(dt);
    assert.ok(s.done,`complete at dt=${dt}, crewTo=${crewTo}, side=${crewSide}`);assert.equal(s.arrivals,1);
  }
});

test('a queued crew member can turn away, and paused traffic does not drift toward the ladder',()=>{
  const s=setup();while(!s.routine.ladderClaim)s.tick(1/60);s.launch();
  while(!s.actor.waitingForDroid)s.tick(1/60);
  const before=[s.actor.x,s.actor.y,s.routine.position.x,s.routine.position.y,s.routine.position.z,s.routine.age];
  for(let i=0;i<10;i++)s.tick(0);
  assert.deepEqual([s.actor.x,s.actor.y,s.routine.position.x,s.routine.position.y,s.routine.position.z,s.routine.age],before);
  let redirected=0;s.actor.goTo({floor:s.actor.floor,x:LADDER_X+180},()=>redirected++);
  s.tick(1/60);assert.equal(s.actor.waitingForDroid,false);
  for(let i=0;i<10000&&!s.done;i++)s.tick(1/60);
  assert.ok(s.done);assert.equal(redirected,1);assert.equal(s.arrivals,0);
});

test('opposite routes away from the middle deck can use the ladder concurrently after body clearance',()=>{
  for(const [to,crewTo]of [[0,2],[2,0]])for(const side of [-1,1]){
    const s=setup({from:1,to,crewFrom:1,crewTo,crewSide:side});
    while(s.routine.step?.kind!=='climb')s.tick(1/60);
    s.actor.x=LADDER_X+side*1.4/.022;s.launch();
    let waited=false,overlap=0,releasedBeforeExit=false;
    for(let i=0;i<10000&&!s.done;i++){
      s.tick(1/60);waited||=s.actor.waitingForDroid;
      if(waited&&!s.actor.waitingForDroid&&s.routine.step?.kind==='climb')releasedBeforeExit=true;
      if(s.actor.climbing&&s.routine.step?.kind==='climb'){
        overlap++;assert.ok(Math.abs((870-s.actor.y)*.016-s.routine.position.y)>=LADDER_BODY_CLEARANCE);
      }
    }
    assert.ok(waited&&releasedBeforeExit);assert.ok(overlap>20,'both characters actually move on the ladder at once');
    assert.ok(s.done);assert.equal(s.arrivals,1);
  }
});

test('a droid entering a separate section does not wait for Milo to finish the whole ladder',()=>{
  for(const [to,crewTo]of [[0,2],[2,0]]){
    const s=setup({from:1,to,crewFrom:1,crewTo});s.actor.x=LADDER_X;s.launch();
    let claimedDuringCrewClimb=false;
    for(let i=0;i<10000&&!s.done;i++){
      s.tick(1/60);
      if(s.routine.ladderClaim&&s.actor.climbing)claimedDuringCrewClimb=true;
    }
    assert.ok(claimedDuringCrewClimb);assert.ok(s.done);
  }
});

test('separate sections approaching the same landing still yield until the first user steps aside',()=>{
  for(const [from,crewFrom]of [[0,2],[2,0]]){
    const s=setup({from,to:1,crewFrom,crewTo:1});
    while(!s.routine.ladderClaim)s.tick(1/60);s.launch();
    let waited=false;
    for(let i=0;i<10000&&!s.done;i++){
      s.tick(1/60);waited||=s.actor.waitingForDroid;
      if(s.actor.climbing)assert.equal(s.routine.ladderClaim,false,'the shared arrival landing must be vacated first');
    }
    assert.ok(waited&&s.done);assert.equal(s.arrivals,1);
  }
});

test('an unused deck and a vacated landing remain available during another climb',()=>{
  for(const [from,to,crewFrom]of [[0,1,2],[2,1,0]]){
    const s=setup({from,to,crewFrom,crewTo:crewFrom,crewExit:-1});
    while(!s.routine.ladderClaim)s.tick(1/60);s.launch();
    for(let i=0;i<10000&&!s.done;i++){s.tick(1/60);assert.equal(s.actor.waitingForDroid,false);}
    assert.ok(s.done);
  }
  const s=setup({from:0,to:2,crewFrom:0,crewTo:0,crewExit:-1});
  while(!s.routine.ladderClaim)s.tick(1/60);s.launch();let released=false;
  for(let i=0;i<10000&&!s.done;i++){
    s.tick(1/60);
    if(s.actor.x<LADDER_X&&s.routine.step?.kind==='climb')released=true;
  }
  assert.ok(released&&s.done,'cross the cleared upper landing while the droid is still descending');
});

test('a stationary crew member beside an unrelated deck never locks the droid out',()=>{
  for(const [from,to,crewFrom]of [[0,1,2],[2,1,0]]){
    const s=setup({from,to,crewFrom});s.actor.x=LADDER_X;
    for(let i=0;i<10000&&!s.done;i++){s.tick(1/60);assert.ok(!s.routine.waiting);}
    assert.ok(s.done);
  }
});

test('reversing a concurrent climb waits at a safe height while the earlier route clears',()=>{
  for(const [to,crewTo]of [[0,2],[2,0]]){
    const s=setup({from:1,to,crewFrom:1,crewTo});
    while(s.routine.step?.kind!=='climb')s.tick(1/60);
    s.actor.x=LADDER_X+1.4/.022;s.launch();
    while(!s.actor.climbing)s.tick(1/60);
    s.actor.goTo({floor:to,x:LADDER_X+150});
    const height=s.actor.y;let waited=false;
    for(let i=0;i<10000&&!s.done;i++){
      s.actor.waitingForDroid=s.routine.blocksCrew(s.actor,1/60);
      if(!s.actor.waitingForDroid)s.actor.update(1/60);
      else{waited=true;assert.equal(s.actor.y,height);}
      s.routine.update(1/60);
      if(s.routine.step?.kind==='climb')assert.ok(Math.abs((870-s.actor.y)*.016-s.routine.position.y)>=LADDER_BODY_CLEARANCE);
    }
    assert.ok(waited&&s.done);
  }
});

test('every pair of deck routes is safe and completes at different frame rates and entry orders',()=>{
  const routes=[[0,1],[0,2],[1,0],[1,2],[2,0],[2,1]];
  for(const [from,to]of routes)for(const [crewFrom,crewTo]of routes)for(const dt of [1/60,.1])for(const first of ['crew','droid']){
    const s=setup({from,to,crewFrom,crewTo});
    if(first==='crew'){s.actor.x=LADDER_X;s.launch();}
    else{while(!s.routine.ladderClaim)s.tick(dt);s.launch();}
    for(let i=0;i<100/dt&&!s.done;i++)s.tick(dt);
    assert.ok(s.done,`${from}->${to} vs ${crewFrom}->${crewTo}, ${first} first, dt=${dt}`);assert.equal(s.arrivals,1);
  }
});
