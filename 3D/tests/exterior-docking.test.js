import test from 'node:test';
import assert from 'node:assert/strict';
import {Raycaster,Vector3} from 'three';
import {createExteriorShip} from '../src/obs/ship-exterior.js';
import {createProductionExterior} from '../src/obs/exterior-production.js';
import {PROBE_DOCK} from '../src/obs/exterior-docking.js';
import {applyExteriorProbePose,sampleExteriorProbeFlight} from '../src/obs/exterior-probe-flight.js';
import {createLander} from '../src/js/models.js';

function passageHits(ship,x,z){
  const surfaces=[];ship.root.updateMatrixWorld(true);
  ship.root.traverseVisible(mesh=>{if(mesh.isMesh&&!mesh.material.transparent)surfaces.push(mesh);});
  const origin=ship.probeDock.localToWorld(new Vector3(x,4.0,z));
  const direction=new Vector3(0,1,0).transformDirection(ship.probeDock.matrixWorld);
  return new Raycaster(origin,direction,0,4.20).intersectObjects(surfaces,false);
}

test('a real 1.20m transfer passage clears both hulls, fittings and the suited crew envelope',async()=>{
  const ship=createProductionExterior();
  try{
    await ship.prepareProbe();
    for(const scale of [1,1.6,2.6,2.8]){
      ship.setCoreScale(scale);ship.setDockTransferOpen(true);
      const points=[[0,0],...[-1,1].flatMap(x=>[-1,1].map(z=>[x*PROBE_DOCK.suitWidth/2,z*PROBE_DOCK.suitDepth/2]))];
      for(let index=0;index<32;index++)points.push([Math.cos(index*Math.PI/16)*.595,Math.sin(index*Math.PI/16)*.595]);
      for(const [x,z]of points){
        const hits=passageHits(ship,x,z);
        assert.equal(hits.length,0,`clear from probe cabin through mother hull at scale ${scale}, (${x.toFixed(3)}, ${z.toFixed(3)}): ${hits[0]?.object.name}`);
      }
    }
    assert.ok(Math.hypot(PROBE_DOCK.suitWidth/2,PROBE_DOCK.suitDepth/2)<PROBE_DOCK.clearDiameter/2);
  }finally{ship.dispose();}
});

test('two independent pressure hatches close the passage and swing clear without resizing',()=>{
  const ship=createExteriorShip();
  try{
    ship.setCoreScale(2.6);assert.equal(ship.dockHatches.length,2);
    const geometry=ship.dockHatches.map(hatch=>hatch.children[0].geometry);
    for(const open of [false,true,false,true]){
      ship.setDockTransferOpen(open);ship.root.updateMatrixWorld(true);
      for(const [index,hatch]of ship.dockHatches.entries()){
        assert.equal(hatch.children[0].geometry,geometry[index]);
        assert.deepEqual(hatch.scale.toArray(),[1,1,1]);
        const origin=ship.probeDock.localToWorld(new Vector3(0,4,0));
        const hits=new Raycaster(origin,new Vector3(0,1,0),0,4.20).intersectObject(hatch,true);
        assert.equal(hits.length>0,!open,'each leaf independently isolates its own pressure volume');
      }
    }
  }finally{ship.dispose();}
});

test('the probe docking half follows approach while the mother pressure coupling stays on the hull',()=>{
  const ship=createExteriorShip();
  try{
    ship.setCoreScale(2.6);ship.root.updateMatrixWorld(true);
    const mother=ship.dockHatches[1].getWorldPosition(new Vector3());
    for(const seconds of [0,8,14,20]){
      applyExteriorProbePose(ship,sampleExteriorProbeFlight(seconds));ship.root.updateMatrixWorld(true);
      assert.ok(ship.dockHatches[1].getWorldPosition(new Vector3()).distanceTo(mother)<1e-9);
      assert.equal(ship.dockHatches[0].parent,ship.dockedLander);
      assert.equal(ship.dockHatches[0].rotation.z,0,'normal film playback does not open an unverified airlock');
    }
  }finally{ship.dispose();}
});

test('cutting the exterior docking opening does not cut the shared game lander roof',()=>{
  const game=createLander({labels:false}),meshes=[];game.updateMatrixWorld(true);
  game.traverse(mesh=>{if(mesh.isMesh)meshes.push(mesh);});
  const roof=()=>new Raycaster(new Vector3(0,6.5,0),new Vector3(0,-1,0)).intersectObjects(meshes,false)[0].point.y;
  const before=roof(),ship=createExteriorShip();
  try{assert.ok(Math.abs(before-5.35)<1e-5);assert.equal(roof(),before);}finally{ship.dispose();}
});
