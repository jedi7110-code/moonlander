import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Group,MeshStandardMaterial,Vector3} from 'three';
import {createMilo,animateMilo} from '../src/obs/characters.js';
import {loadMiloBody} from '../src/obs/milo-body.js';
import {cloneMiloSkinGeometry} from '../src/obs/milo-elbow.js';
import {HatchRepairVisit} from '../src/obs/hatch-repair.js';
import {hatchRepairGripWeight,REPAIR_TOOL_GRIP,REPAIR_TOOL_TIP} from '../src/obs/hatch-repair-pose.js';
import {poseRepairStudy,REPAIR_STUDY_GENTLE} from '../src/hatch-repair-study-model.js';
import {createEVAHatch,animateAirlock} from '../src/obs/eva.js';
import {getStation,CABIN_AISLE} from '../src/obs/layout.js';
import {FLOOR_Y} from '../src/obs/ship.js';

await loadMiloBody(`data:application/json;base64,${(await readFile(new URL('../public/assets/obs/milo/body.json',import.meta.url))).toString('base64')}`);
const model=()=>createMilo(new Proxy({},{get:(object,key)=>object[key]??=new MeshStandardMaterial()}));
const digits=root=>{
  const {fingers,thumb}=root.userData.arms[0];
  return [...fingers.flatMap(finger=>[finger,...finger.userData.links]),thumb,thumb.userData.ip];
};

test('8.968 seconds already grips the screwdriver, independently of arm reach and tuning',()=>{
  const root=model();
  for(const tuning of [null,REPAIR_STUDY_GENTLE]){
    const {visit}=poseRepairStudy(root,8.968,tuning);
    assert.ok(visit.pose.reach<.05,'regression: the arm has barely started reaching');
    assert.equal(hatchRepairGripWeight(visit),1);
    assert.ok(root.userData.repairTool.visible);
    const grip=digits(root).map(joint=>joint.quaternion.clone());
    assert.ok(root.userData.arms[0].fingers.every(f=>f.rotation.x>0&&f.userData.links.every(link=>link.rotation.x>.25)));
    assert.ok(root.userData.arms[0].thumb.rotation.z>1,'thumb opposes and presses along the handle');
    for(const time of [9.2,11.8,14.2,18.6]){
      poseRepairStudy(root,time,tuning);
      digits(root).forEach((joint,i)=>assert.ok(joint.quaternion.angleTo(grip[i])<1e-7,'do not reopen or slip while lifting/turning/withdrawing'));
    }
  }
});

test('the imported finger pads surround the handle without entering its core',()=>{
  const root=model();poseRepairStudy(root,8.968,REPAIR_STUDY_GENTLE);
  const skin=root.userData.bodySkin,hand=root.userData.arms[0].hand,attributes=skin.geometry.attributes;
  const nearest=new Map(),g=REPAIR_TOOL_GRIP;
  for(let i=0;i<attributes.position.count;i++){
    let dominant=0;
    for(let k=1;k<4;k++)if(attributes.skinWeight.array[i*4+k]>attributes.skinWeight.array[i*4+dominant])dominant=k;
    const name=skin.skeleton.bones[attributes.skinIndex.array[i*4+dominant]].name;
    const match=name.match(/L_(finger\d|thumb)/);if(!match)continue;
    const point=hand.worldToLocal(skin.applyBoneTransform(i,new Vector3().fromBufferAttribute(attributes.position,i)).applyMatrix4(skin.matrixWorld));
    if(Math.abs(point.x-g.x)>g.length/2)continue;
    const radial=Math.hypot(point.y-g.y,point.z-g.z);
    assert.ok(radial>g.radius-.003,`${name} must not pass through the wooden handle`);
    nearest.set(match[1],Math.min(nearest.get(match[1])??Infinity,Math.abs(radial-g.radius)));
  }
  assert.equal(nearest.size,5,'all four fingers and the thumb are checked');
  for(const [name,gap]of nearest)assert.ok(gap<.003,`${name} should touch the handle, not float (${gap})`);
});

test('the real shaft endpoint stays on the service screw throughout the working twist',()=>{
  const root=model(),shaft=root.getObjectByName('Repair screwdriver shaft');
  for(const tuning of [null,REPAIR_STUDY_GENTLE])for(const time of [11.8,12.75,14.5,15.7]){
    const {tip,screw,contact}=poseRepairStudy(root,time,tuning);
    const endpoint=shaft.localToWorld(new Vector3(0,shaft.geometry.parameters.height/2,0));
    assert.ok(endpoint.distanceTo(tip)<1e-8,'the contact guide must track the mesh, not an obsolete tip offset');
    assert.ok(contact&&endpoint.distanceTo(screw)<.008);
    assert.ok(root.userData.arms[0].hand.localToWorld(REPAIR_TOOL_TIP.clone()).distanceTo(endpoint)<1e-8);
  }
});

test('repair study and OBS tools touch the actual redesigned lock after deck placement and reparenting',()=>{
  const station=getStation('innerHatch');
  for(const deckY of [0,FLOOR_Y[station.floor]]){
    const hatch=createEVAHatch(null,deckY,true),animated=new Group(),milo=model();
    if(deckY!==0){hatch.updateMatrixWorld(true);animated.attach(hatch.userData.door);}
    animateAirlock(hatch.userData.door,hatch.userData.signal,0);
    const screw=hatch.userData.door.getObjectByName('Inner lock service screw');
    const shaft=milo.getObjectByName('Repair screwdriver shaft');
    const target=screw.localToWorld(new Vector3(0,screw.geometry.parameters.height/2,0));
    for(const time of [11.8,12.75,14.5,15.7]){
      if(deckY===0){
        const readout=poseRepairStudy(milo,time);
        assert.ok(readout.screw.distanceTo(target)<1e-7,'study contact marker matches the real lock mesh');
      }else{
        const visit=new HatchRepairVisit(1);visit.startYaw=Math.PI/2;visit.update(time);
        milo.position.set((station.x-700)*.022,deckY,CABIN_AISLE.crewZ);milo.rotation.set(0,Math.PI/2,0);
        animateMilo(milo,{moving:false,climbing:false,facing:1,action:'innerHatch',time,dt:0,hatchRepair:visit});
        milo.updateMatrixWorld(true);
      }
      const endpoint=shaft.localToWorld(new Vector3(0,shaft.geometry.parameters.height/2,0));
      assert.ok(endpoint.distanceTo(target)<.008,`tool stays on the actual lock at deck ${deckY}, time ${time}`);
    }
  }
});

test('grip preparation/release is continuous, cancellation holds the tool, and other actions restore neutral skin',()=>{
  const root=model(),fresh=model();let previous;
  for(let frame=0;frame<28.8*60;frame++){
    const time=frame/60;poseRepairStudy(root,time,REPAIR_STUDY_GENTLE);
    const poses=digits(root).map(joint=>joint.quaternion.clone());
    if(previous)poses.forEach((q,i)=>assert.ok(q.angleTo(previous[i])<.09,`no finger snap at ${time}`));
    previous=poses;
  }
  const cancelled=new HatchRepairVisit(1);cancelled.update(9.5);cancelled.requestExit();cancelled.update(.3);
  assert.equal(hatchRepairGripWeight(cancelled),1,'keep holding while retracting a cancelled repair');
  poseRepairStudy(root,11.8);
  const state={moving:false,climbing:false,facing:1,time:2,dt:0,action:null};
  animateMilo(root,state);animateMilo(fresh,state);
  for(const key of ['position','skinIndex','skinWeight']){
    assert.deepEqual(cloneMiloSkinGeometry(root.userData.bodySkin).attributes[key].array,cloneMiloSkinGeometry(fresh.userData.bodySkin).attributes[key].array);
  }
  digits(root).forEach((joint,i)=>assert.ok(joint.quaternion.angleTo(digits(fresh)[i].quaternion)<1e-7));
  assert.equal(root.userData.repairTool.visible,false);
});
