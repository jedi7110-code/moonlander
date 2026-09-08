import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {CrewMotion,Supplies,CatRoutine,FLOORS,currentAction} from '../src/obs/state.js';
import {Brain} from '../../js/obs/brain.js?v=15';
import {MeshStandardMaterial,Box3} from 'three';
import {createMilo,createCat,animateMilo,animateCat} from '../src/obs/characters.js';
import {StationFeedback,SIGNAL_COLORS} from '../src/obs/feedback.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {headGeometry} from '../src/obs/head.js';

function advance(actor,seconds){for(let i=0;i<seconds*60;i++)actor.update(1/60);}
test('the scanned head retains its face, normals and UVs after the shoulder crop',async()=>{
  const bytes=await readFile(new URL('../public/assets/obs/head/LeePerrySmith.glb',import.meta.url));
  const gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
  const source=gltf.scene.getObjectByName('LeePerrySmith').geometry,geometry=headGeometry(source);
  assert.ok(geometry.boundingBox.min.y>=-1.05);assert.ok(geometry.boundingBox.max.y>3.9);
  assert.ok(geometry.attributes.position.count>20000);assert.ok(source.index);
  for(const name of ['position','normal','uv'])for(const number of geometry.attributes[name].array)assert.ok(Number.isFinite(number));
  assert.equal(geometry.attributes.normal.count,geometry.attributes.position.count);
  assert.equal(geometry.attributes.uv.count,geometry.attributes.position.count);
  geometry.dispose();gltf.scene.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});
});
test('crew walks to ladder, changes decks, and invokes arrival once',()=>{
  const actor=new CrewMotion({floor:1,x:600});let calls=0;
  actor.goTo({floor:0,x:900},()=>calls++);advance(actor,20);
  assert.equal(actor.floor,0);assert.equal(actor.y,FLOORS[0].y);assert.equal(actor.x,900);assert.equal(actor.busy,false);assert.equal(calls,1);
});
test('mid-ladder destination changes preserve position',()=>{
  const actor=new CrewMotion({floor:1,x:700});actor.goTo({floor:0,x:500});advance(actor,2);const height=actor.y;
  actor.goTo({floor:2,x:1100});assert.equal(actor.y,height);assert.equal(actor.climbing,true);advance(actor,25);
  assert.equal(actor.y,FLOORS[2].y);assert.equal(actor.x,1100);
});
test('retargeting discards callbacks from the old destination',()=>{
  const actor=new CrewMotion();let old=0,newArrival=0;actor.goTo({floor:2,x:300},()=>old++);advance(actor,1);actor.goTo({floor:1,x:600},()=>newArrival++);advance(actor,10);assert.equal(old,0);assert.equal(newArrival,1);
});
test('supplies are finite and never regenerate without an order',()=>{
  const care=new Supplies(),deliveries=[];care.onDeliver=type=>deliveries.push(type);
  assert.equal(care.request(),false);assert.equal(care.take('unknown'),false);
  for(let i=0;i<3;i++)assert.equal(care.take('food'),true);
  assert.equal(care.take('food'),false);care.update(500);assert.equal(care.has('food'),false);assert.deepEqual(deliveries,[]);
  for(let i=0;i<10;i++)assert.equal(care.take('music'),true);
});
test('cat eats only on reaching the bowl and consumes one delivery',()=>{
  const care=new Supplies(),cat=new CatRoutine(care);cat.fetch();cat.update(1);assert.equal(care.has('catfood'),true);
  for(let i=0;i<45*60&&cat.mode!=='eat';i++)cat.update(1/60);
  assert.equal(cat.mode,'eat');assert.equal(cat.motion.floor,2);assert.equal(cat.motion.x,1176);assert.equal(care.supplies.catfood,2);assert.equal(cat.hunger,100);
});
test('the original 2D brain completes a meal through the 3D adapter',()=>{
  const care=new Supplies(),actor=new CrewMotion({floor:2,x:1090}),scene={time:{delayedCall(){}},sound:{add(){return{play(){},once(){}}}}};
  const brain=new Brain(scene,actor,{care});brain.needs.hunger=20;brain.handleChat('食べてください');
  for(let i=0;i<36*60;i++){actor.update(1/60);brain.update(1/60);}
  assert.ok(brain.needs.hunger>75);assert.equal(care.supplies.food,2);
  assert.equal(currentAction({state:'reading'}),'console');assert.equal(currentAction({state:'goingTo'}),null);
});
test('character limb surfaces face outwards and transforms stay finite',()=>{
  const material=new MeshStandardMaterial(),materials=new Proxy({},{get:()=>material});
  for(const root of [createMilo(materials),createCat(materials)])root.traverse(mesh=>{
    if(!mesh.geometry)return;
    const positions=mesh.geometry.attributes.position,normals=mesh.geometry.attributes.normal;
    for(let i=0;i<positions.count;i++)assert.ok(Number.isFinite(positions.getX(i)+positions.getY(i)+positions.getZ(i)));
    if(mesh.geometry.type==='LatheGeometry')assert.ok(positions.getX(0)*normals.getX(0)+positions.getZ(0)*normals.getZ(0)>=0);
  });
  const milo=createMilo(materials);animateMilo(milo,{action:'bunk',moving:false,time:0,facing:1});
  animateMilo(milo,{action:null,moving:true,time:1,facing:1});assert.equal(milo.userData.body.position.x,0);
});
test('Milo has adult limb proportions and grounded boots when standing or sitting',()=>{
  const material=new MeshStandardMaterial(),milo=createMilo(new Proxy({},{get:()=>material}));
  for(const {arm}of milo.userData.arms)assert.ok(Math.abs(arm.position.x)>.19&&Math.abs(arm.position.x)<.23);
  for(const {leg}of milo.userData.legs)assert.ok(leg.position.y>.95&&leg.position.y<1.01);
  for(const action of [null,'console','lounge']){
    animateMilo(milo,{action,moving:false,climbing:false,time:0,facing:1});milo.updateMatrixWorld(true);
    for(const {boot}of milo.userData.legs){const bounds=new Box3().setFromObject(boot);assert.ok(bounds.min.y>=-.005&&bounds.min.y<.03,`${action}: feet at ${bounds.min.y}`);}
  }
  animateMilo(milo,{action:null,moving:false,climbing:false,time:0,facing:1});milo.updateMatrixWorld(true);
  for(const {hand}of milo.userData.arms){const bounds=new Box3().setFromObject(hand);assert.ok(bounds.min.y>.70&&bounds.min.y<.80);}
  const torso=milo.getObjectByName('Continuous shoulders and torso');assert.ok(torso);assert.ok(milo.getObjectByName('Fitted tank top'));
});
test('cat ears are thin cupped shells and calico patches use body-local coordinates',()=>{
  const material=new MeshStandardMaterial(),cat=createCat(new Proxy({},{get:()=>material}));
  for(const ear of cat.userData.ears){
    const geometry=ear.children[0].geometry,position=geometry.attributes.position,half=position.count/2;
    assert.equal(geometry.type,'BufferGeometry');assert.ok(geometry.attributes.color);
    for(let i=0;i<half;i++){const thickness=position.getZ(i)-position.getZ(i+half);assert.ok(thickness>0&&thickness<=.0051);}
    assert.ok(position.getZ(10)<position.getZ(0));
  }
  const patches=[];cat.traverse(o=>{if(o.geometry?.attributes.coatPosition)patches.push(o);});assert.equal(patches.length,2);
  for(const mesh of patches){const position=mesh.geometry.attributes.position,coat=mesh.geometry.attributes.coatPosition;
    for(let i=0;i<position.count;i++)assert.ok(Math.abs(coat.getY(i)-(position.getY(i)*mesh.scale.y+mesh.position.y))<1e-6);
  }
});
test('the tapered tail stays continuous through motion and pauses without reallocating geometry',()=>{
  const material=new MeshStandardMaterial(),cat=createCat(new Proxy({},{get:()=>material})),tail=cat.userData.tail,geometry=tail.geometry;
  assert.ok(tail.isMesh);assert.equal(tail.children.length,0);let time=0;
  for(const [mode,moving]of [['sleep',false],['walk',true],['groom',false],['sleep',false]]){
    for(let frame=0;frame<90;frame++){time+=1/60;animateCat(cat,{time,moving,climbing:false,facing:1,mode});}
    assert.equal(tail.geometry,geometry);const position=geometry.attributes.position;
    for(const number of position.array)assert.ok(Number.isFinite(number));
    const {segments,sides,curve}=tail.userData;let previousRadius=1;
    for(let ring=0;ring<=segments;ring++){
      const center=curve.getPointAt(ring/segments),index=ring*(sides+1),radius=Math.hypot(position.getX(index)-center.x,position.getY(index)-center.y,position.getZ(index)-center.z);
      assert.ok(radius<=previousRadius+1e-6);previousRadius=radius;
      for(const key of ['getX','getY','getZ'])assert.ok(Math.abs(position[key](index)-position[key](index+sides))<1e-6);
    }
    assert.ok(previousRadius<1e-6);
    const saved=position.array.slice();animateCat(cat,{time,moving,climbing:false,facing:1,mode});assert.deepEqual(position.array,saved);
  }
});
test('manual station feedback follows arrival and clears after completion',()=>{
  const feedback=new StationFeedback(),brain={actStation:'shower',state:'goingTo'},actor={busy:true};feedback.accept('shower');
  feedback.update(.1,brain,actor,false);assert.equal(feedback.summary.phase,'moving');assert.equal(feedback.signal('shower').color,SIGNAL_COLORS.moving);
  const brightness=feedback.signal('shower').intensity;feedback.update(.2,brain,actor,false);assert.notEqual(feedback.signal('shower').intensity,brightness);
  actor.busy=false;brain.state='performing';feedback.update(0,brain,actor,false);assert.equal(feedback.summary.phase,'active');
  brain.actStation=null;brain.state='idle';feedback.update(0,brain,actor,false);assert.equal(feedback.summary.phase,'done');
  feedback.update(3,brain,actor,false);assert.equal(feedback.summary,null);assert.equal(feedback.signal('shower'),null);
});
test('rejected clicks preserve an existing command and expire independently',()=>{
  const feedback=new StationFeedback(),brain={actStation:'bunk',state:'goingTo'},actor={busy:true};feedback.accept('bunk');feedback.notify('stereo','blocked');
  feedback.update(.3,brain,actor,false);assert.equal(feedback.summary.id,'stereo');assert.equal(feedback.signal('bunk').phase,'moving');
  feedback.update(2.5,brain,actor,false);assert.equal(feedback.summary.id,'bunk');assert.equal(feedback.signal('stereo'),null);
  feedback.accept('toilet');assert.equal(feedback.signal('bunk'),null);assert.equal(feedback.summary.id,'toilet');
});
test('paused instructions retain feedback and reduced-motion signals are steady',()=>{
  const feedback=new StationFeedback(),brain={actStation:'console',state:'goingToConsole'},actor={busy:true};feedback.accept('console');
  feedback.update(.1,brain,actor,true);assert.equal(feedback.summary.phase,'waiting');assert.equal(feedback.signal('console',true).intensity,1);
  feedback.update(.3,brain,actor,true);assert.equal(feedback.signal('console',true).intensity,1);
  brain.state='reading';brain.actStation=null;actor.busy=false;feedback.update(0,brain,actor,false);assert.equal(feedback.summary.phase,'active');
});
test('ordinary chat does not create a command revision but movement orders do',()=>{
  const actor=new CrewMotion(),brain=new Brain({},actor,{care:new Supplies()});
  brain.handleChat('こんにちは');assert.equal(actor.commandVersion,0);brain.handleChat('寝てください');assert.equal(actor.commandVersion,1);
});
