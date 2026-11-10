import test from 'node:test';
import assert from 'node:assert/strict';
import {DroidRoutine,DROID_FLOORS,DROID_LANE} from '../src/obs/droid-routine.js';
import {CrewMotion,Supplies} from '../src/obs/state.js';
import {PlantBed} from '../src/obs/plant-state.js';
import {CabinStairs} from '../src/obs/stair-traffic.js';
import {stairTrip} from '../src/obs/stair-trip.js';
import {droidStairFeet,droidStairPose} from '../src/obs/droid-stair-pose.js';

function setup(from,to,stairs){
  const actor=new CrewMotion({floor:1,x:900});
  const routine=new DroidRoutine({care:new Supplies(),brain:{plants:new PlantBed(),actStation:null},actor,cat:{mode:'sleep'}});
  routine.stairs=stairs;
  routine.position={x:2,y:DROID_FLOORS[from],z:DROID_LANE,floor:from,yaw:0};
  routine.plan={...routine.position};routine.job='feed';
  routine.travel(to,3,DROID_LANE);
  let finished=false;routine.add('release',.1,()=>{routine.job=null;finished=true;});
  return {routine,done:()=>finished};
}

test('the droid walks the stair tower between decks and arrives where the ladder route would end',()=>{
  for(const [from,to] of [[0,2],[2,0],[0,1],[1,2]]){
    const stairs=new CabinStairs(),{routine,done}=setup(from,to,stairs);
    let used=false,climbed=false,prev=null,maxStep=0;
    for(let i=0;i<180*60&&!done();i++){
      stairs.update(1/60);routine.update(1/60);
      used||=routine.step?.kind==='stairs'&&routine.step.decided;climbed||=routine.step?.kind==='climb';
      const p=routine.position;if(prev)maxStep=Math.max(maxStep,Math.hypot(p.x-prev.x,p.y-prev.y,p.z-prev.z));prev={...p};
    }
    assert(done(),`${from}->${to} finishes`);assert(used&&!climbed,`${from}->${to} by the stairs`);
    assert.equal(routine.position.floor,to);assert(Math.abs(routine.position.y-DROID_FLOORS[to])<1e-9);
    assert(maxStep<.06,`${from}->${to} continuous (${maxStep.toFixed(3)} m/frame)`);assert.equal(stairs.count,0);
  }
});

test('a crowded tower sends the droid up the ladder instead, ending at the same spot',()=>{
  const stairs=new CabinStairs();stairs.enter({},'crew',stairTrip(0,2,{fromZ:DROID_LANE,toZ:DROID_LANE}),.3);
  const {routine,done}=setup(0,2,stairs);let climbed=false;
  for(let i=0;i<240*60&&!done();i++){stairs.update(1/60);routine.update(1/60);climbed||=routine.step?.kind==='climb';}
  assert(done());assert(climbed,'took the ladder');assert.equal(routine.position.floor,2);
});

test('droid feet stay on treads and move continuously along every trip',()=>{
  for(const [a,b] of [[0,2],[2,0],[1,0],[1,2]]){
    const trip=stairTrip(a,b,{fromZ:DROID_LANE,toZ:DROID_LANE});let prev=null,jump=0;
    for(let t=0;t<=trip.length;t+=.01){
      const feet=droidStairFeet(trip,t);
      for(const f of feet)assert([f.x,f.y,f.z].every(Number.isFinite));
      if(prev)feet.forEach((f,i)=>{jump=Math.max(jump,Math.hypot(f.x-prev[i].x,f.y-prev[i].y,f.z-prev[i].z));});prev=feet;
      const pose=droidStairPose(trip,t,[[-.137,.099,.045],[.137,.099,.045]]);
      assert(pose.feet.every(p=>p.every(Number.isFinite)));
    }
    // (per 1 cm of travel; the stair study robot gait swings a foot over two treads)
    assert(jump<.08,`${a}->${b} foot step ${jump.toFixed(3)}`);
  }
});

test('leaving the dock for the stairs the droid turns smoothly, also when it falls back to the ladder',()=>{
  for(const crowded of [false,true]){
    const stairs=new CabinStairs();if(crowded)stairs.enter({},'crew',stairTrip(0,2,{fromZ:DROID_LANE,toZ:DROID_LANE}),.2);
    const routine=new DroidRoutine({care:new Supplies(),brain:{plants:new PlantBed(),actStation:null},actor:new CrewMotion({floor:1,x:900}),cat:{mode:'sleep'}});
    routine.stairs=stairs;routine.position={x:-11.92,y:DROID_FLOORS[0],z:-.52,floor:0,yaw:Math.PI/2};routine.plan={...routine.position};routine.job='feed';
    routine.travel(2,3,DROID_LANE);let done=false;routine.add('release',.1,()=>{done=true;routine.job=null;});
    let prev=routine.position.yaw,maxTurn=0;
    for(let i=0;i<300*60&&!done;i++){stairs.update(1/60);routine.update(1/60);const y=routine.position.yaw;maxTurn=Math.max(maxTurn,Math.abs(Math.atan2(Math.sin(y-prev),Math.cos(y-prev))));prev=y;}
    assert(done);assert(maxTurn<.1,`heading changes ${(maxTurn*57.3).toFixed(0)}° in a frame (crowded ${crowded})`);
  }
});
