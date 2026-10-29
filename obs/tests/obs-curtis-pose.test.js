import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Scene,MeshStandardMaterial,Object3D,Vector3} from 'three';
import {createMilo} from '../src/obs/characters.js';
import {loadMiloBody} from '../src/obs/milo-body.js';
import {CurtisView} from '../src/obs/curtis-view.js';
import {CurtisRoutine} from '../src/obs/curtis-routine.js';
import {CURTIS_COFFEE} from '../src/obs/curtis-coffee.js';
import {mouthPosition} from '../src/obs/dining.js';

const bytes=await readFile(new URL('../public/assets/obs/milo/body.json',import.meta.url));
await loadMiloBody(`data:application/json;base64,${bytes.toString('base64')}`);

test('the visitor prepares ladder geometry and contact caches before appearing without advancing his live visit',()=>{
  const root=createMilo(new Proxy({},{get:(o,k)=>o[k]??=new MeshStandardMaterial()}));
  const scene=new Scene(),view={scene,ship:{coffeeMug:new Object3D()},width:1200,height:800};scene.add(root);
  const visitor=new CurtisView(root,view);visitor.toon={update(){},dispose(){}};
  const live=new CurtisRoutine({random:()=>0}),due=live.due;
  try{
    visitor.prepareLadderPose();
    assert.equal(root.visible,false);assert.equal(visitor.stream.visible,false);
    const fit=root.userData.ladderHandFit;assert.ok(fit.geometry);assert.ok(fit.watch);
    assert.equal(fit.corrections.size,2);assert.equal(typeof fit.updateContactNormals,'function');
    assert.equal(live.active,false);assert.equal(live.time,0);assert.equal(live.due,due);
    live.active=true;live.position={x:0,y:13.4,z:.23};live.climbTo(1,{enter:true});
    visitor.render(live,1/60);assert.equal(root.visible,true);assert.equal(root.userData.ladderHandFit,fit);
    root.traverse(node=>assert.ok(node.matrixWorld.elements.every(Number.isFinite),node.name));
  }finally{visitor.dispose();}
});

test('visit poses use the real body rig, remain finite, and restore the parked mug',()=>{
  const root=createMilo(new Proxy({},{get:(o,k)=>o[k]??=new MeshStandardMaterial()}));
  const scene=new Scene();scene.add(root);
  const view={scene,ship:{coffeeMug:new Object3D()},width:1200,height:800};
  const visitor=new CurtisView(root,view);visitor.toon={update(){},dispose(){}};
  const routine=new CurtisRoutine({random:()=>0});routine.ready=true;routine.beginVisit();
  const visited=new Set();
  for(const step of [...routine.steps]){
    if(step.kind==='walk'&&visited.has('walk'))continue;
    routine.steps=[step];
    for(const fraction of [.01,.5,.99]){
      routine.age=step.duration*fraction;
      routine.position=Object.fromEntries(['x','y','z'].map(key=>[key,step.from[key]+(step.to[key]-step.from[key])*fraction]));
      visitor.render(routine,1/60);
      if(step.kind==='coffee'&&fraction===.01){
        routine.age=CURTIS_COFFEE.button;visitor.render(routine,1/60);
        const rig=root.userData.arms[0];
        const fingers=new Vector3(0,-1,0).applyQuaternion(rig.hand.quaternion);
        assert.ok(fingers.dot(rig.hand.position.clone().normalize())>.9999,'pressing wrist stays aligned with forearm');
      }
      if(['sit','stand','relax'].includes(step.kind)){
        assert.equal(root.position.x,6.05,'seating never shuffles sideways');
        for(const {arm,elbow}of root.userData.arms){
          assert.ok(arm.rotation.x>=-.151,'hands stay lowered');
          assert.ok(elbow.rotation.x>=-.651,'no tabletop hand lift');
        }
      }
      root.traverse(node=>assert.ok(node.matrixWorld.elements.every(Number.isFinite),`${step.kind}: ${node.name}`));
      if(step.kind==='coffee'){
        assert.equal(view.ship.coffeeMug.visible,false);assert.equal(root.userData.dining.mug.visible,true);
      }
      if(step.kind==='work')assert.equal(root.userData.leisure.tablet.visible,true);
    }
    visited.add(step.kind);
  }
  routine.active=false;visitor.render(routine,0);
  assert.equal(root.visible,false);assert.equal(view.ship.coffeeMug.visible,true);
  visitor.dispose();
});

test('coffee keeps the same cup and grip through extraction, drinking and returning it',()=>{
  const root=createMilo(new Proxy({},{get:(object,key)=>object[key]??=new MeshStandardMaterial()}));
  const scene=new Scene();scene.add(root);root.rotation.y=Math.PI;
  const view={scene,ship:{coffeeMug:new Object3D()},width:1200,height:800};
  const visitor=new CurtisView(root,view);visitor.toon={update(){},dispose(){}};
  const routine=new CurtisRoutine();routine.active=true;routine.position={x:10.085,y:3.392,z:-.38};routine.hold('coffee',CURTIS_COFFEE.duration);
  const sample=time=>{
    routine.age=routine.time=time;visitor.render(routine,0);
    return{cup:root.userData.dining.mug.getWorldPosition(new Vector3()),hand:root.userData.arms[1].hand.getWorldPosition(new Vector3()),rotation:root.userData.arms[1].hand.getWorldQuaternion(root.quaternion.clone())};
  };
  try{
    sample(0);assert.ok(root.userData.dining.mug.getWorldPosition(new Vector3()).distanceTo(visitor.cupHome)<1e-8);
    const before=sample(CURTIS_COFFEE.drinkStart-.0001),after=sample(CURTIS_COFFEE.drinkStart+.0001);
    assert.ok(before.cup.distanceTo(after.cup)<1e-5,'no cup teleport between brewing and drinking');
    assert.ok(before.hand.distanceTo(after.hand)<1e-5,'no release and second reach');
    assert.ok(before.rotation.angleTo(after.rotation)<1e-4,'the wrist never resets at the old section boundary');
    for(let frame=0;frame<=CURTIS_COFFEE.duration*30;frame++){
      const age=frame/30;sample(age);
      assert.equal(root.userData.dining.mug.visible,true);assert.equal(view.ship.coffeeMug.visible,false);
      assert.equal(visitor.stream.visible,age>=CURTIS_COFFEE.pourStart&&age<CURTIS_COFFEE.pourEnd);
    }
    sample(CURTIS_COFFEE.drinkStart+(CURTIS_COFFEE.duration-CURTIS_COFFEE.drinkStart)*(.5-.15)/.85);
    const lip=root.userData.body.localToWorld(mouthPosition(root.userData.head));
    const rim=root.userData.dining.mug.localToWorld(new Vector3(0,.067,-.043));assert.ok(rim.distanceTo(lip)<.007);
    sample(CURTIS_COFFEE.duration);assert.ok(root.userData.dining.mug.getWorldPosition(new Vector3()).distanceTo(visitor.cupHome)<1e-8);
  }finally{visitor.dispose();}
});
