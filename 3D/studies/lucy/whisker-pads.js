import { Float32BufferAttribute, Matrix3, Vector3 } from 'three';
import { createWhiskerRootOffsets } from './whisker-roots.js';

const smooth=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};

// Two local muzzle lobes. Preserve the philtrum, nose, lower lip/chin, eyes
// and the previously narrowed head silhouette outside the whisker cushions.
export function whiskerPadOffset(x,y,z) {
  const radius2=((Math.abs(x)-.0105)/.013)**2+((y-.1668)/.0105)**2;
  const round=Math.max(0,1-radius2)**2;
  const mask=round*smooth(.0015,.005,Math.abs(x))*smooth(.243,.261,z)
    *smooth(.157,.160,y)*(1-smooth(.1755,.180,y));
  return [Math.sign(x)*.0022*mask,(y-.1668)*.07*mask,.0044*mask];
}

export function addLucyWhiskerPads(root) {
  let coat;
  root.traverse(mesh=>{if(mesh.isSkinnedMesh&&mesh.material?.name==='Lucy calico coat')coat=mesh;});
  root.traverse(mesh=>{
    if(!['Lucy calico coat','Whiskers'].includes(mesh.material?.name)) return;
    if(mesh.morphTargetDictionary?.WhiskerPads!==undefined) return;
    const roots=mesh.material.name==='Whiskers'?createWhiskerRootOffsets(coat,mesh,whiskerPadOffset):null;
    const offset=roots?.offset??whiskerPadOffset;
    if(roots)mesh.userData.whiskerRoots=roots.anchors;
    const geometry=mesh.geometry.clone(),a=geometry.attributes.position;
    const offsets=new Float32Array(a.count*3);
    for(let i=0;i<a.count;i++) offsets.set(offset(a.getX(i),a.getY(i),a.getZ(i),i),i*3);
    const normals=new Float32Array(offsets.length);
    // Transform the existing smooth normals by the deformation's Jacobian.
    // Recomputing them on UV/color-split triangles creates hard muzzle seams.
    const normalMatrix=new Matrix3(),before=new Vector3(),after=new Vector3(),epsilon=.00001;
    for(let i=0;i<a.count;i++) {
      if(!offsets[i*3]&&!offsets[i*3+1]&&!offsets[i*3+2]) continue;
      const point=[a.getX(i),a.getY(i),a.getZ(i)];
      const derivatives=[0,1,2].map(axis=>{
        const high=point.slice(),low=point.slice();high[axis]+=epsilon;low[axis]-=epsilon;
        const hi=offset(...high,i),lo=offset(...low,i);
        return hi.map((v,j)=>(v-lo[j])/(2*epsilon));
      });
      const [dx,dy,dz]=derivatives;
      normalMatrix.set(1+dx[0],dy[0],dz[0],dx[1],1+dy[1],dz[1],dx[2],dy[2],1+dz[2]).invert().transpose();
      before.fromBufferAttribute(geometry.attributes.normal,i);
      after.copy(before).applyMatrix3(normalMatrix).normalize().sub(before);
      normals.set(after.toArray(),i*3);
    }
    const oldCount=geometry.morphAttributes.position?.length??0;
    geometry.morphAttributes.position??=[];
    geometry.morphAttributes.normal??=Array.from({length:oldCount},()=>new Float32BufferAttribute(new Float32Array(offsets.length),3));
    geometry.morphAttributes.position.push(new Float32BufferAttribute(offsets,3));
    geometry.morphAttributes.normal.push(new Float32BufferAttribute(normals,3));
    geometry.morphTargetsRelative=true;
    const dictionary={...mesh.morphTargetDictionary},influences=[...(mesh.morphTargetInfluences??[])];
    mesh.geometry=geometry;mesh.updateMorphTargets();
    mesh.morphTargetDictionary={...dictionary,WhiskerPads:oldCount};
    mesh.morphTargetInfluences=[...influences,1];
  });
}
