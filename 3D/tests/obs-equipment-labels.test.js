import test from 'node:test';
import assert from 'node:assert/strict';
import {Group,MeshStandardMaterial,Box3,Vector3,SRGBColorSpace,Raycaster} from 'three';
import {LABEL_TILES,createEquipmentLabelTexture,addEquipmentLabel,equipmentLabelMaterial} from '../src/obs/equipment-labels.js';
import {equipmentCase} from '../src/obs/cabin-dressing.js';
import {createUnderdeckServiceTank} from '../src/obs/underdeck-tank.js';
import {addFireExtinguishers} from '../src/obs/fire-extinguishers.js';
import {createCargoStowage} from '../src/obs/cargo-bay.js';
import {createRearRoomFurnishings} from '../src/obs/rear-room-furnishings.js';
import {batchStatic} from '../src/obs/materials.js';
import {createCabinToon} from '../src/obs/cabin-toon.js';
import {buildShip} from '../src/obs/ship.js';

function canvasStub(t){
  const text=[],previous=globalThis.document;
  const context=new Proxy({fillText:value=>text.push(value),measureText:value=>({width:value.length*8}),createLinearGradient:()=>({addColorStop(){}})},{get:(o,k)=>o[k]??(()=>{})});
  globalThis.document={createElement:()=>({getContext:()=>context})};
  t.after(()=>{if(previous===undefined)delete globalThis.document;else globalThis.document=previous;});return text;
}

test('one bounded 1K atlas contains real equipment, inspection and stock information',t=>{
  const printed=canvasStub(t),texture=createEquipmentLabelTexture();t.after(()=>texture.dispose());
  assert.equal(texture.image.width,1024);assert.equal(texture.image.height,1024);assert.equal(texture.colorSpace,SRGBColorSpace);
  for(const word of ['EXTINGUISHER','PULL PIN','AIM LOW','SQUEEZE','SWEEP','SERVICE RECORD','RATIONS','POTABLE WATER','SERVICE PARTS','HYGIENE KIT','DETERGENT','STEW','CAUTION','UNDERDECK SERVICE TANK','02  RELIEVE RESIDUAL PRESSURE BEFORE SERVICING.','03  DO NOT LOOSEN FITTINGS WHILE PRESSURIZED.'])assert.ok(printed.includes(word),word);
  const tiles=Object.values(LABEL_TILES);
  for(const [x,y,w,h]of tiles){assert.ok(x>=0&&y>=0&&x+w<=1024&&y+h<=1024);}
  for(let i=0;i<tiles.length;i++)for(let j=0;j<i;j++){
    const [x,y,w,h]=tiles[i],[a,b,c,d]=tiles[j];
    assert.ok(x>=a+c||a>=x+w||y>=b+d||b>=y+h,'atlas tiles do not overlap');
  }
});

test('all flat, curved and circular labels share one matte material and bounded UVs',t=>{
  canvasStub(t);const m={},root=new Group();
  for(const key of Object.keys(LABEL_TILES).filter(key=>key!=='underdeck')){
    const mesh=addEquipmentLabel(root,m,key,key==='extinguisher'?{width:.146,height:.292,radius:.118}:key==='gauge'?{width:.063,round:true}:{});
    const uv=mesh.geometry.attributes.uv,[x,y,w,h]=LABEL_TILES[key];
    for(let i=0;i<uv.count;i++){
      assert.ok(uv.getX(i)>x/1024&&uv.getX(i)<(x+w)/1024);
      assert.ok(uv.getY(i)>1-(y+h)/1024&&uv.getY(i)<1-y/1024);
    }
    assert.ok(mesh.geometry.attributes.normal.array.every(Number.isFinite));
  }
  const material=root.children[0].material;assert.ok(root.children.every(mesh=>mesh.material===material));
  assert.equal(material.emissive.getHex(),0);assert.equal(material.transparent,false);assert.ok(material.polygonOffset);
  const batched=batchStatic(root,{xrLOD:true});assert.equal(batched.children.length,1);assert.equal(batched.children[0].castShadow,false);
  const toon=createCabinToon([batched]);toon.setStyle('cartoon');toon.update(1000,700,3,15);
  assert.equal(batched.children.length,1,'printed paper gets no silhouette shell');assert.equal(batched.children[0].material,material);
  toon.dispose();root.traverse(o=>o.geometry?.dispose());batched.traverse(o=>o.geometry?.dispose());material.map.dispose();material.dispose();
});

test('tank warnings share the existing atlas and follow the shell without a yellow plate',t=>{
  canvasStub(t);const standard=new MeshStandardMaterial(),yellow=new MeshStandardMaterial({color:0xffff00});
  const m={pipeSteel:standard,dark:standard,enamel:standard,brass:standard,yellow},root=new Group(),prints=[];
  for(const [i,length]of [2.6,2.8,2.4,2.5].entries()){
    const tank=createUnderdeckServiceTank(m,length);tank.position.x=i*4;root.add(tank);
    const print=tank.getObjectByName('Underdeck tank / yellow caution stencil');prints.push(print);
    assert.equal(print.geometry.index.count/3,8);
    const p=print.geometry.attributes.position,uv=print.geometry.attributes.uv;
    for(let j=0;j<p.count;j++){
      assert.ok(Math.abs(Math.hypot(p.getY(j),p.getZ(j))-.282)<1e-6);
      assert.ok(Math.abs(p.getX(j))<length*.34-.05,'lettering stays clear of retaining bands');
      assert.ok(uv.getX(j)>0&&uv.getX(j)<.5&&uv.getY(j)>.0625&&uv.getY(j)<.25);
    }
    for(let j=1;j<p.count;j++){
      assert.ok((p.getX(j)-p.getX(0))*(uv.getX(j)-uv.getX(0))>=-1e-7,'text runs left to right');
      assert.ok((p.getY(j)-p.getY(0))*(uv.getY(j)-uv.getY(0))>=-1e-7,'text stays upright');
    }
    tank.traverse(o=>assert.notEqual(o.material,yellow,'no blank yellow badge remains'));
  }
  const material=prints[0].material,map=equipmentLabelMaterial(m).map;
  assert.ok(prints.every(p=>p.material===material&&p.material.map===map));
  assert.equal(material.alphaTest,.35);assert.equal(material.transparent,false);assert.equal(material.emissive.getHex(),0);
  const batch=batchStatic(root,{xrLOD:true}),inkBatch=batch.children.find(o=>o.material===material);
  assert.equal(inkBatch.geometry.attributes.position.count/3,32);assert.equal(inkBatch.castShadow,false);
  const toon=createCabinToon([batch]);toon.setStyle('cartoon');toon.update(1000,700,3,15);
  assert.equal(batch.children.filter(o=>o.material===material).length,1);assert.equal(inkBatch.material,material);
  toon.dispose();root.traverse(o=>o.geometry?.dispose());batch.traverse(o=>o.geometry?.dispose());
  material.dispose();equipmentLabelMaterial(m).dispose();map.dispose();standard.dispose();yellow.dispose();
});

test('three extinguishers wrap their cylinders; storage labels clear straps, handles and walking space',t=>{
  canvasStub(t);const standard=new MeshStandardMaterial(),m=new Proxy({},{get:()=>standard}),root=new Group();
  const extinguishers=addFireExtinguishers(root,m,[6.784,3.392,0]);
  const cargo=createCargoStowage(m),stores=createRearRoomFurnishings(m,{room:'stores',x:0,floor:0});root.add(cargo,stores);
  const labels=[];root.traverse(o=>{if(o.userData.equipmentLabel)labels.push(o);});
  assert.equal(new Set(labels.map(o=>o.material)).size,1,'deck copies and every stock item share one print batch');
  for(const unit of extinguishers){
    const hose=unit.getObjectByName('Fire extinguisher / continuous hose');
    assert.ok(hose.geometry.parameters.path.getTangent(1).y<0,'hose ends downward without a reverse bend');
    const reverseTips=unit.children.filter(o=>o.geometry?.type==='CylinderGeometry'&&o.geometry.parameters.radiusTop===.026);
    assert.equal(reverseTips.length,0,'no upward-pointing extra nozzle');
    const print=unit.getObjectByName('Equipment label / extinguisher'),p=print.geometry.attributes.position;
    assert.equal(print.geometry.index.count/3,32);
    for(let i=0;i<p.count;i++)assert.ok(Math.abs(Math.hypot(p.getX(i),p.getZ(i))-.118)<1e-7,'paper follows the bottle');
    const bounds=new Box3().setFromObject(print);assert.ok(bounds.getSize(new Vector3()).z>.018,'not a flat rectangular badge');
  }
  for(const key of ['rations','water','parts'])assert.ok(cargo.getObjectByName(`Equipment label / ${key}`));
  for(const key of ['rations','tin','detergent','hygiene'])assert.ok(stores.getObjectByName(`Equipment label / ${key}`));
  assert.ok(new Box3().setFromObject(stores).max.z< -3.1);
  root.traverse(o=>o.geometry?.dispose());const material=labels[0].material;material.map.dispose();material.dispose();standard.dispose();
});

test('case stickers replace the backing face without losing the metal rim or normal depth occlusion',t=>{
  canvasStub(t);const standard=new MeshStandardMaterial(),m=new Proxy({},{get:()=>standard}),root=new Group();
  // All four production case sizes/orientations, plus the three restrained cases.
  for(const [i,[w,h]]of [[.83,.43],[.66,.46],[.60,.30],[.94,.48]].entries()){
    const bag=equipmentCase(root,m,standard,i*2,0,0,w,h);
    bag.rotation.set(i===3?-Math.PI/2:0,i*.17,i===3?Math.PI:0);
  }
  const cargo=createCargoStowage(m);root.add(cargo);root.updateMatrixWorld(true);
  const prints=[];root.traverse(o=>{if(o.userData.equipmentLabel)prints.push(o);});
  assert.equal(prints.length,7);
  for(const print of prints){
    const frame=print.parent.children.find(o=>o.name===`Equipment label frame / ${print.userData.equipmentLabel}`&&o.position.equals(print.position));
    assert.ok(frame,'each sticker has a real, open-centred backing frame');
    const {width,height}=print.geometry.parameters;
    for(const fx of [-.45,0,.45])for(const fy of [-.45,0,.45]){
      const point=print.localToWorld(new Vector3(width*fx,height*fy,.2));
      const direction=new Vector3(0,0,-1).transformDirection(print.matrixWorld);
      const ray=new Raycaster(point,direction);
      assert.ok(ray.intersectObject(print).length>0,'paper is visible');
      assert.equal(ray.intersectObject(frame).length,0,'there is no parallel front polygon under the paper to z-fight with');
    }
    const rimRay=new Raycaster(print.localToWorld(new Vector3(width/2+.003,0,.2)),new Vector3(0,0,-1).transformDirection(print.matrixWorld));
    assert.ok(rimRay.intersectObject(frame).length>0,'metal border remains');
    assert.equal(print.material.depthTest,true,'stickers cannot show through the net, walls or another case');
    assert.equal(print.material.depthWrite,true);
  }
  const batch=batchStatic(root,{xrLOD:true}),mat=equipmentLabelMaterial(m);
  const printBatch=batch.children.find(o=>o.material===mat);
  assert.equal(printBatch.geometry.attributes.position.count/3,14,'still two triangles per sticker in one shared draw');
  assert.equal(printBatch.castShadow,false);
  root.traverse(o=>o.geometry?.dispose());batch.traverse(o=>o.geometry?.dispose());mat.map.dispose();mat.dispose();standard.dispose();
});

test('all four actual OBS hard cases, including the yellow wall case, have unobstructed single-surface stickers',t=>{
  canvasStub(t);const standard=new MeshStandardMaterial(),m=new Proxy({},{get:()=>standard});
  const ship=buildShip(m,{mergeStatic:false}),cases=[];
  ship.staticMesh.updateMatrixWorld(true);
  ship.staticMesh.traverse(o=>{if(o.children.some(child=>child.name==='Case lid'))cases.push(o);});
  assert.equal(cases.length,4,'audit every production hard case, not only the cargo-net rack');
  assert.equal(cases.filter(o=>o.getObjectByName('Case body').material.color.getHex()===0xe2ae35).length,1,'include the yellow toilet-side case');
  for(const bag of cases){
    const print=bag.getObjectByName('Equipment label / parts');assert.ok(print);
    const {width,height}=print.geometry.parameters;
    for(const fx of [-.45,0,.45])for(const fy of [-.45,0,.45]){
      const origin=print.localToWorld(new Vector3(width*fx,height*fy,.05));
      const ray=new Raycaster(origin,new Vector3(0,0,-1).transformDirection(print.matrixWorld));
      const hits=ray.intersectObject(bag,true);
      assert.equal(hits[0]?.object,print,`${bag.name} / ${bag.position.toArray()}: the print is the outermost surface`);
      assert.ok(hits.filter(hit=>hit.object!==print).every(hit=>hit.distance-hits[0].distance>.01),
        `no opaque backing surface is almost coplanar: ${hits.map(hit=>`${hit.object.name}:${(hit.distance-hits[0].distance).toFixed(5)}`).join(', ')}`);
    }
  }
  const geometry=new Set(),materials=new Set(),maps=new Set();
  for(const root of [ship.staticMesh,ship.animated])root.traverse(o=>{if(o.geometry)geometry.add(o.geometry);if(o.material)materials.add(o.material);});
  for(const mat of materials)for(const value of Object.values(mat))if(value?.isTexture)maps.add(value);
  geometry.forEach(g=>g.dispose());materials.forEach(mat=>mat.dispose());maps.forEach(map=>map.dispose());
});
