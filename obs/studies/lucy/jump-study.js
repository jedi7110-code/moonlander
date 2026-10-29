import {Quaternion,Vector3} from 'three';
const smooth=(a,b,t)=>{const u=Math.max(0,Math.min(1,(t-a)/(b-a)));return u*u*(3-2*u);};

// Seconds, torso lift, forward travel, pitch, forepaw lift, hindpaw lift,
// forepaw reach, hindpaw reach. Contacts have independent timing: the hind
// paws push last, while the forepaws receive the landing first.
const KEYS=[
  [0,0,0,0,0,0,0,0],
  [.28,-.045,0,.06,0,0,0,0],
  [.44,-.050,.005,-.10,0,0,0,0],
  [.58,-.023,.015,-.25,.080,0,.085,0],
  [.66,.010,.026,-.26,.210,0,.145,-.008],
  [.78,.095,.048,-.20,.300,.105,.220,-.095],
  [1.04,.205,.085,-.06,.405,.280,.230,-.180],
  [1.17,.220,.105,.04,.405,.287,.230,-.180],
  [1.40,.110,.140,.21,.185,.155,.200,-.160],
  [1.56,.008,.165,.19,0,.120,.090,-.140],
  [1.70,-.043,.200,.10,0,.035,.055,-.060],
  [1.82,-.045,.215,0,0,0,.040,0],
  [2.12,0,.225,0,0,0,.030,0],
  [3,0,.225,0,0,0,.030,0],
];
export function sampleJump(time){
  const t=Math.max(0,Math.min(3,time));let k=1;
  while(k<KEYS.length-1&&KEYS[k][0]<t)k++;
  const a=KEYS[k-1],b=KEYS[k],u=(t-a[0])/(b[0]-a[0]),s=u*u*(3-2*u);
  const [lift,travel,pitch,front,rear,frontReach,rearReach]=a.slice(1).map((v,i)=>v+(b[i+1]-v)*s);
  const phase=t<.44?'踏み込み':t<.66?'前足が先に上がる':t<1.56?'後ろ足で蹴り出し → 空中':t<1.82?'前足で着地 → 衝撃を吸収':t<2.12?'後ろ足が着地':'姿勢を戻す';
  return {lift,travel,pitch,front,rear,frontReach,rearReach,phase};
}

// Separate study rig: absolute sampling permits scrubbing in either direction
// without accumulating IK rotations or leaking this pose into other actions.
export function createJumpStudy(root,{floorY=-.002}={}){
  root.updateMatrixWorld(true);
  const rest=[];root.traverse(b=>{if(b.isBone)rest.push({b,p:b.position.clone(),q:b.quaternion.clone(),s:b.scale.clone()});});
  const controller=root.getObjectByName('CONTROLLER'),pelvis=root.getObjectByName('pelvis');
  const controllerOrigin=controller.getWorldPosition(new Vector3());
  let coat;root.traverse(m=>{if(m.isSkinnedMesh&&m.material?.name==='Lucy calico coat')coat=m;});
  coat.skeleton.update();const a=coat.geometry.attributes.position,point=new Vector3();
  const feet=[];
  for(const side of ['L','R'])for(const rear of [false,true]){
    const bone=root.getObjectByName((rear?'leg3_control_':'paw_control_')+side);
    let min=Infinity;
    for(let i=0;i<a.count;i++)if(a.getY(i)<.023&&(side==='L'?a.getX(i)>0:a.getX(i)<0)
      &&(rear?a.getZ(i)>-.06&&a.getZ(i)<.08:a.getZ(i)>.13&&a.getZ(i)<.225)){
      min=Math.min(min,coat.getVertexPosition(i,point).applyMatrix4(coat.matrixWorld).y);
    }
    feet.push({bone,rear,paw:root.getObjectByName((rear?'feet_':'paw3_')+side),origin:bone.getWorldPosition(new Vector3()),clearance:floorY+.0005-min});
  }
  function place(bone,world){bone.position.copy(bone.parent.worldToLocal(world.clone()));root.updateMatrixWorld(true);}
  function aim(bone,child,target){
    const origin=bone.getWorldPosition(new Vector3());
    const turn=new Quaternion().setFromUnitVectors(child.getWorldPosition(new Vector3()).sub(origin).normalize(),target.clone().sub(origin).normalize());
    bone.quaternion.copy(bone.parent.getWorldQuaternion(new Quaternion()).invert()
      .multiply(turn.multiply(bone.getWorldQuaternion(new Quaternion()))));
    root.updateMatrixWorld(true);
  }
  function airborneHock(f,weight){
    const side=f.paw.name.slice(-1),hip=root.getObjectByName('leg1_'+side),knee=root.getObjectByName('leg2_'+side);
    const hock=root.getObjectByName('leg3_'+side),end=root.getObjectByName('Lucy contact feet_'+side);
    const H=hip.getWorldPosition(new Vector3()),K=knee.getWorldPosition(new Vector3()),A=hock.getWorldPosition(new Vector3());
    const F=end.getWorldPosition(new Vector3()),upper=H.distanceTo(K),shin=K.distanceTo(A),metatarsal=A.distanceTo(F);
    // Bend at the hock, not at the toe pad. The distal segment hangs nearly
    // vertically and the paw continues along it; the hip/knee retain reach.
    const direction=F.clone().sub(A).normalize().lerp(new Vector3(0,-1,-.08).normalize(),weight).normalize();
    const target=F.clone().addScaledVector(direction,-metatarsal),axis=target.clone().sub(H);
    const distance=Math.min(axis.length(),(upper+shin)*.985);axis.normalize();target.copy(H).addScaledVector(axis,distance);
    const pole=K.clone().sub(H).addScaledVector(axis,-K.clone().sub(H).dot(axis));
    if(pole.lengthSq()<1e-10)pole.set(0,0,1).addScaledVector(axis,-axis.z);
    pole.normalize();
    const along=(upper*upper-shin*shin+distance*distance)/(2*distance);
    const bend=H.clone().addScaledVector(axis,along).addScaledVector(pole,Math.sqrt(Math.max(0,upper*upper-along*along)));
    aim(hip,knee,bend);aim(knee,hock,target);
    const foot=target.clone().addScaledVector(direction,metatarsal);aim(hock,end,foot);place(f.bone,foot);
    const q=f.paw.getWorldQuaternion(new Quaternion()),forward=new Vector3(0,1,0).applyQuaternion(q);
    const aligned=new Quaternion().setFromUnitVectors(forward,direction).multiply(q);
    q.slerp(aligned,weight);
    f.paw.quaternion.copy(f.paw.parent.getWorldQuaternion(new Quaternion()).invert().multiply(q));root.updateMatrixWorld(true);
  }
  function update(time){
    rest.forEach(({b,p,q,s})=>{b.position.copy(p);b.quaternion.copy(q);b.scale.copy(s);});
    root.updateMatrixWorld(true);const pose=sampleJump(time);
    place(controller,controllerOrigin.clone().add(new Vector3(0,pose.lift,pose.travel)));
    const axis=new Vector3(1,0,0).applyQuaternion(pelvis.parent.getWorldQuaternion(new Quaternion()).invert());
    pelvis.quaternion.premultiply(new Quaternion().setFromAxisAngle(axis,pose.pitch));root.updateMatrixWorld(true);
    for(const f of feet){
      const lift=f.rear?pose.rear:pose.front,reach=f.rear?pose.rearReach:pose.frontReach;
      // Keep planted forepaws still throughout impact instead of sliding them
      // forward with the recovering chest.
      const travel=!f.rear&&time>=1.56?.255:(pose.travel+reach)*
        (f.rear?smooth(.66,.78,time):smooth(.44,.58,time));
      place(f.bone,f.origin.clone().add(new Vector3(0,f.clearance+lift,travel)));
    }
    for(let i=0;i<5;i++){root.userData.ik.update();root.updateMatrixWorld(true);}
    const hockWeight=smooth(.66,.94,time)*(1-smooth(1.4,1.82,time));
    if(hockWeight>0)for(const f of feet)if(f.rear)airborneHock(f,hockWeight);
    return pose;
  }
  return {update,feet};
}
