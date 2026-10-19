import test from 'node:test';
import assert from 'node:assert/strict';
import {Box3,Vector3,Quaternion,Raycaster,Matrix4} from 'three';
import {createExteriorShip,EXTERIOR,exteriorAngle,rotationGravity} from '../src/obs/ship-exterior.js';
import {HABITAT_ENVELOPE,HABITAT_FLOORS,HABITAT_WINDOWS,cabinToHabitat,habitatToCabin} from '../src/obs/habitat-envelope.js';
import {VIEWING_WALL,viewingWallPanelX} from '../src/obs/viewing-wall-profile.js';
import {FLOOR_Y} from '../src/obs/ship.js';
import {createViewingWall,cabinWallMaterials} from '../src/obs/viewing-wall.js';
import {buildSurfaceFixture,disposeSurfaceFixture} from './helpers/cabin-surface-fixture.js';
import {engineFacingGain} from '../src/obs/exterior-optics.js';
import {habitatMountLayout} from '../src/obs/exterior-habitat-mount.js';

test('all four probe legs terminate above the landing pad soles',()=>{
  const ship=createExteriorShip();
  try{
    ship.root.updateMatrixWorld(true);
    const inverse=ship.dockedLander.matrixWorld.clone().invert(),point=new Vector3(),transform=new Matrix4();
    const feet=[-1,1].flatMap(x=>[-1,1].map(z=>({x:x*2.95,z:z*2.65,count:0,min:Infinity})));
    ship.dockedLander.traverse(mesh=>{
      if(!mesh.isMesh||mesh.material.transparent||mesh.isInstancedMesh)return;
      transform.multiplyMatrices(inverse,mesh.matrixWorld);
      const positions=mesh.geometry.attributes.position;
      for(let i=0;i<positions.count;i++){
        point.fromBufferAttribute(positions,i).applyMatrix4(transform);
        if(point.y>.30)continue;
        for(const foot of feet)if(Math.hypot(point.x-foot.x,point.z-foot.z)<.55){
          foot.count++;foot.min=Math.min(foot.min,point.y);
        }
      }
    });
    for(const foot of feet){
      assert.ok(foot.count>0,'the real pad geometry is included');
      assert.ok(foot.min>=.11-1e-6,`no angled strut protrudes through the pad at ${foot.x}, ${foot.z}: ${foot.min}`);
      assert.ok(Math.abs(foot.min-.11)<1e-6,'the original sole height stays fixed');
    }
  }finally{ship.dispose();}
});

test('three equally spaced gravity sections rotate as one rigid assembly with a fixed hull',()=>{
  const ship=createExteriorShip();
  try{
    assert.equal(ship.pods.length,3);
    const initial=ship.pods.map(p=>p.position.clone());
    for(const angle of [0,.35,Math.PI,Math.PI*2]){
      ship.setAngle(angle);ship.root.updateMatrixWorld(true);
      for(let i=0;i<3;i++){
        const p=ship.pods[i].getWorldPosition(new Vector3());
        assert.ok(Math.abs(Math.hypot(p.y,p.z)-EXTERIOR.radius)<1e-9);
        assert.ok(Math.abs(p.x-EXTERIOR.rotorX)<1e-9);assert.ok(ship.pods[i].position.equals(initial[i]));
        assert.equal(ship.pods[i].parent,ship.rotor);
      }
      assert.equal(ship.core.rotation.x,0);assert.equal(ship.core.position.x,0);
    }
  }finally{ship.dispose();}
});
test('the enlarged stern and seven open rocket engines remain behind the rotating habitat sweep',()=>{
  const ship=createExteriorShip();
  try{
    assert.equal(ship.engines.length,7);ship.root.updateMatrixWorld(true);
    const rotorBounds=new Box3().setFromObject(ship.rotor);
    for(const engine of ship.engines){
      const bounds=new Box3().setFromObject(engine);
      const radius=Math.hypot(Math.max(Math.abs(bounds.min.y),Math.abs(bounds.max.y)),Math.max(Math.abs(bounds.min.z),Math.abs(bounds.max.z)));
      assert.ok(bounds.max.x<rotorBounds.min.x-.20||radius<EXTERIOR.radius-EXTERIOR.podDepth/2-1.2,'engine mounts remain clear of the tapered habitat end caps');
      let throat=false;engine.traverse(mesh=>{if(mesh.material?.name==='Nozzle throat')throat=true;});assert.ok(throat);
    }
    assert.ok(ship.dimensions.x>40&&ship.dimensions.x<45);
  }finally{ship.dispose();}
});
test('core balance changes preserve the cabin and floor gravity while keeping both ends of every radial support attached',()=>{
  const ship=createExteriorShip(),end=habitatMountLayout(EXTERIOR).supportRadius;
  try{
    for(const scale of [1,1.6,2.6,2.8]){
      ship.setCoreScale(scale);
      for(const angle of [0,.8,Math.PI]){
        ship.setAngle(angle);ship.root.updateMatrixWorld(true);
        const bearing=ship.core.localToWorld(new Vector3(EXTERIOR.rotorX,0,0));
        assert.ok(bearing.distanceTo(new Vector3(EXTERIOR.rotorX,0,0))<1e-9);
        for(const spoke of ship.spokes){
          const inner=spoke.localToWorld(new Vector3(0,3.75,0)),outer=spoke.localToWorld(new Vector3(0,end,0));
          assert.ok(Math.abs(Math.hypot(inner.y,inner.z)-3.75*scale)<1e-9);
          assert.ok(Math.abs(Math.hypot(outer.y,outer.z)-end)<1e-9);
        }
        for(const pod of ship.pods){
          assert.deepEqual(pod.scale.toArray(),[1,1,1]);
          const floor=cabinToHabitat({x:0,y:FLOOR_Y[2],z:0}),point=pod.localToWorld(new Vector3(floor.x,floor.y,floor.z));
          assert.ok(Math.abs(Math.hypot(point.y,point.z)*2*Math.PI-200)<1e-8);
          assert.equal(pod.userData.windows.length,18);
        }
      }
    }
    assert.ok(ship.dimensions.x>110);
    ship.setCoreScale(1);assert.ok(ship.dimensions.x<45);
  }finally{ship.dispose();}
});
test('service equipment can be hidden without losing the pressure hull or engine bells',()=>{
  const ship=createExteriorShip();
  try{
    ship.setServices(false);assert.equal(ship.machinery.visible,false);assert.equal(ship.core.visible,true);assert.ok(ship.engines.every(e=>e.children.some(c=>c.isMesh)));
    ship.setServices(true);assert.equal(ship.machinery.visible,true);
    let draws=0;ship.root.traverse(o=>{if(o.isMesh)draws++;});
    assert.equal(ship.mountSockets.length,6);
    assert.ok(ship.mountSockets.every(socket=>socket.children.length===0),'adjustable clevis geometry stays in the existing habitat steel batches');
    assert.equal(ship.dockHatches.length,2);
    assert.ok(ship.dockHatches.every(hatch=>hatch.children.filter(child=>child.isMesh).length===1),'only the two moving pressure hatches need separate batches');
    assert.ok(draws-ship.dockHatches.length<120,`hull budget plus two operational pressure hatches uses ${draws} meshes`);
  }finally{ship.dispose();}
});
test('rotation speed and the displayed centrifugal acceleration use the same physical radius',()=>{
  assert.equal(rotationGravity(0),0);
  assert.ok(Math.abs(exteriorAngle(60,1)-Math.PI*2)<1e-12);
  assert.ok(Math.abs(rotationGravity(EXTERIOR.rpm)-1)<1e-12);
  assert.ok(EXTERIOR.rpm>5.3&&EXTERIOR.rpm<5.31);
  assert.ok(60/EXTERIOR.rpm>11.3&&60/EXTERIOR.rpm<11.4);
  assert.equal(rotationGravity(8),4*rotationGravity(4));
});
test('the outermost existing cabin floor follows a 200-metre path at 1G, while the other floors stack inward',()=>{
  const ship=createExteriorShip();
  try{
    assert.equal(HABITAT_FLOORS,FLOOR_Y);
    for(const angle of [0,.31,1.6,3.7]){
      ship.setAngle(angle);ship.root.updateMatrixWorld(true);
      for(const pod of ship.pods){
        const points=FLOOR_Y.map(y=>cabinToHabitat({x:0,y,z:0})).map(p=>pod.localToWorld(new Vector3(p.x,p.y,p.z)));
        const radii=points.map(p=>Math.hypot(p.y,p.z));
        assert.ok(radii[0]<radii[1]&&radii[1]<radii[2]);
        assert.ok(Math.abs(radii[2]*Math.PI*2-200)<1e-9);
        assert.ok(Math.abs(rotationGravity(EXTERIOR.rpm,radii[2])-1)<1e-12);
      }
    }
    assert.ok(EXTERIOR.podLength>27&&EXTERIOR.podDepth>12,'do not shrink the existing cabin to fit the old decorative pod');
    assert.ok(HABITAT_ENVELOPE.top>10.58&&HABITAT_ENVELOPE.bottom<-1.3,'roof and underdeck tanks fit');
  }finally{ship.dispose();}
});
test('exterior window positions and counts match the actual OBS corridor and rear-room meshes',()=>{
  const interior=buildSurfaceFixture(),wall=createViewingWall(cabinWallMaterials(interior.staticMesh),{mergeStatic:false}),actual=[];
  try{
    interior.staticMesh.updateMatrixWorld(true);wall.updateMatrixWorld(true);
    interior.staticMesh.traverse(mesh=>{if(mesh.name.endsWith('pressure window glass')){const p=mesh.getWorldPosition(new Vector3());actual.push({x:p.x,y:p.y,z:p.z});}});
    wall.traverse(mesh=>{if(mesh.name==='POV / pressure window glass'){const p=mesh.getWorldPosition(new Vector3());actual.push({x:p.x,y:p.y,z:p.z});}});
    assert.equal(actual.length,18);assert.equal(HABITAT_WINDOWS.length,actual.length);
    for(const window of HABITAT_WINDOWS){
      assert.ok(actual.some(p=>new Vector3(p.x,p.y,p.z).distanceTo(new Vector3(window.x,window.y,window.z))<1e-8),`external ${window.id} has no matching cabin window`);
      const restored=habitatToCabin(cabinToHabitat(window));assert.ok(Math.abs(restored.y-window.y)<1e-12);assert.equal(restored.x,window.x);assert.equal(restored.z,window.z);
    }
    for(let level=0;level<3;level++){
      const row=HABITAT_WINDOWS.filter(w=>w.face==='corridor'&&w.level===level);
      assert.deepEqual(row.map(w=>w.x),[2,5,8,11,14].map(viewingWallPanelX));
      assert.ok(row.every(w=>w.y===FLOOR_Y[level]+VIEWING_WALL.windowY));
    }
  }finally{wall.traverse(o=>o.geometry?.dispose());disposeSurfaceFixture(interior);}
});
test('all eighteen exterior windows on each colony have real unobstructed apertures and glass at the cabin location',()=>{
  const ship=createExteriorShip();
  try{
    ship.root.updateMatrixWorld(true);
    for(const pod of ship.pods){
      const meshes=[];pod.traverse(o=>{if(o.isMesh)meshes.push(o);});
      for(const window of pod.userData.windows){
        const center=pod.localToWorld(new Vector3(window.x,window.y,window.z));
        const outward=new Vector3(0,0,window.face==='corridor'?-1:1).applyQuaternion(pod.getWorldQuaternion(new Quaternion()));
        const origin=center.clone().addScaledVector(outward,10),direction=outward.negate();
        const hit=new Raycaster(origin,direction).intersectObjects(meshes,false)[0];
        assert.equal(hit?.object.material.name,'Small pressure window',`${pod.name} / ${window.id} is blocked by an exterior wall`);
        assert.ok(hit.point.distanceTo(center)<1e-4,`${window.id} glass must retain the interior window depth`);
      }
    }
    ship.setFloorGuides(true);assert.ok(ship.floorGuides.every(g=>g.visible&&g.children.length===3));
    ship.setFloorGuides(false);assert.ok(ship.floorGuides.every(g=>!g.visible));
  }finally{ship.dispose();}
});
test('service rooms fit behind one rear wall at the deepest room extent',()=>{
  const ship=createExteriorShip();
  try{
    ship.root.updateMatrixWorld(true);
    for(const pod of ship.pods){
      const meshes=[];pod.traverse(o=>{if(o.isMesh)meshes.push(o);});
      for(const x of [-10.12,-7.04,-1.88,5,10]){
        const origin=pod.localToWorld(new Vector3(x,1,HABITAT_ENVELOPE.rearRoomBack+1));
        const direction=new Vector3(0,0,-1).applyQuaternion(pod.getWorldQuaternion(new Quaternion()));
        const hit=new Raycaster(origin,direction).intersectObjects(meshes,false)[0];
        assert.equal(hit?.object.material.name,'Habitat service skin');
        const local=pod.worldToLocal(hit.point.clone());
        assert.ok(Math.abs(local.z-HABITAT_ENVELOPE.rearRoomBack)<1e-5,'all rear areas share the same outer wall');
      }
    }
  }finally{ship.dispose();}
});
test('EVA hatches stay on the fixed hull and engine ignition stays recessed at every core scale',()=>{
  const ship=createExteriorShip();
  try{
    assert.equal(ship.evaHatches.length,2);
    for(const scale of [1,2.6,2.8]){
      ship.setCoreScale(scale);ship.setAngle(.8);ship.root.updateMatrixWorld(true);
      for(const hatch of ship.evaHatches){assert.equal(hatch.parent,ship.core);assert.ok(hatch.children.some(o=>o.material?.name==='Recessed machinery'));}
      for(const engine of ship.engines){
        assert.ok(engine.userData.glowPoint[0]>-2,'emission stays deep in the bell');
        const point=engine.localToWorld(new Vector3(...engine.userData.glowPoint));
        const bounds=new Box3().setFromObject(engine);assert.ok(point.x>bounds.min.x+2*scale);
        let glow=false;engine.traverse(o=>{if(o.material?.name==='Nozzle throat'){glow=true;assert.ok(o.material.emissiveIntensity>0&&o.material.emissiveIntensity<1);}});assert.ok(glow);
      }
    }
  }finally{ship.dispose();}
});
test('the blue optical flare responds to an aft view and fades completely on front and side views',()=>{
  const source=new Vector3(-40,0,0);
  assert.equal(engineFacingGain(new Vector3(-100,0,0),source),1);
  assert.equal(engineFacingGain(new Vector3(100,0,0),source),0);
  assert.equal(engineFacingGain(new Vector3(-40,0,100),source),0);
  assert.ok(engineFacingGain(new Vector3(-100,0,20),source)>engineFacingGain(new Vector3(-100,0,50),source));
});
test('the game lander stays docked below the fixed hull at its original size and remains clear of the rotating ring',()=>{
  const ship=createExteriorShip();
  try{
    assert.equal(ship.probeDock.parent,ship.root);assert.equal(ship.dockedLander.userData.flame.visible,false);
    assert.equal(ship.dockedLander.userData.flame.parent,null);
    let originalSize;
    for(const scale of [1,1.6,2.6,2.8]){
      ship.setCoreScale(scale);ship.root.updateMatrixWorld(true);
      const before=ship.dockedLander.getWorldPosition(new Vector3()),bounds=new Box3().setFromObject(ship.dockedLander),size=bounds.getSize(new Vector3());
      if(!originalSize)originalSize=size;else assert.ok(size.distanceTo(originalSize)<1e-8);
      assert.ok(size.y>6&&size.y<7&&size.x>6,'same white/gold four-legged game lander');
      assert.ok(bounds.max.y<-2.65*scale-.5,'antennas clear the underside');
      const radialMax=Math.hypot(Math.max(Math.abs(bounds.min.y),Math.abs(bounds.max.y)),Math.max(Math.abs(bounds.min.z),Math.abs(bounds.max.z)));
      assert.ok(radialMax<EXTERIOR.radius-EXTERIOR.podDepth/2-1.2,'probe and deployed legs stay inside the rotating habitat sweep');
      for(const angle of [0,.8,Math.PI,5]){ship.setAngle(angle);ship.root.updateMatrixWorld(true);assert.ok(ship.dockedLander.getWorldPosition(new Vector3()).distanceTo(before)<1e-9);}
    }
  }finally{ship.dispose();}
});
