import test from 'node:test';
import assert from 'node:assert/strict';
import {CurtisRoutine,CURTIS} from '../src/obs/curtis-routine.js';
import {CabinStairs} from '../src/obs/stair-traffic.js';
import {stairTrip} from '../src/obs/stair-trip.js';
import {DroidRoutine,DROID_FLOORS,DROID_LANE} from '../src/obs/droid-routine.js';
import {Supplies} from '../src/obs/state.js';
import {PlantBed} from '../src/obs/plant-state.js';
globalThis.__droid={DroidRoutine,DROID_FLOORS,DROID_LANE,Supplies,PlantBed};

function visit(stairs,each=()=>{}){
  const c=new CurtisRoutine({random:()=>.3,firstDelay:0});c.ready=true;c.stairs=stairs;
  let prev=null,maxStep=0;
  for(let i=0;i<600*60;i++){
    stairs.update(1/60);c.update(1/60);each(c,i);
    // (sit/stand are authored seat poses placed by the view; the climb has its own pose)
    if(c.active&&prev&&!['climb','sit','relax','stand'].includes(c.step?.kind)&&!['sit','relax','stand'].includes(prev.kind)){const p=c.position;maxStep=Math.max(maxStep,Math.hypot(p.x-prev.x,p.y-prev.y,p.z-prev.z));}
    prev={...c.position,kind:c.step?.kind};
    if(c.visits>0&&!c.active)break;
  }
  return {c,maxStep};
}

test('the visitor walks the stair tower from the lounge deck to the rear room and leaves by the shaft',()=>{
  const stairs=new CabinStairs();let used=false,inRoom=false,climbs=0,lastKind=null;
  const {c,maxStep}=visit(stairs,(c)=>{
    const k=c.step?.kind;used||=k==='stairs'&&c.step.decided;
    if(k==='climb'&&lastKind!=='climb')climbs++;lastKind=k;
    if(c.active&&Math.abs(c.position.x-CURTIS.roomX)<1e-6&&c.floor===0)inRoom=true;
  });
  assert(used,'used the stairs between decks');assert(inRoom,'reached the rear room');
  assert.equal(climbs,2,'the shaft only to come in and to leave');
  assert(!c.active,'visit finished');assert.equal(stairs.count,0);
  assert(maxStep<.08,`continuous (${maxStep.toFixed(3)} m/frame)`);
});

test('with the stairs crowded the visitor uses the ladder between decks as before',()=>{
  const stairs=new CabinStairs();stairs.enter({},'droid',stairTrip(1,0),.2);
  let used=false,climbs=0,lastKind=null;
  const {c}=visit(stairs,(c)=>{const k=c.step?.kind;used||=k==='stairs'&&c.step.decided&&stairs.walker(c);if(k==='climb'&&lastKind!=='climb')climbs++;lastKind=k;});
  assert(!used);assert.equal(climbs,3);assert(!c.active);
});

test('the visitor and the droid meeting at a stair exit never hold each other for good',()=>{
  const {DroidRoutine,DROID_FLOORS,DROID_LANE}=globalThis.__droid;
  for(const delay of [8.5,9,9.5,10]){
    const stairs=new CabinStairs(),c=new CurtisRoutine({random:()=>.3,firstDelay:0});c.stairs=stairs;c.active=true;
    c.position={x:-8,y:3.392,z:.78};c.changeDeck(1,0);c.aisleTo(-6,0);
    const droid=new DroidRoutine({care:new globalThis.__droid.Supplies(),brain:{plants:new globalThis.__droid.PlantBed(),actStation:null},actor:null,cat:{mode:'sleep'}});
    droid.stairs=stairs;droid.visitor=c;droid.position={x:-11.92,y:DROID_FLOORS[0],z:-.52,floor:0,yaw:Math.PI/2};droid.plan={...droid.position};droid.job='feed';
    let started=false,done=false;
    for(let i=0;i<180*60&&!(done&&c.steps.length===0);i++){
      const t=i/60;if(!started&&t>=delay){droid.travel(2,3,DROID_LANE);droid.add('release',.1,()=>{done=true;droid.job=null;});started=true;}
      stairs.update(1/60);c.update(1/60,{droid});if(started&&!done)droid.update(1/60);
    }
    assert(done,`droid finished (delay ${delay})`);assert.equal(c.steps.length,0,`visitor finished (delay ${delay})`);
  }
});
