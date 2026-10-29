import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {headGeometry} from '../src/obs/head.js';
import {createHair} from '../src/obs/hair.js';

test('short crop adds separate finite scalp geometry without altering the face or neck',async()=>{
  const bytes=await readFile(new URL('../public/assets/obs/head/LeePerrySmith.glb',import.meta.url));
  const gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
  const scalp=headGeometry(gltf.scene.getObjectByName('LeePerrySmith').geometry),before=scalp.attributes.position.array.slice();
  const hair=createHair(scalp),geometry=hair.geometry;
  assert.deepEqual(scalp.attributes.position.array,before);
  assert.ok(geometry.index.count>1000);
  for(const name of ['position','normal','hairCoverage'])for(const value of geometry.attributes[name].array)assert.ok(Number.isFinite(value));
  for(const value of geometry.attributes.hairCoverage.array)assert.ok(value>=0&&value<=1);
  assert.ok(geometry.boundingBox.min.y>2);
  assert.ok(geometry.boundingBox.max.y>scalp.boundingBox.max.y);
  assert.ok(geometry.boundingBox.max.y<scalp.boundingBox.max.y+.35);
  assert.equal(hair.parent,null);
  hair.geometry.dispose();hair.material.dispose();scalp.dispose();
});
