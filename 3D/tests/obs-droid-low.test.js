import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createDroid,DROID_EXPRESSIONS} from '../src/obs/droid-model.js';
import {createCabinToon} from '../src/obs/cabin-toon.js';
import {sampleDroidServicePose,droidLadderContact} from '../src/obs/droid-service.js';

function inventory(root){
  let triangles=0;const meshes=[];
  root.traverse(o=>{if(o.isMesh){meshes.push(o);triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;}});
  return {meshes,triangles};
}

test('lightweight model uses one opaque body skin and one face image, keeping the detailed default',()=>{
  const detailed=createDroid(),low=createDroid({detail:'obs'});
  try{
    assert.equal(detailed.root.userData.droidDetail,'study');assert.equal(detailed.skin,null);
    const old=inventory(detailed.root),small=inventory(low.root);
    assert.ok(small.triangles<3500&&small.triangles<old.triangles*.03);
    const visible=[];low.root.traverseVisible(o=>{if(o.isMesh)visible.push(o);});assert.equal(visible.length,2);
    assert.equal(visible.filter(o=>o.isSkinnedMesh).length,1);assert.ok(visible.every(o=>!o.material.transparent));
    const atlas=low.skin.mesh.material.map;assert.equal(atlas.image.width,512);assert.equal(atlas.image.height,512);
    const face=visible.find(o=>o.material.isMeshBasicMaterial);assert.equal(face.geometry.attributes.position.count,4);assert.equal(face.material.map.image.width,1024);
    assert.ok(small.meshes.every(o=>!['TubeGeometry','TorusGeometry','SphereGeometry'].includes(o.geometry.type)));
    for(const o of small.meshes)for(const name of ['position','normal','uv'])for(const v of o.geometry.attributes[name].array)assert.ok(Number.isFinite(v));
    const box=new THREE.Box3().setFromObject(low.root);assert.ok(box.min.y>=-.001&&box.max.y<1.8);
  }finally{detailed.dispose();low.dispose();}
});

test('all bitmap expressions swap UVs without reallocating textures or geometry; charging turns them off',()=>{
  const droid=createDroid({detail:'obs'});let face;droid.root.traverse(o=>{if(o.material?.isMeshBasicMaterial)face=o;});
  try{
    const geometry=face.geometry,map=face.material.map,seen=new Set();
    for(const expression of Object.keys(DROID_EXPRESSIONS)){
      assert.equal(droid.face.setExpression(expression),true);droid.update(1.16,'walk');
      assert.equal(droid.face.expression,expression);assert.equal(face.geometry,geometry);assert.equal(face.material.map,map);
      const uv=geometry.attributes.uv.array;assert.ok([...uv].every(x=>x>=0&&x<=1));seen.add([...uv].join(','));
    }
    assert.equal(seen.size,6);assert.equal(droid.face.setExpression('missing'),false);
    droid.update(0,'charging');assert.equal(face.visible,false);droid.update(0,'idle');assert.equal(face.visible,true);
  }finally{droid.dispose();}
});

test('lightweight joints retain the existing motions, grip targets and rigid geometry after root transforms',()=>{
  const low=createDroid({detail:'obs'}),detailed=createDroid();
  const mesh=low.skin.mesh,{bones,boneInverses}=mesh.skeleton,position=mesh.geometry.attributes.position,skinIndex=mesh.geometry.attributes.skinIndex,skinWeight=mesh.geometry.attributes.skinWeight;
  const vertices=new Map();
  for(let i=0;i<position.count;i++){
    assert.deepEqual([skinWeight.getX(i),skinWeight.getY(i),skinWeight.getZ(i),skinWeight.getW(i)],[1,0,0,0]);
    const index=skinIndex.getX(i);
    if(!vertices.has(index))vertices.set(index,{vertex:i,local:new THREE.Vector3().fromBufferAttribute(position,i).applyMatrix4(mesh.bindMatrix).applyMatrix4(boneInverses[index])});
  }
  try{
    for(const mode of ['idle','walk','carry','charging','climb'])for(const time of [0,.19,.7,1.16,3.7,9,0]){
      const y=.75+time*.16,p=mode==='climb'?sampleDroidServicePose({y,climb:{from:0,to:6.784},age:10,duration:100,rest:0}):{};
      const a=low.update(time,mode==='climb'?'service':mode,p),b=detailed.update(time,mode==='climb'?'service':mode,p);
      for(let i=0;i<2;i++){
        for(const key of ['shoulder','elbow','wrist'])assert.ok(a.hands[i][key].distanceTo(b.hands[i][key])<1e-8);
        for(const key of ['hip','knee','hock','local'])assert.ok(a.feet[i][key].distanceTo(b.feet[i][key])<1e-8);
      }
      low.root.position.set(2,mode==='climb'?y:.3,-1);low.root.rotation.y=Math.PI;low.root.updateMatrixWorld(true);
      for(const [bone,{vertex,local}]of vertices){
        const rendered=mesh.getVertexPosition(vertex,new THREE.Vector3()).applyMatrix4(mesh.matrixWorld);
        const expected=local.clone().applyMatrix4(bones[bone].matrixWorld);
        assert.ok(rendered.distanceTo(expected)<1e-6,`${mode}: visible part must follow its joint`);
      }
      if(mode==='climb')for(const arm of low.arms){
        const contact=droidLadderContact(y,arm.side,true),grip=arm.palm.ladderGrip.getWorldPosition(new THREE.Vector3());
        if(contact.held)assert.ok(Math.abs(grip.y-(.12+contact.rung*.28))<1e-6,'hand stays on the fixed rung');
      }
    }
  }finally{low.dispose();detailed.dispose();}
});

test('the lightweight outline shares the animated skeleton and releases only its own resources',()=>{
  const droid=createDroid({detail:'obs'}),geometry=droid.skin.mesh.geometry;
  const room=new THREE.Group(),actor=new THREE.Group(),fixture=new THREE.Mesh(new THREE.BoxGeometry(1,1,1),new THREE.MeshStandardMaterial());
  actor.add(droid.root);room.add(actor,fixture);
  const effect=createCabinToon([room]);
  try{
    effect.setStyle('cartoon');effect.update(800,600,2,10);
    const shell=droid.root.children.find(o=>o.name==='Cabin toon outline');assert.ok(shell?.isSkinnedMesh);assert.equal(shell.skeleton,droid.skin.skeleton);assert.equal(shell.geometry,geometry);
    const fixtureShell=room.children.find(o=>o.name==='Cabin toon outline');
    assert.equal(shell.material.uniforms.width.value,1.2);assert.equal(fixtureShell.material.uniforms.width.value,1);
    droid.update(1.16,'walk');droid.root.updateMatrixWorld(true);
    for(const i of [0,900,4500])assert.ok(shell.getVertexPosition(i,new THREE.Vector3()).distanceTo(droid.skin.mesh.getVertexPosition(i,new THREE.Vector3()))<1e-8);
    effect.setStyle('flat');assert.equal(shell.visible,false);effect.setStyle('cartoon');effect.update(1200,900,10,10);
    assert.equal(shell.visible,true,'the droid keeps its character outline at full view');assert.equal(shell.material.uniforms.width.value,1.2);
    assert.deepEqual(shell.material.uniforms.viewport.value.toArray(),[1200,900]);assert.equal(fixtureShell.visible,false,'the cabin still fades to zero at full view');
    effect.setStyle('current');assert.equal(shell.visible,false);
    let disposed=false,inkDisposed=false;geometry.addEventListener('dispose',()=>disposed=true);shell.material.addEventListener('dispose',()=>inkDisposed=true);
    effect.dispose();assert.equal(disposed,false);assert.equal(inkDisposed,true);assert.equal(shell.parent,null);
  }finally{droid.dispose();fixture.geometry.dispose();fixture.material.dispose();}
});
