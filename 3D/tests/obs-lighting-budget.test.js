import test from 'node:test';
import assert from 'node:assert/strict';
import {MeshStandardMaterial} from 'three';
import {buildShip} from '../src/obs/ship.js';
import {limitCabinLights,CABIN_PIXEL_RATIO,CABIN_SHADOW_SIZE,CABIN_LIGHT_COLOR,CABIN_WARM_LIGHT_COLOR} from '../src/obs/lighting.js';

test('the dressed cabin lights all three rear rooms with sixteen local lights and no extra shadow passes',()=>{
  const ctx=new Proxy({measureText:t=>({width:t.length*8}),createLinearGradient:()=>({addColorStop(){}})},{get:(o,k)=>k in o?o[k]:()=>{}});
  const material=new MeshStandardMaterial();let ship;
  globalThis.document={createElement:()=>({getContext:()=>ctx})};
  try{ship=buildShip(new Proxy({},{get:()=>material}));}finally{delete globalThis.document;}
  const meshes=[],lights=[];
  for(const root of [ship.staticMesh,ship.animated])root.traverse(o=>{if(o.isMesh)meshes.push(o);if(o.isLight)lights.push(o);});
  assert.ok(lights.length>50,'exercise the fully dressed ship, not an empty fixture');
  const visibility=meshes.map(m=>m.visible);
  for(let repeat=0;repeat<2;repeat++){
    limitCabinLights(ship.animated);
    const active=lights.filter(l=>l.visible);
    assert.equal(active.length,16);
    assert.equal(active.filter(l=>l.isSpotLight).length,0);
    assert.equal(active.filter(l=>l.isRectAreaLight).length,3);
    assert.equal(active.filter(l=>l.isPointLight).length,13);
    assert.equal(active.filter(l=>l.parent.name==='Bulkhead gate lights').length,3);
    const ladder=active.filter(l=>l.name==='Ladder shaft fill');
    assert.equal(ladder.length,4);
    const heights=ladder.map(l=>l.position.y).sort((a,b)=>a-b);
    assert.ok(heights[0]<2&&heights[3]>11);
    assert.ok(ladder.every(l=>l.distance>=4&&!l.castShadow));
    assert.ok(lights.every(l=>!l.castShadow));
    const decks=new Map();
    for(const light of active.filter(l=>l.name.startsWith('Legacy deck'))){
      decks.set(light.position.y,(decks.get(light.position.y)??0)+1);
      assert.equal(light.position.z,.6);
      assert.equal(light.decay,2);
      if(light.name==='Legacy deck fill'){
        assert.equal(light.position.x,6);assert.equal(light.intensity,32);
        assert.equal(light.distance,17);assert.equal(light.color.getHex(),0xe6ebe4);
      }else{
        const top=light.position.y>8,mid=light.position.y>5&&!top;
        assert.equal(light.position.x,-5);assert.equal(light.intensity,mid?12:45);
        assert.equal(light.distance,20);assert.equal(light.color.getHex(),top?0xb4dcdb:0xffebc7);
      }
    }
    assert.equal(decks.size,3);assert.ok([...decks.values()].every(n=>n===2));
    assert.deepEqual(meshes.map(m=>m.visible),visibility,'fixture lenses and props must remain visible');
  }
  assert.ok(CABIN_PIXEL_RATIO<=1.25);assert.ok(CABIN_SHADOW_SIZE<=1024);
  assert.notEqual(CABIN_LIGHT_COLOR,CABIN_WARM_LIGHT_COLOR);
  assert.equal(ship.bunk.glow.emissive.getHex(),CABIN_WARM_LIGHT_COLOR);
  assert.equal(ship.bunk.light.color.getHex(),CABIN_WARM_LIGHT_COLOR);
  const loungeDiffuser=ship.staticMesh.getObjectByName('Lounge warm diffuser');
  assert.ok(loungeDiffuser);assert.equal(loungeDiffuser.material.emissive.getHex(),CABIN_WARM_LIGHT_COLOR);
  assert.ok(lights.filter(l=>l.name==='Lounge seat light').every(l=>l.color.getHex()===CABIN_WARM_LIGHT_COLOR));
  const geometry=new Set(meshes.map(m=>m.geometry)),materials=new Set(meshes.flatMap(m=>Array.isArray(m.material)?m.material:[m.material]));
  for(const g of geometry)g.dispose();
  for(const m of materials){m.map?.dispose();m.bumpMap?.dispose();m.roughnessMap?.dispose();m.dispose();}
});
