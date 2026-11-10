import test from 'node:test';
import assert from 'node:assert/strict';
import {Box3,Raycaster,Vector3} from 'three';
import {buildSurfaceFixture,disposeSurfaceFixture} from './helpers/cabin-surface-fixture.js';
import {createViewingWall,cabinWallMaterials} from '../src/obs/viewing-wall.js';
import {VIEWING_WALL as PROFILE,VIEWING_WALL_TOWER as TOWER,viewingWallPanelX,viewingWallWindow,viewingWallFaceZ} from '../src/obs/viewing-wall-profile.js';
import {STAIR_TOWER} from '../src/obs/stair-tower.js';
import {STAIRS} from '../src/obs/stair-route.js';
import {stairTrip} from '../src/obs/stair-trip.js';
import {FLOOR_Y} from '../src/obs/ship.js';
import {CABIN_AISLE} from '../src/obs/layout.js';

const DECKS=[0,3.392,6.784];
function fixture(t){
  const ship=buildSurfaceFixture({stairTower:true});ship.staticMesh.updateMatrixWorld(true);
  const meshes=[];ship.staticMesh.traverse(o=>{if(o.isMesh)meshes.push({mesh:o,box:new Box3().setFromObject(o)});});
  t.after(()=>disposeSurfaceFixture(ship));
  const cast=(origin,direction,list=meshes)=>{
    const ray=new Raycaster(new Vector3(...origin),new Vector3(...direction));
    return ray.intersectObjects(list.filter(({box})=>ray.ray.intersectsBox(box)).map(m=>m.mesh),false)[0];
  };
  return {ship,meshes,cast};
}
const tower=ship=>ship.staticMesh.getObjectByName('Left pressure stair tower / 20 risers per deck');

test('each deck continues into the stair tower over the whole aisle depth without a step or a slot',t=>{
  const {ship,meshes,cast}=fixture(t),services=tower(ship).getObjectByName('Stair tower services');
  // Wall-mounted hoses rise from the floor at the rear corner; test the floor itself.
  const floors=meshes.filter(({mesh})=>{for(let o=mesh;o;o=o.parent)if(o===services)return false;return true;});
  // Left of x=right the two flights occupy their own strips.
  const onFlight=(level,x,z)=>x<STAIRS.right&&((level>0&&z>-1.09&&z<.49)||(level<2&&z>.80&&z<2.39)||(level===2&&z>.40&&z<2.39));
  DECKS.forEach((y,level)=>{
    for(let x=-13.56;x<=-12.72;x+=.047)for(let z=STAIR_TOWER.rearWallZ+.03;z<=CABIN_AISLE.deckFront-.13;z+=.053){
      if(onFlight(level,x,z))continue;
      const hit=cast([x,y+.03,z],[0,-1,0],floors);
      // Grip studs may stand a centimetre proud; nothing may drop below the deck.
      assert.ok(hit&&hit.point.y-y>-.002&&hit.point.y-y<.013,`deck ${level}: floor at x=${x.toFixed(2)}, z=${z.toFixed(2)} is ${hit?(hit.point.y-y).toFixed(3):'missing'}`);
    }
  });
});

test('nothing of the tower narrows its entrance: the opening is as wide and as high as the aisle',t=>{
  const {ship}=fixture(t),parts=[];
  tower(ship).traverse(o=>{if(o.isMesh)parts.push({name:o.name,box:new Box3().setFromObject(o)});});
  DECKS.forEach((y,level)=>{
    // Between the stair's first tread and the cabin deck, from the floor to the
    // overhead cables (as low as the cabin's own), from the rear wall fittings
    // to the front wall line.
    const opening=new Box3(new Vector3(STAIRS.right+.04,y+.05,-1.15),new Vector3(STAIR_TOWER.cabinEdgeX,y+2.40,2.45));
    for(const part of parts)assert.ok(!part.box.intersectsBox(opening),`deck ${level}: ${part.name||'tower part'} stands in the entrance (${part.box.min.toArray().map(v=>v.toFixed(2))} .. ${part.box.max.toArray().map(v=>v.toFixed(2))})`);
  });
  // The rear lining is on the cabin's rear wall line and the floors reach the same front edge.
  assert.ok(Math.abs(STAIR_TOWER.rearWallZ+1.606)<.03);assert.equal(STAIR_TOWER.deckFront,CABIN_AISLE.deckFront);
});

test('pipes, cables, ribs and lamps stay clear of everyone walking the stairs',t=>{
  const {ship}=fixture(t),fittings=[];
  tower(ship).getObjectByName('Stair tower services').traverse(o=>{if(o.isMesh)fittings.push({name:o.name,box:new Box3().setFromObject(o)});});
  assert.ok(fittings.length>150,'the tower carries visible service fittings');
  assert.ok(fittings.filter(f=>f.name==='Stair tower lamp lens').length>=7,'caged lamps on the walls');
  const body=new Box3();
  for(const from of [0,1,2])for(const to of [0,1,2]){
    if(from===to)continue;
    for(const fromZ of [.78,2.2]){
      const trip=stairTrip(from,to,{fromZ});
      for(let s=0;s<=trip.length;s+=.08){
        const p=trip.frame(s);
        body.min.set(p.x-.33,p.y+.02,p.z-.33);body.max.set(p.x+.33,p.y+1.95,p.z+.33);
        for(const f of fittings)assert.ok(!f.box.intersectsBox(body),`${f.name||'fitting'} in the way on ${from}->${to} at ${s.toFixed(2)} m`);
      }
    }
  }
});

test('the guarded tube lights are fittings only: glowing tubes, no light source',t=>{
  const {ship}=fixture(t),lenses=[];
  tower(ship).traverse(o=>{if(o.name==='Stair tower lamp lens')lenses.push(o);});
  assert.equal(lenses.length,7);
  assert.ok(lenses.every(lens=>lens.material.isMeshBasicMaterial&&lens.material.toneMapped===false),'the tube itself glows');
  for(const root of [ship.staticMesh,ship.animated])root.traverse(o=>{
    if(!o.isLight)return;
    const p=o.getWorldPosition(new Vector3());
    assert.ok(p.x>STAIR_TOWER.cabinEdgeX,`${o.name||o.type} must not light the stair tower walls`);
  });
});

test('the character view closes the tower front with the cabin wall profile and windows',t=>{
  const {ship}=fixture(t),wall=createViewingWall(cabinWallMaterials(ship.staticMesh),{mergeStatic:false,stairTower:ship.staticMesh.userData.stairTower});
  wall.visible=true;wall.updateMatrixWorld(true);t.after(()=>wall.traverse(o=>o.geometry?.dispose()));
  const opaque=[];wall.traverse(o=>{if(o.isMesh&&!o.material.transparent)opaque.push(o);});
  const hit=(origin,direction)=>new Raycaster(new Vector3(...origin),new Vector3(...direction)).intersectObjects(opaque,false)[0];
  assert.equal(ship.staticMesh.userData.stairTower,true);
  const bays=[];for(let i=TOWER.firstIndex;i<0;i++)bays.push(i);
  assert.deepEqual(bays.filter(viewingWallWindow),[-1],'one window beside the entrance; none at the turn landing, where the slab would cut it');
  for(const floor of FLOOR_Y){
    for(const i of bays){
      const x=viewingWallPanelX(i);
      if(viewingWallWindow(i)){
        const space=hit([x,floor+PROFILE.windowY,2.2],[0,0,1]);
        assert.equal(space?.object.material.name,'POV / deep space',`tower window ${i} at floor ${floor} is blocked`);
      }
      // Same recessed cross-section as the cabin, beside the window opening.
      for(const y of [.3,1.5,2.7]){
        const solid=hit([x+.64,floor+y,2.2],[0,0,1]);
        assert.ok(solid&&Math.abs(solid.point.z-viewingWallFaceZ(y))<.06,`tower bay ${i} at floor ${floor}, height ${y}`);
      }
    }
    // Sealed from the cabin's first bay to the tower's outer lining.
    for(let x=TOWER.left+.03;x<viewingWallPanelX(0);x+=.21){
      if(bays.some(i=>viewingWallWindow(i)&&Math.abs(x-viewingWallPanelX(i))<PROFILE.windowWidth/2+.08))continue;
      const solid=hit([x,floor+1.5,2.2],[0,0,1]);
      assert.ok(solid&&solid.distance<1.3,`gap in the tower front wall at x=${x.toFixed(2)}, floor ${floor}`);
    }
    // The old end return of the cabin no longer crosses the stair entrance.
    assert.equal(hit([-12.6,floor+1.5,1.9],[-1,0,0])?.point.x<TOWER.left+.3,true,'the entrance stays open in the character view');
  }
  // Stairs and rails stay inside the wall line.
  assert.ok(STAIRS.front+STAIRS.width/2+.09<PROFILE.edgeZ);
});
