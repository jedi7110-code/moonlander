import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';

export function createChessOrbit(camera,canvas,target){
  const controls=new OrbitControls(camera,canvas);
  controls.target.copy(target);controls.enableDamping=false;controls.enablePan=false;
  controls.minAzimuthAngle=-Math.PI/2;controls.maxAzimuthAngle=Math.PI/2;
  controls.minPolarAngle=THREE.MathUtils.degToRad(15);controls.maxPolarAngle=THREE.MathUtils.degToRad(74);
  controls.rotateSpeed=.55;controls.zoomSpeed=.8;
  controls.minDistance=4;controls.maxDistance=60;
  controls.touches.TWO=THREE.TOUCH.DOLLY_PAN;
  controls.update();return controls;
}
