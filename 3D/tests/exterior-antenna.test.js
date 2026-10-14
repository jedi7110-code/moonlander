import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createParabolicAntenna} from '../src/obs/exterior-antenna.js';
test('the reflector is concave toward the feed and the feed aperture faces the bowl',()=>{
  const material=new THREE.MeshStandardMaterial();
  try{for(const radius of [.36,.38,.7]){
    const depth=radius*.30,antenna=createParabolicAntenna({radius,depth,material,structureMaterial:material,feedMaterial:material});antenna.updateMatrixWorld(true);
    const reflector=antenna.getObjectByName('Concave parabolic reflector');
    const surfaceY=x=>{
      const ray=new THREE.Raycaster(new THREE.Vector3(x,1,0),new THREE.Vector3(0,-1,0),0,2),hit=ray.intersectObject(reflector)[0];assert.ok(hit);return hit.point.y;
    };
    assert.ok(surfaceY(radius*.85)>surfaceY(radius*.10)+depth*.6,'the rim is above the center, rather than a convex umbrella');
    const aperture=antenna.getObjectByName('Feed aperture'),direction=new THREE.Vector3(0,0,1).applyQuaternion(aperture.quaternion);
    assert.ok(direction.dot(aperture.position.clone().negate().normalize())>.999,'the feed looks back into the reflector');
    assert.ok(Math.abs(aperture.position.y-radius*radius/(4*depth))<1e-10,'the feed aperture sits at the paraboloid focus');
    antenna.traverse(mesh=>mesh.geometry?.dispose());
  }}finally{material.dispose();}
});
