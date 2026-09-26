import test from 'node:test';
import assert from 'node:assert/strict';
import {CrewMotion,CatMotion,CatRoutine,Supplies,advanceCabinTraffic} from '../src/obs/state.js';
import {DroidRoutine,DROID_FLOORS,DROID_LANE} from '../src/obs/droid-routine.js';
import {CAT_PORT,CAT_BOWL,CAT_SOFA,CABIN_AISLE,LADDER_X} from '../src/obs/layout.js';

function setup({floor=2,x=CAT_BOWL.approachX,side=-1,dt=1/60}={}){
  const care=new Supplies(),actor=new CrewMotion({floor,x:x+200}),cat=new CatRoutine(care,{random:()=>.5});
  cat.motion=new CatMotion({floor,x});cat.mode='fetch';cat.hunger=100;
  const routine=new DroidRoutine({care,actor,cat});
  routine.position={x:(x-LADDER_X)*.022+side*3,y:DROID_FLOORS[floor],z:DROID_LANE,floor,yaw:-side*Math.PI/2};
  routine.plan={...routine.position};routine.job='feed';routine.restUntil=Infinity;
  const launch=()=>{routine.walk((x-LADDER_X)*.022-side*3,DROID_LANE);routine.add('release',.01,()=>{routine.job=null;});};
  const step=()=>{
    actor.waitingForDroid=routine.blocksCrew(actor,dt);
    advanceCabinTraffic(actor,cat,dt,routine);routine.update(dt);
    const c=cat.motion,p=routine.position;
    if(!c.hidden&&Math.abs((870-c.y)*.016+c.elevation-p.y)<.5){
      const gap=Math.hypot((c.x-LADDER_X)*.022-p.x,c.z-p.z);
      assert.ok(gap>.62,`cat/droid clearance: ${gap}`);
    }
    if(!c.hidden&&!c.onSofa&&actor.floor===c.floor&&Math.abs(actor.y-c.y)<30){
      const gap=Math.hypot((c.x-actor.x)*.022,c.z-CABIN_AISLE.crewZ);
      assert.ok(gap>.65,`cat/Milo clearance: ${gap}`);
    }
    assert.ok(!(routine.waitingForCat&&c.waitingForDroid),'no mutual wait');
  };
  return {actor,cat,routine,launch,step};
}

test('cat uses a separate supported lane when passing or overtaking either biped',()=>{
  assert.ok(CAT_PORT.walkZ-DROID_LANE>.7);
  for(const side of [-1,1]){
    const s=setup({side,x:600});s.launch();
    s.actor.x=500;s.actor.goTo({floor:2,x:850});
    s.cat.motion.goTo({floor:2,x:750},()=>s.cat.rest('look',100));
    for(let i=0;i<10*60;i++){s.step();assert.ok(!s.routine.waitingForCat&&!s.cat.motion.waitingForDroid);}
    assert.ok(s.routine.docked&&!s.cat.motion.busy&&!s.actor.busy);
  }
});

test('cat yields before crossing both walking lanes, including a droid approaching from either side',()=>{
  for(const dt of [1/120,1/60,1/30,.1])for(const side of [-1,1]){
    const s=setup({side,dt});s.launch();
    s.actor.x=CAT_BOWL.approachX-side*130;s.actor.goTo({floor:2,x:CAT_BOWL.approachX+side*180});
    let arrived=0,waited=false;
    s.cat.motion.goTo({floor:2,x:CAT_BOWL.approachX,z:CAT_BOWL.depth},()=>{arrived++;s.cat.rest('eat',100);});
    for(let i=0;i<15/dt;i++){
      s.step();
      if(s.cat.motion.waitingForDroid){waited=true;assert.equal(s.cat.motion.z,CAT_PORT.walkZ);}
    }
    assert.ok(waited);assert.equal(arrived,1);assert.ok(s.routine.docked&&!s.actor.busy);
  }
});

test('a crossing already in progress has priority; the droid waits and the resting cat clears its route',()=>{
  for(const side of [-1,1]){
    const s=setup({side});s.routine.position.x=(CAT_BOWL.approachX-LADDER_X)*.022+side*5;s.routine.plan={...s.routine.position};
    s.cat.motion.goTo({floor:2,x:CAT_BOWL.approachX,z:CAT_BOWL.depth},()=>s.cat.rest('eat',100));
    for(let i=0;i<30;i++)s.step();assert.ok(s.cat.motion.crossing.active);
    s.launch();let waited=false;
    for(let i=0;i<25*60;i++){
      const position={...s.routine.position},age=s.routine.age;s.step();
      if(s.routine.waitingForCat){waited=true;assert.deepEqual(s.routine.position,position);assert.equal(s.routine.age,age);}
    }
    assert.ok(waited);assert.ok(s.routine.docked);assert.equal(s.cat.motion.z,CAT_PORT.walkZ);
  }
});

test('wall entries and exits reserve the crossing against a droid, without blocking another deck',()=>{
  for(const phase of ['enter','exit']){
    const s=setup({floor:1,x:CAT_PORT.x});s.launch();
    s.cat.motion.destination={floor:2,x:850,z:CAT_PORT.walkZ};
    s.cat.motion.portal={from:1,to:1,phase,age:0,duration:2.8};
    s.cat.motion.z=phase==='enter'?CAT_PORT.walkZ:CAT_PORT.insideZ;
    let waited=false;
    for(let i=0;i<6*60;i++){s.step();waited||=s.cat.motion.waitingForDroid;}
    assert.ok(waited);
    for(let i=0;i<25*60;i++)s.step();assert.ok(s.routine.docked);
  }
  const s=setup({floor:1,x:CAT_PORT.x});s.routine.position.y=DROID_FLOORS[2];s.routine.plan={...s.routine.position};
  s.cat.motion.goTo({floor:1,x:CAT_PORT.x,z:CAT_BOWL.depth});
  for(let i=0;i<5*60;i++){s.step();assert.ok(!s.cat.motion.waitingForDroid);}
});

test('sofa approach, retargeting and pause preserve traffic ownership',()=>{
  const s=setup({floor:CAT_SOFA.floor,x:CAT_SOFA.floorX});s.launch();
  s.cat.motion.goTo({floor:CAT_SOFA.floor,x:CAT_SOFA.seatX});
  for(let i=0;i<20;i++)s.step();assert.ok(s.cat.motion.waitingForDroid);
  const state=JSON.stringify([s.actor,s.cat.motion,s.routine.pose]);
  advanceCabinTraffic(s.actor,s.cat,0,s.routine);s.routine.update(0);
  assert.equal(JSON.stringify([s.actor,s.cat.motion,s.routine.pose]),state);
  let arrivals=0;s.cat.motion.goTo({floor:CAT_SOFA.floor,x:CAT_SOFA.floorX-100},()=>{arrivals++;s.cat.rest('look',100);});
  for(let i=0;i<10*60;i++)s.step();assert.equal(arrivals,1);assert.ok(!s.cat.motion.waitingForDroid);
});

test('feeding finishes when a hungry cat reaches the bowl behind the droid, without a mutual wait',()=>{
  for(const turns of [false,true])for(const dt of [1/120,1/60,1/30,.1]){
    const care=new Supplies(),actor=new CrewMotion({floor:0,x:1000}),cat=new CatRoutine(care,{random:()=>.5,turns});
    cat.motion=new CatMotion({floor:2,x:CAT_BOWL.approachX,turns});cat.motion.heading=Math.PI/2;
    cat.rest('look',1000);cat.hunger=100;
    const routine=new DroidRoutine({care,actor,cat,brain:{plants:{ready:0}}});
    assert.ok(routine.request('feed'));
    let meals=0,waited=false;
    const eat=care.eatCatFood.bind(care);care.eatCatFood=()=>{const ate=eat();if(ate)meals++;return ate;};
    const step=()=>{
      actor.waitingForDroid=routine.blocksCrew(actor,dt);
      advanceCabinTraffic(actor,cat,dt,routine);routine.update(dt);
      const c=cat.motion,p=routine.position;
      if(!c.hidden&&Math.abs((870-c.y)*.016+c.elevation-p.y)<.5){
        assert.ok(Math.hypot((c.x-LADDER_X)*.022-p.x,c.z-p.z)>.62,'the cat stays clear while the droid pours and leaves');
      }
      waited||=Boolean(c.waitingForDroid);
    };
    for(let time=0;time<120&&routine.step?.kind!=='guard';time+=dt)step();
    assert.equal(routine.step?.kind,'guard');assert.equal(routine.carriedFood,true);
    cat.fetch();
    const paused=JSON.stringify([routine.pose,cat.motion,care.supplies,care.catBowl]);
    advanceCabinTraffic(actor,cat,0,routine);routine.update(0);
    assert.equal(JSON.stringify([routine.pose,cat.motion,care.supplies,care.catBowl]),paused);
    for(let time=0;time<120&&(!routine.docked||!meals);time+=dt){step();if(routine.docked)routine.restUntil=Infinity;}
    assert.ok(waited,'the arriving cat waits in front of the occupied bowl approach');
    assert.ok(routine.docked,`feeding must return to the dock (turns=${turns}, dt=${dt})`);
    assert.equal(routine.completed.feed,1);assert.equal(routine.disposedWaste,1);
    assert.equal(meals,1,'Lucy eats the newly filled portion once');
    assert.equal(care.catBowl,0);assert.equal(care.supplies.catfood,2,'neither waiting nor feeding duplicates or wastes food');
  }
});
