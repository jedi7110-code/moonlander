import test from 'node:test';
import assert from 'node:assert/strict';
import {Box3,MeshStandardMaterial,Raycaster,Vector3} from 'three';
import {createRearRoomFurnishings} from '../src/obs/rear-room-furnishings.js';
import {createOperationsStorage,createOperationsFurnishings} from '../src/obs/galley-storage.js';
import {createGalleyFinishes} from '../src/obs/galley.js';
import {buildSurfaceFixture,disposeSurfaceFixture} from './helpers/cabin-surface-fixture.js';
import {batchStatic} from '../src/obs/materials.js';

function materials(){const mat=new MeshStandardMaterial();return new Proxy({},{get:()=>mat});}
function room(name){return createRearRoomFurnishings(materials(),{room:name,x:0,floor:0});}

test('storage uses the kitchen finishes, retained inserts and dark stores backing',()=>{
  const palette=materials(),stores=createRearRoomFurnishings(palette,{room:'stores',x:0,floor:0}),
    laundry=createRearRoomFurnishings(palette,{room:'laundry',x:0,floor:0}),reference=createGalleyFinishes();
  assert.equal(stores.userData.storageHardware,laundry.userData.storageHardware,'reuse print atlas and materials for static batching');
  assert.equal(createOperationsFurnishings(palette).userData.storageHardware,stores.userData.storageHardware);
  for(const root of [stores,laundry]){
    const f=root.userData.storageHardware;
    for(const key of ['metal','paint','dark','red']){
      assert.ok(f[key].color.equals(reference[key].color),key);
      assert.equal(f[key].metalness,reference[key].metalness);
      assert.equal(f[key].roughness,reference[key].roughness);
    }
    assert.ok(root.getObjectByName('Storage / flush U handle'));
    assert.ok(root.getObjectByName('Galley / storage red restraint'));
    let lights=0;root.traverse(o=>{if(o.isLight)lights++;});assert.equal(lights,0);
  }
  const liner=stores.getObjectByName('Storage / washable rear liner');
  assert.equal(liner.material,stores.userData.storageHardware.dark);
  assert.equal(laundry.getObjectByName('Open clothes closet').getObjectByName('Storage / washable rear liner').material,
    laundry.userData.storageHardware.dark,'the open wardrobe also has the dark liner');
  assert.equal(laundry.getObjectByName('Washer rotating clothes').visible,false);
  assert.ok(laundry.getObjectByName('Laundry bin load'));
  assert.equal(stores.getObjectsByProperty('name','Galley / stowage insert face').length,2);
  const batch=batchStatic(stores);assert.ok(batch.children.length<=9);
});

test('paper rolls rest on the carrier with three below and two nested above',()=>{
  const root=room('stores'),rolls=root.getObjectsByProperty('name','Paper roll');
  assert.equal(rolls.length,5);root.updateMatrixWorld(true);
  const lower=rolls.filter(o=>o.userData.stackRow===0),upper=rolls.filter(o=>o.userData.stackRow===1);
  assert.equal(lower.length,3);assert.equal(upper.length,2);
  for(const roll of lower){
    const bounds=new Box3().setFromObject(roll),center=bounds.getCenter(new Vector3());
    const ray=new Raycaster(new Vector3(center.x,bounds.min.y+.002,center.z),new Vector3(0,-1,0));
    const hit=ray.intersectObjects(root.getObjectsByProperty('name','Storage / tray carrier'),false)[0];
    assert.equal(hit.object.name,'Storage / tray carrier');
    assert.ok(Math.abs(bounds.min.y-hit.point.y)<1e-6,'no air gap under the bottom row');
  }
  upper.forEach((roll,i)=>{
    for(const support of lower.slice(i,i+2))assert.ok(Math.abs(roll.position.distanceTo(support.position)-.21)<1e-9);
    assert.ok(roll.position.x>lower[i].position.x&&roll.position.x<lower[i+1].position.x);
  });
});

test('operations rack retains every case inside the old side-wall service envelope',()=>{
  const root=createOperationsStorage(materials());
  assert.equal(root.getObjectsByProperty('name','Operations / retained service case').length,12);
  assert.equal(root.getObjectByName('Storage / washable rear liner').material,root.userData.storageHardware.dark);
  root.rotation.y=Math.PI/2;root.position.set(-1.11,0,-3.79);
  const bounds=new Box3().setFromObject(root);
  assert.ok(bounds.min.x>=-1.12-1e-6&&bounds.max.x<-.65,'leave the central path clear');
  assert.ok(bounds.min.z> -4.5&&bounds.max.z< -3.1,'keep the entry and terminal free');
  let triangles=0;root.traverse(o=>{if(o.geometry)triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;});
  assert.ok(triangles<7000,`${triangles} triangles`);
});

test('operations desk faces the window centrally and its galley cabinet leaves the aisle and knee space clear',()=>{
  const root=createOperationsFurnishings(materials());root.updateMatrixWorld(true);
  const desk=root.getObjectByName('Operations / window-centred desk'),top=root.getObjectByName('Operations / desk worktop');
  assert.equal(desk.position.x,0);
  const topBounds=new Box3().setFromObject(top);
  assert.ok(topBounds.max.y<1.0,'desk is below the pressure-window sill');
  assert.ok(topBounds.min.z> -5.57&&topBounds.max.z< -4.8,'desk sits just in front of the rear wall');
  const ray=new Raycaster(new Vector3(0,.45,-4.6),new Vector3(0,0,-1),0,.92);
  assert.equal(ray.intersectObject(desk,true).length,0,'usable knee opening below the desk');
  const cabinet=root.getObjectByName('Operations / galley right cabinet'),bounds=new Box3().setFromObject(cabinet);
  assert.ok(bounds.min.x>.53&&bounds.max.x<1.13,'cabinet stays against the right wall');
  assert.ok(bounds.min.z>topBounds.max.z,'cabinet does not overlap the centred desk');
  assert.equal(cabinet.getObjectsByProperty('name','Galley / stowage insert face').length,2);
  const cabinetTop=root.getObjectByName('Operations / right cabinet worktop');
  for(const load of root.getObjectsByProperty('name','Operations / bench service case')){
    const b=new Box3().setFromObject(load);
    assert.ok(Math.abs(b.min.y-new Box3().setFromObject(cabinetTop).max.y)<1e-6);
  }
  assert.equal(desk.getObjectByName('Operations / desk worktop').material,root.userData.storageHardware.metal);
});

test('all three dumbbells retain two matching metal weights after the rack relocation',()=>{
  const ship=buildSurfaceFixture();
  try{
    const root=ship.staticMesh,weights=root.getObjectsByProperty('name','Machined dumbbell weight');
    const grips=root.getObjectsByProperty('name','Machined dumbbell grip');
    assert.equal(weights.length,6);assert.equal(grips.length,3);
    assert.ok(weights.every(w=>w.material===weights[0].material&&w.material.metalness>.9));
    root.updateMatrixWorld(true);
    for(const grip of grips){
      const pair=weights.filter(w=>Math.abs(w.position.y-grip.position.y)<1e-6);
      assert.equal(pair.length,2);
      assert.ok(Math.abs((pair[0].position.x+pair[1].position.x)/2-grip.position.x)<1e-9);
      for(const weight of pair){
        const ray=new Raycaster(weight.position.clone().add(new Vector3(0,0,.4)),new Vector3(0,0,-1));
        assert.equal(ray.intersectObject(root,true)[0].object,weight,'both ends remain visible from the aisle');
      }
    }
    assert.ok(root.getObjectByName('Operations / galley service rack'));
  }finally{disposeSurfaceFixture(ship);}
});
