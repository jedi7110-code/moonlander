import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Box3,MeshStandardMaterial,Vector3} from 'three';
import {hangingSuit} from '../src/obs/eva-suit.js';
import {EVA_BODY} from '../src/obs/eva-anatomy.js';
import {loadEVAGarment} from '../src/obs/eva-garment.js';
import {createEVABay} from '../src/obs/eva.js';
import {batchStatic} from '../src/obs/materials.js';

test('the custom garment loads with separately authored helmets and cabin-safe geometry',async()=>{
  const bytes=await readFile(new URL('../public/assets/obs/eva/pressure-garment.glb',import.meta.url));
  globalThis.ProgressEvent=class extends Event{constructor(type,init){super(type);Object.assign(this,init);}};
  try{await loadEVAGarment(`data:model/gltf-binary;base64,${bytes.toString('base64')}`);}finally{delete globalThis.ProgressEvent;}
  const shared=new MeshStandardMaterial(),materials=new Proxy({},{get:()=>shared});
  globalThis.document={createElement(){return{getContext(){return{fillRect(){},fillText(){},measureText(text){return{width:text.length*16};}};}};}};
  let bay;try{bay=createEVABay(materials,3.392);}finally{delete globalThis.document;}
  bay.root.updateMatrixWorld(true);
  const bounds=bay.suits.map(suit=>new Box3().setFromObject(suit));
  const colors=[];
  for(const [index,suit]of bay.suits.entries()){
    assert.equal(suit.userData.garmentSource,'Blender');
    assert.ok(suit.getObjectByName('Continuous face visor'));assert.ok(suit.getObjectByName('Metal helmet shell'));
    assert.ok(suit.getObjectByName('Chest service panel'));
    colors.push(suit.getObjectByName('Tailored pressure garment').material.color.getHex());
    assert.ok(bounds[index].min.y>3.592);assert.ok(bounds[index].max.y<6.192);
    if(index)assert.ok(bounds[index].min.x>bounds[index-1].max.x);
    suit.traverse(mesh=>{if(mesh.geometry)for(const value of mesh.geometry.attributes.position.array)assert.ok(Number.isFinite(value));});
  }
  assert.equal(colors[0],colors[2]);assert.notEqual(colors[0],colors[1]);
  assert.equal(shared.color.getHex(),0xffffff);
  assert.ok(new Box3().setFromObject(bay.equipmentRack).min.x>bounds[2].max.x);
  assert.ok(batchStatic(bay.root).children.length>0,'custom geometry must participate in cabin batching');
});

test('reconstructed joints and opposed hands retain an anatomical resting pose',()=>{
  const shared=new MeshStandardMaterial(),materials=new Proxy({},{get:()=>shared});
  globalThis.document={createElement(){return{getContext(){return{fillRect(){},fillText(){},measureText(text){return{width:text.length*16};}};}};}};
  let suit;try{suit=hangingSuit(materials,0);}finally{delete globalThis.document;}
  suit.updateMatrixWorld(true);
  assert.equal(suit.userData.anatomy,'reference-reconstructed-v2');
  assert.ok(EVA_BODY.wrist[2]-EVA_BODY.elbow[2]>.09,'forearm bends toward the front');
  assert.ok(EVA_BODY.knee[2]-EVA_BODY.ankle[2]>.07,'ankle hangs behind knee');
  const gloves=[];suit.traverse(o=>{if(o.name==='Relaxed pressure glove')gloves.push(o);});
  assert.equal(gloves.length,2);
  for(const glove of gloves){
    const side=glove.userData.side,palmNormal=new Vector3(0,0,-1).applyQuaternion(glove.quaternion);
    assert.ok(palmNormal.x*side<-.85,'palm faces thigh instead of the camera');
    assert.ok(glove.position.distanceTo(new Vector3(side*EVA_BODY.wrist[0],...EVA_BODY.wrist.slice(1)))<1e-6);
    const palm=glove.getObjectByName('Shaped glove palm'),cuff=glove.getObjectByName('Glove locking cuff');
    palm.geometry.computeBoundingBox();cuff.geometry.computeBoundingBox();
    assert.ok(palm.geometry.boundingBox.max.y>cuff.geometry.boundingBox.max.y+.005,'wrist extends inside the sleeve beyond the cuff');
    const wristVertices=palm.geometry.attributes.position;
    const wristNormals=palm.geometry.attributes.normal;
    let sealSamples=0;
    for(let i=0;i<wristVertices.count;i++){
      if(Math.abs(wristVertices.getY(i)+.018)>.002)continue;
      const radius=Math.hypot(wristVertices.getX(i),wristVertices.getZ(i));
      assert.ok(radius>.055&&radius<.060,'circular wrist overlaps gasket inner wall without a gap');sealSamples++;
      assert.ok(wristVertices.getX(i)*wristNormals.getX(i)+wristVertices.getZ(i)*wristNormals.getZ(i)>.05,'wrist faces outward so its front surface cannot disappear');
    }
    assert.ok(sealSamples>=32,'check a full ring of wrist vertices at the gasket');
    const thumb=glove.getObjectByName('Opposed glove thumb');
    thumb.geometry.computeBoundingBox();
    const thumbCentre=thumb.localToWorld(thumb.geometry.boundingBox.getCenter(new Vector3()));
    const palmCentre=glove.localToWorld(new Vector3(0,-.070,0));
    assert.ok(thumbCentre.z>palmCentre.z+.025,'thumb leads forward on both hands');
    const fingers=[];glove.traverse(o=>{if(o.name==='Curved glove finger')fingers.push(o);});
    assert.equal(fingers.length,4);
    for(const finger of fingers){
      const p=finger.geometry.attributes.position;
      const last=p.count-17;let startZ=0,endZ=0;
      for(let i=0;i<16;i++){startZ+=p.getZ(i)/16;endZ+=p.getZ(last+i)/16;}
      assert.ok(endZ<startZ-.02,'fingers curl toward the palm');
    }
  }
  suit.traverse(o=>{if(o.geometry)assert.ok(o.geometry.attributes.uv,`${o.name} needs UVs for cabin batching`);});
});
