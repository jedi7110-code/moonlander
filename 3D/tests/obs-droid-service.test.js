import test from 'node:test';
import assert from 'node:assert/strict';
import {Vector3,Box3,MeshStandardMaterial,Group,Mesh,BoxGeometry,Quaternion} from 'three';
import {DroidRoutine,DROID_JOBS,DROID_HOME,DROID_PACE} from '../src/obs/droid-routine.js';
import {Supplies} from '../src/obs/state.js';
import {PlantBed} from '../src/obs/plant-state.js';
import {createDroid,DROID_SPEC} from '../src/obs/droid-model.js';
import {sampleDroidServicePose,droidLadderContact,createDroidServiceRig} from '../src/obs/droid-service.js';
import {createAccessLadder} from '../src/obs/ship.js';
import {DROID_STARTUP_SECONDS} from '../src/obs/droid-startup.js';

function setup(job){
  const care=new Supplies(),brain={plants:new PlantBed(),actStation:null},actor={x:1040,climbing:false};
  if(job==='cargo')care.lastDelivery=1;
  if(job==='harvest'){brain.plants.rows.forEach(row=>row.growth=1);care.supplies.food=0;}
  const routine=new DroidRoutine({care,brain,actor,cat:{mode:'sleep'}});
  assert.ok(routine.request(job));return {routine,care,brain,actor};
}
function finish(routine,visit=()=>{}){
  for(let i=0;i<20000&&!routine.docked;i++){routine.update(.05);visit(routine);}
  assert.ok(routine.docked,'job must return to dock');
}
test('each job warms up at the dock using local wake age and respects pause',()=>{
  const {routine}=setup('laundry'),droid=createDroid({detail:'obs'});
  try{
    for(let cycle=0;cycle<2;cycle++){
      if(cycle)assert.ok(routine.request('laundry'));
      assert.equal(routine.pose.mode,'wake');assert.equal(routine.pose.duration,DROID_STARTUP_SECONDS);
      assert.equal(droid.update(routine.time,'service',sampleDroidServicePose(routine.pose)).facePower,0);
      const home={...routine.position};
      for(const age of [.21,.4,.58,.76,1.5,2.6,3.15]){
        routine.update(age-routine.age);
        const p=routine.pose,model=sampleDroidServicePose(p);
        assert.equal(p.mode,'wake');assert.equal(model.wakeAge,p.age);
        assert.deepEqual(routine.position,home,'remain at dock until the face has warmed up');
        const before=droid.update(p.time,'service',model).facePower;
        if(age===.21)assert.ok(before>.7,'flashes repeat even after hours of simulation');
        if(age===.4||age===.76)assert.equal(before,0);
        if(age===3.15)assert.ok(before>.99);
        routine.update(0);assert.deepEqual(routine.pose,p);
        assert.equal(droid.update(routine.time,'service',sampleDroidServicePose(routine.pose)).facePower,before);
      }
      routine.update(.1);assert.notEqual(routine.pose.mode,'wake');
      const awake=sampleDroidServicePose(routine.pose);assert.equal(awake.wakeAge,undefined);
      assert.equal(droid.update(routine.time,'service',awake).facePower,1);
      finish(routine);
    }
  }finally{droid.dispose();}
});
test('all household jobs travel continuously, finish once and return powered down',()=>{
  for(const job of Object.keys(DROID_JOBS)){
    const {routine}=setup(job);let before={...routine.position},climbed=false;
    finish(routine,r=>{
      const p=r.position;assert.ok(Math.hypot(p.x-before.x,p.y-before.y,p.z-before.z)<.58*DROID_PACE*.05+.001,'no teleport');
      climbed||=r.step?.kind==='climb';before={...p};
    });
    assert.ok(climbed);assert.equal(routine.completed[job],1);assert.equal(routine.pose.rest,1);
    for(const key of ['x','y','z'])assert.ok(Math.abs(routine.position[key]-DROID_HOME[key])<1e-6);
  }
});
test('harvesting, storage and feeding do not duplicate or overdraw inventory',()=>{
  const cargo=setup('cargo'),inventory={...cargo.care.supplies};finish(cargo.routine);
  assert.deepEqual(cargo.routine.stored,[0,1,2]);assert.deepEqual(cargo.care.supplies,inventory);
  const harvest=setup('harvest');finish(harvest.routine);assert.equal(harvest.care.supplies.food,3);
  assert.ok(harvest.brain.plants.rows.every(row=>row.growth===.05));
  const feed=setup('feed');finish(feed.routine);assert.equal(feed.care.catBowl,1);assert.equal(feed.care.supplies.catfood,2);
  assert.equal(feed.care.fillCatBowl(),false);assert.equal(feed.care.eatCatFood(),true);
  assert.equal(feed.care.catBowl,0);assert.equal(feed.care.supplies.catfood,2);
});
test('laundry contents appear only after loading and leave the drum when picked up',()=>{
  const droid=createDroid({detail:'obs'}),washerClothes=new Group();
  const rig=createDroidServiceRig({droid,cable:new Group()},{cargo:[],washerClothes});
  const {routine,care,brain,actor}=setup('laundry');
  try{
    rig.update(new DroidRoutine({care,brain,actor,cat:{mode:'sleep'}}));assert.equal(washerClothes.visible,false);
    for(let cycle=0;cycle<2;cycle++){
      if(cycle)assert.ok(routine.request('laundry'));
      rig.update(routine);assert.equal(routine.washerLoaded,false);assert.equal(washerClothes.visible,false);
      let loaded=0,unloaded=0,previous=false,washing=0,loading=0,unloading=0;
      finish(routine,r=>{
        rig.update(r);
        assert.equal(washerClothes.visible,r.washerLoaded);
        if(r.washerLoaded&&!previous)loaded++;
        if(!r.washerLoaded&&previous)unloaded++;
        previous=r.washerLoaded;
        const p=r.pose;
        if(p.action==='laundry-load'||p.action==='laundry-unload'){
          const inside=p.action==='laundry-load'?p.age>=p.duration*.65:p.age<p.duration*.35;
          assert.equal(r.washerLoaded,inside);
          assert.equal(rig.props.cloth.visible,!inside,'one load transfers between the hands and the drum, without duplication');
          if(p.action==='laundry-load')loading++;else unloading++;
        }
        if(p.action==='wash'){
          washing++;assert.equal(washerClothes.visible,true);assert.equal(rig.props.cloth.visible,false);
          const state=[r.washerLoaded,r.carrying,washerClothes.rotation.z];r.update(0);rig.update(r);
          assert.deepEqual([r.washerLoaded,r.carrying,washerClothes.rotation.z],state,'pause preserves the load');
        }
        if(!r.washerLoaded)assert.equal(washerClothes.rotation.z,0);
      });
      assert.equal(loaded,1);assert.equal(unloaded,1);assert.ok(loading&&washing&&unloading);
      assert.equal(washerClothes.visible,false);assert.equal(routine.washerLoaded,false);
    }
    // Seeking back to the start in the study must clear a previous load too.
    const loadedRoutine=setup('laundry').routine;
    for(let i=0;i<10000&&!loadedRoutine.washerLoaded;i++)loadedRoutine.update(.05);
    rig.update(loadedRoutine);assert.equal(washerClothes.visible,true);
    rig.update(setup('laundry').routine);assert.equal(washerClothes.visible,false);
  }finally{
    droid.dispose();const geometries=new Set(),materials=new Set();
    rig.root.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material)materials.add(o.material);});
    geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());
  }
});
test('the saucepan stays on the hob before cooking, throughout the job and after the meal is eaten',()=>{
  const droid=createDroid({detail:'obs'}),rig=createDroidServiceRig({droid,cable:new Group()},{cargo:[]});
  const {routine,care,brain,actor}=setup('cook'),pot=rig.props.pot;
  const position=pot.position.clone(),rotation=pot.quaternion.clone(),seen=new Set();
  const check=()=>{
    assert.equal(pot.visible,true,'the saucepan must never appear or disappear with the cooking phase');
    assert.ok(pot.position.equals(position));assert.ok(pot.quaternion.equals(rotation));
  };
  try{
    check();
    rig.update(new DroidRoutine({care,brain,actor,cat:{mode:'sleep'}}));check();
    rig.update(routine);check();
    for(let i=0;i<5000&&!routine.docked;i++){
      routine.update(.2);rig.update(routine);check();
      const action=routine.pose.action;
      if(action?.startsWith('cook-'))seen.add(action);
      if(action==='cook-chop'){
        assert.equal(rig.props.board.visible,true);
        const boardBounds=new Box3().setFromObject(rig.props.board),potBounds=new Box3().setFromObject(pot);
        assert.ok(boardBounds.min.x>potBounds.max.x+.05,'chopping board clears the saucepan and its handles');
        const knifeBounds=new Box3().setFromObject(rig.props.knife),tip=knifeBounds.getCenter(new Vector3());
        assert.ok(tip.x>boardBounds.min.x&&tip.x<boardBounds.max.x,'chopping hand follows the relocated board');
      }
    }
    assert.ok(routine.docked);assert.deepEqual([...seen],['cook-chop','cook-stir','cook-serve','cook-cleanup']);
    assert.equal(care.preparedMeals,1);assert.ok(care.take('food'));assert.equal(care.preparedMeals,0);
    rig.update(routine);check();rig.update(routine);check();
    assert.ok(routine.request('feed'));rig.update(routine);check();
  }finally{
    droid.dispose();const geometries=new Set(),materials=new Set();
    rig.root.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material)materials.add(o.material);});
    geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());
  }
});
test('bathroom stays open throughout entry, cleaning and exit; Milo waits until it is free',()=>{
  for(const job of ['toilet','shower']){
    const {routine}=setup(job);let requested=false,resumed=false,scrubbed=false;
    finish(routine,r=>{
      if(r.position.z<-1.5&&r.job===job&&!r.returning){assert.equal(r.opening,1);assert.equal(r.door,job);}
      if(r.pose.action?.startsWith('scrub-')){
        scrubbed=true;
        if(!requested){requested=true;assert.ok(r.reserveForCrew(job,()=>{resumed=true;assert.ok(r.position.z>.4);}));}
        assert.equal(resumed,false);
      }
    });
    assert.ok(scrubbed&&resumed);assert.equal(routine.opening,0);assert.equal(routine.door,null);
  }
});
test('occupied equipment, occupied ladder and pause stop task progress',()=>{
  const {routine,brain,actor}=setup('toilet');const initial=routine.pose;routine.update(0);assert.deepEqual(routine.pose,initial);
  actor.climbing=true;for(let i=0;i<1000;i++)routine.update(.05);
  assert.equal(routine.waiting,true);assert.equal(routine.position.floor,0);
  actor.climbing=false;
  while(routine.step?.kind!=='guard')routine.update(.05);
  brain.actStation='toilet';const position={...routine.position};routine.update(10);
  assert.deepEqual(routine.position,position);assert.equal(routine.opening,0);
  brain.actStation=null;finish(routine);
});
test('autonomy leaves the dock for an empty bowl, reserves its food, then rests again',()=>{
  const care=new Supplies(),brain={plants:new PlantBed(),actStation:null};
  const routine=new DroidRoutine({care,brain,actor:{x:1040},cat:{mode:'sleep'}});
  routine.update(11);assert.ok(routine.docked);routine.update(2);assert.equal(routine.job,'feed');
  while(!routine.carriedFood)routine.update(.1);
  assert.equal(care.catBowl,0);assert.equal(care.supplies.catfood,2);
  care.take('catfood');care.take('catfood');
  finish(routine);assert.equal(care.catBowl,1);assert.equal(care.supplies.catfood,0);
  routine.update(20);assert.ok(routine.docked,'rest between jobs');
});
test('the droid does not claim an occupied ladder or release it before stepping away',()=>{
  const {routine,actor}=setup('feed');
  // Stop beside the ladder, before reserving or entering its shared approach.
  while(!routine.step?.ladderEntry)routine.advance(routine.step.duration);
  actor.climbing=true;assert.equal(routine.blocksCrew(actor),false);
  routine.update(2);assert.equal(routine.age,0);assert.equal(routine.blocksCrew(actor),false);
  assert.ok(Math.abs(routine.position.x)>1,'wait beside the ladder, not directly in front of it');
  actor.climbing=false;routine.update(.05);actor.climbing=true;assert.equal(routine.blocksCrew(actor),true);
  while(routine.step?.kind!=='climb')routine.update(.05);
  while(routine.step?.kind==='climb')routine.update(.05);
  assert.equal(routine.blocksCrew(actor),true);
  while(routine.position.z<=.92)routine.update(.05);
  assert.equal(routine.blocksCrew(actor),true,'keep the reservation while leaving the centre of the landing');
  while(routine.ladderClaim)routine.update(.05);
  assert.ok(Math.abs(routine.position.x)>1);
  assert.equal(routine.blocksCrew(actor),false);
});
test('all working and climbing poses preserve rigid arm and leg lengths',()=>{
  const droid=createDroid();
  try{
    for(const job of Object.keys(DROID_JOBS)){
      const {routine}=setup(job);let sample=0;
      finish(routine,r=>{
        if(++sample%24)return;
        const samplePose=sampleDroidServicePose(r.pose);
        droid.update(r.time,'service',samplePose);
        for(const i of samplePose.load?.indices??[]){
          const expected=droid.root.localToWorld(new Vector3(...samplePose.hands[i]));
          assert.ok(droid.arms[i].palm.carryGrip.getWorldPosition(new Vector3()).distanceTo(expected)<1e-6,`${job}: load contact separates during pickup or placement`);
        }
        if(job==='cook'&&r.pose.action?.startsWith('cook-')){
          droid.root.position.set(r.position.x,r.position.y,r.position.z);droid.root.rotation.y=r.position.yaw;droid.root.updateMatrixWorld(true);
          for(const l of droid.legs)for(const part of [l.upper,l.middle,l.lower,l.foot])assert.ok(new Box3().setFromObject(part).min.z>.315,'legs stay outside the kitchen cabinets');
        }
        for(const a of droid.arms){
          const end=a.lower.localToWorld(new Vector3(0,-DROID_SPEC.forearm,0));
          assert.ok(end.distanceTo(a.palm.root.getWorldPosition(new Vector3()))<1e-6,`${job}: wrist separates`);
        }
        for(const l of droid.legs)for(const [part,length,next]of [[l.upper,DROID_SPEC.upperLeg,l.middle],[l.middle,DROID_SPEC.middleLeg,l.lower],[l.lower,DROID_SPEC.lowerLeg,l.foot]]){
          const end=part.localToWorld(new Vector3(0,-length,0));
          assert.ok(end.distanceTo(next.getWorldPosition(new Vector3()))<1e-5,`${job}/${r.pose.mode}: leg separates`);
        }
      });
    }
  }finally{droid.dispose();}
});

test('idle and walking lean forward with flexed elbows, palms inward and thumbs leading',()=>{
  const droid=createDroid();
  try{
    for(const walking of [false,true])for(let t=0;t<2.8;t+=.07){
      const p={walking,walkDistance:t*.58,age:3+t,duration:20,rest:0};
      const pose=droid.update(t,'service',sampleDroidServicePose(p));
      assert.ok(droid.chassis.rotation.x>.10&&droid.chassis.rotation.x<.23,'slight forward lean');
      for(const [i,arm]of droid.arms.entries()){
        const palm=new Vector3(0,0,1).applyQuaternion(arm.palm.root.quaternion);
        assert.ok(palm.dot(new Vector3(-arm.side,0,0))>.98,'palm faces the body, not the ceiling');
        assert.ok(arm.palm.thumb.position.clone().applyQuaternion(arm.palm.root.quaternion).z>.035);
        const h=pose.hands[i],bend=h.elbow.clone().sub(h.shoulder).angleTo(h.wrist.clone().sub(h.elbow));
        assert.ok(bend>.40&&bend<1,'elbow remains softly bent throughout the swing');
      }
    }
    const p=sampleDroidServicePose({walking:true,walkDistance:0,age:2,duration:10,rest:0});
    const pose=droid.update(0,'service',p);
    assert.ok((p.feet[0][2]-p.feet[1][2])*(pose.hands[0].wrist.z-pose.hands[1].wrist.z)<0,'arms oppose the legs');
  }finally{droid.dispose();}
});

test('ascending and descending hands show their backs to the camera and grip the rungs without slipping',()=>{
  const droid=createDroid({detail:'obs'}),material=new MeshStandardMaterial();
  const ladder=createAccessLadder(new Proxy({},{get:()=>material}));
  const rungs=ladder.children.filter(child=>child.name==='Ladder rung');
  let grips=0,transfers=0;
  try{
    for(const direction of [-1,1]){
      const before=new Map();
      for(let step=0;step<900;step++){
        const y=direction>0?.55+step*.006:6.20-step*.006;
        const p={y,climb:{from:direction>0?0:6.784,to:direction>0?6.784:0},age:10,duration:100,rest:0};
        const sample=sampleDroidServicePose(p);droid.update(0,'service',sample);
        droid.root.position.set(0,y,.34);droid.root.rotation.y=Math.PI;droid.root.updateMatrixWorld(true);
        let held=0;
        for(const [i,arm]of droid.arms.entries()){
          const contact=droidLadderContact(y,arm.side,true),actual=arm.palm.ladderGrip.getWorldPosition(new Vector3());
          const expected=droid.root.localToWorld(new Vector3(...sample.hands[i]));
          assert.ok(actual.distanceTo(expected)<1e-6,'IK must reach the requested grip without stretching');
          const back=new Vector3(0,0,-1).transformDirection(arm.palm.root.matrixWorld);
          assert.ok(back.z>.8,'back of each hand faces the cabin camera during ascent and descent');
          if(!contact.held){transfers++;before.delete(i);continue;}
          held++;grips++;
          const rung=rungs[contact.rung];assert.ok(rung);
          assert.ok(Math.abs(actual.y-rung.position.y)<1e-6,'hand must grip the horizontal bar, not between rungs');
          assert.ok(Math.abs(actual.z-rung.position.z)<1e-6,'hand meets the bar in depth');
          assert.ok(Math.abs(actual.x)<.30,'hand stays between the uprights');
          const previous=before.get(i);
          if(previous?.rung===contact.rung)assert.ok(actual.distanceTo(previous.point)<1e-6,'held hand must stay fixed in ship space');
          before.set(i,{rung:contact.rung,point:actual});
        }
        assert.ok(held>=1,'at least one hand remains on a rung');
      }
    }
    assert.ok(grips>2000&&transfers>500);
  }finally{
    droid.dispose();const geometries=new Set(),materials=new Set();
    ladder.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material)materials.add(o.material);});
    geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());
  }
});

test('ladder travel covers one deck in about 5.3 seconds in both directions',()=>{
  const {routine}=setup('feed');
  const climbs=routine.steps.filter(s=>s.kind==='climb');
  assert.ok(climbs.some(s=>s.to.y>s.from.y)&&climbs.some(s=>s.to.y<s.from.y));
  for(const climb of climbs){
    const perDeck=climb.duration/Math.abs(climb.to.floor-climb.from.floor);
    assert.ok(perDeck>5&&perDeck<5.5,'a single deck is 1.6 times faster than the former 8.5 seconds');
  }
  while(routine.step.kind!=='climb')routine.update(.05);
  const from=routine.position.y,direction=Math.sign(routine.step.to.y-from);
  routine.update(1);
  assert.ok(Math.abs((routine.position.y-from)*direction-.40*DROID_PACE)<1e-6,'live motion advances at the faster planned speed');
});

test('carrying palms meet each load surface through walking, turns and pouring, using the rendered width',()=>{
  const droid=createDroid({detail:'obs'}),material=new MeshStandardMaterial();
  // Deliberately vary supply widths so a fixed hand span or hardcoded default
  // cannot pass. Cloth, greens and food use the real service prop geometry.
  const cargo=[.61,.53,.47].map(width=>{
    const g=new Group(),mesh=new Mesh(new BoxGeometry(width,.54,.43),material);
    mesh.position.y=.27;g.add(mesh);return g;
  });
  const rig=createDroidServiceRig({droid,cable:new Group()},{cargo});
  const bounds=new Map([...Object.values(rig.props),...rig.cargo].map(g=>[g,new Box3().setFromObject(g)]));
  rig.root.position.set(2,3,-4);rig.root.rotation.y=.35;
  let contacts=0,clock=0;
  try{
    for(const kind of ['cargo','cloth','greens','food'])for(const cargoIndex of kind==='cargo'?[0,1,2]:[0]){
      const {routine}=setup(kind==='cargo'?'cargo':kind==='cloth'?'laundry':kind==='greens'?'harvest':'feed');
      routine.carrying=kind;routine.cargoIndex=cargoIndex;
      const g=kind==='cargo'?rig.cargo[cargoIndex]:rig.props[kind],localBounds=bounds.get(g);
      for(const mode of ['walk','turn','pour'])for(const age of [.15,.6,1.2,2]){
        if(mode==='pour'&&kind!=='food')continue;
        const p={x:1,y:3.392,z:.8,yaw:age,rest:0,mode,action:mode==='pour'?'food-pour':null,
          carrying:kind,cargoIndex,time:++clock,age,duration:6,walkDistance:age*.58,walking:mode==='walk',
          turn:mode==='turn'?{from:0,to:Math.PI/2,steps:6,duration:2.04}:null};
        const fake={...routine,pose:p};rig.update(fake);rig.root.updateMatrixWorld(true);
        assert.equal(g.visible,true);
        const inverse=g.getWorldQuaternion(new Quaternion()).invert();
        for(const arm of droid.arms){
          const contact=g.worldToLocal(arm.palm.carryGrip.getWorldPosition(new Vector3()));
          const x=arm.side<0?localBounds.min.x:localBounds.max.x;
          assert.ok(Math.abs(contact.x-x)<1e-6,`${kind}/${mode}: palm must touch the actual side`);
          assert.ok(contact.y>=localBounds.min.y-1e-6&&contact.y<=localBounds.max.y+1e-6);
          assert.ok(contact.z>=localBounds.min.z&&contact.z<=localBounds.max.z,'contact stays on the prop');
          const normal=new Vector3(0,0,1).transformDirection(arm.palm.root.matrixWorld).applyQuaternion(inverse);
          assert.ok(normal.dot(new Vector3(-arm.side,0,0))>.9999,'both palms face the object');
          const elbow=arm.lower.getWorldPosition(new Vector3()),wrist=arm.palm.root.getWorldPosition(new Vector3());
          assert.ok(Math.abs(elbow.distanceTo(wrist)-DROID_SPEC.forearm)<1e-7);contacts++;
        }
      }
    }
    assert.ok(contacts>100);
  }finally{
    droid.dispose();const geometries=new Set(),materials=new Set();
    rig.root.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material)materials.add(o.material);});
    geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());material.dispose();
  }
});
