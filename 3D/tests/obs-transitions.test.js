import test from 'node:test';
import assert from 'node:assert/strict';
import {MeshStandardMaterial,Vector3} from 'three';
import {CabinBrain} from '../src/obs/brain.js';
import {CrewMotion,CatRoutine,Supplies,getStation,currentAction} from '../src/obs/state.js';
import {createMilo,animateMilo,createCat,animateCat} from '../src/obs/characters.js';
import {LOUNGE_ENTRY_SECONDS,loungeEntryAge,loungeExitPose} from '../src/obs/lounge-exit.js';
const materials=()=>new Proxy({},{get:()=>new MeshStandardMaterial()});
function setup(id){const station=getStation(id),actor=new CrewMotion({floor:station.floor,x:station.x}),care=new Supplies(),brain=new CabinBrain({obsUI:{hideWant(){}}},actor,{care,random:()=>.8});brain.health.nextIncident=Infinity;brain.cur=station;brain._startPerform(station);return{actor,brain,care};}
test('seating pauses recovery, ignores repeated lounge clicks, and queues the newest destination',()=>{
  const {brain,actor}=setup('lounge'),fun=brain.needs.fun;
  assert.equal(brain.clickLounge(),'pending');brain.update(.7);assert.ok(brain.needs.fun<fun);
  brain._go(getStation('hydro'));brain._go(getStation('galley'));assert.equal(actor.busy,false);
  const age=brain.loungeEntry.age;brain.update(0);assert.equal(brain.loungeEntry.age,age);
  brain.update(LOUNGE_ENTRY_SECONDS);assert.equal(brain.state,'leavingLounge');assert.equal(actor.busy,false);
  brain.update(2.8);assert.equal(brain.actStation,'galley');assert.ok(actor.busy);
});
test('seating keeps the soles grounded and the hips continuous through the first seated frame',()=>{
  const root=createMilo(materials());root.rotation.y=.15;let previous=null;
  for(let i=0;i<=145;i++){
    const age=Math.min(i/60,2.4),entry=i<144?{age}:null;
    root.position.z=entry?loungeExitPose(loungeEntryAge(age)).depth:.06;
    animateMilo(root,{action:'lounge',moving:false,facing:1,time:age,actionTime:0,leisure:'tablet',loungeEntry:entry});root.updateMatrixWorld(true);
    const point=root.userData.hips.getWorldPosition(new Vector3());if(previous)assert.ok(point.distanceTo(previous)<.025);previous=point;
    for(const {boot}of root.userData.legs)assert.ok(boot.localToWorld(new Vector3(0,-.107,0)).y>-.008);
  }
});
for(const id of ['medical'])test(`${id}: an interrupted transfer returns through sitting before accepting a new destination`,()=>{
  for(const elapsed of [.5,2,5,7,11,13.5]){
    const {brain,actor}=setup(id);brain.update(elapsed);brain._go(getStation('hydro'));
    assert.ok(brain.reclineExit.duration>0);assert.equal(currentAction(brain),id);assert.equal(actor.busy,false);
    const root=createMilo(materials());let previous=null;
    let frames=0;
    while(brain.reclineExit&&frames++<700){
      const exit=brain.reclineExit;
      animateMilo(root,{action:id,moving:false,time:elapsed,actionTime:elapsed,actionDuration:brain.curDurSec,reclineExit:exit});root.updateMatrixWorld(true);
      const head=root.userData.head.getWorldPosition(new Vector3());if(previous)assert.ok(head.distanceTo(previous)<.045);previous=head;
      brain.update(1/60);
    }
    assert.ok(frames<700);assert.equal(brain.reclineExit,null);assert.equal(brain.actStation,'hydro');assert.ok(actor.busy);
  }
});
test('capsule interruptions wait for an open lid and a completed rise before walking',()=>{
  for(const elapsed of [.5,3,6,9]){
    const {brain,actor}=setup('bunk');brain.update(elapsed);brain._go(getStation('hydro'));
    assert.equal(currentAction(brain),'bunk');assert.equal(actor.busy,false);
    let frames=0;
    while(brain.bunkVisit&&frames++<1800){
      const visit=brain.bunkVisit;
      if(['lowering','entering','leaving','rising'].includes(visit.phase))assert.equal(visit.pose.open,1);
      assert.equal(actor.busy,false);brain.update(1/60);
    }
    assert.ok(frames<1800);assert.equal(brain.actStation,'hydro');assert.ok(actor.busy);
  }
});
test('a playing cat lowers its paw without standing abruptly, then rises before a feeding command',()=>{
  const care=new Supplies(),cat=new CatRoutine(care,{random:()=>.5}),root=createCat(materials());
  cat.motion.queue=[];cat.rest('play',5);cat.modeTime=3;cat.fetch();assert.ok(cat.playRelease);assert.equal(cat.motion.busy,false);
  let previous=null;
  for(let i=0;i<140;i++){
    animateCat(root,{time:3+i/60,moving:false,facing:1,mode:cat.mode,actionTime:cat.modeTime,remaining:cat.remaining,playRelease:cat.playRelease});root.updateMatrixWorld(true);
    const head=root.userData.head.getWorldPosition(new Vector3());if(previous)assert.ok(head.distanceTo(previous)<.025);previous=head;
    cat.update(1/60);assert.equal(cat.motion.busy,false);
  }
  cat.update(.2);assert.equal(cat.mode,'fetch');assert.ok(cat.motion.busy);
});
