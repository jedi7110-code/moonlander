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
    camera.position.set(3700,100,0);guard.update();assert.equal(controls.minDistance,8,'a clear distant view keeps normal orbit controls');
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
