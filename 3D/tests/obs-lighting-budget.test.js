import test from 'node:test';
import assert from 'node:assert/strict';
import {BoxGeometry,DoubleSide,Group,Mesh,MeshStandardMaterial,PointLight,SkinnedMesh,SphereGeometry} from 'three';
import {buildShip} from '../src/obs/ship.js';
import {batchStatic,createStaticShadowProxy} from '../src/obs/materials.js';
import {limitCabinLights,limitShadowCasters,CABIN_PIXEL_RATIO,CABIN_SHADOW_SIZE,CABIN_LIGHT_COLOR,CABIN_WARM_LIGHT_COLOR,CABIN_DECK_LIGHT,CABIN_AMBIENCE} from '../src/obs/lighting.js';

test('the dressed cabin lights all three rear rooms with sixteen local lights (seven in shaders) and no extra shadow passes',()=>{
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
    const active=lights.filter(l=>l.visible),shader=lights.filter(l=>l.userData.cabinShaderLight);
    assert.equal(active.length,9);
    assert.equal(active.filter(l=>l.isSpotLight).length,0);
    assert.equal(active.filter(l=>l.isRectAreaLight).length,3);
    assert.equal(active.filter(l=>l.isPointLight).length,6);
    // Short-range fills are evaluated per pixel in range by the cabin shaders instead.
    assert.equal(shader.length,7);
    assert.ok(shader.every(l=>l.isPointLight&&!l.visible&&l.distance>0&&l.decay===2));
    assert.equal(shader.filter(l=>l.parent.name==='Bulkhead gate lights').length,3);
    const ladder=shader.filter(l=>l.name==='Ladder shaft fill');
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
        assert.equal(light.position.x,6);assert.equal(light.intensity,CABIN_DECK_LIGHT.fillPower);
        assert.equal(light.distance,17);assert.equal(light.color.getHex(),CABIN_DECK_LIGHT.fillColor);
      }else{
        const top=light.position.y>8,mid=light.position.y>5&&!top;
        assert.equal(light.position.x,-5);assert.equal(light.intensity,mid?CABIN_DECK_LIGHT.livingPower:CABIN_DECK_LIGHT.power);
        assert.equal(light.distance,20);assert.equal(light.color.getHex(),CABIN_DECK_LIGHT.color);
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

test('the cabin is gently dimmer with warm rather than blue fill light',()=>{
  assert.ok(CABIN_AMBIENCE.exposure>=1.1&&CABIN_AMBIENCE.exposure<1.28);
  assert.ok(CABIN_AMBIENCE.ambient<1.05&&CABIN_AMBIENCE.keyPower<2.5&&CABIN_AMBIENCE.fillPower<.8);
  assert.ok(CABIN_DECK_LIGHT.power<45&&CABIN_DECK_LIGHT.fillPower<32&&CABIN_DECK_LIGHT.livingPower<12);
  for(const color of [CABIN_AMBIENCE.sky,CABIN_AMBIENCE.fill,CABIN_DECK_LIGHT.color,CABIN_DECK_LIGHT.fillColor])assert.ok((color>>16)>(color&255));
});

test('only finite-range fills move into the shaders; an unbounded one stays a real light',()=>{
  const root=new Group(),ladder=new PointLight(0xffffff,4,4.2,2),endless=new PointLight(0xffffff,4,0,2);
  ladder.name=endless.name='Ladder shaft fill';root.add(ladder,endless);limitCabinLights(root);
  assert.equal(ladder.userData.cabinShaderLight,true);assert.equal(ladder.visible,false);
  assert.equal(endless.userData.cabinShaderLight,undefined);assert.equal(endless.visible,true);
});

test('one shadow-only copy casts for the opaque static batches while they keep receiving',()=>{
  const root=new Group(),opaque=new MeshStandardMaterial(),glass=new MeshStandardMaterial({transparent:true});
  const cut=new MeshStandardMaterial({alphaTest:.5}),both=new MeshStandardMaterial({side:DoubleSide});
  [opaque,glass,cut,both].forEach((material,i)=>{const mesh=new Mesh(new BoxGeometry(),material);mesh.position.set(i*2,1,-3);root.add(mesh);});
  const batches=batchStatic(root),proxy=createStaticShadowProxy(batches);
  const batch=material=>batches.children.find(mesh=>mesh.material===material);
  assert.equal(proxy.castShadow,true);assert.equal(proxy.receiveShadow,false);
  assert.deepEqual(Array.from(proxy.geometry.attributes.position.array),Array.from(batch(opaque).geometry.attributes.position.array),'identical shadow geometry, already in cabin space');
  assert.equal(batch(opaque).castShadow,false);assert.equal(batch(opaque).receiveShadow,true);
  assert.ok([glass,cut,both].every(material=>batch(material).castShadow),'alpha, transparent and double-sided batches still cast themselves');
  // Visible passes call onBeforeRender and draw nothing; the shadow pass draws it in full.
  proxy.onBeforeRender();assert.equal(proxy.geometry.drawRange.count,0);
  proxy.onAfterRender();assert.equal(proxy.geometry.drawRange.count,Infinity);
  proxy.geometry.dispose();batches.children.forEach(mesh=>mesh.geometry.dispose());
});

test('only tiny rigid parts stop casting; props, scaled parents and skins keep shadows',()=>{
  const root=new Group(),geometry=new SphereGeometry(1),mesh=radius=>{const m=new Mesh(geometry);m.scale.setScalar(radius);m.castShadow=true;return m;};
  const bead=mesh(.01),cup=mesh(.045),skin=new SkinnedMesh(geometry),parent=new Group(),nested=mesh(.1);
  skin.scale.setScalar(.01);skin.castShadow=true;parent.scale.setScalar(.2);parent.add(nested);root.add(bead,cup,skin,parent);
  limitShadowCasters(root);
  assert.equal(bead.castShadow,false,'1 cm bead');assert.equal(cup.castShadow,true,'4.5 cm cup');
  assert.equal(skin.castShadow,true);assert.equal(nested.castShadow,false,'world scale counts: 2 cm');
  geometry.dispose();
});
