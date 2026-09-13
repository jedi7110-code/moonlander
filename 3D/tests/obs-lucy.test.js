import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {Vector3} from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {createLucy,animateLucy,LUCY,LUCY_CLIPS} from '../src/obs/lucy.js';
import {CAT_BOWL} from '../src/obs/layout.js';

async function asset(file='../public/assets/obs/lucy/lucy-cabin.glb'){
  const bytes=fs.readFileSync(new URL(file,import.meta.url));
  return new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
}
function positions(root){
  root.updateMatrixWorld(true);const values=[],v=new Vector3();
  root.traverse(mesh=>{if(!mesh.isSkinnedMesh)return;mesh.skeleton.update();for(let i=0;i<mesh.geometry.attributes.position.count;i++){
    mesh.getVertexPosition(i,v).applyMatrix4(mesh.matrixWorld);values.push(v.clone());
  }});return values;
}
function joints(root){const a=[];root.traverse(b=>{if(b.isBone)a.push(...b.position.toArray(),...b.quaternion.toArray());});return a;}

test('Lucy loads the study surface with all cabin actions and no unweighted vertices',async()=>{
  const gltf=await asset(),cat=createLucy(gltf);
  assert.deepEqual(Object.keys(cat.userData.actions).sort(),[...LUCY_CLIPS].sort());
  let vertices=0;
  cat.traverse(mesh=>{if(!mesh.isSkinnedMesh)return;const a=mesh.geometry.attributes;vertices+=a.position.count;
    for(let i=0;i<a.position.count;i++)assert(Math.abs([0,1,2,3].reduce((s,c)=>s+a.skinWeight.getComponent(i,c),0)-1)<1e-5);
    assert.equal(mesh.material.clippingPlanes.length,1);assert.equal(mesh.frustumCulled,false);
    assert.notEqual(mesh.morphTargetDictionary.Blink,undefined);
  });
  assert.equal(vertices,15474);assert(positions(cat).every(p=>p.toArray().every(Number.isFinite)));
});

test('cabin export preserves every approved idle and walking animation sample',{
  skip:!fs.existsSync(new URL('../studies/lucy/local/lucy-combined.glb',import.meta.url))&&'Local Blender study export is not present',
},async()=>{
  const gltf=await asset(),study=await asset('../studies/lucy/local/lucy-combined.glb');
  const meshes={};gltf.scene.traverse(m=>{if(m.isMesh)meshes[m.material.name]=m;});
  study.scene.traverse(m=>{if(!m.isMesh)return;const current=meshes[m.material.name];assert(current);
    for(const attribute of ['position','color'])if(m.geometry.attributes[attribute])assert.deepEqual(current.geometry.attributes[attribute].array,m.geometry.attributes[attribute].array);
    // Blender recomputes split normals when adding the blink shape key.
    const normals=current.geometry.attributes.normal.array,original=m.geometry.attributes.normal.array;
    assert.equal(normals.length,original.length);
    assert(normals.every((value,i)=>Math.abs(value-original[i])<1e-4),'surface normals changed beyond export precision');
  });
  for(const clip of study.animations){const current=gltf.animations.find(c=>c.name===clip.name);assert(current);
    for(const track of clip.tracks){const other=current.tracks.find(t=>t.name===track.name);assert(other);assert.deepEqual(other.values,track.values);assert.deepEqual(other.times,track.times);}
  }
});

test('eating brings the nose over the food without entering the bowl',async()=>{
  const cat=createLucy(await asset());
  for(let frame=0;frame<=30;frame++){
    animateLucy(cat,{dt:.1,time:3+frame/10,mode:'eat',actionTime:3+frame/10,remaining:10,facing:1});
    const nose=new Vector3();let count=0;
    cat.traverse(m=>{if(m.material?.name!=='Muted pink nose')return;m.skeleton.update();for(let i=0;i<m.geometry.attributes.position.count;i++){const p=new Vector3();m.getVertexPosition(i,p).applyMatrix4(m.matrixWorld);nose.add(p);count++;}});
    nose.divideScalar(count);
    const bowlDistance=(CAT_BOWL.approachX-CAT_BOWL.x)*.022;
    assert(Math.abs(nose.x-bowlDistance)<.08,`nose misses the food: ${nose.x}`);
    assert(nose.y>CAT_BOWL.foodHeight-.015&&nose.y<CAT_BOWL.foodHeight+.025,`nose height: ${nose.y}`);
  }
});

test('walking follows actual distance, freezes on pause, and turns by the shortest angle',async()=>{
  const cat=createLucy(await asset(),{random:()=>0});
  animateLucy(cat,{time:0,dt:0,moving:true,walkDistance:0,facing:1});
  const distance=LUCY.stride*cat.scale.x*LUCY.modelScale*.25;
  animateLucy(cat,{time:1,dt:.02,moving:true,walkDistance:distance,facing:1});
  assert(Math.abs(cat.userData.actions.Walk.time-.3)<1e-6);
  const before=joints(cat),yaw=cat.rotation.y;
  animateLucy(cat,{time:5,dt:0,moving:true,walkDistance:999,facing:-1});
  assert.deepEqual(joints(cat),before);assert.equal(cat.rotation.y,yaw);
  cat.rotation.y=Math.PI-.01;
  animateLucy(cat,{time:2,dt:.01,passage:{yaw:-Math.PI+.01,crouch:1}});
  assert(cat.rotation.y>Math.PI-.01&&cat.rotation.y<Math.PI+.01);
});

test('rest transitions, grooming, play and jumps keep finite skin and clear the supporting surface',async()=>{
  const cat=createLucy(await asset(),{random:()=>.5}),minima={};let time=0;
  for(const mode of ['sleep','eat','look','groom','play']){
    cat.userData.initialized=false;let min=Infinity,maxStep=0,last=null,worst;
    for(let i=0;i<=120;i++){
      const age=i/10;time+=.1;
      animateLucy(cat,{time,dt:.1,mode,actionTime:age,remaining:Math.max(0,12-age),facing:1});
      const points=positions(cat);min=Math.min(min,...points.map(p=>p.y));
      if(last)points.forEach((p,index)=>{const d=p.distanceTo(last[index]);if(d>maxStep){maxStep=d;worst={age,index,from:last[index].toArray(),to:p.toArray()};}});last=points;
      assert(points.every(p=>p.toArray().every(Number.isFinite)));
      assert(Math.abs(Object.values(cat.userData.weights).reduce((a,b)=>a+b,0)-1)<1e-8);
    }
    minima[mode]=min;assert(min>-.001,`${mode} intersects the floor: ${min}`);assert(maxStep<.09,`${mode} snaps: ${maxStep} ${JSON.stringify(worst)}`);
  }
  for(const phase of ['prepare','flight','land'])for(let i=0;i<=20;i++){
    animateLucy(cat,{time:time+=.02,dt:.02,mode:'walk',moving:true,hop:{phase,age:i/20,duration:1,yaw:Math.PI/2}});
    assert(positions(cat).every(p=>p.y>-.001));
  }
});

test('the slept-in model closes its eyes and releases them on waking',async()=>{
  const cat=createLucy(await asset());
  animateLucy(cat,{time:3,dt:.05,mode:'sleep',actionTime:3,remaining:20});
  const eyes=[];cat.traverse(m=>{if(m.morphTargetDictionary?.Blink!==undefined)eyes.push(m);});
  assert(eyes.every(m=>m.morphTargetInfluences[m.morphTargetDictionary.Blink]===1));
  animateLucy(cat,{time:4,dt:.05,mode:'sleep',actionTime:4,remaining:0});
  assert(eyes.every(m=>m.morphTargetInfluences[m.morphTargetDictionary.Blink]<.01));
});
