import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {MeshStandardMaterial,Vector3} from 'three';
import {loadMiloBody} from '../src/obs/milo-body.js';
import {createMilo,animateMilo} from '../src/obs/characters.js';
import {updateMiloBandage} from '../src/obs/milo-bandage.js';
import {applyCabinLadder} from '../src/obs/cabin-ladder.js';
import {createMiloToon} from '../src/obs/milo-toon.js';

await loadMiloBody(`data:application/json;base64,${(await readFile(new URL('../public/assets/obs/milo/body.json',import.meta.url))).toString('base64')}`);
const character=()=>createMilo(new Proxy({},{get:(o,k)=>o[k]??=new MeshStandardMaterial()}));
function checkFit(root){
  const {bodySkin:skin,bandage}=root.userData;
  updateMiloBandage(root);root.updateMatrixWorld(true);skin.skeleton.update();
  const {position,skinIndex,skinWeight}=bandage.geometry.attributes;
  for(let i=0;i<position.count;i++){
    const j=bandage.userData.skinVertices[i];
    const surface=skin.applyBoneTransform(j,new Vector3().fromBufferAttribute(skin.geometry.attributes.position,j)).applyMatrix4(skin.matrixWorld);
    const cloth=bandage.applyBoneTransform(i,new Vector3().fromBufferAttribute(position,i)).applyMatrix4(bandage.matrixWorld);
    const gap=cloth.distanceTo(surface);
    assert.ok(gap>.001&&gap<.003,`cloth must stay within 1–3 mm of the moving arm, got ${gap}`);
    for(let k=0;k<4;k++){
      assert.equal(skinIndex.array[i*4+k],skin.geometry.attributes.skinIndex.array[j*4+k]);
      assert.equal(skinWeight.array[i*4+k],skin.geometry.attributes.skinWeight.array[j*4+k]);
    }
  }
}

test('the bandage follows the visible forearm surface, not the old rigid cylinder',()=>{
  const root=character(),{bodySkin:skin,bandage}=root.userData;
  assert.ok(bandage.isSkinnedMesh);assert.equal(bandage.skeleton,skin.skeleton);assert.equal(bandage.parent,skin.parent);
  assert.ok(bandage.userData.skinVertices.length>30);assert.ok(bandage.geometry.index.count<skin.geometry.index.count/10,'only the small wrapped section is drawn');
  for(const j of bandage.userData.skinVertices){
    assert.ok(skin.geometry.attributes.position.getX(j)<0);assert.ok(skin.geometry.attributes.armRegion.getX(j)>.95);
    assert.ok(skin.geometry.attributes.position.getY(j)>.97&&skin.geometry.attributes.position.getY(j)<1.13);
  }
  for(const options of [{},{moving:true},{climbing:true,moving:true},...['medical','gym','lounge','console','galley','hydro','bunk'].map(action=>({action}))]){
    for(const time of [0,1.7,3.2]){
      animateMilo(root,{time,actionTime:time,actionDuration:12,moving:false,health:{bandageTime:180},...options});
      assert.equal(bandage.visible,true);checkFit(root);
    }
  }
  animateMilo(root,{time:0,moving:false});assert.equal(bandage.visible,false);
});

test('late ladder refitting and returning to ordinary poses do not detach the dressing',()=>{
  const root=character();
  for(const height of [.5,1.1,1.8,2.6]){
    animateMilo(root,{time:height,moving:true,climbing:true,health:{bandageTime:180}});
    applyCabinLadder(root,{height,startHeight:0,endHeight:3.392,startYaw:0,endYaw:Math.PI/2});
    checkFit(root);
  }
  animateMilo(root,{time:2,moving:false,health:{bandageTime:90}});checkFit(root);
});

test('toon rendering preserves the bandage fit and clean wrap edges',()=>{
  const root=character(),bandage=root.userData.bandage,original=bandage.material,toon=createMiloToon(root);
  const shader={uniforms:{},vertexShader:'#include <common>\n#include <begin_vertex>',fragmentShader:'#include <common>\n#include <clipping_planes_fragment>\n#include <color_fragment>'};
  bandage.material.onBeforeCompile(shader);assert.match(shader.fragmentShader,/vBandageHeight>1\.0\)discard/);assert.match(shader.fragmentShader,/fract\(vBandageHeight\*4\.0\)/);
  animateMilo(root,{time:3,moving:false,health:{bandageTime:120}});toon.update(1280,720);checkFit(root);
  toon.dispose();assert.equal(bandage.material,original);
});
