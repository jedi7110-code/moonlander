import {Bone,MathUtils,Matrix4,Skeleton} from 'three';

// Study only: keep the production surface/material and give the elbow its own
// hinge centre and an intermediate skin joint. Nothing imports this from OBS.
export const ELBOW_CENTRE_Z=-.054;
export function attachElbowStudy(root){
  const skin=root.userData.bodySkin,originalGeometry=skin.geometry,originalSkeleton=skin.skeleton;
  const geometry=originalGeometry.clone(),bones=[...originalSkeleton.bones],inverses=originalSkeleton.boneInverses.map(m=>m.clone());
  const rigs=root.userData.arms.map(rig=>{
    const prefix=rig.side<0?'L':'R',upper=bones.findIndex(b=>b.name===`Milo skin ${prefix}_arm`),lower=bones.findIndex(b=>b.name===`Milo skin ${prefix}_elbow`);
    const support=new Bone();support.name=`Milo study ${prefix}_elbow support`;
    const elbowZ=rig.elbow.position.z,handZ=rig.hand.position.z;
    rig.elbow.position.z=ELBOW_CENTRE_Z;rig.hand.position.z-=ELBOW_CENTRE_Z;
    support.position.copy(rig.elbow.position);rig.arm.add(support);
    const centre=new Matrix4().makeTranslation(-rig.side*.207,-1.178,-ELBOW_CENTRE_Z);
    inverses[lower]=centre.clone();const middle=bones.length;bones.push(support);inverses.push(centre);
    const wrists=[1,2].map(n=>({driver:bones.find(b=>b.name===`Milo skin ${prefix}_wrist${n}`).parent,fraction:n/3}));
    return{...rig,upper,lower,middle,support,wrists,elbowZ,handZ};
  });
  const {position,skinIndex,skinWeight,armRegion}=geometry.attributes,smooth=MathUtils.smoothstep;
  const restPositions=position.array.slice(),restNormals=geometry.attributes.normal.array.slice(),crease=[];
  let changed=0;
  for(let i=0;i<position.count;i++){
    const y=position.getY(i);if(armRegion.getX(i)<.95||y<=1.095||y>=1.275)continue;
    const rig=rigs[position.getX(i)<0?0:1],z=position.getZ(i),dy=1.178-y;
    // A tight inner fold and a wider support zone on the olecranon side.
    // This avoids bending the whole upper forearm like a rubber hose.
    const inner=smooth(z,-.063,-.012),span=MathUtils.lerp(.068,.038,inner);
    const f=smooth(dy,-span,span),middle=Math.sin(Math.PI*f)**2*(1-.45*inner);
    const replacement=[[rig.upper,(1-middle)*(1-f)],[rig.middle,middle],[rig.lower,(1-middle)*f]];
    const blend=smooth(y,1.095,1.12)*(1-smooth(y,1.245,1.275));
    const weights=new Map();
    for(let k=0;k<4;k++){const id=skinIndex.array[i*4+k];weights.set(id,(weights.get(id)??0)+skinWeight.array[i*4+k]*(1-blend));}
    for(const [id,weight]of replacement)weights.set(id,(weights.get(id)??0)+weight*blend);
    const sorted=[...weights].sort((a,b)=>b[1]-a[1]).slice(0,4),sum=sorted.reduce((s,p)=>s+p[1],0);
    for(let k=0;k<4;k++){skinIndex.array[i*4+k]=sorted[k]?.[0]??0;skinWeight.array[i*4+k]=(sorted[k]?.[1]??0)/sum;}
    crease.push({i,rig,z,y,blend});
    changed++;
  }
  skin.geometry=geometry;skin.skeleton=new Skeleton(bones,inverses);
  const originalUpdate=root.userData.updateWristTwists;
  let previous='';
  function update(){
    originalUpdate?.();
    for(const rig of rigs){
      rig.support.quaternion.identity().slerp(rig.elbow.quaternion,.5);
      for(const {driver,fraction}of rig.wrists)driver.position.z-=ELBOW_CENTRE_Z*(1-fraction);
      rig.bend=2*Math.acos(MathUtils.clamp(Math.abs(rig.elbow.quaternion.w),0,1));
    }
    const key=rigs.map(r=>r.bend.toFixed(6)).join('/');
    if(key!==previous){
      for(const {i,rig,z,y,blend}of crease){
        // Flesh on the inside compresses into a crease instead of allowing
        // consecutive skin rings to pass through each other at deep flexion.
        const pressure=Math.sin(Math.min(Math.PI,rig.bend)/2)**2;
        const fold=Math.exp(-(((y-1.178)/.072)**2))*blend;
        position.setZ(i,z-Math.max(0,z-ELBOW_CENTRE_Z)*.98*pressure*fold);
      }
      position.needsUpdate=true;geometry.computeVertexNormals();
      const normal=geometry.attributes.normal;
      for(let i=0;i<position.count;i++)if(armRegion.getX(i)<.95||position.getY(i)<1.075||position.getY(i)>1.30)
        normal.setXYZ(i,restNormals[i*3],restNormals[i*3+1],restNormals[i*3+2]);
      if(rigs.every(r=>r.bend<1e-6)){position.array.set(restPositions);normal.array.set(restNormals);}
      normal.needsUpdate=true;previous=key;
    }
    skin.boundingBox=null;skin.boundingSphere=null;
  }
  root.userData.updateWristTwists=update;update();
  return{geometry,changed,update,dispose(){
    root.userData.updateWristTwists=originalUpdate;
    for(const rig of rigs){rig.support.removeFromParent();rig.elbow.position.z=rig.elbowZ;rig.hand.position.z=rig.handZ;}
    skin.geometry=originalGeometry;skin.skeleton.dispose();skin.skeleton=originalSkeleton;geometry.dispose();originalUpdate?.();
  }};
}
