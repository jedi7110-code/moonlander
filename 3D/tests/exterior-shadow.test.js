import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createExteriorShip} from '../src/obs/ship-exterior.js';
import {createExteriorShadow} from '../src/obs/exterior-shadow.js';
import {sampleExteriorCinema,sampleExteriorCinemaFrame,exteriorCinemaShots} from '../src/obs/exterior-cinematic.js';

test('docking shadows resolve ladder rungs and preserve the shallow cover clearance',()=>{
  const ship=createExteriorShip(),sun=new THREE.DirectionalLight(),shadows=createExteriorShadow(sun,ship);
  try{
    shadows.update(sampleExteriorCinema(64.5,{opening:true}));
    const camera=sun.shadow.camera,texel=(camera.right-camera.left)/sun.shadow.mapSize.x;
    assert.ok(.09/texel>=6,'a 9cm rung spans at least six shadow texels');
    const offset=Math.abs(sun.shadow.bias)*(camera.far-camera.near)+sun.shadow.normalBias;
    assert.ok(offset<.02,'bias stays below the raised cover clearance');
    assert.ok(Math.abs(camera.projectionMatrix.elements[0]-1/camera.right)<1e-12,'the actual shadow projection uses the tighter bounds');
    shadows.update(sampleExteriorCinema(0,{opening:true}));
    assert.equal(camera.right,80);assert.equal(camera.near,1);assert.equal(camera.far,320);
    assert.equal(sun.shadow.normalBias,.05,'the outgoing view restores the whole-ship shadow configuration');
  }finally{ship.dispose();}
});

test('translating the approaching probe leaves its surface on the same shadow texels',()=>{
  const ship=createExteriorShip(),sun=new THREE.DirectionalLight(),shadows=createExteriorShadow(sun,ship);
  ship.setCoreScale(2.6);
  const coordinate=(shipX,position)=>{
    ship.root.position.x=shipX;ship.dockedLander.position.set(...position);ship.dockedLander.rotation.set(0,0,0);
    shadows.update(sampleExteriorCinema(64.5,{opening:true}));sun.updateMatrixWorld(true);sun.target.updateMatrixWorld(true);sun.shadow.updateMatrices(sun);
    return ship.dockedLander.localToWorld(new THREE.Vector3(0,1.76,1.9725)).applyMatrix4(sun.shadow.matrix);
  };
  try{
    const a=coordinate(0,[2,-3,0]),b=coordinate(30,[0,-1,0]);
    assert.ok(a.distanceTo(b)<1e-12,'ship and probe translation cannot make a fixed panel shadow crawl across the map');
  }finally{ship.dispose();}
});

test('the real approach dissolve activates the close shadow only for the docking camera',()=>{
  const ship=createExteriorShip(),sun=new THREE.DirectionalLight(),shadows=createExteriorShadow(sun,ship);
  try{
    const shots=exteriorCinemaShots(),dockingStart=shots.slice(0,shots.findIndex(shot=>shot.id==='lander')).reduce((time,shot)=>time+shot.duration,0);
    const frame=sampleExteriorCinemaFrame(dockingStart-.2,{opening:true,transition:'dissolve'});
    assert.equal(frame.from.id,'distant');assert.equal(frame.to.id,'lander');
    for(const shot of [frame.from,frame.to,frame.from]){
      shadows.update(shot);
      assert.equal(sun.shadow.camera.right,shot.id==='lander'?12:80);
    }
  }finally{ship.dispose();}
});
