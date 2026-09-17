import test from 'node:test';
import assert from 'node:assert/strict';
import {Box3,MeshStandardMaterial} from 'three';
import {DECK,FLOORS,STATIONS,getStation,CAT_SOFA,EVA_PASSAGE} from '../src/obs/layout.js';
import {FLOORS as originalFloors,getStation as originalStation} from '../../js/obs/layout.js?v=15';
import {CrewMotion,CatRoutine,Supplies} from '../src/obs/state.js';
import {CabinBrain} from '../src/obs/brain.js';
import {buildShip,FLOOR_Y,positionX,positionY,REAR_ROOM_GATES} from '../src/obs/ship.js';

test('missions occupy 01 and living facilities occupy 02 next to 03 without changing 2D',()=>{
  assert.deepEqual(FLOORS.map(f=>f.name),['OPERATIONS','HABITATION','LIFE SUPPORT']);
  assert.deepEqual(FLOORS.map(f=>f.y),originalFloors.map(f=>f.y));
  for(const id of ['console','medical','eva','innerHatch','airlock'])assert.equal(getStation(id).floor,DECK.OPERATIONS);
  for(const id of ['shower','toilet','bunk','lounge'])assert.equal(getStation(id).floor,DECK.HABITATION);
  for(const id of ['galley','hydro','plant','gym','hatch'])assert.equal(getStation(id).floor,DECK.LIFE_SUPPORT);
  assert.equal(CAT_SOFA.floor,DECK.HABITATION);assert.equal(EVA_PASSAGE.floor,DECK.OPERATIONS);
  assert.equal(originalStation('bunk').floor,0);assert.equal(originalStation('console').floor,1);
  assert.equal(originalFloors[0].name,'HABITATION');
  assert.equal(Math.abs(getStation('bunk').floor-getStation('galley').floor),1);
});

test('shared HQ and social callbacks arrive at the relocated console, not the old floor',()=>{
  for(const social of [false,true]){
    const actor=new CrewMotion({floor:DECK.HABITATION,x:700});
    const brain=new CabinBrain({obsUI:{hideWant(){},showWant(){}}},actor,{care:new Supplies(),random:()=>.8});
    if(social){brain.want={kind:'social'};brain._summon();}else assert.equal(brain.requestCommand(),true);
    for(let i=0;i<1800&&actor.busy;i++)actor.update(1/60);
    assert.equal(actor.floor,DECK.OPERATIONS);assert.equal(actor.x,getStation('console').x);
    assert.equal(brain.state,social?'knocking':'reading');
  }
});

test('opening sleep and the cat sofa share the relocated habitation deck',()=>{
  const actor=new CrewMotion(),care=new Supplies(),cat=new CatRoutine(care,{random:()=>.5});
  assert.equal(cat.motion.floor,DECK.HABITATION);assert(cat.motion.onSofa);
  const brain=new CabinBrain({obsUI:{}},actor,{care,random:()=>.8});brain.catRoutine=cat;brain.beginWakeUp();
  assert.equal(actor.floor,DECK.HABITATION);assert.equal(actor.y,FLOORS[DECK.HABITATION].y);
  assert.equal(cat.motion.floor,actor.floor);assert.equal(cat.motion.y,actor.y);
});

test('fixture geometry, pick targets, signs and lights use the same new deck heights',()=>{
  const ctx=new Proxy({measureText:t=>({width:t.length*8}),createLinearGradient:()=>({addColorStop(){}})},{get:(o,k)=>k in o?o[k]:()=>{}});
  const material=new MeshStandardMaterial();let ship;
  globalThis.document={createElement:()=>({getContext:()=>ctx})};
  try{ship=buildShip(new Proxy({},{get:()=>material}));}finally{delete globalThis.document;}
  for(const station of STATIONS){
    const mesh=ship.targets.find(m=>m.userData.station===station.id),bounds=new Box3().setFromObject(mesh);
    const floor=positionY(FLOORS[station.floor].y);
    assert(bounds.min.y>=floor-.1&&bounds.max.y<floor+3.1,station.id+' pick target must follow its equipment');
  }
  assert.equal(ship.bunk.root.position.y,FLOOR_Y[DECK.HABITATION]);
  const waterX=positionX(getStation('hydro').x),gate=REAR_ROOM_GATES[2];
  assert(getStation('hydro').x<originalStation('hydro').x,'move only the 3D water station left');
  assert(waterX+1.25/2<gate.x-(gate.width+.30)/2-.15,'water cabinet leaves clearance beside the full-width frame');
  assert.equal(ship.targets.find(m=>m.userData.station==='hydro').position.x,waterX);
  assert.equal(ship.diningDocks.hydro.mug.position.x,waterX-.17);
  const bedBounds=new Box3().setFromObject(ship.medical.bed);
  assert(bedBounds.min.y>=FLOOR_Y[DECK.OPERATIONS]);
  assert.equal(ship.innerDoor.position.y,FLOOR_Y[DECK.OPERATIONS]+1.38);
  for(const [i,floor]of FLOORS.entries()){
    const sign=ship.staticMesh.getObjectByName(`Sign: ${String(i+1).padStart(2,'0')} / ${floor.name}`);
    assert(sign);const b=new Box3().setFromObject(sign);assert(b.min.y>FLOOR_Y[i]+2);
  }
  for(const root of [ship.staticMesh,ship.animated])root.traverse(o=>o.geometry?.dispose());material.dispose();
});
