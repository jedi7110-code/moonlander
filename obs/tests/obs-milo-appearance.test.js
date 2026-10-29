import test from 'node:test';
import assert from 'node:assert/strict';
import {MILO_HAIR_STYLES,createHair} from '../src/obs/hair.js';
import {MILO_BEARD_STYLES} from '../src/obs/head.js';
import {readFile} from 'node:fs/promises';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {headGeometry} from '../src/obs/head.js';

test('Milo appearance study exposes supplied hair, four previous candidates and three beard levels',()=>{
  assert.deepEqual(Object.keys(MILO_HAIR_STYLES),['reference','crop','rough','fringe','swept']);
  assert.deepEqual(Object.keys(MILO_BEARD_STYLES),['none','light','rough']);
  assert.equal(MILO_BEARD_STYLES.none.strength,0);
  assert.ok(MILO_BEARD_STYLES.light.strength<MILO_BEARD_STYLES.rough.strength);
});

test('grooms fit the real scanned scalp with finite surface normals and root-to-tip UVs',async()=>{
  const data=await readFile(new URL('../public/assets/obs/head/LeePerrySmith.glb',import.meta.url));
  const gltf=await new GLTFLoader().parseAsync(data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength),'');
  const scalp=headGeometry(gltf.scene.getObjectByName('LeePerrySmith').geometry),original=scalp.attributes.position.array.slice();
  for(const style of ['rough','fringe','swept']){
    const hair=createHair(scalp,style),g=hair.geometry;
    for(const name of ['position','normal','uv'])for(const value of g.attributes[name].array)assert.ok(Number.isFinite(value),`${style} ${name}`);
    for(const value of g.attributes.uv.array)assert.ok(value>=0&&value<=1);
    assert.ok(g.boundingBox.min.y>.7,'locks stay above the neck');
    assert.ok(g.boundingBox.max.y<scalp.boundingBox.max.y+.5,'groom remains fitted to the head');
    assert.deepEqual(scalp.attributes.position.array,original,'face scan must not be deformed');
    g.dispose();hair.material.dispose();
  }
  scalp.dispose();
});
