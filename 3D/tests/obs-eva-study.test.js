import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {MeshStandardMaterial} from 'three';
import {loadEVAGarment} from '../src/obs/eva-garment.js';
import {createStudyModel,studyFraming,visibleBounds,STUDY_FOCUS,STUDY_VIEWS} from '../studies/eva/study-model.js';

test('EVA study uses the shipped garment and helmet, and restores colorway/geometry after inspection',async()=>{
  const bytes=await readFile(new URL('../public/assets/obs/eva/pressure-garment.glb',import.meta.url));
  const previousProgress=globalThis.ProgressEvent,previousDocument=globalThis.document;
  globalThis.ProgressEvent=class extends Event{constructor(type,init){super(type);Object.assign(this,init);}};
  const source=new MeshStandardMaterial(),m=new Proxy({},{get:()=>source});let model;
  try{
    await loadEVAGarment(`data:model/gltf-binary;base64,${bytes.toString('base64')}`);
    globalThis.document={createElement:()=>({getContext:()=>({fillRect(){},fillText(){},measureText:t=>({width:t.length*8})})})};
    model=createStudyModel(m);
  }finally{
    if(previousProgress===undefined)delete globalThis.ProgressEvent;else globalThis.ProgressEvent=previousProgress;
    if(previousDocument===undefined)delete globalThis.document;else globalThis.document=previousDocument;
  }
  assert.equal(model.suits.length,3);
  const cloths=model.suits.map(suit=>suit.getObjectByName('Tailored pressure garment'));
  for(const suit of model.suits){
    assert.equal(suit.userData.garmentSource,'Blender');
    for(const name of ['Metal helmet shell','Continuous face visor','Wide helmet locking collar','Relaxed pressure glove','Anatomical pressure boot','Life support backpack'])assert.ok(suit.getObjectByName(name),name);
  }
  assert.equal(cloths[0].geometry,cloths[1].geometry);assert.equal(cloths[0].geometry,cloths[2].geometry);
  assert.equal(cloths[0].material.color.getHex(),cloths[2].material.color.getHex());
  assert.notEqual(cloths[0].material.color.getHex(),cloths[1].material.color.getHex());
  const original=cloths[0].geometry.attributes.position.array.slice(),height=visibleBounds(model.root).max.y;
  model.setHanger(true);assert.ok(visibleBounds(model.root).max.y>height+.2);model.setHanger(false);
  model.select('all');assert.deepEqual(model.suits.map(s=>s.visible),[true,true,true]);
  assert.deepEqual(model.suits.map(s=>s.position.x),[-1.06,0,1.06]);
  for(const [mode,index]of [['red',1],['white',0]]){
    model.select(mode);assert.equal(model.suits.filter(s=>s.visible).length,1);assert.ok(model.suits[index].visible);assert.equal(model.suits[index].position.x,0);
  }
  model.setWireframe(true);assert.ok(cloths.every(mesh=>mesh.material.wireframe));
  model.setWireframe(false);assert.ok(cloths.every(mesh=>!mesh.material.wireframe));
  assert.deepEqual(cloths[0].geometry.attributes.position.array,original,'inspection never edits garment vertices');
});

test('EVA camera presets include the neck and fit single/three suits at desktop and narrow widths',()=>{
  for(const aspect of [.55,1,1.8])for(const mode of ['white','red','all'])for(const focus of Object.keys(STUDY_FOCUS))for(const view of Object.keys(STUDY_VIEWS)){
    const frame=studyFraming({aspect,mode,focus,view});
    assert.ok(frame.target.toArray().every(Number.isFinite));assert.ok(Math.abs(frame.position.distanceTo(frame.target)-6)<1e-6);
    assert.ok(frame.height>=STUDY_FOCUS[focus].height);
    if(mode==='all')assert.ok(frame.height*aspect>=3.12-1e-8);
    if(focus==='helmet'){assert.ok(frame.target.y-frame.height/2<1.60);assert.ok(frame.target.y+frame.height/2>1.98);}
  }
  assert.ok(studyFraming({view:'back',focus:'backpack'}).position.z<0);
  assert.ok(studyFraming({hanger:true}).height>studyFraming().height);
});

test('EVA study loads production modules without substituting the rejected reference model',async()=>{
  const source=await readFile(new URL('../studies/eva/study.js',import.meta.url),'utf8');
  assert.match(source,/loadEVAGarment\('\/3D\/assets\/obs\/eva\/pressure-garment\.glb'\)/);
  assert.match(source,/createStudyModel\(industrialMaterials\(base\)\)/);
  assert.doesNotMatch(source,/reference-suit-study|build-reference/);
  const html=await readFile(new URL('../studies/eva/index.html',import.meta.url),'utf8');
  for(const id of ['suits','focuses','views','wireframe','hanger','rotate','light','reset','zoom-in','zoom-out','error'])assert.ok(html.includes(`id="${id}"`));
});
