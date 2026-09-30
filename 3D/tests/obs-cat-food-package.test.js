import test from 'node:test';
import assert from 'node:assert/strict';
import {Box3,Group,Texture,Vector3,SRGBColorSpace} from 'three';
import {statSync,readFileSync} from 'node:fs';
import {CAT_FOOD_PRINT,createCatFoodMaterial,createCatFoodPouch,createCatFoodCarton} from '../src/obs/cat-food-package.js';
import {createDroid} from '../src/obs/droid-model.js';
import {createDroidServiceRig} from '../src/obs/droid-service.js';
import {createCabinToon} from '../src/obs/cabin-toon.js';

test('retail front and back share a compact static texture and a non-emissive material',()=>{
  const texture=new Texture(),material=createCatFoodMaterial(texture);
  assert.equal(texture.colorSpace,SRGBColorSpace);assert.equal(texture.anisotropy,4);
  assert.equal(material.map,texture);assert.equal(material.emissive.getHex(),0);
  assert.equal(material.transparent,false);assert.equal(material.userData.cabinKeepSurface,true);
  const asset=new URL('../public/'+CAT_FOOD_PRINT,import.meta.url);
  assert.ok(statSync(asset).size<100*1024,'OBS does not load the full-resolution print master');
  assert.equal(readFileSync(asset).toString('ascii',8,12),'WEBP');
  texture.dispose();material.dispose();
});

test('full and empty pouches keep the same print and grip envelope with just 40 triangles',()=>{
  const material=createCatFoodMaterial(),root=new Group();
  for(const empty of [false,true]){
    const mesh=createCatFoodPouch(material,{empty});root.add(mesh);
    const size=new Box3().setFromObject(mesh).getSize(new Vector3());
    assert.ok(Math.abs(size.x-.23)<1e-6);assert.ok(Math.abs(size.y-.25)<1e-6);
    assert.ok(Math.abs(size.z-(empty?.05:.14))<1e-6);
    assert.equal(mesh.geometry.attributes.position.count/3,40);assert.equal(mesh.material,material);
    const uv=mesh.geometry.attributes.uv;
    for(let i=0;i<uv.count;i++)assert.ok(uv.getX(i)>0&&uv.getX(i)<1&&uv.getY(i)>0&&uv.getY(i)<1);
    for(let i=0;i<18;i++)assert.ok(uv.getX(i)<.5,'front artwork stays on the front');
    for(let i=36;i<54;i++)assert.ok(uv.getX(i)>.5,'back artwork stays on the back');
    const normal=mesh.geometry.attributes.normal;
    assert.ok(normal.getZ(0)>0);assert.ok(normal.getZ(36)<0,'back faces out, with upright unmirrored copy');
  }
  const carton=createCatFoodCarton(material);root.add(carton);
  assert.equal(carton.geometry.index.count/3,12);assert.equal(carton.material,material);
  const packages=[...root.children],toon=createCabinToon([root]);toon.setStyle('cartoon');
  assert.ok(packages.every(o=>o.material===material),'cartoon mode retains the retail artwork');
  toon.dispose();root.traverse(o=>o.geometry?.dispose());material.dispose();
});

test('the live feeding prop and discarded wrapper reuse the ship packaging material',()=>{
  const material=createCatFoodMaterial(),droid=createDroid({detail:'obs'});
  const rig=createDroidServiceRig({droid,cable:new Group()},{cargo:[],catFoodPackage:material});
  assert.equal(rig.props.food.children.length,1);
  assert.equal(rig.props.food.children[0].material,material);
  assert.equal(rig.wasteVariants.wrapper.children.length,1);
  assert.equal(rig.wasteVariants.wrapper.children[0].material,material);
  droid.dispose();const geometry=new Set(),materials=new Set();
  rig.root.traverse(o=>{if(o.geometry)geometry.add(o.geometry);if(o.material)materials.add(o.material);});
  geometry.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());
});
