import test from 'node:test';
import assert from 'node:assert/strict';
import {MeshStandardMaterial,Raycaster,Vector3} from 'three';
import {CABIN_AISLE,CAT_PORT,CAT_SOFA,CAT_BOWL,LOUNGE_SEAT} from '../src/obs/layout.js';
import {CrewMotion,CatMotion,CatRoutine,Supplies,advanceCabinTraffic} from '../src/obs/state.js';
import {createDeckFloor} from '../src/obs/ship.js';

const setup=(floor=2,x=600)=>{
  const actor=new CrewMotion({floor,x:x-100}),cat=new CatRoutine(new Supplies(),{random:()=>.5});
  cat.motion=new CatMotion({floor,x});cat.mode='fetch';cat.hunger=90;
  return{actor,cat,step:()=>advanceCabinTraffic(actor,cat,1/60)};
};

test('separate lanes are supported across all decks without filling the ladder well',()=>{
  assert(CAT_PORT.walkZ-CABIN_AISLE.crewZ>1);assert(CABIN_AISLE.deckFront-CAT_PORT.walkZ>.5);
  assert.equal(CAT_BOWL.depth,.89);assert.equal(CAT_SOFA.approachZ,.89);assert.equal(LOUNGE_SEAT.centerDepth,-.10);
  const material=new MeshStandardMaterial(),m=new Proxy({},{get:()=>material});
  for(let level=0;level<3;level++){
    const root=createDeckFloor(m,0,level);root.updateMatrixWorld(true);
    const down=(x,z)=>new Raycaster(new Vector3(x,.3,z),new Vector3(0,-1,0)).intersectObject(root,true);
    for(const x of [-12,-6,-.4,0,.4,6,12])assert(down(x,CAT_PORT.walkZ).some(hit=>hit.point.y>-.03));
    if(level<2)assert.equal(down(0,.1).length,0);
    root.traverse(o=>o.geometry?.dispose());
  }
  material.dispose();
});

test('opposite-direction and overtaking walks never wait or leave their lanes',()=>{
  for(const direction of [-1,1]){
    const {actor,cat,step}=setup();actor.x=direction===-1?700:550;
    actor.goTo({floor:2,x:direction===-1?500:850});cat.motion.goTo({floor:2,x:750});
    let sameX=false;
    for(let i=0;i<9*60;i++){step();if(Math.abs(actor.x-cat.motion.x)<3)sameX=true;assert(!actor.waitingForCat&&!cat.motion.waitingForCrew);assert.equal(cat.motion.z,CAT_PORT.walkZ);}
    assert(sameX);assert.equal(cat.motion.busy,false);
  }
});

test('cat waits on the front aisle for an approaching person before docking at the bowl',()=>{
  const {actor,cat,step}=setup(2,CAT_BOWL.approachX);actor.x=CAT_BOWL.approachX-80;actor.goTo({floor:2,x:CAT_BOWL.approachX+130});
  cat.rest('look',0);cat.fetch();let waited=false,entered=false;
  for(let i=0;i<12*60;i++){
    const z=cat.motion.z,distance=cat.motion.depthWalkDistance;step();
    if(cat.motion.waitingForCrew){waited=true;assert.equal(cat.motion.z,z);assert.equal(distance,cat.motion.depthWalkDistance);}
    if(cat.motion.z<CAT_PORT.walkZ-.01){entered=true;assert(actor.x>CAT_BOWL.approachX+30);}
    if(cat.mode==='eat')break;
  }
  assert(waited&&entered);assert.equal(cat.mode,'eat');assert.equal(cat.care.supplies.catfood,2);assert.equal(cat.motion.z,CAT_BOWL.depth);
});

test('a person arriving after a crossing starts yields until it clears, without deadlock',()=>{
  const {actor,cat,step}=setup(2,CAT_BOWL.approachX);actor.x=CAT_BOWL.approachX-140;
  cat.motion.goTo({floor:2,x:CAT_BOWL.approachX,z:CAT_BOWL.depth},()=>cat.rest('eat',8));
  for(let i=0;i<30;i++)step();assert(cat.motion.crossing.active);
  actor.goTo({floor:2,x:CAT_BOWL.approachX+140});let waited=false;
  for(let i=0;i<18*60;i++){
    const x=actor.x,distance=actor.walkDistance;step();
    if(actor.waitingForCat){waited=true;assert.equal(actor.x,x);assert.equal(actor.walkDistance,distance);}
    assert(!(actor.waitingForCat&&cat.motion.waitingForCrew));
  }
  assert(waited);assert.equal(actor.busy,false);assert.equal(cat.motion.z,CAT_PORT.walkZ);
});

test('a changed destination cancels a waiting dock, and pause preserves both actors exactly',()=>{
  const {actor,cat,step}=setup();actor.x=cat.motion.x;
  let old=0,latest=0;cat.motion.goTo({floor:2,x:600,z:CAT_BOWL.depth},()=>old++);step();step();assert(cat.motion.waitingForCrew);
  const snapshot=JSON.stringify([actor,cat.motion]);advanceCabinTraffic(actor,cat,0);assert.equal(JSON.stringify([actor,cat.motion]),snapshot);
  cat.motion.goTo({floor:2,x:700},()=>latest++);
  for(let i=0;i<7*60;i++)step();
  assert.equal(old,0);assert.equal(latest,1);assert.equal(cat.motion.z,CAT_PORT.walkZ);assert(!cat.motion.waitingForCrew);
});

test('sofa boarding and leaving keep the original jump depths and return to the front aisle',()=>{
  const {actor,cat,step}=setup(0,CAT_SOFA.floorX);actor.x=CAT_SOFA.floorX-100;
  for(const up of [true,false]){
    cat.mode='fetch';cat.motion.goTo({floor:0,x:up?CAT_SOFA.seatX:CAT_SOFA.floorX},()=>cat.rest('look',100));
    let flight=false,last=[cat.motion.x,cat.motion.z,cat.motion.elevation];
    for(let i=0;i<8*60;i++){
      step();const motion=cat.motion,point=[motion.x,motion.z,motion.elevation];
      assert(Math.abs(point[1]-last[1])<.10);last=point;
      if(motion.hop?.phase==='flight'){flight=true;assert(motion.z>=LOUNGE_SEAT.centerDepth&&motion.z<=CAT_SOFA.approachZ);}
      if(!motion.busy)break;
    }
    assert(flight);assert.equal(cat.motion.busy,false);assert.equal(cat.motion.z,up?LOUNGE_SEAT.centerDepth:CAT_PORT.walkZ);
  }
});

test('a wall entry waits for the person and later exits fully onto the front aisle',()=>{
  const {actor,cat,step}=setup(1,CAT_PORT.x);actor.x=CAT_PORT.x;cat.motion.goTo({floor:2,x:760},()=>cat.rest('look',100));
  for(let i=0;i<60;i++)step();assert(cat.motion.waitingForCrew);assert.equal(cat.motion.z,CAT_PORT.walkZ);
  actor.goTo({floor:1,x:CAT_PORT.x+200});
  for(let i=0;i<18*60;i++)step();
  assert.equal(cat.motion.floor,2);assert.equal(cat.motion.busy,false);assert.equal(cat.motion.z,CAT_PORT.walkZ);assert.equal(cat.motion.hidden,false);
});
