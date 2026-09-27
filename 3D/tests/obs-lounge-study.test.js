import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Group,MeshStandardMaterial,Vector3,Quaternion,Box3} from 'three';
import {loadMiloBody} from '../src/obs/milo-body.js';
import {LOUNGE_STUDY_DURATION,LOUNGE_STUDY_PHASES,sampleLoungeStudy,createLoungeStudyActors,applyLoungeStudy} from '../studies/milo/lounge-model.js';
import {loungePassageFeet,LOUNGE_ENTRY_SECONDS} from '../src/obs/lounge-exit.js';

await loadMiloBody('data:application/json;base64,'+(await readFile(new URL('../public/assets/obs/milo/body.json',import.meta.url))).toString('base64'));
function setup(){
  const material=new MeshStandardMaterial(),actors=createLoungeStudyActors(new Proxy({},{get:()=>material}),new Group());
  new Group().add(actors.milo,actors.furniture);return actors;
}
function snapshot(actors){
  const nodes=[actors.milo.userData.body,...actors.milo.userData.arms.flatMap(r=>[r.arm,r.elbow,r.hand]),...Object.values(actors.furniture.userData.loungeProps)];
  return nodes.map(n=>({position:n.getWorldPosition(new Vector3()),rotation:n.getWorldQuaternion(new Quaternion())}));
}

test('the study exposes sitting, pickup, use, return and standing in order',()=>{
  for(const phase of LOUNGE_STUDY_PHASES)assert.equal(sampleLoungeStudy('tablet',phase.time).phase.id,phase.id);
  assert.equal(sampleLoungeStudy('tablet',-9).time,0);
  assert.equal(sampleLoungeStudy('unknown',NaN).leisure,'tablet');
  assert.equal(sampleLoungeStudy('music',999).time,LOUNGE_STUDY_DURATION);
  assert.equal(sampleLoungeStudy('music',999).leisure,null);
});

test('scrubbing backwards and switching objects reproduce the same joints and props without hiding anything',()=>{
  const actors=setup(),times=[...LOUNGE_STUDY_PHASES.map(p=>p.time),LOUNGE_STUDY_DURATION],references={};
  for(const item of ['tablet','music','cat']){
    references[item]=times.map(t=>{applyLoungeStudy(actors,item,t);return snapshot(actors);});
  }
  for(const item of ['cat','tablet','music'])for(const i of [7,6,2,5,0,4,1,3]){
    applyLoungeStudy(actors,item,times[i]);
    snapshot(actors).forEach((actual,j)=>{
      assert.ok(actual.position.distanceTo(references[item][i][j].position)<1e-7);
      assert.ok(actual.rotation.angleTo(references[item][i][j].rotation)<1e-7);
    });
    for(const key of ['tablet','phones','toy']){
      assert.equal(actors.furniture.userData.loungeProps[key].visible,true);
      assert.equal(actors.milo.userData.leisure[key].visible,false);
    }
  }
});

test('every reviewed item is back at its original place before standing begins',()=>{
  const actors=setup();applyLoungeStudy(actors,'tablet',0);
  const homes=Object.values(actors.furniture.userData.loungeProps).map(p=>p.getWorldPosition(new Vector3()));
  for(const item of ['tablet','music','cat']){
    applyLoungeStudy(actors,item,LOUNGE_STUDY_PHASES.find(p=>p.id==='use').time);
    applyLoungeStudy(actors,item,LOUNGE_STUDY_PHASES.find(p=>p.id==='stand').time);
    Object.values(actors.furniture.userData.loungeProps).forEach((p,i)=>assert.ok(p.getWorldPosition(new Vector3()).distanceTo(homes[i])<1e-8));
  }
});

test('entry and departure keep the palms facing the thighs instead of untwisting the wrists',()=>{
  const actors=setup();
  for(const item of ['tablet','music','cat'])for(const time of [4.71,23.71]){
    applyLoungeStudy(actors,item,time);
    for(const {hand,side} of actors.milo.userData.arms){
      const palm=new Vector3(0,0,-1).applyQuaternion(hand.quaternion);
      assert.ok(palm.dot(new Vector3(-side,0,0))>.99,'relaxed hands retain the normal palms-in roll');
    }
  }
});

test('the visible wrist surface never flips as the hands roll through pickup, use and return',()=>{
  const actors=setup(),skin=actors.milo.userData.bodySkin;
  const {position,armRegion}=skin.geometry.attributes,vertices=[];
  // Track the same real vertices even when the tablet grip changes geometry.
  for(let i=0;i<position.count;i++)if(position.getY(i)>.924&&position.getY(i)<1.07&&armRegion.getX(i)>.95)vertices.push(i);
  assert.ok(vertices.length>100);
  for(const item of ['tablet','music','cat']){
    let previous=null;
    for(let frame=0;frame<=LOUNGE_STUDY_DURATION*60;frame++){
      const time=frame/60;applyLoungeStudy(actors,item,time);skin.skeleton.update();
      const points=vertices.map(i=>skin.applyBoneTransform(i,new Vector3().fromBufferAttribute(skin.geometry.attributes.position,i)).applyMatrix4(skin.matrixWorld));
      if(previous)points.forEach((p,i)=>assert.ok(p.distanceTo(previous[i])<.035,`${item}: wrist skin jumps at ${time}`));
      previous=points;
    }
  }
});

test('entry and exit keep the actual trouser mesh outside the close tabletop',()=>{
  const actors=setup(),skin=actors.milo.userData.bodySkin;
  actors.furniture.updateMatrixWorld(true);
  const tabletop=new Box3().setFromObject(actors.furniture.getObjectByName('Tabletop'));
  const {position,skinIndex,skinWeight}=skin.geometry.attributes,vertices=[];
  for(let i=0;i<position.count;i++){
    let weight=-1,bone;
    for(let j=0;j<4;j++)if(skinWeight.array[i*4+j]>weight){weight=skinWeight.array[i*4+j];bone=skin.skeleton.bones[skinIndex.array[i*4+j]].name;}
    if(/leg|knee|hips/.test(bone))vertices.push(i);
  }
  let closest=Infinity;
  for(let frame=0;frame<=LOUNGE_STUDY_DURATION*30;frame++){
    const sample=applyLoungeStudy(actors,'tablet',frame/30);
    if(!sample.entry&&!sample.exit)continue;
    skin.skeleton.update();
    for(const i of vertices){
      const point=skin.applyBoneTransform(i,new Vector3().fromBufferAttribute(position,i)).applyMatrix4(skin.matrixWorld);
      assert.equal(tabletop.containsPoint(point),false,`trousers enter the tabletop at ${sample.time}`);
      if(point.y>tabletop.min.y&&point.y<tabletop.max.y&&point.x>tabletop.min.x&&point.x<tabletop.max.x)closest=Math.min(closest,tabletop.min.z-point.z);
    }
  }
  assert.ok(closest>0&&closest<.025,`keep the requested close fit, clearance=${closest}`);
});

test('sideways entry and departure plant one foot while the other steps, without crossing boots',()=>{
  const actors=setup(),stand=LOUNGE_STUDY_PHASES.find(p=>p.id==='stand').time;
  for(const entering of [true,false])for(let frame=0;frame<=300;frame++){
    const age=2.2+frame/60,time=entering?LOUNGE_ENTRY_SECONDS-age:stand+age;
    applyLoungeStudy(actors,'tablet',time);
    const feet=actors.milo.userData.legs.map(r=>r.boot.getWorldPosition(new Vector3()));
    const planned=loungePassageFeet(age).feet;
    feet.forEach((p,i)=>assert.ok(p.distanceTo(planned[i].position)<.001));
    assert.ok(Math.min(...feet.map(p=>p.y))<.111,'at least one foot stays planted');
    assert.ok(feet[1].x-feet[0].x>.19,'boots do not cross in the narrow gap');
  }
});
