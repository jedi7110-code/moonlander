import test from 'node:test';
import assert from 'node:assert/strict';
import {Box3,Vector3,MeshStandardMaterial,Raycaster} from 'three';
import {createCoffeeMachine,createCoffeePrint} from '../src/obs/coffee-machine.js';
import {createLoungeCoffeeStation} from '../src/obs/cabin-dressing.js';
import {batchStatic} from '../src/obs/materials.js';
import {createCabinToon} from '../src/obs/cabin-toon.js';
import {createLoungeTitanium} from '../src/obs/machined-metals.js';
import {createLoungeCoffee} from '../src/obs/lounge-table-props.js';
import {createLoungeTable} from '../src/obs/ship.js';
import {createMaintenanceSprayPrint} from '../src/obs/maintenance-spray.js';
import {buildSurfaceFixture,disposeSurfaceFixture} from './helpers/cabin-surface-fixture.js';

function stub(t){
  const previous=globalThis.document,printed=[];
  const ctx=new Proxy({fillText:s=>printed.push(s),measureText:s=>({width:s.length*8})},{get:(o,k)=>o[k]??(()=>{})});
  globalThis.document={createElement:()=>({getContext:()=>ctx})};
  t.after(()=>{if(previous===undefined)delete globalThis.document;else globalThis.document=previous;});return printed;
}
const bounds=o=>new Box3().setFromObject(o);
function dispose(root){
  const resources=new Set();root.traverse(o=>{if(o.geometry)resources.add(o.geometry);if(o.material){resources.add(o.material);for(const v of Object.values(o.material))if(v?.isTexture)resources.add(v);}});
  resources.forEach(r=>r.dispose());
}

test('coffee uses a single static half-1K control atlas with both beverage types',t=>{
  const printed=stub(t),map=createCoffeePrint();t.after(()=>map.dispose());
  assert.equal(map.image.width,1024);assert.equal(map.image.height,512);
  for(const value of ['ESPRESSO','AMERICANO','PLACE YOUR MUG','TARAIRON','MUG ONLY'])assert.ok(printed.includes(value),value);
});

test('study machine uses the same satin titanium finish as the lounge legs for every metal part',t=>{
  stub(t);const machine=createCoffeeMachine(),reference=createLoungeTitanium();
  t.after(()=>{dispose(machine);reference.bumpMap.dispose();reference.dispose();});
  const metal=machine.getObjectByName('Coffee / machined side cheek').material;
  for(const key of ['roughness','metalness','bumpScale','envMapIntensity','anisotropy','anisotropyRotation'])assert.equal(metal[key],reference[key],key);
  assert.ok(metal.color.equals(reference.color));assert.equal(metal.roughnessMap,null);
  machine.traverse(o=>{if(o.material?.metalness>.5)assert.equal(o.material,metal,`${o.name}: no alternate aluminium or champagne trim`);});
  assert.notEqual(machine.getObjectByName('Coffee / control fascia').material,metal,'keep the graphite panel');
});

test('a real mug bay has clear headroom, separate water outlet, grid support and bounded rendering cost',t=>{
  stub(t);const machine=createCoffeeMachine();t.after(()=>dispose(machine));machine.updateMatrixWorld(true);
  const mug=machine.getObjectByName('Coffee / TARAIRON mug'),cup=bounds(mug);
  const nozzles=machine.children.filter(o=>o.name==='Coffee / espresso nozzle');assert.equal(nozzles.length,2);
  for(const nozzle of nozzles)assert.ok(bounds(nozzle).min.y-cup.max.y>.05);
  assert.ok(machine.getObjectByName('Coffee / independent hot water spout'));
  assert.ok(Math.abs(cup.min.y-.185)<.002,'mug rests on top of the drain grate');
  const mugFront=mug.getWorldPosition(new Vector3()).add(new Vector3(0,.07,.7));
  const ray=new Raycaster(mugFront,new Vector3(0,0,-1)),hit=ray.intersectObject(machine,true)[0];
  assert.equal(hit.object.name,'Table cup','the recess is not occluded by a flat body panel');
  let triangles=0,lights=0;const printed=[];
  machine.traverse(o=>{if(o.isLight)lights++;if(o.geometry)triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;if(o.name.endsWith(' print'))printed.push(o);});
  assert.equal(lights,0,'no extra lights or render targets');
  assert.ok(triangles<6000,`${triangles} triangles`);
  assert.equal(new Set(printed.map(o=>o.material.map)).size,1);
  const batch=batchStatic(machine,{xrLOD:true});t.after(()=>dispose(batch));assert.ok(batch.children.length<=10);
  const toon=createCabinToon([batch]);toon.setStyle('cartoon');t.after(()=>toon.dispose());
  for(const o of batch.children)if(o.material.name.startsWith('Coffee /')&&o.material.map)assert.ok(o.material.userData.cabinKeepSurface||o.material.userData.cabinAlwaysPowered);
});

test('the original hard case remains below the coffee machine without intersecting or obstructing the aisle',t=>{
  stub(t);const standard=new MeshStandardMaterial(),m={rubber:standard,dark:standard,metal:standard},station=createLoungeCoffeeStation(m,standard);
  t.after(()=>dispose(station));
  const machine=station.userData.coffeeMachine,bag=station.userData.hardCase;
  assert.ok(bag.getObjectByName('Equipment label / parts'));
  const a=bounds(machine),b=bounds(bag);assert.ok(!a.intersectsBox(b));
  assert.ok(a.min.y-b.max.y>.05,'visible vertical clearance above the case and service can');
  assert.ok(b.max.z<0&&a.max.z<0,'both stay behind the walking aisle');
  assert.ok(a.max.x<.66&&a.min.x>-.66,'fits between the sofa and cupboard');
});

test('maintenance spray rests on the case beside its handle, with one small printed can wall',t=>{
  const printed=stub(t),map=createMaintenanceSprayPrint();t.after(()=>map.dispose());
  assert.equal(map.image.width,256);assert.equal(map.image.height,256);
  for(const text of ['MAINTENANCE','DRY FILM','HINGES / LATCHES / GUIDES','NON-FOOD CONTACT'])assert.ok(printed.includes(text));
  const material=new MeshStandardMaterial(),m={dark:material,rubber:material,metal:material},station=createLoungeCoffeeStation(m,material);
  t.after(()=>dispose(station));station.updateMatrixWorld(true);
  const spray=station.userData.maintenanceSpray,bag=station.userData.hardCase,body=bag.getObjectByName('Case body');
  assert.equal(spray.parent,bag,'placement follows the case orientation');
  const center=spray.getWorldPosition(new Vector3()),support=new Raycaster(center.clone().add(new Vector3(0,.01,0)),new Vector3(0,-1,0)).intersectObject(body)[0];
  assert.ok(support&&Math.abs(support.point.y-center.y)<1e-6,'foot contacts the case without floating or sinking');
  const can=bounds(spray),machine=bounds(station.userData.coffeeMachine);
  assert.ok(machine.min.y-can.max.y>.05);assert.ok(can.max.z<0,'can remains behind the aisle');
  const others=bag.children.filter(o=>o!==spray&&o!==body);
  // Compare in the case frame, so its yaw does not inflate the lid's AABB
  // across the narrow, actually empty gap behind it.
  const caseLocalCan=bounds(spray.clone());
  for(const part of others)assert.ok(!caseLocalCan.intersectsBox(bounds(part.clone())),`${part.name}: clear of handle, latches and lid`);
  let triangles=0,lights=0;const maps=new Set();spray.traverse(o=>{
    if(o.geometry)triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;
    if(o.material?.map)maps.add(o.material.map);if(o.isLight)lights++;
  });
  assert.ok(triangles<650,`${triangles} triangles`);assert.equal(lights,0);assert.equal(maps.size,1);
  const batch=batchStatic(spray,{xrLOD:true});t.after(()=>dispose(batch));assert.equal(batch.children.length,3);
  const ink=spray.getObjectByName('Maintenance spray / printed can').material;
  const toon=createCabinToon([batch]);toon.setStyle('cartoon');t.after(()=>toon.dispose());
  assert.ok(batch.children.some(o=>o.material===ink),'print survives OBS batching and cartoon styling');
});

test('the empty mug parks on the left with its handle diagonally toward the aisle',t=>{
  stub(t);const machine=createCoffeeMachine(),tableMug=createLoungeCoffee();t.after(()=>{dispose(machine);dispose(tableMug);});
  machine.updateMatrixWorld(true);
  const mug=machine.userData.coffee.mug,body=mug.getObjectByName('Table cup'),cup=bounds(body);
  assert.equal(mug.getObjectByName('Table coffee surface'),undefined);
  assert.equal(mug.getObjectByName('Coffee meniscus'),undefined);
  assert.ok(tableMug.getObjectByName('Table coffee surface'),'the lounge table mug stays filled');
  const center=mug.getWorldPosition(new Vector3()),handle=mug.getObjectByName('Table cup handle').getWorldPosition(new Vector3()).sub(center);
  assert.ok(handle.x>.04&&handle.z>.04,'handle points diagonally forward, not sideways or into the back wall');
  assert.ok(new Vector3(0,1,0).transformDirection(mug.matrixWorld).y>.999,'cup stays upright on the grid');
  assert.ok(cup.min.x>-.37&&cup.max.x<-.20,'cup is fully in the left spare area');
  assert.ok(cup.min.z>-.135&&cup.max.z<.295,'base is supported inside the drain grate');
  const nozzles=machine.children.filter(o=>o.name==='Coffee / espresso nozzle');
  for(const nozzle of nozzles)assert.ok(bounds(mug).max.x<bounds(nozzle).min.x-.04,'clear of the dispensing position');
  const bottom=new Raycaster(center.clone().add(new Vector3(0,.4,0)),new Vector3(0,-1,0)).intersectObject(mug,true)[0];
  assert.equal(bottom.object,body,'empty ceramic interior is visible, not a hidden liquid surface');
  assert.ok(Math.abs(bottom.point.y-(center.y+.012*mug.scale.y))<1e-6,'ray reaches the ceramic bottom');
});

test('the table mug matches the vending mug size and rests casually angled on the book',t=>{
  stub(t);const machine=createCoffeeMachine(),material=new MeshStandardMaterial();
  const table=createLoungeTable(new Proxy({},{get:()=>material}));
  t.after(()=>{dispose(machine);dispose(table);});table.updateMatrixWorld(true);machine.updateMatrixWorld(true);
  const cup=table.getObjectByName('Lounge coffee mug'),reference=machine.userData.coffee.mug;
  assert.ok(cup.getWorldScale(new Vector3()).distanceTo(reference.getWorldScale(new Vector3()))<1e-9);
  const body=new Box3().setFromObject(cup.getObjectByName('Table cup'),true),book=bounds(table.getObjectByName('Table book'));
  assert.ok(Math.abs(body.max.y-body.min.y-(bounds(reference).max.y-bounds(reference).min.y))<1e-7,'same cup height');
  assert.ok(Math.abs(body.min.y-book.max.y)<1e-7,'larger mug still rests on the book');
  assert.ok(body.min.x>book.min.x&&body.max.x<book.max.x&&body.min.z>book.min.z&&body.max.z<book.max.z,'cup body stays over the book');
  const handle=cup.getObjectByName('Table cup handle').getWorldPosition(new Vector3()).sub(cup.getWorldPosition(new Vector3()));
  assert.ok(handle.x<-.04&&handle.z>.03,'handle points diagonally left and toward the viewer');
  assert.ok(new Vector3(0,1,0).transformDirection(cup.matrixWorld).y>.999,'no unnatural tipping');
  assert.ok(cup.getObjectByName('Table coffee surface'),'table coffee is preserved');
});

test('service decal sits only on the open lounge-side cheek, upright and clear of the metal',t=>{
  stub(t);const machine=createCoffeeMachine();t.after(()=>dispose(machine));machine.updateMatrixWorld(true);
  const decals=machine.children.filter(o=>o.name==='Coffee / service print');assert.equal(decals.length,1);
  const decal=decals[0],normal=new Vector3(0,0,1).transformDirection(decal.matrixWorld);
  assert.ok(normal.distanceTo(new Vector3(-1,0,0))<1e-9,'faces toward the lounge, away from the neighbouring cupboard');
  const cheek=machine.children.find(o=>o.name==='Coffee / machined side cheek'&&o.position.x<0),side=bounds(cheek),label=bounds(decal);
  assert.ok(side.min.x-label.max.x>.003&&side.min.x-label.max.x<.006,'not coplanar with the outer metal face');
  assert.ok(label.min.z>side.min.z+.05&&label.max.z<side.max.z-.05,'decal fits inside the side panel');
  assert.ok(new Vector3(0,1,0).transformDirection(decal.matrixWorld).y>.999,'lettering stays upright');
  const {width,height}=decal.geometry.parameters;
  for(const x of [-.45,0,.45])for(const y of [-.45,0,.45]){
    const origin=decal.localToWorld(new Vector3(x*width,y*height,.12));
    assert.equal(new Raycaster(origin,normal.clone().negate()).intersectObject(machine,true)[0].object,decal,'all corners are readable from the side');
  }
});

test('OBS includes the same coffee station and removes only the targeted towel and pipe bay',()=>{
  const ship=buildSurfaceFixture();try{
    const station=ship.staticMesh.getObjectByName('Lounge coffee station');assert.ok(station);
    assert.deepEqual(station.position.toArray(),[10.2,3.392,0]);
    assert.ok(station.getObjectByName('Atelier coffee vending machine'));
    assert.ok(station.getObjectByName('Maintenance spray can'));
    const leg=ship.staticMesh.getObjectByName('Sofa floor-reaching arm');
    const metal=station.getObjectByName('Coffee / machined side cheek').material;
    assert.equal(metal,leg.material,'OBS shares the exact leg material and texture, not a new copy');
    assert.equal(ship.staticMesh.getObjectByName('Rear wall pipe bundle / ラウンジ右端'),undefined);
    assert.ok(ship.staticMesh.getObjectByName('Rear wall pipe bundle / ラウンジ入口'));
    const cases=[];ship.staticMesh.traverse(o=>{if(o.getObjectByName&&o.children.some(c=>c.name==='Case lid'))cases.push(o);});
    assert.equal(cases.length,4);
    const oldTowel=ship.staticMesh.getObjectByName('Cabin dressing').children.find(o=>o.isMesh&&o.geometry.type==='PlaneGeometry'&&o.position.x===10.2);
    assert.equal(oldTowel,undefined);
  }finally{disposeSurfaceFixture(ship);}
});
