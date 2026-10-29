import test from 'node:test';
import assert from 'node:assert/strict';
import {Box3,Raycaster,Vector3} from 'three';
import {buildSurfaceFixture,disposeSurfaceFixture} from './helpers/cabin-surface-fixture.js';
import {ASHTRAY,DECK} from '../src/obs/layout.js';
import {FLOOR_Y} from '../src/obs/ship.js';

test('service panels occupy the selected bunk, gym, ashtray and lounge walls',()=>{
  const ship=buildSurfaceFixture();
  try{
    const root=ship.staticMesh;
    const bunk=root.getObjectByName('Bunk service parts / cassette');
    const gym=root.getObjectByName('Gym service parts / manifold');
    const gymWeights=root.getObjectByName('Gym dumbbell wall plate');
    const ashtray=root.getObjectByName('Ashtray service parts / rack');
    const lounge=root.getObjectByName('Lounge service parts / rack');
    assert.ok(bunk?.getObjectByName('flush painted service door'));
    assert.ok(gym?.getObjectByName('valve body'));
    assert.ok(gymWeights);
    assert.ok(ashtray?.getObjectByName('service cartridge 1'));
    assert.ok(lounge?.getObjectByName('service cartridge 1'));
    assert.equal(root.getObjectByName('Wall switches / Lounge lighting'),undefined);
    assert.equal(bunk.position.y,FLOOR_Y[DECK.HABITATION]+1.95);
    assert.equal(bunk.scale.x,.43);
    assert.equal(gym.position.y,FLOOR_Y[DECK.LIFE_SUPPORT]+1.95);
    assert.ok(Math.abs(new Box3().setFromObject(gym).max.x-new Box3().setFromObject(gymWeights).max.x)<.02);
    assert.equal(ashtray.position.x,ASHTRAY.x);
    assert.equal(lounge.position.x,6.37);
    assert.ok(new Box3().setFromObject(ashtray).min.y>FLOOR_Y[DECK.HABITATION]+ASHTRAY.y+.3);
    const oldPipes=[];
    root.traverse(mesh=>{
      if(mesh.geometry?.type!=='CylinderGeometry'||Math.abs(mesh.geometry.parameters.radiusTop-.049)>1e-6)return;
      if(Math.abs(mesh.position.z+1.23)>.07)return;
      if(Math.abs(mesh.position.x+4.2)<.8||Math.abs(mesh.position.x-1.65)<.7)oldPipes.push(mesh);
    });
    assert.equal(oldPipes.length,0);
    const cabinets=[];
    root.traverse(object=>{if(object.name==='Wall auxiliary control cabinet')cabinets.push(object);});
    assert.ok(cabinets.every(cabinet=>
      Math.abs(cabinet.position.x-ASHTRAY.x)>.5||
      Math.abs(cabinet.position.y-(FLOOR_Y[DECK.HABITATION]+1.73))>.5));
  }finally{disposeSurfaceFixture(ship);}
});

test('all rear auxiliary cabinets sit flush against the actual wall lining',()=>{
  const ship=buildSurfaceFixture();
  try{
    const root=ship.staticMesh,cabinets=[];
    root.updateMatrixWorld(true);
    root.traverse(object=>{if(object.name==='Wall auxiliary control cabinet')cabinets.push(object);});
    assert.equal(cabinets.length,3);
    // Select the ship's lining meshes, not a mock wall or the cabinet itself.
    const lining=root.children.filter(object=>object.isMesh&&
      (Math.abs(object.position.z+1.636)<1e-6||object.name==='Bulkhead with octagonal opening'));
    const ray=new Raycaster(new Vector3(),new Vector3(0,0,-1));
    for(const cabinet of cabinets){
      const bounds=new Box3().setFromObject(cabinet),center=bounds.getCenter(new Vector3());
      for(const [dx,dy] of [[0,0],[-.12,-.3],[.12,-.3],[-.12,.3],[.12,.3]]){
        ray.ray.origin.set(center.x+dx,center.y+dy,0);
        const hit=ray.intersectObjects(lining,false)[0];
        assert.ok(hit,`wall behind cabinet at ${cabinet.position.toArray()}`);
        assert.ok(Math.abs(bounds.min.z-hit.point.z)<1e-5,
          `cabinet at ${cabinet.position.toArray()} floats ${bounds.min.z-hit.point.z}m from its wall`);
      }
    }
  }finally{disposeSurfaceFixture(ship);}
});
