import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {MeshStandardMaterial,Vector3} from 'three';
import {loadMiloBody} from '../src/obs/milo-body.js';
import {createMilo,animateMilo} from '../src/obs/characters.js';
import {CrewHealth} from '../src/obs/health.js';
import {createMiloToon} from '../src/obs/milo-toon.js';

const bytes=await readFile(new URL('../public/assets/obs/milo/body.json',import.meta.url));
await loadMiloBody(`data:application/json;base64,${bytes.toString('base64')}`);
const character=()=>createMilo(new Proxy({},{get:(o,k)=>o[k]??=new MeshStandardMaterial()}));

test('the sensor fits the anatomical left wrist and follows it through bends and kitchen movement',()=>{
  const root=character(),sensor=root.userData.bioSensor,left=root.userData.arms.find(r=>r.side===1);
  assert.equal(sensor.parent,root.userData.bodySkin.skeleton.bones.find(b=>b.name==='Milo skin R_wrist2').parent);
  assert.notEqual(sensor.parent,root.userData.watch.parent,'keep the existing watch on the opposite wrist');
  for(const section of sensor.radii)assert.ok(section.every(r=>r>.014&&r<.065),'the band uses the wrist surface, not the fallback radius');
  const offset=sensor.group.position.clone();
  for(const angle of [0,60,90,122,140]){
    animateMilo(root,{moving:false,time:0});root.rotation.set(0,0,0);
    left.elbow.rotation.x=-angle*Math.PI/180;root.userData.updateWristTwists();root.updateMatrixWorld(true);
    const center=sensor.group.getWorldPosition(new Vector3());
    assert.ok(center.x>0,'sensor is on the wearer\'s left');
    assert.ok(center.distanceTo(sensor.parent.localToWorld(offset.clone()))<1e-9);
    assert.ok(center.distanceTo(left.hand.getWorldPosition(new Vector3()))<.055,'stays at the wrist, not up the forearm');
  }
  for(let frame=0;frame<=300;frame++){
    animateMilo(root,{moving:false,action:'galley',time:frame/30,actionTime:frame/30,actionDuration:10});root.updateMatrixWorld(true);
    assert.ok(sensor.group.getWorldPosition(new Vector3()).distanceTo(left.hand.getWorldPosition(new Vector3()))<.055);
  }
});

test('fever turns the rendered sensor red through treatment and green again on recovery, including toon switches',()=>{
  const root=character(),health=new CrewHealth({random:()=>.5}),display=root.userData.bioSensor.display;
  const update=()=>animateMilo(root,{moving:false,time:0,dt:0,health});
  update();const healthy=display.material.color.clone();
  assert.ok(healthy.g>healthy.r&&healthy.g>healthy.b);
  health.startCondition('fever');update();
  const red=display.material.color.clone();assert.ok(red.r>red.g*2&&red.r>red.b*2);
  assert.equal(display.material.toneMapped,false,'the screen remains self-lit');
  const toon=createMiloToon(root);update();assert.ok(display.material.color.equals(red));
  health.beginTreatment();update();assert.ok(display.material.color.equals(red));
  health.cancelTreatment();update();assert.ok(display.material.color.equals(red),'interrupted treatment does not clear the alert');
  health.beginTreatment();health.treatment.elapsed=health.treatment.duration;assert.ok(health.finishTreatment());
  update();assert.ok(display.material.color.equals(healthy),'cured, including the recovering health stage');
  toon.dispose();update();assert.ok(display.material.color.equals(healthy),'restore the original material without a stale alert');
  health.startCondition('fever');update();assert.ok(display.material.color.equals(red),'a later illness can trigger it again');
});
