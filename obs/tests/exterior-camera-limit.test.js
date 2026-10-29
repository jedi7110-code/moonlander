import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createExteriorCameraLimit} from '../src/obs/exterior-camera-limit.js';
import {createExteriorShip} from '../src/obs/ship-exterior.js';

test('a camera inside a front-sided hull is moved outside its exit face with two metres clearance',()=>{
  const root=new THREE.Group(),material=new THREE.MeshBasicMaterial(),mesh=new THREE.Mesh(new THREE.BoxGeometry(40,20,20),material);
  root.add(mesh);const camera=new THREE.PerspectiveCamera(),controls={target:new THREE.Vector3(),maxDistance:260};
  camera.position.set(1,0,0);
  const guard=createExteriorCameraLimit({ship:{root},camera,controls});
  try{
    assert.equal(guard.update(),22);assert.equal(camera.position.x,22);assert.equal(controls.minDistance,22);
    assert.equal(material.side,THREE.FrontSide,'collision queries do not change the ship appearance');
    root.position.x=3600;camera.position.set(3601,0,0);controls.target.x=3600;
    guard.update();assert.equal(camera.position.x,3622,'the limit follows the cruising ship');
    camera.position.set(3700,100,0);guard.update();
    assert.ok(Math.abs(controls.minDistance-(10*Math.SQRT2+2))<1e-8,'a distant camera already has the correct hull stop');
  }finally{guard.dispose();mesh.geometry.dispose();material.dispose();}
});

test('zoom stops before a separate thin habitat even when a wheel step would skip it',()=>{
  const root=new THREE.Group(),material=new THREE.MeshBasicMaterial(),habitat=new THREE.Mesh(new THREE.BoxGeometry(.1,10,10),material);
  habitat.position.x=30;root.add(habitat);
  const camera=new THREE.PerspectiveCamera(),controls={target:new THREE.Vector3(),maxDistance:520};
  const guard=createExteriorCameraLimit({ship:{root},camera,controls});
  try{
    camera.position.x=100;guard.update();
    assert.ok(Math.abs(controls.minDistance-32.05)<1e-6,'the stop is established before reaching the hull bounds');
    camera.position.x=8;guard.update();
    assert.ok(Math.abs(camera.position.x-32.05)<1e-6,'a large zoom step cannot tunnel through the habitat');
    assert.equal(controls.maxDistance,520,'collision protection preserves the doubled zoom-out range');
    habitat.visible=false;camera.position.x=8;guard.update();
    assert.equal(controls.minDistance,8,'hidden geometry cannot block zoom');
    habitat.visible=true;camera.position.set(0,100,0);guard.update();
    assert.equal(controls.minDistance,8,'empty space keeps the normal close limit');
  }finally{guard.dispose();habitat.geometry.dispose();material.dispose();}
});

test('free exterior keeps the preview standoff even after panning or a large zoom step',()=>{
  const root=new THREE.Group(),material=new THREE.MeshBasicMaterial(),mesh=new THREE.Mesh(new THREE.BoxGeometry(40,20,20),material);
  root.add(mesh);
  const camera=new THREE.PerspectiveCamera(),controls={target:new THREE.Vector3(),maxDistance:5000};
  const guard=createExteriorCameraLimit({ship:{root},camera,controls,minShipDistance:100});
  try{
    camera.position.set(150,0,0);assert.equal(guard.update(),100,'the nearest zoom is the preview distance, not the hull surface');
    camera.position.set(5,0,0);guard.update();assert.equal(camera.position.length(),100);
    controls.target.set(10,0,50);camera.position.set(30,0,50);guard.update();
    assert.ok(Math.abs(camera.position.length()-100)<1e-10,'panning cannot bypass the distance from the ship');
    root.position.set(3600,0,0);controls.target.set(3610,0,50);camera.position.set(3630,0,50);guard.update();
    assert.ok(Math.abs(camera.position.distanceTo(root.position)-100)<1e-10,'the standoff follows the cruising ship');
    assert.equal(controls.maxDistance,5000);
  }finally{guard.dispose();mesh.geometry.dispose();material.dispose();}
});

test('near zoom and orbit directions stay outside the real hull and rotating habitats at every core scale',()=>{
  const ship=createExteriorShip(),camera=new THREE.PerspectiveCamera(),controls={target:new THREE.Vector3(),maxDistance:260};
  const guard=createExteriorCameraLimit({ship,camera,controls}),collisionMaterial=new THREE.MeshBasicMaterial({side:THREE.DoubleSide});
  const proxies=[];ship.root.traverse(mesh=>{if(mesh.isMesh&&!mesh.isInstancedMesh&&[].concat(mesh.material).some(m=>m.depthWrite&&m.opacity>0))proxies.push({source:mesh,proxy:new THREE.Mesh(mesh.geometry,collisionMaterial)});});
  const ray=new THREE.Raycaster(),direction=new THREE.Vector3();
  try{
    for(const scale of [1,2.6,2.8])for(const angle of [0,55*Math.PI/180,2.3]){
      ship.setCoreScale(scale);ship.setAngle(angle);ship.root.position.x=1200;ship.root.updateMatrixWorld(true);
      for(const target of [new THREE.Vector3(1198,0,0),ship.pods[0].getWorldPosition(new THREE.Vector3())]){
        for(const offset of [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]]){
          controls.target.copy(target);camera.position.copy(target).add(new THREE.Vector3(...offset));guard.update();
          const distance=camera.position.distanceTo(target);direction.copy(camera.position).sub(target).normalize();
          for(const {source,proxy}of proxies)proxy.matrixWorld.copy(source.matrixWorld);
          ray.set(target,direction);const hits=ray.intersectObjects(proxies.map(p=>p.proxy),false);
          assert.ok(distance>=8-1e-8);
          if(hits.length)assert.ok(distance>=hits.at(-1).distance+2-1e-6,'the camera remains beyond the outermost surface, including rotating sections');
        }
      }
    }
  }finally{guard.dispose();collisionMaterial.dispose();ship.dispose();}
});
