import test from 'node:test';
import assert from 'node:assert/strict';
import {CrewMotion,advanceCabinTraffic,ROBOT_DETOUR} from '../src/obs/state.js';
import {FLOORS} from '../src/obs/layout.js';
import {worldActor} from '../src/obs/curtis-traffic.js';

const cat={motion:{blocksCrew:()=>false},update(){}};
const px=x=>700+x/.022,deckY=floor=>(870-FLOORS[floor].y)*.016;
const robot=(x,z,floor,step=null)=>({position:{x,y:deckY(floor),z},step,docked:false,waiting:false,onStairTrip:()=>false});

test('Milo walks round the robot standing at work in his lane and comes back to the lane without a sideways jump',()=>{
  // the galley spot: the robot cooks 0.12 m from the middle of the crew lane
  for(const [from,to] of [[-7.5,-11.9],[-11.9,-7.5]]){
    const droid=robot(-10.25,.66,2,{kind:'work'}),actor=new CrewMotion({floor:2,x:px(from)});
    let arrived=false,closest=9,widest=0,previous=worldActor(actor).z,jump=0;
    actor.goTo({floor:2,x:px(to)},()=>{arrived=true;});
    for(let i=0;i<60*30&&actor.busy;i++){
      advanceCabinTraffic(actor,cat,1/60,droid);
      const p=worldActor(actor);closest=Math.min(closest,Math.hypot(p.x-droid.position.x,p.z-droid.position.z));
      widest=Math.max(widest,p.z);jump=Math.max(jump,Math.abs(p.z-previous));previous=p.z;
    }
    assert(arrived,'arrives');
    assert(closest>=ROBOT_DETOUR.clear-.02,`passes ${closest.toFixed(2)} m from the robot`);
    assert(jump<.02,`no sideways jump (${jump.toFixed(3)} m in a frame)`);
    assert(Math.abs(worldActor(actor).z-.78)<1e-6,'back on the lane');
    // once Milo has left the bend it is taken away again
    advanceCabinTraffic(actor,cat,1/60,robot(3,1.48,2,{kind:'work'}));
    assert.equal(actor.loungeAvoidance,null);
  }
});

test('the bend is not put under Milo\'s feet, and a robot on its own lane leaves his lane alone',()=>{
  const actor=new CrewMotion({floor:2,x:px(-10.6)});actor.goTo({floor:2,x:px(-7.5)});
  advanceCabinTraffic(actor,cat,1/60,robot(-10.25,.66,2,{kind:'work'}));
  assert.equal(actor.loungeAvoidance??null,null,'Milo is already beside the robot');
  const far=new CrewMotion({floor:2,x:px(-7.5)});far.goTo({floor:2,x:px(-11.9)});
  advanceCabinTraffic(far,cat,1/60,robot(-10.25,1.48,2,{kind:'work'}));
  assert.equal(far.loungeAvoidance??null,null,'robot on its own lane');
  advanceCabinTraffic(far,cat,1/60,robot(-10.25,.66,1,{kind:'work'}));
  assert.equal(far.loungeAvoidance??null,null,'robot on another deck');
});

test('Milo lets the robot cross his lane and neither walks into the other',()=>{
  // the top deck: the robot walks from its dock across the crew lane to its own lane
  for(const start of [-12.9,-12.5,-12.2,-11.0,-10.6]){
    const actor=new CrewMotion({floor:0,x:px(start)});let arrived=false;
    actor.goTo({floor:0,x:px(start<-11.92?-9.5:-13.2)},()=>{arrived=true;});
    const droid=robot(-11.92,-.52,0,{kind:'walk',to:{x:-11.92,y:deckY(0),z:1.48}});
    let closest=9,waited=0;
    for(let i=0;i<60*40&&(actor.busy||droid.position.z<1.48);i++){
      advanceCabinTraffic(actor,cat,1/60,droid);if(actor.waitingForStairs)waited+=1/60;
      // the robot crosses at 0.58 m/s unless that brings it into Milo, who is not already waiting for it
      const crew=worldActor(actor),next=Math.min(1.48,droid.position.z+.58/60);
      const before=Math.hypot(droid.position.x-crew.x,droid.position.z-crew.z),after=Math.hypot(droid.position.x-crew.x,next-crew.z);
      if(!(after<.5&&after<before&&!(actor.robotWait>0)))droid.position.z=next;
      if(droid.position.z>=1.48)droid.step={kind:'turn'};
      const p=worldActor(actor);closest=Math.min(closest,Math.hypot(p.x-droid.position.x,p.z-droid.position.z));
    }
    assert(arrived,`Milo arrives (start ${start})`);assert(droid.position.z>=1.48,'the robot arrives');
    assert(closest>.4,`start ${start}: closest ${closest.toFixed(2)} m`);
    assert(waited<ROBOT_DETOUR.limit,`start ${start}: Milo waits ${waited.toFixed(1)} s`);
  }
});
