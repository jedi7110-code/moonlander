import test from 'node:test';
import assert from 'node:assert/strict';
import {MeshStandardMaterial,Vector3} from 'three';
import {createCat,animateCat} from '../src/obs/characters.js';
import {CatRoutine,CatMotion,CrewMotion,Supplies} from '../src/obs/state.js';
import {catLookDirection} from '../src/obs/cat-rest.js';

const make=()=>createCat(new Proxy({},{get:()=>new MeshStandardMaterial()}));
const pose=(cat,mode,time,remaining=20)=>{animateCat(cat,{time,actionTime:time,remaining,mode,moving:false,facing:1});cat.updateMatrixWorld(true);};
test('sleep settles gradually onto the belly and rises before the next activity',()=>{
  const cat=make(),{body}=cat.userData;let previous=0;
  for(let frame=0;frame<=150;frame++){
    pose(cat,'sleep',frame/60);assert.ok(Math.abs(body.position.y-previous)<.006);previous=body.position.y;
    for(const leg of cat.userData.legs)assert.ok(leg.paw.getWorldPosition(new Vector3()).y>.015);
  }
  assert.equal(body.position.y,-.17);assert.equal(body.scale.y,.96);
  for(let frame=0;frame<=72;frame++){pose(cat,'sleep',4+frame/60,1.2-frame/60);assert.ok(Math.abs(body.position.y-previous)<.008);previous=body.position.y;}
  assert.ok(Math.abs(body.position.y)<.004);
});
test('feeding lowers the neck rather than changing its height on arrival',()=>{
  const cat=make(),{neck}=cat.userData;pose(cat,'eat',0);assert.equal(neck.position.y,.414);
  const heights=[];
  for(let frame=0;frame<=120;frame++){pose(cat,'eat',frame/60);heights.push(neck.position.y);}
  assert.ok(heights.at(-1)<heights[0]-.06);
  for(let i=1;i<heights.length;i++)assert.ok(Math.abs(heights[i]-heights[i-1])<.003);
});
test('sitting folds the hind legs, plants the forepaws and pauses between glances',()=>{
  const cat=make();pose(cat,'look',3);
  assert.equal(cat.userData.body.rotation.x,-.5);
  for(const leg of cat.userData.legs)assert.ok(Math.abs(leg.paw.getWorldPosition(new Vector3()).y-.036*.8)<.008);
  assert.equal(catLookDirection(2.8),catLookDirection(3.5));assert.ok(catLookDirection(2.8)>0);assert.ok(catLookDirection(6)<0);
  const before=cat.userData.head.quaternion.toArray();pose(cat,'look',3);assert.deepEqual(cat.userData.head.quaternion.toArray(),before);
});
test('the seated tail stays above its supporting surface throughout settling and looking',()=>{
  const cat=make(),tail=cat.userData.tail,p=new Vector3();
  for(let frame=0;frame<=180;frame+=3){
    pose(cat,'look',frame/60);
    const vertices=tail.geometry.attributes.position;
    for(let i=0;i<vertices.count;i+=4){p.fromBufferAttribute(vertices,i).applyMatrix4(tail.matrixWorld);assert.ok(p.y>-.002);}
  }
});
test('a food command lets a resting cat stand before it starts travelling',()=>{
  const cat=new CatRoutine(new Supplies(),{random:()=>.5});cat.rest('sleep',10);cat.modeTime=4;
  const x=cat.motion.x;cat.fetch();cat.update(.6);assert.equal(cat.motion.x,x);assert.equal(cat.mode,'sleep');
  cat.update(.61);assert.equal(cat.mode,'fetch');assert.equal(cat.motion.busy,true);
});
function followers(){
  const actor=new CrewMotion({floor:1,x:620}),cat=new CatRoutine(new Supplies(),{random:()=>.5});
  cat.motion=new CatMotion({floor:1,x:500});cat.mode='look';cat.remaining=0;cat.companion=actor;actor.goTo({floor:1,x:1000});cat.follow();
  return{actor,cat};
}
test('following trails a walking Milo on the same deck and ends when he stops',()=>{
  const {actor,cat}=followers();assert.equal(cat.mode,'follow');
  for(let i=0;i<240;i++){actor.update(1/60);cat.update(1/60,actor);assert.ok(actor.x-cat.motion.x>25);assert.equal(cat.motion.portal,null);}
  assert.ok(cat.motion.x>650);assert.equal(cat.mode,'follow');
  actor.queue=[];cat.update(.1,actor);assert.equal(cat.mode,'look');assert.equal(cat.motion.walkSpeed,36);
});
test('following never chases Milo onto a ladder, and manual feeding cancels it',()=>{
  const {actor,cat}=followers();actor.queue=[{type:'climb',floor:2,y:870}];cat.update(.1,actor);assert.equal(cat.mode,'look');assert.equal(cat.motion.climbing,false);
  const other=followers();other.cat.fetch();assert.equal(other.cat.mode,'fetch');assert.equal(other.cat.motion.destination.floor,2);
});
test('following is one of the occasional autonomous choices, not a mandatory route',()=>{
  const choices=new Set();
  for(let sample=0;sample<100;sample++){
    const {actor,cat}=followers();cat.mode='look';cat.remaining=0;cat.companion=actor;cat.random=()=>sample/100;
    cat.choose();choices.add(cat.mode);
  }
  assert.ok(choices.has('follow'));assert.ok(choices.has('walk'));assert.ok(choices.has('look'));
});
