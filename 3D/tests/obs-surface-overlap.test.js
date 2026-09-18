import test from 'node:test';
import assert from 'node:assert/strict';
import {BoxGeometry,ExtrudeGeometry,Group,Mesh,MeshStandardMaterial,Path,Shape} from 'three';
import {coplanarSurfaces,describeFace} from './helpers/coplanar-surfaces.js';
import {buildSurfaceFixture,disposeSurfaceFixture} from './helpers/cabin-surface-fixture.js';
import {animateBathroom} from '../src/obs/bathroom.js';
import {animatePocketShutter} from '../src/obs/shutter.js';

test('surface audit distinguishes coincident faces, butt joints and separated surfaces',()=>{
  const root=new Group(),geometry=new BoxGeometry(1,1,1),material=new MeshStandardMaterial();
  const a=new Mesh(geometry,material),b=a.clone();root.add(a,b);
  assert.equal(coplanarSurfaces([root]).length,6);
  b.position.x=.8;assert.equal(coplanarSurfaces([root]).length,4);
  b.position.x=1;assert.equal(coplanarSurfaces([root]).length,0,'touching edges/back-to-back joints are safe');
  b.position.set(1.01,0,0);assert.equal(coplanarSurfaces([root]).length,0);
  geometry.dispose();material.dispose();
});

test('surface audit respects actual polygons, including holes in extruded walls',()=>{
  const shape=new Shape();shape.moveTo(-2,-2).lineTo(2,-2).lineTo(2,2).lineTo(-2,2);shape.closePath();
  const hole=new Path();hole.moveTo(-1,-1).lineTo(-1,1).lineTo(1,1).lineTo(1,-1);hole.closePath();shape.holes.push(hole);
  const material=new MeshStandardMaterial(),wall=new Mesh(new ExtrudeGeometry(shape,{depth:1,bevelEnabled:false}),material);
  const block=new Mesh(new BoxGeometry(.5,.5,1),material);block.position.z=.5;
  const root=new Group();root.add(wall,block);
  assert.equal(coplanarSurfaces([root]).length,0,'empty doorway is not a filled bounding box');
  block.position.x=1.5;assert.equal(coplanarSurfaces([root]).length,2,'front and back overlap the solid wall');
  wall.geometry.dispose();block.geometry.dispose();material.dispose();
});

test('unmerged cabin has no coincident planar surfaces, including open pocket doors',t=>{
  const ship=buildSurfaceFixture();t.after(()=>disposeSurfaceFixture(ship));
  const roots=[ship.staticMesh,ship.animated];
  for(const opening of [0,.16,.32,.6,1]){
    for(const fixture of Object.values(ship.bathrooms))animateBathroom(fixture,{opening,inside:opening===0});
    animatePocketShutter(ship.hatchDoor,opening);
    const overlaps=coplanarSurfaces(roots);
    assert.equal(overlaps.length,0,`opening ${opening}: ${JSON.stringify(overlaps.slice(0,5).map(({a,b})=>[describeFace(a),describeFace(b)]))}`);
  }
  // Blades orbit as a rigid rotor; they never stack into duplicate diameters.
  const positions=ship.fan.children.map(part=>part.position.clone());
  for(const angle of [0,.2,.7,Math.PI/2,Math.PI]){
    ship.fan.rotation.z=angle;
    assert.equal(coplanarSurfaces([ship.fan]).length,0);
    ship.fan.children.forEach((part,i)=>assert.ok(part.position.equals(positions[i])));
  }
});
