import test from 'node:test';
import assert from 'node:assert/strict';
import {Box3,Raycaster,Vector3} from 'three';
import {buildSurfaceFixture,disposeSurfaceFixture} from './helpers/cabin-surface-fixture.js';
import {STAIR_TOWER} from '../src/obs/stair-tower.js';
import {STAIRS} from '../src/obs/stair-route.js';
import {stairTrip,rightStairTrip,nearestStairTrip,servedByRightTower} from '../src/obs/stair-trip.js';
import {CABIN_AISLE} from '../src/obs/layout.js';
import {createViewingWall,cabinWallMaterials} from '../src/obs/viewing-wall.js';
import {VIEWING_WALL as PROFILE,VIEWING_WALL_RIGHT_TOWER as RIGHT,viewingWallPanelX} from '../src/obs/viewing-wall-profile.js';

// The right tower is the left tower's two lower decks in a mirror.
const DECKS=[0,3.392],OPERATIONS=6.784;
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
const tower=ship=>ship.staticMesh.getObjectByName('Right pressure stair tower / LEVEL 3 to LEVEL 2');

test('the right tower stands at the right end of LEVEL 3 and LEVEL 2, mirrored, and stops under the airlock',t=>{
  const {ship}=fixture(t),right=tower(ship);
  assert.ok(right,'right tower built');assert.ok(ship.staticMesh.userData.rightStairTower);
  const bounds=new Box3().setFromObject(right);
  assert.ok(bounds.min.x>12.3&&bounds.min.x<-STAIR_TOWER.cabinEdgeX&&bounds.max.x>17.7&&bounds.max.x<18.3,`x ${bounds.min.x.toFixed(2)}..${bounds.max.x.toFixed(2)}`);
  assert.ok(bounds.max.y<=OPERATIONS+.01,`top ${bounds.max.y.toFixed(3)} under the operations deck`);
  // the airlock end of LEVEL 1 is untouched: its wall above and the hatch are still there
  let airlockWall=0;ship.staticMesh.traverse(o=>{if(!o.isMesh)return;const b=new Box3().setFromObject(o);if(b.min.x>12.75&&b.max.x<14.1&&b.min.y>=OPERATIONS-.01)airlockWall++;});
  assert.ok(airlockWall>10,`airlock end of LEVEL 1 kept (${airlockWall} parts)`);
});

test('LEVEL 3 and LEVEL 2 continue into the right tower over the whole aisle depth without a step or a slot',t=>{
  const {ship,meshes,cast}=fixture(t),services=tower(ship).getObjectByName('Stair tower services');
  const floors=meshes.filter(({mesh})=>{for(let o=mesh;o;o=o.parent)if(o===services)return false;return true;});
  // mirror of the left tower's flight strips
  const onFlight=(level,x,z)=>-x<STAIRS.right&&((level>0&&z>-1.09&&z<.49)||(level<1&&z>.80&&z<2.39)||(level===1&&z>.40&&z<2.39));
  DECKS.forEach((y,level)=>{
    for(let x=12.72;x<=13.56;x+=.047)for(let z=STAIR_TOWER.rearWallZ+.03;z<=CABIN_AISLE.deckFront-.13;z+=.053){
      if(onFlight(level,x,z))continue;
      const hit=cast([x,y+.03,z],[0,-1,0],floors);
      assert.ok(hit&&hit.point.y-y>-.002&&hit.point.y-y<.013,`deck ${level}: floor at x=${x.toFixed(2)}, z=${z.toFixed(2)} is ${hit?(hit.point.y-y).toFixed(3):'missing'}`);
    }
  });
});

test('nothing of the right tower or the old wall narrows its entrance',t=>{
  const {ship,meshes}=fixture(t),parts=[];
  tower(ship).traverse(o=>{if(o.isMesh)parts.push({name:o.name,box:new Box3().setFromObject(o)});});
  DECKS.forEach((y,level)=>{
    const opening=new Box3(new Vector3(-STAIR_TOWER.cabinEdgeX,y+.05,-1.15),new Vector3(-STAIRS.right-.04,y+2.40,2.45));
    for(const part of parts)assert.ok(!part.box.intersectsBox(opening),`deck ${level}: ${part.name||'tower part'} stands in the entrance`);
    // and nothing of the cabin is left in the doorway (the old right end wall is gone)
    const doorway=new Box3(new Vector3(12.80,y+.10,-1.10),new Vector3(13.30,y+2.30,2.40));
    for(const {mesh,box} of meshes)if(!parts.some(p=>p.box===box)&&box.intersectsBox(doorway)){
      let inTower=false;for(let o=mesh;o;o=o.parent)if(o===tower(ship))inTower=true;
      assert.ok(inTower||/chain/i.test(mesh.material?.name??''),`deck ${level}: ${mesh.name||mesh.material?.name||'cabin part'} left in the doorway (${box.min.toArray().map(v=>v.toFixed(2))} .. ${box.max.toArray().map(v=>v.toFixed(2))})`);
    }
  });
});

test('pipes, cables, ribs and lamps of the right tower stay clear of everyone walking it',t=>{
  const {ship}=fixture(t),fittings=[];
  tower(ship).getObjectByName('Stair tower services').traverse(o=>{if(o.isMesh)fittings.push({name:o.name,box:new Box3().setFromObject(o)});});
  assert.ok(fittings.length>100,'the tower carries visible service fittings');
  assert.equal(fittings.filter(f=>f.name==='Stair tower lamp lens').length,4,'two entrance lamps, one over the rear flight, one on the outer wall');
  const body=new Box3();
  for(const [from,to] of [[2,1],[1,2]])for(const fromZ of [.78,1.48,2.2]){
    const trip=rightStairTrip(from,to,{fromZ,toZ:fromZ});
    for(let s=0;s<=trip.length;s+=.08){
      const p=trip.frame(s);
      body.min.set(p.x-.33,p.y+.02,p.z-.33);body.max.set(p.x+.33,p.y+1.95,p.z+.33);
      for(const f of fittings)assert.ok(!f.box.intersectsBox(body),`${f.name||'fitting'} in the way on ${from}->${to} at ${s.toFixed(2)} m`);
    }
  }
});

test('a right trip is the left trip in a mirror, and walkers take the nearer tower',()=>{
  for(const [from,to] of [[2,1],[1,2]])for(const z of [.78,1.48,2.2]){
    const left=stairTrip(from,to,{fromZ:z,toZ:z}),right=rightStairTrip(from,to,{fromZ:z,toZ:z});
    assert.equal(right.length,left.length);assert.equal(right.side,1);assert.equal(left.side,-1);
    for(let t=0;t<=left.length;t+=.37){
      const a=left.frame(t),b=right.frame(t);
      assert.ok(Math.abs(a.x+b.x)<1e-12&&a.y===b.y&&a.z===b.z&&Math.abs(a.yaw+b.yaw)<1e-12);
      assert.equal(right.pace(t,1.188),left.pace(t,1.188));
    }
    assert.ok(right.from.x>11.5&&right.to.x>11.5,'starts and ends at the right end of the aisle');
  }
  assert.throws(()=>rightStairTrip(2,0));assert.throws(()=>rightStairTrip(0,1));
  assert.ok(servedByRightTower(1,2)&&!servedByRightTower(0,2));
  // nearer tower by the walk from start to destination
  assert.equal(nearestStairTrip(2,1,9,8,{right:true}).side,1);
  assert.equal(nearestStairTrip(2,1,-4,-6,{right:true}).side,-1);
  assert.equal(nearestStairTrip(2,1,9,8).side,-1,'without the right tower: left');
  assert.equal(nearestStairTrip(2,0,9,8,{right:true}).side,-1,'LEVEL 1 only by the left tower');
});

test('the character view wall runs on over the right tower on LEVEL 3 and LEVEL 2 only',t=>{
  const {ship}=fixture(t);
  const wall=createViewingWall(cabinWallMaterials(ship.staticMesh),{mergeStatic:false,stairTower:true,rightTower:true});
  t.after(()=>wall.traverse(o=>o.geometry?.dispose()));
  const backing=[];wall.traverse(o=>{if(o.name==='Front pressure backing')backing.push(new Box3().setFromObject(o));});
  backing.sort((a,b)=>a.min.y-b.min.y);
  assert.equal(backing.length,3);
  assert.ok(Math.abs(backing[0].max.x-RIGHT.right)<.01&&Math.abs(backing[1].max.x-RIGHT.right)<.01,'LEVEL 3 and 2 reach the right tower lining');
  assert.ok(Math.abs(backing[2].max.x-PROFILE.halfWidth)<.01,'without the ready room LEVEL 1 ends at the airlock');
  const glass=[];wall.traverse(o=>{if(o.name==='POV / pressure window glass')glass.push(o.position.clone());});
  const at=(x,y)=>glass.some(p=>Math.abs(p.x-x)<.01&&Math.abs(p.y-y-PROFILE.windowY)<.01);
  assert.ok(at(viewingWallPanelX(17),3.392),'window beside the right tower on LEVEL 2');
  assert.ok(!at(viewingWallPanelX(17),0),'none on LEVEL 3, where the first flight rises across it');
  assert.ok(!glass.some(p=>p.x>RIGHT.right),'no window beyond the lining');
});
