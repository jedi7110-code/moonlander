import test from 'node:test';
import assert from 'node:assert/strict';
import {Raycaster,Vector3} from 'three';
import {buildSurfaceFixture,disposeSurfaceFixture} from './helpers/cabin-surface-fixture.js';
import {createViewingWall,cabinWallMaterials} from '../src/obs/viewing-wall.js';
import {VIEWING_WALL as PROFILE,viewingWallFaceZ,viewingWallPanelX} from '../src/obs/viewing-wall-profile.js';
import {FLOOR_Y} from '../src/obs/ship.js';
import {DECK,CABIN_AISLE} from '../src/obs/layout.js';
import {EVA_BAY} from '../src/obs/eva.js';

function fixture(t,mergeStatic=false){
  const ship=buildSurfaceFixture(),wall=createViewingWall(cabinWallMaterials(ship.staticMesh),{mergeStatic});
  wall.visible=true;wall.updateMatrixWorld(true);
  t.after(()=>{
    wall.traverse(object=>object.geometry?.dispose());
    disposeSurfaceFixture(ship);
  });
  return {ship,wall};
}
const hit=(objects,origin,direction)=>new Raycaster(new Vector3(...origin),new Vector3(...direction)).intersectObjects(objects,true)[0];

test('the near wall forms a recessed middle with connected upper and lower faces outside the walking lane',t=>{
  const {wall}=fixture(t);
  const skin=wall.children.filter(mesh=>['Front cabin panel','Lower angled panel','Upper angled panel'].includes(mesh.name));
  for(const floor of FLOOR_Y)for(const y of [.16,.35,.699,.701,1.52,2.339,2.341,2.70,3.01]){
    const intersection=hit(skin,[viewingWallPanelX(0),floor+y,2],[0,0,1]);
    assert.ok(intersection,`missing lining at height ${y}`);
    assert.ok(Math.abs(intersection.point.z-viewingWallFaceZ(y))<1e-5);
    assert.ok(intersection.point.z>CABIN_AISLE.catZ+.25,'keep the existing floor lane clear');
  }
  assert.ok(PROFILE.faceZ-PROFILE.edgeZ>.5,'the middle face has a visible recess');
});

for(const mergeStatic of [false,true])test(`every two solid panels lead to a real unobstructed space window (${mergeStatic?'batched':'unmerged'})`,t=>{
  const {wall}=fixture(t,mergeStatic),opaque=[];
  wall.traverse(object=>{if(object.isMesh&&!object.material.transparent)opaque.push(object);});
  for(const floor of FLOOR_Y)for(const i of [2,5,8,11,14])for(const dx of [-.24,0,.24])for(const dy of [-.24,0,.24]){
    const intersection=hit(opaque,[viewingWallPanelX(i)+dx,floor+PROFILE.windowY+dy,2.2],[0,0,1]);
    assert.equal(intersection?.object.material.name,'POV / deep space',`blocked window ${i} at floor ${floor}`);
    assert.ok(intersection.distance>70,'space remains behind the pressure hull');
  }
  for(const floor of FLOOR_Y)for(const i of [0,1,3,4,6,7,9,10,12,13,15]){
    const intersection=hit(opaque,[viewingWallPanelX(i)+.62,floor+1.4,2.2],[0,0,1]);
    assert.ok(intersection&&intersection.distance<1.2,`solid panel ${i} must seal the cabin`);
  }
  if(mergeStatic)assert.ok(opaque.length<40,'repeated fixtures share material batches');
});

test('pressure partitions continue to the recessed wall without opening a bypass around either hatch',t=>{
  const {ship,wall}=fixture(t),floor=FLOOR_Y[DECK.OPERATIONS];
  ship.staticMesh.updateMatrixWorld(true);
  for(const x of [EVA_BAY.innerX,EVA_BAY.hatchX])for(const y of [.22,.50,1.5,2.5,2.95]){
    for(let z=CABIN_AISLE.deckFront-.05;z<viewingWallFaceZ(y)-.01;z+=.04){
      const intersection=hit([ship.staticMesh,wall],[x-.4,floor+y,z],[1,0,0]);
      assert.ok(intersection&&intersection.point.x<x+.17,`pressure gap beside hatch ${x}, height ${y}, depth ${z}`);
    }
  }
});
