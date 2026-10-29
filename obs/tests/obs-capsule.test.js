import test from 'node:test';
import assert from 'node:assert/strict';
import {Box3,MeshStandardMaterial,Vector3} from 'three';
import {BunkVisit,BUNK_PHASE_SECONDS,BUNK_LIFT_SECONDS} from '../src/obs/bunk-visit.js';
import {createBunk,animateBunk,createCapsuleGlazing,BUNK_DOME} from '../src/obs/bunk.js';
const advanceTo=(visit,phase)=>{for(let i=0;i<30&&visit.phase!==phase;i++)visit.update(BUNK_PHASE_SECONDS[visit.phase]);assert.equal(visit.phase,phase);};

test('capsule closes only after entry and reopens before exit, including queued interruptions',()=>{
  let entered=0,exited=0;
  const visit=new BunkVisit({entered:()=>entered++,exited:()=>exited++});
  advanceTo(visit,'sleeping');assert.equal(entered,1);
  assert.equal(visit.pose.recline,1);assert.equal(visit.pose.open,0);assert.equal(visit.pose.light,.05);
  visit.requestExit();visit.update(BUNK_LIFT_SECONDS);assert.equal(visit.pose.recline,1);assert.equal(visit.pose.open,0);assert.equal(visit.pose.lift,1);
  visit.update(.9);assert.ok(visit.pose.open>.4);
  visit.update(.9);assert.equal(visit.phase,'leaving');assert.equal(visit.pose.open,1);
  advanceTo(visit,'done');assert.equal(exited,1);
  const interrupted=new BunkVisit({entered:()=>assert.fail('cancelled sleep must not start recovery')});
  interrupted.update(3);interrupted.requestExit();interrupted.update(30);assert.equal(interrupted.phase,'done');
});

test('head hinge elevates on telescoping posts and the open dome clears overhead lights',()=>{
  const material=new MeshStandardMaterial({emissiveIntensity:2.2}),bunk=createBunk(new Proxy({},{get:()=>material}));
  const pivot=bunk.lid.position.clone();
  for(let i=0;i<=20;i++){
    animateBunk(bunk,{open:i/20,light:1});bunk.root.updateMatrixWorld(true);
    assert.deepEqual(bunk.lid.position.toArray(),pivot.toArray());
    assert.ok(new Box3().setFromObject(bunk.lid,true).max.y<2.70);
    for(const piston of bunk.liftPistons){
      assert.ok(Math.abs(piston.position.y-.025*piston.scale.y-.62)<1e-9);
      assert.ok(Math.abs(piston.position.y+.025*piston.scale.y-(BUNK_DOME.rim+bunk.hingeCarriage.position.y))<1e-9);
    }
  }
  const foot=bunk.lid.localToWorld(new Vector3(BUNK_DOME.length,0,0));assert.ok(foot.y>2);
  animateBunk(bunk,{open:0,light:.05});assert.ok(bunk.light.intensity<.04);assert.equal(material.emissiveIntensity,2.2);
  const shell=bunk.root.getObjectByName('Capsule glazing');assert.ok(shell.material.transparent);assert.ok(shell.material.opacity<.25);
});

test('glazing has rounded head and foot caps with smooth unit normals, not planar end walls',()=>{
  const geometry=createCapsuleGlazing(),positions=geometry.attributes.position,normals=geometry.attributes.normal,sections=new Map();
  for(let i=0;i<positions.count;i++){
    const x=positions.getX(i),radius=Math.hypot(positions.getY(i)/BUNK_DOME.height,positions.getZ(i)/(BUNK_DOME.width/2));
    sections.set(x,Math.max(radius,sections.get(x)??0));
    assert.ok(Math.abs(new Vector3().fromBufferAttribute(normals,i).length()-1)<1e-6);
  }
  const profile=[...sections].sort((a,b)=>a[0]-b[0]);
  assert.ok(profile[0][1]<1e-6);assert.ok(profile.at(-1)[1]<1e-6);
  const head=profile.filter(([x])=>x<BUNK_DOME.cap),foot=profile.filter(([x])=>x>BUNK_DOME.length-BUNK_DOME.cap);
  assert.ok(head.length>10&&foot.length>10);
  for(let i=1;i<head.length;i++)assert.ok(head[i][1]>head[i-1][1]);
  for(let i=1;i<foot.length;i++)assert.ok(foot[i][1]<foot[i-1][1]);
  geometry.dispose();
});

test('smoke gradually follows occupied closure; opening and an empty closed capsule stay clear',()=>{
  const material=new MeshStandardMaterial(),bunk=createBunk(new Proxy({},{get:()=>material})),visit=new BunkVisit();
  advanceTo(visit,'closing');let previous=.13;
  const glass=bunk.glass,color=glass.color;
  for(let i=0;i<=45;i++){
    animateBunk(bunk,visit.pose);assert.ok(glass.opacity>=previous-1e-9);previous=glass.opacity;
    assert.equal(bunk.glass,glass);assert.equal(glass.color,color);visit.update(.06);
  }
  assert.equal(visit.phase,'sleeping');assert.ok(glass.opacity>.7);
  visit.requestExit();visit.update(BUNK_LIFT_SECONDS+.9);animateBunk(bunk,visit.pose);assert.ok(glass.opacity<previous);
  visit.update(.9);animateBunk(bunk,visit.pose);assert.equal(glass.opacity,.13);
  advanceTo(visit,'sealing');assert.equal(visit.pose.occupied,false);
  animateBunk(bunk,visit.pose);assert.equal(glass.opacity,.13);
  animateBunk(bunk,{open:0,occupied:false});assert.equal(glass.opacity,.13);
  animateBunk(bunk);assert.equal(glass.opacity,.13);
});

test('hinge posts rise before opening and settle only after the dome closes',()=>{
  for(const phase of ['opening','waking','closing','sealing']){
    const visit=new BunkVisit();visit.phase=phase;
    for(let age=0;age<=BUNK_PHASE_SECONDS[phase];age+=.01){
      visit.age=age;const p=visit.pose;
      if(p.open>0)assert.equal(p.lift,1,`${phase} rotates before the hinge clears`);
      if(p.lift<1)assert.equal(p.open,0,`${phase} lowers a tilted dome`);
    }
  }
});
