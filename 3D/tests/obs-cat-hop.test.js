import test from 'node:test';
import assert from 'node:assert/strict';
import {MeshStandardMaterial,Vector3} from 'three';
import {CatMotion} from '../src/obs/state.js';
import {CAT_SOFA,CAT_PORT,LOUNGE_SEAT} from '../src/obs/layout.js';
import {createCat,animateCat} from '../src/obs/characters.js';
const advance=(motion,seconds)=>{for(let i=0;i<seconds*120;i++)motion.update(1/120);};

for(const up of [true,false])test(`cat hops ${up?'onto':'off'} the sofa and lands before arrival`,()=>{
  const cat=new CatMotion({floor:CAT_SOFA.floor,x:up?CAT_SOFA.floorX:CAT_SOFA.seatX}),phases=[];
  let arrived=0,peak=0,airSteps=0;
  cat.goTo({floor:CAT_SOFA.floor,x:up?CAT_SOFA.seatX:CAT_SOFA.floorX},()=>arrived++);
  for(let i=0;i<6*120;i++){
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
  const cat=new CatMotion({floor:CAT_SOFA.floor,x:CAT_SOFA.floorX});let old=0,latest=0;
  cat.goTo({floor:CAT_SOFA.floor,x:1060},()=>old++);advance(cat,(CAT_PORT.walkZ-CAT_SOFA.approachZ)/(cat.walkSpeed*.022)+.4);
  assert.equal(cat.hop.phase,'flight');assert.equal(cat.hop.up,true);
  const position=[cat.x,cat.elevation,cat.z],age=cat.hop.age;
  cat.update(0);cat.goTo({floor:2,x:800},()=>latest++);cat.update(0);
  assert.deepEqual([cat.x,cat.elevation,cat.z],position);assert.equal(cat.hop.age,age);
  // Include both hops, the aisle walk and the full passage. Wait for completion
  // within a bounded budget rather than assuming a fixed route duration.
  const phases=[],maxSeconds=90;
  for(let frame=0;frame<maxSeconds*120&&cat.busy;frame++){
    if(cat.hop){
      const phase=`${cat.hop.up?'up':'down'}:${cat.hop.phase}`;
      if(phases.at(-1)!==phase)phases.push(phase);
      assert.equal(latest,0,'arrival must not fire during either jump');
    }
    cat.update(1/120);
  }
  assert.deepEqual(phases,['up:flight','up:land','down:prepare','down:flight','down:land']);
  assert.equal(cat.busy,false,`retargeted route did not finish within ${maxSeconds} simulated seconds`);
  assert.equal(old,0);assert.equal(latest,1);assert.equal(cat.floor,2);assert.equal(cat.x,800);
  assert.equal(cat.elevation,0);assert.equal(cat.onSofa,false);assert.equal(cat.z,CAT_PORT.walkZ);
  advance(cat,1);assert.equal(old,0);assert.equal(latest,1,'arrival must fire exactly once');
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
