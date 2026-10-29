// Study-only relaxation of the strongly folded sleep pose, preserving the face.
import {Mesh,Vector3,Matrix3,Matrix4} from 'three';
export function createSleepSurface(root){
  let source;root.traverse(m=>{if(m.isSkinnedMesh&&m.material.name==='Lucy calico coat')source=m;});
  const geometry=source.geometry.clone();geometry.morphAttributes={};
  const display=new Mesh(geometry,source.material);display.frustumCulled=false;display.castShadow=true;display.receiveShadow=true;display.name='Curled sleep surface';source.parent.add(display);
  const ids=[],reps=[],neighbors=[],lookup=new Map(),masks=[];
  const smooth=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
  for(let i=0;i<geometry.attributes.position.count;i++){
    const v=new Vector3().fromBufferAttribute(geometry.attributes.position,i),key=v.toArray().map(n=>n.toFixed(7)).join(',');
    let id=lookup.get(key);if(id===undefined){id=reps.length;lookup.set(key,id);reps.push(i);neighbors.push(new Set());
      masks.push((1-smooth(.190,.225,v.z))*Math.max(smooth(.025,.060,v.y),1-smooth(-.025,.035,v.z)));
    }ids.push(id);
  }
  const index=geometry.index;
  for(let i=0;i<index.count;i+=3){const tri=[0,1,2].map(k=>ids[index.getX(i+k)]);for(const a of tri)for(const b of tri)if(a!==b)neighbors[a].add(b);}
  const original=reps.map(()=>new Vector3()),points=reps.map(()=>new Vector3()),next=reps.map(()=>new Vector3()),normals=reps.map(()=>new Vector3());
  const mean=new Vector3(),u=new Vector3(),v=new Vector3();
  const skin=new Matrix4(),bone=new Matrix4(),linear=new Matrix3(),volume=new Vector3();
  function update(){
    const weight=root.userData.weights.Sleep??0;source.visible=weight<1e-5;display.visible=!source.visible;if(!display.visible)return;
    display.position.copy(source.position);display.quaternion.copy(source.quaternion);display.scale.copy(source.scale);source.skeleton.update();
    reps.forEach((r,i)=>{
      source.getVertexPosition(r,original[i]);
      const a=source.geometry.attributes;v.fromBufferAttribute(a.position,r);
      // Restore soft inner-ribcage volume lost by the tightly bent spine.
      // The outer back, face and distal limbs retain their original outline.
      let torso=0;for(let k=0;k<4;k++)if(['pelvis','Bone001','Bone002'].includes(source.skeleton.bones[a.skinIndex.getComponent(r,k)].name))torso+=a.skinWeight.getComponent(r,k);
      const mask=smooth(-.035,.005,v.z)*(1-smooth(.145,.190,v.z))*smooth(.045,.080,v.y)*(1-smooth(.160,.190,v.y))*smooth(.30,.75,torso);
      volume.set(Math.max(0,v.x)*.65,-Math.max(0,.14-v.y)*.30,0).multiplyScalar(mask*weight);
      skin.elements.fill(0);
      for(let k=0;k<4;k++){const n=a.skinIndex.getComponent(r,k),w=a.skinWeight.getComponent(r,k);bone.multiplyMatrices(source.skeleton.bones[n].matrixWorld,source.skeleton.boneInverses[n]);bone.elements.forEach((x,j)=>skin.elements[j]+=x*w);}
      skin.premultiply(source.bindMatrixInverse).multiply(source.bindMatrix);volume.applyMatrix3(linear.setFromMatrix4(skin));
      original[i].add(volume);points[i].copy(original[i]);
    });
    for(let step=0;step<28;step++){
      points.forEach((p,i)=>{next[i].copy(p);if(!masks[i]||!neighbors[i].size)return;mean.set(0,0,0);for(const j of neighbors[i])mean.add(points[j]);mean.divideScalar(neighbors[i].size);next[i].lerp(mean,.35*masks[i]);});
      points.forEach((p,i)=>p.copy(next[i]));
    }
    points.forEach((p,i)=>{mean.copy(p).sub(original[i]).clampLength(0,.013);p.copy(original[i]).addScaledVector(mean,weight);
      // Settle the soft underside on the supporting plane instead of lifting
      // the entire cat because one folded breast vertex protrudes downward.
      p.y=Math.max(.0012,p.y);normals[i].set(0,0,0);});
    for(let i=0;i<index.count;i+=3){const[a,b,c]=[0,1,2].map(k=>ids[index.getX(i+k)]);u.subVectors(points[b],points[a]);v.subVectors(points[c],points[a]);u.cross(v);normals[a].add(u);normals[b].add(u);normals[c].add(u);}
    normals.forEach(n=>{if(n.lengthSq()<1e-16)n.set(0,1,0);else n.normalize();});
    ids.forEach((id,i)=>{geometry.attributes.position.setXYZ(i,...points[id]);geometry.attributes.normal.setXYZ(i,...normals[id]);});
    geometry.attributes.position.needsUpdate=true;geometry.attributes.normal.needsUpdate=true;
  }
  return {update,source,display,dispose(){source.visible=true;display.removeFromParent();geometry.dispose();}};
}
