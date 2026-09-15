import test from 'node:test';
import assert from 'node:assert/strict';
import {CatRoutine,Supplies} from '../src/obs/state.js';

test('stationary cats can face front, diagonals, sides and directly back',()=>{
  const starts=new Set();
  for(let i=0;i<8;i++){
    const cat=new CatRoutine(new Supplies(),{random:()=>(i+.5)/8});
    assert.equal(cat.mode,'sleep');starts.add(cat.poseYaw);
    const motionFacing=cat.motion.facing;
    for(const mode of ['look','groom','sleep']){
      const previous=cat.lastRestYaw;cat.rest(mode,100);
      assert.notEqual(cat.poseYaw,previous,'consecutive rests should use different views');
      assert.equal(cat.motion.facing,motionFacing,'rest direction must not overwrite travel direction');
    }
  }
  assert.deepEqual([...starts],Array.from({length:8},(_,i)=>i*Math.PI/4));
});

test('one heading is held throughout rest, pause and the rise before departure',()=>{
  let draws=0;
  const cat=new CatRoutine(new Supplies(),{random:()=>{draws++;return .1;}});
  cat.hunger=100;
  for(const mode of ['look','groom','sleep']){
    cat.rest(mode,100);const yaw=cat.poseYaw,count=draws;
    for(let i=0;i<120;i++)cat.update(1/60);
    cat.update(0);
    assert.equal(cat.poseYaw,yaw);assert.equal(draws,count);
  }
  const yaw=cat.poseYaw;
  cat.depart(()=>{cat.mode='walk';cat.motion.goTo({floor:0,x:840});},'walk');
  cat.update(.1);assert.equal(cat.poseYaw,yaw);
  cat.update(2);assert.equal(cat.mode,'walk');assert.equal(cat.poseYaw,cat.motion.laneYaw);
});

test('feeding, play and movement keep their directed headings',()=>{
  let draws=0;
  const cat=new CatRoutine(new Supplies(),{random:()=>{draws++;return .4;}});
  for(const mode of ['eat','play']){
    const count=draws;cat.rest(mode,8);
    assert.equal(cat.poseYaw,null);assert.equal(draws,count);
  }
  // The existing seated release from play must not recover an old sleeping heading.
  cat.mode='look';assert.equal(cat.poseYaw,null);
  cat.rest('groom',8);
  cat.motion.queue=[{type:'depth',z:cat.motion.z-1}];
  assert.equal(cat.poseYaw,Math.PI);
  cat.motion.queue=[{type:'walk',x:cat.motion.x+10}];
  assert.equal(cat.poseYaw,null);
  cat.motion.queue=[];cat.motion.hop={phase:'prepare'};
  assert.equal(cat.poseYaw,null);
  cat.motion.hop=null;cat.motion.portal={phase:'turnIn'};
  assert.equal(cat.poseYaw,null);
});
