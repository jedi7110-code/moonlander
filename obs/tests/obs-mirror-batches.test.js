import test from 'node:test';
import assert from 'node:assert/strict';
import {Box3,BoxGeometry,Group,Matrix4,Mesh,MeshBasicMaterial,PerspectiveCamera,Raycaster,Scene,Vector2,Vector3} from 'three';
import {batchStatic} from '../src/obs/materials.js';
import {createMirrorBatchFilter,createMirrorRoomVisibility} from '../src/obs/mirror-batches.js';
import {buildSurfaceFixture,disposeSurfaceFixture} from './helpers/cabin-surface-fixture.js';

test('camera turns select fixtures without copying vertices, changing materials or losing edge-crossing objects',()=>{
  const source=new Group(),scene=new Scene(),material=new MeshBasicMaterial(),box=new BoxGeometry(.5,.5,.5);
  for(const x of [-6,0,6]){const part=new Mesh(box,material);part.position.set(x,0,-4);source.add(part);}
  const root=batchStatic(source),mesh=root.children[0],original=mesh.geometry;
  const outline=new Mesh(original,new MeshBasicMaterial());root.add(outline);scene.add(root);
  const camera=new PerspectiveCamera(40,1,.1,40);camera.updateMatrixWorld();scene.updateMatrixWorld(true);
  const filter=createMirrorBatchFilter();
  for(const x of [0,6,-6,0]){
    camera.position.x=x;camera.updateMatrixWorld(true);filter.begin(scene,camera);
    const selected=mesh.geometry;
    assert.equal(selected,outline.geometry,'the outline reuses the filtered index buffer');
    assert.equal(selected.drawRange.count,36);
    assert.equal(mesh.material,material);
    for(const name of Object.keys(original.attributes))assert.equal(selected.attributes[name],original.attributes[name]);
    const index=x===-6?0:x===0?1:2;
    assert.deepEqual(Array.from(selected.index.array.slice(0,36)),Array.from(original.index.array.slice(index*36,(index+1)*36)));
    filter.end();assert.equal(mesh.geometry,original);assert.equal(outline.geometry,original);
  }
  // A fixture intersecting an edge must stay whole (including bevel/outline guard).
  camera.position.x=4.65;camera.updateMatrixWorld(true);filter.begin(scene,camera);
  assert.ok(mesh.visible);assert.equal(mesh.geometry.drawRange.count,36);filter.end();
  // Hidden parents remain hidden; an empty frustum restores the child's own visibility.
  root.visible=false;filter.begin(scene,camera);assert.equal(filter.stats.sourceTriangles,0);filter.end();root.visible=true;
  camera.position.x=50;camera.updateMatrixWorld(true);filter.begin(scene,camera);assert.equal(mesh.visible,false);
  filter.end();assert.equal(mesh.visible,true);assert.equal(mesh.geometry,original);
  // Disposing the alternate must not dispose shared vertex buffers or materials.
  camera.position.x=0;camera.updateMatrixWorld(true);filter.begin(scene,camera);
  const filtered=mesh.geometry;let disposed=0;
  filtered.addEventListener('dispose',()=>{disposed++;assert.deepEqual(Object.keys(filtered.attributes),[]);});
  filter.dispose();assert.equal(disposed,1);assert.equal(filter.stats.indexBytes,0);assert.equal(mesh.geometry,original);
  original.dispose();box.dispose();material.dispose();outline.material.dispose();
});

test('solid walls exclude other rooms while the doorway conservatively retains corridor objects',()=>{
  const room={bounds:new Box3(new Vector3(-1,0,-4),new Vector3(1,3,0)),portal:{left:-.8,right:.8,bottom:0,top:2.6,z:0}};
  const volume=createMirrorRoomVisibility(room),camera=new PerspectiveCamera();
  camera.position.set(0,1.5,-3);camera.updateMatrixWorld();volume.update(camera);
  const matrix=new Matrix4(),bounds=(x,y,z)=>new Box3().setFromCenterAndSize(new Vector3(x,y,z),new Vector3(.15,.15,.15));
  assert.ok(volume.intersects(bounds(0,1,-2),matrix),'interior');
  assert.ok(volume.intersects(bounds(0,1.5,3),matrix),'visible through the open doorway');
  assert.ok(volume.intersects(bounds(1.6,1.5,3),matrix),'touching the portal edge is conservative');
  assert.equal(volume.intersects(bounds(5,1.5,-2),matrix),false,'behind the side wall');
  assert.equal(volume.intersects(bounds(5,1.5,2),matrix),false,'corridor outside the doorway cone');
  assert.equal(volume.intersects(bounds(0,6,-2),matrix),false,'another floor');
  assert.equal(volume.intersects(bounds(0,1.5,-6),matrix),false,'behind the rear wall');
  matrix.makeTranslation(-5,0,0);assert.ok(volume.intersects(bounds(5,1,-2),matrix),'respect parent transforms');
});

test('the actual laundry reflection keeps its nearest surfaces while discarding distant ship fixtures',()=>{
  const ship=buildSurfaceFixture(),batches=batchStatic(ship.staticMesh),scene=new Scene();scene.add(batches);
  const filter=createMirrorBatchFilter({room:ship.groomingStation.mirrorRoom});
  const camera=new PerspectiveCamera(58,1,.025,150),ray=new Raycaster(),ndc=new Vector2();
  scene.updateMatrixWorld(true);
  try{
    // In front of the mirror plane: right wall, doorway and rear wardrobe views.
    for(const target of [[0,5.02,-3.22],[-1.5,5.02,-.5],[-1.8,5.02,-5.5]]){
      camera.position.set(-2.90,5.02,-3.22);camera.lookAt(...target);camera.updateMatrixWorld(true);
      const samples=[];
      for(const x of [-.8,0,.8])for(const y of [-.8,0,.8]){
        ndc.set(x,y);ray.setFromCamera(ndc,camera);
        samples.push({ndc:ndc.clone(),hit:ray.intersectObject(batches,true)[0]?.point.clone()});
      }
      filter.begin(scene,camera);
      assert.ok(filter.stats.selectedTriangles<filter.stats.sourceTriangles*.15,JSON.stringify(filter.stats));
      for(const sample of samples){
        ray.setFromCamera(sample.ndc,camera);
        // Raycaster does not check visibility; the renderer does.
        const hit=ray.intersectObjects(batches.children.filter(mesh=>mesh.visible),false)[0]?.point;
        assert.equal(Boolean(hit),Boolean(sample.hit));
        if(hit)assert.ok(hit.distanceTo(sample.hit)<1e-6,`visible surface lost toward ${target}`);
      }
      filter.end();
    }
  }finally{filter.dispose();batches.children.forEach(mesh=>mesh.geometry.dispose());disposeSurfaceFixture(ship);}
});
