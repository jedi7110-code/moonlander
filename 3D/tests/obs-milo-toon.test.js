import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {MeshStandardMaterial,ShaderLib,Vector3} from 'three';
import {loadMiloBody} from '../src/obs/milo-body.js';
import {createMilo,animateMilo} from '../src/obs/characters.js';
import {setLadderHandFit} from '../src/obs/ladder-hand-fit.js';
import {createMiloToon} from '../src/obs/milo-toon.js';
import {cloneMiloSkinGeometry} from '../src/obs/milo-elbow.js';

const data=await readFile(new URL('../public/assets/obs/milo/body.json',import.meta.url));
await loadMiloBody(`data:application/json;base64,${data.toString('base64')}`);
const compile=material=>{
  const shader={vertexShader:ShaderLib.standard.vertexShader,fragmentShader:ShaderLib.standard.fragmentShader,uniforms:{}};
  material.onBeforeCompile(shader);return shader;
};

test('Milo study preserves garment, tattoo, injury and deformation shaders through style toggles',()=>{
  const m=new Proxy({},{get:(o,key)=>o[key]??=new MeshStandardMaterial()});
  const root=createMilo(m),body=root.userData.bodySkin,original=body.material;
  const neutral=cloneMiloSkinGeometry(body),positions=neutral.attributes.position.array.slice();neutral.dispose();
  const sourceShader=compile(original);
  for(let toggle=0;toggle<2;toggle++){
    const toon=createMiloToon(root),shader=compile(body.material);
    assert.equal(shader.vertexShader,sourceShader.vertexShader,'the colored surface keeps the original deformation');
    for(const name of ['bruiseStrength','tattooStrength','shirtColor','trouserColor']){
      assert.equal(shader.uniforms[name].value,sourceShader.uniforms[name].value,name);
    }
    assert(shader.fragmentShader.includes('miloBruisedSkin'));
    assert(shader.fragmentShader.includes('if(vBodyPosition.y>neckline)discard'));
    assert(shader.fragmentShader.includes('texture2D(tattooCat,uv)'));
    assert.equal(body.material.userData.bruiseStrength,original.userData.bruiseStrength);
    assert.notEqual(body.material,m.skin,'shared furniture materials are not replaced');
    const ink=body.parent.children.find(mesh=>mesh.name==='Milo toon outline'&&mesh.isSkinnedMesh);
    const inkShader=compile(ink.material);
    assert(ink.material.isMeshBasicMaterial,'ink has no lighting or environment uniforms');
    assert.equal(ink.material.forceSinglePass,true,'transparent ink draws both faces in one pass');
    assert(!inkShader.fragmentShader.includes('lights_physical'));
    assert(!inkShader.vertexShader.includes('shadowmap_vertex'));
    assert(inkShader.vertexShader.includes('transformed+=normal*trouserVertex'));
    assert(inkShader.fragmentShader.includes('if(vBodyPosition.y>neckline)discard'));
    for(const pose of ['walk','tablet','ladder','injury']){
      animateMilo(root,{moving:pose==='walk',climbing:false,facing:1,time:.45,walkDistance:.3,
        action:pose==='tablet'?'lounge':null,leisure:pose==='tablet'?'tablet':null,actionTime:3,actionDuration:36,
        health:pose==='injury'?{condition:{kind:'injury',age:1},needsCare:true}:null});
      if(pose==='ladder')setLadderHandFit(root,true);
      toon.update(900,500);root.updateMatrixWorld(true);body.skeleton.update();
      for(const i of [0,100,Math.floor(body.geometry.attributes.position.count/2)]){
        const a=body.getVertexPosition(i,new Vector3()).applyMatrix4(body.matrixWorld);
        const b=ink.getVertexPosition(i,new Vector3()).applyMatrix4(ink.matrixWorld);
        assert(a.distanceTo(b)<1e-8,pose+' outline follows the current fitted geometry');
      }
    }
    assert.equal(shader.uniforms.bruiseStrength.value,1,'live injury controls still update the shader');
    toon.dispose();assert.equal(body.material,original);
    assert(!root.getObjectByName('Milo toon outline'));
  }
  const restored=cloneMiloSkinGeometry(body);
  assert.deepEqual(restored.attributes.position.array,positions,'style toggles preserve the neutral skin beneath the elbow crease');restored.dispose();
  body.skeleton.dispose();
});
