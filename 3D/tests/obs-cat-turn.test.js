import test from 'node:test';
import assert from 'node:assert/strict';
import {createCatTurn,sampleCatTurn,angleDelta} from '../src/obs/cat-turn.js';
import {CatMotion,CatRoutine,Supplies} from '../src/obs/state.js';

test('turns take the short arc, ease at both ends and keep stepping support',()=>{
  const t=createCatTurn(Math.PI-.1,-Math.PI+.1);
  assert(Math.abs(t.delta-.2)<1e-12);
  for(const angle of [Math.PI/4,Math.PI/2,Math.PI,-Math.PI]){
    const turn=createCatTurn(0,angle);let last=sampleCatTurn(turn);
    for(let i=1;i<=120;i++){
      turn.age=turn.duration*i/120;const pose=sampleCatTurn(turn);
      assert(Math.abs(pose.yaw-last.yaw)<.07);
      assert(Object.values(pose.feet).every(f=>f.lift>=0&&f.lift<=.018));
      assert(Object.values(pose.feet).filter(f=>f.lift>.0001).length<=2);
      last=pose;
    }
    assert(Math.abs(angleDelta(last.yaw,angle))<1e-12);
    assert(Object.values(last.feet).every(f=>f.lift<1e-12&&Math.abs(f.yaw-angle)<1e-12));
    assert(last.weight<1e-12);
  }
});

test('head, front paws, hindquarters and tail follow in that order',()=>{
  for(const angle of [Math.PI,-Math.PI,Math.PI/2]){
    const turn=createCatTurn(0,angle),sign=Math.sign(angle);
    turn.age=turn.duration*.4;const p=sampleCatTurn(turn);
    assert(sign*p.headYaw>sign*p.frontYaw);
    assert(sign*p.frontYaw>sign*p.rearYaw);
    assert(sign*p.rearYaw>sign*p.tailYaw);
    turn.age=turn.duration*.05;const start=sampleCatTurn(turn);
    assert(sign*start.headYaw>0);assert.equal(start.frontYaw,0);assert.equal(start.rearYaw,0);assert.equal(start.tailYaw,0);
    turn.age=turn.duration*.96;const end=sampleCatTurn(turn);
    assert.equal(end.frontYaw,angle);assert.equal(end.rearYaw,angle);assert(sign*end.tailYaw<sign*angle);
  }
});

test('travel waits for the planted turn, pause freezes it and new destinations do not snap',()=>{
  const m=new CatMotion({turns:true,floor:0,x:800});m.face(0);
  m.goTo({floor:0,x:700});m.update(1/60);
  assert(m.turn);const x=m.x,yaw=m.heading;
  m.update(0);assert.equal(m.x,x);assert.equal(m.heading,yaw);
  while(m.turn){m.update(1/60);assert.equal(m.x,x);}
  assert(Math.abs(angleDelta(m.heading,-Math.PI/2))<1e-12);
  m.update(1/60);assert(m.x<x);
  m.goTo({floor:0,x:850});m.update(1/60);assert(m.turn);
  m.update(.3);const old=m.heading;m.goTo({floor:0,x:650});
  assert.equal(m.heading,old);
});

test('rest does not start its action clock until turning has finished',()=>{
  const cat=new CatRoutine(new Supplies(),{turns:true,random:()=>.1});
  cat.rest('groom',20);assert(cat.motion.turn);
  const position=[cat.motion.x,cat.motion.z];
  while(cat.motion.turn){cat.update(1/60);assert.equal(cat.modeTime,0);assert.deepEqual([cat.motion.x,cat.motion.z],position);}
  cat.update(1/60);assert(cat.modeTime>0);
  assert(Math.abs(angleDelta(cat.poseYaw,cat.restYaw))<1e-12);
});

test('turn-enabled routes still arrive once through sofa hops and wall passages',()=>{
  const cat=new CatRoutine(new Supplies(),{turns:true,random:()=>.5});
  cat.mode='walk';cat.motion.turn=null;let arrived=0;
  cat.motion.goTo({floor:2,x:1000},()=>arrived++);
  const phases=new Set();let lastYaw=cat.poseYaw;
  for(let i=0;i<90*60&&cat.motion.busy;i++){
    cat.update(1/60);
    if(cat.motion.portal)phases.add(cat.motion.portal.phase);
    if(!cat.motion.hidden)assert(Math.abs(angleDelta(lastYaw,cat.poseYaw))<.08,'visible heading snaps');
    lastYaw=cat.poseYaw;
  }
  assert.equal(arrived,1);assert.equal(cat.motion.floor,2);assert.equal(cat.motion.x,1000);
  assert.deepEqual([...phases],['turnIn','enter','transit','exit','turnOut']);
});
