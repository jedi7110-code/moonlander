import test from 'node:test';
import assert from 'node:assert/strict';
import {Group,MeshStandardMaterial} from 'three';
import {angleDelta,turnTowards} from '../src/obs/heading.js';
import {createMilo,animateMilo} from '../src/obs/characters.js';
import {BathroomVisit} from '../src/obs/bathroom.js';
import {GymVisit} from '../src/obs/gym-visit.js';
import {BunkVisit} from '../src/obs/bunk-visit.js';
import {medicalDuration} from '../src/obs/medical.js';
import {applyCabinLadder} from '../src/obs/cabin-ladder.js';
import {CatRoutine,CatMotion,Supplies} from '../src/obs/state.js';

const character=()=>createMilo(new Proxy({},{get:()=>new MeshStandardMaterial()}));
function continuity(root,label,limit=.09){
  let previous=root.rotation.y;
  return()=>{const delta=Math.abs(angleDelta(previous,root.rotation.y));assert(delta<limit,`${label}: ${delta} rad/frame`);previous=root.rotation.y;};
}
test('ordinary turns are frame-rate independent, pause exactly, and retarget from the visible heading',()=>{
  const samples=[];
  for(const fps of [30,60,120]){
    const root=new Group();root.rotation.y=Math.PI-.12;
    for(let i=0;i<fps*.5;i++)turnTowards(root,-Math.PI+.5,1/fps);
    samples.push(root.rotation.y);
    const before=root.rotation.y;turnTowards(root,-1,0);assert.equal(root.rotation.y,before);
    turnTowards(root,-1,1/fps);assert(Math.abs(angleDelta(before,root.rotation.y))<.002);
    for(let i=0;i<fps*4;i++)turnTowards(root,-1,1/fps);
    assert(Math.abs(angleDelta(root.rotation.y,-1))<1e-10);
  }
  samples.forEach(value=>assert(Math.abs(value-samples[0])<1e-10));
});

test('all ordinary Milo action headings connect smoothly from both walking directions',()=>{
  const root=character();
  for(const facing of [-1,1])for(const action of ['lounge','console','galley','hydro','plant','eva','airlock','innerHatch',null]){
    root.rotation.y=facing*Math.PI/2;delete root.userData.headingTurn;
    const check=continuity(root,`${facing} -> ${action}`);
    for(let i=0;i<180;i++){
      animateMilo(root,{moving:false,facing,action,time:i/60,actionTime:i/60,callingTime:action===null?i/60:null});check();
    }
    for(let i=0;i<180;i++){
      animateMilo(root,{moving:true,facing:-facing,action:null,time:3+i/60});check();
    }
  }
});

test('equipment entry, use, exit and the first walking frame do not reset Milo heading',()=>{
  const root=character();
  for(const start of [-Math.PI/2,Math.PI/2,Math.PI-.01])for(const action of ['shower','toilet','gym','bunk','medical']){
    root.rotation.y=start;delete root.userData.headingTurn;
    for(const key of ['medicalStartYaw','bathroomStartYaw','bunkStartYaw'])delete root.userData[key];
    const visit=action==='gym'?new GymVisit():action==='bunk'?new BunkVisit():['shower','toilet'].includes(action)?new BathroomVisit(action):null;
    if(visit)visit.startYaw=start;
    const check=continuity(root,`${start} -> ${action}`),duration=medicalDuration();
    for(let i=0;i<3600;i++){
      const time=i/60;
      animateMilo(root,{moving:false,facing:Math.sign(start),action,time,actionTime:time,actionDuration:duration,
        bathroom:visit instanceof BathroomVisit?visit.pose:null,gymVisit:action==='gym'?visit:null,bunkVisit:action==='bunk'?visit:null});
      check();
      if(visit){
        if(['use','sleeping','cycle'].includes(visit.phase))visit.requestExit();
        if(visit.done||visit.phase==='done')break;
        visit.update(1/60);
      }else if(time>=duration)break;
    }
    animateMilo(root,{moving:true,facing:-1,action:null,time:60});check();
  }
});

test('both ladder transfers meet walking headings without changing rung-locked climbing',()=>{
  const root=character();
  for(const up of [true,false])for(const startYaw of [-Math.PI/2,Math.PI/2])for(const endYaw of [-Math.PI/2,Math.PI/2]){
    root.rotation.y=startYaw;const check=continuity(root,'ladder');
    const startHeight=up?0:3.392,endHeight=up?3.392:0;
    for(let i=0;i<=360;i++){
      const height=startHeight+(endHeight-startHeight)*i/360;
      animateMilo(root,{moving:false,facing:1,action:null,time:i/60});
      applyCabinLadder(root,{height,startHeight,endHeight,startYaw,endYaw});check();
    }
    animateMilo(root,{moving:true,facing:Math.sign(endYaw),action:null,time:6});check();
  }
});

test('a rest request during a cat turn is queued without resetting the current arc',()=>{
  const motion=new CatMotion({turns:true});motion.face(0);motion.face(Math.PI/2);motion.update(.5);
  const before=motion.heading;motion.face(-Math.PI/2);assert.equal(motion.heading,before);
  for(let i=0;i<600&&motion.turn;i++){
    const last=motion.heading;motion.update(1/60);assert(Math.abs(angleDelta(last,motion.heading))<.08);
  }
  assert.equal(motion.turn,null);assert(Math.abs(angleDelta(motion.heading,-Math.PI/2))<1e-10);
});

test('cat wakes, turns on the bed, lands and enters rest without a heading reset',()=>{
  const cat=new CatRoutine(new Supplies(),{turns:true,random:()=>.5}),visit=new BunkVisit({startAsleep:true});
  cat.beginBunkWake(visit);visit.requestExit();let previous=cat.poseYaw,sawTurn=false;
  for(let i=0;i<2000&&visit.phase!=='done';i++){
    visit.update(1/60);cat.update(1/60);
    assert(Math.abs(angleDelta(previous,cat.poseYaw))<.08,`${visit.phase} heading reset`);previous=cat.poseYaw;
    if(cat.motion.turn)sawTurn=true;
    if(visit.phase==='leaving')assert(Math.abs(angleDelta(cat.poseYaw,0))<1e-10,'faces landing before flight');
  }
  assert(sawTurn);cat.finishBunkWake();assert.equal(cat.poseYaw,previous);
  for(let i=0;i<400;i++){cat.update(1/60);assert(Math.abs(angleDelta(previous,cat.poseYaw))<.08);previous=cat.poseYaw;}
});
