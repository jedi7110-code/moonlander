import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {sampleExteriorCinema,sampleExteriorCinemaFrame,CINEMA_SHOTS} from '../src/obs/exterior-cinematic.js';
import {sampleExteriorProbeFlight,applyExteriorProbePose} from '../src/obs/exterior-probe-flight.js';
import {createExteriorShip} from '../src/obs/ship-exterior.js';
const startOf=id=>CINEMA_SHOTS.slice(0,CINEMA_SHOTS.findIndex(shot=>shot.id===id)).reduce((time,shot)=>time+shot.duration,0);
const cameraFor=shot=>{
  const camera=new THREE.PerspectiveCamera(shot.fov,16/9,shot.near,shot.far);
  camera.position.fromArray(shot.eye);camera.up.fromArray(shot.up);camera.lookAt(new THREE.Vector3(...shot.target));camera.updateMatrixWorld(true);return camera;
};

test('03 brings the probe up from below the frame before the close docking shot',()=>{
  const ship=createExteriorShip();ship.setCoreScale(2.6);
  try{
    const start=startOf('distant'),ys=[];
    for(const seconds of [start,start+4,start+8-.001]){
      const shot=sampleExteriorCinema(seconds,{opening:true});ship.root.position.x=shot.shipX;applyExteriorProbePose(ship,shot.probe);ship.root.updateMatrixWorld(true);
      const center=ship.dockedLander.localToWorld(new THREE.Vector3(0,3.1,0)).project(cameraFor(shot));ys.push(center.y);
      assert.equal(shot.number,3);assert.equal(shot.probe.visible,true);assert.equal(shot.probe.latched,false);
    }
    assert.ok(ys[0]<-1,'the probe physically starts below the lower edge');
    assert.ok(ys[0]<ys[1]&&ys[1]<ys[2]&&ys[2]<0,'the probe approaches the bay from below');
    assert.equal(sampleExteriorCinema(start-1,{opening:true}).probe.visible,false,'there is no already-docked copy in the preceding shot');
  }finally{ship.dispose();}
});

test('the adjusted approach connects to the trimmed close-up, decelerates to contact and stays latched',()=>{
  const epsilon=.001,position=time=>sampleExteriorProbeFlight(time).position;
  const left=(position(8)[1]-position(8-epsilon)[1])/epsilon,right=(position(8+epsilon)[1]-position(8)[1])/epsilon;
  assert.ok(Math.abs(left-right)<.02,'vertical arrival velocity stays continuous at the close-up cut');
  let previous=-Infinity;
  for(let seconds=0;seconds<=26;seconds+=.25){
    const pose=sampleExteriorProbeFlight(seconds);assert.ok(pose.position[1]>=previous-1e-9&&pose.position[1]<=0);previous=pose.position[1];
  }
  const contact=sampleExteriorProbeFlight(20),held=sampleExteriorProbeFlight(100);
  assert.equal(contact.latched,true);assert.deepEqual(contact.position,[0,0,0]);assert.deepEqual(contact.rotation,[0,0,0]);assert.deepEqual(contact,held);
  const endVelocity=(position(20)[1]-position(20-epsilon)[1])/epsilon;
  assert.ok(endVelocity<.001,'the probe reaches contact with zero speed');
  const boundary=startOf('lander');
  const openingPose=sampleExteriorCinema(boundary,{opening:true});
  assert.deepEqual(openingPose.probe,sampleExteriorProbeFlight(12.5),'07 starts on the former 62.5-second docking pose');
  assert.ok(Math.abs(openingPose.fov-(40-8*4.5/14.75))<1e-10,'the zoom also starts on the requested frame');
  const contactTime=boundary+7.5;
  assert.equal(sampleExteriorCinema(contactTime-.001,{opening:true}).probe.latched,false);
  assert.equal(sampleExteriorCinema(contactTime,{opening:true}).probe.latched,true,'trimming the opening retains the remaining capture motion');
  assert.equal(sampleExteriorCinemaFrame(contactTime+2.5-.001,{opening:true}).to,null,'the docked shot holds for exactly 2.5 seconds');
  const transition=sampleExteriorCinemaFrame(contactTime+2.5+.001,{opening:true});
  assert.equal(transition.from.number,7);assert.equal(transition.to.number,4);assert.ok(transition.mix>0,'the dissolve starts 2.5 seconds after contact');
  for(const opening of [true,false]){
    const scale=opening?1:4/3;
    for(const offset of [-.5,0,.5]){
      const frame=sampleExteriorCinemaFrame(boundary*scale+offset,{opening});
      assert.deepEqual(frame.from.probe,frame.to.probe,'the adjusted wide approach shares the close-up arrival pose');
    }
  }
  const expected=sampleExteriorCinema(boundary+5,{opening:true});sampleExteriorCinema(500,{opening:true});assert.deepEqual(sampleExteriorCinema(boundary+5,{opening:true}),expected);
});

test('the real probe clears the hull and rotating habitats through approach and docking',()=>{
  const ship=createExteriorShip(),box=new THREE.Box3(),podBox=new THREE.Box3();
  try{
    for(const scale of [1,1.6,2.6,2.8]){
      ship.setCoreScale(scale);
      for(const seconds of [0,2,4,6,7,8,9,11,14,18,20,26]){
        const pose=sampleExteriorProbeFlight(seconds,{coreScale:scale});applyExteriorProbePose(ship,pose);
        for(const angle of [0,.8,Math.PI,5]){
          ship.setAngle(angle);ship.root.updateMatrixWorld(true);box.setFromObject(ship.dockedLander);
          assert.ok(box.max.y<-2.65*scale-.4,'the probe never enters the mother ship hull');
          for(const pod of ship.pods)assert.equal(box.intersectsBox(podBox.setFromObject(pod)),false,'the approach clears every rotating habitat');
        }
      }
      applyExteriorProbePose(ship,sampleExteriorProbeFlight(26,{coreScale:scale}));
      assert.deepEqual(ship.dockedLander.position.toArray(),[0,0,0]);assert.equal(ship.dockedLander.scale.x,1,'the game probe retains its real size');
    }
  }finally{ship.dispose();}
});

test('07 frames both the probe and docking collar closely, and later shots keep the probe attached',()=>{
  const ship=createExteriorShip();ship.setCoreScale(2.6);
  try{
    const start=startOf('lander');
    for(const seconds of [start,start+4,start+9.5]){
      const shot=sampleExteriorCinema(seconds,{opening:true}),camera=cameraFor(shot);ship.root.position.x=shot.shipX;applyExteriorProbePose(ship,shot.probe);ship.root.updateMatrixWorld(true);
      const center=ship.dockedLander.localToWorld(new THREE.Vector3(0,3.1,0)).project(camera);
      assert.ok(Math.abs(center.x)<.8&&Math.abs(center.y)<.8,'the probe is visible at the beginning and end of the close-up');
      const collar=ship.probeDock.localToWorld(new THREE.Vector3(0,5.43,0)).project(camera);
      assert.ok(Math.abs(collar.x)<1&&Math.abs(collar.y)<.84,'the connection point stays visible');
      assert.ok(camera.position.distanceTo(ship.probeDock.getWorldPosition(new THREE.Vector3()))<30,'camera is close to the docking bay');
    }
    for(const id of ['crossing','mounted','flyby']){
      const shot=sampleExteriorCinema(startOf(id)+2,{opening:true});assert.equal(shot.probe.latched,true);assert.deepEqual(shot.probe.position,[0,0,0]);
    }
    applyExteriorProbePose(ship,sampleExteriorCinema(start+2,{opening:true}).probe);
    applyExteriorProbePose(ship,sampleExteriorCinema(startOf('crossing')+1,{opening:true}).probe);
    assert.deepEqual(ship.dockedLander.position.toArray(),[0,0,0],'rendering another shot restores a fully docked pose');
  }finally{ship.dispose();}
});
