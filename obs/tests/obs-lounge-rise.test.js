import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Vector3,MeshStandardMaterial} from 'three';
import {loadMiloBody} from '../src/obs/milo-body.js';
import {createMilo,animateMilo} from '../src/obs/characters.js';
import {loungeWorldPose} from '../src/obs/lounge-conversation.js';

await loadMiloBody('data:application/json;base64,'+(await readFile(new URL('../public/assets/obs/milo/body.json',import.meta.url))).toString('base64'));
const create=()=>createMilo(new Proxy({},{get:(o,k)=>o[k]??=new MeshStandardMaterial()}));
function sample(root,exit){
  const pose=loungeWorldPose({loungeCompanion:{seatX:7.25},loungeExit:exit});root.position.set(pose.x,3.392,pose.z);
  animateMilo(root,{action:'lounge',moving:false,climbing:false,time:10+exit.age,actionTime:exit.conversation.age,leisure:'conversation',loungeExit:exit});
  root.updateMatrixWorld(true);root.userData.bodySkin.skeleton.update();
}
function wristSurface(root,ids){
  const skin=root.userData.bodySkin;
  return ids.map(id=>skin.applyBoneTransform(id,new Vector3().fromBufferAttribute(skin.geometry.attributes.position,id)).applyMatrix4(skin.matrixWorld));
}

test('real wrist skin moves smoothly from a speaking or resting pose through the complete rise',()=>{
  const root=create(),{position,armRegion}=root.userData.bodySkin.geometry.attributes,ids=[];
  for(let i=0;i<position.count;i++)if(armRegion.getX(i)>.95&&position.getY(i)<.94&&i%7===0)ids.push(i);
  for(const age of [2,4.85,7]){
    const exit={age:0,companion:true,seatedYaw:-.32,conversation:{age,weight:1}};
    root.position.set(7.25,3.392,.06);
    animateMilo(root,{action:'lounge',moving:false,climbing:false,time:10,leisure:'conversation',conversation:exit.conversation});
    root.updateMatrixWorld(true);root.userData.bodySkin.skeleton.update();let previous=wristSurface(root,ids);
    for(let frame=0;frame<=240;frame++){
      exit.age=frame/60;sample(root,exit);const points=wristSurface(root,ids);
      points.forEach((point,i)=>assert.ok(point.distanceTo(previous[i])<.025,`no wrist flap at ${exit.age} after conversation ${age}`));previous=points;
      root.traverse(node=>assert.ok(node.quaternion.toArray().every(Number.isFinite)));
    }
  }
});

test('seeking and pausing the rise do not depend on a previously rendered arm pose',()=>{
  const live=create(),direct=create(),exit={age:0,companion:true,seatedYaw:-.32,conversation:{age:2,weight:1}};
  for(let frame=0;frame<=240;frame++){
    exit.age=frame/60;sample(live,exit);
    if(frame%30)continue;
    sample(direct,{...exit});
    for(let i=0;i<2;i++)for(const key of ['arm','elbow','hand'])assert.ok(live.userData.arms[i][key].quaternion.angleTo(direct.userData.arms[i][key].quaternion)<1e-7);
    const before=live.userData.arms.flatMap(rig=>[rig.arm,rig.elbow,rig.hand].map(joint=>joint.quaternion.toArray()));
    sample(live,exit);assert.deepEqual(live.userData.arms.flatMap(rig=>[rig.arm,rig.elbow,rig.hand].map(joint=>joint.quaternion.toArray())),before);
  }
});
