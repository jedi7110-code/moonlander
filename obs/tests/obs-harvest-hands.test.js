import test from 'node:test';
import assert from 'node:assert/strict';
import {MeshStandardMaterial,Scene,Vector3} from 'three';
import {createMilo,animateMilo} from '../src/obs/characters.js';
import {createHarvestDelivery,HARVEST_DOCK} from '../src/obs/harvest-delivery.js';

test('Milo grips both tray rims without pulling shoulders out of the torso and clears the worktop',()=>{
  const m=new Proxy({},{get:(o,k)=>o[k]??=new MeshStandardMaterial()}),root=createMilo(m),scene=new Scene();scene.add(root);
  const render=createHarvestDelivery(m,scene),brain={harvestDelivery:{phase:'placing',age:0,count:1},kitchenGreens:0};
  for(let frame=0;frame<=156;frame++){
    root.position.set(-10,0,.78);animateMilo(root,{dt:1/30,time:frame/30,moving:false,facing:-1,action:'plant',actionDuration:9,actionTime:0});root.rotation.y=Math.PI;
    brain.harvestDelivery.age=frame/30;render.update(root,brain);
    const {chest,arms}=root.userData;
    for(const r of arms){
      const shoulder=new Vector3(r.side*.207,1.488,0).applyMatrix4(chest.matrix);
      assert.ok(r.arm.position.distanceTo(shoulder)<1e-9,'IK must not translate the shoulder to fake reach');
      if(brain.harvestDelivery.age<=4.1){
        const palm=r.hand.localToWorld(new Vector3(0,-.085,0)),rim=render.root.localToWorld(new Vector3(r.side*.219,.06,0));
        assert.ok(palm.distanceTo(rim)<.004,`hand lost rim at ${frame/30}: ${palm.distanceTo(rim)}`);
      }
      assert.ok(r.arm.getWorldPosition(new Vector3()).distanceTo(r.elbow.getWorldPosition(new Vector3()))<.34);
    }
    if(render.root.position.z<.355)assert.ok(render.root.position.y>=1.041,'tray clears the counter while being lowered');
  }
  brain.harvestDelivery=null;brain.kitchenGreens=1;render.update(root,brain);
  assert.ok(render.root.position.distanceTo(HARVEST_DOCK)<1e-12);assert.equal(render.root.visible,true);
});
