import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {sampleExteriorExportFrame} from '../src/obs/exterior-export.js';
import {sampleExteriorCinemaFrame} from '../src/obs/exterior-cinematic.js';
import {createExteriorMothership} from '../src/obs/exterior-mothership.js';
import {EXTERIOR_LOGO} from '../src/obs/exterior-logo.js';

const options={opening:true,approach:'bow',ending:'underside',docking:'probe-follow',aspect:4/5};
test('full-bleed 4:5 keeps the entire moving hull offscreen until the logo fades',()=>{
  const ship=createExteriorMothership();ship.setCoreScale(2.6);
  const point=new THREE.Vector3(),camera=new THREE.PerspectiveCamera();camera.aspect=4/5;
  function lowest(time){
    const shot=sampleExteriorExportFrame(time,options).from;
    camera.fov=shot.fov;camera.near=shot.near;camera.far=shot.far;
    camera.position.fromArray(shot.eye);camera.up.fromArray(shot.up);camera.lookAt(new THREE.Vector3(...shot.target));camera.updateProjectionMatrix();camera.updateMatrixWorld(true);
    ship.root.position.x=shot.shipX;ship.setAngle(shot.angle);ship.root.updateMatrixWorld(true);
    let y=Infinity;
    ship.root.traverseVisible(mesh=>{
      const p=mesh.geometry?.attributes.position;if(!p)return;
      for(let i=0;i<p.count;i++){
        point.fromBufferAttribute(p,i).applyMatrix4(mesh.matrixWorld).project(camera);y=Math.min(y,point.y);
      }
    });return y;
  }
  try{
    for(let time=0;time<=EXTERIOR_LOGO.hold;time+=.1)assert.ok(lowest(time)>1,`hull visible before logo fade at ${time}`);
    const entry=lowest(EXTERIOR_LOGO.end-.3);assert.ok(entry<1&&entry>0,'hull enters through the upper edge during the fade');
    for(const time of [0,2.4,5.8,7.1,12,30,38.4]){
      const shot=sampleExteriorExportFrame(time,options).from,native=sampleExteriorCinemaFrame(time,options).from;
      for(const key of ['shipX','shipSpeed','shipVisible','eye','target','titleOpacity','logoReveal','logoClip'])assert.deepEqual(shot[key],native[key]);
      assert.equal(shot.shipVisible,true,'entry uses continuous flight, never a visibility switch');
    }
  }finally{ship.dispose();}
});
test('export retains all later shots, edit times, and incoming dissolve framing',()=>{
  for(const time of [40.6,44,60,63,68,80,106,151.7])assert.deepEqual(sampleExteriorExportFrame(time,options),sampleExteriorCinemaFrame(time,options));
  const frame=sampleExteriorExportFrame(39.5,options),native=sampleExteriorCinemaFrame(39.5,options);
  assert.equal(frame.mix,native.mix);assert.deepEqual(frame.to,native.to);assert.ok(frame.from.fov<native.from.fov);
});
