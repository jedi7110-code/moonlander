import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {MeshStandardMaterial,Vector3} from 'three';
import {createMilo,animateMilo} from '../src/obs/characters.js';
import {loadMiloBody} from '../src/obs/milo-body.js';
import {miloWalkData as data} from '../src/obs/mocap-walk.js';
import {MiloWalker,planMiloWalk,poseMiloGait} from '../src/obs/milo-gait.js';
import {CrewMotion,CREW_GAIT,FLOORS,getStation} from '../src/obs/state.js';
import {CabinStairs} from '../src/obs/stair-traffic.js';
import {stationStep,stationVisit,stationWrap,plannedPassage} from '../src/obs/station-step.js';
import {MiloPoseBlend,MILO_POSE_BLEND} from '../src/obs/milo-pose-blend.js';

const body=await readFile(new URL('../public/assets/obs/milo/body.json',import.meta.url));
await loadMiloBody(`data:application/json;base64,${body.toString('base64')}`);
const root=createMilo(new Proxy({},{get:(o,k)=>o[k]??=new MeshStandardMaterial()}));
const idle={time:0,dt:0,moving:false,climbing:false,facing:1,action:null};
const CABIN=54*.022,dt=1/60,C=data.cycleDistance;
const joints=()=>[...root.userData.legs.flatMap(({leg,knee,boot})=>[leg,knee,boot]),...root.userData.arms.flatMap(({arm,elbow})=>[arm,elbow]),root.userData.body,root.userData.chest,root.userData.head];
const snapshot=()=>({q:joints().map(o=>o.quaternion.clone()),boots:root.userData.legs.map(({boot})=>boot.getWorldPosition(new Vector3()))});
function show(walker){
  animateMilo(root,idle);if(walker.pose&&!walker.done)poseMiloGait(root,walker.pose);
  root.position.set(0,0,walker.x);root.rotation.set(0,0,0);root.updateMatrixWorld(true);return snapshot();
}
const standing=()=>{animateMilo(root,idle);root.updateMatrixWorld(true);return joints().map(o=>o.quaternion.clone());};
// Walk a walker to its end; events: [{at seconds, run(walker)}]. Returns what the audit of the cabin looks for.
function walk(walker,events=[]){
  // (a walk that comes out of the cycle is moving from its first tick)
  let t=0,previous=show(walker),turn=0,back=0,speed=0,last=walker.plan.fromStanding?0:null,change=0;
  while(!walker.done&&t<40){
    for(const event of events)if(!event.done&&t>=event.at){event.done=true;event.run(walker);}
    const before=walker.x;walker.step(dt);t+=dt;
    const now=show(walker),v=(walker.x-before)/dt;
    now.q.forEach((q,i)=>turn=Math.max(turn,q.angleTo(previous.q[i])/dt));
    back=Math.min(back,walker.x-before);speed=Math.max(speed,v);if(last!==null)change=Math.max(change,Math.abs(v-last));last=v;previous=now;
  }
  return {t,x:walker.x,turn,back,speed,change,rest:previous};
}

test('a walker left alone walks the plan: same place, same time, standing at both ends',()=>{
  for(const distance of [.5,2,6]){
    const plan=planMiloWalk(distance,CABIN),walker=MiloWalker.start(distance,CABIN),first=show(walker),rest=standing();
    first.q.forEach((q,i)=>assert.ok(q.angleTo(rest[i])<1e-6,'starts in the standing pose'));
    const result=walk(walker);
    assert.ok(Math.abs(result.x-distance)<1e-6&&Math.abs(result.t-plan.duration)<.08,`${distance} m in the plan's time`);
    assert.ok(result.turn<20&&result.back>-1e-9);
    animateMilo(root,idle);poseMiloGait(root,walker.pose);joints().forEach((o,i)=>assert.ok(o.quaternion.angleTo(rest[i])<1e-6,'ends in the standing pose'));
  }
});

test('stopped at any moment, the walk ends in step: no pose jumps, never backwards, where it said it would',()=>{
  let furthest=0;
  for(let at=.03;at<5.6;at+=.11){
    const walker=MiloWalker.start(6,CABIN);let told=null,from=null;
    const result=walk(walker,[{at,run:w=>{told=w.stopDistance;from=w.x;w.halt();}}]);
    assert.ok(result.turn<24,`halt at ${at.toFixed(2)}: joints turn at most ${result.turn.toFixed(1)} rad/s`);
    assert.ok(result.back>-1e-9,'the root never goes back');
    assert.ok(result.change<.25,`halt at ${at.toFixed(2)}: the root's speed changes by ${result.change.toFixed(2)} m/s in a tick`);
    assert.ok(Math.abs(result.x-from-told)<.03,'it stops as far on as stopDistance told');
    assert.ok(result.t<at+1.6,'within a step or two');
    furthest=Math.max(furthest,result.x-from);
    // (a walk called off before a foot has left the floor simply ends: the figure stands)
    if(from>1e-3){const rest=standing();animateMilo(root,idle);poseMiloGait(root,walker.pose);joints().forEach((o,i)=>assert.ok(o.quaternion.angleTo(rest[i])<1e-6,'standing at the end'));}
  }
  assert.ok(furthest>.3&&furthest<.6,`a walk in full stride needs up to ${furthest.toFixed(2)} m to stop`);
});

test('a stopping walk can be sent on again, and a walk can be given a nearer or farther end under way',()=>{
  for(let at=.4;at<4;at+=.23)for(const wait of [.1,.5]){
    const walker=MiloWalker.start(6,CABIN);let target=null;
    const result=walk(walker,[{at,run:w=>w.halt()},{at:at+wait,run:w=>{if(w.retarget(3))target=w.target;}}]);
    assert.ok(result.turn<24&&result.back>-1e-9,`resumed at ${at.toFixed(2)}+${wait}`);
    if(target!==null)assert.ok(Math.abs(result.x-target)<1e-6);
  }
  const shorter=MiloWalker.start(6,CABIN),short=walk(shorter,[{at:1.5,run:w=>w.retarget(1.2)}]);
  assert.ok(Math.abs(short.x-shorter.target)<1e-6&&short.x<3.2&&short.turn<24);
  const longer=MiloWalker.start(2,CABIN),long=walk(longer,[{at:1.2,run:w=>w.retarget(5)}]);
  assert.ok(Math.abs(long.x-longer.target)<1e-6&&long.x>5&&long.turn<24);
  // a walk not yet off the floor is simply called off
  const none=MiloWalker.start(3,CABIN);none.step(dt);none.halt();assert.equal(none.done,true);assert.ok(none.x<1e-3);
});

test('an open walk runs on into the plain measured cycle, and a walk comes out of it in step',()=>{
  for(const distance of [2,4]){
    const walker=MiloWalker.start(distance,CABIN,{open:true});let previous=show(walker),turn=0;
    while(walker.remaining>0){walker.step(dt);const now=show(walker);now.q.forEach((q,i)=>turn=Math.max(turn,q.angleTo(previous.q[i])/dt));previous=now;}
    assert.ok(turn<20&&walker.pose.plain>.999&&walker.pose.walk>.999);
    assert.ok(Math.abs(walker.pose.pace-CABIN)<.03,'at the cabin speed');
    // the plain cabin walk at the same phase and place
    animateMilo(root,{...idle,moving:true,walkDistance:walker.phaseDistance});root.position.set(0,0,walker.x);root.updateMatrixWorld(true);
    const plain=snapshot();
    plain.q.forEach((q,i)=>assert.ok(q.angleTo(previous.q[i])<.03,'same pose'));
    plain.boots.forEach((p,i)=>assert.ok(p.distanceTo(previous.boots[i])<.01,'same footing'));
  }
  for(let u=3;u<4;u+=.09)for(const distance of [0,1,3]){
    animateMilo(root,{...idle,moving:true,walkDistance:u*C});root.position.set(0,0,0);root.rotation.set(0,0,0);root.updateMatrixWorld(true);
    const plain=snapshot(),walker=MiloWalker.resume(u,distance,CABIN),first=show(walker);
    plain.q.forEach((q,i)=>assert.ok(q.angleTo(first.q[i])<.12,`out of the cycle at ${u.toFixed(2)}: same pose`));
    plain.boots.forEach((p,i)=>assert.ok(p.distanceTo(first.boots[i])<.012));
    const result=walk(walker);
    assert.ok(result.turn<24&&result.back>-1e-9&&result.change<.25,`out of the cycle at ${u.toFixed(2)} for ${distance} m: ${result.turn.toFixed(1)} rad/s, ${result.back}, ${result.change.toFixed(2)} m/s`);
    if(distance)assert.ok(Math.abs(result.x-distance)<1e-6);else assert.ok(result.x<.6,'stops within a step');
  }
});

// ---- The cabin's crew
function run(actor,{hold=()=>false,events=[],limit=90}={}){
  let t=0,back=0,fastest=0,previous=actor.x,direction=0;
  while(actor.busy&&t<limit){
    for(const event of events)if(!event.done&&t>=event.at){event.done=true;event.run();}
    actor.stairs?.update(dt);actor.update(dt,hold(t));t+=dt;
    const moved=(actor.x-previous)*.022;if(actor.gait){direction=actor.gaitDirection;back=Math.min(back,moved*direction);}
    fastest=Math.max(fastest,Math.abs(moved)/dt);previous=actor.x;
  }
  return {t,back,fastest};
}
test('planned crew: arrives exactly, later than at a constant speed, and never slides',()=>{
  const actor=new CrewMotion({planned:true,floor:2,x:300});let arrived=0;
  actor.goTo({floor:2,x:600},()=>arrived++);
  const result=run(actor);
  assert.equal(arrived,1);assert.equal(actor.x,600);assert.equal(actor.gait,null);
  assert.ok(result.t>300/54+.8&&result.t<300/54+2.2,`${result.t.toFixed(2)} s for 6.6 m`);
  assert.ok(result.back>-1e-9&&result.fastest<1.6);
  // the plain crew still walks at a constant speed
  const plain=new CrewMotion({floor:2,x:300});plain.goTo({floor:2,x:600});for(let i=0;i<10;i++)plain.update(dt);
  assert.ok(Math.abs(plain.x-300-54*10*dt)<1e-9);
});
test('planned crew: held up, it stops in step and goes on when released; sent back, it stops and turns round',()=>{
  const actor=new CrewMotion({planned:true,floor:2,x:300});let arrived=0;actor.goTo({floor:2,x:600},()=>arrived++);
  let stoppedAt=null;
  run(actor,{hold:t=>{if(t>4&&t<4+dt)stoppedAt=actor.x;return t>2&&t<5;}});
  assert.equal(arrived,1);assert.equal(actor.x,600);
  // (held from 2 s: by 4 s it stands, not far beyond where it was held)
  assert.ok(stoppedAt>300+54*.5&&stoppedAt<300+54*2+.6/.022);
  const back=new CrewMotion({planned:true,floor:2,x:300});let where=0;back.goTo({floor:2,x:600},()=>where=1);
  const result=run(back,{events:[{at:2.5,run:()=>back.goTo({floor:2,x:200},()=>where=2)}]});
  assert.equal(where,2);assert.equal(back.x,200);assert.ok(result.back>-1e-9,'no step is taken backwards');
  // the traffic looks as far ahead as the walk needs to stop
  const reach=new CrewMotion({planned:true,floor:2,x:300});reach.goTo({floor:2,x:900});
  assert.ok(Math.abs(reach.reach-CREW_GAIT.startRoom/.022)<1e-9,'standing: the room a first step takes');
  for(let i=0;i<180;i++)reach.update(dt);
  assert.ok(reach.reach*.022>=reach.gait.stopDistance&&reach.reach*.022>.5&&reach.reach*.022<.65,'walking: as far as a walk in full stride needs to stop');
});
test('planned crew: turns on the spot before it sets off when the view says it faces another way',()=>{
  const actor=new CrewMotion({planned:true,floor:2,x:300});actor.viewYaw=Math.PI;
  actor.goTo({floor:2,x:600});actor.update(dt);
  assert.ok(actor.turn&&!actor.gait,'turning first');assert.ok(Math.abs(actor.turn.yaw-Math.PI/2)<1e-9);
  let t=0;while(!actor.gait&&t<4){actor.update(dt);t+=dt;}
  assert.ok(t>1.3&&t<1.7,`a quarter turn takes ${t.toFixed(2)} s`);assert.equal(actor.x,300,'it has not moved yet');
  const facing=new CrewMotion({planned:true,floor:2,x:300});facing.viewYaw=Math.PI/2;facing.goTo({floor:2,x:600});facing.update(dt);
  assert.ok(facing.gait&&!facing.turn,'already facing the way: it sets off at once');
});
test('planned crew: walks on into a stair trip and out of it without stopping, and takes the ladder from standing',()=>{
  const actor=new CrewMotion({planned:true,floor:1,x:400});actor.stairs=new CabinStairs({right:true});let arrived=0;
  actor.goTo({floor:2,x:500},()=>arrived++);
  let entered=null,left=null,previous=null,t=0;
  while(actor.busy&&t<90){
    actor.stairs.update(dt);actor.update(dt);t+=dt;
    const on=Boolean(actor.onStairs);
    if(on&&previous===false)entered={distance:actor.walkDistance,gait:actor.gait};
    if(!on&&previous===true)left={gait:Boolean(actor.gait),pose:actor.walkPose};
    previous=on;
  }
  assert.equal(arrived,1);assert.equal(actor.floor,2);assert.equal(actor.x,500);
  assert.ok(entered&&entered.gait===null&&entered.distance>0,'the trip takes over the walk counter');
  assert.ok(left?.gait&&left.pose.walk>.99&&left.pose.plain>.9,'a planned walk takes over in mid-stride');
  const ladder=new CrewMotion({planned:true,floor:1,x:400});let up=0,climbedFrom=null;ladder.goTo({floor:2,x:500},()=>up++);
  t=0;while(ladder.busy&&t<90){const was=ladder.climbing;ladder.update(dt);t+=dt;if(!was&&ladder.climbing)climbedFrom={x:ladder.x,gait:ladder.gait};}
  assert.equal(up,1);assert.equal(ladder.floor,2);assert.equal(ladder.x,500);
  assert.ok(climbedFrom&&climbedFrom.gait===null&&climbedFrom.x===700,'it stands at the ladder before it climbs');
});

// ---- Steps at the fittings
test('a visit to a shelf or counter steps up to it after the turn and back before it ends',()=>{
  for(const id of ['plant','galley','hydro']){
    const wrap=stationWrap(id),duration=6+wrap.lead+wrap.tail;let last=0;
    assert.equal(stationVisit(id,0,duration).offset,0);assert.equal(stationVisit(id,1.4,duration).gait,null,'standing while he turns');
    for(let time=0;time<=duration+1e-9;time+=1/120){
      const visit=stationVisit(id,Math.min(time,duration),duration);
      assert.ok(Math.abs(visit.offset-last)<.02,'no jump');last=visit.offset;
      assert.ok(visit.time>=0&&visit.time<=visit.duration+1e-9);
      if(visit.time>0&&visit.time<visit.duration)assert.ok(Math.abs(visit.offset-wrap.distance)<1e-6&&!visit.gait,'the work runs while he stands at the fitting');
    }
    assert.ok(Math.abs(stationVisit(id,duration,duration).offset)<1e-9);assert.ok(Math.abs(stationVisit(id,duration/2,duration).duration-6)<1e-9);
  }
  assert.equal(stationWrap('console'),null);assert.equal(stationVisit('console',1,9),null);
  // a short walk inside an authored visit: at the walk's own pace, or faster when it has to fit
  const walk=planMiloWalk(1.28,CABIN).duration;
  assert.equal(plannedPassage(1.28,0,5).fraction,0);assert.ok(Math.abs(plannedPassage(1.28,walk,5).fraction-1)<1e-9);assert.equal(plannedPassage(1.28,walk+.5,5).gait,null);
  assert.ok(Math.abs(plannedPassage(1.28,walk/2,walk/2).fraction-1)<1e-9&&plannedPassage(1.28,walk/4,walk/2).gait,'fitted into the time allowed');
  assert.ok(stationStep(.32,2.2,20).gait&&!stationStep(.32,10,20).gait);
});

// ---- The safety net
test('a pose swapped within one frame is taken up over a moment; exact quick motion and a moved frame are left alone',()=>{
  const blend=new MiloPoseBlend(root),arm=root.userData.arms[0].arm,pose=x=>{animateMilo(root,idle);arm.rotation.x=x;root.position.set(0,0,0);};
  pose(-.05);blend.apply(dt);pose(-.05);blend.apply(dt);
  pose(-1.6);assert.equal(blend.apply(dt),true);
  assert.ok(arm.rotation.x>-.2,'the arm has only started to move');
  let previous=arm.rotation.x,fastest=0,frames=0;
  while(frames<120){pose(-1.6);const active=blend.apply(dt);fastest=Math.max(fastest,Math.abs(arm.rotation.x-previous)/dt);previous=arm.rotation.x;frames++;if(!active)break;}
  assert.ok(Math.abs(arm.rotation.x+1.6)<1e-6&&frames*dt>=MILO_POSE_BLEND.seconds-.02&&frames*dt<=MILO_POSE_BLEND.longest+.02,`${frames} frames`);
  assert.ok(fastest<MILO_POSE_BLEND.turn.arm,`at most ${fastest.toFixed(1)} rad/s`);
  // below the limit nothing is changed
  pose(-1.6+20*dt);assert.equal(blend.apply(dt),false);assert.ok(Math.abs(arm.rotation.x-(-1.6+20*dt))<1e-9);
  // not looked for where the motion is quick and exact
  pose(-.05);assert.equal(blend.apply(dt,{detect:false}),false);assert.ok(Math.abs(arm.rotation.x+.05)<1e-9);
  // the figure's frame moved while the body stays where it is (onto the bike): nothing to take up ...
  const body=root.userData.body,moved=x=>{pose(x);root.position.set(0,0,.48);body.position.z-=.48;};
  moved(-.05);assert.equal(blend.apply(dt),false);assert.ok(Math.abs(body.position.z+.48)<1e-9);
  // ... but a pose swapped at the same moment still is
  pose(-.05);blend.apply(dt);moved(-1.6);assert.equal(blend.apply(dt),true);assert.ok(arm.rotation.x>-.2&&Math.abs(body.position.z+.48)<1e-6);
  for(let i=0;i<60;i++){moved(-1.6);blend.apply(dt);}
  // a frame turned at once is a new start
  moved(-.05);root.rotation.y=2;assert.equal(blend.apply(dt),false);root.rotation.y=0;moved(-.05);blend.apply(dt);
  // asked for at a hand-over
  blend.begin();moved(-.3);assert.equal(blend.apply(dt),true);
});

// ---- Found by an independent review of the first version
test('an open walk ends where it was asked to; a short walk sent far walks there at the usual pace',()=>{
  for(let distance=.1;distance<6;distance+=.07){
    const walker=MiloWalker.start(distance,CABIN,{open:true});let n=0;
    while(walker.remaining>0&&n++<2000)walker.step(dt);
    assert.ok(Math.abs(walker.target-distance)<1e-9&&walker.x-distance<.03,`open walk of ${distance.toFixed(2)} m ends at ${walker.x.toFixed(3)}`);
  }
  const far=MiloWalker.start(.3,CABIN);let t=0;
  while(!far.done&&t<60){if(Math.abs(t-.3)<dt/2)far.retarget(10);far.step(dt);t+=dt;}
  assert.ok(far.done&&t<11,`0.3 m, then 10 m more: ${t.toFixed(1)} s`);
  // the same through the crew: three short errands replaced by a long one
  for(const [first,after] of [[301,.25],[305,.3],[312,.4]]){
    const actor=new CrewMotion({planned:true,floor:2,x:300});actor.goTo({floor:2,x:first});
    const result=run(actor,{events:[{at:after,run:()=>actor.goTo({floor:2,x:900})}]});
    assert.equal(actor.x,900);assert.ok(result.t<15,`${result.t.toFixed(1)} s for 13.2 m`);
  }
});
test('planned crew: every deck change by the stairs arrives without walking past an entrance',()=>{
  const ids=['galley','hydro','plant','gym','bunk','shower','toilet','lounge','console','medical','grooming','smoking'];
  for(const from of ids)for(const to of ids){
    const a=getStation(from),b=getStation(to);if(a.floor===b.floor)continue;
    const actor=new CrewMotion({planned:true,floor:a.floor,x:a.x});actor.stairs=new CabinStairs({right:true});let arrived=0,turnsBack=0,last=0;
    actor.goTo(b,()=>arrived++);
    let t=0;while(actor.busy&&t<120){actor.stairs.update(dt);actor.update(dt);t+=dt;
      // (a walk that has to stop and come back shows as a change of walking direction on one deck before the trip)
      if(actor.gait&&!actor.onStairTrip()&&actor.queue[1]?.type==='stairs'){if(last&&actor.gaitDirection!==last)turnsBack++;last=actor.gaitDirection;}}
    assert.equal(arrived,1,`${from} -> ${to}`);assert.equal(actor.x,b.x);assert.equal(actor.floor,b.floor);assert.equal(turnsBack,0,`${from} -> ${to} walks past the stairs`);
  }
});
test('a stair trip that sets off the other way, or starts where the crew stands, is entered from standing',()=>{
  const stairs=new CabinStairs({right:true}),trip=stairs.trip(2,1,11.9,0),entrance=700+trip.from.x/.022;
  for(const offset of [.3,0,-.05,-1]){
    // (+: beyond the entrance, the trip leads on outwards: walk back to it, turn, set off)
    const actor=new CrewMotion({planned:true,floor:2,x:entrance+offset/.022});actor.stairs=new CabinStairs({right:true});let arrived=0,jump=0,previous=actor.x;
    actor.goTo({floor:1,x:600},()=>arrived++);
    let t=0;while(actor.busy&&t<120){actor.stairs.update(dt);actor.update(dt);t+=dt;jump=Math.max(jump,Math.abs(actor.x-previous)*.022);previous=actor.x;}
    assert.equal(arrived,1);assert.equal(actor.x,600);assert.ok(jump<.04,`start ${offset} m from the entrance: the place jumps ${jump.toFixed(2)} m in a tick`);
  }
});
