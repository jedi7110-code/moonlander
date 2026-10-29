import test from 'node:test';
import assert from 'node:assert/strict';
import {Group,MeshStandardMaterial,Texture,ShaderLib} from 'three';
import {createLoungeCoffee} from '../src/obs/lounge-table-props.js';
import {createDiningProps} from '../src/obs/dining.js';
import {finishStaticCups,finishCabinFixtures} from '../src/obs/cabin-fixtures.js';
import {batchStatic} from '../src/obs/materials.js';
import {createCabinToon} from '../src/obs/cabin-toon.js';

test('TARAIRON is printed on the existing outer ceramic surface, with no decal polygons',()=>{
  const map=new Texture(),white=new MeshStandardMaterial(),m={white,taraironLogo:{map}};
  const blank=createLoungeCoffee(),coffee=createLoungeCoffee(m),parent=new Group();
  const resting=createDiningProps(parent,m),held=createDiningProps(parent,m);
  const plain=blank.getObjectByName('Table cup'),printed=coffee.getObjectByName('Table cup');
  assert.equal(coffee.children.length,blank.children.length,'no overlay mesh');
  assert.deepEqual(printed.geometry.attributes.position.array,plain.geometry.attributes.position.array);
  assert.deepEqual(printed.geometry.index.array,plain.geometry.index.array);
  const cups=[printed,resting.mug.getObjectByName('Hollow enamel cup'),held.mug.getObjectByName('Hollow enamel cup')];
  const material=printed.material;
  for(const cup of cups){
    assert.equal(cup.material,material);assert.equal(cup.material.mugLogoMap,map);
    assert.equal(cup.material.isMeshPhysicalMaterial,true);
    assert.equal(cup.material.transparent,false);assert.equal(cup.material.emissive.getHex(),0);
    const p=cup.geometry.attributes.position,uv=cup.geometry.attributes.cupPrintUV;
    assert.equal(uv.count,p.count);let front=0,back=0;
    for(let i=0;i<uv.count;i++){
      if(i%9>=4)assert.equal(uv.getZ(i),0,'inside, lip and underside stay unprinted');
      if(uv.getZ(i)>0){if(p.getZ(i)>0)front++;else back++;}
    }
    assert.ok(front>0&&back>0,'handle-left and handle-right poses both show the logo');
  }
  finishStaticCups(coffee);
  finishCabinFixtures({ship:{diningDocks:{hydro:resting},plants:{root:new Group(),rows:[]}},milo:{userData:{dining:held}}});
  assert.ok(cups.every(cup=>cup.material===material),'fixture finishing does not erase the print');
  const shader={uniforms:{},vertexShader:ShaderLib.physical.vertexShader,fragmentShader:ShaderLib.physical.fragmentShader};
  material.onBeforeCompile(shader);
  assert.equal(shader.uniforms.mugLogoMap.value,map);
  assert.match(shader.fragmentShader,/texture2D\(mugLogoMap, vCupPrintUV.xy\).a/);
  const batch=batchStatic(coffee,{xrLOD:true}),cupBatch=batch.children.find(o=>o.material===material);
  assert.ok(cupBatch.geometry.attributes.cupPrintUV,'static batching preserves local cylindrical print coordinates');
  assert.ok(cupBatch.userData.xrWideGeometry.attributes.cupPrintUV,'XR LOD also preserves the print');
  const toon=createCabinToon([batch]);toon.setStyle('cartoon');assert.equal(cupBatch.material,material);
  toon.dispose();const geometries=new Set();for(const root of [blank,coffee,parent,batch])root.traverse(o=>{if(o.geometry)geometries.add(o.geometry);});
  geometries.forEach(g=>g.dispose());material.dispose();white.dispose();map.dispose();
});
