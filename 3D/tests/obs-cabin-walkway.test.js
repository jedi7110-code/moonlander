import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {MeshStandardMaterial,Vector3} from 'three';
import {crewWalkway} from '../src/obs/cabin-walkway.js';
import {createMilo,animateMilo} from '../src/obs/characters.js';
import {loadMiloBody} from '../src/obs/milo-body.js';
import {applyCabinLadder} from '../src/obs/cabin-ladder.js';
import {FLOOR_Y,positionY} from '../src/obs/ship.js';
import {CrewMotion} from '../src/obs/state.js';
import {LADDER_X,ACCESS_LADDER} from '../src/obs/layout.js';

await loadMiloBody(`data:application/json;base64,${(await readFile(new URL('../public/assets/obs/milo/body.json',import.meta.url))).toString('base64')}`);
const material=new MeshStandardMaterial();
const create=()=>createMilo(new Proxy({},{get:()=>material}));
const sole=[[-.04,-.107,-.09],[.04,-.107,-.09],[-.055,-.107,.105],[.055,-.107,.105],[-.02,-.107,.175],[.02,-.107,.175]];

test('both boots cross the forward bridge rather than the open ladder shaft in either direction',()=>{
  for(const floor of [0,1,2])for(const facing of [-1,1]){
    const root=create();root.rotation.y=facing*Math.PI/2;
    for(let i=0;i<=240;i++){
      const x=facing*(-2.4+i*.02),path=crewWalkway(x,floor,facing);
      root.position.set(x,FLOOR_Y[floor],path.z);
      animateMilo(root,{moving:true,facing,walkYaw:path.yaw,time:i/60,dt:1/60,walkDistance:i*.02});
      root.updateMatrixWorld(true);
      for(const {boot}of root.userData.legs)for(const point of sole){
        const p=boot.localToWorld(new Vector3(...point));
        if(floor!==2&&Math.abs(p.x)<.565)assert.ok(p.z>ACCESS_LADDER.wellEdge+.007,`foot must be over the bridge: floor=${floor}, direction=${facing}, x=${p.x}, z=${p.z}`);
      }
    }
  }
});

test('climbing transfers join the walking bridge continuously without changing rung contacts',()=>{
  for(const [startFloor,endFloor]of [[2,1],[1,0],[0,2]]){
    const root=create(),startHeight=FLOOR_Y[startFloor],endHeight=FLOOR_Y[endFloor];
    const startDepth=crewWalkway(0,startFloor).z,endDepth=crewWalkway(0,endFloor).z;
    let previous;
    const actor=new CrewMotion({floor:startFloor,x:LADDER_X});actor.goTo({floor:endFloor,x:LADDER_X});
    for(let i=0;i<4000;i++){
      const height=positionY(actor.y);
      root.position.set(0,height,startDepth);animateMilo(root,{time:0,moving:false});
      const sample=applyCabinLadder(root,{height,startHeight,endHeight,startYaw:Math.PI/2,endYaw:-Math.PI/2,startDepth,endDepth});
      root.updateMatrixWorld(true);
      if(i===0)assert.equal(root.position.z,startDepth);
      if(sample.weight===1)for(const contact of sample.contacts){
        if(!contact.moving)assert.ok(Math.abs(root.localToWorld(contact.point.clone()).z-ACCESS_LADDER.depth)<1e-9,'held contacts remain on the rung plane');
      }
      const points=[root.userData.head,...root.userData.legs.map(leg=>leg.boot)].map(node=>node.getWorldPosition(new Vector3()));
      if(previous)points.forEach((p,j)=>assert.ok(p.distanceTo(previous[j])<.18,'no jump between the bridge and climbing'));
      previous=points;
      if(Math.abs(height-endHeight)<1e-9)break;
      actor.update(1/60);
    }
    assert.equal(root.position.y,endHeight);assert.equal(root.position.z,endDepth);
  }
});
