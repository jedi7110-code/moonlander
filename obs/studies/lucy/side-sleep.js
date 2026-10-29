import { Box3, Quaternion, Vector3 } from 'three';
import { addSleepingEyelids } from './sleep-eyelids.js';
import { restSleepingRightForepaw } from './sleep-forepaw.js';
import { addLucyPawPads } from './paw-pads.js';
import { addLucyWhiskerPads } from './whisker-pads.js';


export function addSideSleepBreathing(root) {
  let coat;
  root.traverse(mesh => {if(mesh.material?.name === 'Lucy calico coat') coat = mesh;});
  coat.geometry = coat.geometry.clone();
  const positions = coat.geometry.attributes.position;
  const original = positions.array.slice();
  const smooth = (a, b, v) => {
    const t = Math.max(0, Math.min(1, (v - a) / (b - a)));
    return t * t * (3 - 2 * t);
  };
  const rise = Array.from({length: positions.count}, (_, i) => {
    const x = positions.getX(i), y = positions.getY(i), z = positions.getZ(i);
    return Math.max(0, x + .020) * .018 * smooth(.080, .125, y)
      * smooth(-.035, .040, z) * (1 - smooth(.155, .195, z));
  });
  return (time,weight=1) => {
    const breath = (.5 - .5 * Math.cos(time * Math.PI * 2 / 3.8))*weight;
    for(let i = 0; i < positions.count; i++) positions.setX(i, original[i * 3] + rise[i] * breath);
    positions.needsUpdate = true;
  };
}

// Study-only contact pose. Rotate the intact rig; never project the skin onto
// the floor. The small spinal bends let the rib cage and hip share support.
export function layLucyOnSide(root, {floorY = -.002} = {}) {
  addLucyWhiskerPads(root);
  addLucyPawPads(root);
  addSleepingEyelids(root);
  root.rotation.set(-.028, 0, Math.PI / 2 - .149);
  root.updateMatrixWorld(true);
  for(const [name, angle] of [
    ['pelvis', .022], ['Bone001', -.005], ['Bone002', -.142],
    ['Bone004', .337], ['tail1', .002],
  ]) {
    const bone = root.getObjectByName(name);
    const axis = new Vector3(1, 0, 0).applyQuaternion(bone.parent.getWorldQuaternion(new Quaternion()).invert());
    bone.quaternion.premultiply(new Quaternion().setFromAxisAngle(axis, angle));
    root.updateMatrixWorld(true);
  }
  const pelvis = root.getObjectByName('pelvis');
  const flankAxis = new Vector3(0,0,1).applyQuaternion(pelvis.parent.getWorldQuaternion(new Quaternion()).invert());
  pelvis.quaternion.premultiply(new Quaternion().setFromAxisAngle(flankAxis, .05));
  root.updateMatrixWorld(true);
  // The foot controls stay independent of the spine. Reconnect the limbs
  // after changing the trunk instead of stretching their end segments.
  root.userData.ik.update();
  root.updateMatrixWorld(true);
  const bounds = new Box3();
  let support = Infinity;
  root.traverse(mesh => {
    if (!mesh.isMesh || !mesh.visible) return;
    if (mesh.isSkinnedMesh) mesh.skeleton.update();
    for (let i = 0; i < mesh.geometry.attributes.position.count; i++) {
      const p = mesh.getVertexPosition(i, new Vector3()).applyMatrix4(mesh.matrixWorld);
      bounds.expandByPoint(p);
      // Whiskers bend against the bed; they must not suspend the body.
      if (mesh.material.name === 'Lucy calico coat') {
        const a = mesh.geometry.attributes.position;
        if(a.getZ(i) > -.060 && (a.getZ(i) > .225 || a.getY(i) > .130)) support = Math.min(support, p.y);
      }
    }
  });
  const center = bounds.getCenter(new Vector3());
  root.position.x -= center.x;
  root.position.z -= center.z;
  root.position.y += floorY + .0005 - support;
  root.updateMatrixWorld(true);
  settleSideSleepLimbs(root, floorY + .0005);
  restSleepingRightForepaw(root, {floorY});
  return bounds;
}

// Put the lower legs on the floor using the existing IK controls. Correct the
// controls, not the skin, so ankles remain attached and bone lengths survive.
function settleSideSleepLimbs(root, contactY) {
  let coat;
  root.traverse(m => {if(m.material?.name === 'Lucy calico coat') coat = m;});
  const a = coat.geometry.attributes.position, p = new Vector3();
  function minimum(select) {
    coat.skeleton.update();let result = Infinity;
    for(let i = 0; i < a.count; i++) if(select(a.getX(i), a.getY(i), a.getZ(i))) {
      result = Math.min(result, coat.getVertexPosition(i, p).applyMatrix4(coat.matrixWorld).y);
    }
    return result;
  }
  for(let pass = 0; pass < 8; pass++) {
    for(const side of ['L', 'R']) for(const rear of [false, true]) {
      const low = minimum((x,y,z) => y < .130 && z > -.060 && z < .225
        && (side === 'L' ? x > 0 : x < 0) && (rear ? z < .08 : z >= .08));
      if(low >= contactY - .00002) continue;
      const control = root.getObjectByName((rear ? 'leg3_control_' : 'paw_control_') + side);
      const target = control.getWorldPosition(new Vector3());target.y += contactY - low;
      control.position.copy(control.parent.worldToLocal(target));
      root.updateMatrixWorld(true);root.userData.ik.update();root.updateMatrixWorld(true);
    }
  }
  const tail = root.getObjectByName('tail1'), rest = tail.quaternion.clone();
  const axis = new Vector3(1,0,0).applyQuaternion(tail.parent.getWorldQuaternion(new Quaternion()).invert());
  for(let angle = 0; angle <= .3; angle += .002) {
    tail.quaternion.copy(new Quaternion().setFromAxisAngle(axis, angle)).multiply(rest);
    root.updateMatrixWorld(true);
    if(minimum((x,y,z) => z <= -.060) >= contactY) break;
  }
  // IK can move the blended shoulder/thigh skin slightly below its controls.
  // A final rigid clearance keeps every coat vertex above the actual floor.
  root.position.y += Math.max(0, contactY - minimum(() => true));
  root.updateMatrixWorld(true);
}
