import test from 'node:test';
import {MeshStandardMaterial,Vector3} from 'three';
import assert from 'node:assert/strict';
import {CabinBrain} from '../src/obs/brain.js';
import {CrewMotion,Supplies,getStation} from '../src/obs/state.js';
import {CurtisRoutine,CURTIS} from '../src/obs/curtis-routine.js';
import {CREW_CLEARANCE,worldActor} from '../src/obs/curtis-traffic.js';
import {LOUNGE_TABLE,CABIN_AISLE} from '../src/obs/layout.js';
import {loungeWorldPose,loungeActorX,conversationTurn} from '../src/obs/lounge-conversation.js';
import {LOUNGE_COMPANION_SECONDS,LOUNGE_ENTRY_SECONDS} from '../src/obs/lounge-exit.js';
import {createMilo,animateMilo} from '../src/obs/characters.js';

function setup({peer=true,relax=60}={}){
  const actor=new CrewMotion({floor:1,x:loungeActorX(3)}),care=new Supplies();let opened=0;
  const brain=new CabinBrain({obsUI:{hideWant(){},openGame(){opened++;}}},actor,{care,random:()=>.8});
  brain.health.nextIncident=Infinity;brain.environment.nextFault=Infinity;brain.exercise=90;
  for(const key of Object.keys(brain.needs))brain.needs[key]=90;
  const curtis=new CurtisRoutine({firstDelay:Infinity});curtis.active=peer;
  curtis.position={x:CURTIS.seatX,y:3.392,z:.06};curtis.hold('relax',relax);
  curtis.add('stand',{x:CURTIS.seatX,y:3.392,z:.43},2.2);curtis.walk(CURTIS.seatX,3.392,.78);
  brain.droidRoutine={visitor:curtis,reserveForCrew:()=>false};
  function tick(dt=1/60){curtis.update(dt,{actor,brain});actor.waitingForVisitor=curtis.blocksCrew(actor,dt);if(!actor.waitingForVisitor)actor.update(dt);brain.update(dt);}
  function until(predicate,seconds=30){for(let i=0;i<seconds*60&&!predicate();i++)tick();assert.ok(predicate(),'reaches requested state without a standoff');}
  return{actor,brain,curtis,tick,until,opened:()=>opened};
}

test('Milo takes the adjacent cushion without crossing Curtis or the table, from either aisle direction',()=>{
  for(const start of [3,11])for(const dt of [1/60,.1]){
    const {actor,brain,curtis,tick}=setup();actor.x=loungeActorX(start);brain._go(getStation('lounge'));
    let previous=null;
    for(let age=0;age<25&&!brain.isSeatedInLounge();age+=dt){
      tick(dt);
      const pose=actor.busy?worldActor(actor):loungeWorldPose(brain);
      assert.ok(Math.hypot(pose.x-CURTIS.seatX,pose.z-.06)>CREW_CLEARANCE+.05);
      if(brain.loungeEntry){
        assert.ok(pose.x+.21<LOUNGE_TABLE.x-LOUNGE_TABLE.width/2,'direct entry stays left of the table');
        if(previous)assert.ok(Math.hypot(pose.x-previous.x,pose.z-previous.z)<.15,'no teleport on entering the sofa');
      }
      previous=pose;
    }
    assert.ok(brain.isSeatedInLounge());assert.equal(brain.leisure,'conversation');
    assert.ok(Math.abs(loungeWorldPose(brain).x-CURTIS.seatX-1.2)<1e-9);
    assert.equal(curtis.step.kind,'relax');assert.equal(brain.loungeEntry,null);
  }
});

test('an empty sofa keeps the ordinary table seat and leisure activities',()=>{
  const {brain,until}=setup({peer:false});brain.nextLeisure='tablet';brain._go(getStation('lounge'));
  until(()=>Boolean(brain.loungeEntry));assert.equal(brain.loungeCompanion,null);
  assert.equal(brain.loungeEntry.companion,undefined);brain.update(LOUNGE_ENTRY_SECONDS);
  assert.equal(brain.leisure,'tablet');assert.equal(brain.actor.x,getStation('lounge').x);
});

test('Curtis stays for a finite conversation; both conversation and entry freeze with zero simulation time',()=>{
  const {brain,curtis,actor,tick,until}=setup({relax:10});brain._go(getStation('lounge'));
  until(()=>brain.isSeatedInLounge());for(let i=0;i<8*60;i++)tick();
  assert.equal(curtis.step.kind,'relax');assert.ok(brain.loungeCompanion.weight>.99);
  const snapshot=JSON.stringify({plan:brain.loungeCompanion,pose:loungeWorldPose(brain),age:curtis.age});
  for(let i=0;i<30;i++){brain.update(0);curtis.update(0,{actor,brain});}
  assert.equal(JSON.stringify({plan:brain.loungeCompanion,pose:loungeWorldPose(brain),age:curtis.age}),snapshot);
  until(()=>brain.state==='leavingLounge',40);
  until(()=>brain.loungeCompanion===null,10);until(()=>curtis.step?.kind!=='relax',10);
});

test('a directed departure rises at the same cushion and resumes walking without a jump or belongings stow',()=>{
  const {brain,actor,tick,until}=setup();brain._go(getStation('lounge'));until(()=>brain.isSeatedInLounge());
  brain._go(getStation('hydro'));assert.equal(brain.loungeStow,undefined);assert.equal(brain.loungeExit.companion,true);
  let before=loungeWorldPose(brain);
  for(let i=0;i<LOUNGE_COMPANION_SECONDS*60+2&&brain.loungeExit;i++){
    tick();const pose=brain.loungeExit?loungeWorldPose(brain):worldActor(actor);
    assert.ok(Math.hypot(pose.x-before.x,pose.z-before.z)<.07);before=pose;
  }
  assert.equal(brain.loungeCompanion,null);assert.equal(brain.actStation,'hydro');assert.ok(actor.busy);
  assert.equal(before.z,CABIN_AISLE.crewZ);
});

test('a game request moves from the conversation cushion to the table before opening',()=>{
  const {brain,actor,until,opened}=setup();brain._go(getStation('lounge'));until(()=>brain.isSeatedInLounge());
  assert.ok(brain.requestGame('chess'));assert.equal(opened(),0);assert.ok(brain.loungeExit);
  until(()=>brain.state==='playingGame',25);
  assert.equal(opened(),1);assert.equal(brain.loungeCompanion,null);assert.equal(actor.x,getStation('lounge').x);
});

test('Curtis leaving during the approach falls back to the table without a coordinate snap',()=>{
  const {brain,actor,curtis,until,tick}=setup();brain._go(getStation('lounge'));until(()=>Boolean(brain.loungeCompanion));
  curtis.active=false;const x=actor.x;tick();assert.ok(Math.abs(actor.x-x)<1);
  until(()=>brain.isSeatedInLounge());assert.equal(brain.loungeCompanion,null);assert.equal(actor.x,getStation('lounge').x);
  assert.notEqual(brain.leisure,'conversation');
});

test('speaking gestures alternate, gaze faces the partner, and no leisure prop appears',()=>{
  const material=new MeshStandardMaterial(),m=new Proxy({},{get:()=>material});
  const milo=createMilo(m),curtis=createMilo(m);
  for(const age of [1,3,6,8,11]){
    const options={moving:false,climbing:false,action:'lounge',time:age,dt:1/60,leisure:'conversation'};
    animateMilo(milo,{...options,conversation:{age,weight:1}});
    animateMilo(curtis,{...options,conversation:{age,weight:1,role:'curtis'}});
    assert.ok(milo.rotation.y<0&&milo.userData.head.rotation.y<0);
    assert.ok(curtis.rotation.y>0&&curtis.userData.head.rotation.y>0);
    assert.equal(conversationTurn(age)*conversationTurn(age,'curtis'),0);
    for(const root of [milo,curtis]){
      for(const key of ['tablet','phones','toy'])assert.equal(root.userData.leisure[key].visible,false);
      root.traverse(node=>assert.ok(node.position.toArray().every(Number.isFinite)&&node.quaternion.toArray().every(Number.isFinite)));
    }
  }
});

test('the shared visit ends only after Milo has cleared Curtis on his way down the aisle',()=>{
  const {actor,brain,curtis,until,tick}=setup({relax:10});brain._go(getStation('lounge'));until(()=>brain.isSeatedInLounge());
  brain._go(getStation('toilet'));
  for(let i=0;i<25*60&&(actor.busy||brain.loungeExit||curtis.step);i++){
    tick();
    if(brain.loungeExit||(actor.busy&&Math.abs((actor.x-700)*.022-CURTIS.seatX)<1.7))assert.equal(curtis.step.kind,'relax');
    assert.ok(!(curtis.waiting&&actor.waitingForVisitor),'the departing guest keeps priority');
  }
  assert.equal(actor.busy,false);assert.equal(curtis.step,null);
});

test('the direct sit and rise keep the hips continuous and the boots on the floor',()=>{
  const material=new MeshStandardMaterial(),root=createMilo(new Proxy({},{get:()=>material}));
  for(const entering of [true,false]){
    let previous=null;
    for(let i=0;i<=LOUNGE_COMPANION_SECONDS*60;i++){
      const transition={age:i/60,companion:true,conversation:{age:3,weight:1},seatedYaw:-.32};
      const brain={loungeCompanion:{seatX:7.25},[entering?'loungeEntry':'loungeExit']:transition};
      const pose=loungeWorldPose(brain);root.position.set(pose.x,0,pose.z);
      animateMilo(root,{action:'lounge',moving:false,climbing:false,facing:1,time:3,leisure:'conversation',[entering?'loungeEntry':'loungeExit']:transition});
      root.updateMatrixWorld(true);
      const hip=root.userData.hips.getWorldPosition(new Vector3());
      if(previous)assert.ok(hip.distanceTo(previous)<.025,'no jump where the table shuffle is skipped');previous=hip;
      for(const {boot}of root.userData.legs){const sole=boot.localToWorld(new Vector3(0,-.107,0));assert.ok(sole.y>-.006&&sole.y<.07);}
    }
  }
});

test('sitting beside Curtis never borrows the table-withdrawal hand motion',()=>{
  const material=new MeshStandardMaterial(),root=createMilo(new Proxy({},{get:()=>material}));
  for(let i=0;i<=LOUNGE_COMPANION_SECONDS*60;i++){
    animateMilo(root,{action:'lounge',moving:false,climbing:false,facing:1,time:3,leisure:'conversation',loungeEntry:{age:i/60,companion:true}});
    root.updateMatrixWorld(true);
    for(const {hand}of root.userData.arms){
      const wrist=root.userData.body.worldToLocal(hand.getWorldPosition(new Vector3()));
      assert.ok(wrist.y<1.15,`the wrist stays below the chest throughout entry (${i/60}, ${wrist.y})`);
    }
  }
});

test('a natural conversation departure starts a normal activity even when every need is satisfied',()=>{
  const {brain,actor,until}=setup();brain._go(getStation('lounge'));until(()=>brain.isSeatedInLounge());
  for(const key of Object.keys(brain.needs))brain.needs[key]=98;brain.exercise=98;
  until(()=>Boolean(brain.loungeExit),40);until(()=>!brain.loungeExit,10);
  assert.equal(brain.state,'goingTo');assert.ok(actor.busy,'Milo does not stand indefinitely beside the sofa');
  assert.notEqual(brain.actStation,'lounge');
});
