// The crew, the visitor and the droid take the central ladder when it is the quicker way between
// decks, and the stairs at the ends of the cabin when those are (stair-traffic.js, ladderQuicker).
import test from 'node:test';
import assert from 'node:assert/strict';
import {CabinStairs,stairSeconds,ladderSeconds} from '../src/obs/stair-traffic.js';
import {CrewMotion} from '../src/obs/state.js';
import {CurtisRoutine,CURTIS} from '../src/obs/curtis-routine.js';
import {DroidRoutine} from '../src/obs/droid-routine.js';
import {Supplies} from '../src/obs/state.js';

const px=x=>700+x/.022;
const route=(stairs,fromX,toX)=>{const a=new CrewMotion({floor:1,x:px(fromX),planned:true});a.stairs=stairs;return a.planRoute({floor:0,x:px(toX)}).map(s=>s.type);};

test('Milo takes the ladder from the middle of the cabin and the stairs near their tower',()=>{
  const stairs=new CabinStairs({right:true});
  assert.ok(route(stairs,1,2).includes('climb'),'middle: the ladder');
  assert.ok(route(stairs,6,-2).includes('climb'),'across the middle: the ladder');
  assert.ok(route(stairs,-11,-11).includes('stairs'),'by the tower: the stairs');
  // and each way's time is what was compared
  const trip=stairs.trip(1,0,1,2),w={speed:1.188,climb:.73,transfer:6};
  assert.ok(ladderSeconds(trip,1,2,w)<stairSeconds(trip,1,2,w.speed));
  // the stair studies keep the stairs whenever they are usable
  assert.ok(route(new CabinStairs({right:true,quickest:false}),1,2).includes('stairs'));
});

test('Curtis goes from the lounge deck to the rear room by the ladder, the quicker way',()=>{
  const c=new CurtisRoutine({random:()=>.3,planned:true,firstDelay:0});c.ready=true;c.stairs=new CabinStairs({right:true});
  c.update(1/60);
  assert.equal(c.steps.filter(s=>s.kind==='stairs').length,0);
  assert.equal(c.steps.filter(s=>s.kind==='climb').length,3,'down the shaft, between the decks, and out');
});

test('the droid takes the ladder from the middle and a tower near the end',()=>{
  const care=new Supplies(),droid=new DroidRoutine({care});droid.stairs=new CabinStairs({right:true});
  const kinds=(fromX,toX)=>{droid.steps=[];droid.plan={x:fromX,y:3.392,z:1.48,floor:1,yaw:0};droid.travel(0,toX,1.48);return droid.steps.map(s=>s.kind);};
  assert.ok(kinds(1,2).includes('climb'));assert.ok(!kinds(1,2).includes('stairs'));
  assert.ok(kinds(-11,-11).includes('stairs'));
});
