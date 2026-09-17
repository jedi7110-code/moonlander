import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {DoubleSide,Mesh,MeshBasicMaterial,Raycaster,Vector3} from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {headGeometry,MILO_NAPE_TATTOO,NAPE_TATTOO_GLSL} from '../src/obs/head.js';
import {hairline} from '../src/obs/hair.js';

test('nape barcode lies on exposed rear neck, above collar and below hair',async()=>{
  const bytes=await readFile(new URL('../public/assets/obs/head/LeePerrySmith.glb',import.meta.url));
  const gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
  const geometry=headGeometry(gltf.scene.getObjectByName('LeePerrySmith').geometry);
  const material=new MeshBasicMaterial({side:DoubleSide}),mesh=new Mesh(geometry,material);
  const ray=new Raycaster(),{width,height,centerY}=MILO_NAPE_TATTOO;
  for(const x of [-width*.48,0,width*.48])for(const y of [centerY-height*.48,centerY,centerY+height*.48]){
    ray.set(new Vector3(x,y,-4),new Vector3(0,0,1));
    const hit=ray.intersectObject(mesh,false)[0];
    assert.ok(hit,'the entire projected mark must hit skin');
    assert.ok(hit.point.z<-.6,'rear-only mask must fully cover the nape');
    assert.ok(y<hairline(x,hit.point.z)-.16,'no hair overlap');
    assert.ok(1.637+y*.055>1.59,'the tattoo clears the rear shirt collar');
  }
  assert.match(NAPE_TATTOO_GLSL,/\.5-vHeadPosition\.x/,'lettering reads left-to-right from behind');
  assert.match(NAPE_TATTOO_GLSL,/napeFrame\*napeRear/,'no projection onto the front or sides of the neck');
  assert.match(NAPE_TATTOO_GLSL,/mark\.a/,'respect transparent source pixels');
  geometry.dispose();material.dispose();gltf.scene.traverse(o=>o.geometry?.dispose());
});

test('original landscape barcode artwork is packaged without resampling',async()=>{
  const image=await readFile(new URL('../public/assets/obs/head/tattoo-naval-barcode.png',import.meta.url));
  assert.equal(image.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
  assert.equal(image.readUInt32BE(16),2172);assert.equal(image.readUInt32BE(20),724);
});
