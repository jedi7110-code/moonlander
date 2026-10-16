import test from 'node:test';
import assert from 'node:assert/strict';
import {PerspectiveCamera,Scene,Vector3} from 'three';
import {createSpaceStars,createCutawayStars} from '../src/obs/space-stars.js';
import {HABITAT_ROTATION,CABIN_SKY_ROTATION,cabinSkyAngle} from '../src/obs/habitat-rotation.js';
import {EXTERIOR,exteriorAngle} from '../src/obs/exterior-mothership.js';

const renderer={getPixelRatio:()=>1.5};
test('the cabin sky eases the physical counter-rotation to 60 percent for window viewing',()=>{
  assert.ok(Math.abs(EXTERIOR.rpm-HABITAT_ROTATION.rpm)<1e-12);
  assert.ok(HABITAT_ROTATION.periodSeconds>11&&HABITAT_ROTATION.periodSeconds<12);
  assert.ok(CABIN_SKY_ROTATION.periodSeconds>18&&CABIN_SKY_ROTATION.periodSeconds<19);
  for(const seconds of [0,.5,3,7])assert.ok(Math.abs(cabinSkyAngle(seconds)+exteriorAngle(seconds)*.6)<1e-12);
  assert.ok(Math.abs(cabinSkyAngle(CABIN_SKY_ROTATION.periodSeconds))<1e-12);
});

test('all window sides and the cutaway use the same seamless full-sphere stars and paused simulation time',()=>{
  const front=createSpaceStars({rotating:true}),rear=createSpaceStars({rear:true,rotating:true}),cutaway=createCutawayStars({rotating:true});
  const fields=[front,rear,cutaway],scene=new Scene(),camera=new PerspectiveCamera(70,1,.025,150);
  scene.add(...fields);camera.position.set(1,5,0);camera.updateMatrixWorld(true);
  const sample=(field,seconds)=>{
    scene.userData.cabinSkySeconds=seconds;field.onBeforeRender(renderer,scene,camera);
    return field.localToWorld(new Vector3().fromBufferAttribute(field.geometry.attributes.position,70)).sub(camera.position);
  };
  try{
    assert.equal(front.geometry.attributes.position.count,6000);
    assert.deepEqual(front.geometry.attributes.position.array,rear.geometry.attributes.position.array);
    assert.deepEqual(front.geometry.attributes.position.array,cutaway.geometry.attributes.position.array);
    const vertices=front.geometry.attributes.position.array,start=sample(front,0);
    assert.ok(start.distanceTo(sample(front,1))>1,'one second moves visible star directions');
    for(const seconds of [0,1,CABIN_SKY_ROTATION.periodSeconds-.0000001,CABIN_SKY_ROTATION.periodSeconds,CABIN_SKY_ROTATION.periodSeconds+.0000001]){
      const a=sample(front,seconds);
      for(const field of fields)assert.ok(a.distanceTo(sample(field,seconds))<1e-10,'windows and mirror/XR render passes share the same phase');
    }
    assert.ok(start.distanceTo(sample(front,CABIN_SKY_ROTATION.periodSeconds))<1e-10);
    assert.ok(sample(front,CABIN_SKY_ROTATION.periodSeconds-1e-8).distanceTo(sample(front,CABIN_SKY_ROTATION.periodSeconds+1e-8))<1e-5,'the loop boundary is continuous');
    const paused=sample(front,2);assert.ok(paused.distanceTo(sample(front,2))<1e-10);
    camera.position.set(-8,2,-1);camera.updateMatrixWorld(true);
    assert.ok(paused.distanceTo(sample(front,2))<1e-10,'walking cannot create nearby star parallax');
    assert.equal(front.geometry.attributes.position.array,vertices,'no catalogue rebuild or GPU buffer upload during rotation');
    assert.ok(front.geometry.drawRange.count>=6000,'fixed-hemisphere culling must not delete stars during a turn');
  }finally{fields.forEach(field=>{field.geometry.dispose();field.material.dispose();});}
});
