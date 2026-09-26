import {Bone,MathUtils,Matrix4,Skeleton} from 'three';

// Preserve the approved study hinge, skin weights and inner crease in OBS.
export const ELBOW_CENTRE_Z=-.054;
const surfaces=new WeakMap();

// Grip variants must start from neutral skin, not a previous frame's crease.
// Their own forearm/finger fitting can then be deformed independently.
export function cloneMiloSkinGeometry(skin){
  const geometry=skin.geometry.clone(),surface=surfaces.get(skin.geometry);
  if(surface){
    for(const {i,z}of surface.crease)geometry.attributes.position.setZ(i,z);
    for(const i of surface.normalVertices)for(let k=0;k<3;k++)geometry.attributes.normal.array[i*3+k]=surface.normals[i*3+k];
  }
  return geometry;
}

function surfaceState(geometry,rigs){
  if(surfaces.has(geometry))return surfaces.get(geometry);
  const {position,armRegion}=geometry.attributes,crease=[],normalVertices=[],normalMask=new Uint8Array(position.count);
  for(let i=0;i<position.count;i++){
    const y=position.getY(i);if(armRegion.getX(i)<.95)continue;
    if(y>=1.075&&y<=1.30){normalVertices.push(i);normalMask[i]=1;}
    if(y<=1.095||y>=1.275)continue;
    const blend=MathUtils.smoothstep(y,1.095,1.12)*(1-MathUtils.smoothstep(y,1.245,1.275));
    crease.push({i,z:position.getZ(i),rig:rigs[position.getX(i)<0?0:1],fold:Math.exp(-(((y-1.178)/.072)**2))*blend});
  }
  const triangles=[],indices=geometry.index.array;
  for(let i=0;i<indices.length;i+=3)if(normalMask[indices[i]]||normalMask[indices[i+1]]||normalMask[indices[i+2]])triangles.push(indices[i],indices[i+1],indices[i+2]);
  const state={crease,normalVertices,normalMask,triangles,normals:geometry.attributes.normal.array.slice(),sums:new Float32Array(position.count*3)};
  surfaces.set(geometry,state);return state;
}

function updateSurface(geometry,rigs){
  const state=surfaceState(geometry,rigs),{position,normal}=geometry.attributes;
  const key=rigs.map(r=>r.bend.toFixed(6)).join('/');
  if(key===state.key&&position.version===state.positionVersion&&normal.version===state.normalVersion)return;
  for(const {i,rig,z,fold}of state.crease){
    const pressure=Math.sin(Math.min(Math.PI,rig.bend)/2)**2;
    position.setZ(i,z-Math.max(0,z-ELBOW_CENTRE_Z)*.98*pressure*fold);
  }
  // Only elbow normals change. Do not recompute the whole body every frame or
  // overwrite the wrist normals fitted for a cup, tablet or ladder grip.
  const p=position.array,{sums,normalMask,normalVertices,triangles}=state;
  for(const i of normalVertices){sums[i*3]=0;sums[i*3+1]=0;sums[i*3+2]=0;}
  for(let t=0;t<triangles.length;t+=3){
    const a=triangles[t],b=triangles[t+1],c=triangles[t+2],aa=a*3,bb=b*3,cc=c*3;
    const ux=p[cc]-p[bb],uy=p[cc+1]-p[bb+1],uz=p[cc+2]-p[bb+2];
    const vx=p[aa]-p[bb],vy=p[aa+1]-p[bb+1],vz=p[aa+2]-p[bb+2];
    const nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx;
    for(const i of [a,b,c])if(normalMask[i]){sums[i*3]+=nx;sums[i*3+1]+=ny;sums[i*3+2]+=nz;}
  }
  const straight=rigs.every(r=>r.bend<1e-6);
  for(const i of normalVertices){
    const k=i*3,length=Math.hypot(sums[k],sums[k+1],sums[k+2])||1;
    normal.setXYZ(i,...(straight?[state.normals[k],state.normals[k+1],state.normals[k+2]]:[sums[k]/length,sums[k+1]/length,sums[k+2]/length]));
  }
  position.needsUpdate=true;normal.needsUpdate=true;
  state.key=key;state.positionVersion=position.version;state.normalVersion=normal.version;
}

export function attachMiloElbow(root){
  if(root.userData.elbowDeformation)return root.userData.elbowDeformation;
  if(!root.userData.bodySkin)return null;
  const skin=root.userData.bodySkin,originalGeometry=skin.geometry,originalSkeleton=skin.skeleton;
  const geometry=originalGeometry.clone(),bones=[...originalSkeleton.bones],inverses=originalSkeleton.boneInverses.map(m=>m.clone());
  const rigs=root.userData.arms.map(rig=>{
    const prefix=rig.side<0?'L':'R',upper=bones.findIndex(b=>b.name===`Milo skin ${prefix}_arm`),lower=bones.findIndex(b=>b.name===`Milo skin ${prefix}_elbow`);
    const support=new Bone();support.name=`Milo skin ${prefix}_elbow support`;
    const elbowZ=rig.elbow.position.z,handZ=rig.hand.position.z;
    rig.elbow.position.z=ELBOW_CENTRE_Z;rig.hand.position.z-=ELBOW_CENTRE_Z;
    support.position.copy(rig.elbow.position);rig.arm.add(support);
    const centre=new Matrix4().makeTranslation(-rig.side*.207,-1.178,-ELBOW_CENTRE_Z);
    inverses[lower]=centre.clone();const middle=bones.length;bones.push(support);inverses.push(centre);
    const wrists=[1,2].map(n=>({driver:bones.find(b=>b.name===`Milo skin ${prefix}_wrist${n}`).parent,fraction:n/3}));
    return{...rig,upper,lower,middle,support,wrists,elbowZ,handZ};
  });
  const {position,skinIndex,skinWeight,armRegion}=geometry.attributes,smooth=MathUtils.smoothstep;
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
    changed++;
  }
  skin.geometry=geometry;skin.skeleton=new Skeleton(bones,inverses);
  if(root.userData.bandage?.isSkinnedMesh)root.userData.bandage.skeleton=skin.skeleton;
  const originalUpdate=root.userData.updateWristTwists;
  function update(){
    originalUpdate?.();
    for(const rig of rigs){
      rig.support.quaternion.identity().slerp(rig.elbow.quaternion,.5);
      for(const {driver,fraction}of rig.wrists)driver.position.z-=ELBOW_CENTRE_Z*(1-fraction);
      rig.bend=2*Math.acos(MathUtils.clamp(Math.abs(rig.elbow.quaternion.w),0,1));
    }
    updateSurface(skin.geometry,rigs);
    skin.boundingBox=null;skin.boundingSphere=null;
  }
  root.userData.updateWristTwists=update;update();
  return root.userData.elbowDeformation={geometry,changed,update,dispose(){
    root.userData.updateWristTwists=originalUpdate;
    for(const rig of rigs){rig.support.removeFromParent();rig.elbow.position.z=rig.elbowZ;rig.hand.position.z=rig.handZ;}
    skin.geometry=originalGeometry;skin.skeleton.dispose();skin.skeleton=originalSkeleton;geometry.dispose();originalUpdate?.();
    if(root.userData.bandage?.isSkinnedMesh)root.userData.bandage.skeleton=originalSkeleton;
    delete root.userData.elbowDeformation;
  }};
}
