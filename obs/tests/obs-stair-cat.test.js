import test from 'node:test';
import assert from 'node:assert/strict';
import {CatMotion,CrewMotion} from '../src/obs/state.js';
import {FLOORS,CAT_PORT} from '../src/obs/layout.js';
import {CabinStairs} from '../src/obs/stair-traffic.js';
import {stairTrip} from '../src/obs/stair-trip.js';

function cat(floor,stairs){
  const motion=new CatMotion({turns:true});motion.stairs=stairs;
  Object.assign(motion,{floor,y:FLOORS[floor].y,x:420,z:CAT_PORT.walkZ,onSofa:false,elevation:0});
  return motion;
}
const run=(motion,stairs,seconds,each=()=>{})=>{const crew=new CrewMotion({floor:2,x:1300});for(let i=0;i<seconds*60;i++){stairs.update(1/60);motion.update(1/60,crew,null);each(i);if(!motion.busy&&!motion.destination)break;}};

test('Lucy changes decks by the stair tower and arrives at her destination',()=>{
  for(const [from,to] of [[1,0],[1,2],[0,2],[2,0]]){
    const stairs=new CabinStairs(),motion=cat(from,stairs);let arrived=false,used=false,portal=false,prev=null,maxStep=0;
    motion.goTo({floor:to,x:500,z:CAT_PORT.walkZ},()=>{arrived=true;});
    run(motion,stairs,240,()=>{
      used||=Boolean(motion.onStairs);portal||=Boolean(motion.portal);
      const p={x:(motion.x-700)*.022,y:(870-motion.y)*.016,z:motion.z};if(prev)maxStep=Math.max(maxStep,Math.hypot(p.x-prev.x,p.y-prev.y,p.z-prev.z));prev=p;
    });
    assert(arrived,`${from}->${to} arrives`);assert(used&&!portal,`${from}->${to} by the stairs`);
    assert.equal(motion.floor,to);assert.equal(motion.y,FLOORS[to].y);assert.equal(motion.x,500);
    assert(maxStep<.03,`${from}->${to} continuous (${maxStep.toFixed(3)})`);assert.equal(stairs.count,0);
  }
});

test('a crowded tower sends Lucy through her wall passage instead',()=>{
  const stairs=new CabinStairs();stairs.enter({},'crew',stairTrip(1,0,{fromZ:CAT_PORT.walkZ,toZ:CAT_PORT.walkZ}),.2);
  const motion=cat(1,stairs);let arrived=false,portal=false;
  motion.goTo({floor:0,x:500,z:CAT_PORT.walkZ},()=>{arrived=true;});
  run(motion,stairs,240,()=>{portal||=Boolean(motion.portal);});
  assert(portal,'used the wall passage');assert(arrived);assert.equal(motion.floor,0);
});

test('Lucy on the stairs does not hold the crew with an aisle crossing',()=>{
  const stairs=new CabinStairs(),motion=cat(1,stairs);motion.goTo({floor:0,x:500,z:CAT_PORT.walkZ});
  let checked=false;
  run(motion,stairs,240,()=>{if(motion.onStairs){assert.equal(motion.crossing,null);checked=true;}});
  assert(checked);
});

test('a new destination while Lucy is on the stairs is followed after the trip, never in mid-air',()=>{
  const stairs=new CabinStairs(),motion=cat(1,stairs);let arrived=false,retargeted=false;
  motion.goTo({floor:0,x:500,z:CAT_PORT.walkZ});
  run(motion,stairs,240,()=>{
    if(!retargeted&&motion.onStairs&&motion.onStairs.t>3){retargeted=true;motion.goTo({floor:1,x:900,z:CAT_PORT.walkZ},()=>{arrived=true;});}
    if(!motion.onStairs&&!motion.portal)assert(Math.abs(motion.y-FLOORS[motion.floor].y)<1e-9||motion.queue[0]?.type==='stairs','on a floor when off the stairs');
  });
  assert(retargeted&&arrived);assert.equal(motion.floor,1);assert.equal(motion.y,FLOORS[1].y);assert.equal(motion.x,900);
});
