import * as THREE from 'three';

// Reuse the opaque view's depth. Only the gas is drawn a second time;
// sampling that depth while drawing into its own target would be a feedback loop.
export function createExteriorGasPass(renderer,gas){
  const volumeScene=new THREE.Scene(),proxy=new THREE.InstancedMesh(gas.geometry,gas.material,gas.count);
  proxy.instanceMatrix=gas.instanceMatrix;proxy.matrixAutoUpdate=false;proxy.frustumCulled=false;volumeScene.add(proxy);
  const clearColor=new THREE.Color();
  return{render(scene,camera,target,gasTarget){
    const visible=gas.visible;
    let active=visible;
    for(let parent=gas.parent;parent;parent=parent.parent)active=active&&parent.visible;
    try{gas.visible=false;renderer.render(scene,camera);}finally{gas.visible=visible;}
    if(!active)return false;
    if(gasTarget.width!==target.width||gasTarget.height!==target.height)gasTarget.setSize(target.width,target.height);
    proxy.matrix.copy(gas.matrixWorld);
    const uniforms=gas.material.uniforms,depthTest=gas.material.depthTest;
    uniforms.sceneDepth.value=target.depthTexture;uniforms.depthEnabled.value=true;
    uniforms.viewport.value.set(target.width,target.height);uniforms.cameraRange.value.set(camera.near,camera.far);
    renderer.getClearColor(clearColor);const alpha=renderer.getClearAlpha();
    try{
      gas.material.depthTest=false;
      renderer.setRenderTarget(gasTarget);renderer.setClearColor(0,0);renderer.render(volumeScene,camera);
    }finally{
      gas.material.depthTest=depthTest;uniforms.depthEnabled.value=false;
      renderer.setClearColor(clearColor,alpha);renderer.setRenderTarget(target);
    }
    return true;
  }};
}
