import {Bone,Matrix4,Skeleton,Vector3,MathUtils} from 'three';

const levels=[1.02,1.20,1.38,1.56],baseHeight=1.0,span=.56;

// Arc length is preserved: flexion accumulates from the pelvis toward the
// shoulders instead of retaining a hollow lumbar curve under one rigid chest.
export function spinePoint(y,z=0,lean=0,curl=0){
  const length=Math.max(0,y-baseHeight),arc=Math.min(length,span),k=curl/span,angle=lean+k*arc;
  const dy=Math.abs(k)<1e-6?arc*Math.cos(lean):(Math.sin(angle)-Math.sin(lean))/k;
  const dz=Math.abs(k)<1e-6?arc*Math.sin(lean):(Math.cos(lean)-Math.cos(angle))/k;
  return{angle,point:new Vector3(0,baseHeight+dy+(length-arc)*Math.cos(angle)-z*Math.sin(angle),dz+(length-arc)*Math.sin(angle)+z*Math.cos(angle))};
}

export function attachMiloSpine(root){
  const skin=root.userData.bodySkin;if(!skin)return;
  const original=skin.skeleton,bones=[...original.bones],inverses=original.boneInverses.map(m=>m.clone());
  const chestIndex=bones.findIndex(b=>b.name==='Milo skin chest'),start=bones.length;
  const drivers=levels.map(y=>{const bone=new Bone();bone.name=`Milo spine ${y}`;root.userData.body.add(bone);bones.push(bone);inverses.push(new Matrix4());return bone;});
  const {position,skinIndex,skinWeight}=skin.geometry.attributes;
  for(let i=0;i<position.count;i++){
    const weights=Array.from({length:4},(_,j)=>({id:skinIndex.array[i*4+j],weight:skinWeight.array[i*4+j]})).filter(v=>v.weight>0);
    const chest=weights.find(v=>v.id===chestIndex);if(!chest)continue;
    const rest=weights.filter(v=>v!==chest),y=position.getY(i),lower=Math.max(0,Math.min(levels.length-2,levels.findLastIndex(level=>y>=level)));
    const blend=MathUtils.clamp((y-levels[lower])/(levels[lower+1]-levels[lower]),0,1);
    if(rest.length>2)rest.push({id:start+lower+(blend>.5?1:0),weight:chest.weight});
    else rest.push({id:start+lower,weight:chest.weight*(1-blend)},{id:start+lower+1,weight:chest.weight*blend});
    for(let j=0;j<4;j++){skinIndex.array[i*4+j]=rest[j]?.id??0;skinWeight.array[i*4+j]=rest[j]?.weight??0;}
  }
  skinIndex.needsUpdate=true;skinWeight.needsUpdate=true;
  skin.bind(new Skeleton(bones,inverses),skin.bindMatrix);original.dispose();
  root.userData.spine={drivers,levels};updateMiloSpine(root);
}

export function updateMiloSpine(root){
  const {spine,spineCurve,chest}=root.userData;if(!spine)return;
  spine.drivers.forEach((bone,i)=>{
    if(!spineCurve){bone.position.copy(chest.position);bone.quaternion.copy(chest.quaternion);bone.scale.copy(chest.scale);return;}
    const {point,angle}=spinePoint(levels[i],0,spineCurve.lean,spineCurve.curl);
    bone.rotation.set(angle,0,0);bone.position.copy(point).sub(new Vector3(0,levels[i],0).applyQuaternion(bone.quaternion));bone.scale.copy(chest.scale);
  });
}

export function applyLoungeSpine(root,lean,curl,headPitch=0){
  const {chest,head,arms}=root.userData;root.userData.spineCurve={lean,curl};
  const shoulder=spinePoint(1.488,0,lean,curl);
  chest.rotation.set(shoulder.angle,0,0);chest.position.copy(shoulder.point).sub(new Vector3(0,1.488,0).applyQuaternion(chest.quaternion));
  for(const {arm,side}of arms)arm.position.copy(shoulder.point).setX(side*.207);
  // A deep reach follows the torso with the gaze instead of extending the
  // neck almost sixty degrees just to keep the face upright.
  head.rotation.x=Math.max(headPitch,spinePoint(1.607,0,lean,curl).angle-.55);
  head.position.copy(spinePoint(1.607,0,lean,curl).point).sub(new Vector3(0,-.030,.009).applyQuaternion(head.quaternion));
}
