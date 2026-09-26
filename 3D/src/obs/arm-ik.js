import {Vector3,Quaternion,Matrix4,MathUtils} from 'three';

// Solve the actual shoulder/elbow/wrist offsets, including the rearward hinge
// centre. The elbow remains a single hinge; the shoulder chooses its plane.
export function solveHingeArm(rig,wrist,pole){
  const delta=wrist.clone().sub(rig.arm.position),distance=delta.length(),axis=delta.clone().normalize();
  const upper=rig.elbow.position.length(),lower=rig.hand.position.length();
  const along=MathUtils.clamp((upper*upper-lower*lower+distance*distance)/(2*distance),-upper,upper);
  const bend=pole.clone().addScaledVector(axis,-pole.dot(axis)).normalize();
  const humerus=axis.clone().multiplyScalar(along).addScaledVector(bend,Math.sqrt(Math.max(0,upper*upper-along*along)));
  const forearm=delta.clone().sub(humerus),x=forearm.clone().cross(humerus).normalize(),y=humerus.clone().normalize().negate(),z=x.clone().cross(y).normalize();
  const hinge=Math.atan2(-rig.elbow.position.z,-rig.elbow.position.y),X=new Vector3(1,0,0);
  return {upper:new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(x,y,z)).multiply(new Quaternion().setFromAxisAngle(X,-hinge)),
    lower:new Quaternion().setFromAxisAngle(X,-Math.acos(MathUtils.clamp(humerus.dot(forearm)/(upper*lower),-1,1))+Math.atan2(rig.hand.position.z,-rig.hand.position.y)+hinge),forearm};
}
