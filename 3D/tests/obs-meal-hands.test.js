import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Box3,MeshStandardMaterial,Vector3} from 'three';
import {loadMiloBody} from '../src/obs/milo-body.js';
import {createMilo,animateMilo} from '../src/obs/characters.js';
import {createDiningStudy,applyDiningStudy} from '../studies/milo/dining-study.js';
import {diningPhase} from '../src/obs/dining.js';
import {MEAL_CONTACTS,MEAL_HAND_CONTACTS} from '../src/obs/meal-pose.js';

await loadMiloBody(`data:application/json;base64,${(await readFile(new URL('../public/assets/obs/milo/body.json',import.meta.url))).toString('base64')}`);
const materials=()=>new Proxy({},{get:(o,k)=>o[k]??=new MeshStandardMaterial()});
const character=()=>createMilo(materials());
function kitchen(){
  const ctx=new Proxy({measureText:t=>({width:t.length*8})},{get:(o,k)=>k in o?o[k]:()=>{}});
  globalThis.document={createElement:()=>({getContext:()=>ctx})};
  try{return createDiningStudy(materials());}finally{delete globalThis.document;}
}
const joints=root=>root.userData.arms.flatMap(r=>[r.arm,r.elbow,r.hand,r.thumb,...r.fingers.flatMap(f=>[f,...f.userData.links])]);

test('kitchen reach begins from relaxed arms without the initial palm snap',()=>{
  const root=character(),study=kitchen();
  animateMilo(root,{action:null,moving:false,time:0});const initial=joints(root).map(j=>j.quaternion.clone());
  applyDiningStudy(study,root,'galley',0);
  joints(root).forEach((j,i)=>assert.ok(j.quaternion.angleTo(initial[i])<1e-7));
  applyDiningStudy(study,root,'galley',.17);
  joints(root).forEach((j,i)=>assert.ok(j.quaternion.angleTo(initial[i])<.08,'the hand must follow the arm gradually'));
});

test('both kitchen wrists stay straight, fingers curl inward and contacts stay attached through eating',()=>{
  const root=character(),study=kitchen();let previous;
  const shoulders=root.userData.arms.map(r=>r.arm.position.clone());
  for(let frame=0;frame<=600;frame++){
    const time=frame/60;applyDiningStudy(study,root,'galley',time);root.updateMatrixWorld(true);
    const all=joints(root);
    if(previous)all.forEach((j,i)=>assert.ok(j.quaternion.angleTo(previous[i])<.075,`no sudden joint turn at ${time}s`));
    previous=all.map(j=>j.quaternion.clone());
    root.userData.arms.forEach((rig,index)=>{
      assert.ok(rig.arm.position.distanceTo(shoulders[index])<1e-8,'keep the shoulders attached to the body');
      const bend=new Vector3(0,-1,0).angleTo(new Vector3(0,-1,0).applyQuaternion(rig.hand.quaternion));
      assert.ok(bend<.15,`wrist ${index} folds at ${time}s`);
      if(diningPhase(time,10).reach!==1)return;
      const prop=root.userData.dining[index===0?'bowl':'spoon'];
      const hand=rig.hand.localToWorld(MEAL_HAND_CONTACTS[index].clone());
      assert.ok(hand.distanceTo(prop.localToWorld(MEAL_CONTACTS[index].clone()))<1e-7,'the grip must stay on the dish as the hand angle changes');
      for(const finger of rig.fingers)assert.ok(finger.rotation.x>0&&finger.userData.links.every(link=>link.rotation.x>0),'no backwards finger curls');
    });
  }
});

test('the reaching hands and body clear the kitchen worktop, taps and cabinet',()=>{
  const root=character(),study=kitchen(),skin=root.userData.bodySkin,obstacles=[],bounds=new Box3();
  study.root.updateMatrixWorld(true);
  study.stations.galley.root.traverse(object=>{
    if(!object.isMesh)return;
    const box=new Box3().setFromObject(object).expandByScalar(-.002);obstacles.push(box);bounds.union(box);
  });
  const point=new Vector3();
  for(let frame=0;frame<=300;frame++){
    const time=frame/30;applyDiningStudy(study,root,'galley',time);root.updateMatrixWorld(true);skin.skeleton.update();
    const positions=skin.geometry.attributes.position;
    for(let i=0;i<positions.count;i++){
      skin.applyBoneTransform(i,point.fromBufferAttribute(positions,i)).applyMatrix4(skin.matrixWorld);
      if(!bounds.containsPoint(point))continue;
      assert.ok(obstacles.every(box=>!box.containsPoint(point)),`body vertex ${i} clips the kitchen at ${time}s`);
    }
  }
});

test('meal and cup hand fits restore cleanly when switching poses in either order',()=>{
  const root=character(),original=root.userData.bodySkin.geometry;
  for(const action of ['galley','hydro','galley','lounge','galley',null]){
    const fresh=character();
    for(const model of [root,fresh])animateMilo(model,{action,moving:false,leisure:'tablet',time:4,actionTime:4,actionDuration:10});
    for(const key of ['position','skinIndex','skinWeight'])assert.deepEqual(root.userData.bodySkin.geometry.attributes[key].array,fresh.userData.bodySkin.geometry.attributes[key].array);
  }
  assert.equal(root.userData.bodySkin.geometry,original);
});
