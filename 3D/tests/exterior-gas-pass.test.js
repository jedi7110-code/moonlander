import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createExteriorGasPass} from '../src/obs/exterior-gas-pass.js';
import {createExteriorShip} from '../src/obs/ship-exterior.js';
import {applyExteriorProbePose,sampleExteriorProbeFlight} from '../src/obs/exterior-probe-flight.js';

function fixture(){
  const ship=createExteriorShip(),scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(40,1,.3,280);
  scene.add(ship.root);applyExteriorProbePose(ship,sampleExteriorProbeFlight(14));
  const gas=ship.probeThrusters.gas,records=[],clearColor=new THREE.Color(.1,.2,.3);
  const target=new THREE.WebGLRenderTarget(160,90,{depthTexture:new THREE.DepthTexture(160,90)});
  const gasTarget=new THREE.WebGLRenderTarget(1,1,{depthBuffer:false});
  let current=target,alpha=1;
  const renderer={
    render(view){
      view.updateMatrixWorld(true);
      records.push({view,target:current,visible:gas.visible,depthTest:gas.material.depthTest,
        sceneDepth:gas.material.uniforms.sceneDepth.value,depthEnabled:gas.material.uniforms.depthEnabled.value});
    },
    setRenderTarget(value){current=value;},
    getClearColor(value){return value.copy(clearColor);},getClearAlpha(){return alpha;},
    setClearColor(value,nextAlpha){clearColor.set(value);alpha=nextAlpha;},
  };
  return{ship,scene,camera,gas,records,target,gasTarget,renderer,pass:createExteriorGasPass(renderer,gas),
    state:()=>({current,alpha,color:clearColor.clone()}),dispose(){target.dispose();gasTarget.dispose();ship.dispose();}};
}

test('gas reuses the opaque depth in a separate target and keeps the original instance transform',()=>{
  const f=fixture();
  try{
    const before=f.state();
    assert.equal(f.pass.render(f.scene,f.camera,f.target,f.gasTarget),true);
    assert.equal(f.records.length,2,'the spacecraft is rendered once, followed by only the gas');
    const [opaque,volume]=f.records;
    assert.equal(opaque.view,f.scene);assert.equal(opaque.visible,false);
    assert.equal(volume.target,f.gasTarget);assert.equal(volume.sceneDepth,f.target.depthTexture);
    assert.notEqual(volume.target.depthTexture,volume.sceneDepth,'sampling never feeds back into the active framebuffer');
    assert.equal(volume.depthEnabled,true);assert.equal(volume.depthTest,false,'the proxy far face must not erase foreground gas');
    assert.equal(f.gasTarget.width,160);assert.equal(f.gasTarget.height,90);
    const proxy=volume.view.children[0];
    assert.equal(proxy.geometry,f.gas.geometry);assert.equal(proxy.material,f.gas.material);assert.equal(proxy.instanceMatrix,f.gas.instanceMatrix);
    assert.deepEqual(proxy.matrixWorld,f.gas.matrixWorld,'gas and opaque ship share the same pose');
    assert.deepEqual(f.gas.material.uniforms.cameraRange.value.toArray(),[.3,280]);
    assert.equal(f.gas.visible,true);assert.equal(f.gas.material.depthTest,true);
    assert.equal(f.gas.material.uniforms.depthEnabled.value,false);assert.deepEqual(f.state(),before);
  }finally{f.dispose();}
});

test('hidden or stopped gas skips the overlay and render failures restore renderer state',()=>{
  const f=fixture();
  try{
    f.ship.root.visible=false;
    assert.equal(f.pass.render(f.scene,f.camera,f.target,f.gasTarget),false);assert.equal(f.records.length,1);
    f.ship.root.visible=true;f.gas.visible=false;
    assert.equal(f.pass.render(f.scene,f.camera,f.target,f.gasTarget),false);assert.equal(f.records.length,2);
    f.gas.visible=true;const before=f.state(),render=f.renderer.render;
    f.renderer.render=view=>{render(view);if(view!==f.scene)throw new Error('volume render failed');};
    assert.throws(()=>f.pass.render(f.scene,f.camera,f.target,f.gasTarget),/volume render failed/);
    assert.deepEqual(f.state(),before);assert.equal(f.gas.visible,true);assert.equal(f.gas.material.depthTest,true);
    assert.equal(f.gas.material.uniforms.depthEnabled.value,false);
  }finally{f.dispose();}
});
