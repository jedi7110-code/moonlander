import test from 'node:test';
import assert from 'node:assert/strict';
import {MeshStandardMaterial,Vector3} from 'three';
import {createMilo,animateMilo} from '../src/obs/characters.js';
const create=()=>createMilo(new Proxy({},{get:()=>new MeshStandardMaterial()}));
const pose=(root,options={})=>{
  animateMilo(root,{action:'lounge',moving:false,time:3,actionTime:3,...options});
  root.rotation.y=0;root.updateMatrixWorld(true);
};

test('all chair poses open the knees while ankles stay under the body and soles remain level',()=>{
  for(const action of ['lounge','console'])for(const leisure of [null,'tablet','music','cat']){
    const root=create();pose(root,{action,leisure});
    for(const {leg,knee,boot,side}of root.userData.legs){
      const hip=leg.getWorldPosition(new Vector3()),joint=knee.getWorldPosition(new Vector3()),ankle=boot.getWorldPosition(new Vector3());
      assert.ok(joint.x*side>.19&&joint.x*side<.25,'knees open naturally, not into a wide squat');
      assert.ok(Math.abs(ankle.x-side*.1)<1e-8,'ankles retain their original supported position');
      assert.ok(Math.abs(hip.distanceTo(joint)-.435)<1e-8);
      assert.ok(Math.abs(joint.distanceTo(ankle)-Math.hypot(.425,.013))<1e-8);
      const sole=boot.localToWorld(new Vector3(0,-.107,0)),toe=boot.localToWorld(new Vector3(0,-.107,.18));
      assert.ok(sole.y>=-.001&&sole.y<.04,'sole stays above the floor');
      assert.ok(Math.abs(sole.y-toe.y)<1e-8,'the sole is level');
      assert.ok((toe.x-sole.x)*side>0,'toes angle gently outward');
      assert.equal(knee.rotation.y,0);assert.equal(knee.rotation.z,0);
    }
  }
});

test('knee spread closes smoothly when standing and is restored smoothly on sitting',()=>{
  for(const transition of ['loungeEntry','loungeExit']){
    const root=create();let previous;
    const duration=transition==='loungeEntry'?2.4:2.8;
    for(let i=0;i<=Math.round(duration*60);i++){
      pose(root,{[transition]:{age:i/60}});
      const positions=root.userData.legs.map(({knee})=>knee.getWorldPosition(new Vector3()));
      if(previous)positions.forEach((p,j)=>assert.ok(p.distanceTo(previous[j])<.035));
      previous=positions;
    }
    const width=Math.abs(previous[0].x-previous[1].x);
    assert.ok(transition==='loungeEntry'?width>.38:Math.abs(width-.2)<1e-8);
  }
});

test('walking, climbing and lying down reset the seated leg rotation',()=>{
  for(const options of [{action:null,moving:true},{action:null,climbing:true},{action:'bunk'},{action:'medical'}]){
    const root=create(),fresh=create();pose(root);
    for(const model of [root,fresh])pose(model,options);
    root.userData.legs.forEach((rig,i)=>{
      for(const part of ['leg','knee','boot'])assert.deepEqual(rig[part].quaternion.toArray(),fresh.userData.legs[i][part].quaternion.toArray());
    });
  }
});
