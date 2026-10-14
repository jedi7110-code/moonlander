import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createExteriorShip} from '../src/obs/ship-exterior.js';
import {EXTERIOR_DECAL_CLEARANCE} from '../src/obs/exterior-decals.js';

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
      });assert.equal(count,25,'both craft have equipment-specific markings');
    }
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

test('the corrected probe antenna mounts on the top of its existing mast',()=>{
  const ship=createExteriorShip(),probe=ship.dockedLander;
  try{
    probe.removeFromParent();probe.updateMatrixWorld(true);
    const antenna=probe.getObjectByName('Probe directional communications antenna');assert.ok(antenna);
    const ray=new THREE.Raycaster(new THREE.Vector3(1,6.13,-.5),new THREE.Vector3(-1,0,0),0,.4);
    const hit=ray.intersectObject(antenna,true)[0];
    assert.ok(hit&&hit.distance>.1&&hit.distance<.2,'the antenna coupling surrounds the mast endpoint');
  }finally{ship.probeDock.add(probe);ship.dispose();}
});
