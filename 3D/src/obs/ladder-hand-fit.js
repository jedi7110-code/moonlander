import * as THREE from 'three';

// The imported fingers are longer and more widely spaced than the animation
// rig. Fit a reversible mesh copy before bending it; never change source data.
export function setLadderHandFit(root,enabled){
  const skin=root.userData.bodySkin;
  if(!skin)return;
  let fit=root.userData.ladderHandFit;
  if(!fit&&enabled){
    const original=skin.geometry,geometry=original.clone();
    const {position,skinIndex,skinWeight,armRegion}=geometry.attributes;
    const bones=skin.skeleton.bones.map(b=>b.name.replace('Milo skin ',''));
    const smooth=THREE.MathUtils.smoothstep;
    // The general-purpose mesh is pre-shaped for palms-in (90-degree twist).
    // That off-axis taper becomes a paddle when the hand grips straight ahead.
    // Recenter this study's forearm sections on their bone before bending.
    const sections=Array.from({length:2},()=>Array.from({length:28},()=>({x:0,z:0,n:0})));
    for(let i=0;i<position.count;i++){
      const y=position.getY(i);if(armRegion.getX(i)<.95||y<.90||y>=1.236)continue;
      const ring=sections[position.getX(i)<0?0:1][Math.floor((y-.90)/.012)];
      ring.x+=Math.abs(position.getX(i));ring.z+=position.getZ(i);ring.n++;
    }
    for(const side of sections)for(const ring of side)if(ring.n){ring.x/=ring.n;ring.z/=ring.n;}
    for(let i=0;i<position.count;i++){
      const y=position.getY(i),x=position.getX(i),z=position.getZ(i);
      if(armRegion.getX(i)<.95||y<.90||y>=1.22)continue;
      const ring=sections[x<0?0:1][Math.floor((y-.90)/.012)];
      const angle=Math.atan2(z-ring.z,Math.abs(x)-ring.x),t=smooth(y,.934,1.12);
      const blend=smooth(y,.900,.928)*(1-smooth(y,1.14,1.22));
      position.setX(i,THREE.MathUtils.lerp(x,Math.sign(x)*(.207+(.025+.020*t)*Math.cos(angle)),blend));
      position.setZ(i,THREE.MathUtils.lerp(z,(.022+.020*t)*Math.sin(angle),blend));
    }
    const sourceX=[.160,.185,.212,.234,.256],targetX=[.172,.186,.200,.214,.228];
    const mapX=x=>{
      let j=0;while(j<sourceX.length-2&&x>sourceX[j+1])j++;
      return THREE.MathUtils.lerp(targetX[j],targetX[j+1],(x-sourceX[j])/(sourceX[j+1]-sourceX[j]));
    };
    for(let i=0;i<position.count;i++){
      if(armRegion.getX(i)<.95||position.getY(i)>.934)continue;
      const x=position.getX(i),side=Math.sign(x),y=position.getY(i),z=position.getZ(i),prefix=side<0?'L':'R';
      const blend=1-smooth(y,.880,.934),nx=THREE.MathUtils.lerp(Math.abs(x),mapX(Math.abs(x)),blend);
      const ny=.934+(y-.934)*.76;
      position.setXYZ(i,side*nx,ny,z);
      if(ny>.910)continue;
      const thumb=(1-smooth(Math.abs(x),.173,.183))*(1-smooth(z,-.020,-.006));
      const rank=THREE.MathUtils.clamp(Math.round((nx-.186)/.014),0,3),finger=side<0?3-rank:rank;
      const base=.934-.078+Math.abs(finger-1.5)*.009;
      const curl=1-smooth(ny,base+.004,base+.024);
      const middle=1-smooth(ny,base-.038,base-.018),tip=1-smooth(ny,base-.062,base-.042);
      const weights=[
        [prefix+'_hand',(1-thumb)*(1-curl)],
        [prefix+'_thumb',thumb],
        [`${prefix}_finger${finger}_0`,(1-thumb)*curl*(1-middle)],
        [`${prefix}_finger${finger}_1`,(1-thumb)*curl*middle*(1-tip)],
        [`${prefix}_finger${finger}_2`,(1-thumb)*curl*middle*tip],
      ].sort((a,b)=>b[1]-a[1]).slice(0,4);
      const sum=weights.reduce((n,w)=>n+w[1],0);
      for(let j=0;j<4;j++){skinIndex.array[i*4+j]=bones.indexOf(weights[j][0]);skinWeight.array[i*4+j]=weights[j][1]/sum;}
    }
    geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();
    fit=root.userData.ladderHandFit={original,geometry,base:position.array.slice(),corrections:new Map()};
  }
  if(fit){
    skin.geometry=enabled?fit.geometry:fit.original;
    if(!enabled&&fit.watch){
      const w=fit.watch;w.group.position.copy(w.position);w.group.quaternion.copy(w.rotation);w.strap.geometry=w.original;w.caseGroup.position.z=w.caseZ;
    }
  }
}

export function fitLadderWatch(root){
  const fit=root.userData.ladderHandFit,watch=root.userData.watch,skin=root.userData.bodySkin;if(!fit||!watch)return;
  if(!fit.watch){
    const group=watch.group,strap=group.getObjectByName('Fitted graphite watch strap'),caseGroup=group.getObjectByName('GMT case 42 mm');
    const original=strap.geometry,ring=[];
    const {position,armRegion}=fit.geometry.attributes;
    for(let i=0;i<position.count;i++)if(position.getX(i)<-.14&&Math.abs(position.getY(i)-.951)<.007&&armRegion.getX(i)>.95)ring.push(i);
    fit.watch={group,strap,caseGroup,original,geometry:original.clone(),position:group.position.clone(),rotation:group.quaternion.clone(),caseZ:caseGroup.position.z,ring};
  }
  const w=fit.watch;root.updateMatrixWorld(true);skin.skeleton.update();
  const points=w.ring.map(i=>watch.parent.worldToLocal(skin.applyBoneTransform(i,new THREE.Vector3().fromBufferAttribute(fit.geometry.attributes.position,i)).applyMatrix4(skin.matrixWorld)));
  const centre=points.reduce((s,p)=>s.add(p),new THREE.Vector3()).divideScalar(points.length);
  const rx=Math.max(...points.map(p=>Math.abs(p.x-centre.x))),rz=Math.max(...points.map(p=>Math.abs(p.z-centre.z)));
  w.group.position.copy(centre);w.group.quaternion.identity();w.strap.geometry=w.geometry;
  const p=w.geometry.attributes.position;
  for(let i=0;i<p.count;i++){
    const angle=(i%64)/64*Math.PI*2,extra=.0005+(i>=128?.0022:0);
    const radius=1/Math.hypot(Math.cos(angle)/rx,Math.sin(angle)/rz)+extra;
    p.setX(i,Math.cos(angle)*radius);p.setZ(i,Math.sin(angle)*radius);
  }
  p.needsUpdate=true;w.geometry.computeVertexNormals();w.caseGroup.position.z=rz+.001;
}

// A small pose-space contact correction keeps the imported palm/webbing and
// finger pads outside the rung. It fades out when the hand releases the bar.
export function fitLadderGripContact(root,contacts,radius,poseGrip){
  const skin=root.userData.bodySkin,fit=root.userData.ladderHandFit;if(!fit)return;
  const hands=contacts.filter(c=>c.hand),grips=hands.map(c=>c.grip);
  if(fit.lastGrips&&grips.every((g,i)=>g===fit.lastGrips[i]))return;
  const {position,skinIndex,skinWeight,armRegion}=fit.geometry.attributes;
  position.array.set(fit.base);
  const point=new THREE.Vector3(),matrix=new THREE.Matrix4(),boneMatrix=new THREE.Matrix4();
  for(const c of hands){
    if(!fit.corrections.has(c.side)){
      const rig=root.userData.arms.find(a=>a.side===c.side);
      const joints=[...rig.fingers.flatMap(f=>[f,...f.userData.links]),rig.thumb,rig.thumb.userData.ip];
      const saved=joints.map(j=>j.quaternion.clone());
      poseGrip(rig,1);root.updateMatrixWorld(true);skin.skeleton.update();
      const corrections=[];
      for(let i=0;i<position.count;i++){
        if(position.getX(i)*c.side<0||position.getY(i)>.910||armRegion.getX(i)<.95)continue;
        skin.applyBoneTransform(i,point.fromBufferAttribute(position,i)).applyMatrix4(skin.matrixWorld);
        root.worldToLocal(point);
        const dy=point.y-c.point.y,dz=point.z-c.point.z,d=Math.hypot(dy,dz),surface=radius+.001;
        if(d>=surface)continue;
        let palm=0,thumb=0;matrix.elements.fill(0);
        for(let k=0;k<4;k++){
          const index=skinIndex.array[i*4+k],w=skinWeight.array[i*4+k],bone=skin.skeleton.bones[index];
          if(bone.name.endsWith('_hand'))palm+=w;if(bone.name.includes('_thumb'))thumb+=w;
          boneMatrix.multiplyMatrices(bone.matrixWorld,skin.skeleton.boneInverses[index]);
          for(let j=0;j<16;j++)matrix.elements[j]+=w*boneMatrix.elements[j];
        }
        // Blend directions across palm/thumb weights; a hard part boundary
        // would stretch their shared triangles into sharp fins.
        const direction=new THREE.Vector2(dy,dz||-.001).normalize();
        const back=new THREE.Vector2(dy,-Math.sqrt(Math.max(0,surface*surface-dy*dy))).normalize();
        const opposition=new THREE.Vector2(Math.min(dy,-.020),dz||-.001).normalize();
        direction.lerp(back,palm).lerp(opposition,thumb).normalize();
        point.y=c.point.y+direction.x*surface;point.z=c.point.z+direction.y*surface;
        point.applyMatrix4(root.matrixWorld).applyMatrix4(matrix.invert());
        corrections.push([i,point.x-fit.base[i*3],point.y-fit.base[i*3+1],point.z-fit.base[i*3+2]]);
      }
      fit.corrections.set(c.side,corrections);
      joints.forEach((j,i)=>j.quaternion.copy(saved[i]));
    }
    const blend=THREE.MathUtils.smoothstep(c.grip,.65,1);
    for(const [i,x,y,z]of fit.corrections.get(c.side)||[]){position.array[i*3]+=x*blend;position.array[i*3+1]+=y*blend;position.array[i*3+2]+=z*blend;}
  }
  fit.lastGrips=grips;
  position.needsUpdate=true;fit.geometry.computeVertexNormals();
}
