import test from 'node:test';
import assert from 'node:assert/strict';
import {runPreparationSteps} from '../src/obs/background-preparation.js';
import {createDroid,createDroidSteps} from '../src/obs/droid-model.js';

function snapshot(droid){
  droid.update(0,'charging');droid.root.updateMatrixWorld(true);
  const meshes=[];
  droid.root.traverse(object=>{if(object.isMesh)meshes.push({name:object.name,
    position:[...object.geometry.attributes.position.array],index:object.geometry.index?[...object.geometry.index.array]:null,
    transform:object.matrixWorld.toArray()});});
  return {meshes,texture:[...droid.skin.mesh.material.map.image.data]};
}
test('paced OBS droid preparation gives film frames time while preserving the powered-down geometry and atlas pixels',async()=>{
  const immediate=createDroid({detail:'obs',balanceRotor:true});let paced,frames=0;
  try{
    paced=await runPreparationSteps(createDroidSteps({detail:'obs',balanceRotor:true}),{nextFrame:()=>new Promise(resolve=>setImmediate(()=>{frames++;resolve();}))});
    assert.ok(frames>20,'atlas tiles, limbs and rigid batching leave multiple event-loop turns');
    assert.deepEqual(snapshot(paced),snapshot(immediate));
  }finally{immediate.dispose();paced?.dispose();}
});
