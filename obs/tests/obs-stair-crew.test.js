import test from 'node:test';
import assert from 'node:assert/strict';
import {CrewMotion,getStation} from '../src/obs/state.js';
import {FLOORS,STATIONS} from '../src/obs/layout.js';
import {CabinStairs,STAIR_TRAFFIC} from '../src/obs/stair-traffic.js';
import {stairTrip} from '../src/obs/stair-trip.js';
import * as routeModule from '../src/obs/stair-route.js';

const run=(actor,stairs,seconds,each=()=>{})=>{for(let i=0;i<seconds*60;i++){stairs.update(1/60);actor.update(1/60);each(i);if(!actor.busy)break;}};
const stationOn=floor=>STATIONS.find(s=>s.floor===floor);

test('without shared stairs the crew keeps using the ladder (plain studies and tests)',()=>{
  const actor=new CrewMotion({floor:2,x:400});actor.goTo(stationOn(0));
  assert(actor.queue.some(s=>s.type==='climb'));assert(!actor.queue.some(s=>s.type==='stairs'));
});

test('floor changes walk the stair tower between every pair of decks and arrive',()=>{
  for(const from of [0,1,2])for(const to of [0,1,2]){
    if(from===to)continue;
    const stairs=new CabinStairs(),actor=new CrewMotion({floor:from,x:400});actor.stairs=stairs;
    const target=stationOn(to);let arrived=false,used=false,climbed=false,prev=null,maxStep=0;
    actor.goTo(target,()=>{arrived=true;});
    run(actor,stairs,120,()=>{
      used||=Boolean(actor.onStairs);climbed||=actor.climbing;
      const p={x:(actor.x-700)*.022,y:(870-actor.y)*.016};
      if(prev)maxStep=Math.max(maxStep,Math.hypot(p.x-prev.x,p.y-prev.y));prev=p;
    });
    assert(arrived,`${from}->${to} arrives`);assert(used&&!climbed,`${from}->${to} uses the stairs`);
    assert.equal(actor.floor,to);assert.equal(actor.y,FLOORS[to].y);assert.equal(actor.x,target.x);
    assert(maxStep<.05,`${from}->${to} moves continuously (${maxStep.toFixed(3)} m/frame)`);
    assert.equal(stairs.count,0,'leaves the stair traffic');
  }
});

test('the crew takes the ladder when the stairs are crowded at the entrance',()=>{
  const stairs=new CabinStairs(),blocker={},trip=stairTrip(2,0);
  stairs.enter(blocker,'droid',trip,.2); // standing at the bottom entrance
  const actor=new CrewMotion({floor:2,x:400});actor.stairs=stairs;actor.goTo(stationOn(0));
  assert(actor.queue.some(s=>s.type==='climb'),'ladder planned');assert(!actor.queue.some(s=>s.type==='stairs'));
});

test('a jammed entrance makes the walker give up and take the ladder, then avoid the stairs',()=>{
  const stairs=new CabinStairs(),actor=new CrewMotion({floor:2,x:400});actor.stairs=stairs;
  const target=stationOn(0);let arrived=false,placed=false,gaveUpAt=null,avoidedAfterGivingUp=false;
  actor.goTo(target,()=>{arrived=true;});
  for(let i=0;i<120*60&&actor.busy;i++){
    stairs.update(1/60);actor.update(1/60);
    const seg=actor.onStairs;
    // someone stops right in front of the walker just after it steps onto the trip
    if(seg&&!placed){stairs.enter({},'droid',seg.trip,seg.t+.6);placed=true;}
    if(placed&&gaveUpAt===null&&actor.queue.some(s=>s.type==='climb')){gaveUpAt=i;avoidedAfterGivingUp=stairs.avoiding(actor);}
  }
  assert(placed,'entered the stairs');assert(gaveUpAt!==null,'switched to the ladder');
  assert(avoidedAfterGivingUp,'keeps off the stairs for a while');
  assert(arrived);assert.equal(actor.floor,0);
});

test('walkers keep their distance in one lane and pass in opposite lanes',()=>{
  const stairs=new CabinStairs(),a={},b={},c={};
  const up=stairTrip(2,0),down=stairTrip(0,2);
  stairs.enter(a,'crew',up,5);stairs.enter(b,'crew',up,4.5);stairs.enter(c,'crew',down,down.tOfRouteS(up.routeS(5))-.3);
  for(let i=0;i<600;i++){stairs.update(1/60);for(const w of [a,b,c])stairs.advance(w,.011,1/60);}
  const pa=stairs.position(stairs.walker(a)),pb=stairs.position(stairs.walker(b));
  assert(Math.hypot(pa.x-pb.x,pa.y-pb.y,pa.z-pb.z)>=STAIR_TRAFFIC.clearance.default-.15,'follower keeps its distance');
  assert(stairs.walker(c).t>down.tOfRouteS(up.routeS(5))+3,'opposite walker passed');
});

test('after any stair trip the cabin poses still face the way the cabin animation asks',async()=>{
  // The cabin animation only writes root.rotation.y. The handover at both
  // ends of a trip must leave the other two angles alone, or every later
  // pose (sitting, working at a console) faces backwards.
  const {MeshStandardMaterial,Vector3}=await import('three');
  const {createMilo,animateMilo}=await import('../src/obs/characters.js');
  const {poseHumanTrip}=await import('../src/obs/human-stair-gait.js');
  const {stairTrip}=await import('../src/obs/stair-trip.js');
  const material=new MeshStandardMaterial();
  for(const [from,to] of [[2,1],[1,2],[2,0],[0,2],[1,0],[0,1]])for(const facing of [1,-1]){
    const root=createMilo(new Proxy({},{get:()=>material})),trip=stairTrip(from,to);
    const walk={moving:true,climbing:false,facing,walkYaw:facing*Math.PI/2,time:0,dt:1/60};
    for(let t=0,time=0;t<=trip.length;t+=.02,time+=1/60){
      poseHumanTrip(root,trip,t,time,{cabinPose:()=>animateMilo(root,{...walk,time})});
      assert.equal(root.rotation.x,0,`trip ${from}>${to} t=${t.toFixed(2)}: root tilts`);
      assert.equal(root.rotation.z,0,`trip ${from}>${to} t=${t.toFixed(2)}: root rolls`);
    }
    poseHumanTrip(root,trip,trip.length,9,{cabinPose:()=>animateMilo(root,{...walk,time:9})});
    for(let i=0;i<240;i++)animateMilo(root,{moving:false,climbing:false,facing,action:'console',time:10+i/60,dt:1/60,actionTime:i/60,actionDuration:30});
    root.updateMatrixWorld(true);
    const forward=new Vector3(0,0,1).transformDirection(root.matrixWorld),want=Math.PI*.84;
    assert.ok(forward.x*Math.sin(want)+forward.z*Math.cos(want)>.99,`trip ${from}>${to}: at the console Milo faces ${Math.atan2(forward.x,forward.z).toFixed(2)}, not ${want.toFixed(2)}`);
  }
});

test('a walker held outside a deck crossing for 3 s walks on into it instead of creeping',()=>{
  // The droid stands in the middle deck's crossing on its way down while the
  // crew arrives there from below: each waits for the other. The crew (first
  // on the stairs) goes on after 3 s and must then reach the crossing.
  const stairs=new CabinStairs(),crew={},droid={},up=stairTrip(2,1),down=stairTrip(0,2,{fromZ:1.48});
  stairs.enter(crew,'crew',up,10.9);stairs.enter(droid,'droid',down,14.1);
  let waited=0;
  for(let i=0;i<60*8;i++){
    stairs.update(1/60);const before=stairs.walker(crew).t;
    stairs.advance(crew,.008,1/60);stairs.walker(droid).waiting+=1/60; // the droid stands in the crossing
    if(stairs.walker(crew).t===before)waited+=1/60;
  }
  assert(waited>2.9&&waited<3.6,`waits about 3 s (${waited.toFixed(2)} s)`);
  assert(stairs.walker(crew).t>10.9+.35,`then walks on (${(stairs.walker(crew).t-10.9).toFixed(2)} m in 8 s)`);
});

test('the crew keeps a real stair cadence at cabin speed and slows down to it before the flights',()=>{
  const {HUMAN_PACE,STAIRS}={...routeModule};
  for(const [from,to] of [[2,1],[1,2],[2,0],[0,2]]){
    const trip=stairTrip(from,to),cabin=1.188,flight=trip.flights[0],mid=(flight.t0+flight.t1)/2;
    // same absolute speed on a flight whatever the cabin speed is
    assert(Math.abs(cabin*trip.pace(mid,cabin)-HUMAN_PACE.floor*trip.pace(mid))<1e-9);
    const cos=Math.abs(flight.flight.b[0]-flight.flight.a[0])/flight.flight.length,stepsPerMinute=cabin*trip.pace(mid,cabin)*cos/STAIRS.tread*60;
    if(trip.direction>0)assert(stepsPerMinute>85&&stepsPerMinute<95,`up ${stepsPerMinute.toFixed(0)} steps/min`);
    else assert(stepsPerMinute>100&&stepsPerMinute<110,`down ${stepsPerMinute.toFixed(0)} steps/min`);
    // cabin speed at both ends of the trip, never faster, and no jump in speed
    assert.equal(trip.pace(0,cabin),1);assert.equal(trip.pace(trip.length,cabin),1);
    let previous=1;
    for(let t=0;t<=trip.length;t+=.01){
      const pace=trip.pace(t,cabin);
      assert(pace<=1.6&&pace>.2,`pace ${pace.toFixed(2)} at ${t.toFixed(2)}`);
      // (travel is measured along the slope on a flight: the pace steps there, the walked speed does not)
      const edge=trip.flights.some(f=>Math.abs(t-f.t0)<.011||Math.abs(t-f.t1)<.011);
      assert(edge||Math.abs(pace-previous)<.03,`trip ${from}>${to}: pace jumps at ${t.toFixed(2)} (${previous.toFixed(3)} -> ${pace.toFixed(3)})`);previous=pace;
    }
    // between two flights the walker stays near the landing pace
    for(let t=trip.flights[0].t1+.01;t<trip.flights.at(-1).t0;t+=.05)if(trip.routeS(t)!==null)assert(cabin*trip.pace(t,cabin)<HUMAN_PACE.landing*1.6);
  }
});

test('the walk counter runs on unbroken into a trip, follows its footfalls and leaves at the cabin rate',async()=>{
  const {humanTripDistance,humanSchedule,cabinWalkCycle,humanTripWeight,HUMAN_TRIP_POSE}=await import('../src/obs/human-stair-gait.js');
  const C=cabinWalkCycle(),speed=1.188;
  for(const [from,to] of [[2,1],[1,2],[0,2]])for(const entry of [0,.21,.5,.777,1.1,1.5,37.63]){
    const trip=stairTrip(from,to),arrival={speed,entry},slow=trip.flights[0].t0-trip.slowDistance(speed);
    assert(Math.abs(humanTripDistance(trip,0,arrival)-entry)<1e-6,'continues from the cabin walk');
    // metre for metre until the walker starts to slow down, then one cabin step per stair step
    for(let t=0;t<slow;t+=.02)assert(Math.abs(humanTripDistance(trip,t,arrival)-entry-t)<.03,`trip ${from}>${to} entry ${entry}: counter off at ${t.toFixed(2)}`);
    let previous=entry;
    for(let t=.01;t<=trip.length;t+=.01){const d=humanTripDistance(trip,t,arrival);assert(d>previous-1e-9,'never runs back');assert(d-previous<.06,'never jumps');previous=d;}
    const end=trip.length;
    assert(Math.abs(humanTripDistance(trip,end,arrival)-humanTripDistance(trip,end-.3,arrival)-.3)<.02,'leaves at the cabin rate');
  }
  // the pose is the cabin walk alone away from the flights and the stair walk alone at them
  const trip=stairTrip(1,2);
  assert.equal(humanTripWeight(trip,0),0);assert.equal(humanTripWeight(trip,trip.length),0);
  assert.equal(humanTripWeight(trip,trip.flights[0].t0-HUMAN_TRIP_POSE.full),1);
  assert.equal(humanTripWeight(trip,(trip.flights[0].t1+trip.flights[1].t0)/2),1,'stair walk on the turn landing');
  assert(C.step>.7&&C.step<.85&&C.lead>.3);
  void humanSchedule;
});

test('Milo walks into, over and out of the stairs without a jump in any limb',async()=>{
  const THREE=await import('three');
  const {createMilo,animateMilo}=await import('../src/obs/characters.js');
  const {poseHumanTrip}=await import('../src/obs/human-stair-gait.js');
  const {crewWalkway}=await import('../src/obs/cabin-walkway.js');
  const material=new THREE.MeshStandardMaterial(),px=x=>(x-700)*.022,py=y=>(870-y)*.016;
  for(const [from,to] of [[1,2],[2,1]]){
    const stairs=new CabinStairs(),actor=new CrewMotion({floor:from,x:470});actor.stairs=stairs;
    const root=createMilo(new Proxy({},{get:()=>material}));actor.goTo({floor:to,x:540});
    const rows=[];let time=0,blended=0;
    for(let i=0;i<60*90&&actor.busy;i++){
      stairs.update(1/60);actor.update(1/60);time+=1/60;
      const walkway=crewWalkway(px(actor.x),actor.floor,actor.facing,actor.loungeAvoidance),stair=actor.onStairs;
      root.position.set(px(actor.x),py(actor.y),walkway.z);
      if(stair){const f=stair.trip.frame(stair.t);root.position.set(f.x,f.y,f.z);walkway.yaw=f.yaw;}
      const pose={moving:actor.busy,waiting:false,climbing:false,facing:actor.facing,walkYaw:walkway.yaw,walkDistance:actor.walkDistance*.022,time,dt:1/60};
      if(stair){const h=poseHumanTrip(root,stair.trip,stair.t,time,{arrival:stair.arrival,cabinPose:(walkDistance,walkStride)=>animateMilo(root,{...pose,walkDistance,walkStride})});if(h.handover>0&&h.handover<1)blended++;}
      else animateMilo(root,pose);
      root.updateMatrixWorld(true);
      const u=root.userData,at=o=>o.getWorldPosition(new THREE.Vector3());
      rows.push({stair:Boolean(stair),parts:{root:root.position.clone(),'left boot':at(u.legs[0].boot),'right boot':at(u.legs[1].boot),'left hand':at(u.arms[0].hand),'right hand':at(u.arms[1].hand),head:at(u.head)}});
    }
    assert(blended>20,'both walks are mixed for a while');
    // change of velocity between frames (m/s^2); the cabin walk itself stays under ~90, a pop is 300+
    for(let k=2;k<rows.length-1;k++)for(const [name,p] of Object.entries(rows[k].parts)){
      const a=p.clone().sub(rows[k-1].parts[name]).sub(rows[k-1].parts[name].clone().sub(rows[k-2].parts[name])).length()*3600;
      assert(a<200,`trip ${from}>${to} frame ${k}: ${name} jumps (${a.toFixed(0)} m/s^2)`);
    }
    // walking speed is unbroken where the trip starts and ends
    const first=rows.findIndex(r=>r.stair),last=rows.findLastIndex(r=>r.stair);
    for(const k of [first-1,first,first+1,last,last+1,last+2]){const v=rows[k].parts.root.distanceTo(rows[k-1].parts.root)*60;assert(Math.abs(v-1.188)<.02,`trip ${from}>${to}: speed ${v.toFixed(2)} m/s at the trip's end`);}
  }
});

test('stair trips work at every walking speed the crew health sets, for every arrival phase',async()=>{
  // brain.js slows the crew down with its health (x0.92 injury .. x0.48 critical).
  const {humanSchedule,humanTripDistance,cabinWalkCycle}=await import('../src/obs/human-stair-gait.js');
  const C=cabinWalkCycle();
  for(const factor of [1,.92,.85,.68,.48])for(const [from,to] of [[2,1],[1,2],[2,0],[0,2],[1,0],[0,1]]){
    const trip=stairTrip(from,to),speed=1.188*factor,label=`x${factor} trip ${from}>${to}`;
    // nobody takes the flights faster than the floor
    const flight=trip.flights[0],mid=(flight.t0+flight.t1)/2,cos=Math.abs(flight.flight.b[0]-flight.flight.a[0])/flight.flight.length;
    assert(speed*trip.pace(mid,speed)*cos<=speed+1e-9,`${label}: flights faster than the floor`);
    for(let bin=0;bin<32;bin++){
      const entry=bin/32*C.cycle,arrival={speed,entry};
      assert(Math.abs(humanTripDistance(trip,0,arrival)-entry)<1e-6,`${label} phase ${bin}: counter does not continue`);
      const steps=humanSchedule(trip,{speed,entry,key:`${speed.toFixed(3)}:${bin}`});
      for(let k=1;k<steps.length;k++){
        const a=steps[k-1],b=steps[k];
        assert(b.t>a.t&&b.side===-a.side&&b.distance>a.distance,`${label} phase ${bin}: step ${k} out of order`);
        if(b.t<0||a.t>trip.length||(a.flight&&b.flight))continue;
        const length=Math.hypot(b.ankle.x-a.ankle.x,b.ankle.z-a.ankle.z);
        assert(length>.2&&length<1,`${label} phase ${bin}: floor step ${k} is ${length.toFixed(2)} m`);
      }
      let previous=entry;
      for(let t=.02;t<=trip.length;t+=.02){const d=humanTripDistance(trip,t,arrival);assert(d>previous&&d-previous<.09,`${label} phase ${bin}: counter at ${t.toFixed(2)}`);previous=d;}
    }
    // the whole trip in the simulation, with the health changing on the way
    const stairs=new CabinStairs(),actor=new CrewMotion({floor:from,x:430});actor.stairs=stairs;actor.walkSpeed*=factor;
    let arrived=false,counter=0,frames=0;actor.goTo({floor:to,x:540},()=>{arrived=true;});
    run(actor,stairs,240,()=>{
      if(actor.onStairs&&++frames===200)actor.walkSpeed*=factor===1?.48:1/factor;
      assert(actor.walkDistance>=counter,`${label}: counter runs back`);counter=actor.walkDistance;
    });
    assert(arrived&&actor.floor===to,`${label}: arrives`);
  }
});

test('outside a deck crossing a walker gives way to walkers still moving through it, but not for ever',()=>{
  const wait=(move)=>{
    const stairs=new CabinStairs(),crew={},droid={},up=stairTrip(2,1),down=stairTrip(0,2,{fromZ:1.48});
    stairs.enter(droid,'droid',down,14.1);stairs.enter(crew,'crew',up,10.9);
    let waited=0;
    for(let i=0;i<60*12;i++){
      stairs.update(1/60);const before=stairs.walker(crew).t;
      stairs.advance(crew,.008,1/60);
      // the droid walks on the spot in the crossing (moving) or stands (stopped)
      const w=stairs.walker(droid);if(move){w.waiting=0;}else stairs.advance(droid,0,1/60),w.waiting+=1/60;
      if(stairs.walker(crew).t===before)waited+=1/60;else if(stairs.walker(crew).t>11.3)break;
    }
    return waited;
  };
  const moving=wait(true),stopped=wait(false);
  assert(moving>STAIR_TRAFFIC.crossingLimit-.2&&moving<STAIR_TRAFFIC.crossingLimit+.6,`gives way to a moving walker up to the limit (${moving.toFixed(1)} s)`);
  assert(stopped>STAIR_TRAFFIC.crossingLimit-.2,`gives way to an earlier walker that has stopped (${stopped.toFixed(1)} s)`);
});

test('trips and people who are not on a trip keep off each other',async()=>{
  const {cabinBodies}=await import('../src/obs/stair-traffic.js');
  const B=STAIR_TRAFFIC.body,trip=stairTrip(1,2);
  // someone standing where the trip starts makes the stairs crowded
  {
    const stairs=new CabinStairs(),crew={},other={},start=trip.frame(.6);
    stairs.bodies=()=>[{agent:other,x:start.x,y:start.y,z:start.z+.3}];
    assert(!stairs.available(crew,trip),'crowded');
    stairs.bodies=()=>[{agent:other,x:start.x+3,y:start.y,z:start.z}];
    assert(stairs.available(crew,trip),'free when the other is away');
    stairs.bodies=()=>[{agent:other,x:start.x,y:start.y+3.4,z:start.z}];
    assert(stairs.available(crew,trip),'someone on another deck does not count');
  }
  // a walker on a trip stops short of a bystander, goes on when the way is free, and never waits for ever
  {
    const stairs=new CabinStairs(),crew={},other={},at=trip.frame(trip.exitStart+1.2);let here=true;
    stairs.bodies=()=>here?[{agent:other,x:at.x,y:at.y,z:at.z}]:[];
    stairs.enter(crew,'crew',trip,trip.exitStart+.1);
    const walk=seconds=>{for(let i=0;i<seconds*60;i++){stairs.update(1/60);stairs.advance(crew,.015,1/60);}return stairs.walker(crew).t;};
    const gap=()=>{const p=trip.frame(stairs.walker(crew).t);return Math.hypot(p.x-at.x,p.z-at.z);};
    walk(4);assert(gap()>=B.space-.02&&gap()<B.space+.05,`stops ${gap().toFixed(2)} m short`);
    here=false;const before=stairs.walker(crew).t;assert(walk(1)>before+.5,'goes on when the way is free');
    const again=new CabinStairs();again.bodies=()=>[{agent:other,x:at.x,y:at.y,z:at.z}];again.enter(crew,'crew',trip,trip.exitStart+.1);
    for(let i=0;i<(B.limit+6)*60;i++){again.update(1/60);again.advance(crew,.015,1/60);}
    assert(again.walker(crew).t>trip.exitStart+1.6,'goes on after the limit');
  }
  // someone who is not on a trip does not walk closer than giveWay to a walker on a trip, but may walk away
  {
    const stairs=new CabinStairs(),walker={},other={},p=trip.frame(trip.exitStart+1);
    stairs.enter(walker,'droid',trip,trip.exitStart+1);
    // (d metres behind the walker: not in its way ahead)
    const at=d=>({x:p.x-p.dx*d,y:p.y,z:p.z-p.dz*d});
    assert(stairs.blocksBystander(other,at(B.giveWay+.02),at(B.giveWay-.02),1/60),'held when approaching');
    assert(!stairs.blocksBystander(other,at(B.giveWay-.1),at(B.giveWay-.05),1/60),'free to walk away');
    assert(!stairs.blocksBystander(other,at(2),at(1.9),1/60),'free at a distance');
    assert(!stairs.blocksBystander(walker,at(.6),at(.5),1/60),'a walker on a trip is not a bystander');
    // not into the stretch of the trip just ahead of the walker, from the side
    const ahead=trip.frame(trip.exitStart+2.2),beside=d=>({x:ahead.x,y:ahead.y,z:ahead.z+d});
    assert(stairs.blocksBystander(other,beside(B.clear+.01),beside(B.clear-.01),1/60),'held at the edge of the way ahead');
    assert(!stairs.blocksBystander(other,beside(B.clear+.3),beside(B.clear+.25),1/60),'free beside it');
    // someone already in the way walks on to clear it and may brush past the walker, but not into it
    assert(!stairs.blocksBystander(other,beside(.3),beside(.25),1/60),'in the way: may move');
    const front=d=>({x:p.x+p.dx*d,y:p.y,z:p.z+p.dz*d});
    assert(!stairs.blocksBystander(other,front(B.space+.05),front(B.space),1/60),'may come nearer than arm\'s length to get out');
    assert(stairs.blocksBystander(other,front(B.brush+.01),front(B.brush-.01),1/60),'but not into the walker');
    stairs.gaveWay.clear();
    let held=0;for(let i=0;i<(B.limit+5)*60;i++)if(stairs.blocksBystander(other,at(.6),at(.59),1/60))held++;
    assert(Math.abs(held/60-B.limit)<.1,`gives way for the limit only (${(held/60).toFixed(1)} s)`);
  }
  // in the cabin: Milo walking past the tower gives way to the droid coming off the stairs
  {
    const stairs=new CabinStairs(),droid={},actor=new CrewMotion({floor:2,x:700-10.9/.022}),down=stairTrip(0,2,{fromZ:1.48,toZ:1.48});
    actor.stairs=stairs;stairs.bodies=cabinBodies({actor});
    stairs.enter(droid,'droid',down,down.exitStart+.2);actor.goTo({floor:2,x:700-12.4/.022});
    const {advanceCabinTraffic}=await import('../src/obs/state.js');
    const cat={motion:{blocksCrew:()=>false},update(){}};let closest=9,waited=0;
    for(let i=0;i<60*20&&actor.busy;i++){
      stairs.update(1/60);if(stairs.walker(droid)){stairs.advance(droid,.008,1/60);if(stairs.walker(droid).t>=down.length)stairs.leave(droid);}
      advanceCabinTraffic(actor,cat,1/60);if(actor.waitingForStairs)waited++;
      const w=stairs.walker(droid);if(w){const p=down.frame(w.t);closest=Math.min(closest,Math.hypot(p.x-(actor.x-700)*.022,p.z-.78));}
    }
    assert(!actor.busy,'Milo arrives');assert(closest>.45,`closest ${closest.toFixed(2)} m`);
  }
  // a walker leaving the tower is on its own lane, clear of the other lanes, within two metres
  for(const [from,to] of [[2,1],[1,2],[2,0],[0,2],[1,0],[0,1]]){
    const crew=stairTrip(from,to);
    for(let t=crew.exitStart+2;t<=crew.length;t+=.05)assert(Math.abs(crew.frame(t).z-.78)<.02,`crew ${from}>${to} back on its lane`);
    assert(crew.length-crew.exitStart>=crew.slowDistance(1.188),'long enough to be back at cabin speed');
  }
});
