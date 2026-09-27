import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Group,MeshStandardMaterial,Vector3,Quaternion,Box3} from 'three';
import {loadMiloBody} from '../src/obs/milo-body.js';
import {createLoungeStudyActors,applyLoungeStudy} from '../studies/milo/lounge-model.js';

await loadMiloBody('data:application/json;base64,'+(await readFile(new URL('../public/assets/obs/milo/body.json',import.meta.url))).toString('base64'));
function setup(){
  const material=new MeshStandardMaterial(),actors=createLoungeStudyActors(new Proxy({},{get:()=>material}),new Group());
  new Group().add(actors.milo,actors.furniture);
  return actors;
}
function handPoints(actors,space=null){
  const skin=actors.milo.userData.bodySkin,{position,armRegion,skinIndex,skinWeight}=skin.geometry.attributes;
  skin.skeleton.update();const result=[];
  for(let i=0;i<position.count;i++){
    if(position.getX(i)>0||position.getY(i)>.925||armRegion.getX(i)<.95)continue;
    const point=skin.getVertexPosition(i,new Vector3()).applyMatrix4(skin.matrixWorld);
    if(space)space.worldToLocal(point);
    let weight=-1,name='';
    for(let k=0;k<4;k++)if(skinWeight.array[i*4+k]>weight){weight=skinWeight.array[i*4+k];name=skin.skeleton.bones[skinIndex.array[i*4+k]].name;}
    result.push({point,part:name.includes('thumb')?'thumb':name.includes('finger')?'finger':'palm',finger:name.match(/finger(\d)/)?.[1]});
  }
  return result;
}

test('the real grabbing hand clears the tabletop during the whole pickup and return',()=>{
  const actors=setup();actors.furniture.updateMatrixWorld(true);
  const table=new Box3().setFromObject(actors.furniture.getObjectByName('Tabletop'));
  for(const time of [9.05,...Array.from({length:331},(_,i)=>8+i/30)]){
    applyLoungeStudy(actors,'cat',time);
    for(const {point:p}of handPoints(actors))if(p.x>table.min.x&&p.x<table.max.x&&p.z>table.min.z&&p.z<table.max.z){
      assert.ok(p.y>=table.max.y-.001,`hand penetrates the table at ${time}: ${p.y}`);
    }
  }
});

test('the actual finger pads and thumb hold the thin handle throughout its lift and return',()=>{
  const actors=setup(),toy=actors.furniture.userData.loungeProps.toy;
  for(const time of [...Array.from({length:57},(_,i)=>9.15+i/100),10.21,11.1,13.32,15.6,17.65]){
    applyLoungeStudy(actors,'cat',time);const contacts={finger:Infinity,thumb:Infinity};
    for(const {point:p,part}of handPoints(actors,toy)){
      const radial=Math.hypot(p.y-.012,p.z)-.012,axial=Math.abs(p.x-.0425)-.0425;
      const distance=Math.hypot(Math.max(radial,0),Math.max(axial,0))+Math.min(0,Math.max(radial,axial));
      assert.ok(distance>-.0015,`hand buries the handle at ${time}`);
      if(part in contacts)contacts[part]=Math.min(contacts[part],Math.abs(distance));
    }
    for(const [part,distance]of Object.entries(contacts))assert.ok(distance<.002,`${part} misses the handle at ${time}: ${distance}`);
  }
});

test('the lifted handle sits inside all four fingers, close to the palm, with the thumb opposing them',()=>{
  const actors=setup(),toy=actors.furniture.userData.loungeProps.toy;
  for(const time of [10.21,11.1,13.32,15.6]){
    applyLoungeStudy(actors,'cat',time);
    const contacts=new Map();
    for(const {point:p,part,finger}of handPoints(actors,toy)){
      if(p.x<.0045||p.x>.0805)continue;
      const radial=new Vector3(0,p.y-.012,p.z),distance=Math.abs(radial.length()-.012),key=finger??part;
      if(!contacts.has(key)||distance<contacts.get(key).distance)contacts.set(key,{distance,normal:radial.normalize()});
    }
    for(const key of ['0','1','2','3','thumb'])assert.ok(contacts.get(key)?.distance<.0015,`${key} does not wrap the handle at ${time}`);
    assert.ok(contacts.get('palm').distance<.005,'the handle is nestled at the palm instead of dangling from a pinch');
    assert.ok(['0','1','2','3'].some(key=>contacts.get(key).normal.dot(contacts.get('thumb').normal)<0),'thumb and fingers press from opposite sides');
  }
});

function cordPoints(toy){
  const cord=toy.userData.catTeaser.cord,{position}=cord.geometry.attributes,points=[];
  for(let i=0;i<=32;i++){
    const point=new Vector3();for(let j=0;j<6;j++)point.add(new Vector3().fromBufferAttribute(position,i*7+j));
    points.push(cord.localToWorld(point.multiplyScalar(1/6)));
  }
  return points;
}

test('the cord starts drooping on lift, then hangs vertically with the red lure below it',()=>{
  const actors=setup(),toy=actors.furniture.userData.loungeProps.toy,{lure,length}=toy.userData.catTeaser;
  applyLoungeStudy(actors,'cat',9.15);
  const start=cordPoints(toy)[0],restLure=lure.getWorldPosition(new Vector3());
  for(const time of [9.16,9.3]){
    applyLoungeStudy(actors,'cat',time);
    const tip=cordPoints(toy)[0],red=lure.getWorldPosition(new Vector3());
    assert.ok(tip.y>start.y);
    assert.ok(red.y-restLure.y<(tip.y-start.y)*.3,'supported string and lure do not rise rigidly with the rod');
  }
  for(const time of [10.21,13.32]){
    applyLoungeStudy(actors,'cat',time);const points=cordPoints(toy),tip=points[0],end=points.at(-1),red=lure.getWorldPosition(new Vector3());
    assert.ok(tip.distanceTo(toy.localToWorld(new Vector3(.38,.008,0)))<1e-7,'cord stays tied to the tip');
    for(const point of points)assert.ok(Math.hypot(point.x-tip.x,point.z-tip.z)<1e-7,'gravity remains world-down as the rod rotates');
    assert.ok(Math.abs(tip.y-end.y-length)<1e-7,'cord retains its length');
    assert.ok(Math.abs(end.y-red.y-.018)<1e-7,'red lure hangs below the end of the cord');
  }
});

test('the cord and lure move continuously, scrub deterministically and return to their tabletop shape',()=>{
  const actors=setup(),toy=actors.furniture.userData.loungeProps.toy,{lure}=toy.userData.catTeaser;
  const snapshot=()=>[...cordPoints(toy),lure.getWorldPosition(new Vector3())];
  applyLoungeStudy(actors,'cat',8);const home=snapshot(),homeRotation=lure.getWorldQuaternion(new Quaternion());let previous=home;
  for(let frame=1;frame<=11*60;frame++){
    const time=8+frame/60;applyLoungeStudy(actors,'cat',time);const next=snapshot();
    next.forEach((p,i)=>assert.ok(p.distanceTo(previous[i])<.035,`tether jumps at ${time}`));previous=next;
  }
  previous.forEach((p,i)=>assert.ok(p.distanceTo(home[i])<1e-7,'return to the original tabletop shape'));
  assert.ok(lure.getWorldQuaternion(new Quaternion()).angleTo(homeRotation)<1e-7);
  const times=[9.3,10.21,13.32],references=times.map(t=>{applyLoungeStudy(actors,'cat',t);return snapshot();});
  for(const i of [2,0,1]){
    applyLoungeStudy(actors,'cat',times[i]);snapshot().forEach((p,j)=>assert.ok(p.distanceTo(references[i][j])<1e-7));
  }
});
