import test from 'node:test';
import assert from 'node:assert/strict';
import {Raycaster,Vector3} from 'three';
import {createDroid} from '../src/obs/droid-model.js';
import {DroidRoutine} from '../src/obs/droid-routine.js';
import {Supplies} from '../src/obs/state.js';
import {PlantBed} from '../src/obs/plant-state.js';
import {CabinStartupLighting,STARTUP_TOTAL_SECONDS} from '../src/obs/startup-lighting.js';
import {createCabinToon} from '../src/obs/cabin-toon.js';

test('nixie faces, their soft halos and battery lamps stay self-lit independently of cabin startup in both models',()=>{
  for(const detail of ['study','obs']){
    const droid=createDroid({detail}),toon=createCabinToon([droid.root]),emission=new Map();
    toon.setStyle('cartoon');
    droid.root.traverse(o=>{
      if(o.isMesh&&/nixie cathode|nixie halo|tube illumination|four amber battery lamps/.test(o.material.name))emission.set(o.material,o.material.onBeforeCompile);
    });
    const inventory=()=>{const out=[];droid.root.traverse(o=>out.push([o.uuid,o.geometry?.uuid,o.material?.uuid,o.material?.map?.uuid]));return out;};
    const before=inventory(),effect=new CabinStartupLighting([droid.root],{waitForActivation:true});
    try{
      assert.equal(emission.size,detail==='obs'?2:4);
      assert.ok(effect.materials.length>0,'the opaque frame still receives cabin darkness');
      for(const [material,compile]of emission){
        assert.equal(material.userData.cabinAlwaysPowered,true);assert.equal(material.toneMapped,false);
        assert.equal(material.onBeforeCompile,compile,'no ceiling blackout shader on a self-lit face or gauge');
        assert.ok(!effect.materials.some(entry=>entry.material===material));
      }
      droid.face.setExpression('happy');droid.battery.setCharge(.5);
      effect.update(600);assert.equal(effect.time,0);
      assert.equal(droid.update(30,'idle').facePower,1);assert.equal(droid.battery.mesh.visible,true);
      const levels=()=>[...droid.battery.mesh.geometry.attributes.uv.array];const half=levels();
      effect.activate();effect.update(.1);effect.update(STARTUP_TOTAL_SECONDS);
      assert.equal(droid.update(30,'idle').facePower,1);assert.deepEqual(levels(),half);
      assert.equal(droid.update(0,'charging').facePower,0,'the droid still controls its own face power');
      assert.equal(droid.battery.mesh.visible,true,'charging gauge stays on even with the face off');
      assert.deepEqual(inventory(),before,'no extra lights, geometry, textures or draw objects');
    }finally{effect.dispose();toon.dispose();droid.dispose();}
  }
});

test('both chest indicators light four amber levels from the bottom with one reusable opaque quad',()=>{
  for(const detail of ['study','obs']){
    const droid=createDroid({detail}),battery=droid.battery,{mesh}=battery;
    const geometry=mesh.geometry,map=mesh.material.map,textureVersion=map.version;
    try{
      assert.equal(mesh.parent,droid.chassis);assert.equal(mesh.material.transparent,false);
      assert.equal(mesh.material.toneMapped,false);assert.equal(geometry.index.count,6);
      const origin=mesh.getWorldPosition(new Vector3()),direction=new Vector3(0,0,-1).transformDirection(mesh.matrixWorld);
      const support=new Raycaster(origin,direction,0,.001).intersectObject(droid.root,true).find(hit=>hit.object!==mesh);
      assert.ok(support&&support.distance<.0003,'display sits flush against its solid chassis mount');
      for(const level of [0,1,2,3,4,3,1,4]){
        battery.setCharge(level/4);assert.equal(battery.level,level);
        const uv=geometry.attributes.uv;
        for(let i=0;i<uv.count;i++)assert.equal(Math.floor(uv.getX(i)*8),level);
        for(let i=0;i<4;i++){
          const offset=((22+i*28)*256+level*32+16)*4;
          assert.equal(map.image.data[offset]>200,3-i<level,'lit bars fill upwards');
        }
        droid.update(3,'walk');droid.update(0,'charging');
        assert.equal(mesh.visible,true,'charge remains readable with the face powered down');
        assert.equal(mesh.geometry,geometry);assert.equal(mesh.material.map,map);assert.equal(map.version,textureVersion);
      }
      const version=geometry.attributes.uv.version;
      battery.setCharge(.8);assert.equal(geometry.attributes.uv.version,version,'no upload until a quarter boundary changes');
      assert.equal(battery.setCharge(NaN),false);assert.equal(battery.level,4);
      battery.setCharge(-1);assert.equal(battery.level,0);battery.setCharge(2);assert.equal(battery.level,4);
    }finally{droid.dispose();}
  }
});

test('remaining charge uses simulated elapsed time, pauses, and recharges only after docking',()=>{
  const make=()=>new DroidRoutine({care:new Supplies(),brain:{plants:new PlantBed()},actor:{x:1040},cat:{mode:'sleep'}});
  const a=make(),b=make();assert.ok(a.request('feed'));assert.ok(b.request('feed'));
  a.update(10);for(let i=0;i<100;i++)b.update(.1);
  assert.ok(Math.abs(a.battery-b.battery)<1e-10);assert.ok(a.battery<1);
  const paused=a.battery;a.update(0);assert.equal(a.battery,paused);assert.equal(a.pose.battery,paused);
  for(let i=0;i<10000&&!a.docked;i++)a.update(.1);
  assert.ok(a.docked);assert.ok(a.battery<paused);
  a.restUntil=Infinity;const before=a.battery;a.update(1);assert.ok(a.battery>before);
  a.update(45);assert.equal(a.battery,1);
});
