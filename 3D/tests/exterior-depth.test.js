import test from 'node:test';
import assert from 'node:assert/strict';
import {PerspectiveCamera,Box3,Vector3} from 'three';
import {fitExteriorInspectionDepth} from '../src/obs/exterior-depth.js';
import {sampleExteriorCinemaFrame} from '../src/obs/exterior-cinematic.js';

const bounds=new Box3(new Vector3(-72,-40,-40),new Vector3(46,40,40));
const depth=(camera,d)=>.5*(camera.far+camera.near)/(camera.far-camera.near)-camera.far*camera.near/((camera.far-camera.near)*d)+.5;
test('wide inspection preserves the glass and hatch clearances in a 24-bit depth buffer',()=>{
  const target=new Vector3(),camera=new PerspectiveCamera(38,4/5,.05,2000);
  for(const distance of [120,200,400,700]){
    camera.position.set(distance,0,0);fitExteriorInspectionDepth(camera,target,bounds);
    // 0.02m hatch label clearance, viewed at a grazing angle.
    const surface=distance+72,gap=.02*.25;
    const steps=(depth(camera,surface)-depth(camera,surface-gap))*(2**24-1);
    assert.ok(steps>4,`raised surface loses depth separation at ${distance}m: ${steps}`);
  }
});
test('the near plane stays before the actual model during close inspection',()=>{
  const target=new Vector3(39,4.8,0),camera=new PerspectiveCamera(38,1,.05,2000);
  camera.position.set(46.08,4.8,0);fitExteriorInspectionDepth(camera,target,bounds);
  assert.ok(camera.near<=.02000001,'an 8cm gap retains the closest surface');
  camera.position.set(44,4.8,0);fitExteriorInspectionDepth(camera,target,bounds);
  assert.ok(camera.near<=.1,'inside the broad bounds, preserve detail inspection');
  assert.ok(Number.isFinite(camera.projectionMatrix.elements[10]));
});

test('cinema 03 and 04 retain raised panel depth precision in landscape and portrait',()=>{
  for(const aspect of [16/9,4/5,9/16])for(const approach of [null,'bow'])for(const time of [59,78]){
    const shot=sampleExteriorCinemaFrame(time,{opening:true,approach,ending:'underside',docking:'probe-follow',aspect}).shot;
    const eye=new Vector3(...shot.eye),target=new Vector3(...shot.target),distance=eye.distanceTo(target);
    const camera=new PerspectiveCamera(shot.fov,aspect,shot.near,shot.far);
    const farSkin=distance+100,grazingGap=.016*.25;
    const steps=(depth(camera,farSkin)-depth(camera,farSkin-grazingGap))*(2**24-1);
    assert.ok(steps>4,`scene ${shot.number} loses plate separation at aspect ${aspect}: ${steps}`);
    assert.ok(camera.near<distance-100,'near plane remains before the entire ship and probe envelope');
  }
});
