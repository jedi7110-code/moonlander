import * as THREE from 'three';

// The 160m whole-ship map has 7.8cm texels: almost the width of a probe
// ladder rung. Track the probe with a 24m map for its close docking view.
export function createExteriorShadow(light,ship){
  light.castShadow=true;light.shadow.mapSize.set(2048,2048);
  const center=new THREE.Vector3(),sunOffset=new THREE.Vector3(64,-110,92);
  return{update(shot){
    const close=shot.id==='lander',extent=close?12:80,camera=light.shadow.camera;
    if(close){center.set(0,3.1,0);ship.dockedLander.localToWorld(center);}
    else ship.root.getWorldPosition(center);
    light.target.position.copy(center);light.position.copy(center).add(sunOffset);
    Object.assign(camera,{left:-extent,right:extent,top:extent,bottom:-extent,
      near:close?100:1,far:close?220:320});
    camera.updateProjectionMatrix();
    // Millimetre offsets in the close-up preserve the shallow cover's
    // contact shadow without letting its own face shadow itself.
    light.shadow.bias=close?-.000025:-.00012;
    light.shadow.normalBias=close?.006:.05;
  }};
}
