import {Quaternion,Vector3} from 'three';

// Head leads the semicircular turn, followed by the forepaws, hindquarters,
// then tail. Different spine headings form a continuous curve through the body.
export function createLucyTurnRig(root){
  root.updateMatrixWorld(true);
  const rest=[],feet=[],up=new Vector3(0,1,0),p=new Vector3(),q=new Quaternion();
  root.traverse(b=>{if(b.isBone)rest.push({b,p:b.position.clone(),q:b.quaternion.clone()});});
  let coat;root.traverse(m=>{if(m.isSkinnedMesh&&m.material?.name==='Lucy calico coat')coat=m;});
  const a=coat.geometry.attributes.position;coat.skeleton.update();
  for(const side of ['L','R'])for(const rear of [false,true]){
    const control=root.getObjectByName((rear?'leg3_control_':'paw_control_')+side),paw=root.getObjectByName((rear?'feet_':'paw3_')+side);
    const vertices=[];let low=Infinity;
    for(let i=0;i<a.count;i++)if(a.getY(i)<.023&&(side==='L'?a.getX(i)>0:a.getX(i)<0)
      &&(rear?a.getZ(i)>-.06&&a.getZ(i)<.08:a.getZ(i)>.13&&a.getZ(i)<.225)){
      vertices.push(i);low=Math.min(low,coat.getVertexPosition(i,p).applyMatrix4(coat.matrixWorld).y);
    }
    const anchor=root.worldToLocal(control.getWorldPosition(new Vector3()));
    anchor.y+=(root.getWorldPosition(p).y+.0005-low)/root.scale.y;
    feet.push({control,paw,anchor,vertices,side,rear,key:(rear?'rear':'front')+side,
      rotation:root.getWorldQuaternion(new Quaternion()).invert().multiply(paw.getWorldQuaternion(new Quaternion()))});
  }
  function place(bone,world){bone.position.copy(bone.parent.worldToLocal(world));root.updateMatrixWorld(true);}
  function yaw(name,amount){
    const bone=root.getObjectByName(name),axis=up.clone().applyQuaternion(bone.parent.getWorldQuaternion(q).invert());
    bone.quaternion.premultiply(new Quaternion().setFromAxisAngle(axis,amount));root.updateMatrixWorld(true);
  }
  function aim(bone,child,target){
    const at=bone.getWorldPosition(new Vector3());
    const rotation=new Quaternion().setFromUnitVectors(child.getWorldPosition(new Vector3()).sub(at).normalize(),target.clone().sub(at).normalize());
    bone.quaternion.copy(bone.parent.getWorldQuaternion(new Quaternion()).invert().multiply(rotation.multiply(bone.getWorldQuaternion(new Quaternion()))));root.updateMatrixWorld(true);
  }
  function foreleg(f){
    const upper=root.getObjectByName('paw1_'+f.side),lower=root.getObjectByName('paw2_'+f.side),end=root.getObjectByName('Lucy contact paw3_'+f.side);
    for(const bone of [upper,lower])bone.quaternion.copy(rest.find(r=>r.b===bone).q);
    root.updateMatrixWorld(true);
    const shoulder=upper.getWorldPosition(new Vector3()),elbow=lower.getWorldPosition(new Vector3()),tip=end.getWorldPosition(new Vector3());
    const target=f.control.getWorldPosition(new Vector3()),l1=shoulder.distanceTo(elbow),l2=elbow.distanceTo(tip),axis=target.clone().sub(shoulder);
    const distance=Math.min(axis.length(),(l1+l2)*.9999);axis.normalize();target.copy(shoulder).addScaledVector(axis,distance);
    // A fixed anatomical elbow pole avoids the CCD solver switching sides
    // when a nearly straight planted foreleg crosses its singularity.
    const pole=new Vector3((f.side==='L'?1:-1)*.15,0,-1).applyQuaternion(root.getWorldQuaternion(new Quaternion()));
    pole.addScaledVector(axis,-pole.dot(axis)).normalize();
    const along=(l1*l1-l2*l2+distance*distance)/(2*distance);
    const bend=shoulder.clone().addScaledVector(axis,along).addScaledVector(pole,Math.sqrt(Math.max(0,l1*l1-along*along)));
    aim(upper,lower,bend);aim(lower,end,target);place(f.control,target);
  }
  function solve(){for(let i=0;i<5;i++){root.userData.ik.update();root.updateMatrixWorld(true);}feet.filter(f=>!f.rear).forEach(foreleg);}
  function update(turn,{restore=true}={}){
    if(restore)rest.forEach(({b,p,q})=>{b.position.copy(p);b.quaternion.copy(q);});
    const base=rest.map(({b})=>({b,p:b.position.clone(),q:b.quaternion.clone()}));
    root.rotation.y=turn.yaw;root.updateMatrixWorld(true);
    const controller=root.getObjectByName('CONTROLLER');
    place(controller,controller.getWorldPosition(new Vector3()).addScaledVector(up,-.019*turn.weight-.004));
    yaw('pelvis',turn.rearYaw-turn.yaw);
    const bend=turn.frontYaw-turn.rearYaw;
    yaw('Bone001',bend*.55);yaw('Bone002',bend*.45);yaw('Bone004',turn.headYaw-turn.frontYaw);
    // Foreleg roots in this asset are parented to pelvis, not to chest.
    // Carry the shoulder girdle with the front of the curved spine.
    const chest=root.getObjectByName('Bone002').getWorldPosition(new Vector3());
    for(const f of feet)if(!f.rear){
      const shoulder=root.getObjectByName('paw1_'+f.side),at=shoulder.getWorldPosition(new Vector3());
      const side=new Vector3(f.side==='L'?.054:-.054,0,-.012).applyAxisAngle(up,turn.frontYaw);
      place(shoulder,new Vector3(chest.x+side.x,at.y,chest.z+side.z));
    }
    const lag=turn.tailYaw-turn.rearYaw;
    for(const [i,weight]of [[1,.45],[2,.30],[3,.15],[4,.10]])yaw('tail'+i,lag*weight);
    for(const f of feet){
      const step=turn.feet[f.key],relative=step.yaw-turn.yaw;
      const target=f.anchor.clone().applyAxisAngle(up,relative);target.y+=step.lift/root.scale.y;
      place(f.control,root.localToWorld(target));
      const rotation=root.getWorldQuaternion(new Quaternion()).multiply(new Quaternion().setFromAxisAngle(up,relative)).multiply(f.rotation);
      f.paw.quaternion.copy(f.paw.parent.getWorldQuaternion(q).invert().multiply(rotation));root.updateMatrixWorld(true);
    }
    solve();
    // Set the actual sole to the contact/step height after blended skinning.
    const floor=root.getWorldPosition(new Vector3()).y;
    for(let pass=0;pass<2;pass++){
      coat.skeleton.update();
      for(const f of feet){
        let low=Infinity;for(const i of f.vertices)low=Math.min(low,coat.getVertexPosition(i,p).applyMatrix4(coat.matrixWorld).y);
        place(f.control,f.control.getWorldPosition(new Vector3()).addScaledVector(up,floor+.0005+turn.feet[f.key].lift-low));
      }
      solve();
    }
    // Ease into/out of the planted rig so the next idle/walk frame shares
    // the same pose instead of introducing a small elbow/contact snap.
    const blend=t=>{t=Math.max(0,Math.min(1,t/.16));return t*t*(3-2*t);};
    const weight=blend(turn.age)*blend(turn.duration-turn.age);
    if(weight<1)base.forEach(({b,p,q})=>{b.position.lerp(p,1-weight);b.quaternion.slerp(q,1-weight);});
    root.updateMatrixWorld(true);
  }
  return {update,feet};
}
