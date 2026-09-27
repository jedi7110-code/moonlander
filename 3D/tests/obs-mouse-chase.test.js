import test from 'node:test';
import assert from 'node:assert/strict';
import {CatRoutine,Supplies,FLOORS,CrewMotion,advanceCabinTraffic} from '../src/obs/state.js';
import {CAT_PORT} from '../src/obs/layout.js';
import {RUN_SPEED,MOUSE_WALK_SPEED} from '../src/obs/lucy-run-motion.js';

function fixture({floor=2,x=510,facing=1}={}){
  const cat=new CatRoutine(new Supplies(),{turns:true,mouseChase:true,random:()=>.5});
  Object.assign(cat.motion,{floor,x,y:FLOORS[floor].y,z:CAT_PORT.walkZ,onSofa:false,elevation:0,heading:facing*Math.PI/2,facing,turn:null});
  Object.assign(cat,{mode:'idle',modeTime:0,remaining:100,hunger:90,energy:90});
  return cat;
}
const advance=(cat,seconds,check=()=>{})=>{for(let t=0;t<seconds-1e-9;t+=1/60){cat.update(1/60);check(cat);}};

test('OBS uses the approved study chase on every floor without teleporting Lucy or changing her lane',()=>{
  for(const floor of [0,1,2])for(const facing of [-1,1]){
    const cat=fixture({floor,x:facing===1?510:1000,facing}),start=cat.motion.x,route=cat.mouseChase;
    assert.equal(route.appear(cat,floor),true);assert.equal(cat.motion.x,start);
    let previous=start,fastest=0,travel=0;
    for(let i=0;i<900&&route.controlled;i++){
      cat.update(1/60);
      assert.equal(cat.motion.floor,floor);assert.equal(cat.motion.y,FLOORS[floor].y);assert.equal(cat.motion.z,CAT_PORT.walkZ);
      assert.ok(Math.abs(cat.motion.x-previous)*.022<=RUN_SPEED/60+1e-8,'no position jumps');
      travel+=Math.abs(cat.motion.x-previous)*.022;previous=cat.motion.x;
      fastest=Math.max(fastest,route.pose?.speed??0);
    }
    assert.ok(fastest>2.5);assert.ok(travel>4);assert.equal(route.controlled,false);assert.equal(route.mouse.visible,false);
    assert.equal(cat.motion.chase,null);assert.equal(cat.motion.turn,null);assert.ok(route.wait>60);
  }
});

test('other floors and occupied activities do not interrupt Lucy',()=>{
  for(const mode of ['eat','fetch','play','joinPlay']){
    const cat=fixture();cat.mode=mode;
    cat.mouseChase.appear(cat,cat.motion.floor);
    assert.equal(cat.mouseChase.controlled,false);assert.equal(cat.pendingMove,null);assert.equal(cat.mode,mode);
    for(let i=0;i<12*60;i++){
      cat.mouseChase.update(1/60,cat);
      assert.equal(cat.mouseChase.mouse.spotted,false);assert.ok(cat.mouseChase.mouse.speed<=MOUSE_WALK_SPEED+1e-9);
    }
  }
  const cat=fixture();cat.mouseChase.appear(cat,0);advance(cat,12);
  assert.equal(cat.motion.x,510);assert.equal(cat.motion.floor,2);assert.equal(cat.mouseChase.controlled,false);
  assert.equal(cat.mouseChase.mouse.visible,true);assert.equal(cat.mouseChase.mouse.phase,'walk');
  advance(cat,36);assert.equal(cat.mouseChase.mouse.visible,false);
  for(const property of ['onSofa','portal','hop']){
    const occupied=fixture();occupied.motion[property]=true;
    occupied.mouseChase.appear(occupied,2);assert.equal(occupied.mouseChase.controlled,false);
  }
});

test('resting Lucy finishes rising before a chase and a feeding command cancels chase preparation',()=>{
  const cat=fixture();cat.mode='sleep';cat.modeTime=6;
  cat.mouseChase.appear(cat,2);
  assert.equal(cat.pendingMove.kind,'mouse');assert.equal(cat.mouseChase.controlled,false);
  advance(cat,.3);assert.equal(cat.motion.x,510);
  advance(cat,3);assert.equal(cat.mouseChase.controlled,true);
  advance(cat,3);const x=cat.motion.x;cat.fetch();
  assert.equal(cat.mouseChase.controlled,false);assert.equal(cat.mode,'fetch');assert.equal(cat.motion.x,x);
  assert.equal(cat.motion.chase,null);assert.equal(cat.pendingMove,null);
  const sleeper=fixture();sleeper.mode='sleep';sleeper.modeTime=6;
  sleeper.mouseChase.appear(sleeper,2);sleeper.fetch();
  assert.equal(sleeper.pendingMove.kind,'fetch');advance(sleeper,3);
  assert.equal(sleeper.mouseChase.controlled,false);assert.notEqual(sleeper.mode,'chase');
});

test('pause freezes appearance and pursuit, and passing crew cannot deadlock a chase',()=>{
  const cat=fixture(),route=cat.mouseChase,actor=new CrewMotion({floor:2,x:510});
  const wait=route.wait;cat.update(0);assert.equal(route.wait,wait);
  route.appear(cat,2);advance(cat,6);
  const state=JSON.stringify([route.sim,cat.motion.x,cat.motion.walkDistance]);cat.update(0);
  assert.equal(JSON.stringify([route.sim,cat.motion.x,cat.motion.walkDistance]),state);
  actor.goTo({floor:2,x:1000});
  for(let i=0;i<1200;i++){advanceCabinTraffic(actor,cat,1/60);assert.equal(actor.waitingForCat,false);}
  assert.equal(route.controlled,false);assert.equal(actor.x,1000);
});

test('occasional mice select all three floors and do not spawn again immediately after escaping',()=>{
  for(const random of [()=>0,()=>.5,()=>.99]){
    const cat=fixture(),route=cat.mouseChase;route.random=random;route.wait=.01;
    cat.update(1/60);assert.equal(route.mouse.floor,Math.floor(random()*3));assert.equal(route.mouse.visible,true);
    advance(cat,48);assert.equal(route.mouse.visible,false);assert.ok(route.wait>50);
  }
});
