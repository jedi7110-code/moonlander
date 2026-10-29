import test from 'node:test';
import assert from 'node:assert/strict';
import {Box3,Matrix4,Raycaster,Vector3} from 'three';
import {createExteriorShip} from '../src/obs/ship-exterior.js';
import {sampleExteriorProbeFlight,applyExteriorProbePose} from '../src/obs/exterior-probe-flight.js';

test('the probe dish, rim and feed clear the actual cabin skin instead of burying the inner edge',()=>{
  const ship=createExteriorShip(),probe=ship.dockedLander;
  try{
    probe.removeFromParent();probe.updateMatrixWorld(true);
    const antenna=probe.getObjectByName('Probe directional communications antenna'),skin=[];
    probe.traverse(mesh=>{if(mesh.isMesh&&mesh.material.name==='Probe aged pressure panels')skin.push(mesh);});
    assert.equal(antenna.userData.antenna.radius,.38);assert.equal(antenna.userData.antenna.depth,.13);
    let checked=0;
    antenna.traverse(mesh=>{if(!mesh.isMesh)return;
      const positions=mesh.geometry.attributes.position;
      for(let index=0;index<positions.count;index++){
        const point=new Vector3().fromBufferAttribute(positions,index).applyMatrix4(mesh.matrixWorld);
        const normal=new Vector3(point.x,0,point.z).normalize(),origin=normal.clone().multiplyScalar(4);origin.y=point.y;
        const hit=new Raycaster(origin,normal.clone().negate(),0,4).intersectObjects(skin,false)[0];
        if(!hit)continue;checked++;
        assert.ok(point.clone().sub(hit.point).dot(normal)>.14,'the complete antenna retains at least 14cm clearance from the cabin pressure skin');
      }
    });
    assert.ok(checked>3000,'check the complete baked reflector and its fittings, not just its centre');
  }finally{ship.probeDock.add(probe);ship.dispose();}
});

test('the probe antenna rests on a conformal bolted foundation and keeps the existing draw batches',()=>{
  const ship=createExteriorShip(),probe=ship.dockedLander;
  try{
    probe.removeFromParent();probe.updateMatrixWorld(true);
    const foundation=probe.getObjectByName('Probe bolted antenna saddle'),skin=[];
    probe.traverse(mesh=>{if(mesh.isMesh&&mesh.material.name==='Probe aged pressure panels')skin.push(mesh);});
    assert.deepEqual(foundation.userData.antennaFoundation,{width:.36,height:.38,depth:.075});
    const normal=new Vector3(0,0,1).transformDirection(foundation.matrixWorld);
    assert.ok(normal.x>.98&&normal.y>.1,'the foundation follows the upward slope of the real side facet');
    for(const horizontal of [-.15,.15])for(const vertical of [-.15,.15]){
      const back=foundation.localToWorld(new Vector3(horizontal,vertical,-.075/2));
      const hit=new Raycaster(back.clone().addScaledVector(normal,.1),normal.clone().negate(),0,.15).intersectObjects(skin,false)[0];
      assert.ok(hit&&hit.distance>.08&&hit.distance<.10,'every corner of the foundation embeds in the skin rather than floating or crossing a hull corner');
      assert.ok(hit.face.normal.clone().transformDirection(hit.object.matrixWorld).dot(normal)>.999);
    }
    let meshes=0;ship.probeDock.add(probe);ship.root.traverse(mesh=>{if(mesh.isMesh)meshes++;});
    assert.equal(meshes,137,'antenna fittings stay batched; the telescopic ladder adds thirteen draw batches');
  }finally{ship.probeDock.add(probe);ship.dispose();}
});

test('the complete probe antenna clears the mother hull and all moving capture claws during approach and lock',()=>{
  const ship=createExteriorShip(),antenna=ship.dockedLander.getObjectByName('Probe directional communications antenna');
  const separation=(from,to)=>Math.hypot(...['x','y','z'].map(axis=>Math.max(0,from.min[axis]-to.max[axis],to.min[axis]-from.max[axis])));
  try{
    const mother=[];let motherHits=0;ship.core.traverseVisible(mesh=>{if(mesh.isMesh&&!mesh.material.transparent)mother.push(mesh);});
    for(const scale of [1,1.6,2.6,2.8]){
      ship.setCoreScale(scale);
      for(const seconds of [0,8,16,18,19.5,20,20.12,20.25,20.4,20.6,20.8,20.93,21.5]){
        applyExteriorProbePose(ship,sampleExteriorProbeFlight(seconds,{coreScale:scale}));ship.root.updateMatrixWorld(true);
        const bounds=new Box3().setFromObject(antenna,true);
        for(const mesh of ship.dockCapture.group.children){
          if(!mesh.geometry.boundingBox)mesh.geometry.computeBoundingBox();
          for(let instance=0;instance<mesh.count;instance++){
            const transform=new Matrix4();mesh.getMatrixAt(instance,transform);transform.premultiply(mesh.matrixWorld);
            const moving=mesh.geometry.boundingBox.clone().applyMatrix4(transform);
            assert.ok(separation(bounds,moving)>.15,'even conservative bounds retain 15cm clearance to every hook, actuator barrel and piston rod');
          }
        }
        if(seconds<16)continue;
        for(const horizontal of [bounds.min.x,bounds.max.x])for(const lateral of [bounds.min.z,bounds.max.z]){
          const hit=new Raycaster(new Vector3(horizontal,bounds.max.y,lateral),new Vector3(0,1,0),0,8).intersectObjects(mother,false)[0];
          assert.ok(!hit||hit.distance>1.5,'the antenna stays below the actual mother hull or the open passage, not just clear of the clamp');
          if(hit)motherHits++;
        }
      }
    }
    assert.ok(motherHits>0,'the clearance rays reach the actual mother hull outside its docking opening');
  }finally{ship.dispose();}
});
