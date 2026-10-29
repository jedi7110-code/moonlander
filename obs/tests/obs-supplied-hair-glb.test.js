import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {BufferGeometryLoader} from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {trimSuppliedNape} from '../src/obs/supplied-hair.js';
import {packSuppliedHair,SUPPLIED_HAIR_MESHES} from '../studies/head/pack-supplied-hair.mjs';

const dir=new URL('../public/assets/obs/head/supplied-hair/',import.meta.url);
const glbBytes=fs.readFileSync(new URL('supplied-hair.glb',dir));

test('the baked supplied-hair.glb equals the trimmed JSON sources vertex for vertex',async()=>{
  const gltf=await new GLTFLoader().parseAsync(glbBytes.buffer.slice(glbBytes.byteOffset,glbBytes.byteOffset+glbBytes.byteLength),'');
  for(const [name,file] of SUPPLIED_HAIR_MESHES){
    const expected=trimSuppliedNape(new BufferGeometryLoader().parse(JSON.parse(fs.readFileSync(new URL(file,dir),'utf8'))));
    const actual=gltf.scene.getObjectByName(name).geometry;
    for(const attribute of ['position','normal','uv'])assert.deepEqual(Array.from(actual.attributes[attribute].array),Array.from(expected.attributes[attribute].array),`${name} ${attribute}`);
    assert.deepEqual(Array.from(actual.index.array),Array.from(expected.index.array),`${name} index`);
  }
});
test('the committed GLB is the current output of the packing script',()=>{
  assert.equal(Buffer.compare(Buffer.from(packSuppliedHair()),glbBytes),0,'run node studies/head/pack-supplied-hair.mjs after changing the hair sources or the trim');
});
