import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {STAIRS,STAIR_SEGMENTS,STAIR_ROUTE_LENGTH,stairPoint,stairContact,stairFoot,StairTraffic,ROBOT_ROUTE_LENGTH,stairRouteLength} from '../studies/stairs/route.js';
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

test('the robot starts toward the rear top flight and skips the guarded front approach',()=>{
  const traffic=new StairTraffic(),robot=traffic.agents.find(a=>a.id==='robot');
  const topFlight=STAIR_SEGMENTS.filter(s=>s.kind==='flight').at(-1);
  assert.equal(robot.s,ROBOT_ROUTE_LENGTH);assert.equal(robot.direction,-1);
  let previous=Infinity;
  for(let i=0;i<=120;i++){
    const p=stairContact(robot.s,robot.direction,.32);
    assert.ok(p.z<.20,'the start must stay behind the front guardrail');
    if(robot.s>=topFlight.end){
      const distance=Math.hypot(p.x-STAIRS.right,p.z-(STAIRS.back+.32));
      assert.ok(distance<=previous+1e-9,'first movement must approach the descending stairs');previous=distance;
    }
    traffic.update(1/120);
  }
  assert.ok(robot.s<topFlight.end,'the robot should enter the stairs within its first second');
});

test('three agents complete both directions without a ladder or same-lane overlap',()=>{
  for(const reversed of [false,true]){
    const traffic=new StairTraffic();
    if(reversed)for(const a of traffic.agents){a.s=stairRouteLength(a.id)-a.s;a.direction*=-1;}
    for(let i=0;i<9000;i++){
      traffic.update(1/120);
      for(const a of traffic.agents){assert.ok(a.s>=0&&a.s<=stairRouteLength(a.id));assert.ok(a.wait>=0);}
    }
    assert.ok(traffic.agents.every(a=>a.wait===Infinity));
    assert.equal(traffic.agents.find(a=>a.id==='human').s,reversed?0:STAIR_ROUTE_LENGTH);
    assert.equal(traffic.agents.find(a=>a.id==='robot').s,reversed?ROBOT_ROUTE_LENGTH:0);
  }
});

test('stair plates, stringers, pressure lining and rails are batched into a small finite model',()=>{
  const m=Object.fromEntries(['metal','dark','enamel','yellow'].map(k=>[k,new THREE.MeshStandardMaterial()]));
  const root=createStairStructure(m);let meshes=0,triangles=0;
  root.traverse(o=>{if(!o.isMesh)return;meshes++;triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;for(const value of o.geometry.attributes.position.array)assert.ok(Number.isFinite(value));});
  assert.ok(meshes<=8,`${meshes} batches`);assert.ok(triangles<35000,`${triangles} triangles`);
  const bounds=new THREE.Box3().setFromObject(root);assert.ok(bounds.min.x<-17.5);assert.ok(bounds.max.y>=10.4);
  root.traverse(o=>o.geometry?.dispose());Object.values(m).forEach(mat=>mat.dispose());
});


test('rear landing floors leave the final incoming tread exposed on both decks',()=>{
  const m=Object.fromEntries(['metal','dark','enamel','yellow'].map(k=>[k,new THREE.MeshStandardMaterial()]));
  const root=createStairStructure(m);root.updateMatrixWorld(true);
  const ray=new THREE.Raycaster(),down=new THREE.Vector3(0,-1,0);
  for(const flight of STAIR_SEGMENTS.filter(s=>s.kind==='flight'&&s.half===1)){
    const top=flight.b[1];
    for(const [x,expected]of [[flight.b[0]-STAIRS.tread*.5,top-STAIRS.rise],[flight.b[0]+.05,top-.0005]]){
      ray.set(new THREE.Vector3(x,top+.30,STAIRS.back),down);
      const hits=ray.intersectObject(root,true);assert.ok(hits.length);
      assert.ok(Math.abs(hits[0].point.y-expected)<.00001,`floor covers the last tread at deck ${flight.level}`);
    }
  }
  root.traverse(o=>o.geometry?.dispose());Object.values(m).forEach(mat=>mat.dispose());
});
