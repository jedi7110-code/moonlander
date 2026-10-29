import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {MeshStandardMaterial,Vector3} from 'three';
import {HatchRepairVisit} from '../src/obs/hatch-repair.js';
import {createMilo,animateMilo} from '../src/obs/characters.js';
import {loadMiloBody} from '../src/obs/milo-body.js';
import {getStation,CABIN_AISLE} from '../src/obs/layout.js';
import {REPAIR_STUDY_PHASES,REPAIR_STUDY_DURATION,REPAIR_STUDY_DEFAULTS,REPAIR_STUDY_GENTLE,repairRange,sampleRepairStudy,poseRepairStudy} from '../src/hatch-repair-study-model.js';

test('study phases and arbitrary seeks follow the OBS visit without approximating its motion',()=>{
  assert.ok(Math.abs(REPAIR_STUDY_DURATION-28.8)<1e-8);
  for(const phase of REPAIR_STUDY_PHASES){
    assert.deepEqual(repairRange(phase.id),phase);
    for(const age of [.001,phase.duration/2,phase.duration-.001]){
      const time=phase.start+age,study=sampleRepairStudy(time),obs=new HatchRepairVisit(1);obs.startYaw=Math.PI/2;obs.update(time);
      assert.equal(study.phase,phase.id);assert.deepEqual(study.pose,obs.pose);
    }
  }
  assert.equal(sampleRepairStudy(-10).phase,'turnIn');assert.equal(sampleRepairStudy(Infinity).phase,'turnIn');
  assert.ok(sampleRepairStudy(1e6).done);
  assert.deepEqual(repairRange('all'),{start:0,end:REPAIR_STUDY_DURATION});
});

test('tuning only alters study repair motion and remains bounded at the phase transitions',()=>{
  for(const phase of REPAIR_STUDY_PHASES){
    const time=phase.start+phase.duration/2,original=sampleRepairStudy(time),gentle=sampleRepairStudy(time,REPAIR_STUDY_GENTLE);
    if(phase.id!=='repair')assert.deepEqual(gentle,original);
  }
  for(let time=8.8;time<18.8;time+=1/60){
    const original=sampleRepairStudy(time),defaults=sampleRepairStudy(time,REPAIR_STUDY_DEFAULTS),gentle=sampleRepairStudy(time,REPAIR_STUDY_GENTLE);
    assert.ok(Math.abs(original.pose.twist-defaults.pose.twist)<1e-10);
    assert.ok(Math.abs(original.pose.reach-defaults.pose.reach)<1e-10);
    assert.ok(Math.abs(gentle.pose.twist)<=REPAIR_STUDY_GENTLE.amplitude);
    assert.ok(gentle.pose.reach>=0&&gentle.pose.reach<=1);
  }
  for(const time of [8.8+1e-5,18.8-1e-5])assert.ok(sampleRepairStudy(time,REPAIR_STUDY_GENTLE).pose.reach<1e-8);
});

await loadMiloBody(`data:application/json;base64,${(await readFile(new URL('../public/assets/obs/milo/body.json',import.meta.url))).toString('base64')}`);
const model=()=>createMilo(new Proxy({},{get:(object,key)=>object[key]??=new MeshStandardMaterial()}));
const joints=root=>root.userData.arms.flatMap(({arm,elbow,hand})=>[arm,elbow,hand]);
const snapshot=root=>joints(root).map(joint=>({position:joint.getWorldPosition(new Vector3()),quaternion:joint.getWorldQuaternion(joint.quaternion.clone())}));

test('approaching and leaving the hatch face the direction of travel, including the reported frames',()=>{
  const root=model();
  for(const phase of REPAIR_STUDY_PHASES.filter(p=>['approach','return'].includes(p.id))){
    for(let t=phase.start+.01;t<phase.end-.01;t+=1/60){
      const a=sampleRepairStudy(t-.001),b=sampleRepairStudy(t+.001),direction=Math.sign(b.pose.depth-a.pose.depth);
      const {visit}=poseRepairStudy(root,t);
      assert.ok(Math.cos(visit.pose.yaw)*direction>.999,'walking root faces its actual depth movement');
      const forward=new Vector3(0,0,1).transformDirection(root.userData.head.matrixWorld);
      assert.ok(forward.z*direction>.95,'rendered character faces forward while stepping');
    }
  }
  for(const [time,direction]of [[1.917,1],[26.158,-1]]){
    const {visit}=poseRepairStudy(root,time);assert.ok(visit.pose.moving);
    assert.ok(new Vector3(0,0,1).transformDirection(root.userData.head.matrixWorld).z*direction>.95);
  }
  for(const yaw of [Math.PI/2,-Math.PI/2,0,Math.PI]){
    const visit=new HatchRepairVisit(1);visit.startYaw=yaw;let previous=visit.pose;
    for(let frame=1;frame<=28.8*60;frame++){
      visit.update(1/60);const pose=visit.pose;
      const delta=Math.atan2(Math.sin(pose.yaw-previous.yaw),Math.cos(pose.yaw-previous.yaw));
      assert.ok(Math.abs(delta)<.09,'heading stays continuous at the walking and turning boundaries');
      if(pose.moving&&Math.abs(pose.depth-previous.depth)>1e-8)assert.ok(Math.cos(pose.yaw)*(pose.depth-previous.depth)>0);
      previous=pose;
    }
    assert.ok(Math.abs(Math.atan2(Math.sin(visit.pose.yaw-yaw),Math.cos(visit.pose.yaw-yaw)))<1e-8,'restore the original aisle heading');
  }
});

test('seeking backward or repeating a paused frame gives the same hands as live OBS',()=>{
  const study=model(),obs=model(),station=getStation('innerHatch');
  const compare=(a,b)=>a.forEach((joint,i)=>{
    assert.ok(joint.position.distanceTo(b[i].position)<1e-7,'world joint position is reproducible');
    assert.ok(1-Math.abs(joint.quaternion.dot(b[i].quaternion))<1e-8,'joint orientation is reproducible');
  });
  for(const time of [11.8,5.6,18.5,10.2,23.6,11.8,11.8]){
    poseRepairStudy(study,time);
    obs.position.set((station.x-700)*.022,0,CABIN_AISLE.crewZ);obs.rotation.set(0,Math.PI/2,0);
    const visit=new HatchRepairVisit(1);visit.startYaw=Math.PI/2;visit.update(time);
    animateMilo(obs,{moving:false,climbing:false,facing:1,action:'innerHatch',time,dt:0,hatchRepair:visit});obs.updateMatrixWorld(true);
    compare(snapshot(study),snapshot(obs));
  }
  poseRepairStudy(study,11.8);const initial=snapshot(study);
  for(let i=0;i<20;i++){poseRepairStudy(study,11.8);compare(snapshot(study),initial);}
});

test('the contact readout uses the actual tool tip, including tuned wrist rotations',()=>{
  const root=model();
  for(const tuning of [null,REPAIR_STUDY_GENTLE,{amplitude:0,frequency:.2,reachSeconds:3}])for(const time of [11.85,12.75,14.5,15.7]){
    const {contact,tip,screw}=poseRepairStudy(root,time,tuning);
    assert.ok(contact);assert.ok(tip.distanceTo(screw)<.008);
  }
  assert.equal(poseRepairStudy(root,8.9).contact,false);
});

test('OBS and the study keep both arms and wrists continuous throughout inspection, repair and withdrawal',()=>{
  const root=model(),peak=tuning=>{
    let previous,velocity,max=0;
    for(let frame=0;frame<=1080;frame++){
      poseRepairStudy(root,4.8+frame/60,tuning);const values=snapshot(root);
      if(previous)for(const index of [0,1,2,3,4,5]){
        max=Math.max(max,values[index].quaternion.angleTo(previous[index].quaternion)*180/Math.PI);
        // The elbow sweeps a wider arc to support a palm-in grip. Keep the
        // wrist's tighter speed bound and check acceleration on both joints.
        const step=values[index].position.clone().sub(previous[index].position);
        assert.ok(step.length()<([1,4].includes(index)?.023:.012),`no joint teleport at ${4.8+frame/60}`);
        if(velocity)assert.ok(step.distanceTo(velocity[index])<.002,`no abrupt velocity change at ${4.8+frame/60}`);
      }
      for(const rig of root.userData.arms){
        const bend=new Vector3(0,-1,0).applyQuaternion(rig.hand.quaternion).angleTo(rig.hand.position.clone().normalize());
        assert.ok(bend<=.721,'the wrist never folds back while lifting or withdrawing');
      }
      velocity=previous?values.map((j,i)=>j.position.clone().sub(previous[i].position)):null;previous=values;
    }
    return max;
  };
  const current=peak(null),candidate=peak(REPAIR_STUDY_GENTLE);
  assert.ok(current<5,`OBS should not snap between frames: ${current} degrees`);
  assert.ok(candidate<5,`candidate should not snap between frames: ${candidate} degrees`);
  const time=9.1;poseRepairStudy(root,time,REPAIR_STUDY_GENTLE);const before=snapshot(root);
  poseRepairStudy(root,16);poseRepairStudy(root,time,REPAIR_STUDY_GENTLE);
  snapshot(root).forEach((joint,i)=>assert.ok(joint.position.distanceTo(before[i].position)<1e-8));
});

test('cancelling at any working phase preserves the arm orientation and grip before easing out',()=>{
  const root=model(),station=getStation('innerHatch');
  const animate=(visit,time)=>{
    root.position.set((station.x-700)*.022,0,CABIN_AISLE.crewZ);root.rotation.set(0,Math.PI/2,0);
    animateMilo(root,{moving:false,climbing:false,facing:1,action:'innerHatch',time,dt:0,hatchRepair:visit});root.updateMatrixWorld(true);
    return snapshot(root);
  };
  for(const start of [5.2,8.65,9.2,11.8,18.6,18.95,21.8]){
    const visit=new HatchRepairVisit(1);visit.startYaw=Math.PI/2;visit.update(start);
    let before=animate(visit,start),grip=visit.pose.grip,velocity;visit.requestExit();
    const same=animate(visit,start);
    same.forEach((j,i)=>{assert.ok(j.quaternion.angleTo(before[i].quaternion)<1e-7);assert.ok(j.position.distanceTo(before[i].position)<1e-8);});
    assert.equal(visit.pose.grip,grip,'cancellation does not instantly open a prepared or holding hand');
    let digits=root.userData.arms[0].fingers.flatMap(f=>[f,...f.userData.links]).map(j=>j.quaternion.clone());
    for(let frame=1;frame<=72;frame++){
      visit.update(1/60);const now=animate(visit,start+frame/60);
      now.forEach((j,i)=>{
        assert.ok(j.quaternion.angleTo(before[i].quaternion)<.09,`no cancelled arm snap at ${start}, frame ${frame}`);
        const step=j.position.clone().sub(before[i].position);
        assert.ok(step.length()<([1,4].includes(i)?.023:.012),'no cancelled joint teleport');
        if(velocity)assert.ok(step.distanceTo(velocity[i])<.002,'no cancelled velocity jump');
      });velocity=now.map((j,i)=>j.position.clone().sub(before[i].position));before=now;
      const next=root.userData.arms[0].fingers.flatMap(f=>[f,...f.userData.links]).map(j=>j.quaternion.clone());
      next.forEach((q,i)=>assert.ok(q.angleTo(digits[i])<.09,'no cancelled finger snap'));digits=next;
    }
  }
});
