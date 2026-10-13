import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {sampleExteriorCinema,sampleExteriorCinemaFrame,CINEMA_SHOTS} from '../src/obs/exterior-cinematic.js';
import {sampleExteriorProbeFlight,applyExteriorProbePose,PROBE_EXHAUST_TAIL} from '../src/obs/exterior-probe-flight.js';
import {createExteriorShip} from '../src/obs/ship-exterior.js';
import {PROBE_JETS,PROBE_GAS,sampleExteriorProbeControl,sampleExteriorProbeGas} from '../src/obs/exterior-probe-thrusters.js';
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
  assert.equal(contact.latched,true);assert.deepEqual(contact.position,[0,0,0]);assert.deepEqual(contact.rotation,[0,0,0]);
  const {thrusterClock,...contactPose}=contact;assert.deepEqual(contactPose,held);
  assert.ok(thrusterClock,'capture retains the clock briefly for gas emitted before contact');
  const endVelocity=(position(20)[1]-position(20-epsilon)[1])/epsilon;
  assert.ok(endVelocity<.001,'the probe reaches contact with zero speed');
  const boundary=startOf('lander');
  const openingPose=sampleExteriorCinema(boundary,{opening:true});
  const originalPose=sampleExteriorProbeFlight(12.5);
  assert.deepEqual(openingPose.probe.position,originalPose.position,'07 starts on the former 62.5-second docking pose');
  assert.deepEqual(openingPose.probe.rotation,originalPose.rotation);
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

test('control gas pushes opposite deceleration and reverses sides when correcting lateral drift',()=>{
  const strength=(control,kind,side)=>control.strengths.reduce((total,value,index)=>total+(PROBE_JETS[index].kind===kind&&(side===undefined||PROBE_JETS[index].side===side)?value:0),0);
  const slowing=sampleExteriorProbeControl(6);
  assert.ok(slowing.velocity[1]>0&&slowing.acceleration[1]<0);
  assert.ok(strength(slowing,'brake')>3,'upward gas brakes the rising probe');
  assert.equal(strength(slowing,'ascent'),0);
  const movingLeft=sampleExteriorProbeControl(9.5),brakingLeft=sampleExteriorProbeControl(14);
  assert.ok(movingLeft.acceleration[0]<0&&strength(movingLeft,'lateral',1)>strength(movingLeft,'lateral',-1),'right-side gas starts the leftward correction');
  assert.ok(brakingLeft.velocity[0]<0&&brakingLeft.acceleration[0]>0&&strength(brakingLeft,'lateral',-1)>strength(brakingLeft,'lateral',1),'left-side gas arrests that drift');
  const start=startOf('distant');
  for(const offset of [1,3,6,9]){
    const shot=sampleExteriorCinema(start+offset,{opening:true}),{seconds,...options}=shot.probe.thrusterClock;
    const control=sampleExteriorProbeControl(seconds,options);
    const before=sampleExteriorCinema(start+offset-.01,{opening:true}).probe.position,after=sampleExteriorCinema(start+offset+.01,{opening:true}).probe.position;
    const actual=(after[1]-2*shot.probe.position[1]+before[1])/.0001;
    assert.ok(Math.abs(control.acceleration[1]-actual)<1e-6,'thrust follows the actual retimed approach, including acceleration before braking');
  }
});

test('vacuum gas has retarded 3D emission, deterministic valve pulses and no round sprites',()=>{
  const expected=sampleExteriorProbeGas(14.017);
  assert.ok(expected.length>0);
  for(const plume of expected){
    assert.equal(plume.slices.length,PROBE_GAS.slices);
    assert.equal(plume.slices[0].distance,0);
    assert.ok(Math.abs(plume.slices.at(-1).distance-PROBE_GAS.length)<1e-12);
    assert.ok(plume.slices.every(slice=>slice.strength>=0&&slice.strength<=1&&slice.offset.every(Number.isFinite)));
    assert.ok(plume.slices[0].offset.every(value=>Math.abs(value)<1e-12),'fresh gas originates at its nozzle in the current body frame');
    assert.ok(plume.slices.at(-1).offset.some(value=>Math.abs(value)>1e-8),'emitted gas travels inertially as the craft steers');
  }
  sampleExteriorProbeGas(100);assert.deepEqual(sampleExteriorProbeGas(14.017),expected,'seeking does not retain old exhaust');
  assert.deepEqual(sampleExteriorProbeGas(20+PROBE_EXHAUST_TAIL),[],'the short exhaust tail clears completely');
  const lateral=PROBE_JETS.findIndex(jet=>jet.kind==='lateral'&&jet.side===-1),pulses=[];
  for(let time=14;time<14+PROBE_GAS.pulsePeriod;time+=.004)
    pulses.push(sampleExteriorProbeGas(time).find(plume=>plume.index===lateral)?.slices[0].strength??0);
  assert.ok(Math.min(...pulses)===0&&Math.max(...pulses)>.5,'fine control has both valve-off and valve-on intervals');
  const ship=createExteriorShip();
  try{
    applyExteriorProbePose(ship,sampleExteriorProbeFlight(14.017));
    const gas=ship.probeThrusters.gas,data=gas.material.uniforms.history.value.image.data;
    const snapshot=data.slice();
    assert.equal(gas.visible,true);assert.equal(gas.isInstancedMesh,true);
    assert.equal(gas.count,PROBE_JETS.length);
    assert.ok(snapshot.some(value=>value>0));
    assert.equal(gas.isPoints,undefined,'the renderer uses spatial volumes instead of screen-facing particle dots');
    for(const [index,jet]of PROBE_JETS.entries()){
      const matrix=new THREE.Matrix4();gas.getMatrixAt(index,matrix);
      const source=new THREE.Vector3(0,-.5,0).applyMatrix4(matrix);
      const end=new THREE.Vector3(0,.5,0).applyMatrix4(matrix);
      assert.ok(source.distanceTo(new THREE.Vector3(...jet.position))<1e-6,'volume begins on the nozzle lip');
      assert.ok(end.sub(source).normalize().distanceTo(new THREE.Vector3(...jet.direction))<1e-6,'exhaust expands along the nozzle axis');
    }
    applyExteriorProbePose(ship,sampleExteriorProbeFlight(20+PROBE_EXHAUST_TAIL));assert.equal(gas.visible,false);
    applyExteriorProbePose(ship,sampleExteriorProbeFlight(14.017));
    assert.deepEqual(data,snapshot,'the rendered density restores exactly after capture');
    let disposed=false;gas.material.uniforms.history.value.addEventListener('dispose',()=>{disposed=true;});
    ship.probeThrusters.dispose();assert.equal(disposed,true,'the plume texture is released with the probe');
  }finally{ship.dispose();}
});

test('capture cuts gas at the nozzle while previously emitted gas moves outward and thins',()=>{
  const ship=createExteriorShip();
  try{
    const gas=ship.probeThrusters.gas,geometry=gas.geometry,texture=gas.material.uniforms.history.value;
    const samples=[20,20.025,20.05,20.09,20.12].map(time=>{
      const plumes=sampleExteriorProbeGas(time);
      assert.ok(plumes.length>0);
      assert.ok(plumes.every(plume=>plume.slices[0].strength===0),'no new gas leaves the nozzle after capture');
      const active=plumes.flatMap(plume=>plume.slices.filter(slice=>slice.strength>.001));
      return{nearest:Math.min(...active.map(slice=>slice.distance)),density:active.reduce((sum,slice)=>sum+slice.strength,0)};
    });
    for(let i=1;i<samples.length;i++){
      assert.ok(samples[i].nearest>samples[i-1].nearest,'the trailing edge clears from the nozzle outward');
      assert.ok(samples[i].density<samples[i-1].density,'remaining gas grows fainter while moving away');
    }
    const capture=startOf('lander')+7.5;
    const pose=sampleExteriorCinema(capture+.04,{opening:true}).probe;
    assert.equal(pose.latched,true);applyExteriorProbePose(ship,pose);
    assert.equal(gas.visible,true,'the real opening retains already emitted gas after docking');
    assert.equal(gas.geometry,geometry);assert.equal(gas.material.uniforms.history.value,texture);
    assert.equal(gas.count,PROBE_JETS.length,'residual gas reuses the same instances and texture');
    const density=texture.image.data.slice();
    applyExteriorProbePose(ship,sampleExteriorCinema(capture+1,{opening:true}).probe);assert.equal(gas.visible,false);
    applyExteriorProbePose(ship,pose);assert.deepEqual(texture.image.data,density,'rewinding restores the same exhaust tail');
  }finally{ship.dispose();}
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
