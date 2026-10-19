import test from 'node:test';
import assert from 'node:assert/strict';
import {Raycaster,Vector3} from 'three';
import {createExteriorMothership,EXTERIOR} from '../src/obs/exterior-mothership.js';
import {habitatMountLayout,ringRailSeat} from '../src/obs/exterior-habitat-mount.js';
import {HABITAT_ENVELOPE,HABITAT_WINDOWS,cabinToHabitat} from '../src/obs/habitat-envelope.js';
import {ACCESS_LADDER} from '../src/obs/layout.js';

const vector=values=>new Vector3(...values);
function castLocal(group,origin,direction,surface){
  const worldOrigin=group.localToWorld(vector(origin)),worldDirection=vector(direction).transformDirection(group.matrixWorld);
  const hit=new Raycaster(worldOrigin,worldDirection).intersectObject(surface,false)[0];
  assert.ok(hit,'the actual batched surface must exist at the intended connection');
  return group.worldToLocal(hit.point.clone());
}
const batch=(group,name)=>group.children.find(mesh=>mesh.isMesh&&mesh.material.name===name);

test('the ring clears the service skin and its structural rails seat in the real saddle clamps',()=>{
  const ship=createExteriorMothership(),layout=habitatMountLayout(EXTERIOR);
  try{
    ship.setCoreScale(2.6);ship.setAngle(.73);ship.root.updateMatrixWorld(true);
    const pod=ship.pods[0],steel=batch(pod,'Unpainted structure');
    const skin=castLocal(pod,[8,-12,0],[0,1,0],batch(pod,'Habitat service skin'));
    assert.ok(Math.abs(skin.y-layout.skinY)<1e-5);
    const tunnel=castLocal(ship.frame,[0,layout.ringRadius+1,0],[0,-1,0],batch(ship.frame,'Replacement panel'));
    assert.ok(Math.abs(tunnel.y-layout.ringRadius-.42)<1e-5);
    assert.ok(EXTERIOR.radius+skin.y-tunnel.y>.90,'the pressure passage no longer intersects the folded habitat skin');
    for(const x of layout.railXs)for(const z of [layout.centerZ-1.3,layout.centerZ+1.3]){
      const y=ringRailSeat(layout.ringRadius,z-layout.centerZ).y-EXTERIOR.radius;
      const clamp=castLocal(pod,[x,y,z],[1,0,0],steel);
      const rail=castLocal(ship.frame,[x+.20,y+EXTERIOR.radius,z-layout.centerZ],[-1,0,0],batch(ship.frame,'Unpainted structure'));
      assert.ok(Math.abs(clamp.x-x-.15)<.002,'clamp bore meets the rail without a floating bracket');
      assert.ok(Math.abs(clamp.x-rail.x)<.002,'the saddle and actual ring tube share their bearing surface');
    }
  }finally{ship.dispose();}
});

test('all six pinned shoes stay seated and meet their spar endpoints at every core scale and rotor angle',()=>{
  const ship=createExteriorMothership(),layout=habitatMountLayout(EXTERIOR),pinY=layout.pinY-layout.skinY;
  try{
    assert.equal(ship.mountSockets.length,6);
    for(const scale of [1,2.6,1.6,2.8,1]){
      ship.setCoreScale(scale);
      for(const angle of [0,.8,Math.PI]){
        ship.setAngle(angle);ship.root.updateMatrixWorld(true);
        for(const [index,pod]of ship.pods.entries())for(const socket of ship.mountSockets.filter(socket=>socket.parent===pod)){
          const sparEnd=ship.spokes[index].localToWorld(new Vector3(socket.userData.sparX,layout.supportRadius,0));
          const pivot=socket.localToWorld(new Vector3(0,pinY,0));
          assert.ok(sparEnd.distanceTo(pivot)<1e-8,'the support terminates on the clevis pin, outside the pressure roof');
          const steel=batch(pod,'Unpainted structure');
          const cap=castLocal(socket,[0,pinY,2],[0,0,-1],steel);
          assert.ok(Math.abs(cap.z-.825)<1e-5,'the pin retaining cap follows the actual shoe geometry');
          const shoeTop=castLocal(socket,[.85,0,.70],[0,-1,0],steel);
          const foundation=castLocal(pod,[socket.position.x+.85,layout.skinY-.45,.70],[0,1,0],batch(pod,'Replacement panel'));
          assert.ok(Math.abs(shoeTop.y+socket.position.y-foundation.y)<1e-5,'the shoe bedplate bears on the common load-spreader');
          assert.deepEqual(socket.scale.toArray(),[1,1,1],'hardware is repositioned, not stretched');
        }
      }
    }
  }finally{ship.dispose();}
});

test('straight radial supports share the actual habitat exterior centerline while interior coordinates stay unchanged',()=>{
  const ship=createExteriorMothership(),layout=habitatMountLayout(EXTERIOR);
  const centerZ=(-HABITAT_ENVELOPE.front+HABITAT_ENVELOPE.rearRoomBack)/2;
  try{
    assert.equal(layout.centerZ,centerZ);
    for(const scale of [1,1.6,2.6,2.8])for(const angle of [0,.8,Math.PI]){
      ship.setCoreScale(scale);ship.setAngle(angle);ship.root.updateMatrixWorld(true);
      assert.equal(ship.hub.rotation.x,0,'the bearing hub has no compensating tilt');
      for(const [index,pod]of ship.pods.entries()){
        const patch=batch(pod,'Replacement panel');
        const front=castLocal(pod,[6,layout.skinY-.10,centerZ-4],[0,0,1],patch);
        const back=castLocal(pod,[6,layout.skinY-.10,centerZ+4],[0,0,-1],patch);
        assert.ok(Math.abs((front.z+back.z)/2-centerZ)<1e-5,'the actual load-spreader is centered on the outer roof');
        for(const socket of ship.mountSockets.filter(socket=>socket.parent===pod))assert.equal(socket.position.z,centerZ);
        const spoke=ship.spokes[index];
        assert.equal(spoke.rotation.x,pod.rotation.x,'the support is perpendicular to the habitat roof');
        for(const radial of [3.75,layout.supportRadius]){
          const endpoint=pod.worldToLocal(spoke.localToWorld(new Vector3(0,radial,0)));
          assert.ok(Math.abs(endpoint.z-centerZ)<1e-8,'both ends of the straight spar share the habitat centerline');
        }
        const neckFront=castLocal(pod,[0,layout.skinY-.45,centerZ-1],[0,0,1],patch);
        const neckBack=castLocal(pod,[0,layout.skinY-.45,centerZ+1],[0,0,-1],patch);
        assert.ok(Math.abs((neckFront.z+neckBack.z)/2-centerZ)<1e-5,'the external access neck shares the same centerline');
        const skin=batch(pod,'Habitat service skin');
        const casingFront=castLocal(pod,[HABITAT_ENVELOPE.right+.50,0,centerZ-8],[0,0,1],skin);
        const casingBack=castLocal(pod,[HABITAT_ENVELOPE.right+.50,0,centerZ+8],[0,0,-1],skin);
        assert.ok(Math.abs((casingFront.z+casingBack.z)/2-centerZ)<1e-5,'the real outer casing, not just its attachment, is centered');
        const center=pod.localToWorld(new Vector3(0,0,centerZ));
        assert.ok(Math.abs(Math.hypot(center.y,center.z)-EXTERIOR.radius)<1e-8);
        assert.deepEqual(pod.userData.windows,HABITAT_WINDOWS.map(window=>({...window,...cabinToHabitat(window)})));
        assert.equal(pod.userData.cabinScale,1);
        const ladder=cabinToHabitat({x:0,y:HABITAT_ENVELOPE.top,z:ACCESS_LADDER.depth});
        assert.equal(ladder.z,1.08,'the interior ladder has not been shifted onto the exterior centerline');
      }
    }
  }finally{ship.dispose();}
});

test('mount adjustments reuse the existing steel buffers and restore them exactly without adding draws',()=>{
  const ship=createExteriorMothership();
  try{
    const batches=ship.pods.map(pod=>batch(pod,'Unpainted structure'));
    const original=batches.map(mesh=>({geometry:mesh.geometry,positions:mesh.geometry.attributes.position.array.slice()}));
    let meshes=0,triangles=0;ship.root.traverse(mesh=>{
      if(!mesh.isMesh)return;meshes++;triangles+=(mesh.geometry.index?.count??mesh.geometry.attributes.position.count)/3;
    });
    assert.equal(meshes,99,'foundations, hub saddles and engine shoes add no mothership draw batches');
    assert.ok(triangles<50000,`structural detail stays below the geometry budget: ${triangles} triangles`);
    for(const scale of [2.8,1.6,2.6,1])ship.setCoreScale(scale);
    for(const [index,mesh]of batches.entries()){
      assert.equal(mesh.geometry,original[index].geometry);
      assert.deepEqual(mesh.geometry.attributes.position.array,original[index].positions);
    }
    assert.ok(ship.mountSockets.every(socket=>socket.children.length===0));
  }finally{ship.dispose();}
});

test('hub spar roots have bearing seats and all seven engine mounts meet recessed bulkhead shoes',()=>{
  const ship=createExteriorMothership();
  try{
    ship.setCoreScale(2.6);ship.setAngle(.73);ship.root.updateMatrixWorld(true);
    for(const x of [-1.75,1.75]){
      const socket=castLocal(ship.hub,[x,4.7,0],[0,-1,0],batch(ship.hub,'Warm service metal'));
      assert.ok(Math.abs(socket.y-4.475)<1e-5,'root collars close around the radial support rather than leaving an open sleeve');
    }
    for(const engine of ship.engines){
      const foot=castLocal(engine,[-.8,engine.userData.nozzleRadius-.2,.22],[1,0,0],batch(engine,'Unpainted structure'));
      assert.ok(Math.abs(foot.x+.39)<1e-5,'anchor plates sit proud of the bulkhead aft face');
      assert.ok(-16.4+foot.x< -16.7,'the mounting face is outside the solid mounting bulkhead');
      assert.ok(-16.4+foot.x+.18> -16.7,'the back of each shoe embeds into that bulkhead');
    }
  }finally{ship.dispose();}
});
