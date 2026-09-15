import { Quaternion, Vector3 } from 'three';

const smooth = t => {t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};

// Two soft taps, followed by a long quiet interval. Absolute time makes the
// motion independent of frame rate and avoids accumulating bone rotations.
export function sleepTailLift(time) {
  const t=((time%48)+48)%48;
  let lift=0;
  for(const start of [4,17,34])for(const [offset,height] of [[0,.24],[.72,.17]]){
    const age=t-start-offset;
    if(age<0||age>.60)continue;
    lift=Math.max(lift,height*smooth(age/.30)*(1-smooth((age-.30)/.30)));
  }
  return lift;
}

// Attach only after the study's Sleep pose and whole-body placement are set.
// Rotate the distal tail joint; do not reshape the coat or move the torso.
export function createSleepTailTap(root,{floorY=-.002}={}) {
  const joint=root.getObjectByName('tail4');
  const tip=root.getObjectByName('tail5');
  if(!joint||!tip)throw new Error('Sleep tail taps require tail4 and tail5');
  let coat;
  root.traverse(m=>{if(m.material?.name==='Lucy calico coat')coat=m;});
  const a=coat.geometry.attributes;
  const distal=new Set(coat.skeleton.bones.flatMap((b,i)=>['tail4','tail5'].includes(b.name)?[i]:[]));
  const vertices=[];
  for(let i=0;i<a.position.count;i++){
    for(let k=0;k<4;k++)if(distal.has(a.skinIndex.array[i*4+k])&&a.skinWeight.array[i*4+k]>.0001){vertices.push(i);break;}
  }
  const rest=joint.quaternion.clone(),q=new Quaternion();
  root.updateMatrixWorld(true);
  const direction=tip.getWorldPosition(new Vector3()).sub(joint.getWorldPosition(new Vector3())).normalize();
  const axis=direction.cross(new Vector3(0,1,0)).normalize();
  const parentRotation=joint.parent.getWorldQuaternion(new Quaternion());
  axis.applyQuaternion(parentRotation.invert());
  function pose(angle){joint.quaternion.copy(q.setFromAxisAngle(axis,angle)).multiply(rest);root.updateMatrixWorld(true);}
  function minimum(){
    coat.skeleton.update();let y=Infinity;
    for(const i of vertices)y=Math.min(y,coat.getVertexPosition(i,new Vector3()).applyMatrix4(coat.matrixWorld).y);
    return y;
  }
  const contactY=floorY+.0005;
  let low=-.65,high=0;
  pose(low);
  if(minimum()>contactY){joint.quaternion.copy(rest);throw new Error('Tail cannot reach the floor within a gentle joint rotation');}
  pose(high);
  if(minimum()<contactY)high=.65;
  for(let i=0;i<24;i++){
    const mid=(low+high)/2;pose(mid);
    if(minimum()<contactY)low=mid;else high=mid;
  }
  const contactAngle=high;
  pose(contactAngle);
  return {
    contactAngle,contactY,vertices,
    update(time){const lift=sleepTailLift(time);pose(contactAngle+lift);return lift;},
    dispose(){joint.quaternion.copy(rest);root.updateMatrixWorld(true);},
  };
}
