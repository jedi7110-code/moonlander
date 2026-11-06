import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {STAIRS,STAIR_SEGMENTS,STAIR_ROUTE_LENGTH,stairPoint,stairContact,stairFoot,StairTraffic} from '../studies/stairs/route.js';
import {createStairStructure} from '../studies/stairs/structure.js';

test('two switchback decks share the existing floor heights with twenty equal risers each',()=>{
  assert.ok(Math.abs(STAIRS.rise-.1696)<1e-10);assert.equal(STAIRS.width,1.4);
  assert.equal(STAIR_SEGMENTS.filter(s=>s.kind==='flight').length,4);
  assert.equal(stairPoint(0).y,0);assert.ok(Math.abs(stairPoint(STAIR_ROUTE_LENGTH).y-6.784)<1e-10);
  for(let i=1;i<STAIR_SEGMENTS.length;i++){
    const s=STAIR_SEGMENTS[i].start,a=stairPoint(s-.000001),b=stairPoint(s+.000001);
    assert.ok(Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z)<.00001,'no gap at a flight or landing');
  }
});

test('opposing traffic keeps right and every step has a finite safe contact target',()=>{
  for(let s=0;s<STAIR_ROUTE_LENGTH;s+=.019){
    const up=stairContact(s,1,.32),down=stairContact(s,-1,.32);
    assert.ok(Math.abs(Math.hypot(up.x-down.x,up.z-down.z)-.64)<1e-9);
    for(const dir of [-1,1])for(const side of [-1,1]){
      const a=stairFoot(s,dir,side),b=stairFoot(s+.0001,dir,side);
      assert.ok([a.x,a.y,a.z].every(Number.isFinite));assert.ok(a.y>=0&&a.y<=7.01);
      if(a.planted&&b.planted)assert.ok(Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z)<1e-9,'a planted foot never slides');
    }
  }
});

test('three agents complete both directions without a ladder or same-lane overlap',()=>{
  const traffic=new StairTraffic();
  for(let i=0;i<9000;i++){
    traffic.update(1/120);
    for(const a of traffic.agents){assert.ok(a.s>=0&&a.s<=STAIR_ROUTE_LENGTH);assert.ok(a.wait>=0);}
  }
  assert.ok(traffic.agents.every(a=>a.wait===Infinity));
  assert.ok(traffic.agents.find(a=>a.id==='human').s===STAIR_ROUTE_LENGTH);
  assert.equal(traffic.agents.find(a=>a.id==='robot').s,0);
});

test('stair plates, stringers, pressure lining and rails are batched into a small finite model',()=>{
  const m=Object.fromEntries(['metal','dark','enamel','yellow'].map(k=>[k,new THREE.MeshStandardMaterial()]));
  const root=createStairStructure(m);let meshes=0,triangles=0;
  root.traverse(o=>{if(!o.isMesh)return;meshes++;triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;for(const value of o.geometry.attributes.position.array)assert.ok(Number.isFinite(value));});
  assert.ok(meshes<=8,`${meshes} batches`);assert.ok(triangles<35000,`${triangles} triangles`);
  const bounds=new THREE.Box3().setFromObject(root);assert.ok(bounds.min.x<-17.5);assert.ok(bounds.max.y>=10.4);
  root.traverse(o=>o.geometry?.dispose());Object.values(m).forEach(mat=>mat.dispose());
});
