import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createDroid,DROID_SPEC,DROID_EXPRESSIONS,droidFootstep} from '../studies/droid/droid-model.js';

test('droid has a smaller expression head and complete finite three-dimensional geometry',()=>{
  const droid=createDroid();
  try{
    assert.equal(droid.face.eyes.length,2);
    const headSize=new THREE.Box3().setFromObject(droid.head).getSize(new THREE.Vector3());
    assert.ok(headSize.x<.315&&headSize.x>.26,'head must be narrower than the previous 0.35 m assembly');
    assert.ok(headSize.z<.36,'projecting visor and rear wiring must stay within the head envelope');
    const box=new THREE.Box3().setFromObject(droid.root),size=box.getSize(new THREE.Vector3());
    assert.ok(box.min.y>=-.001);assert.ok(Math.abs(size.y-DROID_SPEC.height)<.04);assert.ok(size.z>.25);
    droid.root.traverse(o=>{if(o.geometry)for(const name of ['position','normal']){const attribute=o.geometry.getAttribute(name);assert.ok(attribute);for(const value of attribute.array)assert.ok(Number.isFinite(value));}});
  }finally{droid.dispose();}
});

test('all six expressions replace each other and survive motion updates without rebuilding geometry',()=>{
  const droid=createDroid();
  try{
    const geometryIds=()=>{const ids=[];droid.head.traverse(o=>{if(o.geometry)ids.push(o.geometry.uuid);});return ids;};
    const original=geometryIds();
    assert.equal(Object.keys(DROID_EXPRESSIONS).length,6);
    for(const name of Object.keys(DROID_EXPRESSIONS)){
      assert.equal(droid.face.setExpression(name),true);droid.update(1.16,'walk');
      assert.equal(droid.face.expression,name);
      assert.deepEqual(Object.entries(droid.face.expressions).filter(([,group])=>group.visible).map(([key])=>key),[name]);
      assert.deepEqual(geometryIds(),original);
    }
    assert.equal(droid.face.setExpression('invalid'),false);assert.equal(droid.face.expression,'sleepy');
  }finally{droid.dispose();}
});

test('relaxed hands face the body with thumbs forward after narrowing the shoulders',()=>{
  const droid=createDroid();
  try{
    for(const mode of ['idle','walk'])for(const time of [0,.7,1.16,4.9]){
      const pose=droid.update(time,mode);
      assert.ok(Math.abs(pose.hands[0].shoulder.x-pose.hands[1].shoulder.x)<.37);
      for(const arm of droid.arms){
        const palmNormal=new THREE.Vector3(0,0,1).applyQuaternion(arm.palm.root.quaternion);
        assert.ok(palmNormal.dot(new THREE.Vector3(-arm.side,0,0))>.99);
        const thumbOffset=arm.palm.thumb.position.clone().applyQuaternion(arm.palm.root.quaternion);
        assert.ok(thumbOffset.z>.035,'thumb must point forward rather than behind the hand');
      }
    }
    droid.update(0,'idle');
    const headBottom=new THREE.Box3().setFromObject(droid.head).min.y;
    const shoulderY=droid.arms[0].upper.getWorldPosition(new THREE.Vector3()).y;
    assert.ok(headBottom-shoulderY>.055&&headBottom-shoulderY<.11,'short neck must still clear the shoulder frame');
  }finally{droid.dispose();}
});

test('walking keeps all three leg links attached at fixed lengths with planted stance feet',()=>{
  const droid=createDroid();let swings=0,stances=0;
  try{
    for(let t=0;t<18;t+=.035){
      const pose=droid.update(t,'walk');
      for(const foot of pose.feet){
        assert.ok(Math.abs(foot.hip.distanceTo(foot.knee)-DROID_SPEC.upperLeg)<1e-7);
        assert.ok(Math.abs(foot.knee.distanceTo(foot.hock)-DROID_SPEC.middleLeg)<1e-7);
        assert.ok(Math.abs(foot.hock.distanceTo(foot.local)-DROID_SPEC.lowerLeg)<1e-7);
        assert.ok(foot.point.y>=.099-1e-9);
        if(foot.stance)stances++;else swings++;
      }
      for(const hand of pose.hands){assert.ok(Math.abs(hand.shoulder.distanceTo(hand.elbow)-DROID_SPEC.upperArm)<1e-7);assert.ok(Math.abs(hand.elbow.distanceTo(hand.wrist)-DROID_SPEC.forearm)<1e-7);}
      for(const leg of droid.legs){
        const q=leg.foot.getWorldQuaternion(new THREE.Quaternion());assert.ok(new THREE.Vector3(0,1,0).applyQuaternion(q).distanceTo(new THREE.Vector3(0,1,0))<1e-7);
        for(const [part,length,next]of [[leg.upper,DROID_SPEC.upperLeg,leg.middle],[leg.middle,DROID_SPEC.middleLeg,leg.lower],[leg.lower,DROID_SPEC.lowerLeg,leg.foot]]){
          const end=part.localToWorld(new THREE.Vector3(0,-length,0));
          assert.ok(end.distanceTo(next.getWorldPosition(new THREE.Vector3()))<1e-7);
        }
      }
      for(const p of droid.actuators){
        assert.ok(p.a.getWorldPosition(new THREE.Vector3()).distanceTo(p.housing.localToWorld(new THREE.Vector3(0,-.5,0)))<1e-7);
        assert.ok(p.b.getWorldPosition(new THREE.Vector3()).distanceTo(p.shaft.localToWorld(new THREE.Vector3(0,.5,0)))<1e-7);
      }
    }
    assert.ok(swings>100&&stances>100);
    for(const side of [-1,1]){
      const a=droidFootstep(1.5,side),b=droidFootstep(1.55,side);assert.ok(a.stance&&b.stance);assert.ok(a.point.distanceTo(b.point)<1e-9);
    }
  }finally{droid.dispose();}
});

test('standing and carrying retain the forward thigh and separate rearward joint in the reference',()=>{
  const droid=createDroid();
  try{
    for(const mode of ['idle','carry'])for(const foot of droid.update(0,mode).feet){
      assert.ok(foot.knee.z>foot.hip.z+.10,'thigh must lean forward');
      assert.ok(foot.knee.z>foot.hock.z+.15,'middle link must fold back');
      assert.ok(foot.hock.z<foot.local.z-.09,'shin must return toward the foot');
      assert.ok(foot.hip.y>foot.knee.y&&foot.knee.y>foot.hock.y&&foot.hock.y>foot.local.y);
    }
  }finally{droid.dispose();}
});

test('both palms meet the level tray and actuators stay connected when seeking',()=>{
  const droid=createDroid(),v=()=>new THREE.Vector3();
  try{
    for(const time of [0,2,11,19,0]){
      droid.update(time,'carry');assert.ok(droid.tray.visible);
      for(const arm of droid.arms){
        const handle=droid.tray.localToWorld(new THREE.Vector3(arm.side*.283,.034,0));
        assert.ok(handle.distanceTo(arm.palm.grip.getWorldPosition(v()))<1e-7);
      }
      for(const p of droid.actuators){
        const a=p.a.getWorldPosition(v()),b=p.b.getWorldPosition(v());
        const housingStart=p.housing.localToWorld(new THREE.Vector3(0,-.5,0));
        const shaftEnd=p.shaft.localToWorld(new THREE.Vector3(0,.5,0));
        assert.ok(a.distanceTo(housingStart)<1e-7);assert.ok(b.distanceTo(shaftEnd)<1e-7);
      }
      assert.ok(droid.tray.getWorldQuaternion(new THREE.Quaternion()).angleTo(new THREE.Quaternion())<1e-7);
    }
    droid.update(0,'idle');assert.equal(droid.tray.visible,false);
  }finally{droid.dispose();}
});
