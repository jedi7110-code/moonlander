import test from 'node:test';
import assert from 'node:assert/strict';
import {BoxGeometry,Group,Mesh,MeshBasicMaterial,PerspectiveCamera,PlaneGeometry,Scene,Vector3,Vector4} from 'three';
import {createCabinMirror,createMirrorProjection,isMiloMirrorView,mirrorTargetSize,MIRROR_BUDGET} from '../src/obs/cabin-mirror.js';
import {batchStatic} from '../src/obs/materials.js';

function setup(){
  const mirror=createCabinMirror(),scene=new Scene(),camera=new PerspectiveCamera(62,16/9,.025,100);
  scene.add(mirror);mirror.visible=true;scene.updateMatrixWorld(true);
  camera.position.set(.17,.1,1);camera.lookAt(0,0,0);camera.updateMatrixWorld(true);
  let current=null,renders=0,resizes=0;
  mirror.getRenderTarget().addEventListener('dispose',()=>resizes++);
  const renderer={xr:{enabled:true,isPresenting:false},shadowMap:{autoUpdate:true},capabilities:{maxSamples:4},autoClear:true,
    getDrawingBufferSize(out){return out.set(1280,720);},getRenderTarget:()=>current,setRenderTarget:target=>current=target,
    state:{buffers:{depth:{setMask(){}}},viewport(){}},render(_scene,reflected){renders++;_scene.onBeforeRender(renderer,_scene,reflected);renderer.check?.(reflected);}};
  return {mirror,scene,camera,renderer,get renders(){return renders;},get resizes(){return resizes;},draw(){mirror.onBeforeRender(renderer,scene,camera);}};
}

test('live reflections are confined to Milo first person, not following, overview, other actors or XR',()=>{
  assert.equal(isMiloMirrorView({active:true,selected:'milo'}),true);
  for(const camera of [undefined,{active:false,selected:'milo'},{active:true,selected:null},{active:true,selected:'cat'},{active:true,selected:'droid'}])assert.equal(isMiloMirrorView(camera),false);
  assert.equal(isMiloMirrorView({active:true,selected:'milo'},true),false);
});

test('resolution tracks projected size with hard Retina, pixel and long-edge caps',()=>{
  assert.deepEqual(mirrorTargetSize(128,192),{width:128,height:192});
  for(const [width,height]of [[256,320],[1920,1080],[4000,4000],[20,8000],[8000,20],[2,2]]){
    const size=mirrorTargetSize(width,height);
    assert.ok(size.width<=MIRROR_BUDGET.maxEdge&&size.height<=MIRROR_BUDGET.maxEdge);
    assert.ok(size.width*size.height<=MIRROR_BUDGET.maxPixels);
    assert.ok(size.width>=32&&size.height>=32);
  }
});

test('capture excludes back-facing/offscreen mirrors but clips visible edges at the near plane',()=>{
  const mirror=new Mesh(new PlaneGeometry(.72,.89)),camera=new PerspectiveCamera(65,1,.05,50),project=createMirrorProjection();
  mirror.updateMatrixWorld();camera.position.z=1;camera.updateMatrixWorld();
  assert.ok(project(mirror,camera,1000,1000));
  camera.lookAt(0,0,2);camera.updateMatrixWorld();assert.equal(project(mirror,camera,1000,1000),null);
  camera.position.z=-1;camera.lookAt(0,0,0);camera.updateMatrixWorld();assert.equal(project(mirror,camera,1000,1000),null);
  camera.position.set(.35,0,.07);camera.lookAt(-.3,0,0);camera.updateMatrixWorld();
  const edge=project(mirror,camera,1000,1000);assert.ok(edge);assert.ok(Object.values(edge).every(Number.isFinite));
  assert.ok(edge.left>=-1&&edge.right<=1&&edge.bottom>=-1&&edge.top<=1);
  mirror.geometry.dispose();mirror.material.dispose();
});

test('cropped capture keeps reflected UVs aligned, clips behind the glass, and leaves POV projection untouched',()=>{
  const s=setup(),projection=s.camera.projectionMatrix.clone(),inverse=s.camera.projectionMatrixInverse.clone();
  s.renderer.check=reflected=>{
    assert.equal(s.mirror.visible,false,'no recursive reflection');
    assert.equal(s.renderer.shadowMap.autoUpdate,false,'do not re-render shadow maps');
    assert.equal(s.renderer.xr.enabled,false);
    assert.equal(s.scene.matrixWorldAutoUpdate,false,'reuse matrices from the outer render');
    for(const point of [new Vector3(0,0,0),new Vector3(-.22,.27,0),new Vector3(.25,-.29,0)]){
      const uv=new Vector4(...point.toArray(),1).applyMatrix4(s.mirror.material.uniforms.textureMatrix.value);
      const ndc=point.clone().project(reflected);
      assert.ok(Math.abs(uv.x/uv.w-(ndc.x+1)/2)<1e-7);
      assert.ok(Math.abs(uv.y/uv.w-(ndc.y+1)/2)<1e-7);
      assert.ok(uv.x/uv.w>=0&&uv.x/uv.w<=1&&uv.y/uv.w>=0&&uv.y/uv.w<=1);
    }
    assert.ok(new Vector3(0,0,-.1).project(reflected).z<-1,'objects behind the mirror plane are clipped');
    assert.ok(new Vector3(0,0,.1).project(reflected).z>-1,'the reflected face stays visible');
  };
  s.draw();assert.equal(s.renders,1);assert.equal(s.mirror.getRenderTarget().samples,2);
  assert.deepEqual(s.camera.projectionMatrix,projection);assert.deepEqual(s.camera.projectionMatrixInverse,inverse);
  assert.equal(s.renderer.getRenderTarget(),null);assert.equal(s.renderer.shadowMap.autoUpdate,true);assert.equal(s.renderer.xr.enabled,true);
  assert.equal(s.scene.matrixWorldAutoUpdate,true);
  const allocations=s.resizes;for(let i=0;i<12;i++)s.draw();assert.equal(s.resizes,allocations,'steady view does not allocate targets per frame');
  s.mirror.dispose();s.mirror.geometry.dispose();
});

test('hidden and XR mirrors perform zero reflection renders, and failures restore renderer state',()=>{
  const s=setup();s.mirror.visible=false;s.draw();assert.equal(s.renders,0);
  s.mirror.visible=true;s.renderer.xr.isPresenting=true;s.draw();assert.equal(s.renders,0);
  s.renderer.xr.isPresenting=false;s.renderer.capabilities.maxSamples=0;
  s.renderer.check=()=>{throw new Error('test render failure');};
  assert.throws(()=>s.draw(),/test render failure/);
  assert.equal(s.mirror.getRenderTarget().samples,0);assert.equal(s.mirror.visible,true);
  assert.equal(s.renderer.getRenderTarget(),null);assert.equal(s.renderer.shadowMap.autoUpdate,true);assert.equal(s.renderer.xr.enabled,true);
  s.mirror.dispose();s.mirror.geometry.dispose();
});

test('reflection selects only in-frustum fixtures and restores full batches even after a render failure',()=>{
  const s=setup(),parts=new Group(),geometry=new BoxGeometry(.1,.1,.1),material=new MeshBasicMaterial();
  for(const [x,y,z] of [[0,0,.2],[20,0,.2],[0,0,-1]]){
    const part=new Mesh(geometry,material);part.position.set(x,y,z);parts.add(part);
  }
  const root=batchStatic(parts),mesh=root.children[0],original=mesh.geometry;
  s.scene.add(root);s.scene.updateMatrixWorld(true);
  let sceneCalls=0;const sceneHook=()=>sceneCalls++;s.scene.onBeforeRender=sceneHook;
  s.renderer.check=()=>{
    assert.notEqual(mesh.geometry,original);
    assert.equal(mesh.geometry.attributes.position,original.attributes.position,'share the actual vertex buffer');
    assert.equal(mesh.geometry.drawRange.count,36,'no other room or behind-mirror geometry');
    assert.deepEqual(Array.from(mesh.geometry.index.array.slice(0,36)),Array.from(original.index.array.slice(0,36)));
  };
  s.draw();assert.equal(mesh.geometry,original);assert.equal(sceneCalls,1);assert.equal(s.scene.onBeforeRender,sceneHook);
  const uploads=s.mirror.userData.mirrorQuality.batches.indexUploads;
  s.draw();assert.equal(s.mirror.userData.mirrorQuality.batches.indexUploads,uploads,'stable captures reuse their index buffer');
  s.renderer.check=()=>{throw Error('filtered capture failed');};
  assert.throws(()=>s.draw(),/filtered capture failed/);
  assert.equal(mesh.geometry,original);assert.equal(mesh.visible,true);assert.equal(s.scene.onBeforeRender,sceneHook);
  assert.equal(s.scene.matrixWorldAutoUpdate,true);
  s.mirror.dispose();s.mirror.geometry.dispose();original.dispose();geometry.dispose();material.dispose();
});
