import test from 'node:test';
import assert from 'node:assert/strict';
import {AlwaysStencilFunc,Color,EqualStencilFunc,KeepStencilOp,Mesh,MeshBasicMaterial,NotEqualStencilFunc,PerspectiveCamera,Plane,PlaneGeometry,ReplaceStencilOp,Scene,Vector3,Vector4,ZeroStencilOp} from 'three';
import {createDirectMirror,createDirectMirrorCamera,directMirrorStencil} from '../studies/milo/direct-mirror.js';

test('direct reflected view agrees with a mirrored world, without a texture or horizontal-image mistake',()=>{
  const mirror=new Mesh(new PlaneGeometry(.72,.89)),source=new PerspectiveCamera(60,1.7,.025,150),rig=createDirectMirrorCamera();
  for(const turn of [0,Math.PI/2,.35]){
    mirror.position.set(2,3,-1);mirror.rotation.y=turn;mirror.updateMatrixWorld();
    source.position.copy(mirror.localToWorld(new Vector3(.17,.1,1.4)));source.lookAt(mirror.position);source.updateMatrixWorld();
    const projection=source.projectionMatrix.clone(),reflected=rig.update(mirror,source);
    const normal=new Vector3(0,0,1).transformDirection(mirror.matrixWorld),plane=new Plane().setFromNormalAndCoplanarPoint(normal,mirror.position);
    assert.ok(reflected.matrixWorld.determinant()<0,'camera has reflected handedness');
    for(const local of [new Vector3(-.22,.17,.5),new Vector3(.23,-.21,.9),new Vector3(.1,0,0)]){
      const point=mirror.localToWorld(local),virtual=point.clone().addScaledVector(normal,-2*plane.distanceToPoint(point)).project(source);
      const actual=point.clone().project(reflected);
      assert.ok(Math.abs(virtual.x-actual.x)<1e-8);assert.ok(Math.abs(virtual.y-actual.y)<1e-8);
    }
    assert.ok(mirror.localToWorld(new Vector3(0,0,-.1)).project(reflected).z<-1);
    assert.ok(mirror.localToWorld(new Vector3(0,0,.1)).project(reflected).z>-1);
    assert.deepEqual(source.projectionMatrix,projection);
  }
  mirror.geometry.dispose();mirror.material.dispose();
});

test('aperture stencil retains character fill and ink tests without changing materials',()=>{
  const plain=new MeshBasicMaterial(),fill=new MeshBasicMaterial({stencilWrite:true,stencilRef:1,stencilFunc:AlwaysStencilFunc,stencilZPass:ReplaceStencilOp});
  const ink=new MeshBasicMaterial({stencilWrite:true,stencilRef:1,stencilFunc:NotEqualStencilFunc,stencilWriteMask:0});
  assert.deepEqual(directMirrorStencil(plain),{ref:128,mask:128,writeMask:0,pass:KeepStencilOp});
  assert.deepEqual(directMirrorStencil(fill),{ref:129,mask:128,writeMask:1,pass:ReplaceStencilOp});
  assert.deepEqual(directMirrorStencil(ink),{ref:128,mask:129,writeMask:0,pass:KeepStencilOp});
  for(const surface of [plain,fill,ink]){
    const gate=directMirrorStencil(surface);
    for(const outside of [0,1])assert.notEqual(outside&gate.mask,gate.ref&gate.mask);
    assert.equal(gate.writeMask&128,0,'drawing never erases the aperture bit');
  }
  assert.equal(fill.stencilWriteMask,255);assert.equal(ink.stencilFunc,NotEqualStencilFunc);
  for(const m of [plain,fill,ink])m.dispose();
});

function setup(){
  const mirror=createDirectMirror(),scene=new Scene(),camera=new PerspectiveCamera(62,16/9,.025,100);
  scene.background=new Color(0x142028);scene.add(mirror);mirror.visible=true;scene.updateMatrixWorld(true);
  camera.position.z=1;camera.updateMatrixWorld();
  const calls=[],scissor=new Vector4(2,3,1280,720),originalScissor=scissor.clone();let scissorTest=false;
  const stencil={setMask(...args){calls.push(['mask',...args]);},setTest(...args){calls.push(['test',...args]);},setFunc(...args){calls.push(['func',...args]);},setOp(...args){calls.push(['op',...args]);},setClear(){}};
  const state={buffers:{stencil},setMaterial(_surface,frontFaceCW){calls.push(['winding',frontFaceCW]);}};
  const renderer={xr:{enabled:true,isPresenting:false},shadowMap:{autoUpdate:true},autoClear:true,state,
    getContext:()=>({EQUAL:EqualStencilFunc,KEEP:KeepStencilOp,SAMPLES:0x80a9,getParameter:()=>{calls.push(['capability']);return 4;}}),
    getDrawingBufferSize:out=>out.set(2560,1440),getPixelRatio:()=>2,getScissor:out=>out.copy(scissor),
    getScissorTest:()=>scissorTest,setScissorTest:value=>scissorTest=value,
    setScissor(x,y,z,w){if(x.isVector4)scissor.copy(x);else scissor.set(x,y,z,w);},
    clear(...args){calls.push(['clear',...args]);},
    render(target,view){
      calls.push(['render',target]);
      const mask=target.children[0]?.material;
      if(target!==scene&&mask?.colorWrite===false&&mask.depthWrite){
        assert.equal(mask.stencilFunc,EqualStencilFunc);assert.equal(mask.stencilWriteMask,255);
        assert.equal(mask.stencilZPass,ZeroStencilOp,'remove reflected ink bits before the normal foreground');
      }
      if(target===scene){
        assert.notEqual(view,camera,'Milo self-head mask is not active for reflection');
        assert.equal(target.background,null,'a colour background must not force-clear the main framebuffer');
        assert.equal(mirror.visible,false);assert.equal(renderer.autoClear,false);assert.equal(renderer.shadowMap.autoUpdate,false);
        state.setMaterial(new MeshBasicMaterial(),false);renderer.check?.();
      }
    },
  };
  return {mirror,scene,camera,renderer,calls,scissor,originalScissor,setMaterial:state.setMaterial,draw:()=>mirror.renderReflection(renderer,scene,camera)};
}

test('direct pass uses the main framebuffer, scissored aperture and shared scene; restores state after success/error',()=>{
  const s=setup(),background=s.scene.background;
  assert.equal(s.mirror.getRenderTarget,undefined,'no reflection texture allocation');
  assert.ok(s.mirror.renderOrder<0,'render before foreground watch decals, ink and transparent surfaces');
  assert.equal(s.mirror.material.depthWrite,true,'seal the real aperture before the main scene renders');
  assert.equal(s.draw(),true);
  assert.equal(s.calls.filter(c=>c[0]==='render').length,4,'mask, masked depth clear, reflection, physical depth');
  assert.deepEqual(s.calls.find(c=>c[0]==='clear'),['clear',false,false,true],'never clear the main colour/depth buffer');
  assert.deepEqual(s.calls.find(c=>c[0]==='winding'),['winding',true]);
  assert.equal(s.mirror.userData.mirrorQuality.samples,4);
  for(const fail of [false,true]){
    s.renderer.check=fail?()=>{throw Error('reflection failed');}:null;
    if(fail)assert.throws(s.draw,/reflection failed/);else s.draw();
    assert.equal(s.renderer.state.setMaterial,s.setMaterial);assert.equal(s.renderer.autoClear,true);
    assert.equal(s.scene.background,background);assert.equal(s.scene.matrixWorldAutoUpdate,true);
    assert.equal(s.renderer.xr.enabled,true);assert.equal(s.renderer.shadowMap.autoUpdate,true);
    assert.equal(s.renderer.getScissorTest(),false);assert.deepEqual(s.scissor,s.originalScissor);assert.equal(s.mirror.visible,true);
  }
  assert.equal(s.calls.filter(c=>c[0]==='capability').length,1,'GPU capability queries must not stall every frame');
  s.mirror.dispose();s.mirror.geometry.dispose();
});

test('direct mirror skips hidden, back-facing, offscreen and XR views',()=>{
  const s=setup();s.mirror.visible=false;assert.equal(s.draw(),false);
  s.mirror.visible=true;s.renderer.xr.isPresenting=true;assert.equal(s.draw(),false);
  s.renderer.xr.isPresenting=false;s.camera.position.z=-1;s.camera.lookAt(0,0,0);s.camera.updateMatrixWorld();assert.equal(s.draw(),false);
  s.camera.position.z=1;s.camera.lookAt(0,0,2);s.camera.updateMatrixWorld();assert.equal(s.draw(),false);
  assert.equal(s.calls.length,0);s.mirror.dispose();s.mirror.geometry.dispose();
});
