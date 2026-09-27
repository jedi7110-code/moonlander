import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Group,MeshStandardMaterial,Vector3} from 'three';
import {loadMiloBody} from '../src/obs/milo-body.js';
import {animateMilo} from '../src/obs/characters.js';
import {createLoungeStudyActors,applyLoungeStudy,LOUNGE_STUDY_PHASES} from '../studies/milo/lounge-model.js';

await loadMiloBody('data:application/json;base64,'+(await readFile(new URL('../public/assets/obs/milo/body.json',import.meta.url))).toString('base64'));
function setup(){const material=new MeshStandardMaterial(),actors=createLoungeStudyActors(new Proxy({},{get:()=>material}),new Group());new Group().add(actors.milo,actors.furniture);return actors;}
function backProfile(root){
  const {body,bodySkin:skin}=root.userData,{position,armRegion}=skin.geometry.attributes;skin.skeleton.update();
  return[1.02,1.13,1.24,1.35,1.46].map(height=>{
    const mean=new Vector3();let count=0;
    for(let i=0;i<position.count;i++)if(Math.abs(position.getX(i))<.05&&Math.abs(position.getY(i)-height)<.025&&position.getZ(i)<-.05&&armRegion.getX(i)<.1){
      mean.add(body.worldToLocal(skin.applyBoneTransform(i,new Vector3().fromBufferAttribute(position,i)).applyMatrix4(skin.matrixWorld)));count++;
    }
    assert.ok(count>5);return mean.divideScalar(count);
  });
}
test('the actual back rounds behind the pelvis-to-shoulder line when reaching for the table',()=>{
  const actors=setup(),take=LOUNGE_STUDY_PHASES.find(p=>p.id==='take').time;
  for(const item of ['tablet','music','cat']){
    applyLoungeStudy(actors,item,take+1.1);const profile=backProfile(actors.milo),first=profile[0],last=profile.at(-1);
    for(const point of profile.slice(1,-1)){
      const straight=first.z+(last.z-first.z)*(point.y-first.y)/(last.y-first.y);
      assert.ok(point.z<straight-.012,`${item}: mid-back must round outward instead of arching inward`);
    }
  }
});
test('reading returns upright and brings the tablet closer and higher while leaving the hips on the seat',()=>{
  const actors=setup(),take=LOUNGE_STUDY_PHASES.find(p=>p.id==='take').time;
  applyLoungeStudy(actors,'tablet',take+1.1);const bent=backProfile(actors.milo),hipY=actors.milo.userData.hips.getWorldPosition(new Vector3()).y;
  applyLoungeStudy(actors,'tablet',LOUNGE_STUDY_PHASES.find(p=>p.id==='use').time);
  const profile=backProfile(actors.milo),slope=p=>(p.at(-1).z-p[0].z)/(p.at(-1).y-p[0].y);
  assert.ok(slope(profile)<.17&&slope(profile)<slope(bent)/2);
  assert.ok(Math.abs(actors.milo.userData.hips.getWorldPosition(new Vector3()).y-hipY)<1e-8);
  const tablet=actors.milo.userData.body.worldToLocal(actors.furniture.userData.loungeProps.tablet.getWorldPosition(new Vector3()));
  assert.ok(tablet.y>1.40&&tablet.z<.40);
});
test('walking and other activities restore the uncurled torso without leaving a lounge deformation',()=>{
  const actors=setup();
  for(const action of [null,'console','gym','bunk','medical']){
    applyLoungeStudy(actors,'tablet',9.1);
    animateMilo(actors.milo,{action,moving:action===null,time:1,actionTime:1,actionDuration:40,facing:1});
    assert.equal(actors.milo.userData.spineCurve,null);
    const {spine,chest}=actors.milo.userData;
    for(const driver of spine.drivers){assert.ok(driver.position.distanceTo(chest.position)<1e-9);assert.ok(driver.quaternion.angleTo(chest.quaternion)<1e-7);}
  }
});
