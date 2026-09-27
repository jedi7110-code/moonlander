import {Vector3,Quaternion,MathUtils} from 'three';
import {runCycle,RUN_STRIDE} from './lucy-run-motion.js';

const v=(x=0,y=0,z=0)=>new Vector3(x,y,z),q=()=>new Quaternion();
function createRunCoat(coat){
  const geometry=coat.geometry.clone(),a=geometry.attributes;
  const smooth=(lo,hi,value)=>MathUtils.smoothstep(value,lo,hi);
  const index=name=>coat.skeleton.bones.findIndex(b=>b.name===name);
  const pelvis=index('pelvis'),spine=index('Bone001');
  // The original belly bridge has bilateral limb weights. When both forelegs
  // reach, it drags a sheet of abdomen down with the upper arms. Keep this soft
  // underside on the trunk; retain the actual one-sided legs and their shape.
  for(let i=0;i<a.position.count;i++){
    const x=a.position.getX(i),y=a.position.getY(i),z=a.position.getZ(i);
    let left=0,right=0,trunk=0;
    for(let k=0;k<4;k++){
      const name=coat.skeleton.bones[a.skinIndex.getComponent(i,k)].name,w=a.skinWeight.getComponent(i,k);
      if(name.endsWith('_L'))left+=w;else if(name.endsWith('_R'))right+=w;
      else if(['pelvis','Bone001','Bone002'].includes(name))trunk+=w;
    }
    const bellyHeight=.098-.023*smooth(-.055,.080,z);
    const amount=(1-smooth(.030,.063,Math.abs(x)))*(1-smooth(.115,.155,y))
      *smooth(-.075,-.032,z)*(1-smooth(.105,.135,z))
      *smooth(bellyHeight-.010,bellyHeight+.002,y)*smooth(.12,.32,trunk+Math.min(left,right));
    if(amount<=0)continue;
    const weights=new Map();
    for(let k=0;k<4;k++){const bone=a.skinIndex.getComponent(i,k);weights.set(bone,(weights.get(bone)??0)+a.skinWeight.getComponent(i,k)*(1-amount));}
    const front=smooth(.005,.085,z);
    weights.set(pelvis,(weights.get(pelvis)??0)+amount*(1-front));weights.set(spine,(weights.get(spine)??0)+amount*front);
    const selected=[...weights].sort((a,b)=>b[1]-a[1]).slice(0,4),sum=selected.reduce((n,[,w])=>n+w,0);
    for(let k=0;k<4;k++){a.skinIndex.setComponent(i,k,selected[k]?.[0]??0);a.skinWeight.setComponent(i,k,(selected[k]?.[1]??0)/sum);}
  }
  return geometry;
}
export function createLucyRunRig(root){
  root.updateMatrixWorld(true);
  const scale=root.scale.x,rest=[],get=name=>root.getObjectByName(name);
  const coat=root.userData.cabin.coat,baseGeometry=coat.geometry,runGeometry=createRunCoat(coat);
  root.traverse(b=>{if(b.isBone)rest.push({b,p:b.position.clone(),q:b.quaternion.clone()});});
  const feet=root.userData.cabin.turnRig.feet;
  const basePoint=name=>root.worldToLocal(get(name).getWorldPosition(v())).multiplyScalar(scale);
  const baseController=basePoint('CONTROLLER');
  const restChest=basePoint('Bone002');
  const tailLength=[1,2,3,4].reduce((length,i)=>length+basePoint('tail'+i).distanceTo(basePoint('tail'+(i+1))),0);
  const shoulderOffsets=Object.fromEntries(['L','R'].map(side=>[side,basePoint('paw1_'+side).sub(restChest)]));
  const lengths={};
  for(const side of ['L','R']){
    lengths['front'+side]=[basePoint('paw1_'+side).distanceTo(basePoint('paw2_'+side)),basePoint('paw2_'+side).distanceTo(basePoint('Lucy contact paw3_'+side))];
    lengths['rear'+side]=[basePoint('leg1_'+side).distanceTo(basePoint('leg2_'+side)),basePoint('leg2_'+side).distanceTo(basePoint('leg3_'+side)),basePoint('leg3_'+side).distanceTo(basePoint('Lucy contact feet_'+side))];
  }
  function world(p){return root.localToWorld(p.clone().divideScalar(scale));}
  function place(bone,point){bone.position.copy(bone.parent.worldToLocal(point.clone()));root.updateMatrixWorld(true);}
  function rotate(name,angle){
    const b=get(name),axis=v(1,0,0).applyQuaternion(root.getWorldQuaternion(q())).applyQuaternion(b.parent.getWorldQuaternion(q()).invert());
    b.quaternion.premultiply(q().setFromAxisAngle(axis,angle));root.updateMatrixWorld(true);
  }
  function aim(bone,child,target){
    const at=bone.getWorldPosition(v()),from=child.getWorldPosition(v()).sub(at).normalize(),to=target.clone().sub(at).normalize();
    const turn=q().setFromUnitVectors(from,to);
    bone.quaternion.copy(bone.parent.getWorldQuaternion(q()).invert().multiply(turn.multiply(bone.getWorldQuaternion(q()))));root.updateMatrixWorld(true);
  }
  function twoBone(upper,lower,end,target,pole,l1,l2){
    const start=upper.getWorldPosition(v()),axis=target.clone().sub(start),distance=MathUtils.clamp(axis.length(),.015,l1+l2-.0001);axis.normalize();
    const along=(l1*l1-l2*l2+distance*distance)/(2*distance);
    pole.addScaledVector(axis,-pole.dot(axis)).normalize();
    const bend=start.clone().addScaledVector(axis,along).addScaledVector(pole,Math.sqrt(Math.max(0,l1*l1-along*along)));
    aim(upper,lower,bend);aim(lower,end,start.addScaledVector(axis,distance));
  }
  function update({distance,speed,weight=MathUtils.smoothstep(speed,.45,1.05)}){
    if(weight<=0){coat.geometry=baseGeometry;return null;}
    coat.geometry=runGeometry;
    const baseline=rest.map(({b})=>({b,p:b.position.clone(),q:b.quaternion.clone()}));
    rest.forEach(({b,p,q})=>{b.position.copy(p);b.quaternion.copy(q);});root.updateMatrixWorld(true);
    const state=runCycle(distance/RUN_STRIDE),rootQ=root.getWorldQuaternion(q());
    place(get('CONTROLLER'),world(baseController.clone().add(v(0,state.bodyY,state.bodyZ))));
    // Lean the neck forward from the chest, lowering the head while keeping
    // its gaze nearly level. The shoulder positions and approved leg cycle
    // use the unchanged chest origin, not this neck rotation.
    const neckLean=.32;
    rotate('pelvis',-state.flex*.5);rotate('Bone001',state.flex);rotate('Bone002',-state.flex*.45+neckLean);
    rotate('Bone004',-state.flex*.05-neckLean+.04);
    const chest=get('Bone002').getWorldPosition(v());
    for(const side of ['L','R']){
      const shoulder=shoulderOffsets[side].clone().add(v(0,0,state.feet['front'+side].shoulder));
      place(get('paw1_'+side),chest.clone().add(shoulder.applyQuaternion(rootQ)));
    }
    for(const f of feet){
      const step=state.feet[f.key],target=world(f.anchor.clone().multiplyScalar(scale).add(v(0,step.lift,step.z)));
      place(f.control,target);
      const rotation=rootQ.clone().multiply(q().setFromAxisAngle(v(1,0,0),step.roll)).multiply(f.rotation);
      f.paw.quaternion.copy(f.paw.parent.getWorldQuaternion(q()).invert().multiply(rotation));root.updateMatrixWorld(true);
      const pole=v(f.side==='L'?.07:-.07,0,f.rear?1:-1).applyQuaternion(rootQ),ls=lengths[f.key];
      if(f.rear){
        const hock=target.clone().add(v(0,Math.cos(step.hock)*ls[2],-Math.sin(step.hock)*ls[2]).applyQuaternion(rootQ));
        twoBone(get('leg1_'+f.side),get('leg2_'+f.side),get('leg3_'+f.side),hock,pole,ls[0],ls[1]);
        aim(get('leg3_'+f.side),get('Lucy contact feet_'+f.side),target);
      }else twoBone(get('paw1_'+f.side),get('paw2_'+f.side),get('Lucy contact paw3_'+f.side),target,pole,ls[0],ls[1]);
    }
    // Keep the tail almost level, with a restrained rise through its middle.
    // The body already bobs with each stride; the small delayed tip motion
    // should support that motion without drawing attention away from the run.
    const beat=state.phase*Math.PI*2,arch=.008+.016*Math.sin(beat-.06*Math.PI*2);
    const tip=.003*Math.sin(beat-.18*Math.PI*2);
    const tailPoint=u=>v(.0015*Math.sin(beat-u*.8)*Math.sin(Math.PI*u),
      arch*Math.sin(Math.PI*u)+tip*u,-tailLength*u);
    for(let i=1;i<5;i++){
      const b=get('tail'+i),child=get('tail'+(i+1)),at=b.getWorldPosition(v());
      const dir=tailPoint(i/4).sub(tailPoint((i-1)/4)).normalize().applyQuaternion(rootQ);
      aim(b,child,at.add(dir));
    }
    if(weight<1)baseline.forEach(({b,p,q})=>{b.position.lerp(p,1-weight);b.quaternion.slerp(q,1-weight);});
    root.updateMatrixWorld(true);return state;
  }
  return{update,feet,dispose(){coat.geometry=baseGeometry;runGeometry.dispose();}};
}
