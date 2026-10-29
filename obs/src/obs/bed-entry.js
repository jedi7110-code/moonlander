import {MathUtils,Quaternion,Vector3} from 'three';

export const BED_ENTRY_SECONDS=5.4;
const smooth=MathUtils.smootherstep,lerp=MathUtils.lerp;
const X=new Vector3(1,0,0),Y=new Vector3(0,1,0);

// Shared by the visit timeline, the body pose and the comparison study.
export function bedEntryMotion(u){
  return {lay:smooth(u,.43,1),turn:.42*smooth(u,.08,.43)+.58*smooth(u,.46,.86),depth:smooth(u,.60,.88)};
}

function legIK({leg,knee,boot},target,pole){
  const offset=target.clone().sub(leg.position),distance=offset.length(),axis=offset.clone().normalize();
  const a=knee.position.length(),b=boot.position.length(),reach=MathUtils.clamp(distance,Math.abs(a-b)+1e-6,a+b-1e-6);
  const along=(a*a+reach*reach-b*b)/(2*reach),height=Math.sqrt(Math.max(0,a*a-along*along));
  const bend=pole.clone().addScaledVector(axis,-pole.dot(axis)).normalize();
  const joint=axis.clone().multiplyScalar(along).addScaledVector(bend,height);
  leg.quaternion.setFromUnitVectors(knee.position.clone().normalize(),joint.clone().normalize());
  const lower=new Quaternion().setFromUnitVectors(boot.position.clone().normalize(),offset.sub(joint).normalize());
  knee.quaternion.copy(leg.quaternion).invert().multiply(lower);
  return Math.max(0,distance-(a+b));
}

export function applySequentialBedEntry(root,{entry:u,depth,bedDepth},{top,standingDepth}){
  const {body,head,arms,legs}=root.userData,{lay,turn}=bedEntryMotion(u);
  const angle=-Math.PI/2*lay,c=Math.cos(angle),s=Math.sin(angle);
  root.rotation.set(0,Math.PI/2*turn,0);root.position.z=depth;
  body.rotation.set(angle,0,0);
  body.position.set(0,top+Math.hypot(.134*c,.119*s)-c*.988,-s*.988);
  head.rotation.set(-.05*(1-lay),0,0);
  for(const {arm,elbow,hand,side}of arms){
    arm.rotation.set(lerp(.08,-.10,lay),0,side*.07*(1-lay));
    elbow.rotation.set(lerp(-.12,-.18,lay),0,0);hand.rotation.set(0,0,0);
  }
  root.updateWorldMatrix(true,true);
  const bodyRotation=body.getWorldQuaternion(new Quaternion());
  const cabinRotation=root.parent?.getWorldQuaternion(new Quaternion())??new Quaternion();
  // Sweep the knees toward the aisle while lifting, rather than drawing them
  // into the chest. Ease back to the original support at both endpoints.
  const outward=1.5*smooth(u,0,.20)*(1-smooth(u,.84,1));
  const pole=new Vector3(0,1,outward).applyQuaternion(cabinRotation).applyQuaternion(bodyRotation.clone().invert());
  const finalFoot=cabinRotation.clone().multiply(new Quaternion().setFromAxisAngle(Y,Math.PI/2)).multiply(new Quaternion().setFromAxisAngle(X,-Math.PI/2));
  let reachError=0;
  for(const rig of legs){
    // Anatomical left is +X; the imported bone labels use the opposite naming.
    const left=rig.side===1;
    const lift=smooth(u,left?0:.42,left?.28:.67),swing=smooth(u,left?.20:.63,left?.43:.84);
    const lateral=smooth(u,left?.07:.46,left?.30:.73),extend=smooth(u,left?.45:.82,1);
    const settle=smooth(u,left?.32:.78,left?.43:.91);
    const target=new Vector3(
      lerp(lerp(rig.side*.100,.64,lateral),.878,extend)+root.position.x,
      lerp(lerp(.110,top+.185,lift),top+.132,settle)+root.position.y,
      lerp(standingDepth+.013,bedDepth-rig.side*.100,swing)
    );
    // Keep the following foot planted while the pelvis turns. The medical
    // platform's vertical offset is applied to the complete pose afterwards.
    root.parent?.localToWorld(target);
    body.worldToLocal(target);reachError=Math.max(reachError,legIK(rig,target,pole));
    const foot=cabinRotation.clone().slerp(finalFoot,smooth(u,left?.16:.54,left?.47:.89));
    rig.boot.quaternion.copy(bodyRotation).multiply(rig.leg.quaternion).multiply(rig.knee.quaternion).invert().multiply(foot);
  }
  root.userData.bedEntryReachError=reachError;
}
