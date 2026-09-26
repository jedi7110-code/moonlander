import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {Vector3} from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {createCabinLucy,animateCabinLucy,decodeGroomCache} from '../src/obs/lucy-cabin.js';
import {MouseChase,runCycle,RUN_STRIDE} from '../studies/lucy/chase-motion.js';
import {createLucyRunRig} from '../studies/lucy/run-rig.js';

test('a mouse on another floor never changes Lucy’s floor or starts a chase',()=>{
  const sim=new MouseChase({random:()=>.5});sim.appear(1);
  for(let i=0;i<900;i++){sim.update(1/60);assert.equal(sim.cat.floor,0);assert.equal(sim.cat.x,-3.65);assert.equal(sim.cat.speed,0);}
  assert.equal(sim.active,false);assert.equal(sim.mouse.visible,false);
});
test('same-floor pursuit accelerates, keeps clearance, brakes and returns to rare appearances',()=>{
  for(const direction of [-1,1]){
    const sim=new MouseChase({random:()=>.5,direction});sim.appear(0);let fastest=0,prior=0,travel=0;
    for(let i=0;i<900;i++){
      sim.update(1/60);const c=sim.cat;fastest=Math.max(fastest,c.speed);travel=c.distance;
      assert.ok(Math.abs(c.speed-prior)<=4.2/60+1e-9);prior=c.speed;
      assert.ok(Math.abs(c.x)<3.8);assert.equal(c.floor,0);
      if(c.speed>.1&&sim.mouse.visible)assert.ok((sim.mouse.x-c.x)*direction>.38,'no overlapping bodies');
    }
    assert.ok(fastest>1.4);assert.ok(travel>5);assert.equal(sim.cat.phase,'idle');assert.equal(sim.cat.speed,0);
    assert.equal(sim.events,1);assert.ok(sim.wait>60);
    const frozen=JSON.stringify(sim);sim.update(0);assert.equal(JSON.stringify(sim),frozen);
  }
});
test('gallop plants forefeet then hindfeet and stance cancels world travel',()=>{
  for(const [key,offset]of Object.entries({frontL:0,frontR:.08,rearR:.5,rearL:.58})){
    const a=runCycle(offset+.02).feet[key],b=runCycle(offset+.21).feet[key];
    assert.ok(a.planted&&b.planted);assert.equal(a.lift,0);assert.equal(b.lift,0);
    assert.ok(Math.abs((b.z-a.z)+RUN_STRIDE*.19)<1e-10);
  }
  for(const phase of [.38,.91])assert.ok(Object.values(runCycle(phase).feet).every(f=>!f.planted),'short suspension between pairs');
});
test('the actual Lucy rig keeps grounded feet low and leg endpoints connected through a gallop',async()=>{
  const read=name=>fs.readFileSync(new URL('../public/assets/obs/lucy/'+name,import.meta.url));
  const bytes=read('lucy-cabin.glb'),bin=read('lucy-groom.bin'),poses=JSON.parse(read('lucy-approved.json'));
  const gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
  const root=createCabinLucy({gltf,poses,cache:decodeGroomCache(bin.buffer.slice(bin.byteOffset,bin.byteOffset+bin.byteLength),poses.groom)},{random:()=>.5}),rig=createLucyRunRig(root);
  const p=new Vector3();let maxGap=0,minSole=Infinity;
  for(let i=0;i<=120;i++){
    animateCabinLucy(root,{dt:1/60,time:0,mode:'idle',yaw:0,headingControlled:true});
    const state=rig.update({distance:i/120*RUN_STRIDE,speed:1.65,weight:1});
    root.userData.cabin.coat.skeleton.update();
    for(const f of rig.feet){
      const end=root.getObjectByName('Lucy contact '+(f.rear?'feet_':'paw3_')+f.side);
      maxGap=Math.max(maxGap,end.getWorldPosition(new Vector3()).distanceTo(f.paw.getWorldPosition(new Vector3())));
      for(const index of f.vertices){
        const y=root.userData.cabin.coat.getVertexPosition(index,p).applyMatrix4(root.userData.cabin.coat.matrixWorld).y;
        assert.ok(Number.isFinite(y));minSole=Math.min(minSole,y);
        if(state.feet[f.key].planted)assert.ok(y<.09,'stance toes remain near the deck');
      }
    }
  }
  assert.ok(maxGap<.012,`foot / leg separation ${maxGap}`);
  assert.ok(minSole>-.012,`lowest sole ${minSole}`);
});
