import test from 'node:test';
import assert from 'node:assert/strict';
import {Matrix4,Vector3,Raycaster} from 'three';
import {readFile} from 'node:fs/promises';
import {createExteriorShip} from '../src/obs/ship-exterior.js';
import {DOCK_CAPTURE,sampleDockCapture,dockCaptureAngle} from '../src/obs/exterior-docking-lock.js';
import {sampleExteriorProbeFlight,applyExteriorProbePose} from '../src/obs/exterior-probe-flight.js';
import {sampleExteriorCinema,sampleExteriorCinemaFrame,CINEMA_SHOTS} from '../src/obs/exterior-cinematic.js';

const contactTime=CINEMA_SHOTS.slice(0,CINEMA_SHOTS.findIndex(shot=>shot.id==='lander')).reduce((total,shot)=>total+shot.duration,0)+7.5;

test('capture waits for seating, lowers the hooks, then draws them tight before the docking shot ends',()=>{
  for(const timeScale of [1,4/3]){
    assert.equal(sampleDockCapture(-1,timeScale),0);assert.equal(sampleDockCapture(.12*timeScale,timeScale),0);
    assert.equal(sampleDockCapture(1*timeScale,timeScale),1);
    let previous=0,angle=DOCK_CAPTURE.openAngle;
    for(let seconds=0;seconds<1.2;seconds+=.01){
      const progress=sampleDockCapture(seconds*timeScale,timeScale),nextAngle=dockCaptureAngle(progress);
      assert.ok(progress>=previous&&nextAngle<=angle+1e-12);previous=progress;angle=nextAngle;
    }
    for(const offset of [-1,0,.1,.3,.6,1,2]){
      const shot=sampleExteriorCinema((contactTime+offset)*timeScale,{opening:timeScale===1});
      assert.equal(shot.probe.visible,true);
      assert.ok(Math.abs(shot.probe.dockCapture-sampleDockCapture(offset))<1e-10);
      if(offset<=0)assert.equal(shot.probe.dockCapture,0,'no claw closes before the receiver has seated');
      if(offset>=1)assert.equal(shot.probe.dockCapture,1,'the close camera holds long enough to show the completed lock');
    }
  }
});

test('six claws articulate about fixed hinges and their toe seats below each actual probe receiver',()=>{
  const ship=createExteriorShip(),matrix=new Matrix4(),point=new Vector3();
  try{
    const capture=ship.dockCapture;assert.equal(capture.progress,1);assert.equal(capture.claws.count,6);
    for(const scale of [1,1.6,2.6,2.8]){
      ship.setCoreScale(scale);ship.setDockTransferOpen(true);ship.root.updateMatrixWorld(true);
      for(const progress of [0,.25,.5,.775,.9,1]){
        ship.setDockCapture(progress);
        for(let index=0;index<6;index++){
          capture.claws.getMatrixAt(index,matrix);
          const angle=index*Math.PI/3,hinge=point.set(0,0,0).applyMatrix4(matrix);
          assert.ok(Math.abs(hinge.y-DOCK_CAPTURE.pivotY)<1e-6,'the hinge never floats away from its fixed clevis');
          assert.ok(Math.abs(Math.hypot(hinge.x,hinge.z)-DOCK_CAPTURE.pivotRadius)<1e-6);
          const toe=point.set(-.23,-.65,0).applyMatrix4(matrix).clone();
          if(progress===1){
            assert.ok(toe.y>=5.39&&toe.y<5.4,'the closed hook is below, not inside, the receiver’s lower face');
            const surfaces=[];ship.dockedLander.traverseVisible(mesh=>{if(mesh.isMesh&&!mesh.material.transparent)surfaces.push(mesh);});
            const origin=ship.probeDock.localToWorld(toe.clone());
            const hit=new Raycaster(origin,new Vector3(0,1,0),0,.02).intersectObjects(surfaces,false)[0];
            assert.ok(hit&&hit.distance<.012,'the hook actually bears on the probe receiver instead of floating in space');
            assert.ok(Math.abs(toe.x*Math.sin(angle)-toe.z*Math.cos(angle))<1e-6);
          }
        }
        const positions=capture.claws.geometry.attributes.position;
        for(let index=0;index<6;index++){
          capture.claws.getMatrixAt(index,matrix);
          for(let vertex=0;vertex<positions.count;vertex++){
            point.fromBufferAttribute(positions,vertex).applyMatrix4(matrix);
            assert.ok(Math.hypot(point.x,point.z)>.82,'claws stay outside the 1.20m transfer passage and pressure seals');
          }
        }
      }
    }
  }finally{ship.dispose();}
});

test('film sampling, reverse seeking and dissolve views restore identical lock matrices without new resources',()=>{
  const ship=createExteriorShip();ship.setCoreScale(2.6);
  const capture=ship.dockCapture,meshes=capture.group.children.filter(mesh=>mesh.isMesh);
  const geometries=meshes.map(mesh=>mesh.geometry),materials=meshes.map(mesh=>mesh.material);
  const matrices=()=>meshes.map(mesh=>Array.from(mesh.instanceMatrix.array));
  try{
    assert.equal(meshes.length,3);assert.ok(meshes.every(mesh=>mesh.isInstancedMesh&&mesh.count===6));
    const pose=sampleExteriorCinema(contactTime+.4,{opening:true}).probe;applyExteriorProbePose(ship,pose);const expected=matrices();
    applyExteriorProbePose(ship,sampleExteriorCinema(200,{opening:true}).probe);assert.equal(capture.progress,1);
    applyExteriorProbePose(ship,sampleExteriorCinema(0,{opening:true}).probe);assert.equal(capture.progress,0);
    applyExteriorProbePose(ship,pose);assert.deepEqual(matrices(),expected);
    applyExteriorProbePose(ship,sampleExteriorProbeFlight(19));assert.equal(capture.progress,0);
    for(const [index,mesh]of meshes.entries()){assert.equal(mesh.geometry,geometries[index]);assert.equal(mesh.material,materials[index]);}
    const boundary=CINEMA_SHOTS.slice(0,3).reduce((total,shot)=>total+shot.duration,0);
    const frame=sampleExteriorCinemaFrame(boundary,{opening:true,transition:'dissolve'});
    assert.deepEqual(frame.from.probe,frame.to.probe,'both crossfade cameras use the same capture state');
    assert.ok(ship.dockHatches.every(hatch=>hatch.rotation.z===0),'hard capture never opens a pressure hatch');
    const disposed=new Set();for(const geometry of geometries)geometry.addEventListener('dispose',()=>disposed.add(geometry));
    ship.dispose();assert.equal(disposed.size,3);
  }finally{ship.dispose();}
});

test('the craft study provides replay and seek controls and parks claws open while undocked',async()=>{
  const source=await readFile(new URL('../src/exterior-craft-study.js',import.meta.url),'utf8');
  const html=await readFile(new URL('../src/exterior-craft-study.html',import.meta.url),'utf8');
  assert.match(html,/data-view="docking-lock"/);assert.match(html,/id="docking-lock-time"/);assert.match(html,/id="docking-lock-play"/);
  assert.match(source,/ship\.setDockCapture\(name==='docking-undocked'\?0:1\)/);
  assert.match(source,/applyExteriorProbePose\(ship,pose\)/);
});
