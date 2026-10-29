import test from 'node:test';
import assert from 'node:assert/strict';
import {BoxGeometry,Group,Matrix4,Mesh,MeshStandardMaterial,PerspectiveCamera,Scene,SphereGeometry} from 'three';
import {FixtureInstances} from '../src/obs/fixture-instances.js';

function fixture(){
  const scene=new Scene(),animated=new Group(),camera=new PerspectiveCamera();scene.add(animated);
  const geometry=new BoxGeometry(.1,.1,.1),other=new SphereGeometry(.05),material=new MeshStandardMaterial();
  const add=(parent,{geometry:g=geometry,castShadow=true,receiveShadow=true,x=0,layer=null}={})=>{
    const mesh=new Mesh(g,material);mesh.castShadow=castShadow;mesh.receiveShadow=receiveShadow;mesh.position.set(x,x*.5,-x);mesh.rotation.y=x;
    if(layer!==null)mesh.layers.set(layer);parent.add(mesh);return mesh;
  };
  const rack=new Group();rack.position.set(2,1,0);animated.add(rack);
  const hidden=new Group();hidden.visible=false;rack.add(hidden);
  const shadowed=[add(rack,{x:.1}),add(rack,{x:.2}),add(rack,{x:.3}),add(hidden,{x:.4})];
  const sideLayer=add(rack,{x:.5,layer:2});
  const plain=[add(rack,{x:.6,castShadow:false}),add(rack,{x:.7,castShadow:false}),add(rack,{x:.8,castShadow:false})];
  const unlit=add(rack,{x:.85,receiveShadow:false});
  const pair=[add(rack,{geometry:other}),add(rack,{geometry:other})];
  const hooked=add(rack,{x:.9});hooked.onBeforeRender=()=>{};
  return {scene,animated,camera,rack,hidden,shadowed,sideLayer,plain,unlit,pair,hooked,material};
}

test('repeated fittings share one instanced draw per geometry, material, receiver flag and layer',()=>{
  const f=fixture(),instances=new FixtureInstances(f.animated,f.scene);
  assert.equal(instances.batches.length,1);
  const [batch]=instances.batches;
  assert.deepEqual(new Set(batch.sources),new Set([...f.shadowed,...f.plain]));
  assert.equal(batch.mesh.castShadow,true,'a batch with any caster is prepared for the shadow pass');
  assert.equal(batch.mesh.userData.mayCastShadow,true);assert.equal(batch.mesh.receiveShadow,true);
  assert.ok(batch.mesh.visible,'visible so the startup compile prepares the instanced programs');
  assert.equal(batch.mesh.parent,f.scene);assert.equal(instances.instancedMeshes,7);
  assert.equal(batch.mesh.count,0,'nothing is drawn before a frame copies matrices in');
  assert.ok(!batch.sources.some(source=>[f.sideLayer,f.hooked,f.unlit,...f.pair].includes(source)));
});

test('each frame copies world matrices, hides exactly the instanced sources and restores them afterwards',()=>{
  const f=fixture(),instances=new FixtureInstances(f.animated,f.scene);
  const [batch]=instances.batches;
  f.rack.rotation.z=.4;f.scene.updateMatrixWorld();
  instances.beginFrame(f.camera);
  assert.equal(batch.mesh.count,3,'the hidden source and the non-casters are skipped');
  assert.equal(batch.mesh.castShadow,true);
  const matrix=new Matrix4(),visible=batch.sources.filter(source=>f.shadowed.includes(source)&&source!==f.shadowed[3]);
  assert.equal(visible.length,3);
  for(const [i,source] of visible.entries()){
    batch.mesh.getMatrixAt(i,matrix);
    // Instance matrices live in a Float32Array, like the uniform the plain draw uploads.
    for(let k=0;k<16;k++)assert.ok(Math.abs(matrix.elements[k]-source.matrixWorld.elements[k])<1e-6,`element ${k}`);
    assert.equal(source.layers.mask,0,'instanced sources are hidden from every pass');
  }
  assert.equal(f.shadowed[3].layers.mask,1);assert.equal(f.sideLayer.layers.mask,1<<2);
  for(const source of f.plain)assert.equal(source.layers.mask,1,'sources with the other caster flag draw themselves');
  assert.ok(batch.mesh.instanceMatrix.version>0,'the matrices are re-uploaded');
  instances.endFrame();
  for(const source of [...f.shadowed,...f.plain])assert.equal(source.layers.mask,1);
  assert.equal(batch.mesh.visible,true);
  // When the casters disappear the batch follows the remaining sources' flag.
  for(const source of f.shadowed)source.visible=false;
  f.plain[1].geometry=f.pair[0].geometry;
  instances.beginFrame(f.camera);
  assert.equal(batch.mesh.count,2,'a source with a replaced geometry draws itself');assert.equal(f.plain[1].layers.mask,1);
  f.plain[1].geometry=batch.geometries[batch.sources.indexOf(f.plain[1])];instances.endFrame();instances.beginFrame(f.camera);
  assert.equal(batch.mesh.count,3);assert.equal(batch.mesh.castShadow,false);
  for(const source of f.plain)assert.equal(source.layers.mask,0);
  instances.endFrame();
});

test('sources whose material or flags diverge keep their own draw, and disabling restores the plain render',()=>{
  const f=fixture(),instances=new FixtureInstances(f.animated,f.scene);
  const [batch]=instances.batches;
  const toon=new MeshStandardMaterial();f.shadowed[1].material=toon;
  instances.beginFrame(f.camera);
  assert.equal(batch.mesh.count,2);assert.equal(f.shadowed[1].layers.mask,1,'a differently styled source draws itself');
  instances.endFrame();
  for(const source of [...f.shadowed,...f.plain])source.material=toon;
  instances.beginFrame(f.camera);
  assert.equal(batch.mesh.material,toon,'a style swap on every source moves the batch with them');assert.equal(batch.mesh.count,3);
  instances.endFrame();
  f.shadowed[2].castShadow=false;
  instances.beginFrame(f.camera);assert.equal(batch.mesh.count,2);instances.endFrame();
  instances.enabled=false;
  instances.beginFrame(f.camera);
  assert.ok(instances.batches.every(({mesh})=>!mesh.visible));
  assert.ok([...f.shadowed,...f.plain].every(source=>source.layers.mask===1));
  instances.endFrame();
  assert.ok(instances.batches.every(({mesh})=>mesh.visible));
  instances.dispose();
  assert.ok(instances.batches.length===0&&!f.scene.children.some(child=>child.isInstancedMesh));
});
