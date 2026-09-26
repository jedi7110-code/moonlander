import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Group,MeshStandardMaterial,Vector3} from 'three';
import {createMilo,animateMilo} from '../src/obs/characters.js';
import {loadMiloBody} from '../src/obs/milo-body.js';
import {BunkVisit} from '../src/obs/bunk-visit.js';
import {BED_ENTRY_SECONDS} from '../src/obs/bed-entry.js';
import {MED_BED,medicalDuration} from '../src/obs/medical.js';
import {cloneMiloSkinGeometry} from '../src/obs/milo-elbow.js';
import {setTabletHandFit} from '../src/obs/tablet-pose.js';
import {setMealHandFit} from '../src/obs/cup-hand-fit.js';
import {applyLadderPose} from '../src/obs/ladder-pose.js';
import {setLadderHandFit} from '../src/obs/ladder-hand-fit.js';

await loadMiloBody('data:application/json;base64,'+(await readFile(new URL('../public/assets/obs/milo/body.json',import.meta.url))).toString('base64'));
const character=()=>createMilo(new Proxy({},{get:(o,k)=>o[k]??=new MeshStandardMaterial()}));
const points=root=>root.userData.legs.map(r=>root.parent.worldToLocal(r.boot.getWorldPosition(new Vector3())));

for(const kind of ['bunk','medical'])test(`OBS ${kind}: left foot leads on a translated and rotated cabin floor`,()=>{
  const root=character(),cabin=new Group();cabin.position.set(3,3.392,-1);cabin.rotation.y=.3;cabin.add(root);root.position.x=4;
  const start=kind==='bunk'?6.95:5.05;
  const pose=age=>{
    const visit=new BunkVisit();visit.startYaw=0;visit.update(start+age);
    animateMilo(root,{action:kind,moving:false,time:0,actionTime:start+age,actionDuration:medicalDuration(),bunkVisit:kind==='bunk'?visit:null});
    cabin.updateMatrixWorld(true);return points(root);
  };
  const initial=pose(0),mid=pose(BED_ENTRY_SECONDS*.40);
  const right=root.userData.legs.findIndex(r=>r.side===-1),left=1-right;
  assert.ok(mid[right].distanceTo(initial[right])<1e-8,'the following foot stays planted in cabin coordinates');
  assert.ok(mid[left].y>initial[left].y+.5,'anatomical left reaches the mattress first');
  const end=pose(BED_ENTRY_SECONDS);
  assert.ok(Math.abs(end[0].y-end[1].y)<1e-8);
  assert.ok(end.every(p=>Math.abs(p.y-(kind==='bunk'?.59:MED_BED.examTop)-.132)<1e-8));
});

test('medical entry and interrupted exit follow the same supported path in reverse',()=>{
  const root=character(),cabin=new Group();cabin.add(root);const duration=medicalDuration();
  const joints=[root.userData.body,...root.userData.legs.flatMap(r=>[r.leg,r.knee,r.boot])];
  for(const age of [5.05,6,7.8,9.6,10.45]){
    animateMilo(root,{action:'medical',moving:false,time:0,actionTime:age,actionDuration:duration});root.updateMatrixWorld(true);
    const before=joints.map(j=>j.matrixWorld.clone());
    animateMilo(root,{action:null,moving:false,time:0,reclineExit:{id:'medical',entryTime:age,age:0,actionDuration:duration}});root.updateMatrixWorld(true);
    joints.forEach((j,i)=>j.matrixWorld.elements.forEach((v,k)=>assert.ok(Math.abs(v-before[i].elements[k])<1e-8)));
  }
});

test('OBS enables the approved elbow and keeps its crease independent of each grip geometry',()=>{
  const root=character(),skin=root.userData.bodySkin,original=skin.geometry;
  assert.equal(skin.skeleton.bones.filter(b=>b.name.endsWith('_elbow support')).length,2);
  assert.ok(root.userData.elbowDeformation);
  const neutral=cloneMiloSkinGeometry(skin).attributes.position.array.slice();
  const bend=angle=>{for(const r of root.userData.arms)r.elbow.rotation.set(-angle,0,0);root.userData.updateWristTwists();};
  bend(2.2);const expected=skin.geometry.attributes.position.array.slice();
  for(const fit of ['meal','tablet','ladder','meal','tablet']){
    setMealHandFit(root,0);setLadderHandFit(root,false);setTabletHandFit(root,false);
    if(fit==='meal')setMealHandFit(root,1);
    if(fit==='tablet')setTabletHandFit(root,true);
    if(fit==='ladder')applyLadderPose(root,.4);
    assert.notEqual(skin.geometry,original);
    for(const angle of [.2,2.2])bend(angle);
    const p=skin.geometry.attributes.position,a=original.attributes;
    // Ladder reshapes the forearm itself; other grip variants only fit fingers.
    if(fit!=='ladder')for(let i=0;i<p.count;i++)if(a.armRegion.getX(i)>.95&&a.position.getY(i)>1.10&&a.position.getY(i)<1.25)
      assert.equal(p.getZ(i),expected[i*3+2],'the elbow matches the current bend, not the angle when the grip was cloned');
  }
  setMealHandFit(root,0);setLadderHandFit(root,false);setTabletHandFit(root,false);bend(0);
  assert.equal(skin.geometry,original);assert.deepEqual(skin.geometry.attributes.position.array,neutral);
});
