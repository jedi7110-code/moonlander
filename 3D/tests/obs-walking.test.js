import test from 'node:test';
import assert from 'node:assert/strict';
import {MeshStandardMaterial,Vector3,Box3} from 'three';
import {createMilo,animateMilo} from '../src/obs/characters.js';
import {WALK,walkingFoot} from '../src/obs/walking.js';
import {CrewMotion,FLOORS} from '../src/obs/state.js';

const character=()=>createMilo(new Proxy({},{get:()=>new MeshStandardMaterial()}));
function pose(root,distance,facing=1,more={}){
  root.position.set(facing*distance,0,0);root.rotation.y=facing*Math.PI/2;
  animateMilo(root,{moving:true,climbing:false,facing,walkDistance:distance,time:10,action:null,...more});root.updateMatrixWorld(true);
}

test('a planted foot stays fixed on the floor while the body moves in either direction',()=>{
  const root=character();
  for(const direction of [-1,1])for(const leg of root.userData.legs){
    let previous=null;
    for(let frame=0;frame<=240;frame++){
      const distance=frame/240*WALK.cycleDistance,foot=walkingFoot(distance,leg.side);
      pose(root,distance,direction);
      const expected=new Vector3(leg.side*.100,foot.y,foot.z);
      root.localToWorld(expected);
      assert.ok(leg.boot.getWorldPosition(new Vector3()).distanceTo(expected)<1e-6,'the leg can reach the prescribed ankle position');
      if(foot.phase>.10&&foot.phase<.44){
        const sole=leg.boot.localToWorld(new Vector3(0,-.107,0));
        assert.ok(Math.abs(sole.y-WALK.floor)<1e-6);
        if(previous)assert.ok(sole.distanceTo(previous)<1e-6,'the supporting foot must not slide');
        previous=sole;
      }else previous=null;
    }
  }
});

test('the swing bends the knee and lifts the whole boot, with heel strike and toe-off',()=>{
  const root=character();let maxLift=0,maxKnee=0;
  for(let frame=0;frame<=240;frame++){
    const distance=frame/240*WALK.cycleDistance;pose(root,distance);
    for(const {boot,knee,side}of root.userData.legs){
      const foot=walkingFoot(distance,side),bounds=new Box3().setFromObject(boot);
      assert.ok(bounds.min.y>-.002,`boot penetrates the floor at phase ${foot.phase}`);
      if(!foot.planted){maxLift=Math.max(maxLift,bounds.min.y);maxKnee=Math.max(maxKnee,knee.rotation.x);}
    }
  }
  assert.ok(maxLift>.12);assert.ok(maxKnee>.85);
  assert.ok(walkingFoot(0,1).pitch<0);assert.ok(walkingFoot(WALK.cycleDistance*.59,1).pitch>.3);
});

test('foot trajectories have no jumps at lift-off or the cycle boundary',()=>{
  for(const boundary of [WALK.stance,1]){
    const before=walkingFoot((boundary-1e-7)*WALK.cycleDistance,1),after=walkingFoot((boundary+1e-7)*WALK.cycleDistance,1);
    assert.ok(Math.hypot(before.y-after.y,before.z-after.z)<1e-5);assert.ok(Math.abs(before.pitch-after.pitch)<1e-5);
  }
});

test('the scanned neck base follows chest lean and counter-rotation throughout a walk',()=>{
  const root=character(),{head,chest}=root.userData;
  for(const facing of [-1,1])for(let frame=0;frame<=120;frame++){
    pose(root,frame/120*WALK.cycleDistance,facing);
    const scanBase=new Vector3(0,-.030,.009).applyQuaternion(head.quaternion).add(head.position);
    const torsoBase=new Vector3(0,1.607,0).applyMatrix4(chest.matrix);
    assert.ok(scanBase.distanceTo(torsoBase)<1e-9,'the neck attachment cannot drift away from the torso');
  }
  animateMilo(root,{time:0,moving:false,climbing:false,facing:1,action:null});
  assert.deepEqual(head.position.toArray(),[0,1.637,-.009]);
});

test('walking turns both palms inward by a quarter turn, with thumbs leading the fingers',()=>{
  const root=character();
  for(const facing of [-1,1])for(let frame=0;frame<=120;frame++){
    pose(root,frame/120*WALK.cycleDistance,facing);
    const forward=new Vector3(0,0,1).applyQuaternion(root.quaternion);
    for(const {hand,thumb,side}of root.userData.arms){
      assert.equal(hand.rotation.y,side*Math.PI/2);
      const wrist=hand.getWorldPosition(new Vector3());
      const palm=hand.localToWorld(new Vector3(0,0,-1)).sub(wrist).normalize();
      const inward=new Vector3(-side,0,0).applyQuaternion(root.quaternion);
      assert.ok(palm.dot(inward)>.999,'palms face the body on either travel direction');
      assert.ok(thumb.getWorldPosition(new Vector3()).sub(wrist).dot(forward)>0,'thumbs point toward the direction of travel');
    }
  }
});

test('the walking wrist turn does not leak into idle, climbing or station poses',()=>{
  const root=character(),fresh=character(),snapshot=actor=>actor.userData.arms.map(({hand})=>hand.quaternion.toArray());
  for(const extra of [{},{moving:true,climbing:true},{waiting:true,moving:true},{action:'console'},{action:'gym'},{action:'hydro'},{action:'galley'},{action:'bunk'},{action:'medical'}]){
    pose(root,.27);
    const options={time:3,moving:false,climbing:false,facing:1,action:null,actionTime:3,actionDuration:20,...extra};
    animateMilo(root,options);animateMilo(fresh,options);
    assert.deepEqual(snapshot(root),snapshot(fresh));
  }
});

test('gait follows distance, not elapsed time, and action poses reset it',()=>{
  const root=character();pose(root,.2);const capture=()=>root.userData.legs.flatMap(({leg,knee,boot})=>[...leg.rotation.toArray(),...knee.rotation.toArray(),...boot.rotation.toArray()]);
  const first=capture();pose(root,.2,1,{time:90});assert.deepEqual(capture(),first);
  pose(root,.4);assert.notDeepEqual(capture(),first);
  pose(root,.4,1,{moving:false,action:'hydro',actionTime:2,actionDuration:5});
  for(const {leg,knee,boot}of root.userData.legs)assert.deepEqual([leg.rotation.x,knee.rotation.x,boot.rotation.x],[0,0,0]);
  assert.equal(root.userData.dining.mug.visible,true);
});

test('travel distance counts only actual horizontal travel, including slower walking and retargeting',()=>{
  const actor=new CrewMotion({floor:1,x:700});actor.goTo({floor:1,x:760});actor.update(1);assert.equal(actor.walkDistance,54);
  actor.update(1);assert.equal(actor.walkDistance,60);actor.update(5);assert.equal(actor.walkDistance,60);
  actor.walkSpeed=27;actor.goTo({floor:1,x:700});actor.update(1);assert.equal(actor.walkDistance,87);
  actor.update(0);assert.equal(actor.walkDistance,87);
  actor.update(2);assert.equal(actor.walkDistance,120);
  actor.goTo({floor:0,x:700});actor.update(1);assert.notEqual(actor.y,FLOORS[1].y);assert.equal(actor.walkDistance,120);
});
