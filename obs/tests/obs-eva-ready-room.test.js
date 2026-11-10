import test from 'node:test';
import assert from 'node:assert/strict';
import {Box3,Vector3} from 'three';
import {buildSurfaceFixture,disposeSurfaceFixture} from './helpers/cabin-surface-fixture.js';
import {READY_ROOM} from '../src/obs/eva-ready-room.js';
import {EVA_BAY} from '../src/obs/eva.js';
import {STAIR_TOWER} from '../src/obs/stair-tower.js';
import {createViewingWall,cabinWallMaterials} from '../src/obs/viewing-wall.js';
import {VIEWING_WALL as PROFILE,VIEWING_WALL_RIGHT_TOWER as RIGHT,viewingWallPanelX} from '../src/obs/viewing-wall-profile.js';

const Y=6.784,NAME='EVA ready room / LEVEL 1 above the right stair tower';
function fixture(t){
  const ship=buildSurfaceFixture({stairTower:true});ship.staticMesh.updateMatrixWorld(true);
  t.after(()=>disposeSurfaceFixture(ship));
  const room=ship.staticMesh.getObjectByName(NAME),parts=[];
  room?.traverse(o=>{if(o.isMesh)parts.push({mesh:o,name:o.name||o.material?.name||'',box:new Box3().setFromObject(o)});});
  return {ship,room,parts};
}

test('the ready room sits on the right stair tower between the EVA hatch and an outer hatch',t=>{
  const {ship,room,parts}=fixture(t);
  assert.ok(room,'ready room built');assert.ok(ship.staticMesh.userData.readyRoom);
  const bounds=new Box3().setFromObject(room);
  assert.ok(bounds.min.y>Y-.06,`stands on LEVEL 1 (${bounds.min.y.toFixed(3)})`);
  assert.ok(bounds.max.x<18.25&&bounds.min.x>12.5,`x ${bounds.min.x.toFixed(2)}..${bounds.max.x.toFixed(2)}`);
  // it is as long as the tower below and closed at the far end by a bulkhead with a second hatch
  assert.ok(READY_ROOM.left>EVA_BAY.hatchX&&READY_ROOM.right-READY_ROOM.left>4,'room behind the EVA hatch');
  const outer=room.getObjectByName('Outer airlock / sealed');
  assert.ok(outer&&Math.abs(outer.position.x-READY_ROOM.hatchX)<1e-9&&Math.abs(outer.position.z-EVA_BAY.depth)<1e-9,'outer hatch in line with the EVA hatch');
  assert.ok(ship.staticMesh.getObjectByName('EVA airlock / sealed'),'the EVA hatch is still the door into the room');
  // the door to space is a heavy hand-closed hatch, not a sliding cassette: hinged, dogged, wheel-locked,
  // and it goes right through the bulkhead so that it shows on the outside as well
  const named=name=>parts.filter(p=>p.name===name);
  assert.equal(named('Outer hatch hinge').length,2);assert.equal(named('Outer hatch lock bar').length,4);
  assert.equal(named('Outer hatch dog arm').length,6);assert.equal(named('Outer hatch hand wheel').length,1);
  const wall=named('Outer bulkhead')[0],plug=named('Outer hatch plug')[0],leaf=named('Outer hatch leaf')[0];
  assert.equal(wall.mesh.geometry.parameters.shapes.holes.length,1,'opening through the bulkhead');
  // the outside of the end wall is the right stair tower's dark outer wall carried straight up
  const outside=named('Ready room outer wall')[0];let towerWall=null;
  ship.staticMesh.getObjectByName('Right pressure stair tower / LEVEL 3 to LEVEL 2')?.traverse(o=>{if(!o.isMesh||o.material!==outside.mesh.material)return;const b=new Box3().setFromObject(o);if(b.max.y-b.min.y>5&&b.max.z-b.min.z>4&&b.max.x-b.min.x<.2)towerWall=b;});
  assert.ok(towerWall,'the tower has a dark outer wall');
  assert.ok(Math.abs(outside.box.max.x-towerWall.max.x)<.001&&Math.abs(outside.box.min.x-towerWall.min.x)<.001,'same plane as the tower wall');
  assert.ok(Math.abs(outside.box.min.z-towerWall.min.z)<.001&&Math.abs(outside.box.max.z-towerWall.max.z)<.001,'same depth');
  assert.ok(outside.box.min.y-towerWall.max.y<.32&&outside.box.max.y>10.17,'from the tower roof slab to the roof');
  assert.equal(outside.mesh.geometry.parameters.shapes.holes.length,1,'the door opening goes through it');
  assert.ok(Math.abs(wall.box.max.x-outside.box.min.x)<.001,'lining and outer wall meet');
  assert.ok(plug.box.min.x<wall.box.min.x+.05&&plug.box.max.x>outside.box.max.x,'the plug passes through and stands proud outside');
  assert.ok(leaf.box.min.x<READY_ROOM.right-.1&&leaf.box.max.z-leaf.box.min.z>1.2&&leaf.box.max.y-leaf.box.min.y>2,'a thick leaf inside');
  for(const name of ['Outer hatch outside coaming','Outer hatch outside hand wheel','Outer hatch outside grab bar'])
    for(const p of named(name))assert.ok(p.box.min.x>outside.box.max.x-.001,`${name} is on the outer face`);
  assert.ok(named('Outer hatch outside hand wheel').length===1&&named('Outer hatch outside grab bar').length===2);
  assert.ok(!parts.some(p=>/pressure cassette|pocket/i.test(p.name)),'no sliding door at the outer end');
  // the tower's roof slab is its floor: a walking surface at deck height
  const floor=parts.find(p=>p.name==='Ready room walking surface');
  assert.ok(floor&&Math.abs(floor.box.max.y-Y)<.002&&floor.box.min.x<READY_ROOM.left+.01&&floor.box.max.x>READY_ROOM.right-.01);
  // roof at the cabin's heights
  const roof=parts.find(p=>p.name==='Ready room roof structure');
  assert.ok(roof&&Math.abs(roof.box.min.y-10.18)<.001,'ceiling at the cabin roof');
});

test('the way from hatch to hatch is clear, and the fittings stay on the walls',t=>{
  const {parts}=fixture(t);
  // a person's width along the line between the two hatches (they and their bulkheads close its ends)
  const way=new Box3(new Vector3(READY_ROOM.left+.35,Y+.05,EVA_BAY.depth-.55),new Vector3(READY_ROOM.right-.35,Y+2.20,EVA_BAY.depth+.55));
  for(const p of parts)assert.ok(!p.box.intersectsBox(way),`${p.name} stands in the way (${p.box.min.toArray().map(v=>v.toFixed(2))} .. ${p.box.max.toArray().map(v=>v.toFixed(2))})`);
  // bench, harness rail, panel and viewport are within 0.8 m of the rear wall
  for(const name of ['Ready room bench','Harness rail','Pressure equalisation panel','Safety tether','Bench seat pad','Ready room viewport frame']){
    const found=parts.filter(p=>p.name===name);assert.ok(found.length,`${name} present`);
    for(const p of found)assert.ok(p.box.max.z<STAIR_TOWER.rearWallZ+.80&&p.box.min.z>STAIR_TOWER.rearWallZ-.31,`${name} on the rear wall`);
  }
  assert.equal(parts.filter(p=>p.name==='Safety tether').length,3);
  assert.equal(parts.filter(p=>p.name==='Outer hatch hazard marking').length,6);
});

test('the ready room is octagonal and its own: no stair tower fittings, lights that only glow',t=>{
  const {ship,room,parts}=fixture(t);
  // an octagonal section: sloped panels below and above the vertical rear wall
  const lower=parts.find(p=>p.name==='Ready room lower slope'),upper=parts.find(p=>p.name==='Ready room upper slope');
  assert.ok(lower&&upper&&Math.abs(lower.mesh.rotation.x)>.5&&Math.abs(upper.mesh.rotation.x)>.5,'sloped panels');
  assert.ok(Math.abs(lower.box.max.z-(STAIR_TOWER.rearWallZ+READY_ROOM.toe))<.06&&Math.abs(lower.box.max.y-Y-READY_ROOM.knee)<.06);
  // an octagonal viewport with stars behind it, an octagonal stand pad and light panel
  const outline=name=>{const g=parts.find(p=>p.name===name).mesh.geometry;return new Set(g.parameters.shapes.getPoints().map(p=>`${p.x.toFixed(4)},${p.y.toFixed(4)}`)).size;};
  assert.equal(outline('Ready room viewport frame'),8);assert.equal(outline('Ready room ceiling light'),8);
  // the viewport is a real opening: nothing solid behind it, and it is one of the ship's star windows
  const sky=parts.find(p=>p.name==='Ready room viewport space'),view=READY_ROOM.viewport;
  assert.ok(sky.mesh.userData.spaceWindow&&sky.mesh.material.depthWrite===false&&!sky.mesh.material.map,'space window, not a picture');
  const through=new Box3(new Vector3(sky.box.getCenter(new Vector3()).x-view.width/2+.4,Y+view.centerY-.2,STAIR_TOWER.rearWallZ-.37),new Vector3(sky.box.getCenter(new Vector3()).x+view.width/2-.4,Y+view.centerY+.2,STAIR_TOWER.rearWallZ-.05));
  for(const p of parts)if(p.name==='Ready room rear structure'||p.name==='Ready room rear wall'){
    const g=p.mesh.geometry.parameters.shapes;assert.equal(g.holes.length,1,`${p.name} is cut through`);
  }
  for(const p of parts)if(!/rear structure|rear wall|viewport/.test(p.name))assert.ok(!p.box.intersectsBox(through),`${p.name} blocks the viewport`);
  const stars=ship.animated.getObjectByName('Rear windows / stars');
  assert.ok(stars.material.customProgramCacheKey().includes(sky.mesh.getWorldPosition(new Vector3()).x.toFixed(2)),'the star field is cut to this window too');
  assert.equal(parts.filter(p=>p.name==='Ready room stand pad').length,8);
  // nothing borrowed from the stair towers
  for(const p of parts)assert.ok(!/stair tower|tube light|riser|cable bundle/i.test(p.name),`${p.name} belongs to the towers`);
  // glowing surfaces only
  const glows=parts.filter(p=>/light/i.test(p.mesh.material?.name??''));
  assert.ok(glows.length>=4&&glows.every(p=>p.mesh.material.isMeshBasicMaterial&&p.mesh.material.toneMapped===false));
  room.traverse(o=>assert.ok(!o.isLight,'no light source in the room'));
  // box() shares one unit geometry: it must still be centred after the room is built
  const anyBox=parts.find(p=>p.mesh.geometry.type==='BoxGeometry').mesh.geometry;anyBox.computeBoundingBox();
  assert.ok(anyBox.boundingBox.getCenter(new Vector3()).length()<1e-9,'shared box geometry untouched');
});

test('the character view wall closes the ready room on LEVEL 1 too',t=>{
  const {ship}=fixture(t);
  const wall=createViewingWall(cabinWallMaterials(ship.staticMesh),{mergeStatic:false,stairTower:true,rightTower:true,readyRoom:true});
  t.after(()=>wall.traverse(o=>o.geometry?.dispose()));
  const backing=[];wall.traverse(o=>{if(o.name==='Front pressure backing')backing.push(new Box3().setFromObject(o));});
  assert.equal(backing.length,3);
  for(const b of backing)assert.ok(Math.abs(b.max.x-RIGHT.right)<.01,'every deck reaches the outer lining');
  const glass=[];wall.traverse(o=>{if(o.name==='POV / pressure window glass')glass.push(o.position.clone());});
  assert.ok(glass.some(p=>Math.abs(p.x-viewingWallPanelX(17))<.01&&Math.abs(p.y-Y-PROFILE.windowY)<.01),'a window in the ready room');
  let roofReturn=false;wall.traverse(o=>{if(o.name==='Right tower roof return')roofReturn=true;});
  assert.ok(!roofReturn,'no separate tower roof closure under the room');
});
