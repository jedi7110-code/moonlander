import test from 'node:test';
import assert from 'node:assert/strict';
import {MeshStandardMaterial,Box3,Vector3} from 'three';
import {MEDICAL,getStation} from '../src/obs/layout.js';
import {getStation as originalStation} from '../../js/obs/layout.js?v=15';
import {CrewMotion,Supplies,currentAction} from '../src/obs/state.js';
import {CabinBrain} from '../src/obs/brain.js';
import {createMilo,animateMilo} from '../src/obs/characters.js';
import {createMedicalBay,animateMedical,medicalReadings,medicalRecline,medicalTransferPose,medicalDuration,MED_BED,MED_TRANSFER} from '../src/obs/medical.js';

function setup(){
  const actor=new CrewMotion({floor:1,x:MEDICAL.x}),care=new Supplies(),results=[];
  const brain=new CabinBrain({obsUI:{hideWant(){},medicalResult(report){results.push(report);}}},actor,{care});
  return{actor,care,brain,results};
}
test('medical is confined to the 3D cabin and occupies the area left of the inner hatch',()=>{
  assert.equal(originalStation('medical'),undefined);assert.equal(getStation('medical').floor,1);
  assert.ok(MEDICAL.x<getStation('innerHatch').x);assert.equal(MEDICAL.need,null);
});
test('a completed check produces one report, without curing needs or consuming food',()=>{
  const {actor,care,brain,results}=setup();brain._go(MEDICAL);actor.update(1/60);
  assert.equal(currentAction(brain),'medical');assert.equal(results.length,0);
  const start={...brain.needs};brain.update(0);assert.equal(brain.performT,medicalDuration());
  for(let i=0;i<medicalDuration()*60+1;i++)brain.update(1/60);
  assert.equal(results.length,1);assert.deepEqual(brain.lastMedicalReport,results[0]);
  assert.notEqual(currentAction(brain),'medical');assert.deepEqual(care.supplies,care.capacity);
  for(const key of Object.keys(start))assert.ok(brain.needs[key]<start[key]);
});
test('medical chat starts a check; cancelling it cannot create a result',()=>{
  const {actor,brain,results}=setup();
  for(const text of ['医療区画へ','健診して','medical bay','checkup']){
    brain.handleChat(text);assert.equal(brain.actStation,'medical');actor.update(1/60);brain.update(3);
    brain._go(getStation('eva'));brain.update(20);assert.equal(results.length,0);
  }
  assert.equal(brain.lastMedicalReport,null);
});
test('readings reflect game fatigue and hydration, not random per-frame values',()=>{
  const well={energy:80,thirst:70},tired={energy:20,thirst:70},dry={energy:80,thirst:20};
  assert.equal(medicalReadings(well).advice,'routine');assert.equal(medicalReadings(tired).advice,'rest');
  assert.equal(medicalReadings(dry).advice,'water');assert.ok(medicalReadings(tired).pulse>medicalReadings(well).pulse);
  assert.deepEqual(medicalReadings(well),medicalReadings(well));
});
test('couch stays clear of the passage, patient faces upward, and pose resets after leaving',()=>{
  const material=new MeshStandardMaterial(),m=new Proxy({},{get:()=>material}),milo=createMilo(m);let bay;
  const ctx={fillRect(){},fillText(){},measureText(text){return{width:text.length*parseFloat(this.font.slice(4))*.6};},beginPath(){},moveTo(){},lineTo(){},stroke(){}};
  globalThis.document={createElement(){return{getContext(){return ctx;}};}};
  try{bay=createMedicalBay(m,3.392);}finally{delete globalThis.document;}
  const bounds=new Box3().setFromObject(bay.root);
  assert.ok(bounds.max.x<6.7);assert.ok(bounds.min.x>1.2);assert.ok(bounds.max.y<3.392+3.0);
  assert.ok(new Box3().setFromObject(bay.bed).max.z<.48);
  const rail=bay.bed.getObjectByName('Rear safety rail');assert.ok(rail);
  assert.ok(new Box3().setFromObject(rail).max.z<MED_BED.depth-MED_BED.width/2);
  const duration=medicalDuration();
  assert.equal(medicalRecline(0),0);assert.equal(medicalRecline(duration/2),1);assert.equal(medicalRecline(duration),0);
  for(const time of [0,.3,1,2,duration/2,duration-5,duration-1,duration]){
    animateMilo(milo,{action:'medical',moving:false,time,actionTime:time});milo.updateMatrixWorld(true);
    assert.ok(Number.isFinite(milo.userData.body.position.y));
    if(time===duration/2){
      const body=milo.userData.body,up=body.localToWorld(new Vector3(0,1,1)).sub(body.localToWorld(new Vector3(0,1,0)));
      assert.ok(up.y>.99);assert.ok(Math.abs(up.x)<1e-10);
      const hips=body.localToWorld(new Vector3(0,.988,0));assert.ok(Math.abs(hips.y-(MED_BED.examTop+.119))<1e-10);
    }
  }
  animateMilo(milo,{action:null,moving:true,facing:-1,time:15});
  assert.equal(milo.userData.body.rotation.x,0);assert.equal(milo.userData.body.position.z,0);
  animateMedical(bay,0,false,null);assert.equal(bay.display.frame,'STANDBYnull');
  const readings=medicalReadings({energy:80,thirst:80});animateMedical(bay,17,true,readings);
  const version=bay.display.texture.version;animateMedical(bay,17,true,readings);assert.equal(bay.display.texture.version,version);
  animateMedical(bay,17.2,true,readings);assert.ok(bay.display.texture.version>version);
  animateMedical(bay,6,false,null);assert.equal(bay.display.frame,'STANDBYnull');
  animateMedical(bay,14,false,readings);assert.ok(bay.display.frame.startsWith('LAST CHECK'));
});

test('medical transfers pause sitting, keep feet grounded, and sweep low onto a supported mattress',()=>{
  const milo=createMilo(new Proxy({},{get:()=>new MeshStandardMaterial()})),point=new Vector3();
  let previous=null,peakKnee=0;
  for(let frame=0;frame<=medicalDuration()*60;frame++){
    const time=frame/60,pose=medicalTransferPose(time);
    animateMilo(milo,{action:'medical',moving:false,time,actionTime:time});milo.updateMatrixWorld(true);
    const head=milo.userData.head.getWorldPosition(new Vector3()),hip=milo.userData.hips.getWorldPosition(new Vector3());
    if(previous){assert.ok(head.distanceTo(previous.head)<.045);assert.ok(hip.distanceTo(previous.hip)<.03);}previous={head,hip};
    if(pose.seat===1){
      assert.ok(Math.abs(new Box3().setFromObject(milo.userData.hips,true).min.y-MED_BED.top-pose.elevation)<.008);
      assert.ok(Math.abs(hip.z-MED_BED.depth)<MED_BED.width/2);
    }
    for(const {knee,boot}of milo.userData.legs){
      peakKnee=Math.max(peakKnee,knee.getWorldPosition(point).y);
      if(['sitting','standing'].includes(pose.phase)){
        const sole=boot.localToWorld(new Vector3(0,-.107,0));
        assert.ok(Math.abs(sole.y)<.01);assert.ok(Math.abs(sole.z-(MED_TRANSFER.standingDepth+.013))<.01);
      }
      boot.traverse(mesh=>{
        if(!mesh.isMesh)return;
        const positions=mesh.geometry.attributes.position;
        for(let i=0;i<positions.count;i++){
          point.fromBufferAttribute(positions,i).applyMatrix4(mesh.matrixWorld);
          if(Math.abs(point.x)<MED_BED.length/2&&Math.abs(point.z-MED_BED.depth)<MED_BED.width/2){
            assert.ok(point.y>=MED_BED.top+pose.elevation-.002,`boot clips mattress at ${time}`);
          }
        }
      });
    }
  }
  assert.ok(peakKnee<MED_BED.examTop+.38);
  assert.equal(medicalTransferPose(3).phase,'settled');assert.equal(medicalTransferPose(3).recline,0);
  assert.equal(medicalTransferPose(medicalDuration()-3).phase,'seated');assert.equal(medicalTransferPose(medicalDuration()-3).recline,0);
});
