import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Box3,MeshStandardMaterial,Vector3} from 'three';
import {loadMiloBody} from '../src/obs/milo-body.js';
import {createMilo,animateMilo} from '../src/obs/characters.js';
import {BIKE,GYM_LEFT_SIDE,createGym} from '../src/obs/gym.js';
import {sampleGymTransfer} from '../src/obs/gym-pose.js';
import {GymVisit,GYM_TURN_SECONDS,GYM_DISMOUNT_SECONDS} from '../src/obs/gym-visit.js';
import {applyGymStudy,GYM_STUDY_DURATION,sampleGymStudyTime,sampleLeftStep,STUDY_LEFT_SIDE} from '../studies/milo/gym-study.js';

await loadMiloBody(`data:application/json;base64,${(await readFile(new URL('../public/assets/obs/milo/body.json',import.meta.url))).toString('base64')}`);
const material=new MeshStandardMaterial(),materials=new Proxy({},{get:()=>material});
const render=(root,visit)=>{
  root.position.z=visit.pose.depth;
  animateMilo(root,{action:'gym',moving:false,facing:1,time:0,gymVisit:visit});
  root.updateMatrixWorld(true);
};
const sole=rig=>rig.boot.localToWorld(new Vector3(0,-.107,.024));

test('cabin uses left-over-wheel boarding and right-first exit for every parked pedal phase',()=>{
  const root=createMilo(materials);
  for(const pedalTime of Array.from({length:12},(_,i)=>i/12*Math.PI*2/BIKE.cadence))for(const phase of ['mount','dismount']){
    const visit=new GymVisit({pedalTime});visit.startYaw=Math.PI/2;visit.phase=phase;
    let previous;
    for(let i=0;i<=600;i++){
      const seconds=i/120;
      visit.age=phase==='mount'?GYM_TURN_SECONDS+seconds:GYM_DISMOUNT_SECONDS-seconds;
      render(root,visit);
      const time=visit.pose.transferTime,sample=sampleGymTransfer(time,pedalTime);
      const positions=root.userData.legs.flatMap(r=>[r.knee,r.boot]).map(n=>n.getWorldPosition(new Vector3()));
      if(previous)positions.forEach((p,j)=>assert(p.distanceTo(previous[j])<.035,`continuous joint ${j} at ${seconds}`));
      previous=positions;
      for(const rig of root.userData.legs){
        const foot=sole(rig),left=rig.side===GYM_LEFT_SIDE;
        const p=new Vector3(-.48+rig.side*.1,.107,.013).lerp(left?sample.left:sample.right,sample.grip);
        assert(foot.distanceTo(new Vector3(p.z+.024,p.y-.107,BIKE.depth-p.x))<.004);
        assert(foot.y>=-.004,'no sole below the floor');
        if(!left&&time<=6)assert(Math.abs(foot.y)<.004,'right stays grounded until left supports the rider');
        if(left&&time>=2.8&&time<=4.2){
          assert(foot.y>.74,'left boot crosses above the wheel, not behind the saddle');
          const bounds=new Box3().setFromObject(rig.boot);
          assert(bounds.max.x<.69,'whole boot passes behind the handlebar uprights');
        }
      }
    }
  }
});

test('study takes five seconds each to mount and dismount, with right foot returning first',()=>{
  assert.deepEqual(sampleGymStudyTime(0),{phase:'mount',poseTime:0});
  assert.deepEqual(sampleGymStudyTime(5),{phase:'seated',poseTime:9.4});
  assert.deepEqual(sampleGymStudyTime(6),{phase:'dismount',poseTime:9.4});
  assert.deepEqual(sampleGymStudyTime(11),{phase:'standing',poseTime:0});
  assert.equal(GYM_STUDY_DURATION,12);
  const descending=sampleLeftStep(sampleGymStudyTime(7.9).poseTime);
  assert.equal(descending.right.y,.107,'right foot has reached the floor');
  assert.equal(descending.left.y,BIKE.crankY+.1245,'left foot still supports on the step');
  for(let t=0;t<=5;t+=.05)assert(Math.abs(sampleGymStudyTime(t).poseTime-sampleGymStudyTime(11-t).poseTime)<1e-12);
});

test('main and study use identical full-body poses at the reviewed times in either direction',()=>{
  const main=createMilo(materials),study=createMilo(materials),gym={cranks:[],flywheel:{rotation:{x:0}}};
  const visit=new GymVisit();visit.startYaw=Math.PI/2;
  for(const displayTime of [0,.3,1.7,2.5,3.8,5,6,7.9,9.29,10.8,11]){
    const timeline=sampleGymStudyTime(displayTime);
    applyGymStudy(gym,study,displayTime);study.updateMatrixWorld(true);
    visit.phase=timeline.phase==='dismount'?'dismount':timeline.phase==='standing'?'done':timeline.phase==='seated'?'cycle':'mount';
    visit.age=visit.phase==='mount'?GYM_TURN_SECONDS+displayTime:visit.phase==='dismount'?displayTime-6:0;
    render(main,visit);
    const nodes=root=>[root.userData.body,root.userData.chest,root.userData.head,...root.userData.legs.flatMap(r=>[r.leg,r.knee,r.boot]),...root.userData.arms.flatMap(r=>[r.arm,r.elbow,r.hand])];
    const reference=nodes(study);
    nodes(main).forEach((node,i)=>{
      assert(node.getWorldPosition(new Vector3()).distanceTo(reference[i].getWorldPosition(new Vector3()))<1e-8,`same joint ${i} at ${displayTime}`);
      assert(node.quaternion.angleTo(reference[i].quaternion)<1e-7,`same rotation ${i} at ${displayTime}`);
    });
  }
});

test('turn-in and exit preserve the world pose across the aisle/machine root-frame change',()=>{
  const root=createMilo(materials),visit=new GymVisit();visit.startYaw=Math.PI/2;
  const nodes=()=>[root.userData.head,...root.userData.legs.map(r=>r.boot),...root.userData.arms.map(r=>r.hand)].map(n=>n.getWorldPosition(new Vector3()));
  visit.age=GYM_TURN_SECONDS-1e-6;render(root,visit);const before=nodes();
  visit.age=GYM_TURN_SECONDS;render(root,visit);nodes().forEach((p,i)=>assert(p.distanceTo(before[i])<.004));
  visit.phase='done';render(root,visit);const final=nodes();
  root.position.z=.78;animateMilo(root,{action:null,moving:false,facing:1,time:0,dt:0});root.updateMatrixWorld(true);
  nodes().forEach((p,i)=>assert(p.distanceTo(final[i])<.004,'no jump when walking can resume'));
});

test('shared study maintains continuous joints and contacts during both transfers',()=>{
  const ctx=new Proxy({measureText:t=>({width:t.length*8})},{get:(o,k)=>k in o?o[k]:()=>{}});
  globalThis.document={createElement:()=>({getContext:()=>ctx})};
  let gym;try{gym=createGym(materials,0);}finally{delete globalThis.document;}
  const root=createMilo(materials);
  let previous;
  for(let displayTime=0;displayTime<=GYM_STUDY_DURATION;displayTime+=1/120){
    const time=sampleGymStudyTime(displayTime).poseTime;
    applyGymStudy(gym,root,displayTime);root.updateMatrixWorld(true);
    const positions=[root.userData.head,...root.userData.legs.flatMap(r=>[r.knee,r.boot])].map(n=>n.getWorldPosition(new Vector3()));
    if(previous)positions.forEach((p,i)=>assert(p.distanceTo(previous[i])<.03,`continuous joint ${i} at ${time}`));
    previous=positions;
    const sample=sampleLeftStep(time);
    const leftHand=root.userData.arms.find(a=>a.side===STUDY_LEFT_SIDE);
    if(time<=1)assert.equal(sample.leftGrip,0,'left hand waits for the left foot');
    if(time>1&&time<5.8)assert(sample.leftGrip>0&&sample.leftGrip<1);
    const shoulder=new Vector3(.207,1.488,0).applyMatrix4(root.userData.chest.matrix);
    assert(leftHand.arm.position.distanceTo(shoulder)<1e-8,'shoulder follows the torso without stretching');
    if(time>=4.2&&time<=6){
      assert(root.userData.body.position.x>=-.32,'pelvis shifts towards the bike');
      assert(root.userData.chest.rotation.z<=-.12,'upper body leans towards the bike');
      const right=root.userData.legs.find(r=>r.side!==STUDY_LEFT_SIDE);
      const hip=root.userData.body.localToWorld(right.leg.position.clone());
      assert(hip.z<sole(right).z-.09,'right leg inclines towards the bike over its planted foot');
    }
    if(time>=5.8){
      assert.equal(sample.leftGrip,1);
      const palm=leftHand.hand.localToWorld(new Vector3(0,-.045,.007));
      assert(palm.distanceTo(new Vector3(BIKE.gripZ,BIKE.gripY,BIKE.depth-.14))<1e-5,'left palm reaches the bar with the foot');
    }
    for(const rig of root.userData.legs){
      const p=new Vector3(-.48+rig.side*.1,.107,.013).lerp(rig.side===STUDY_LEFT_SIDE?sample.left:sample.right,sample.grip);
      const actual=sole(rig),target=new Vector3(p.z+.024,p.y-.107,BIKE.depth-p.x);
      assert(actual.distanceTo(target)<.004,`foot reaches target at ${time}`);
      if(rig.side!==STUDY_LEFT_SIDE&&time<=6)assert(actual.y<.004&&actual.y>=-1e-8,`right sole stays on the floor: ${actual.y}`);
      if(rig.side!==STUDY_LEFT_SIDE&&time>=7.3&&time<=8.2)assert(actual.y>BIKE.crankY+.12,'right sole clears the step edge before moving across');
      if(rig.side!==STUDY_LEFT_SIDE&&time>=6.7&&time<=8.2){
        const knee=rig.knee.getWorldPosition(new Vector3()),hip=rig.leg.getWorldPosition(new Vector3());
        assert(knee.x>hip.x+.20,'right thigh raises the knee forward');
        assert(knee.x-hip.x>Math.abs(knee.z-hip.z),'knee moves predominantly forward, not sideways');
      }
      if(rig.side===STUDY_LEFT_SIDE&&time>=2.8&&time<=4.2){
        assert(actual.y>.74,'left sole clears the wheel crown');
        const bounds=new Box3().setFromObject(rig.boot);
        // The machine faces world +X. Its uprights lean from local z=.76 at
        // y=.18 to z=.71 at y=1.19; keep the entire boot behind their rear edge.
        const uprightBack=.76-(Math.min(1.19,bounds.max.y)-.18)*.05/1.01-.031;
        assert(bounds.max.x+.02<uprightBack,`toe clears handlebar uprights by 2cm during both transfers at ${displayTime}`);
      }
      if(time>=9.4)assert(Math.abs(actual.y-(BIKE.crankY+.0175))<1e-5,'both soles rest on their steps');
    }
    if(time>=9.4){
      const pelvis=root.userData.body.localToWorld(new Vector3(0,.988,0));
      assert(Math.abs(pelvis.x)<1e-8&&Math.abs(pelvis.z-BIKE.depth)<1e-8,'pelvis centers over the saddle');
      assert(Math.abs(pelvis.y-.134-BIKE.seat)<.005,'seat supports the pelvis');
    }
  }
  applyGymStudy(gym,root,3.5);root.updateMatrixWorld(true);
  const first=root.userData.legs.map(sole);
  applyGymStudy(gym,root,11);applyGymStudy(gym,root,3.5);root.updateMatrixWorld(true);
  root.userData.legs.forEach((rig,i)=>assert(sole(rig).distanceTo(first[i])<1e-8));
});
