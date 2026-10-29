import {MathUtils,Vector3,Matrix4} from 'three';
import {setMealHandFit} from './cup-hand-fit.js';

export function poseSmokingLighterGrip(rig,weight,strike=0){
  for(const finger of rig.fingers){finger.rotation.set(.60*weight,0,0);finger.userData.links[0].rotation.set(.90*weight,0,0);finger.userData.links[1].rotation.set(.25*weight,0,0);}
  rig.thumb.rotation.set(.05*weight,-.22*weight,0);
  rig.thumb.userData.ip.rotation.set((.16+.16*strike)*weight,0,0);
}

// The general meal fit assigns the entire thumb to its base joint. Preserve
// the imported surface, but restore its distal joint for wheel strikes/flicks.
// This reversible copy is used only while smoking; other grips stay intact.
export function setSmokingHandFit(root,weight){
  setMealHandFit(root,weight);
  const skin=root.userData.bodySkin;if(!skin||weight<=0)return;
  const source=skin.geometry;
  let fit=root.userData.smokingHandFit;
  if(!fit){
    const geometry=source.clone(),names=skin.skeleton.bones.map(b=>b.name);
    const thumbs=['L','R'].map(prefix=>({base:names.indexOf(`Milo skin ${prefix}_thumb`),tip:names.indexOf(`Milo skin ${prefix}_thumbIP`)}));
    fit=root.userData.smokingHandFit={geometry,thumbs,weight:-1};
  }
  if(fit.weight===weight){skin.geometry=fit.geometry;return;}
  const geometry=fit.geometry,a=source.attributes,b=geometry.attributes;
  for(const name of ['position','normal','skinIndex','skinWeight'])b[name].array.set(a[name].array);
  for(let i=0;i<a.position.count;i++){
    if(a.armRegion.getX(i)<.95||a.position.getY(i)>.90)continue;
    const thumb=fit.thumbs.find(t=>Array.from({length:4},(_,k)=>a.skinIndex.array[i*4+k]===t.base&&a.skinWeight.array[i*4+k]>.01).some(Boolean));
    if(!thumb||thumb.tip<0)continue;
    const distal=(1-MathUtils.smoothstep(a.position.getY(i),.850,.880))*weight;
    if(distal<=0)continue;
    const values=new Map();
    for(let k=0;k<4;k++){
      const id=a.skinIndex.array[i*4+k],w=a.skinWeight.array[i*4+k];
      values.set(id,(values.get(id)??0)+w*(id===thumb.base?1-distal:1));
      if(id===thumb.base)values.set(thumb.tip,(values.get(thumb.tip)??0)+w*distal);
    }
    const top=[...values].sort((a,b)=>b[1]-a[1]).slice(0,4),sum=top.reduce((s,p)=>s+p[1],0);
    for(let k=0;k<4;k++){b.skinIndex.array[i*4+k]=top[k]?.[0]??0;b.skinWeight.array[i*4+k]=(top[k]?.[1]??0)/sum;}
  }
  for(const name of ['position','normal','skinIndex','skinWeight'])b[name].needsUpdate=true;
  fit.lighterReference=null;
  fit.weight=weight;
  skin.geometry=geometry;
}

// Correct only small skin penetrations of the rigid case, in the same way the
// ladder grip keeps finger pads outside its rung. Do not move any joints.
export function fitSmokingLighterContact(root,weight){
  const fit=root.userData.smokingHandFit,skin=root.userData.bodySkin;
  if(!fit||fit.weight!==1)return;
  const {position,skinIndex,skinWeight}=fit.geometry.attributes;
  let reference=fit.lighterReference;
  if(!reference&&weight>.99){
    const rig=root.userData.arms[1],joints=[...rig.fingers.flatMap(f=>[f,...f.userData.links]),rig.thumb,rig.thumb.userData.ip],saved=joints.map(j=>j.quaternion.clone());
    poseSmokingLighterGrip(rig,1,1);
    root.userData.updateWristTwists?.();root.updateMatrixWorld(true);skin.skeleton.update();
    const lighter=root.userData.smokingProps.lighter.getObjectByName('Lighter case');
    const matrix=new Matrix4(),boneMatrix=new Matrix4(),p=new Vector3(),corrections=[];
    for(let i=0;i<position.count;i++){
      if(position.getX(i)<.14||position.getY(i)>.9)continue;
      skin.getVertexPosition(i,p);skin.localToWorld(p);lighter.worldToLocal(p);
      const distances=[.017-Math.abs(p.x),.0225-Math.abs(p.y),.007-Math.abs(p.z)];
      if(distances.some(d=>d<=0))continue;
      const axis=distances.indexOf(Math.min(...distances)),key=['x','y','z'][axis],half=[.017,.0225,.007][axis];
      p[key]=Math.sign(p[key]||-1)*(half+.0005);lighter.localToWorld(p);
      matrix.elements.fill(0);
      for(let k=0;k<4;k++){
        const id=skinIndex.array[i*4+k],w=skinWeight.array[i*4+k];
        boneMatrix.multiplyMatrices(skin.skeleton.bones[id].matrixWorld,skin.skeleton.boneInverses[id]);
        for(let j=0;j<16;j++)matrix.elements[j]+=w*boneMatrix.elements[j];
      }
      p.applyMatrix4(matrix.invert());
      corrections.push({i,base:[position.getX(i),position.getY(i),position.getZ(i)],delta:[p.x-position.getX(i),p.y-position.getY(i),p.z-position.getZ(i)]});
    }
    reference=fit.lighterReference={corrections,weight:-1};
    joints.forEach((j,i)=>j.quaternion.copy(saved[i]));root.updateMatrixWorld(true);skin.skeleton.update();
  }
  if(!reference)return;
  const blend=MathUtils.smoothstep(weight,.65,1);if(reference.weight===blend)return;
  for(const {i,base,delta}of reference.corrections)position.setXYZ(i,...base.map((n,k)=>n+delta[k]*blend));
  position.needsUpdate=true;fit.geometry.computeVertexNormals();reference.weight=blend;
}
