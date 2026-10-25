import test from 'node:test';
import assert from 'node:assert/strict';
import {CurtisRoutine,CURTIS} from '../src/obs/curtis-routine.js';
import {CrewMotion,CatMotion} from '../src/obs/state.js';
import {worldActor} from '../src/obs/curtis-traffic.js';
const dt=1/60;
function visitor(x=3){const c=new CurtisRoutine();c.active=true;c.position={x,y:3.392,z:.78};c.walk(10,3.392,.78);return c;}
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
  for(let i=0;i<1800&&c.active;i++){
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
