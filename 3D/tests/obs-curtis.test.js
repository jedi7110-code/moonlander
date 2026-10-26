import test from 'node:test';
import assert from 'node:assert/strict';
import {CurtisRoutine,CURTIS,CURTIS_TIMING} from '../src/obs/curtis-routine.js';
import {CrewMotion,Supplies,advanceCabinTraffic} from '../src/obs/state.js';
import {DroidRoutine} from '../src/obs/droid-routine.js';
import fs from 'node:fs';
import {Group,MeshStandardMaterial} from 'three';
import {createMiloBoot} from '../src/obs/characters.js';
import {finishCurtisBoots} from '../src/obs/curtis-model.js';

test('Curtis has black grain leather and dark laces without recoloring Milo or sharing extra lace materials',()=>{
  const material={cloth:new MeshStandardMaterial(),rubber:new MeshStandardMaterial(),metal:new MeshStandardMaterial()};
  const visitor=new Group(),milo=new Group();
  createMiloBoot(visitor,material,-1);createMiloBoot(visitor,material,1);createMiloBoot(milo,material,1);
  const original=milo.getObjectByName('Continuous leather boot upper').material.color.getHexString();
  finishCurtisBoots(visitor);
  const laces=new Set();let uppers=0;
  visitor.traverse(object=>{
    if(object.name==='Continuous leather boot upper'){
      uppers++;assert.equal(object.material.color.getHexString(),'151719');
      assert.equal(object.material.roughness,.62);assert.equal(object.material.metalness,0);
      assert.ok(object.material.bumpMap);assert.ok(object.material.bumpScale>0);
    }
    if(object.name==='Foot-shaped stitched boot welt')assert.equal(object.material.color.getHexString(),'151719');
    if(object.name==='Crossed boot lace'){
      assert.equal(object.material.color.getHexString(),'202123');laces.add(object.material);
    }
  });
  assert.equal(uppers,2);assert.equal(laces.size,2);
  assert.equal(milo.getObjectByName('Continuous leather boot upper').material.color.getHexString(),original);
  const geometries=new Set(),materials=new Set(Object.values(material));
  for(const root of [visitor,milo])root.traverse(object=>{if(object.geometry)geometries.add(object.geometry);if(object.material)materials.add(object.material);});
  geometries.forEach(geometry=>geometry.dispose());materials.forEach(value=>value.dispose());
});

test('Curtis does not load at startup, loads once before his visit, and pauses with simulation time',async()=>{
  let calls=0,release;
  const c=new CurtisRoutine({random:()=>0,prepare:()=>{calls++;return new Promise(resolve=>release=resolve);}});
  c.update(0);c.update(CURTIS_TIMING.first[0]-CURTIS_TIMING.prepareAhead-1);
  assert.equal(calls,0);assert.equal(c.active,false);
  c.update(1);await Promise.resolve();assert.equal(calls,1);
  c.update(100);assert.equal(c.active,false);assert.equal(calls,1);
  release();await new Promise(resolve=>setImmediate(resolve));
  c.update(1/60);assert.equal(c.active,true);assert.equal(c.step.kind,'climb');
  const before=JSON.stringify({position:c.position,age:c.age,time:c.time});
  c.update(0);assert.equal(JSON.stringify({position:c.position,age:c.age,time:c.time}),before);
});

test('a visit descends, visits all four activities through the room portal, leaves, and returns later',()=>{
  for(const random of [()=>0,()=>.99]){
    const c=new CurtisRoutine({random,firstDelay:0});c.ready=true;
    const activities=new Set(),positions=[];
    for(let i=0;i<60000;i++){
      c.update(1/60);
      assert.ok(Object.values(c.position).every(Number.isFinite));assert.ok(Number.isFinite(c.walkDistance));
      if(c.step){activities.add(c.step.kind);positions.push({...c.position});}
      if(c.visits===1&&!c.active)break;
    }
    assert.equal(c.visits,1);assert.equal(c.active,false);assert.equal(c.ladderClaim,false);
    for(const a of ['climb','relax','brew','coffee','work','window'])assert.ok(activities.has(a),a);
    assert.ok(positions.some(p=>p.x===CURTIS.roomX&&p.z<-4));
    assert.equal(c.position.y,CURTIS.top);
    const until=c.due-c.time;assert.ok(until>=180-1e-9&&until<=360+1e-9);
    c.update(until-.01);assert.equal(c.active,false);c.update(.02);assert.equal(c.visits,2);
  }
});

test('Curtis waits for an occupied ladder and reserves it through his landing',()=>{
  const c=new CurtisRoutine({firstDelay:0});c.ready=true;
  const actor=new CrewMotion({floor:0,x:700});actor.goTo({floor:1,x:900});
  c.update(.1,{actor});assert.equal(c.waiting,true);assert.equal(c.ladderClaim,false);
  const droid={ladderClaim:true,ladderPath:{from:6.784,to:3.392}};
  c.update(.1,{droid});assert.equal(c.waiting,true);
  c.update(.1);assert.equal(c.ladderClaim,true);
  const passer=new CrewMotion({floor:1,x:760});passer.goTo({floor:1,x:600});
  assert.equal(c.blocksCrew(passer),true);
  passer.waitingForVisitor=true;
  const x=passer.x;advanceCabinTraffic(passer,{motion:{blocksCrew:()=>false},update(){}},.1);
  assert.equal(passer.x,x);
  for(let i=0;i<6000&&c.step.kind==='climb';i++)c.update(1/60);
  assert.equal(c.ladderClaim,true);
  for(let i=0;i<6000&&c.ladderClaim;i++)c.update(1/60);
  assert.equal(c.ladderClaim,false);assert.ok(Math.abs(c.position.x)>1.5);
});

test('droid does not take a shaft reserved by the visitor',()=>{
  const d=new DroidRoutine({care:new Supplies()});d.job='laundry';d.visitor={ladderClaim:true,ladderPath:{from:13.4,to:3.392}};
  d.steps=[{kind:'walk',ladderEntry:true,ladderPath:{from:6.784,to:3.392},duration:2}];
  d.update(.1);assert.equal(d.waiting,true);assert.equal(d.age,0);assert.equal(d.ladderClaim,false);
});

test('failed loading retries later, and disposing during a load cannot activate Curtis',async()=>{
  const oldWarn=console.warn;console.warn=()=>{};
  try{
    let calls=0;
    const c=new CurtisRoutine({firstDelay:0,prepare:async()=>{calls++;if(calls===1)throw Error('offline');}});
    c.update(.1);await new Promise(resolve=>setImmediate(resolve));
    assert.equal(c.active,false);assert.equal(c.loading,false);assert.equal(c.ready,false);
    c.update(24);assert.equal(calls,1);
    c.update(2);await new Promise(resolve=>setImmediate(resolve));assert.equal(calls,2);assert.equal(c.ready,true);
    let release;const pending=new CurtisRoutine({firstDelay:0,prepare:()=>new Promise(r=>release=r)});
    pending.update(.1);await Promise.resolve();pending.dispose();release();
    await new Promise(resolve=>setImmediate(resolve));pending.update(100);
    assert.equal(pending.ready,false);assert.equal(pending.active,false);
  }finally{console.warn=oldWarn;}
});

test('Curtis appearance stays behind a dynamic import, with no initial preload',()=>{
  const read=name=>fs.readFileSync(new URL('../src/'+name,import.meta.url),'utf8');
  assert.match(read('obs/view.js'),/await import\('\.\/curtis-view.js'\)/);
  assert.doesNotMatch(read('obs.html'),/curtis/);
  assert.doesNotMatch(read('obs/main.js'),/import .*from '\.\/curtis-(view|model).js'/);
  assert.ok(fs.existsSync(new URL('../public/assets/obs/curtis-space-print.png',import.meta.url)));
});
