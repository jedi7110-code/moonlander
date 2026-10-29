import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {readFileSync} from 'node:fs';
import {createDroid,DROID_SPEC} from '../src/obs/droid-model.js';
import {createDroidLowParts,addDroidBalanceRotor} from '../src/obs/droid-low.js';

test('balance rotor remains optional for comparison and shares the original rigid skin',()=>{
  const original=createDroid({detail:'obs'}),droid=createDroid({detail:'obs',balanceRotor:true});
  try{
    assert.equal(original.balance,null,'the pre-rotor model remains available for comparison');
    assert.ok(droid.balance);assert.equal(droid.balance.root.parent,droid.chassis);
    const meshes=[];droid.root.traverseVisible(o=>{if(o.isMesh)meshes.push(o);});
    assert.equal(meshes.length,3,'no extra body draw, material, texture or light');
    const geometry=droid.skin.mesh.geometry;
    assert.ok(geometry.attributes.position.count/3<4000);
    assert.equal(droid.skin.skeleton.bones.length,original.skin.skeleton.bones.length+4);
    for(const key of ['position','normal','uv'])assert.ok([...geometry.attributes[key].array].every(Number.isFinite));
    const study=readFileSync(new URL('../studies/droid/lite-study.js',import.meta.url),'utf8');
    assert.match(study,/rotorStudy=params.get\('rotor'\)!=='0'/);
    assert.match(study,/balanceRotor:rotorStudy&&detail==='obs'/);
  }finally{original.dispose();droid.dispose();}
});

test('drums counter-rotate, stop when charging, and seek deterministically without reallocations',()=>{
  const droid=createDroid({detail:'obs',balanceRotor:true}),b=droid.balance;
  const mesh=droid.skin.mesh,geometry=mesh.geometry,material=mesh.material;
  const sample=()=>[b.cradle,...b.rotors].flatMap(o=>o.quaternion.toArray());
  try{
    droid.update(.2,'idle');const first=b.rotors.map(o=>o.rotation.y);
    droid.update(.4,'idle');const second=b.rotors.map(o=>o.rotation.y);
    assert.ok(second[0]>first[0]&&second[1]<first[1]);
    assert.ok(Math.abs((second[0]-first[0])+(second[1]-first[1]))<1e-9);
    const idleRoll=b.cradle.rotation.z;droid.update(.4,'walk');assert.notEqual(b.cradle.rotation.z,idleRoll);
    const walked=sample();droid.update(7,'carry');droid.update(.4,'walk');assert.deepEqual(sample(),walked);
    droid.update(.4,'walk');assert.deepEqual(sample(),walked,'pause cannot advance rotation');
    droid.update(0,'charging');const parked=sample();droid.update(30,'charging');assert.deepEqual(sample(),parked);
    droid.update(0,'wake');assert.deepEqual(sample(),parked);
    droid.update(1,'wake');assert.notDeepEqual(sample(),parked);
    // Rigid rotor vertices must follow their own bones inside the existing skin.
    const positions=geometry.attributes.position,indices=geometry.attributes.skinIndex;
    for(const rotor of b.rotors){
      const boneIndex=mesh.skeleton.bones.findIndex(bone=>bone.parent===rotor);assert.ok(boneIndex>=0);
      const vertex=Array.from({length:positions.count},(_,i)=>i).find(i=>indices.getX(i)===boneIndex);
      const local=new THREE.Vector3().fromBufferAttribute(positions,vertex).applyMatrix4(mesh.bindMatrix).applyMatrix4(mesh.skeleton.boneInverses[boneIndex]);
      for(const time of [0,.1,.35,1,3]){
        droid.update(time,'walk');droid.root.updateMatrixWorld(true);
        const visible=mesh.getVertexPosition(vertex,new THREE.Vector3()).applyMatrix4(mesh.matrixWorld);
        assert.ok(visible.distanceTo(local.clone().applyMatrix4(mesh.skeleton.bones[boneIndex].matrixWorld))<1e-6);
      }
    }
    assert.equal(mesh.geometry,geometry);assert.equal(mesh.material,material);
  }finally{droid.dispose();}
});

test('rotor swept volume remains between the pelvic cover and chest equipment',()=>{
  const parts=createDroidLowParts(DROID_SPEC,{},()=>[]),balance=addDroidBalanceRotor(parts.chassis,parts.m);
  try{
    for(let i=0;i<=120;i++){
      balance.update(i/30,{walkAmount:1,lean:.18});parts.root.updateMatrixWorld(true);
      const swept=new THREE.Box3().setFromObject(balance.rotors[0],true).union(new THREE.Box3().setFromObject(balance.rotors[1],true));
      assert.ok(swept.min.y>.105&&swept.max.y<.203,'clear of the fixed cage and upper/lower covers');
      assert.ok(swept.min.x>-.075&&swept.max.x<.075,'inside side supports and outside the arms');
      assert.ok(swept.min.z>.035&&swept.max.z<.195,'forward of the spine, behind the body front');
    }
  }finally{
    parts.root.traverse(o=>o.geometry?.dispose());for(const resource of new Set(Object.values(parts.m)))resource.dispose?.();
  }
});
