import test from 'node:test';
import assert from 'node:assert/strict';
import {MeshStandardMaterial} from 'three';
import {createMilo,animateMilo} from '../src/obs/characters.js';

const angle=delta=>Math.atan2(Math.sin(delta),Math.cos(delta));
test('dining turns directly toward the fixture from either side, never toward the camera',()=>{
  const material=new MeshStandardMaterial(),m=new Proxy({},{get:()=>material});
  for(const action of ['galley','hydro'])for(const facing of [-1,1])for(const exit of [-1,1]){
    const root=createMilo(m);root.rotation.y=facing*Math.PI/2;let travel=0,previous=root.rotation.y;
    for(let frame=0;frame<600;frame++){
      animateMilo(root,{action,moving:false,climbing:false,facing,time:frame/60,actionTime:frame/60,actionDuration:10});
      const delta=root.rotation.y-previous;assert.ok(delta*facing>=-1e-12);travel+=Math.abs(delta);previous=root.rotation.y;
      if(frame>100)assert.ok(Math.abs(angle(root.rotation.y-Math.PI))<.00001);
    }
    assert.ok(travel<=Math.PI/2+1e-10);
    animateMilo(root,{action:null,moving:false,climbing:false,facing,time:10});assert.equal(root.rotation.y,previous);
    const direction=Math.sign(angle(exit*Math.PI/2-root.rotation.y));travel=0;
    for(let frame=0;frame<120;frame++){
      animateMilo(root,{action:null,moving:true,climbing:false,facing:exit,time:10+frame/60,walkDistance:frame*.02});
      const delta=root.rotation.y-previous;assert.ok(delta*direction>=-1e-12);travel+=Math.abs(delta);previous=root.rotation.y;
    }
    assert.ok(travel<=Math.PI/2+1e-10);assert.ok(Math.abs(angle(root.rotation.y-exit*Math.PI/2))<1e-6);
  }
});
