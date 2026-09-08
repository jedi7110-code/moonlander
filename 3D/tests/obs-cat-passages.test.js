import test from 'node:test';
import assert from 'node:assert/strict';
import {Box3,MeshStandardMaterial} from 'three';
import {CatMotion,FLOORS} from '../src/obs/state.js';
import {CAT_PORT} from '../src/obs/layout.js';
import {createCat,animateCat} from '../src/obs/characters.js';

const advance=(motion,seconds)=>{for(let i=0;i<seconds*60;i++)motion.update(1/60);};
test('same-deck routes stay on the floor without using a passage',()=>{
  const cat=new CatMotion({floor:0,x:800});let arrived=0;cat.goTo({floor:0,x:850},()=>arrived++);advance(cat,2);
  assert.equal(arrived,1);assert.equal(cat.x,850);assert.equal(cat.y,FLOORS[0].y);assert.equal(cat.portal,null);assert.equal(cat.z,CAT_PORT.walkZ);
});
test('floor changes enter a wall, hide for transit, and emerge before walking away',()=>{
  const cat=new CatMotion({floor:0,x:800}),phases=[];let arrived=0,transitFrames=0;
  cat.goTo({floor:2,x:1000},()=>arrived++);
  for(let i=0;i<30*60;i++){
    cat.update(1/60);assert.equal(cat.climbing,false);assert.ok(cat.queue.every(part=>part.type==='walk'));
    if(cat.portal){if(phases.at(-1)!==cat.portal.phase)phases.push(cat.portal.phase);assert.equal(cat.x,CAT_PORT.x);}
    if(cat.hidden){transitFrames++;assert.equal(cat.z,CAT_PORT.insideZ);assert.ok(cat.y>=FLOORS[0].y&&cat.y<=FLOORS[2].y);assert.equal(arrived,0);}
  }
  assert.deepEqual(phases,['turnIn','enter','transit','exit','turnOut']);assert.ok(transitFrames>240);
  assert.equal(arrived,1);assert.equal(cat.floor,2);assert.equal(cat.x,1000);assert.equal(cat.y,FLOORS[2].y);assert.equal(cat.z,CAT_PORT.walkZ);assert.equal(cat.busy,false);
});
test('retargeting before a hole replaces the old route without entering it',()=>{
  const cat=new CatMotion({floor:0,x:1000});let old=0,latest=0;cat.goTo({floor:2,x:900},()=>old++);advance(cat,1);
  cat.goTo({floor:0,x:950},()=>latest++);advance(cat,2);assert.equal(cat.portal,null);assert.equal(old,0);assert.equal(latest,1);
});
test('retargeting inside the wall preserves the occupied passage and only the newest callback',()=>{
  const cat=new CatMotion({floor:0,x:CAT_PORT.x});let old=0,latest=0;
  cat.goTo({floor:2,x:1155},()=>old++);advance(cat,4);assert.equal(cat.hidden,true);
  const position=[cat.x,cat.y,cat.z],exit=cat.portal.to;
  cat.goTo({floor:1,x:940},()=>latest++);assert.deepEqual([cat.x,cat.y,cat.z],position);assert.equal(cat.portal.to,exit);
  advance(cat,30);assert.equal(old,0);assert.equal(latest,1);assert.equal(cat.floor,1);assert.equal(cat.x,940);
});
test('pause preserves passage progress and invalid orders do not replace a valid route',()=>{
  const cat=new CatMotion({floor:1,x:CAT_PORT.x});cat.goTo({floor:0,x:800});advance(cat,1);
  const pose=cat.passagePose,position=[cat.x,cat.y,cat.z],age=cat.portal.age;
  cat.update(0);cat.goTo({floor:10,x:500});assert.deepEqual(cat.passagePose,pose);assert.deepEqual([cat.x,cat.y,cat.z],position);assert.equal(cat.portal.age,age);
  advance(cat,20);assert.equal(cat.floor,0);assert.equal(cat.x,800);
});
test('the crouched cat clears the mouth and disappears tail-last behind the wall',()=>{
  const material=new MeshStandardMaterial(),root=createCat(new Proxy({},{get:()=>material})),motion=new CatMotion({floor:0,x:CAT_PORT.x});
  motion.goTo({floor:1,x:900});let time=0,sawPartial=false;
  for(let i=0;i<4*60;i++){
    time+=1/60;motion.update(1/60);const passage=motion.passagePose;
    root.position.set(0,0,motion.z);animateCat(root,{time,moving:passage?.phase==='enter',climbing:false,facing:motion.facing,mode:'walk',passage});root.updateMatrixWorld(true);
    if(passage?.phase==='enter'){
      const bounds=new Box3().setFromObject(root);
      if(bounds.min.z<CAT_PORT.wallZ&&bounds.max.z>CAT_PORT.wallZ){sawPartial=true;assert.ok(bounds.max.y<CAT_PORT.height+.045);}
    }
    if(motion.hidden){const bounds=new Box3().setFromObject(root);assert.ok(bounds.max.z<CAT_PORT.wallZ);break;}
  }
  assert.equal(sawPartial,true);assert.equal(motion.hidden,true);
});
