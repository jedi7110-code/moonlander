import test from 'node:test';
import assert from 'node:assert/strict';
import {Group,PerspectiveCamera,Vector3,DirectionalLight} from 'three';
import {createExteriorCruise,EXTERIOR_CRUISE_SPAN} from '../src/obs/exterior-cruise.js';

function fixture(){
  const ship={root:new Group()},camera=new PerspectiveCamera(),controls={target:new Vector3(4,2,1)},light=new DirectionalLight();
  camera.position.set(-30,15,40);light.position.set(64,-110,92);
  return{ship,camera,controls,lights:[light]};
}
test('slow forward cruise preserves inspection framing and sunlight independently of distant stars',()=>{
  const f=fixture(),cruise=createExteriorCruise(f),framing=f.camera.position.clone().sub(f.controls.target),lightDirection=f.lights[0].position.clone().sub(f.lights[0].target.position);
  cruise.step(10);
  assert.equal(f.ship.root.position.x,20);assert.equal(cruise.distance,20);
  assert.ok(f.camera.position.clone().sub(f.controls.target).equals(framing));
  assert.ok(f.lights[0].position.clone().sub(f.lights[0].target.position).equals(lightDirection));
  cruise.setEnabled(false);cruise.step(10);assert.equal(cruise.distance,20);
  cruise.setEnabled(true);cruise.step(1);assert.equal(cruise.distance,22);
});
test('long-running cruise rebases all followed objects together without a visible jump',()=>{
  const f=fixture(),cruise=createExteriorCruise(f);
  cruise.step(EXTERIOR_CRUISE_SPAN/2-.1);
  const framing=f.camera.position.clone().sub(f.ship.root.position),target=f.controls.target.clone().sub(f.ship.root.position);
  cruise.step(.2);
  assert.ok(Math.abs(cruise.offset-.2)<1e-8);
  assert.ok(f.camera.position.clone().sub(f.ship.root.position).distanceTo(framing)<1e-8);
  assert.ok(f.controls.target.clone().sub(f.ship.root.position).distanceTo(target)<1e-8);
});
test('cruise speed is independent of frame rate and ignores invalid elapsed times',()=>{
  const a=fixture(),b=fixture(),one=createExteriorCruise(a),many=createExteriorCruise(b);
  one.step(1);for(let i=0;i<60;i++)many.step(1/60);
  assert.ok(Math.abs(one.offset-many.offset)<1e-10);
  one.step(NaN);one.step(-1);one.step(0);assert.equal(one.offset,2);
});
