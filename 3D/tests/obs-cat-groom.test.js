import test from 'node:test';
import assert from 'node:assert/strict';
import {Box3,MeshStandardMaterial,Vector3} from 'three';
import {createCat,animateCat} from '../src/obs/characters.js';
import {groomingSequence} from '../src/obs/cat-groom.js';
import {CatRoutine,Supplies} from '../src/obs/state.js';
import {CAT_BOWL} from '../src/obs/layout.js';

const makeCat=()=>{const material=new MeshStandardMaterial();return createCat(new Proxy({},{get:()=>material}));};
function poseAt(root,until,facing=1){
  root.rotation.y=facing*Math.PI/2;
  for(let i=0;i<=Math.round(until*60);i++)animateCat(root,{time:i/60,actionTime:i/60,remaining:16-i/60,mode:'groom',moving:false,facing});
  root.updateMatrixWorld(true);
}
test('grooming alternates paw licking, face wiping and shoulder licking with quiet transitions',()=>{
  assert.equal(groomingSequence(1.8).lick,1);assert.equal(groomingSequence(3.8).wipe,1);
  assert.equal(groomingSequence(7).flank,1);
  for(const time of [0,5.5,9.4,9.6]){
    const pose=groomingSequence(time);assert.equal(pose.lick+pose.wipe+pose.flank,0);
  }
});
test('the visible forepaw rises, supporting paws stay grounded, and the neck turns to the shoulder',()=>{
  for(const facing of [-1,1]){
    const root=makeCat();poseAt(root,1.8,facing);
    const data=root.userData,raised=data.legs.find(leg=>!leg.rear&&leg.side===-facing);
    const first=raised.paw.getWorldPosition(new Vector3());assert.ok(first.y>.24);
    for(const leg of data.legs.filter(leg=>leg!==raised)){
      const bounds=new Box3().setFromObject(leg.foot);assert.ok(bounds.min.y>-.009&&bounds.min.y<.02,`support at ${bounds.min.y}`);
    }
    poseAt(root,3.6,facing);const second=raised.paw.getWorldPosition(new Vector3());assert.ok(first.distanceTo(second)>.035);
    poseAt(root,7,facing);assert.ok(Math.abs(data.neck.rotation.y)>1.9);
    for(const leg of data.legs){
      const bounds=new Box3().setFromObject(leg.foot);assert.ok(bounds.min.y>-.009&&bounds.min.y<.02);
    }
    const bounds=new Box3().setFromObject(root);assert.ok(bounds.max.y<.9);assert.ok(bounds.min.y>-.012);
  }
});
test('paused grooming is stable and interrupted grooming releases all altered joints',()=>{
  const root=makeCat();poseAt(root,3.6);
  const snapshot=()=>[...root.userData.neck.quaternion.toArray(),...root.userData.body.position.toArray(),...root.userData.legs.flatMap(({hip,knee,foot})=>[...hip.quaternion.toArray(),...knee.quaternion.toArray(),...foot.quaternion.toArray()]),...root.userData.tail.geometry.attributes.position.array];
  const before=snapshot();animateCat(root,{time:3.6,actionTime:3.6,remaining:12.4,mode:'groom',moving:false,facing:1});assert.deepEqual(snapshot(),before);
  for(let i=1;i<90;i++)animateCat(root,{time:3.6+i/60,actionTime:i/60,mode:'fetch',moving:true,facing:1});
  assert.equal(root.userData.groom.weight,0);assert.equal(root.userData.neck.rotation.y,0);assert.equal(root.userData.tongue.visible,false);
  for(const {hip,ankle,foot}of root.userData.legs){assert.equal(hip.rotation.y,0);assert.ok(Number.isFinite(ankle.rotation.x));assert.ok(Math.abs(foot.rotation.z)<1e-9);}
  animateCat(root,{time:6,mode:'eat',moving:false,facing:-1});assert.equal(root.userData.neck.position.y,.299);
});
test('entering a cat passage overrides grooming and preserves its low-clearance pose',()=>{
  const root=makeCat();poseAt(root,2);
  animateCat(root,{time:2.02,mode:'groom',moving:false,facing:1,passage:{yaw:Math.PI,crouch:1,phase:'turnIn'}});
  assert.equal(root.userData.groom.weight,0);assert.equal(root.userData.body.scale.y,.86);assert.equal(root.userData.tongue.visible,false);
});
test('every rest starts its own animation clock; feeding and pause keep the routine coherent',()=>{
  const cat=new CatRoutine(new Supplies());cat.rest('groom',16);cat.update(2);assert.equal(cat.modeTime,2);
  cat.update(0);assert.equal(cat.modeTime,2);cat.fetch();assert.equal(cat.modeTime,0);
  for(let i=0;i<45*60&&cat.mode!=='eat';i++)cat.update(1/60);
  assert.equal(cat.mode,'eat');assert.equal(cat.modeTime,0);assert.equal(cat.motion.x,CAT_BOWL.approachX);
  for(let i=0;i<9*60&&cat.mode!=='groom';i++)cat.update(1/60);
  assert.equal(cat.mode,'groom');assert.equal(cat.modeTime,0);assert.equal(cat.remaining,7);
});
