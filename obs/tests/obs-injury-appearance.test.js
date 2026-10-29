import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {MeshStandardMaterial,Vector3} from 'three';
import {CrewHealth} from '../src/obs/health.js';
import {loadMiloBody} from '../src/obs/milo-body.js';
import {createMilo,animateMilo} from '../src/obs/characters.js';
import {armBruiseMask,handBruiseMask,armBruiseShader,injuryBruiseStrength} from '../src/obs/injury-appearance.js';

await loadMiloBody(`data:application/json;base64,${(await readFile(new URL('../public/assets/obs/milo/body.json',import.meta.url))).toString('base64')}`);
const character=()=>createMilo(new Proxy({},{get:(o,k)=>o[k]??=new MeshStandardMaterial()}));

test('purple bruising appears only for an injury and fades with its recovery',()=>{
  const health=new CrewHealth();assert.equal(injuryBruiseStrength(health),0);
  assert.equal(injuryBruiseStrength({condition:{kind:'fever'}}),0);
  health.startCondition('injury');assert.equal(injuryBruiseStrength(health),1);
  health.beginTreatment();health.treatment.elapsed=health.treatment.duration;
  assert.equal(injuryBruiseStrength(health),.65);
  health.finishTreatment();assert.equal(injuryBruiseStrength(health),.65);
  health.bandageTime=90;assert.equal(injuryBruiseStrength(health),.325);
  health.bandageTime=0;assert.equal(injuryBruiseStrength(health),0);
});

test('soft bruises stay on the injured forearm and back of the hand through joint/grip changes',()=>{
  const root=character(),skin=root.userData.bodySkin,{position,armRegion,bruiseMask,bruiseUv}=skin.geometry.attributes;
  const affected=[];let softEdge=false,forearmCount=0,handCount=0;
  for(let i=0;i<position.count;i++){
    const strength=bruiseMask.getX(i);assert.ok(strength>=0&&strength<=1);
    if(strength===0)continue;
    affected.push(i);softEdge||=strength>.05&&strength<.5;
    assert.ok(position.getX(i)<0&&armRegion.getX(i)>.9);
    const y=position.getY(i);
    if(y>1){
      forearmCount++;
      assert.ok(y>1.06&&y<1.24,'forearm pigment stays off the shirt');
    }else{
      handCount++;
      assert.ok(y>.86&&y<.924&&position.getZ(i)>.001,'hand pigment stays off the fingers, palm and wrist');
      assert.match(skin.skeleton.bones[skin.geometry.attributes.skinIndex.getX(i)].name,/L_hand/);
    }
  }
  assert.ok(affected.length>20&&softEdge,'a feathered skin patch, not a hard-edged stamp');
  assert.ok(forearmCount>20&&handCount>20,'both injury sites are present');
  assert.equal(armBruiseMask(.23,1.15,0,1),0);
  assert.equal(armBruiseMask(-.23,1.15,0,0),0);
  assert.ok(handBruiseMask(-.212,.892,.018,1)>.9);
  assert.equal(handBruiseMask(.212,.892,.018,1),0,'other hand stays clear');
  assert.equal(handBruiseMask(-.212,.892,-.025,1),0,'palm stays clear');
  assert.equal(handBruiseMask(-.212,.84,.018,1),0,'fingers stay clear');
  assert.equal(handBruiseMask(-.212,.934,.018,1),0,'wrist stays clear');
  assert.equal(handBruiseMask(-.212,.892,.018,0),0);
  const shader={uniforms:{},vertexShader:'#include <common>\n#include <begin_vertex>',fragmentShader:'#include <common>\n#include <color_fragment>'};
  skin.material.onBeforeCompile(shader);
  assert.match(shader.vertexShader,/vBruiseMask=bruiseMask/);
  assert.ok(shader.fragmentShader.includes(armBruiseShader));
  assert.match(shader.vertexShader,/vBruiseUv=bruiseUv/);
  assert.match(shader.fragmentShader,/miloBruisedSkin\(diffuseColor.rgb,vBruiseUv,vBruiseMask/);
  const health={condition:{kind:'injury'},needsCare:true};
  for(const action of [null,'hydro','galley','medical','gym','lounge']){
    animateMilo(root,{action,moving:false,time:3,actionTime:3,actionDuration:10,health});
    assert.equal(shader.uniforms.bruiseStrength.value,1);
    root.updateMatrixWorld(true);skin.skeleton.update();
    for(const i of affected)assert.ok(skin.applyBoneTransform(i,new Vector3().fromBufferAttribute(skin.geometry.attributes.position,i)).toArray().every(Number.isFinite));
    assert.deepEqual(skin.geometry.attributes.bruiseMask.array,bruiseMask.array,'grip changes retain the skin mark');
    assert.deepEqual(skin.geometry.attributes.bruiseUv.array,bruiseUv.array,'grip changes cannot slide the mottling over the hand');
  }
  animateMilo(root,{action:null,moving:false,time:4});assert.equal(shader.uniforms.bruiseStrength.value,0);
});

test('bruise pigment uses stable skin-space mottling without changing skin geometry or gloss',()=>{
  assert.match(armBruiseShader,/if\(mask<.001\|\|strength<.001\)return skin/);
  assert.match(armBruiseShader,/vec3 miloBruisedSkin\(vec3 skin,vec2 p/);
  for(const layer of ['islands','mottling','grain','fine','ochre','plum','burgundy','clearing']){
    assert.ok(armBruiseShader.includes(layer),`missing pigment layer: ${layer}`);
  }
  assert.doesNotMatch(armBruiseShader,/\b(time|gl_FragCoord|normal|roughness|transformed)\b/);
});
