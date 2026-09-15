import {Quaternion,Vector3} from 'three';
import {forepawSlide} from './forepaw-slide.js';

export const PRONE_DURATION=12;
const smooth=(a,b,t)=>{const u=Math.max(0,Math.min(1,(t-a)/(b-a)));return u*u*u*(10+u*(-15+6*u));};
export function sampleProne(time){
  const t=Math.max(0,Math.min(PRONE_DURATION,time));
  return {weight:smooth(.4,2.8,t)*(1-smooth(8.5,11,t)),
    phase:t<.4?'立位':t<2.8?'前足を伸ばし、腰を下ろす':t<8.5?'顔を起こして伏せる':t<11?'ゆっくり立ち上がる':'立位'};
}

// Separate study rig: keep the accepted cabin asset and all other actions intact.
export function createProneStudy(root,{floorY=-.002}={}){
  root.updateMatrixWorld(true);
  const rest=[];root.traverse(b=>{if(b.isBone)rest.push({b,p:b.position.clone(),q:b.quaternion.clone()});});
  const controller=root.getObjectByName('CONTROLLER'),origin=controller.getWorldPosition(new Vector3());
  let coat;root.traverse(m=>{if(m.material?.name==='Lucy calico coat')coat=m;});
  // Belly skin belongs to the trunk, not to the folded thighs/upper arms.
  // Rebind only the soft underside of this study instance. Keep its actual
  // shape and thickness; do not project or flatten vertices onto the floor.
  coat.geometry=coat.geometry.clone();
  const attributes=coat.geometry.attributes;
  const pelvisIndex=coat.skeleton.bones.findIndex(b=>b.name==='pelvis');
  const spineIndex=coat.skeleton.bones.findIndex(b=>b.name==='Bone001');
  const torsoVertices=[];
  for(let i=0;i<attributes.position.count;i++){
    const x=attributes.position.getX(i),y=attributes.position.getY(i),z=attributes.position.getZ(i);
    const bellyHeight=.098-.023*smooth(-.055,.080,z);
    let left=0,right=0,trunk=0;
    for(let k=0;k<4;k++){
      const name=coat.skeleton.bones[attributes.skinIndex.getComponent(i,k)].name,weight=attributes.skinWeight.getComponent(i,k);
      if(name.endsWith('_L'))left+=weight;
      else if(name.endsWith('_R'))right+=weight;
      else if(['pelvis','Bone001','Bone002'].includes(name))trunk+=weight;
    }
    // Bilateral limb weights identify the belly bridge. A one-sided thigh
    // stays with its leg even where it shares the belly's bind-space height.
    const body=smooth(.12,.32,trunk+Math.min(left,right));
    const amount=(1-smooth(.030,.063,Math.abs(x)))*(1-smooth(.115,.155,y))
      *smooth(-.075,-.032,z)*(1-smooth(.105,.135,z))*smooth(bellyHeight-.010,bellyHeight+.002,y)*body;
    if(amount<=0)continue;
    const weights=new Map();
    for(let k=0;k<4;k++){
      const index=attributes.skinIndex.getComponent(i,k);
      weights.set(index,(weights.get(index)||0)+attributes.skinWeight.getComponent(i,k)*(1-amount));
    }
    const front=smooth(.005,.085,z);
    weights.set(pelvisIndex,(weights.get(pelvisIndex)||0)+amount*(1-front));
    weights.set(spineIndex,(weights.get(spineIndex)||0)+amount*front);
    const selected=[...weights].sort((a,b)=>b[1]-a[1]).slice(0,4),total=selected.reduce((sum,v)=>sum+v[1],0);
    for(let k=0;k<4;k++){
      attributes.skinIndex.setComponent(i,k,selected[k]?.[0]??0);
      attributes.skinWeight.setComponent(i,k,(selected[k]?.[1]??0)/total);
    }
    torsoVertices.push(i);
  }
  attributes.skinIndex.needsUpdate=true;attributes.skinWeight.needsUpdate=true;
  const a=coat.geometry.attributes.position,p=new Vector3(),feet=[];
  coat.skeleton.update();
  for(const side of ['L','R'])for(const rear of [false,true]){
    const bone=root.getObjectByName((rear?'leg3_control_':'paw_control_')+side);
    const vertices=[];let low=Infinity;
    for(let i=0;i<a.count;i++)if(a.getY(i)<.023&&(side==='L'?a.getX(i)>0:a.getX(i)<0)
      &&(rear?a.getZ(i)>-.06&&a.getZ(i)<.08:a.getZ(i)>.13&&a.getZ(i)<.225)){
      vertices.push(i);low=Math.min(low,coat.getVertexPosition(i,p).applyMatrix4(coat.matrixWorld).y);
    }
    feet.push({bone,side,rear,vertices,origin:bone.getWorldPosition(new Vector3()),clearance:floorY+.0005-low});
  }
  function place(bone,world){bone.position.copy(bone.parent.worldToLocal(world));root.updateMatrixWorld(true);}
  function rotate(name,axis,angle){
    const b=root.getObjectByName(name);axis=axis.clone().applyQuaternion(b.parent.getWorldQuaternion(new Quaternion()).invert());
    b.quaternion.premultiply(new Quaternion().setFromAxisAngle(axis,angle));root.updateMatrixWorld(true);
  }
  function aim(bone,child,target){
    const at=bone.getWorldPosition(new Vector3()),rotation=new Quaternion().setFromUnitVectors(child.getWorldPosition(new Vector3()).sub(at).normalize(),target.clone().sub(at).normalize());
    bone.quaternion.copy(bone.parent.getWorldQuaternion(new Quaternion()).invert().multiply(rotation.multiply(bone.getWorldQuaternion(new Quaternion()))));root.updateMatrixWorld(true);
  }
  function foreleg(f){
    const upper=root.getObjectByName('paw1_'+f.side),lower=root.getObjectByName('paw2_'+f.side),end=root.getObjectByName('Lucy contact paw3_'+f.side);
    for(const b of [upper,lower])b.quaternion.copy(rest.find(r=>r.b===b).q);root.updateMatrixWorld(true);
    const shoulder=upper.getWorldPosition(new Vector3()),elbow=lower.getWorldPosition(new Vector3()),tip=end.getWorldPosition(new Vector3());
    const target=f.bone.getWorldPosition(new Vector3()),l1=shoulder.distanceTo(elbow),l2=elbow.distanceTo(tip);
    const bendAt=()=>{
      const reach=(l1+l2)*.9999,span=shoulder.clone().sub(target);
      if(span.length()>reach)shoulder.copy(target).addScaledVector(span.normalize(),reach);
      const axis=target.clone().sub(shoulder),distance=axis.length();axis.normalize();
      const pole=new Vector3((f.side==='L'?1:-1)*.10,0,-1);pole.addScaledVector(axis,-pole.dot(axis)).normalize();
      const along=(l1*l1-l2*l2+distance*distance)/(2*distance);
      return shoulder.clone().addScaledVector(axis,along).addScaledVector(pole,Math.sqrt(Math.max(0,l1*l1-along*along)));
    };
    let bend=bendAt();
    // Seat the elbow without letting it dive through the floor during entry.
    // The scapula yields upward, while the wrist keeps its contact position.
    for(let pass=0;pass<8&&bend.y<floorY+.046;pass++){
      shoulder.y+=floorY+.046-bend.y;bend=bendAt();
    }
    place(upper,shoulder.clone());
    aim(upper,lower,bend);
    aim(lower,end,target);place(f.bone,target);
  }
  function hindleg(f,w){
    const upper=root.getObjectByName('leg1_'+f.side),lower=root.getObjectByName('leg2_'+f.side),hock=root.getObjectByName('leg3_'+f.side),end=root.getObjectByName('Lucy contact feet_'+f.side);
    for(const b of [upper,lower,hock])b.quaternion.copy(rest.find(r=>r.b===b).q);root.updateMatrixWorld(true);
    const hip=upper.getWorldPosition(new Vector3()),knee=lower.getWorldPosition(new Vector3()),ankle=hock.getWorldPosition(new Vector3());
    const foot=f.bone.getWorldPosition(new Vector3()),l1=hip.distanceTo(knee),l2=knee.distanceTo(ankle),l3=ankle.distanceTo(end.getWorldPosition(new Vector3()));
    const direction=ankle.clone().sub(end.getWorldPosition(new Vector3())).normalize().lerp(new Vector3(0,0,-1),w).normalize();
    const target=foot.clone().add(direction.multiplyScalar(l3));
    const axis=target.clone().sub(hip),distance=Math.min(axis.length(),(l1+l2)*.9999);axis.normalize();target.copy(hip).addScaledVector(axis,distance);
    const pole=new Vector3((f.side==='L'?1:-1)*.6,0,1);pole.addScaledVector(axis,-pole.dot(axis)).normalize();
    const along=(l1*l1-l2*l2+distance*distance)/(2*distance);
    aim(upper,lower,hip.clone().addScaledVector(axis,along).addScaledVector(pole,Math.sqrt(Math.max(0,l1*l1-along*along))));aim(lower,hock,target);aim(hock,end,foot);
  }
  function solve(w){feet.forEach(f=>f.rear?hindleg(f,w):foreleg(f));}
  function update(time){
    const pose=sampleProne(time),w=pose.weight;
    rest.forEach(({b,p,q})=>{b.position.copy(p);b.quaternion.copy(q);});root.updateMatrixWorld(true);
    place(controller,origin.clone().add(new Vector3(0,-.168*w,-.012*w)));
    rotate('pelvis',new Vector3(1,0,0),-.22*w);rotate('Bone001',new Vector3(1,0,0),.18*w);
    rotate('Bone002',new Vector3(1,0,0),-.20*w);rotate('Bone004',new Vector3(1,0,0),.16*w);
    // This asset parents shoulders directly to the pelvis. Let the scapula
    // descend with the chest instead of leaving the forelegs propping it up.
    for(const side of ['L','R']){const shoulder=root.getObjectByName('paw1_'+side);place(shoulder,shoulder.getWorldPosition(new Vector3()).add(new Vector3(0,-.041*w,0)));}
    for(const f of feet){const side=f.side==='L'?1:-1;
      place(f.bone,f.rear?f.origin.clone().add(new Vector3(side*.025*w,f.clearance,.078*w)):forepawSlide(f,w,.195));
    }
    solve(w);
    for(let pass=0;pass<3;pass++){
      coat.skeleton.update();
      for(const f of feet){let low=Infinity;for(const i of f.vertices)low=Math.min(low,coat.getVertexPosition(i,p).applyMatrix4(coat.matrixWorld).y);
        place(f.bone,f.bone.getWorldPosition(new Vector3()).add(new Vector3(0,floorY+.0005-low,0)));
      }solve(w);
    }
    // Lower the tail behind the hip, then curl the tip beside the folded feet.
    for(let i=1;i<5;i++){
      const b=root.getObjectByName('tail'+i),child=root.getObjectByName('tail'+(i+1)),saved=b.quaternion.clone();
      const direction=[null,[0,-.85,-.53],[.65,-.46,-.6],[.9,0,.4],[.4,0,.92]][i];
      aim(b,child,b.getWorldPosition(new Vector3()).add(new Vector3(...direction)));
      b.quaternion.slerp(saved,1-w);root.updateMatrixWorld(true);
    }
    root.updateMatrixWorld(true);return pose;
  }
  update(0);return {update,feet,coat,torsoVertices};
}
