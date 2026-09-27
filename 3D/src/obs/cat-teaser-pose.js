import {Vector3,Euler,MathUtils} from 'three';

const wrappedFingers=[[.6625,.3375,.10],[.70,.75,.525],[.70,.5625,1.0375],[.7375,.3375,.025]];
const wrapAmount=lift=>MathUtils.smoothstep(lift,0,.18);

export function teaserHandCenter(rig,lift){
  // First lift with the opposing pads, then roll the handle into the fingers
  // as the underside clears the table. Coordinates follow the fitted skin.
  const wrap=wrapAmount(lift),roll=Math.sin(Math.PI*wrap);
  return new Vector3(0,-.071,-.060).multiply(rig.hand.scale).lerp(new Vector3(0,-.073,-.035),wrap)
    .add(new Vector3(0,.0025*roll+.0006*Math.sin(2*Math.PI*wrap),-.0014*roll)).divide(rig.hand.scale);
}

export function applyTeaserGrip(rig,grip,lift){
  const wrap=wrapAmount(lift);
  rig.fingers.forEach((finger,i)=>{
    const angles=wrappedFingers[i];
    finger.rotation.set(MathUtils.lerp(-.08,MathUtils.lerp(.45,angles[0],wrap),grip),0,0);
    finger.userData.links[0].rotation.set(MathUtils.lerp(.65,angles[1],wrap)*grip,0,0);
    finger.userData.links[1].rotation.set(MathUtils.lerp(.30,angles[2],wrap)*grip,0,0);
  });
  rig.thumb.rotation.set(MathUtils.lerp(.25,.10,wrap)*grip,.55*wrap*grip,MathUtils.lerp(-.30,-.80,wrap)*grip);
}

export function applyTeaserGaze(root,toy,phase){
  const weight=MathUtils.smoothstep(phase.lift,0,.08)*phase.reach;
  if(!weight)return;
  const {body,head,spineCurve}=root.userData;
  body.updateWorldMatrix(true,true);
  const target=body.worldToLocal(toy.localToWorld(new Vector3(.38,.008,0)));
  let eyeOffset=root.userData.teaserEyeOffset;
  if(!eyeOffset){
    const eyes=[];head.traverse(mesh=>{if(mesh.name==='Fitted Milo eye surface')eyes.push(mesh);});
    eyeOffset=new Vector3(-.00605,.09295,.14);
    if(eyes.length){
      eyeOffset.set(0,0,0);
      for(const eye of eyes)eyeOffset.add(head.worldToLocal(eye.localToWorld(new Vector3().fromBufferAttribute(eye.geometry.attributes.position,0))).multiply(head.scale));
      eyeOffset.multiplyScalar(1/eyes.length);
    }
    root.userData.teaserEyeOffset=eyeOffset;
  }
  const pivot=new Vector3(0,-.030,.009),anchor=head.position.clone().add(pivot.clone().applyQuaternion(head.quaternion));
  const desired=head.quaternion.clone(),eyeFromPivot=eyeOffset.clone().sub(pivot);
  const torso=(spineCurve?.lean??0)+(spineCurve?.curl??0);
  // Follow the rod tip from the eyes, keeping the neck root at the shirt collar.
  for(let i=0;i<6;i++){
    const direction=target.clone().sub(anchor).sub(eyeFromPivot.clone().applyQuaternion(desired));
    const yaw=MathUtils.clamp(Math.atan2(direction.x,direction.z),-1.5,1.5);
    const pitch=MathUtils.clamp(Math.atan2(-direction.y,Math.hypot(direction.x,direction.z)),torso-.55,Math.min(1.3,torso+1.05));
    desired.setFromEuler(new Euler(pitch,yaw,0,'YXZ'));
  }
  head.quaternion.slerp(desired,weight);
  head.position.copy(anchor).sub(pivot.applyQuaternion(head.quaternion));
}
