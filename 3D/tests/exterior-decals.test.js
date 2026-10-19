import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createExteriorShip} from '../src/obs/ship-exterior.js';
import {EXTERIOR_DECAL_CLEARANCE} from '../src/obs/exterior-decals.js';
import {HABITAT_ENVELOPE} from '../src/obs/habitat-envelope.js';

test('habitat hatch warnings stay centered and their printed rows follow the door edges',()=>{
  const ship=createExteriorShip(),centerZ=(-HABITAT_ENVELOPE.front+HABITAT_ENVELOPE.rearRoomBack)/2;
  try{
    ship.setAngle(.7);ship.root.updateMatrixWorld(true);let count=0;
    for(const pod of ship.pods)pod.traverse(mesh=>{
      if(!mesh.userData.exteriorDecal)return;
      const positions=mesh.geometry.attributes.position,uv=mesh.geometry.attributes.uv;
      for(const entry of mesh.userData.markings){
        if(entry.key!=='pressure')continue;count++;
        assert.ok(Math.abs(entry.point[2]-centerZ)<1e-9,'label stays centered across the door');
        for(let i=entry.vertexStart;i<entry.vertexStart+entry.vertexCount;i+=3){
          const a=new THREE.Vector3().fromBufferAttribute(positions,i),b=new THREE.Vector3().fromBufferAttribute(positions,i+1),c=new THREE.Vector3().fromBufferAttribute(positions,i+2);
          const du1=uv.getX(i+1)-uv.getX(i),du2=uv.getX(i+2)-uv.getX(i),dv1=uv.getY(i+1)-uv.getY(i),dv2=uv.getY(i+2)-uv.getY(i),det=du1*dv2-du2*dv1;
          if(Math.abs(det)<1e-12)continue;
          const up=c.clone().sub(a).multiplyScalar(du1).sub(b.clone().sub(a).multiplyScalar(du2)).multiplyScalar(1/det).normalize();
          assert.ok(up.dot(new THREE.Vector3(0,1,0))>.99999,'actual atlas UVs align with the hatch vertical axis');
          for(const p of [a,b,c]){assert.ok(Math.abs(p.z-centerZ)<.86);assert.ok(p.y>-1.74&&p.y<.74,'ink stays on the pressure cover');}
        }
      }
    });assert.equal(count,6);
  }finally{ship.dispose();}
});

test('equipment warnings remain on the actual craft surfaces after scaling and rotor rotation',()=>{
  const ship=createExteriorShip();
  try{
    for(const scale of [1,2.6]){
      ship.setCoreScale(scale);ship.setAngle(.7);ship.root.updateMatrixWorld(true);let count=0;
      ship.root.traverse(decal=>{
        if(!decal.userData.exteriorDecal)return;
        const body=[];decal.parent.traverseVisible(mesh=>{if(mesh.isMesh&&!mesh.isInstancedMesh&&!mesh.userData.exteriorDecal&&!mesh.material.transparent)body.push(mesh);});
        for(const entry of decal.userData.markings){
          count++;
          const point=decal.parent.localToWorld(new THREE.Vector3(...entry.point)),normal=new THREE.Vector3(...entry.normal).transformDirection(decal.parent.matrixWorld);
          const ray=new THREE.Raycaster(point.clone().addScaledVector(normal,.02),normal.negate(),0,.04),hit=ray.intersectObjects(body,false)[0];
          assert.ok(hit&&Math.abs(hit.distance-.02)<.002,`${decal.parent.name}/${entry.key} sits on its physical surface`);
        }
      });assert.equal(count,29,'both craft and four inspection lids have equipment-specific markings');
    }
  }finally{ship.dispose();}
});

test('inspection lid warning text reads upright on both sides of the ship',()=>{
  const ship=createExteriorShip();let left=0,right=0;
  try{
    ship.core.traverse(mesh=>{
      if(!mesh.userData.exteriorDecal)return;
      const p=mesh.geometry.attributes.position,uv=mesh.geometry.attributes.uv;
      for(const entry of mesh.userData.markings){
        if(entry.key!=='electrical')continue;
        entry.point[2]<0?left++:right++;
        for(let i=entry.vertexStart;i<entry.vertexStart+entry.vertexCount;i+=3){
          const a=new THREE.Vector3().fromBufferAttribute(p,i),b=new THREE.Vector3().fromBufferAttribute(p,i+1).sub(a),c=new THREE.Vector3().fromBufferAttribute(p,i+2).sub(a);
          const du1=uv.getX(i+1)-uv.getX(i),du2=uv.getX(i+2)-uv.getX(i),dv1=uv.getY(i+1)-uv.getY(i),dv2=uv.getY(i+2)-uv.getY(i),det=du1*dv2-du2*dv1;
          if(Math.abs(det)<1e-12)continue;
          const up=c.multiplyScalar(du1).sub(b.multiplyScalar(du2)).multiplyScalar(1/det).normalize();
          assert.ok(up.y>.6,'printed upper edge must face the top of the ship on either side');
        }
      }
    });assert.equal(left,2);assert.equal(right,2);
  }finally{ship.dispose();}
});

test('rendered warning triangles have physical clearance and bow warnings clear all window hardware',()=>{
  const ship=createExteriorShip();
  try{
    for(const scale of [1,2.6]){
      ship.setCoreScale(scale);ship.setAngle(.7);ship.root.updateMatrixWorld(true);let bowCount=0,triangles=0;
      ship.root.traverse(decal=>{
        if(!decal.userData.exteriorDecal)return;
        const surfaces=[];decal.parent.traverseVisible(mesh=>{if(mesh.isMesh&&!mesh.isInstancedMesh&&!mesh.userData.exteriorDecal)surfaces.push(mesh);});
        const opaque=surfaces.filter(mesh=>!mesh.material.transparent),positions=decal.geometry.attributes.position;
        for(const entry of decal.userData.markings){
          const bow=entry.key==='sensor'&&entry.point[0]>10;
          if(bow)bowCount++;
          for(let i=entry.vertexStart;i<entry.vertexStart+entry.vertexCount;i+=3){
            const a=new THREE.Vector3().fromBufferAttribute(positions,i),b=new THREE.Vector3().fromBufferAttribute(positions,i+1),c=new THREE.Vector3().fromBufferAttribute(positions,i+2);
            const normal=b.clone().sub(a).cross(c.clone().sub(a));
            if(normal.lengthSq()<1e-14)continue;
            normal.normalize().transformDirection(decal.matrixWorld);
            const center=a.add(b).add(c).multiplyScalar(1/3).applyMatrix4(decal.matrixWorld);
            const hit=new THREE.Raycaster(center,normal.clone().negate(),0,.02).intersectObjects(opaque,false)[0];
            assert.ok(hit&&hit.distance>.001&&hit.distance<.011,`${decal.parent.name}/${entry.key}: rendered ink clears the body`);
            triangles++;
            if(bow){
              const outside=new THREE.Raycaster(center.clone().addScaledVector(normal,.2),normal.clone().negate(),0,.22).intersectObjects(surfaces,false)[0];
              assert.ok(outside&&Math.abs(outside.distance-(.2+EXTERIOR_DECAL_CLEARANCE*scale))<.0001,'bow ink is entirely on an exposed panel, outside the window frames and glass');
            }
          }
        }
      });
      assert.equal(bowCount,2);assert.ok(triangles>200,'check actual merged geometry across both craft');
    }
  }finally{ship.dispose();}
});

test('the probe antenna mounts on its outboard support outside the docking capture envelope',()=>{
  const ship=createExteriorShip(),probe=ship.dockedLander;
  try{
    probe.removeFromParent();probe.updateMatrixWorld(true);
    const antenna=probe.getObjectByName('Probe directional communications antenna');assert.ok(antenna);
    const coupling=antenna.localToWorld(new THREE.Vector3(0,-.045,0));
    const ray=new THREE.Raycaster(coupling.clone().add(new THREE.Vector3(.2,0,0)),new THREE.Vector3(-1,0,0),0,.4);
    const hit=ray.intersectObject(antenna,true)[0];
    assert.ok(hit&&hit.distance>.1&&hit.distance<.2,'the antenna coupling surrounds the outboard support endpoint');
    antenna.traverse(mesh=>{
      if(!mesh.isMesh)return;
      const positions=mesh.geometry.attributes.position;
      for(let index=0;index<positions.count;index++){
        const point=mesh.localToWorld(new THREE.Vector3().fromBufferAttribute(positions,index));
        if(point.y>5.30)assert.ok(Math.hypot(point.x,point.z)>1.20,'the dish and feed clear the mating flange and capture guides');
      }
    });
  }finally{ship.probeDock.add(probe);ship.dispose();}
});
