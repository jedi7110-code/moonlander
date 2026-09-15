import {Quaternion,Vector3} from 'three';
import {addSleepingEyelids} from './sleep-eyelids.js';
import {forepawSlide} from './forepaw-slide.js';

export const STRETCH_DURATION=8;
const smooth=(a,b,t)=>{const u=Math.max(0,Math.min(1,(t-a)/(b-a)));return u*u*u*(10+u*(-15+6*u));};
export function sampleStretch(time){
  const t=Math.max(0,Math.min(STRETCH_DURATION,time));
  const weight=smooth(.35,1.5,t)*(1-smooth(5.6,6.7,t));
  const pull=smooth(1.5,2.6,t)*(1-smooth(4.7,5.6,t));
  const release=1-smooth(4.7,5.6,t);
  const headPull=smooth(.10,1.1,t)*release;
  const neckPull=smooth(.30,1.5,t)*release;
  const eyes=smooth(.35,.9,t)*(1-smooth(6.2,6.75,t));
  return {weight,pull,headPull,neckPull,eyes,left:weight,right:weight,
    phase:t<.10?'立位':t<.35?'頭から先に引く':t<1.5?'頭・首に続いて前足を置く':t<4.7?'足先を固定し、腰を後ろ上へ引く':t<5.6?'足先を固定したまま緩める':t<6.7?'ゆっくり戻す':'立位へ戻る'};
}

// Keep the already-fitted socket boundary but soften the radial cone at its
// center. A near-frontal stretch makes the old radial shading conspicuous.
function softenLids(root){
  for(const side of ['L','R']){
    const lid=root.getObjectByName('Sleeping eyelid '+side),a=lid.geometry.attributes.position;
    const segments=64,start=a.count-segments;
    const rim=Array.from({length:segments},(_,i)=>new Vector3().fromBufferAttribute(a,start+i));
    const center=rim.reduce((sum,p)=>sum.add(p),new Vector3()).divideScalar(segments);
    let xx=0,yy=0,xz=0,yz=0;
    for(const p of rim){const x=p.x-center.x,y=p.y-center.y,z=p.z-center.z;xx+=x*x;yy+=y*y;xz+=x*z;yz+=y*z;}
    const sx=xz/xx,sy=yz/yy,rx=(Math.max(...rim.map(p=>p.x))-Math.min(...rim.map(p=>p.x)))/2,ry=.0045;
    const plane=(x,y)=>center.z+sx*(x-center.x)+sy*(y-center.y);
    const edge=(x,y)=>{
      const angle=(Math.atan2((y-center.y)/ry,(x-center.x)/rx)+Math.PI*2)%(Math.PI*2);
      const at=angle/(Math.PI*2)*segments,i=Math.floor(at),u=at-i;
      return rim[i].z*(1-u)+rim[(i+1)%segments].z*u;
    };
    function depth(x,y,r){return plane(x,y)+.0004*(1-r*r)+(edge(x,y)-plane(x,y))*smooth(.72,1,r);}
    for(let i=0;i<a.count;i++){
      const r=i===0?0:(Math.floor((i-1)/segments)+1)/12;
      a.setZ(i,depth(a.getX(i),a.getY(i),r));
    }
    a.needsUpdate=true;lid.geometry.computeVertexNormals();
    const crease=root.getObjectByName('Sleeping eyelid crease '+side),c=crease.geometry.attributes.position;
    for(let i=0;i<c.count;i++){
      const x=c.getX(i),y=c.getY(i),r=Math.min(1,Math.hypot((x-center.x)/rx,(y-center.y)/ry));
      const old=center.z+(edge(x,y)-center.z)*r+.00015*(1-r*r)-.00002*r**8;
      c.setZ(i,c.getZ(i)+depth(x,y,r)-old);
    }
    c.needsUpdate=true;crease.geometry.computeVertexNormals();
  }
}

// Study-only bow stretch. Restore the intact rig before every sample so
// scrubbing cannot accumulate rotations or alter the approved cabin poses.
export function createStretchStudy(root,{floorY=-.002}={}){
  addSleepingEyelids(root);
  softenLids(root);
  const rest=[],eyes=[],lids=[],blink=[];
  root.traverse(b=>{
    if(b.isBone)rest.push({b,p:b.position.clone(),q:b.quaternion.clone(),s:b.scale.clone()});
    if(['Hazel iris','Pupils and eye margin'].includes(b.material?.name))eyes.push(b);
    if(b.name.startsWith('Sleeping eyelid'))lids.push(b);
    if(b.morphTargetDictionary?.Blink!==undefined)blink.push(b);
  });
  root.updateMatrixWorld(true);
  const controller=root.getObjectByName('CONTROLLER'),origin=controller.getWorldPosition(new Vector3());
  let coat;root.traverse(m=>{if(m.material?.name==='Lucy calico coat')coat=m;});
  const a=coat.geometry.attributes.position,p=new Vector3(),feet=[];
  coat.skeleton.update();
  for(const side of ['L','R'])for(const rear of [false,true]){
    const bone=root.getObjectByName((rear?'leg3_control_':'paw_control_')+side);
    const vertices=[];let low=Infinity;
    for(let i=0;i<a.count;i++)if(a.getY(i)<.023&&(side==='L'?a.getX(i)>0:a.getX(i)<0)
      &&(rear?a.getZ(i)>-.06&&a.getZ(i)<.08:a.getZ(i)>.13&&a.getZ(i)<.225)){
      vertices.push(i);low=Math.min(low,coat.getVertexPosition(i,p).applyMatrix4(coat.matrixWorld).y);
    }
    feet.push({bone,side,rear,vertices,origin:bone.getWorldPosition(new Vector3()),clearance:floorY+.0005-low});
  }
  function place(bone,world){bone.position.copy(bone.parent.worldToLocal(world));root.updateMatrixWorld(true);}
  function pitch(name,angle){
    const b=root.getObjectByName(name),axis=new Vector3(1,0,0).applyQuaternion(b.parent.getWorldQuaternion(new Quaternion()).invert());
    b.quaternion.premultiply(new Quaternion().setFromAxisAngle(axis,angle));root.updateMatrixWorld(true);
  }
  function aim(bone,child,target){
    const at=bone.getWorldPosition(new Vector3());
    const turn=new Quaternion().setFromUnitVectors(child.getWorldPosition(new Vector3()).sub(at).normalize(),target.clone().sub(at).normalize());
    bone.quaternion.copy(bone.parent.getWorldQuaternion(new Quaternion()).invert().multiply(turn.multiply(bone.getWorldQuaternion(new Quaternion()))));
    root.updateMatrixWorld(true);
  }
  function foreleg(f,extension){
    const upper=root.getObjectByName('paw1_'+f.side),lower=root.getObjectByName('paw2_'+f.side),end=root.getObjectByName('Lucy contact paw3_'+f.side);
    for(const b of [upper,lower])b.quaternion.copy(rest.find(r=>r.b===b).q);root.updateMatrixWorld(true);
    const shoulder=upper.getWorldPosition(new Vector3()),elbow=lower.getWorldPosition(new Vector3()),tip=end.getWorldPosition(new Vector3());
    const target=f.bone.getWorldPosition(new Vector3()),l1=shoulder.distanceTo(elbow),l2=elbow.distanceTo(tip);
    // The scapula can slide on the ribcage; the planted paw cannot slide
    // when the torso draws back. Stop the shoulder at full arm extension.
    const span=shoulder.clone().sub(target),reach=(l1+l2)*.99999;
    const minimum=(l1+l2)*(.985+.01499*extension);
    const distanceToPaw=Math.max(minimum,Math.min(span.length(),reach));
    shoulder.copy(target).addScaledVector(span.normalize(),distanceToPaw);place(upper,shoulder.clone());
    const axis=target.clone().sub(shoulder),distance=axis.length();axis.normalize();
    // A fixed rearward pole keeps the elbow on its natural side. Never
    // push it above the shoulder-to-wrist line (the old reverse kink).
    const pole=new Vector3(0,0,-1);
    pole.addScaledVector(axis,-pole.dot(axis)).normalize();
    const along=(l1*l1-l2*l2+distance*distance)/(2*distance);
    const bend=shoulder.clone().addScaledVector(axis,along).addScaledVector(pole,Math.sqrt(Math.max(0,l1*l1-along*along)));
    aim(upper,lower,bend);aim(lower,end,target);place(f.bone,target);
  }
  function update(time){
    const pose=sampleStretch(time),w=pose.weight,pull=pose.pull,{headPull,neckPull}=pose;
    rest.forEach(({b,p,q,s})=>{b.position.copy(p);b.quaternion.copy(q);b.scale.copy(s);});
    root.updateMatrixWorld(true);
    place(controller,origin.clone().add(new Vector3(0,.012*w+.012*pull-.004,-.010*w-.015*pull)));
    pitch('pelvis',.62*w-.05*pull);pitch('Bone001',.08*w);pitch('Bone002',-.32*w-.14*neckPull);pitch('Bone004',-.30*w+.14*headPull);
    // Draw the whole neck back toward the chest, not just the chin angle.
    // The head, closed lids and whiskers follow together; feet and hips do not move.
    const neck=root.getObjectByName('Bone002');
    place(neck,neck.getWorldPosition(new Vector3()).add(new Vector3(0,0,-.028*neckPull)));
    // Only a transient lead offset: it vanishes when the neck catches up,
    // preserving the accepted full-stretch position and retraction amount.
    const head=root.getObjectByName('Bone004');
    place(head,head.getWorldPosition(new Vector3()).add(new Vector3(0,0,-.028*(headPull-neckPull))));
    // Counter the hip tilt: the tail stays lifted with a relaxed curved tip.
    pitch('tail1',-1.05*w);pitch('tail2',-.20*w);pitch('tail3',.13*w);pitch('tail4',.16*w);pitch('tail5',.10*w);
    for(const f of feet){
      place(f.bone,f.rear?f.origin.clone().add(new Vector3(0,f.clearance,0)):forepawSlide(f,w,.142));
    }
    for(let pass=0;pass<5;pass++){root.userData.ik.update();root.updateMatrixWorld(true);}
    feet.filter(f=>!f.rear).forEach(f=>foreleg(f,w));
    // Skin at the wrist blends two joints. Seat its actual sole, not just
    // the control point, without flattening or projecting any skin vertices.
    for(let pass=0;pass<2;pass++)for(const f of feet)if(!f.rear){
      coat.skeleton.update();let low=Infinity;
      for(const i of f.vertices)low=Math.min(low,coat.getVertexPosition(i,p).applyMatrix4(coat.matrixWorld).y);
      const target=f.bone.getWorldPosition(new Vector3());
      target.y+=floorY+.0005-low;
      place(f.bone,target);foreleg(f,w);
    }
    const closed=pose.eyes>=.985;
    // The fitted cap supplies the closed surface. Don't also collapse the
    // coat's blink morph onto it, which makes two coplanar lids flicker.
    for(const mesh of blink)mesh.morphTargetInfluences[mesh.morphTargetDictionary.Blink]=closed?0:pose.eyes;
    eyes.forEach(m=>m.visible=!closed);lids.forEach(m=>m.visible=closed);
    root.updateMatrixWorld(true);
    return pose;
  }
  update(0);
  return {update,feet,eyes,lids};
}
