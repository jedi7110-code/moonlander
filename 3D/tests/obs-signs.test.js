import test from 'node:test';
import assert from 'node:assert/strict';
import {Group,MeshStandardMaterial,Raycaster,Vector3} from 'three';
import {label,batchStatic} from '../src/obs/materials.js';
import {buildShip} from '../src/obs/ship.js';

test('sign textures preserve plate proportions and fit text without stretching or clipping',()=>{
  const cases=[['01 / HABITATION',4.8,.30],['02 / OPERATIONS',4.8,.30],['03 / ENGINEERING',4.8,.30],['MEDICAL / 02',2.6,.26],['TARAIRON\nCREW 01',1.13,.37],['COOLANT\nLOOP 02',.60,.38],['EVA / SUIT SERVICE',3.31,.26],['WC',.94,.26]];
  for(const [text,w,h]of cases){
    const draws=[],ctx={fillRect(){},measureText(text){return{width:text.length*parseFloat(this.font.slice(4))*.6};},fillText(...args){draws.push({args,size:parseFloat(this.font.slice(4))});}};
    const canvas={getContext:()=>ctx},parent=new Group();let sign;
    globalThis.document={createElement:()=>canvas};
    try{sign=label(parent,text,0,0,0,w,h);}finally{delete globalThis.document;}
    assert.ok(Math.abs(canvas.width/canvas.height-w/h)/(w/h)<.003);
    assert.ok(canvas.height>=128);assert.equal(draws.length,text.split('\n').length);
    for(const {args,size}of draws){
      assert.equal(args.length,3,'fillText must not horizontally compress letters');
      const [line,x,y]=args,halfWidth=line.length*size*.3;
      assert.ok(x-halfWidth>=canvas.width*.035);assert.ok(x+halfWidth<=canvas.width*.965);
      assert.ok(y-size*.5>0);assert.ok(y+size*.5<canvas.height);
    }
    assert.equal(sign.material.toneMapped,false);assert.equal(sign.material.depthTest,true);
    const batched=batchStatic(parent),merged=batched.getObjectByName('Sign: '+text);
    assert.ok(merged);assert.equal(merged.castShadow,false);assert.equal(merged.receiveShadow,false);
    merged.geometry.dispose();sign.geometry.dispose();sign.material.map.dispose();sign.material.dispose();
  }
});

test('front-facing signs stay clear of fixtures, ceiling beams and one another',()=>{
  const ctx={fillRect(){},fillText(){},strokeRect(){},beginPath(){},moveTo(){},lineTo(){},stroke(){},measureText(text){return{width:text.length*parseFloat(this.font.slice(4))*.6};}};
  const material=new MeshStandardMaterial();let ship;
  globalThis.document={createElement:()=>({getContext:()=>ctx})};
  try{ship=buildShip(new Proxy({},{get:()=>material}));}finally{delete globalThis.document;}
  const objects=[];
  for(const root of [ship.staticMesh,ship.animated]){
    root.updateMatrixWorld(true);
    root.traverse(mesh=>{
      if(!mesh.isMesh||mesh.material.visible===false)return;
      for(let node=mesh;node;node=node.parent)if(!node.visible)return;
      objects.push(mesh);
    });
  }
  const signs=objects.filter(mesh=>mesh.material.name.startsWith('Sign:')),ray=new Raycaster();let checked=0;
  for(const sign of signs){
    const normal=new Vector3().fromBufferAttribute(sign.geometry.attributes.normal,0).transformDirection(sign.matrixWorld);
    // Door-leaf and bicycle-console labels intentionally face sideways in this cutaway.
    if(normal.z<.8)continue;
    checked++;sign.geometry.computeBoundingBox();const {min,max}=sign.geometry.boundingBox;
    for(let column=0;column<=32;column++)for(const v of [.05,.5,.95]){
      const u=.02+column*.03;
      const point=new Vector3(min.x+(max.x-min.x)*u,min.y+(max.y-min.y)*v,(min.z+max.z)/2).applyMatrix4(sign.matrixWorld);
      const origin=point.clone().add(new Vector3(0,1.6,40));ray.set(origin,point.clone().sub(origin).normalize());
      const hit=ray.intersectObjects(objects,false)[0];
      assert.ok(!hit||hit.distance>=origin.distanceTo(point)-.0001,`${sign.name} is obstructed at ${u}, ${v}`);
    }
  }
  assert.ok(checked>=25);
  for(const root of [ship.staticMesh,ship.animated])root.traverse(mesh=>{mesh.geometry?.dispose();mesh.material?.map?.dispose();});
  material.dispose();
});
