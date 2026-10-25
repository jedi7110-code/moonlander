import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Scene,MeshStandardMaterial,Object3D,Vector3} from 'three';
import {createMilo} from '../src/obs/characters.js';
import {loadMiloBody} from '../src/obs/milo-body.js';
import {CurtisView} from '../src/obs/curtis-view.js';
import {CurtisRoutine} from '../src/obs/curtis-routine.js';

const bytes=await readFile(new URL('../public/assets/obs/milo/body.json',import.meta.url));
await loadMiloBody(`data:application/json;base64,${bytes.toString('base64')}`);

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
      if(step.kind==='brew'&&fraction===.5){
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
