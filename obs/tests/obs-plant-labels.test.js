import test from 'node:test';
import assert from 'node:assert/strict';
import {Group,MeshStandardMaterial,SRGBColorSpace,ShaderLib} from 'three';
import {PLANT_LABEL_SIZE,PLANT_LABEL_TILES,PLANT_STENCIL_KEYS,createPlantLabelTexture,plantLabelMaterial} from '../src/obs/plant-labels.js';
import {createPlantRack,animatePlants} from '../src/obs/plants.js';
import {PlantBed} from '../src/obs/plant-state.js';
import {batchStatic} from '../src/obs/materials.js';
import {createCabinToon} from '../src/obs/cabin-toon.js';

function canvasStub(t){
  const printed=[],previous=globalThis.document;
  const ctx=new Proxy({fillText:value=>printed.push(value)},{get:(o,k)=>o[k]??(()=>{})});
  globalThis.document={createElement:()=>({getContext:()=>ctx})};
  t.after(()=>{if(previous===undefined)delete globalThis.document;else globalThis.document=previous;});return printed;
}

test('a single half-1K print sheet documents the existing recovery and nutrient circuit',t=>{
  const printed=canvasStub(t),map=createPlantLabelTexture();t.after(()=>map.dispose());
  assert.deepEqual([map.image.width,map.image.height],PLANT_LABEL_SIZE);assert.equal(map.colorSpace,SRGBColorSpace);
  for(const text of ['HYDROPONICS','FILTER','CONDENSATE','02 / UV TREATMENT','CAUTION / UV RADIATION','ISOLATE POWER BEFORE OPENING','EC / pH','A','B','DO NOT MIX STOCKS','NUTRIENT RETURN','HP03-0711 / REV.02'])assert.ok(printed.includes(text),text);
  assert.ok(!printed.some(text=>text.includes('LOOP OK')),'a static print must not impersonate live sensor status');
  const tiles=Object.values(PLANT_LABEL_TILES);
  for(const [x,y,w,h]of tiles)assert.ok(x>=0&&y>=0&&x+w<=1024&&y+h<=512);
  for(let i=0;i<tiles.length;i++)for(let j=0;j<i;j++){
    const [x,y,w,h]=tiles[i],[a,b,c,d]=tiles[j];assert.ok(x>=a+c||a>=x+w||y>=b+d||b>=y+h,'no overlapping print tiles');
  }
});

test('fixed equipment is directly printed while replaceable cartridges use labels on one shared sheet',t=>{
  const printed=canvasStub(t),standard=new MeshStandardMaterial(),m=new Proxy({},{get:()=>standard}),rack=createPlantRack(m,0);
  const labels=[];rack.root.traverse(o=>{if(o.userData.plantLabel)labels.push(o);assert.ok(!o.name.startsWith('Sign:'),'old rectangular nameplates are gone');});
  assert.deepEqual(labels.map(o=>o.userData.plantLabel).sort(),Object.keys(PLANT_LABEL_TILES).sort());
  const material=plantLabelMaterial(m),stencil=plantLabelMaterial(m,{stencil:true}),version=material.map.version,draws=printed.length;
  assert.equal(stencil.map,material.map);assert.equal(stencil.alphaTest,.35);
  assert.equal(new Set(labels.map(o=>o.material)).size,2);
  for(const mat of [material,stencil]){
    assert.equal(mat.emissive.getHex(),0);assert.equal(mat.transparent,false);
    const shader={fragmentShader:ShaderLib.standard.fragmentShader};mat.onBeforeCompile(shader);
    assert.match(shader.fragmentShader,/min\(outgoingLight, diffuseColor.rgb \* 1.5\)/,'bright grow lights do not bleach the printed ink');
  }
  let triangles=0;
  for(const mesh of labels){
    triangles+=mesh.geometry.index.count/3;
    const key=mesh.userData.plantLabel,[x,y,w,h]=PLANT_LABEL_TILES[key],uv=mesh.geometry.attributes.uv;
    assert.equal(mesh.material,PLANT_STENCIL_KEYS.has(key)?stencil:material);
    assert.equal(mesh.userData.printApplication,PLANT_STENCIL_KEYS.has(key)?'direct':'replaceable label');
    for(let i=0;i<uv.count;i++){
      assert.ok(uv.getX(i)>x/1024&&uv.getX(i)<(x+w)/1024);
      assert.ok(uv.getY(i)>1-(y+h)/512&&uv.getY(i)<1-y/512);
    }
    if(['filter','nutrientA','nutrientB'].includes(key)){
      const p=mesh.geometry.attributes.position,radius=key==='filter'?.122:.092;
      assert.equal(mesh.geometry.index.count/3,16);
      for(let i=0;i<p.count;i++)assert.ok(Math.abs(Math.hypot(p.getX(i),p.getZ(i))-radius)<1e-7,'the print follows the cartridge');
    }
  }
  assert.equal(triangles,56);
  const bed=new PlantBed();for(let i=0;i<10;i++){bed.update(.1);animatePlants(rack,bed,i*.1);}
  assert.equal(material.map.version,version);assert.equal(printed.length,draws,'animation does not redraw the atlas');
  const prints=new Group();for(const mesh of labels)prints.add(mesh.clone());
  const batch=batchStatic(prints,{xrLOD:true});assert.equal(batch.children.length,2);assert.ok(batch.children.every(o=>!o.castShadow));
  const toon=createCabinToon([batch]);toon.setStyle('cartoon');toon.update(1000,700,3,15);
  assert.equal(batch.children.length,2);assert.ok(batch.children.every(o=>o.material===material||o.material===stencil),'toon mode preserves the printed details');
  toon.dispose();batch.traverse(o=>o.geometry?.dispose());rack.root.traverse(o=>o.geometry?.dispose());material.map.dispose();material.dispose();stencil.dispose();standard.dispose();
});

test('service cylinders and water collars share clean metal while UV and sensor housings share black',t=>{
  canvasStub(t);
  const metal=new MeshStandardMaterial({color:0x554c39}),black=new MeshStandardMaterial({color:0x101515});
  const m=new Proxy({metal,black},{get:(o,k)=>o[k]??metal}),rack=createPlantRack(m,0);
  const surface=rack.root.getObjectByName('Replaceable filter cartridge').material;
  assert.notEqual(surface,metal);assert.equal(surface.color.getHex(),0xbdc7c9);
  assert.equal(surface.metalness,.78);assert.equal(surface.map,null);assert.equal(surface.userData.cabinKeepSurface,true);
  for(const name of ['Nutrient A metal vessel','Nutrient B metal vessel','Nutrient A metal cap','Nutrient B metal cap'])assert.equal(rack.root.getObjectByName(name).material,surface,name);
  const collars=[];rack.root.traverse(o=>{if(['Sight tube collar','Filter cartridge metal collar'].includes(o.name))collars.push(o);});
  assert.equal(collars.length,4);assert.ok(collars.every(o=>o.material===surface));
  assert.equal(rack.root.getObjectByName('Enclosed UV treatment').material,black);
  assert.equal(rack.root.getObjectByName('Nutrient conductivity sensor').material,black);
  assert.equal(rack.recovery.condensate.glass.material.transparent,true,'the water tube remains clear glass');
  assert.equal(metal.color.getHex(),0x554c39,'the rest of the ship is not recolored');
  const toon=createCabinToon([rack.root]);toon.setStyle('cartoon');
  assert.equal(rack.root.getObjectByName('Replaceable filter cartridge').material,surface,'stainless finish survives cartoon mode');
  toon.dispose();const geometries=new Set(),materials=new Set();rack.root.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material)materials.add(o.material);});
  geometries.forEach(g=>g.dispose());const maps=new Set([...materials].map(m=>m.map).filter(Boolean));maps.forEach(map=>map.dispose());materials.forEach(m=>m.dispose());
});
