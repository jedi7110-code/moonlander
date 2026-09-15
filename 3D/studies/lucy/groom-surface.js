// Reference posed-space solver. The accepted cabin version uses its baked
// correction cache; this iterative solve does not run during OBS playback.
import {Mesh,Vector3,Matrix3,Matrix4} from 'three';

const smooth=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
export function createGroomSurface(root){
  let source;root.traverse(m=>{if(m.isSkinnedMesh&&m.material.name==='Lucy calico coat')source=m;});
  if(!source)throw new Error('Lucy coat not found');
  const geometry=source.geometry.clone();geometry.morphAttributes={};
  const display=new Mesh(geometry,source.material);display.name='Groom surface study';
  display.frustumCulled=false;display.visible=false;display.castShadow=source.castShadow;display.receiveShadow=source.receiveShadow;
  source.parent.add(display);
  const a=source.geometry.attributes,ids=[],representatives=[],neighbors=[],lookup=new Map(),masks=[],underChest=[],sides=[];
  for(let i=0;i<a.position.count;i++){
    const v=new Vector3().fromBufferAttribute(a.position,i),key=v.toArray().map(x=>x.toFixed(7)).join(',');
    let id=lookup.get(key);
    if(id===undefined){
      id=representatives.length;lookup.set(key,id);representatives.push(i);neighbors.push(new Set());
      // Throat/chest and axilla only: head, lower limbs, hips and feet pinned.
      masks.push(smooth(.085,.135,v.z)*(1-smooth(.205,.235,v.z))
        *smooth(.050,.085,v.y)*(1-smooth(.175,.200,v.y)));
      let torso=0;
      for(let k=0;k<4;k++)if(['pelvis','Bone001','Bone002'].includes(source.skeleton.bones[a.skinIndex.getComponent(i,k)].name))torso+=a.skinWeight.getComponent(i,k);
      underChest.push(smooth(.045,.080,v.z)*(1-smooth(.125,.155,v.z))
        *smooth(.052,.075,v.y)*(1-smooth(.110,.145,v.y))*smooth(.05,.40,torso));
      sides.push(smooth(-.035,.025,v.x));
    }
    ids.push(id);
  }
  const index=geometry.index;
  for(let i=0;i<index.count;i+=3){const tri=[0,1,2].map(k=>ids[index.getX(i+k)]);for(const x of tri)for(const y of tri)if(x!==y)neighbors[x].add(y);}
  const original=representatives.map(()=>new Vector3()),work=original.map(()=>new Vector3()),next=original.map(()=>new Vector3());
  const sums=original.map(()=>new Vector3()),normal=new Vector3(),edge=new Vector3(),cross=new Vector3(),delta=new Vector3();
  const skin=new Matrix4(),bone=new Matrix4(),normalSkin=new Matrix3();
  const shoulderL=root.getObjectByName('paw1_L'),shoulderR=root.getObjectByName('paw1_R');
  const pawL=root.getObjectByName('paw3_L'),pawR=root.getObjectByName('paw3_R');
  const anchor=new Vector3(),paw=new Vector3();
  const lift=(shoulder,foot)=>{
    source.worldToLocal(shoulder.getWorldPosition(anchor));source.worldToLocal(foot.getWorldPosition(paw));
    return smooth(-.075,.015,paw.y-anchor.y);
  };
  function update(enabled=true,{skinFit=true}={}){
    const weight=enabled?(root.userData.weights.Groom??0):0;
    source.visible=weight<1e-5;display.visible=!source.visible;
    if(!display.visible)return {weight,maxShift:0};
    display.position.copy(source.position);display.quaternion.copy(source.quaternion);display.scale.copy(source.scale);
    source.skeleton.update();
    representatives.forEach((vertex,i)=>{source.getVertexPosition(vertex,original[i]);work[i].copy(original[i]);});
    const left=skinFit?lift(shoulderL,pawL):0,right=skinFit?lift(shoulderR,pawR):0;
    const raised=Math.max(left,right),fitMasks=underChest.map((m,i)=>m*(raised*.45+(left*sides[i]+right*(1-sides[i]))*.55));
    // Lift/retract the excess lower breast toward the rib cage as a paw rises.
    // Drive this from the solved limb positions, not an animation timestamp.
    // The opposite side and boundary fade smoothly; sitting remains untouched.
    work.forEach((p,i)=>{p.y+=.014*fitMasks[i];p.z-=.030*fitMasks[i];});
    // Solve in the current animated pose, not in a frozen seated pose. Fade at
    // the boundary and cap movement so this cannot inflate the whole shoulder.
    for(let step=0;step<40;step++){
      for(let i=0;i<work.length;i++){
        const mask=Math.max(masks[i],fitMasks[i]);
        next[i].copy(work[i]);if(!mask||!neighbors[i].size)continue;
        delta.set(0,0,0);for(const j of neighbors[i])delta.add(work[j]);delta.divideScalar(neighbors[i].size);
        next[i].lerp(delta,.42*mask);
      }
      work.forEach((p,i)=>p.copy(next[i]));
    }
    let maxShift=0;
    work.forEach((p,i)=>{delta.copy(p).sub(original[i]).clampLength(0,.022+.038*fitMasks[i]);p.copy(original[i]).addScaledVector(delta,weight);maxShift=Math.max(maxShift,delta.length()*weight);sums[i].set(0,0,0);});
    for(let i=0;i<index.count;i+=3){
      const [x,y,z]=[0,1,2].map(k=>ids[index.getX(i+k)]);
      edge.subVectors(work[y],work[x]);cross.subVectors(work[z],work[x]).cross(edge).negate();
      sums[x].add(cross);sums[y].add(cross);sums[z].add(cross);
    }
    sums.forEach(n=>n.normalize());
    for(let i=0;i<a.position.count;i++){
      const id=ids[i];geometry.attributes.position.setXYZ(i,...work[id]);
      // Keep the existing shading outside the edited neighborhood. Within it,
      // derive normals from the actual posed triangles, including split seams.
      normal.fromBufferAttribute(a.normal,i);
      const morphNormals=source.geometry.morphAttributes.normal??[];
      morphNormals.forEach((attr,k)=>{const w=source.morphTargetInfluences[k];if(w)normal.addScaledVector(delta.fromBufferAttribute(attr,i),w);});
      skin.elements.fill(0);
      for(let k=0;k<4;k++){
        const n=a.skinIndex.getComponent(i,k),w=a.skinWeight.getComponent(i,k);
        bone.multiplyMatrices(source.skeleton.bones[n].matrixWorld,source.skeleton.boneInverses[n]);
        bone.elements.forEach((v,j)=>skin.elements[j]+=v*w);
      }
      skin.premultiply(source.bindMatrixInverse).multiply(source.bindMatrix);
      normal.applyMatrix3(normalSkin.setFromMatrix4(skin)).normalize();
      normal.lerp(sums[id],smooth(0,.18,Math.max(masks[id],fitMasks[id]))*weight).normalize();
      geometry.attributes.normal.setXYZ(i,...normal);
    }
    geometry.attributes.position.needsUpdate=true;geometry.attributes.normal.needsUpdate=true;
    return {weight,maxShift,leftLift:left,rightLift:right};
  }
  const correctionMask=ids.map(id=>Math.max(masks[id],underChest[id]));
  return {update,source,display,masks,correctionMask,dispose(){source.visible=true;display.removeFromParent();geometry.dispose();}};
}
