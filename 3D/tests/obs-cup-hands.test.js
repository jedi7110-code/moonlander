import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Box3,MeshStandardMaterial,Vector3} from 'three';
import {loadMiloBody} from '../src/obs/milo-body.js';
import {createMilo,animateMilo} from '../src/obs/characters.js';
import {createDiningStudy,applyDiningStudy} from '../studies/milo/dining-study.js';
import {cupGripPose,diningPhase} from '../src/obs/dining.js';

await loadMiloBody(`data:application/json;base64,${(await readFile(new URL('../public/assets/obs/milo/body.json',import.meta.url))).toString('base64')}`);
const materials=()=>new Proxy({},{get:(o,k)=>o[k]??=new MeshStandardMaterial()});
const character=()=>createMilo(materials());
const pose=(root,time,extra={})=>animateMilo(root,{moving:false,climbing:false,facing:1,time,action:'hydro',actionTime:time,actionDuration:8,...extra});
const palm=rig=>rig.arm.quaternion.clone().multiply(rig.elbow.quaternion).multiply(rig.hand.quaternion);

test('0.17 seconds starts from the relaxed hand without snapping or reversing the fingers',()=>{
  const root=character(),rig=root.userData.arms[1];
  pose(root,0,{action:null});const rest=palm(rig),joints=[rig.arm,rig.elbow,rig.hand],initial=joints.map(j=>j.quaternion.clone());
  pose(root,0);joints.forEach((j,i)=>assert.ok(j.quaternion.angleTo(initial[i])<1e-7));
  pose(root,.17);
  assert.ok(rest.angleTo(palm(rig))<.10,'the palm must not jump to its final orientation at the start');
  assert.ok(new Vector3(0,-1,0).angleTo(new Vector3(0,-1,0).applyQuaternion(rig.hand.quaternion))<.10,'the wrist is still almost straight at 0.17s');
  for(const f of rig.fingers)assert.ok(f.userData.links.every(link=>link.rotation.x>=0),'curl toward the palm, not backward');
});

test('cup grasp stays continuous with bounded wrist bending through the production station cycle',()=>{
  const ctx=new Proxy({measureText:t=>({width:t.length*8})},{get:(o,k)=>k in o?o[k]:()=>{}});let study;
  globalThis.document={createElement:()=>({getContext:()=>ctx})};
  try{study=createDiningStudy(materials());}finally{delete globalThis.document;}
  const root=character(),rig=root.userData.arms[1];let previous;
  for(let f=0;f<=480;f++){
    const time=f/60;applyDiningStudy(study,root,'hydro',time);root.updateMatrixWorld(true);
    const bending=new Vector3(0,-1,0).angleTo(new Vector3(0,-1,0).applyQuaternion(rig.hand.quaternion));
    assert.ok(bending<Math.PI/4,`no folded wrist at ${time}s (${bending*180/Math.PI} degrees)`);
    const joints=[rig.arm,rig.elbow,rig.hand,...rig.fingers.flatMap(f=>[f,...f.userData.links])];
    if(previous)joints.forEach((j,i)=>assert.ok(j.quaternion.angleTo(previous[i])<.12,`no joint pop at ${time}s`));
    previous=joints.map(j=>j.quaternion.clone());
    const phase=diningPhase(time,8);
    if(phase.reach===1){
      const mug=root.userData.dining.mug,grasp=cupGripPose(phase.progress);
      assert.ok(rig.hand.getWorldPosition(new Vector3()).distanceTo(mug.localToWorld(grasp.position))<1e-8);
      assert.ok(rig.fingers.every(f=>f.rotation.x>0&&f.userData.links.every(l=>l.rotation.x>0)));
    }
  }
});

test('the body, reaching fingers and cup clear the dispenser and tray for the entire cycle',()=>{
  const ctx=new Proxy({measureText:t=>({width:t.length*8})},{get:(o,k)=>k in o?o[k]:()=>{}});let study;
  globalThis.document={createElement:()=>({getContext:()=>ctx})};
  try{study=createDiningStudy(materials());}finally{delete globalThis.document;}
  study.root.updateMatrixWorld(true);
  const obstacles=[],bounds=new Box3();
  study.stations.hydro.root.traverse(object=>{
    if(!object.isMesh)return;
    // Allow surface contact, but not penetration of the tray, taps or cabinet.
    const box=new Box3().setFromObject(object).expandByScalar(-.002);
    obstacles.push({box,name:object.name||object.geometry.type});bounds.union(box);
  });
  const root=character(),skin=root.userData.bodySkin,point=new Vector3();
  const shoulders=root.userData.arms.map(({arm})=>arm.position.clone());
  for(let frame=0;frame<=240;frame++){
    const time=frame/30;applyDiningStudy(study,root,'hydro',time);
    root.updateMatrixWorld(true);skin.skeleton.update();
    root.userData.arms.forEach(({arm},i)=>assert.ok(arm.position.distanceTo(shoulders[i])<1e-8,'the cup is reachable without pulling the shoulder out of place'));
    const positions=skin.geometry.attributes.position;
    for(let i=0;i<positions.count;i++){
      skin.applyBoneTransform(i,point.fromBufferAttribute(positions,i)).applyMatrix4(skin.matrixWorld);
      if(!bounds.containsPoint(point))continue;
      for(const obstacle of obstacles)assert.ok(!obstacle.box.containsPoint(point),`body vertex ${i} penetrates ${obstacle.name} at ${time}s`);
    }
    const cup=new Box3().setFromObject(root.userData.dining.mug);
    for(const obstacle of obstacles)assert.ok(!cup.intersectsBox(obstacle.box),`cup penetrates ${obstacle.name} at ${time}s`);
  }
});

test('the cup finger fit is gradual, isolated to that hand, and restores across other poses',()=>{
  const root=character(),skin=root.userData.bodySkin,original=skin.geometry;
  pose(root,0);assert.equal(skin.geometry,original);
  const source=original.attributes.position.array.slice();
  pose(root,.17);const early=skin.geometry.attributes.position.array.slice();
  pose(root,1.2);const fitted=skin.geometry.attributes.position;
  for(let i=0;i<fitted.count;i++){
    const a=original.attributes;
    if(a.position.getX(i)<0||a.position.getY(i)>.934||a.armRegion.getX(i)<.95){
      for(let k=0;k<3;k++)assert.equal(fitted.array[i*3+k],source[i*3+k]);
    }
    for(let k=0;k<3;k++)assert.ok(Math.abs(early[i*3+k]-source[i*3+k])<.003,'initial reach must not replace the hand abruptly');
  }
  assert.deepEqual(original.attributes.position.array,source,'never modify the original skin');
  const fresh=character();
  for(const extra of [{action:null},{action:'lounge',leisure:'tablet'},{action:'galley'},{action:'gym'},{action:'hydro'}]){
    pose(root,3,extra);pose(fresh,3,extra);
    for(const key of ['position','skinIndex','skinWeight'])assert.deepEqual(skin.geometry.attributes[key].array,fresh.userData.bodySkin.geometry.attributes[key].array,'pose switches restore their own skin');
  }
  pose(root,8);assert.equal(skin.geometry,original);
});
