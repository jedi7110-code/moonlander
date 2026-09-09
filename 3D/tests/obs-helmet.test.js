import test from 'node:test';
import assert from 'node:assert/strict';
import {Box3,MeshStandardMaterial,Raycaster,Vector3} from 'three';
import {createEVAHelmet,EVA_HELMET} from '../src/obs/eva-helmet.js';

function helmet(){const material=new MeshStandardMaterial();return createEVAHelmet(new Proxy({},{get:()=>material}));}

test('the full-face visor covers forehead to chin and remains in front of the shell',()=>{
  const root=helmet();root.updateMatrixWorld(true);
  const visor=root.getObjectByName('Continuous face visor'),bounds=new Box3().setFromObject(visor);
  const scale=EVA_HELMET.scale;
  assert.ok(bounds.max.y-bounds.min.y>.48*scale);assert.ok(bounds.max.x-bounds.min.x>.50*scale);
  assert.ok(bounds.min.y>EVA_HELMET.base);assert.ok(bounds.max.y<EVA_HELMET.base+EVA_HELMET.height*scale);
  const ray=new Raycaster();
  for(const x of [-.15,0,.15])for(const y of [.15,.30,.46]){
    ray.set(new Vector3(x*scale,EVA_HELMET.base+y*scale,2),new Vector3(0,0,-1));
    assert.ok(ray.intersectObject(root,true)[0]?.object===visor,`visor is covered at ${x}, ${y}`);
  }
  root.traverse(mesh=>mesh.geometry?.dispose());
});

test('the shell has finite outward-facing surfaces and mirrored upright oval side mechanisms',()=>{
  const root=helmet();root.updateMatrixWorld(true);
  const housings=root.children.filter(mesh=>mesh.name==='Oval side housing');assert.equal(housings.length,2);
  assert.equal(housings[0].position.x,-housings[1].position.x);
  for(const housing of housings){const box=new Box3().setFromObject(housing);assert.ok(box.max.y-box.min.y>(box.max.z-box.min.z)*1.6);}
  root.traverse(mesh=>{
    if(!mesh.geometry)return;
    for(const key of ['position','normal','uv'])for(const value of mesh.geometry.attributes[key].array)assert.ok(Number.isFinite(value));
  });
  const visor=root.getObjectByName('Continuous face visor'),normal=visor.geometry.attributes.normal;
  for(let i=0;i<normal.count;i++)assert.ok(normal.getZ(i)>0);
  const bounds=new Box3().setFromObject(root);assert.ok(bounds.max.x-bounds.min.x<.47);assert.ok(bounds.max.y<2.15);
  assert.ok(Math.abs(bounds.min.y-EVA_HELMET.base)<1e-6,'the helmet stays seated at the neck when resized');
  assert.ok(Math.abs(bounds.max.y-bounds.min.y-.4575)<1e-6);
  root.traverse(mesh=>mesh.geometry?.dispose());
});
