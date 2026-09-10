import test from 'node:test';
import assert from 'node:assert/strict';
import {MeshStandardMaterial,Vector3} from 'three';
import {CatMotion} from '../src/obs/state.js';
import {CAT_SOFA,CAT_PORT,LOUNGE_SEAT} from '../src/obs/layout.js';
import {createCat,animateCat} from '../src/obs/characters.js';
const advance=(motion,seconds)=>{for(let i=0;i<seconds*120;i++)motion.update(1/120);};

for(const up of [true,false])test(`cat hops ${up?'onto':'off'} the sofa and lands before arrival`,()=>{
  const cat=new CatMotion({floor:0,x:up?CAT_SOFA.floorX:CAT_SOFA.seatX}),phases=[];
  let arrived=0,peak=0,airSteps=0;
  cat.goTo({floor:0,x:up?CAT_SOFA.seatX:CAT_SOFA.floorX},()=>arrived++);
  for(let i=0;i<180;i++){
    const distance=cat.walkDistance;cat.update(1/120);peak=Math.max(peak,cat.elevation);
    if(cat.hop){if(phases.at(-1)!==cat.hop.phase)phases.push(cat.hop.phase);assert.equal(arrived,0);
      if(cat.hop.phase==='flight'){airSteps++;assert.equal(cat.walkDistance,distance);}
    }
  }
  assert.deepEqual(phases,['prepare','flight','land']);assert.ok(airSteps>50);assert.ok(peak>LOUNGE_SEAT.top);
  assert.equal(cat.onSofa,up);assert.equal(cat.elevation,up?LOUNGE_SEAT.top:0);assert.equal(cat.z,up?LOUNGE_SEAT.centerDepth:CAT_PORT.walkZ);
  assert.equal(arrived,1);assert.equal(cat.busy,false);
});
test('retargeting a jump finishes the landing before reversing, including pause',()=>{
  const cat=new CatMotion({floor:0,x:CAT_SOFA.floorX});let old=0,latest=0;
  cat.goTo({floor:0,x:1060},()=>old++);advance(cat,.4);
  const position=[cat.x,cat.elevation,cat.z],age=cat.hop.age;
  cat.update(0);cat.goTo({floor:2,x:800},()=>latest++);
  assert.deepEqual([cat.x,cat.elevation,cat.z],position);assert.equal(cat.hop.age,age);
  advance(cat,35);assert.equal(old,0);assert.equal(latest,1);assert.equal(cat.floor,2);assert.equal(cat.elevation,0);assert.equal(cat.onSofa,false);
});
test('jump poses fold the legs in flight and recover without changing size',()=>{
  const material=new MeshStandardMaterial(),root=createCat(new Proxy({},{get:()=>material}));
  const pose=hop=>animateCat(root,{time:1,moving:true,facing:1,mode:'walk',walkDistance:0,hop});
  pose({phase:'prepare',age:.07,duration:.14});assert.ok(root.userData.body.position.y<-.06);
  pose({phase:'flight',age:.28,duration:.56});root.updateMatrixWorld(true);
  for(const leg of root.userData.legs)assert.ok(leg.paw.getWorldPosition(new Vector3()).y>.09);
  pose({phase:'land',age:.09,duration:.18});assert.ok(root.userData.body.position.y<-.06);
  pose(null);assert.ok(Math.abs(root.userData.body.position.y)<.005);assert.equal(root.scale.x,.8);
});
