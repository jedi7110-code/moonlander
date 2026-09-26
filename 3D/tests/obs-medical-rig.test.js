import test from 'node:test';
import assert from 'node:assert/strict';
import {Box3,MeshStandardMaterial,Vector3} from 'three';
import {OBB} from 'three/addons/math/OBB.js';
import {animateMedicalRig} from '../src/obs/medical-rig.js';
import {createMedicalBay,animateMedical,medicalTransferPose,medicalDuration,medicalExitTime,MED_BED} from '../src/obs/medical.js';
import {createMilo,animateMilo} from '../src/obs/characters.js';
import {CabinBrain} from '../src/obs/brain.js';
import {CrewMotion,Supplies,getStation} from '../src/obs/state.js';

function fixture(){
  const m=new Proxy({},{get:()=>new MeshStandardMaterial()});
  const ctx={fillRect(){},fillText(){},measureText(text){return{width:text.length*20};},beginPath(){},moveTo(){},lineTo(){},stroke(){}};
  globalThis.document={createElement:()=>({getContext:()=>ctx})};
  let bay;try{bay=createMedicalBay(m,0);}finally{delete globalThis.document;}
  const milo=createMilo(m);milo.position.x=MED_BED.x;
  return{bay,milo};
}

test('diagnostic arm housings stay separated while parked, deploying, scanning and stowing',()=>{
  const {bay}=fixture(),rig=bay.rig;
  const housingBounds=part=>{
    const mesh=part.getObjectByName('Diagnostic arm housing');
    mesh.geometry.computeBoundingBox();
    return new OBB().fromBox3(mesh.geometry.boundingBox).applyMatrix4(mesh.matrixWorld);
  };
  // Include every scan target so interrupting and stowing mid-scan is covered.
  for(let age=0;age<=16;age+=.5)for(let step=0;step<=40;step++){
    const extension=step/40;
    animateMedicalRig(rig,{extension},age);rig.root.updateMatrixWorld(true);
    for(const arm of rig.arms)assert.equal(housingBounds(arm.upper).intersectsOBB(housingBounds(arm.lower)),false,
      `${arm.root.name}: overlapping housings at extension ${extension}, scan ${age}`);
  }
});

test('metal collars clear the cover ends instead of intersecting their visible faces',()=>{
  const {bay}=fixture();
  bay.rig.root.updateMatrixWorld(true);
  for(const arm of bay.rig.arms)for(const part of [arm.upper,arm.lower]){
    const housing=part.getObjectByName('Diagnostic arm housing');
    housing.geometry.computeBoundingBox();
    const cover=housing.geometry.boundingBox.clone().applyMatrix4(housing.matrix);
    for(const collar of part.children.filter(mesh=>mesh.name==='Diagnostic arm collar')){
      collar.geometry.computeBoundingBox();
      const bounds=collar.geometry.boundingBox.clone().applyMatrix4(collar.matrix);
      assert.ok(bounds.max.y<cover.min.y-.005||bounds.min.y>cover.max.y+.005,'collars leave at least 5mm at each end of the cover');
    }
  }
});

test('the seated patient and bedding rise together; arms deploy only after reclining and stow before sitting up',()=>{
  const {bay,milo}=fixture(),duration=medicalDuration();
  assert.equal(bay.rig.arms.length,2);let previous=null;
  for(let frame=0;frame<=duration*30;frame++){
    const time=frame/30,pose=medicalTransferPose(time);
    animateMilo(milo,{action:'medical',moving:false,time,actionTime:time});milo.updateMatrixWorld(true);
    animateMedical(bay,time,true,null);bay.root.updateMatrixWorld(true);
    assert.equal(bay.platform.position.y,pose.elevation);
    if(pose.elevation>0)assert.equal(pose.seat,1);
    if(pose.extension>0)assert.equal(pose.recline,1);
    if(pose.recline>0)assert.ok(Math.abs(pose.elevation-(MED_BED.examTop-MED_BED.top))<1e-9);
    if(pose.seat===1)assert.ok(Math.abs(new Box3().setFromObject(milo.userData.hips,true).min.y-MED_BED.top-pose.elevation)<.008);
    for(const piston of bay.pistons)assert.ok(Math.abs(new Box3().setFromObject(piston,true).min.y-.13)<1e-8);
    const points=bay.rig.arms.flatMap(arm=>{
      assert.ok(Math.abs(arm.base.distanceTo(arm.joint)-.98)<1e-9);assert.ok(Math.abs(arm.joint.distanceTo(arm.target)-.98)<1e-9);
      return[arm.joint.clone(),arm.target.clone()];
    });
    if(previous)points.forEach((p,i)=>assert.ok(p.distanceTo(previous[i])<.06));previous=points;
    if(frame%10===0){const bounds=new Box3().setFromObject(bay.rig.root);assert.ok(bounds.min.x>2.8);assert.ok(bounds.max.x<6.7);assert.ok(bounds.max.y<2.9);}
  }
  animateMedical(bay,0,false,null);assert.equal(bay.platform.position.y,0);assert.equal(bay.rig.scan.visible,false);
});

test('the green scan moves over actual body surfaces, pauses exactly and releases its light outside diagnosis',()=>{
  const {bay,milo}=fixture(),buffers=bay.rig.stripe.geometry.attributes.position.array;
  let first;
  for(const offset of [.15,1.95,3.95,6.95]){
    const age=MED_BED.transition+offset;
    animateMilo(milo,{action:'medical',moving:false,time:age,actionTime:age});
    animateMedical(bay,age,true,null,{patient:milo});assert.equal(bay.rig.scan.visible,true);
    assert.strictEqual(bay.rig.stripe.geometry.attributes.position.array,buffers);
    assert.ok(bay.rig.points.every(p=>p.y>MED_BED.examTop&&p.y<1.5));
    if(offset===6.95)assert.ok(bay.rig.points.some(p=>p.y>MED_BED.examTop+.14));
    const snapshot=Array.from(buffers);first??=snapshot;
    animateMedical(bay,age,true,null,{patient:milo});assert.deepEqual(Array.from(buffers),snapshot);
  }
  assert.notDeepEqual(Array.from(buffers),first);
  for(const age of [0,3,5,8.5,medicalDuration()-8.5,medicalDuration()]){
    animateMedical(bay,age,true,null,{patient:milo});assert.equal(bay.rig.scan.visible,false);
  }
});

test('an interrupted scan holds the tool positions before retracting; treatment time excludes boarding and departure',()=>{
  const {bay,milo}=fixture(),station=getStation('medical'),actor=new CrewMotion({floor:station.floor,x:station.x}),care=new Supplies();
  const brain=new CabinBrain({obsUI:{hideWant(){}}},actor,{care,random:()=>.8});
  brain.health.startCondition('injury');brain.cur=station;brain._startPerform(station);
  brain.update(MED_BED.transition);assert.equal(brain.health.treatment.elapsed,0);
  brain.update(4);assert.ok(Math.abs(brain.health.treatment.elapsed-4)<1e-9);
  const time=brain.curDurSec-brain.performT;
  animateMilo(milo,{action:'medical',moving:false,time,actionTime:time,actionDuration:brain.curDurSec});
  animateMedical(bay,time,true,null,{duration:brain.curDurSec,patient:milo});
  const before=bay.rig.arms.map(a=>a.tip.position.toArray());
  brain._go(getStation('hydro'));const exit=brain.reclineExit;
  animateMedical(bay,medicalExitTime(exit),true,null,{duration:brain.curDurSec,patient:milo,scanTime:exit.actionTime});
  assert.deepEqual(bay.rig.arms.map(a=>a.tip.position.toArray()),before);assert.equal(brain.health.treatment,null);
  const duration=exit.duration;brain.update(0);assert.equal(exit.age,0);assert.equal(actor.busy,false);
  brain.update(duration);assert.equal(brain.actStation,'hydro');assert.equal(brain.reclineExit,null);
});
