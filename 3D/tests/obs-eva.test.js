import test from 'node:test';
import assert from 'node:assert/strict';
import {Box3,Group,MeshStandardMaterial,Vector3} from 'three';
import {EVA,EVA_PASSAGE,STATIONS,getStation} from '../src/obs/layout.js';
import {getStation as sharedStation} from '../../js/obs/layout.js?v=15';
import {CabinBrain} from '../src/obs/brain.js';
import {CrewMotion,Supplies} from '../src/obs/state.js';
import {createEVABay,EVA_BAY,animateAirlock} from '../src/obs/eva.js';
import {AirlockPassage} from '../src/obs/airlock.js';

test('the EVA rack replaces audio in 3D without changing the original 2D station',()=>{
  assert.equal(getStation('stereo'),undefined);assert.ok(sharedStation('stereo'));
  assert.equal(getStation('eva').floor,1);assert.equal(getStation('airlock').floor,1);assert.equal(getStation('hatch').floor,2);
  assert.equal(STATIONS.filter(station=>station.id==='eva').length,1);
});
test('music requests and old station references cannot send Milo to removed equipment',()=>{
  const actor=new CrewMotion(),brain=new CabinBrain({obsUI:{hideWant(){}}},actor,{care:new Supplies()});
  assert.equal(brain._usable(sharedStation('stereo')),false);
  for(const text of ['音楽をかけて','play music','stereo']){brain.handleChat(text);assert.equal(actor.commandVersion,0);assert.equal(brain.gamePending,false);}
  brain._go(sharedStation('stereo'));assert.equal(actor.commandVersion,0);
  brain.needs.fun=1;brain._choose();assert.equal(brain.actStation,'lounge');
});
test('inspection requests arrive, report their own fixture, and end without changing reserves',()=>{
  for(const [text,id]of [['宇宙服を点検','eva'],['船外ハッチを確認','airlock'],['船内ハッチを確認','innerHatch']]){
    const actor=new CrewMotion({floor:1,x:1100}),care=new Supplies(),reports=[];
    const brain=new CabinBrain({obsUI:{hideWant(){},inspectEVA(id){reports.push(id);}}},actor,{care});
    brain.handleChat(text);assert.equal(brain.actStation,id);
    for(let i=0;i<12*60;i++){actor.update(1/60);brain.update(1/60);}
    assert.deepEqual(reports,[id]);assert.deepEqual(care.supplies,care.capacity);assert.notEqual(brain.actStation,id);
  }
});
test('three hanging suits have separate silhouettes, clear boots, and a sealed right-hand hatch',()=>{
  const material=new MeshStandardMaterial(),m=new Proxy({},{get:()=>material});let bay;
  globalThis.document={createElement(){return{getContext(){return{fillRect(){},fillText(){}};}};}};
  try{bay=createEVABay(m,3.392);}finally{delete globalThis.document;}
  assert.equal(bay.suits.length,3);bay.root.updateMatrixWorld(true);
  const bounds=bay.suits.map(suit=>new Box3().setFromObject(suit));
  for(let i=0;i<3;i++){
    assert.equal(bay.suits[i].userData.suitNumber,i+1);assert.ok(bounds[i].min.y>3.392+.20);assert.ok(bounds[i].max.y<3.392+2.8);
    if(i)assert.ok(bounds[i].min.x>bounds[i-1].max.x);
  }
  assert.ok(new Box3().setFromObject(bay.hatch).min.x>bounds[2].max.x);
  assert.ok(new Box3().setFromObject(bay.innerHatch).max.x<bounds[0].min.x);
  assert.ok(bay.hatch.getObjectByName('Sealed pressure door'));assert.equal(bay.hatch.rotation.y,EVA_BAY.hatchYaw);
  for(const hatch of [bay.hatch,bay.innerHatch]){
    const normal=new Vector3(0,0,1).applyQuaternion(hatch.quaternion);
    assert.ok(Math.abs(normal.x+1)<1e-10);assert.ok(Math.abs(normal.z)<1e-10);
  }
  const animated=new Group(),{door,signal}=bay.innerHatch.userData;
  animated.attach(door);
  const original=door.position.clone(),outer=bay.hatch.userData.door.position.clone();
  animateAirlock(door,signal,.5);
  assert.equal(door.position.x,EVA_BAY.innerX);assert.equal(door.position.y,3.392+1.38);
  assert.equal(door.position.z,EVA_BAY.depth-1.6);assert.equal(door.visible,true);
  animateAirlock(door,signal,1);assert.equal(door.visible,false);
  animateAirlock(door,signal,0);assert.equal(door.visible,true);assert.ok(door.position.distanceTo(original)<1e-10);
  assert.deepEqual(bay.hatch.userData.door.position,outer);
  assert.ok(EVA.x<getStation('airlock').x);
});

test('the inner hatch opens before traffic in either direction, then seals behind it',()=>{
  for(const direction of [-1,1]){
    const actor=new CrewMotion({floor:1,x:EVA_PASSAGE.x-direction*80}),gate=new AirlockPassage();
    const target=EVA_PASSAGE.x+direction*80;let waited=false,arrivals=0;
    actor.goTo({floor:1,x:target},()=>arrivals++);
    for(let i=0;i<6*60;i++){
      gate.update(1/60,actor);
      if(actor.waitingForHatch)waited=true;else actor.update(1/60);
      if(Math.abs(actor.x-EVA_PASSAGE.x)<EVA_PASSAGE.clearance-1)assert.ok(gate.opening>=.99);
    }
    assert.equal(actor.x,target);assert.equal(arrivals,1);assert.equal(waited,true);
    assert.equal(gate.opening,0);assert.equal(actor.waitingForHatch,false);
  }
});
test('unrelated traffic, cancelling an approach, and paused time do not leave the hatch open',()=>{
  const gate=new AirlockPassage(),actor=new CrewMotion({floor:0,x:EVA_PASSAGE.x-20});
  actor.goTo({floor:0,x:EVA_PASSAGE.x+80});gate.update(.7,actor);
  assert.equal(gate.opening,0);assert.equal(actor.waitingForHatch,false);
  const crew=new CrewMotion({floor:1,x:EVA_PASSAGE.x-25});
  crew.goTo({floor:1,x:EVA_PASSAGE.x+80});gate.update(.25,crew);
  assert.equal(crew.waitingForHatch,true);
  const opening=gate.opening;gate.update(0,crew);assert.equal(gate.opening,opening);
  crew.goTo({floor:1,x:EVA_PASSAGE.x-100});gate.update(1/60,crew);assert.equal(crew.waitingForHatch,false);
  for(let i=0;i<180;i++){gate.update(1/60,crew);crew.update(1/60);}
  assert.equal(gate.opening,0);assert.equal(crew.x,EVA_PASSAGE.x-100);
});
