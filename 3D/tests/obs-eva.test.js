import test from 'node:test';
import assert from 'node:assert/strict';
import {Box3,Group,MeshStandardMaterial,Vector3} from 'three';
import {DECK,EVA,EVA_PASSAGE,STATIONS,getStation} from '../src/obs/layout.js';
import {getStation as sharedStation} from '../../js/obs/layout.js?v=15';
import {CabinBrain} from '../src/obs/brain.js';
import {CrewMotion,Supplies} from '../src/obs/state.js';
import {createEVABay,EVA_BAY,animateAirlock} from '../src/obs/eva.js';
import {AirlockPassage} from '../src/obs/airlock.js';
import {addCabinDressing} from '../src/obs/cabin-dressing.js';
import {FLOOR_Y} from '../src/obs/ship.js';

test('the EVA rack replaces audio in 3D without changing the original 2D station',()=>{
  assert.equal(getStation('stereo'),undefined);assert.ok(sharedStation('stereo'));
  assert.equal(getStation('eva').floor,0);assert.equal(getStation('airlock').floor,0);assert.equal(getStation('hatch').floor,2);
  assert.equal(STATIONS.filter(station=>station.id==='eva').length,1);
});
test('music requests and old station references cannot send Milo to removed equipment',()=>{
  const actor=new CrewMotion(),brain=new CabinBrain({obsUI:{hideWant(){}}},actor,{care:new Supplies()});
  assert.equal(brain._usable(sharedStation('stereo')),false);
  for(const text of ['音楽をかけて','play music','stereo']){brain.handleChat(text);assert.equal(brain.actStation,'lounge');assert.equal(brain.nextLeisure,'music');assert.equal(brain.gamePending,false);}
  const version=actor.commandVersion;
  brain._go(sharedStation('stereo'));assert.equal(actor.commandVersion,version);
  brain.needs.fun=1;brain._choose();assert.equal(brain.actStation,'lounge');
});
test('inspection requests arrive, report their own fixture, and end without changing reserves',()=>{
  for(const [text,id]of [['宇宙服を点検','eva'],['船外ハッチを確認','airlock'],['船内ハッチを確認','innerHatch']]){
    const actor=new CrewMotion({floor:EVA_PASSAGE.floor,x:1100}),care=new Supplies(),reports=[];
    const brain=new CabinBrain({obsUI:{hideWant(){},inspectEVA(id){reports.push(id);}}},actor,{care});
    brain.handleChat(text);assert.equal(brain.actStation,id);
    for(let i=0;i<12*60;i++){actor.update(1/60);brain.update(1/60);}
    assert.deepEqual(reports,[id]);assert.deepEqual(care.supplies,care.capacity);assert.notEqual(brain.actStation,id);
  }
});
test('three hanging suits have separate silhouettes, clear boots, and a sealed right-hand hatch',()=>{
  const material=new MeshStandardMaterial(),m=new Proxy({},{get:()=>material});let bay;
  globalThis.document={createElement(){return{getContext(){return{fillRect(){},fillText(){},measureText(text){return{width:text.length*parseFloat(this.font.slice(4))*.6};}};}};}};
  try{bay=createEVABay(m,3.392);}finally{delete globalThis.document;}
  assert.equal(bay.suits.length,3);bay.root.updateMatrixWorld(true);
  const bounds=bay.suits.map(suit=>new Box3().setFromObject(suit));
  for(let i=0;i<3;i++){
    assert.equal(bay.suits[i].userData.suitNumber,i+1);assert.ok(bounds[i].min.y>3.392+.20);assert.ok(bounds[i].max.y<3.392+2.8);
    if(i)assert.ok(bounds[i].min.x>bounds[i-1].max.x);
  }
  assert.ok(new Box3().setFromObject(bay.hatch).min.x>bounds[2].max.x);
  assert.ok(new Box3().setFromObject(bay.innerHatch).max.x<bounds[0].min.x);
  assert.deepEqual(bay.suits.map(suit=>suit.userData.colorway),['white','red','white']);
  const clothColors=bay.suits.map(suit=>suit.getObjectByName('Tailored pressure garment').material.color.getHex());
  assert.equal(clothColors[0],clothColors[2]);assert.notEqual(clothColors[0],clothColors[1]);
  assert.equal(material.color.getHex(),0xffffff,'suit colors must not recolor shared cabin materials');
  for(const suit of bay.suits){
    assert.ok(suit.getObjectByName('Life support backpack'));
    assert.ok(suit.getObjectByName('Chest service panel'));
    assert.ok(suit.getObjectByName('Restraint harness'));
  }
  const rackBounds=new Box3().setFromObject(bay.equipmentRack);
  assert.ok(rackBounds.min.x>bounds[2].max.x,'weapon rack is to the right of all three suits');
  assert.ok(rackBounds.max.x<new Box3().setFromObject(bay.hatch).min.x,'rack does not intrude into the outer hatch');
  assert.ok(rackBounds.max.z<.5,'rack stays against the wall, behind the walking lane');
  assert.equal(bay.equipmentRack.userData.weapons.length,3);
  let previous=null;
  for(const [index,weapon]of bay.equipmentRack.userData.weapons.entries()){
    const box=new Box3().setFromObject(weapon);assert.equal(weapon.userData.rackSlot,index+1);
    assert.ok(box.max.y-box.min.y>1.2);assert.ok(box.max.x-box.min.x<.5);
    if(previous)assert.ok(box.min.x>previous.max.x,'three stored weapons have separate silhouettes');previous=box;
    const receiver=weapon.getObjectByName('Armored receiver');
    assert.equal(receiver.material.name,'Silver rifle body');
    assert.equal(receiver.material.color.getHex(),0xd7dcdb);
    assert.equal(receiver.material.map,null,'silver stays legible in the dim rack instead of inheriting the dark steel texture');
    assert.ok(receiver.material.metalness>=.5,'rifle body retains a metallic finish');
    const face=weapon.getObjectByName('Silver receiver face');
    assert.equal(face.material,receiver.material,'the large visible receiver face uses the silver body finish');
    weapon.traverse(mesh=>{
      if(!mesh.geometry)return;
      for(const key of ['position','normal','uv'])for(const value of mesh.geometry.attributes[key].array)assert.ok(Number.isFinite(value));
    });
  }
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

test('cabin dressing leaves the floor in front of the hanging suits clear',()=>{
  const root=new Group(),material=new MeshStandardMaterial(),m=new Proxy({},{get:()=>material});
  const dressing=addCabinDressing(root,m,FLOOR_Y),cases=[];dressing.updateMatrixWorld(true);
  dressing.traverse(object=>{if(object.name==='Life support cargo case')cases.push(object);});
  assert.equal(cases.length,1,'only the cargo-room case remains');
  const bounds=new Box3().setFromObject(cases[0]);
  assert.ok(bounds.max.y<FLOOR_Y[DECK.LIFE_SUPPORT]+.8);
  assert.ok(bounds.max.x<3,'no case remains in the EVA suit row around x=10');
  root.traverse(object=>object.geometry?.dispose());material.dispose();
});

test('the inner hatch opens before traffic in either direction, then seals behind it',()=>{
  for(const direction of [-1,1]){
    const actor=new CrewMotion({floor:EVA_PASSAGE.floor,x:EVA_PASSAGE.x-direction*80}),gate=new AirlockPassage();
    const target=EVA_PASSAGE.x+direction*80;let waited=false,arrivals=0;
    actor.goTo({floor:EVA_PASSAGE.floor,x:target},()=>arrivals++);
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
  const gate=new AirlockPassage(),actor=new CrewMotion({floor:getStation('lounge').floor,x:EVA_PASSAGE.x-20});
  actor.goTo({floor:getStation('lounge').floor,x:EVA_PASSAGE.x+80});gate.update(.7,actor);
  assert.equal(gate.opening,0);assert.equal(actor.waitingForHatch,false);
  const crew=new CrewMotion({floor:EVA_PASSAGE.floor,x:EVA_PASSAGE.x-25});
  crew.goTo({floor:EVA_PASSAGE.floor,x:EVA_PASSAGE.x+80});gate.update(.25,crew);
  assert.equal(crew.waitingForHatch,true);
  const opening=gate.opening;gate.update(0,crew);assert.equal(gate.opening,opening);
  crew.goTo({floor:EVA_PASSAGE.floor,x:EVA_PASSAGE.x-100});gate.update(1/60,crew);assert.equal(crew.waitingForHatch,false);
  for(let i=0;i<180;i++){gate.update(1/60,crew);crew.update(1/60);}
  assert.equal(gate.opening,0);assert.equal(crew.x,EVA_PASSAGE.x-100);
});
