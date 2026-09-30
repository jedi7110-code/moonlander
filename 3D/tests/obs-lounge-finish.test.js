import test from 'node:test';
import assert from 'node:assert/strict';
import {Color,MeshStandardMaterial,Texture} from 'three';
import {createLoungeSofa} from '../src/obs/ship.js';
import {createSofaStudyModel} from '../src/sofa-study-model.js';
import {batchStatic} from '../src/obs/materials.js';
import {createCabinToon} from '../src/obs/cabin-toon.js';

for(const [name,create]of [['OBS',createLoungeSofa],['study',createSofaStudyModel]])test(`${name} separates seat and back greens without changing shared upholstery or geometry`,t=>{
  const bump=new Texture(),cushion=new MeshStandardMaterial({name:'Original upholstery',color:0x4b5957,roughness:.9,metalness:.01,bumpMap:bump,bumpScale:.014});
  const other=new MeshStandardMaterial({color:0x859273}),m={cushion,olive:other,dark:other,enamel:other};
  const sofa=create(m),seat=sofa.getObjectByName('Study seat with returned front edge'),back=sofa.getObjectByName('Sofa backrest');
  const geometries=new Set(),materials=new Set(),textures=new Set();
  const collect=root=>root.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material)materials.add(o.material);});
  t.after(()=>{for(const material of materials)for(const v of Object.values(material))if(v?.isTexture)textures.add(v);for(const resource of [...geometries,...materials,...textures])resource.dispose();});
  collect(sofa);
  assert.notEqual(seat.material,back.material);assert.equal(back.material,cushion);
  assert.equal(seat.material.color.getHex(),0x58675f);assert.equal(cushion.color.getHex(),0x4b5957);
  assert.equal(other.color.getHex(),0x859273,'hexagonal pads and arm padding retain their colour');
  for(const key of ['map','bumpMap','bumpScale','roughness','metalness'])assert.equal(seat.material[key],cushion[key],key);
  assert.ok(seat.material.color.g>seat.material.color.r&&seat.material.color.g>seat.material.color.b,'seat stays green');
  assert.equal(seat.geometry.type,'ExtrudeGeometry');assert.equal(back.geometry.type,'ExtrudeGeometry');
  const batch=batchStatic(sofa,{xrLOD:true});collect(batch);
  const seatBatch=batch.children.find(o=>o.material===seat.material),backBatch=batch.children.find(o=>o.material===back.material);
  assert.ok(seatBatch&&backBatch,'separate colours survive static batching');
  const toon=createCabinToon([batch]);t.after(()=>toon.dispose());toon.setStyle('cartoon');
  assert.ok(seatBatch.material.color.equals(new Color(0x58675f)));assert.ok(backBatch.material.color.equals(new Color(0x4b5957)));
});
