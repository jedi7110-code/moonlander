import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {CrewMotion,CatMotion,Supplies} from '../src/obs/state.js';
import {FLOORS,CAT_PORT,LOUNGE_TABLE,CABIN_AISLE,getStation} from '../src/obs/layout.js';
import {CabinBrain} from '../src/obs/brain.js';
import {loungeApproachX,LOUNGE_ENTRY_SECONDS} from '../src/obs/lounge-exit.js';
import {worldActor} from '../src/obs/curtis-traffic.js';
import {CabinStairs} from '../src/obs/stair-traffic.js';
import {stairTrip,rightStairTrip} from '../src/obs/stair-trip.js';
import {DroidRoutine,DROID_FLOORS,DROID_LANE} from '../src/obs/droid-routine.js';
import {PlantBed} from '../src/obs/plant-state.js';
import {droidStairFeet} from '../src/obs/droid-stair-pose.js';
import fs from 'node:fs';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {createLucy} from '../src/obs/lucy.js';
import {createMilo,animateMilo} from '../src/obs/characters.js';
import {poseHumanTrip,sampleHumanPath,humanTripWeight} from '../src/obs/human-stair-gait.js';
import {poseCatPath,catStairEntryPhase,CAT_STAIR_GAIT} from '../src/obs/cat-stair-gait.js';
import {crewWalkway} from '../src/obs/cabin-walkway.js';

const px=x=>700+x/.022,mx=x=>(x-700)*.022,my=y=>(870-y)*.016;
const material=new THREE.MeshStandardMaterial(),materials=new Proxy({},{get:()=>material});

test('Milo takes the right tower between LEVEL 3 and LEVEL 2 from the right half, the left one from the left half',()=>{
  for(const [from,to,startX,endX,side] of [[2,1,9,8.4,1],[1,2,8.4,9,1],[2,1,3,5,1],[2,1,-3,-5,-1],[2,0,9,4.7,-1]]){
    const stairs=new CabinStairs({right:true}),actor=new CrewMotion({floor:from,x:px(startX)});actor.stairs=stairs;
    let arrived=false,trip=null,prev=null,maxStep=0;actor.goTo({floor:to,x:px(endX)},()=>{arrived=true;});
    for(let i=0;i<60*120&&actor.busy;i++){
      stairs.update(1/60);actor.update(1/60);trip??=actor.onStairs?.trip;
      const p={x:mx(actor.x),y:my(actor.y)};if(prev)maxStep=Math.max(maxStep,Math.hypot(p.x-prev.x,p.y-prev.y));prev=p;
    }
    assert(arrived&&actor.floor===to,`${from}->${to} from x=${startX} arrives`);
    assert.equal(trip?.side,side,`${from}->${to} from x=${startX} by the ${side>0?'right':'left'} tower`);
    assert(maxStep<.05,`continuous (${maxStep.toFixed(3)} m/frame)`);assert.equal(stairs.count,0);
  }
});

test('on the right tower Milo\'s stair walk is his left-tower stair walk in a mirror',()=>{
  // With the same footfall plan the right sample is the left one reflected:
  // pelvis and feet at -x, headings negated, left and right feet swapped.
  for(const [from,to] of [[2,1],[1,2]]){
    const L=stairTrip(from,to),R=rightStairTrip(from,to);
    for(const mirror of [false,true])for(let t=.5;t<L.length;t+=.43){
      const walk={speed:1.188,entry:.4,mirror,key:`1.188:x${mirror?':m':''}`};
      const a=sampleHumanPath(L,t,walk),b=sampleHumanPath(R,t,walk);
      assert.ok(Math.abs(a.pelvis.x+b.pelvis.x)<1e-9&&a.pelvis.y===b.pelvis.y&&Math.abs(a.pelvis.yaw+b.pelvis.yaw)<1e-9);
      for(const [p,q] of [[a.feet[0],b.feet[1]],[a.feet[1],b.feet[0]]])
        assert.ok(Math.abs(p.ankle.x+q.ankle.x)<1e-9&&p.ankle.y===q.ankle.y&&p.ankle.z===q.ankle.z&&Math.abs(p.yaw+q.yaw)<1e-9&&p.pitch===q.pitch);
    }
  }
  // posed on the right tower Milo stays upright (the cabin walk only turns him about y)
  const root=createMilo(materials),R=rightStairTrip(2,1),arrival={speed:1.188,entry:.4};
  for(let t=0;t<=R.length;t+=.37){
    const f=R.frame(t);root.position.set(f.x,f.y,f.z);
    poseHumanTrip(root,R,t,t,{arrival,cabinPose:(d,k)=>animateMilo(root,{moving:true,climbing:false,facing:Math.sign(f.dx)||1,walkYaw:f.yaw,walkDistance:d,walkStride:k,time:t,dt:1/60})});
    assert.equal(root.rotation.x,0);assert.equal(root.rotation.z,0);
  }
});

test('the droid takes the right tower near the right end, its feet are the left feet in a mirror, and it faces back into the cabin',()=>{
  for(const [from,to] of [[2,1],[1,2]]){
    const L=stairTrip(from,to,{fromZ:DROID_LANE,toZ:DROID_LANE}),R=rightStairTrip(from,to,{fromZ:DROID_LANE,toZ:DROID_LANE});
    for(let t=0;t<=L.length;t+=.2){
      const [l1,r1]=droidStairFeet(L,t),[l2,r2]=droidStairFeet(R,t);
      for(const [p,q] of [[l1,r2],[r1,l2]])assert.ok(Math.abs(p.x+q.x)<1e-9&&p.y===q.y&&p.z===q.z&&p.planted===q.planted);
    }
    const stairs=new CabinStairs({right:true}),actor=new CrewMotion({floor:1,x:px(-6)});
    const routine=new DroidRoutine({care:new Supplies(),brain:{plants:new PlantBed(),actStation:null},actor,cat:{mode:'sleep'}});
    routine.stairs=stairs;routine.position={x:9,y:DROID_FLOORS[from],z:DROID_LANE,floor:from,yaw:0};routine.plan={...routine.position};routine.job='feed';
    routine.travel(to,8,DROID_LANE);let done=false,side=null,maxTurn=0,prev=routine.position.yaw;routine.add('release',.1,()=>{routine.job=null;done=true;});
    for(let i=0;i<180*60&&!done;i++){
      stairs.update(1/60);routine.update(1/60);if(routine.step?.kind==='stairs')side=routine.step.trip.side;
      const y=routine.position.yaw;maxTurn=Math.max(maxTurn,Math.abs(Math.atan2(Math.sin(y-prev),Math.cos(y-prev))));prev=y;
    }
    assert(done,`${from}->${to} finishes`);assert.equal(side,1,'by the right tower');assert.equal(routine.position.floor,to);
    assert(maxTurn<.1,`turns smoothly (${(maxTurn*57.3).toFixed(0)}° in a frame)`);
  }
});

async function lucy(){
  const b=fs.readFileSync(new URL('../public/assets/obs/lucy/lucy-cabin.glb',import.meta.url));
  return createLucy(await new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),''),{random:()=>.5});
}
test('Lucy takes the right tower too, and her paws there are her left-tower paws in a mirror',async()=>{
  const stairs=new CabinStairs({right:true}),motion=new CatMotion({turns:true});motion.stairs=stairs;
  Object.assign(motion,{floor:2,y:FLOORS[2].y,x:px(9),z:CAT_PORT.walkZ,onSofa:false,elevation:0});
  let side=null,arrived=false;motion.goTo({floor:1,x:px(9.6),z:CAT_PORT.walkZ},()=>{arrived=true;});
  const crew=new CrewMotion({floor:2,x:px(-10)});
  for(let i=0;i<240*60&&!arrived;i++){stairs.update(1/60);motion.update(1/60,crew,null);side??=motion.onStairs?.trip.side;}
  assert(arrived&&motion.floor===1,'arrives');assert.equal(side,1,'by the right tower');
  // On the flights the paws are the left-tower paws in a mirror (same
  // treads); on the landings between them Lucy walks her own Walk clip.
  const a=await lucy(),b=await lucy();
  const L=stairTrip(2,1,{fromZ:CAT_PORT.walkZ,toZ:CAT_PORT.walkZ}),R=rightStairTrip(2,1,{fromZ:CAT_PORT.walkZ,toZ:CAT_PORT.walkZ});
  let compared=0;const prev={a:null,b:null},jump={a:0,b:0};
  const step=(key,feet)=>{if(prev[key])for(const f of feet){const q=prev[key].find(p=>p.rear===f.rear&&p.side===f.side);jump[key]=Math.max(jump[key],Math.hypot(f.x-q.x,f.y-q.y,f.z-q.z));}prev[key]=feet;};
  for(let t=0;t<=L.length;t+=1/60*.5){
    const pb=poseCatPath(b,R,t,t,1/60);step('b',pb.feet);step('a',poseCatPath(a,L,t,t,1/60).feet);
    if(Math.round(t*120)%40||pb.stairWeight<1)continue;
    const pa=poseCatPath(a,L,t,t,1/60);compared++;prev.a=pa.feet;
    for(const f of pa.feet){
      const g=pb.feet.find(q=>q.rear===f.rear&&q.side===-f.side);
      // (the treads are the same; the paw on them may differ by the leg's own timing)
      assert.ok(g&&Math.abs(f.y-g.y)<.2,`t=${t.toFixed(2)}: ${f.rear?'hind':'fore'} paw height ${f.y.toFixed(3)} vs ${g.y.toFixed(3)}`);
    }
    assert.ok(pb.maxReachError<.06,`t=${t.toFixed(2)}: paws reached (${pb.maxReachError.toFixed(3)})`);
  }
  assert.ok(compared>5);
  assert.ok(jump.b<=jump.a+.005,`paws move as smoothly as on the left tower (${jump.b.toFixed(3)} vs ${jump.a.toFixed(3)} m in a half frame)`);
});

test('a long walk before the LEVEL 2 stairs does not rewind the walking animation',async()=>{
  const root=await lucy(),dt=1/60,step=.495*dt,stride=CAT_STAIR_GAIT.natural;
  for(const makeTrip of [stairTrip,rightStairTrip]){
    const path=makeTrip(1,2,{fromZ:CAT_PORT.walkZ,toZ:CAT_PORT.walkZ});
    const startPhase=catStairEntryPhase(root,path,step,30);
    const fade=Math.max(.3,path.flights[0].t0-CAT_STAIR_GAIT.stairZone.none-.05);
    let previous=null;
    for(let t=step;t<=fade+step;t+=step){
      const phaseOffset=startPhase*(1-THREE.MathUtils.smoothstep(t,0,fade));
      const pose=poseCatPath(root,path,t,t/.495,dt,{phaseOffset});
      if(previous){
        assert.ok(pose.walkDistance>previous.walkDistance,'the walk clip keeps moving forward');
        for(let i=0;i<pose.feet.length;i++){
          const a=pose.feet[i],b=previous.feet[i];
          assert.ok(Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z)<.06,'paws move continuously into the staircase');
        }
      }else{
        const cycles=(30-pose.walkDistance)/stride;
        assert.ok(Math.abs(cycles-Math.round(cycles))<.001,'entry matches the last cabin pose');
      }
      previous=pose;
    }
  }
});

test('the two towers keep their own traffic',()=>{
  const stairs=new CabinStairs({right:true}),a={},b={},c={};
  // someone standing at the right tower's LEVEL 3 entrance does not crowd the left tower, and the other way round
  stairs.enter(a,'crew',rightStairTrip(2,1),.2);
  assert(!stairs.available(b,rightStairTrip(2,1)),'right tower crowded');
  assert(stairs.available(b,stairTrip(2,1)),'left tower free');
  // two walkers going the same way on the right tower do not count against the left tower
  stairs.enter(c,'crew',rightStairTrip(2,1),6);
  assert(stairs.available(b,stairTrip(2,0)),'left tower still free');
  // walkers at the two towers' LEVEL 2 crossings do not hold each other
  const s2=new CabinStairs({right:true}),l={},r={};
  const L=stairTrip(2,1),R=rightStairTrip(1,2);
  s2.enter(l,'crew',L,L.exitStart-.2);s2.enter(r,'crew',R,R.enterLength+.05);
  let moved=0;for(let i=0;i<60;i++){s2.update(1/60);const before=s2.walker(l).t;s2.advance(l,.02,1/60);s2.advance(r,0,1/60);moved+=s2.walker(l).t-before;}
  assert(moved>1,'the left walker crosses LEVEL 2 while someone is in the right tower\'s crossing');
});

test('Milo walks into, over and out of the right tower without a jump in any limb',()=>{
  for(const [from,to,startX,endX] of [[2,1,8.6,9.6],[1,2,8.6,9.6]]){
    const stairs=new CabinStairs({right:true}),actor=new CrewMotion({floor:from,x:px(startX)});actor.stairs=stairs;
    const root=createMilo(materials);actor.goTo({floor:to,x:px(endX)});
    const rows=[];let time=0,side=null;
    for(let i=0;i<60*90&&actor.busy;i++){
      stairs.update(1/60);actor.update(1/60);time+=1/60;
      const walkway=crewWalkway(mx(actor.x),actor.floor,actor.facing,actor.loungeAvoidance),stair=actor.onStairs;
      root.position.set(mx(actor.x),my(actor.y),walkway.z);
      if(stair){side=stair.trip.side;const f=stair.trip.frame(stair.t);root.position.set(f.x,f.y,f.z);walkway.yaw=f.yaw;}
      const pose={moving:actor.busy,waiting:false,climbing:false,facing:actor.facing,walkYaw:walkway.yaw,walkDistance:actor.walkDistance*.022,time,dt:1/60};
      if(stair)poseHumanTrip(root,stair.trip,stair.t,time,{arrival:stair.arrival,cabinPose:(walkDistance,walkStride)=>animateMilo(root,{...pose,walkDistance,walkStride})});
      else animateMilo(root,pose);
      root.updateMatrixWorld(true);
      const u=root.userData,at=o=>o.getWorldPosition(new THREE.Vector3());
      rows.push({'left boot':at(u.legs[0].boot),'right boot':at(u.legs[1].boot),'left hand':at(u.arms[0].hand),'right hand':at(u.arms[1].hand),head:at(u.head)});
    }
    assert.equal(side,1,'by the right tower');
    for(let k=2;k<rows.length-1;k++)for(const [name,p] of Object.entries(rows[k])){
      const a=p.clone().sub(rows[k-1][name]).sub(rows[k-1][name].clone().sub(rows[k-2][name])).length()*3600;
      assert(a<220,`trip ${from}>${to} frame ${k}: ${name} jumps (${a.toFixed(0)} m/s^2)`);
    }
  }
});



test('Milo coming from the right staircase walks around the lounge table and joins the existing seat entrance',()=>{
  for(const dt of [1/120,1/60,1/30,.1]){
    const stairs=new CabinStairs({right:true}),actor=new CrewMotion({floor:2,x:px(9.6)});actor.stairs=stairs;
    const brain=new CabinBrain({obsUI:{hideWant(){}}},actor,{care:new Supplies(),random:()=>.8});
    brain.health.nextIncident=Infinity;brain.environment.nextFault=Infinity;
    brain._go(getStation('lounge'));
    let side=null,crossed=false;
    const clear=p=>{
      const dx=Math.max(0,Math.abs(p.x-LOUNGE_TABLE.x)-LOUNGE_TABLE.width/2);
      const dz=Math.max(0,Math.abs(p.z-LOUNGE_TABLE.z)-LOUNGE_TABLE.depth/2);
      assert(Math.hypot(dx,dz)>.30,`body clears table at ${p.x.toFixed(3)}, ${p.z.toFixed(3)}`);
    };
    for(let i=0;i<150/dt&&actor.busy;i++){
      const floor=actor.floor,wasWalking=actor.queue[0]?.type==='walk',before=worldActor(actor),distance=actor.walkDistance;
      stairs.update(dt);actor.update(dt);side??=actor.onStairs?.trip.side;
      if(actor.floor!==1||actor.onStairs)continue;
      const after=worldActor(actor);clear(after);
      if(Math.abs(after.x-LOUNGE_TABLE.x)<.1)crossed=true;
      if(floor===1&&wasWalking){
        const moved=Math.hypot(after.x-before.x,after.z-before.z);
        assert(moved<=actor.walkSpeed*.022*dt*1.04,'curved route keeps walking speed');
        assert(Math.abs((actor.walkDistance-distance)*.022-moved)<1e-8,'feet follow distance around table');
      }
    }
    assert.equal(side,1);assert(crossed);assert(brain.loungeEntry,'reaches the seat entrance');
    assert.equal(actor.x,loungeApproachX());assert.equal(worldActor(actor).z,CABIN_AISLE.crewZ);
    brain.update(LOUNGE_ENTRY_SECONDS);assert(brain.isSeatedInLounge());
    // The same floor route also clears the table while leaving for the right tower.
    actor.x=loungeApproachX();actor.goTo({floor:1,x:px(11)});
    for(let i=0;i<30/dt&&actor.busy;i++){actor.update(dt);clear(worldActor(actor));}
    assert.equal(actor.busy,false);
  }
});
