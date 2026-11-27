import * as THREE from 'three';

// Solve against the current limb lengths, including the relocated elbow.
// Targets/poles are in the first joint's parent coordinates.
function solveLimb(first,second,end,target,pole){
  const a=second.position.length(),b=end.position.length();
  const delta=target.clone().sub(first.position),distance=THREE.MathUtils.clamp(delta.length(),Math.abs(a-b)+.0001,a+b-.0001);
  const axis=delta.normalize();
  const bend=pole.clone().sub(first.position);bend.addScaledVector(axis,-bend.dot(axis)).normalize();
  const along=(a*a-b*b+distance*distance)/(2*distance),height=Math.sqrt(Math.max(0,a*a-along*along));
  const joint=first.position.clone().addScaledVector(axis,along).addScaledVector(bend,height);
  const resolved=first.position.clone().addScaledVector(axis,distance);
  first.quaternion.setFromUnitVectors(second.position.clone().normalize(),joint.clone().sub(first.position).normalize());
  const localDirection=resolved.sub(joint).normalize().applyQuaternion(first.quaternion.clone().invert());
  second.quaternion.setFromUnitVectors(end.position.clone().normalize(),localDirection);
}

function orientEnd(first,second,end,worldOrientation){
  end.quaternion.copy(first.quaternion).multiply(second.quaternion).invert().multiply(worldOrientation);
}

// Bind the separate untucked hem to the same waist/hip skin as the shirt.
// A rigid spine rotation alone separates its seam from the blended waist.
function bindHem(root,skin){
  const old=root.getObjectByName('Aloha untucked long hem');if(!old)return;
  const source=skin.geometry.attributes,geometry=old.geometry.clone(),vertices=geometry.attributes.position;
  const waistBones=new Set(skin.skeleton.bones.flatMap((bone,i)=>/^Milo spine |^Milo skin (body|chest|[LR]_leg)$/.test(bone.name)?[i]:[]));
  const candidates=[];
  for(let i=0;i<source.position.count;i++){
    const y=source.position.getY(i),x=source.position.getX(i);
    let waistWeight=0;
    for(let j=0;j<4;j++)if(waistBones.has(source.skinIndex.array[i*4+j]))waistWeight+=source.skinWeight.array[i*4+j];
    if(y>.88&&y<1.18&&Math.abs(x)<.21&&waistWeight>.999)candidates.push(i);
  }
  const indices=new Uint16Array(vertices.count*4),weights=new Float32Array(vertices.count*4);
  const point=new THREE.Vector3(),sample=new THREE.Vector3();
  for(let i=0;i<vertices.count;i++){
    point.fromBufferAttribute(vertices,i);let distance=Infinity,nearest=0;
    for(const candidate of candidates){
      const d=sample.fromBufferAttribute(source.position,candidate).distanceToSquared(point);
      if(d<distance){distance=d;nearest=candidate;}
    }
    for(let j=0;j<4;j++){
      indices[i*4+j]=source.skinIndex.array[nearest*4+j];
      weights[i*4+j]=source.skinWeight.array[nearest*4+j];
    }
  }
  geometry.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(indices,4));
  geometry.setAttribute('skinWeight',new THREE.Float32BufferAttribute(weights,4));
  const hem=new THREE.SkinnedMesh(geometry,old.material);hem.name=old.name;hem.frustumCulled=false;
  hem.bind(skin.skeleton,skin.bindMatrix);old.parent.add(hem);old.removeFromParent();old.geometry.dispose();
}

export function prepareFloorPose(root,arm){
  root.updateMatrixWorld(true);
  const {body,legs,bodySkin:skin}=root.userData;
  bindHem(root,skin);
  const feet=legs.map(({boot})=>{
    const sole=boot.getObjectByName('Anatomical combat boot sole')??boot;
    const point=boot.getWorldPosition(new THREE.Vector3());
    point.y-=new THREE.Box3().setFromObject(sole).min.y;
    return point;
  });
  const {skinIndex,skinWeight}=skin.geometry.attributes;
  const handVertices=new Map(root.userData.arms.map(limb=>{
    const prefix=limb.side<0?'L':'R',pattern=new RegExp(`^Milo skin ${prefix}_(hand|finger|thumb)`);
    const bones=new Set(skin.skeleton.bones.flatMap((bone,i)=>pattern.test(bone.name)?[i]:[])),vertices=[];
    for(let i=0;i<skinIndex.count;i++){
      let weight=0;for(let j=0;j<4;j++)if(bones.has(skinIndex.array[i*4+j]))weight+=skinWeight.array[i*4+j];
      if(weight>.8)vertices.push(i);
    }
    return [limb,vertices];
  }));
  // Palms face the deck; the curled fingers support the weight on the knuckles.
  const palmDown=new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI/2,0,0));
  const point=new THREE.Vector3();
  function handMinimum(limb=arm){
    root.updateMatrixWorld(true);skin.skeleton.update();let min=Infinity;
    for(const i of handVertices.get(limb)){skin.getVertexPosition(i,point);point.applyMatrix4(skin.matrixWorld);min=Math.min(min,point.y);}
    return min;
  }
  return {apply(amount,spread=0,gait=null){
    if(amount<=0)return {contact:false,minY:null};
    const second=THREE.MathUtils.smoothstep(spread,.22,.88)*amount;
    body.position.y-=.32*amount+.025*second;body.position.z-=.12*amount;
    if(gait){body.position.x+=gait.sway;body.position.y+=gait.bob-.015;}
    legs.forEach(({leg,knee,boot,side},i)=>{
      const target=feet[i].clone().sub(body.position);
      // Separate the support lanes and abduct the knees at the hips. Moving
      // only the feet leaves the enlarged thighs pressed together in a crouch.
      target.x+=side*(.15*amount+.025*second);
      if(gait){target.y+=gait.feet[i].lift;target.z+=gait.feet[i].z;}
      const kneePole=new THREE.Vector3(leg.position.x+side*.55*amount,.5,1.05);
      solveLimb(leg,knee,boot,target,kneePole);
      const outward=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),side*.18*amount);
      orientEnd(leg,knee,boot,outward);
    });
    root.updateMatrixWorld(true);
    // A smooth transition down to the fixed support point, ahead of the feet.
    const current=arm.hand.getWorldPosition(new THREE.Vector3());
    const rightStep=gait?.hands[0],leftStep=gait?.hands[1];
    const target=current.lerp(new THREE.Vector3(-.46,.05+(rightStep?.lift??0),.72+(rightStep?.z??0)),amount).sub(body.position);
    const {arm:shoulder,elbow,hand,fingers,thumb}=arm;
    fingers.forEach((finger,i)=>{
      finger.rotation.set(.64,0,(i-1.5)*.025);
      finger.userData.links.forEach((link,j)=>link.rotation.set(j?.95:1.05,0,0));
    });
    thumb.rotation.set(.4,0,-.38);thumb.userData.ip.rotation.set(.55,0,0);
    // Keep the elbow bend ahead of and outside the knee's travel. The old
    // rear-facing poles pulled both swollen joints into the same space.
    const pole=new THREE.Vector3(-1.3,.65,.65);
    const solve=()=>{
      solveLimb(shoulder,elbow,hand,target,pole);
      orientEnd(shoulder,elbow,hand,palmDown);
      root.userData.updateWristTwists?.();
    };
    solve();
    // Correct the support height using the deformed skin, not just the wrist
    // pivot. Enlarged fingers and palm thickness otherwise penetrate the deck.
    if(amount>.999){
      const supportY=.003+(rightStep?.lift??0);
      for(let n=0;n<4;n++){
        const min=handMinimum();if(!Number.isFinite(min)||Math.abs(min-supportY)<.0007)break;
        target.y+=supportY-min;solve();
      }
    }
    // The second hand gradually descends as its elbow and forearm lengthen.
    const other=root.userData.arms.find(a=>a!==arm);
    const freeTarget=new THREE.Vector3(.26,.49,.35).lerp(new THREE.Vector3(.44,.05+(leftStep?.lift??0),.68+(leftStep?.z??0)),second).sub(body.position);
    const initialOrientation=other.hand.getWorldQuaternion(new THREE.Quaternion());
    const handOrientation=initialOrientation.slerp(palmDown,second);
    other.fingers.forEach((finger,i)=>{
      finger.rotation.x=THREE.MathUtils.lerp(finger.rotation.x,.64,second);
      finger.rotation.z=THREE.MathUtils.lerp(finger.rotation.z,(i-1.5)*.025,second);
      finger.userData.links.forEach((link,j)=>{link.rotation.x=THREE.MathUtils.lerp(link.rotation.x,j?.95:1.05,second);});
    });
    if(second>0){other.thumb.rotation.set(.4*second,0,.38*second);other.thumb.userData.ip.rotation.x=.55*second;}
    const otherPole=new THREE.Vector3(.8,.65,0).lerp(new THREE.Vector3(1.3,.65,.65),second);
    const solveOther=()=>{
      solveLimb(other.arm,other.elbow,other.hand,freeTarget,otherPole);
      if(second>0)orientEnd(other.arm,other.elbow,other.hand,handOrientation);
      root.userData.updateWristTwists?.();
    };
    solveOther();
    if(second>.999){
      const supportY=.003+(leftStep?.lift??0);
      for(let n=0;n<8;n++){
        const min=handMinimum(other);if(!Number.isFinite(min)||Math.abs(min-supportY)<.0007)break;
        freeTarget.y+=supportY-min;solveOther();
      }
    }
    root.userData.updateWristTwists?.();
    const minY=handMinimum();
    const feetY=legs.map(({boot})=>new THREE.Box3().setFromObject(boot.getObjectByName('Anatomical combat boot sole')??boot).min.y);
    const otherMinY=second>0?handMinimum(other):null;
    const elbowKneeDistances=root.userData.arms.map(limb=>{
      const leg=legs.find(l=>l.side===limb.side);
      return limb.elbow.getWorldPosition(new THREE.Vector3()).distanceTo(leg.knee.getWorldPosition(new THREE.Vector3()));
    });
    return {contact:amount>.999&&Math.abs(minY-.003)<.004,minY,feetY,otherMinY,elbowKneeDistances,otherContact:second>.999&&Math.abs(otherMinY-.003)<.004};
  }};
}
