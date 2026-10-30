import test from 'node:test';
import assert from 'node:assert/strict';
import {CurtisRoutine,CURTIS} from '../src/obs/curtis-routine.js';
import {CrewMotion,Supplies,getStation} from '../src/obs/state.js';
import {CabinBrain} from '../src/obs/brain.js';
import {DroidRoutine} from '../src/obs/droid-routine.js';
import {worldActor,CREW_CLEARANCE} from '../src/obs/curtis-traffic.js';
import {crewWalkway} from '../src/obs/cabin-walkway.js';
import {LOUNGE_ENTRY_SECONDS,loungeApproachX,loungeEntryAge,loungeExitPose} from '../src/obs/lounge-exit.js';
import {LOUNGE_TABLE} from '../src/obs/layout.js';

function seatedCurtis(){
  const curtis=new CurtisRoutine({firstDelay:Infinity});curtis.active=true;
  curtis.position={x:CURTIS.seatX,y:3.392,z:.06};curtis.hold('relax',120);
  return curtis;
}

test('Milo passes a seated Curtis in either direction with clearance, constant walking speed and matching footfall distance',()=>{
  for(const dt of [1/120,1/60,1/30,.1])for(const [from,to] of [[3,9],[9,3]]){
    const curtis=seatedCurtis(),actor=new CrewMotion({floor:1,x:700+from/.022});
    actor.goTo({floor:1,x:700+to/.022});let depth=0;
    for(let i=0;i<20/dt&&actor.busy;i++){
      actor.waitingForVisitor=curtis.blocksCrew(actor,dt);assert.equal(actor.waitingForVisitor,false);
      const before=worldActor(actor),distance=actor.walkDistance;actor.update(dt);const after=worldActor(actor);
      const travelled=Math.hypot(after.x-before.x,after.z-before.z);
      assert.ok(travelled<=actor.walkSpeed*.022*dt*1.04,'the detour must not speed up the walk');
      assert.ok(Math.abs((actor.walkDistance-distance)*.022-travelled)<1e-9,'gait advances by the full curved distance');
      assert.ok(Math.hypot(after.x-CURTIS.seatX,after.z-.06)>CREW_CLEARANCE+.05);
      assert.ok(after.x+.3<LOUNGE_TABLE.x-LOUNGE_TABLE.width/2||Math.abs(after.z-.78)<1e-8,'the curve rejoins the aisle before the table');
      depth=Math.max(depth,after.z);
    }
    assert.equal(actor.busy,false);assert.ok(depth>1.3);assert.equal(worldActor(actor).z,.78);
  }
});

test('Milo reaches the authored lounge entry and seats normally while Curtis stays seated',()=>{
  const curtis=seatedCurtis(),actor=new CrewMotion({floor:1,x:700+3/.022});
  const brain=new CabinBrain({obsUI:{hideWant(){}}},actor,{care:new Supplies(),random:()=>.8});
  brain.health.nextIncident=Infinity;brain.environment.nextFault=Infinity;
  brain.nextLeisure='tablet';brain._go(getStation('lounge'));
  for(let i=0;i<15*60&&!brain.loungeEntry;i++){
    curtis.update(1/60,{actor,brain});actor.waitingForVisitor=curtis.blocksCrew(actor);
    if(!actor.waitingForVisitor)actor.update(1/60);
  }
  assert.ok(brain.loungeEntry);assert.equal(actor.x,loungeApproachX());
  const end=worldActor(actor),pose=loungeExitPose(loungeEntryAge(0));
  assert.ok(Math.abs(end.x-((getStation('lounge').x-700)*.022+pose.x))<1e-9);
  assert.equal(end.z,pose.depth,'entry starts at exactly the end of the avoidance curve');
  brain.update(LOUNGE_ENTRY_SECONDS);
  assert.equal(brain.isSeatedInLounge(),true);assert.equal(actor.x,getStation('lounge').x);
  curtis.update(1/60,{actor,brain});assert.equal(curtis.step.kind,'relax');
});

test('pausing and Curtis standing up mid-pass never snap Milo back into the seated body',()=>{
  const curtis=seatedCurtis(),actor=new CrewMotion({floor:1,x:700+4/.022});actor.goTo({floor:1,x:700+9/.022});
  while((actor.x-700)*.022<CURTIS.seatX){curtis.blocksCrew(actor);actor.update(1/60);}
  const before=worldActor(actor),distance=actor.walkDistance;
  for(let i=0;i<20;i++){curtis.blocksCrew(actor,0);actor.update(0);}
  assert.deepEqual(worldActor(actor),before);assert.equal(actor.walkDistance,distance);
  curtis.active=false;curtis.blocksCrew(actor);assert.deepEqual(worldActor(actor),before);
  while(actor.busy){const from=worldActor(actor);curtis.blocksCrew(actor);actor.update(1/60);const to=worldActor(actor);assert.ok(Math.hypot(to.x-from.x,to.z-from.z)<.022);}
  curtis.blocksCrew(actor);assert.equal(actor.loungeAvoidance,null);
  assert.equal(crewWalkway(8,1,1,actor.loungeAvoidance).z,.78);
});


test('Milo and a passing droid take turns through the lounge detour without overlap or a standoff',()=>{
  for(const [from,to] of [[6.5,3],[10,3],[2,10]]){
    const curtis=seatedCurtis(),actor=new CrewMotion({floor:1,x:700+3/.022});actor.goTo({floor:1,x:700+9/.022});
    const droid=new DroidRoutine({care:new Supplies(),actor});droid.visitor=curtis;droid.job='cook';
    droid.position={x:from,y:3.392,z:1.48,floor:1,yaw:0};
    droid.steps=[{kind:'walk',from:{...droid.position},to:{...droid.position,x:to},duration:Math.abs(to-from)/.928}];
    for(let i=0;i<30*60&&(actor.busy||droid.step);i++){
      actor.waitingForVisitor=curtis.blocksCrew(actor);actor.waitingForDroid=droid.blocksCrew(actor);
      if(!actor.waitingForVisitor&&!actor.waitingForDroid)actor.update(1/60);
      droid.update(1/60);
      const p=worldActor(actor);assert.ok(Math.hypot(p.x-droid.position.x,p.z-droid.position.z)>=.63);
    }
    assert.equal(actor.busy,false);assert.equal(droid.step,null);
  }
});
