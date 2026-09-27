import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {Vector3} from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {CatMotion} from '../src/obs/state.js';
import {CAT_PORT,CABIN_AISLE} from '../src/obs/layout.js';
import {createLucy,animateLucy} from '../src/obs/lucy.js';

test('Lucy enters and exits at walking speed and keeps her full body inside the front wall',async()=>{
  const bytes=fs.readFileSync(new URL('../public/assets/obs/lucy/lucy-cabin.glb',import.meta.url));
  const gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
  const root=createLucy(gltf),p=new Vector3(),motion=new CatMotion({floor:0,x:CAT_PORT.x,turns:true});
  motion.goTo({floor:1,x:CAT_PORT.x+40});let entered=false,exited=false,maxZ=-Infinity;
  for(let i=0;i<55*60&&motion.busy;i++){
    const before=motion.z,phase=motion.portal?.phase;motion.update(1/60);
    if(phase==='enter'||phase==='exit'){
      assert.ok(Math.abs(motion.z-before)<=motion.walkSpeed*.022/60+1e-8,'no accelerated launch in a passage');
      if(phase==='enter')entered=true;else exited=true;
    }
    if(!motion.portal||motion.hidden||i%12)continue;
    root.position.set(0,0,motion.z);
    animateLucy(root,{time:i/60,dt:.1,moving:['enter','exit'].includes(motion.portal.phase),walkDistance:motion.portalWalkDistance,passage:motion.passagePose,headingControlled:true});
    root.traverse(mesh=>{
      if(!mesh.isSkinnedMesh)return;mesh.skeleton.update();
      for(let j=0;j<mesh.geometry.attributes.position.count;j++)maxZ=Math.max(maxZ,mesh.getVertexPosition(j,p).applyMatrix4(mesh.matrixWorld).z);
    });
  }
  assert.ok(entered&&exited);assert.ok(maxZ<CABIN_AISLE.deckFront-.12,`body crossed the front lining: ${maxZ}`);
  assert.equal(motion.busy,false);
});
