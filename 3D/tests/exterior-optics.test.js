import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createExteriorShip} from '../src/obs/ship-exterior.js';
import {sampleExteriorCinema} from '../src/obs/exterior-cinematic.js';
import {projectedShipSize,sampleExteriorOptics} from '../src/obs/exterior-optics.js';

function cameraFor(shot,aspect,fov=shot.fov){
  const camera=new THREE.PerspectiveCamera(fov,aspect,shot.near,shot.far);
  camera.position.fromArray(shot.eye);camera.lookAt(new THREE.Vector3(...shot.target));return camera;
}

test('changing viewport aspect preserves flare length and brightness for the same ship projection',()=>{
  const ship=createExteriorShip();ship.setCoreScale(2.6);
  try{
    for(const time of [109,126,160]){
      const shot=sampleExteriorCinema(time,{opening:true});ship.root.position.x=shot.shipX;
      const samples=[.6,16/9,2.4].map(aspect=>sampleExteriorOptics(ship,cameraFor(shot,aspect),new THREE.Vector2(720*aspect,720),shot.optics));
      for(const sample of samples.slice(1))for(let i=0;i<sample.length;i++){
        assert.ok(Math.abs(sample[i].streakSize-samples[0][i].streakSize)<1e-8);
        assert.ok(Math.abs(sample[i].haloSize-samples[0][i].haloSize)<1e-8);
        assert.equal(sample[i].strength,samples[0][i].strength);
      }
    }
  }finally{ship.dispose();}
});

test('FOV, zoom and pixel density scale the ship and flare together without increasing brightness',()=>{
  const ship=createExteriorShip();ship.setCoreScale(2.6);
  try{
    const shot=sampleExteriorCinema(126,{opening:true});ship.root.position.x=shot.shipX;
    let baseline;
    for(const fov of [32,56,80])for(const density of [1,2]){
      const camera=cameraFor(shot,16/9,fov),viewport=new THREE.Vector2(1280*density,720*density);
      const size=projectedShipSize(ship,camera,viewport),samples=sampleExteriorOptics(ship,camera,viewport,shot.optics);
      const normalized=samples[0].streakSize/(density*camera.projectionMatrix.elements[5]);
      baseline??=normalized;assert.ok(Math.abs(normalized-baseline)<1e-8,'flare follows the projected object through FOV changes');
      assert.ok(Math.abs(samples[0].streakSize/size-2.4)<1e-10);
      assert.ok(Math.abs(samples[0].strength-(.65+.20)/2*.8)<1e-12,'last-shot brightness is twenty percent below the midpoint after visual feedback');
      camera.zoom=1.5;camera.updateProjectionMatrix();
      const zoomed=sampleExteriorOptics(ship,camera,viewport,shot.optics)[0];
      assert.ok(Math.abs(zoomed.streakSize/samples[0].streakSize-1.5)<1e-10);
      assert.equal(zoomed.strength,samples[0].strength);
    }
    const camera=cameraFor(shot,16/9),viewport=new THREE.Vector2(1280,720);
    const before=sampleExteriorOptics(ship,camera,viewport,shot.optics);
    ship.setAngle(2.1);
    assert.deepEqual(sampleExteriorOptics(ship,camera,viewport,shot.optics),before,'rotating habitats cannot modulate the flare');
  }finally{ship.dispose();}
});
