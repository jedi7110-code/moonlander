import {Vector3,Quaternion,MathUtils} from 'three';
import {runCycle,RUN_STRIDE} from './chase-motion.js';

const v=(x=0,y=0,z=0)=>new Vector3(x,y,z),q=()=>new Quaternion();
export function createLucyRunRig(root){
  root.updateMatrixWorld(true);
  const scale=root.scale.x,rest=[],get=name=>root.getObjectByName(name);
  root.traverse(b=>{if(b.isBone)rest.push({b,p:b.position.clone(),q:b.quaternion.clone()});});
  const feet=root.userData.cabin.turnRig.feet;
  const basePoint=name=>root.worldToLocal(get(name).getWorldPosition(v())).multiplyScalar(scale);
  const baseController=basePoint('CONTROLLER');
  const restChest=basePoint('Bone002');
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
    if(weight<=0)return null;
    const baseline=rest.map(({b})=>({b,p:b.position.clone(),q:b.quaternion.clone()}));
    rest.forEach(({b,p,q})=>{b.position.copy(p);b.quaternion.copy(q);});root.updateMatrixWorld(true);
    const state=runCycle(distance/RUN_STRIDE),rootQ=root.getWorldQuaternion(q());
    place(get('CONTROLLER'),world(baseController.clone().add(v(0,state.bodyY,state.bodyZ))));
    rotate('pelvis',-state.flex*.5);rotate('Bone001',state.flex);rotate('Bone002',-state.flex*.45);
    // The head counter-rotates instead of pitching with every back flexion.
    rotate('Bone004',-state.flex*.05-.06);
    const chest=get('Bone002').getWorldPosition(v());
    for(const side of ['L','R'])place(get('paw1_'+side),chest.clone().add(shoulderOffsets[side].clone().applyQuaternion(rootQ)));
    for(const f of feet){
      const step=state.feet[f.key],target=world(f.anchor.clone().multiplyScalar(scale).add(v(0,step.lift,step.z)));
      place(f.control,target);
      const rotation=rootQ.clone().multiply(q().setFromAxisAngle(v(1,0,0),step.roll)).multiply(f.rotation);
      f.paw.quaternion.copy(f.paw.parent.getWorldQuaternion(q()).invert().multiply(rotation));root.updateMatrixWorld(true);
      const pole=v(f.side==='L'?.07:-.07,0,f.rear?1:-1).applyQuaternion(rootQ),ls=lengths[f.key];
      if(f.rear){
        const hock=target.clone().add(v(0,Math.cos(.40+step.roll*.4)*ls[2],-Math.sin(.40+step.roll*.4)*ls[2]).applyQuaternion(rootQ));
        twoBone(get('leg1_'+f.side),get('leg2_'+f.side),get('leg3_'+f.side),hock,pole,ls[0],ls[1]);
        aim(get('leg3_'+f.side),get('Lucy contact feet_'+f.side),target);
      }else twoBone(get('paw1_'+f.side),get('paw2_'+f.side),get('Lucy contact paw3_'+f.side),target,pole,ls[0],ls[1]);
    }
    // Lower the tail behind the pelvis, with only a little balancing movement.
    for(let i=1;i<5;i++){
      const b=get('tail'+i),child=get('tail'+(i+1)),at=b.getWorldPosition(v());
      const dir=v(Math.sin(state.phase*Math.PI*2-i*.48)*.10,-.18+i*.04,-1).normalize().applyQuaternion(rootQ);
      aim(b,child,at.add(dir));
    }
    if(weight<1)baseline.forEach(({b,p,q})=>{b.position.lerp(p,1-weight);b.quaternion.slerp(q,1-weight);});
    root.updateMatrixWorld(true);return state;
  }
  return{update,feet};
}
