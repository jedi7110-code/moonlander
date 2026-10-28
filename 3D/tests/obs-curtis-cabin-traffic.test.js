import test from 'node:test';
import assert from 'node:assert/strict';
import {CrewMotion,Supplies,CatRoutine,advanceCabinTraffic} from '../src/obs/state.js';
import {CurtisRoutine,CURTIS} from '../src/obs/curtis-routine.js';
import {DroidRoutine} from '../src/obs/droid-routine.js';
import {CabinBrain} from '../src/obs/brain.js';

test('entering the rear room releases the shaft and transfers a passing offset without a jump',()=>{
  const c=new CurtisRoutine({firstDelay:Infinity});c.active=true;c.ladderClaim=true;c.claimEnd=6.784;
  c.position={x:CURTIS.roomX,y:6.784,z:.78};c.passOffset=.9;c.walk(CURTIS.roomX,6.784,-1.3);
  const before=c.trafficPosition;
  c.update(1/60);
  assert.equal(c.ladderClaim,false);assert.equal(c.passOffset,0);
  assert.ok(Math.hypot(c.trafficPosition.x-before.x,c.trafficPosition.z-before.z)<.03);
  c.steps=[];c.position={x:CURTIS.roomX,y:6.784,z:-1.3};c.walk(CURTIS.roomX,6.784,.78);c.aisleTo(0,0);c.climbTo(1);
  c.update(.1);assert.equal(c.ladderClaim,false,'a depth transfer out of the room must not reserve the shaft');
});

test('half-hour cabin visits, doorway transfers and three-way traffic never form a prolonged mutual hold',()=>{
  const originalRandom=Math.random;
  try{
    for(const seed of [3,5,7,8,10,11,12,13,14,23,25,29]){
      let rng=seed;const random=()=>((rng=(Math.imul(rng,1664525)+1013904223)>>>0)/4294967296);Math.random=random;
      const care=new Supplies(),actor=new CrewMotion(),cat=new CatRoutine(care,{random,turns:true,mouseChase:true});
      const scene={time:{delayedCall(){}},sound:{add:()=>({play(){},once(){},destroy(){}})},obsUI:new Proxy({},{get:()=>()=>{}})};
      const brain=new CabinBrain(scene,actor,{care,random});brain.beginWakeUp();brain.catRoutine=cat;
      const droid=new DroidRoutine({care,brain,actor,cat});brain.droidRoutine=droid;
      const curtis=new CurtisRoutine({random});curtis.ready=true;droid.visitor=curtis;cat.motion.visitor=curtis;
      const dt=1/60;let held=0;
      for(let i=0;i<1800*60;i++){
        curtis.update(dt,{actor,droid,cat,brain});
        actor.waitingForVisitor=curtis.blocksCrew(actor,dt);actor.waitingForDroid=droid.blocksCrew(actor,dt);
        advanceCabinTraffic(actor,cat,dt,droid);brain.update(dt);droid.update(dt);care.update(dt);
        held=curtis.waiting&&actor.waitingForVisitor&&actor.busy?held+1:0;
        assert.ok(held<45*60,`mutual hold at seed ${seed}, ${curtis.time.toFixed(1)}s: ${JSON.stringify(curtis.trafficPosition)}`);
      }
      assert.ok(curtis.visits>1,'the visitor actually completes and repeats his visit');
    }
  }finally{Math.random=originalRandom;}
});
