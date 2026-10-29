import * as THREE from 'three';

// Externally rotate each thigh around its hip-to-ankle axis. The knees open
// without sliding the feet, stretching a limb or adding a sideways knee hinge.
export function applySeatedLegSpread(root,weight=1){
  for(const {leg,knee,boot,side}of root.userData.legs){
    const ankle=boot.position.clone().applyQuaternion(knee.quaternion).add(knee.position).applyQuaternion(leg.quaternion);
    const spread=new THREE.Quaternion().setFromAxisAngle(ankle.normalize(),-side*.42*weight);
    leg.quaternion.premultiply(spread);
    const toeOut=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),side*.12*weight);
    boot.quaternion.copy(leg.quaternion).multiply(knee.quaternion).invert().multiply(toeOut);
  }
}
