import {Float32BufferAttribute,MathUtils,Matrix3,Matrix4,Quaternion,Vector3} from 'three';

export const MILO_NECK_PROTRACTION=.028;
const collarHeight=-1.35;
const slope=(value,low,high)=>{const t=MathUtils.clamp((value-low)/(high-low),0,1);return 6*t*(1-t)/(high-low);};

export function attachMiloNeck(root){
  const {head}=root.userData,mesh=head.getObjectByName('Milo scanned head');
  if(!mesh)return;
  const geometry=mesh.geometry,{position,normal}=geometry.attributes;
  const offsets=new Float32Array(position.count*3),normals=new Float32Array(position.count*3),vertices=[],shared=new Map();
  const travel=MILO_NECK_PROTRACTION/head.scale.z;
  const heights=root.userData.spine?.levels??[1.38,1.56],low=heights.at(-2),high=heights.at(-1);
  for(let i=0;i<position.count;i++){
    const y=position.getY(i),z=position.getZ(i),front=MathUtils.smoothstep(z,.5,1.6);
    const back=MathUtils.smoothstep(y,collarHeight,.7),jaw=MathUtils.smoothstep(y,collarHeight,-.3);
    const anchor=1-MathUtils.lerp(back,jaw,front);
    offsets[i*3+2]=-travel*anchor;
    // The lower neck cancels the skull translation completely. The changing
    // blend above it bends the neck while leaving the face rigid.
    const dy=travel*MathUtils.lerp(slope(y,collarHeight,.7),slope(y,collarHeight,-.3),front);
    const dz=travel*(jaw-back)*slope(z,.5,1.6);
    if(anchor>0){
      const bodyY=head.position.y+y*head.scale.y;
      const key=[position.getX(i),y,z,normal.getX(i),normal.getY(i),normal.getZ(i)].join(',');
      let vertex=shared.get(key);
      if(!vertex){
        vertex={i,indices:[],anchor,dy:-dy/travel,dz:-dz/travel,spineMix:MathUtils.clamp((bodyY-low)/(high-low),0,1),
          spineSlope:bodyY>low&&bodyY<high?head.scale.y/(high-low):0};
        vertices.push(vertex);shared.set(key,vertex);
      }
      vertex.indices.push(i);
    }
    const nx=normal.getX(i),nz=normal.getZ(i)/(1+dz),ny=normal.getY(i)-dy*nz;
    const length=Math.hypot(nx,ny,nz)||1;
    normals.set([nx/length-normal.getX(i),ny/length-normal.getY(i),nz/length-normal.getZ(i)],i*3);
  }
  const offset=new Float32BufferAttribute(offsets,3);offset.name='Neck root anchor';
  geometry.morphTargetsRelative=true;
  geometry.morphAttributes.position=[offset];
  geometry.morphAttributes.normal=[new Float32BufferAttribute(normals,3)];
  mesh.updateMorphTargets();geometry.computeBoundingBox();geometry.computeBoundingSphere();
  head.updateMatrix();
  root.userData.neckProtraction={mesh,vertices,restPosition:position.array.slice(),restNormal:normal.array.slice(),
    restMatrix:head.matrix.clone(),weight:0,deformed:false};
}

// Interpolate the neck's rotation, not the positions of opposite sides of a
// twisted tube. Keep each cross-section's radius while its centre follows the
// bend. At the collar this still matches the shirt's two spine transforms.
function neckDeformer(lower,upper){
  const lowerRotation=new Quaternion(),upperRotation=new Quaternion(),translation=new Vector3(),scale=new Vector3();
  lower.decompose(translation,lowerRotation,scale);upper.decompose(translation,upperRotation,scale);
  const rotation=new Quaternion(),partial=new Quaternion(),inverseRotation=new Quaternion();
  const centre=new Vector3(),lo=new Vector3(),hi=new Vector3(),offset=new Vector3(),stretched=new Vector3(),upperOffset=new Vector3();
  const a=new Matrix3().setFromMatrix4(lower),b=new Matrix3().setFromMatrix4(upper);
  return(p,anchor,spineMix,out)=>{
    rotation.slerpQuaternions(lowerRotation,upperRotation,spineMix);
    partial.identity().slerp(rotation,anchor);inverseRotation.copy(rotation).invert();
    centre.set(0,p.y,0);lo.copy(centre).applyMatrix4(lower);hi.copy(centre).applyMatrix4(upper);
    lo.lerp(hi,spineMix);centre.lerp(lo,anchor);
    offset.set(p.x,0,p.z);
    stretched.copy(offset).applyMatrix3(a);upperOffset.copy(offset).applyMatrix3(b);
    stretched.lerp(upperOffset,spineMix).applyQuaternion(inverseRotation);
    return out.copy(offset).lerp(stretched,anchor).applyQuaternion(partial).add(centre);
  };
}

export function setMiloNeckProtraction(root,weight){
  const fit=root.userData.neckProtraction;
  if(fit){fit.mesh.morphTargetInfluences[0]=weight;fit.weight=weight;}
}

// The lower scan belongs to the collar; the upper scan belongs to the skull.
// Use the same two upper spine transforms and height weights as the shirt so
// looking ahead during a deep reach cannot pull the neck out of the shoulders.
export function updateMiloNeck(root,{attached=false}={}){
  const {head,spine,spineCurve,neckProtraction:fit}=root.userData;if(!fit)return;
  const {position,normal}=fit.mesh.geometry.attributes;
  if((!spineCurve&&!attached)||!spine){
    if(!fit.deformed)return;
    position.array.set(fit.restPosition);normal.array.set(fit.restNormal);
    fit.deformed=false;fit.lastLower=null;fit.lastUpper=null;
  }else{
    head.updateMatrix();
    const inverse=head.matrix.clone();
    // The static protraction morph already compensates this forward motion.
    inverse.elements[14]-=MILO_NECK_PROTRACTION*fit.weight;inverse.invert();
    const transforms=spine.drivers.slice(-2).map(bone=>{bone.updateMatrix();return new Matrix4().multiplyMatrices(inverse,bone.matrix).multiply(fit.restMatrix);});
    const [lower,upper]=transforms;
    if(fit.lastLower?.equals(lower)&&fit.lastUpper?.equals(upper))return;
    fit.lastLower=lower;fit.lastUpper=upper;
    const deform=neckDeformer(lower,upper),jacobian=new Matrix3(),epsilon=.0001;
    const p=new Vector3(),next=new Vector3(),result=new Vector3(),sample=new Vector3(),n=new Vector3();
    for(const {i,indices,anchor,dy,dz,spineMix,spineSlope}of fit.vertices){
      p.fromArray(fit.restPosition,i*3);deform(p,anchor,spineMix,result);
      // Differentiate the rotational deformation, including the attachment
      // mask, so lighting and ink follow the rounded surface without a seam.
      for(let column=0;column<3;column++){
        next.copy(p).setComponent(column,p.getComponent(column)+epsilon);
        deform(next,MathUtils.clamp(anchor+(column===1?dy:column===2?dz:0)*epsilon,0,1),
          MathUtils.clamp(spineMix+(column===1?spineSlope*epsilon:0),0,1),sample);
        sample.sub(result).multiplyScalar(1/epsilon);
        for(let row=0;row<3;row++)jacobian.elements[column*3+row]=sample.getComponent(row);
      }
      n.fromArray(fit.restNormal,i*3).applyMatrix3(jacobian.invert().transpose()).normalize();
      // The scan is non-indexed: solve shared surface vertices once, then
      // copy them to their triangle corners without changing its topology.
      for(const index of indices){position.setXYZ(index,result.x,result.y,result.z);normal.setXYZ(index,n.x,n.y,n.z);}
    }
    fit.deformed=true;
  }
  position.needsUpdate=true;normal.needsUpdate=true;
  fit.mesh.geometry.computeBoundingBox();fit.mesh.geometry.computeBoundingSphere();
}
