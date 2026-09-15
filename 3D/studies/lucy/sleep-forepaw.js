import { Quaternion, Vector3 } from 'three';

// Sleep-study-only right forepaw contact. Keep the torso, shoulder anchor and
// every other limb fixed. The forearm rotates around the existing elbow.
export function restSleepingRightForepaw(root, {floorY = -.002} = {}) {
  let coat;
  root.traverse(m => {if(m.material?.name === 'Lucy calico coat') coat = m;});
  const lower = root.getObjectByName('paw2_R');
  const paw = root.getObjectByName('paw3_R'), end = root.getObjectByName('Lucy contact paw3_R');
  const control = paw.parent, a = coat.geometry.attributes;
  const index = coat.skeleton.bones.indexOf(paw), vertices = [];
  for(let i=0;i<a.position.count;i++) {
    let weight = 0;
    for(let k=0;k<4;k++) if(a.skinIndex.array[i*4+k] === index) weight += a.skinWeight.array[i*4+k];
    if(weight > .001 && a.position.getZ(i) > .150) vertices.push(i);
  }
  root.updateMatrixWorld(true);
  const wrist = paw.getWorldPosition(new Vector3());
  const elbow = lower.getWorldPosition(new Vector3());
  const forearmLength = elbow.distanceTo(end.getWorldPosition(new Vector3()));
  const reachDirection = wrist.clone().sub(elbow).setY(0).normalize();
  const direction = new Vector3(0,1,0).applyQuaternion(paw.getWorldQuaternion(new Quaternion()));
  const flat = direction.clone().setY(0).normalize();
  const axis = direction.clone().cross(new Vector3(0,1,0)).normalize()
    .applyQuaternion(control.getWorldQuaternion(new Quaternion()).invert());
  const q = paw.getWorldQuaternion(new Quaternion())
    .premultiply(new Quaternion().setFromUnitVectors(direction, flat));
  paw.quaternion.copy(control.getWorldQuaternion(new Quaternion()).invert().multiply(q))
    .premultiply(new Quaternion().setFromAxisAngle(axis, -.8));

  function aim(bone, child, target) {
    const origin = bone.getWorldPosition(new Vector3());
    const rotation = new Quaternion().setFromUnitVectors(
      child.getWorldPosition(new Vector3()).sub(origin).normalize(),
      target.clone().sub(origin).normalize(),
    ).multiply(bone.getWorldQuaternion(new Quaternion()));
    bone.quaternion.copy(bone.parent.getWorldQuaternion(new Quaternion()).invert().multiply(rotation));
    root.updateMatrixWorld(true);
  }
  function solveWrist() {
    const target = paw.getWorldPosition(new Vector3());
    const dy = Math.max(-forearmLength*.95,Math.min(forearmLength*.95,target.y-elbow.y));
    target.copy(elbow).addScaledVector(reachDirection,Math.sqrt(forearmLength*forearmLength-dy*dy));
    target.y += dy;
    control.position.copy(control.parent.worldToLocal(target.clone()));root.updateMatrixWorld(true);
    aim(lower,end,target);
  }
  const target = wrist.clone();target.y -= .055;
  control.position.copy(control.parent.worldToLocal(target));root.updateMatrixWorld(true);
  for(let pass=0;pass<6;pass++) {
    solveWrist();coat.skeleton.update();let support = Infinity;
    for(const i of vertices) support = Math.min(support,
      coat.getVertexPosition(i,new Vector3()).applyMatrix4(coat.matrixWorld).y);
    const target = control.getWorldPosition(new Vector3());target.y += floorY+.0005-support;
    control.position.copy(control.parent.worldToLocal(target));root.updateMatrixWorld(true);
  }
  solveWrist();
}
