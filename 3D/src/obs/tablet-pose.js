import * as THREE from 'three';
import {solveHingeArm} from './arm-ik.js';
import {cloneMiloSkinGeometry} from './milo-elbow.js';

export function createGripHandGeometry(skin,side=0){
    const geometry=cloneMiloSkinGeometry(skin);
    const {position,armRegion,skinIndex,skinWeight}=geometry.attributes;
    const bones=skin.skeleton.bones.map(b=>b.name.replace('Milo skin ','')),smooth=THREE.MathUtils.smoothstep;
    const from=[.160,.185,.212,.234,.256],to=[.172,.186,.200,.214,.228];
    for(let i=0;i<position.count;i++){
      if(armRegion.getX(i)<.95||position.getY(i)>.934||(side&&position.getX(i)*side<0))continue;
      const x=position.getX(i),y=position.getY(i),z=position.getZ(i),handSide=Math.sign(x),prefix=handSide<0?'L':'R';
      let j=0;while(j<from.length-2&&Math.abs(x)>from[j+1])j++;
      const closed=THREE.MathUtils.lerp(to[j],to[j+1],(Math.abs(x)-from[j])/(from[j+1]-from[j]));
      const nx=THREE.MathUtils.lerp(Math.abs(x),closed,1-smooth(y,.880,.934)),ny=.934+(y-.934)*.80;
      position.setXYZ(i,handSide*nx,ny,z);
      if(ny>.910)continue;
      const thumb=(1-smooth(Math.abs(x),.173,.183))*(1-smooth(z,-.020,-.006));
      const rank=THREE.MathUtils.clamp(Math.round((nx-.186)/.014),0,3),finger=handSide<0?3-rank:rank;
      const base=.934-.078+Math.abs(finger-1.5)*.009,curl=1-smooth(ny,base+.004,base+.024);
      const middle=1-smooth(ny,base-.038,base-.018),tip=1-smooth(ny,base-.062,base-.042);
      const weights=[
        [prefix+'_hand',(1-thumb)*(1-curl)],[prefix+'_thumb',thumb],
        [`${prefix}_finger${finger}_0`,(1-thumb)*curl*(1-middle)],
        [`${prefix}_finger${finger}_1`,(1-thumb)*curl*middle*(1-tip)],
        [`${prefix}_finger${finger}_2`,(1-thumb)*curl*middle*tip],
      ].sort((a,b)=>b[1]-a[1]).slice(0,4),sum=weights.reduce((n,w)=>n+w[1],0);
      for(let k=0;k<4;k++){skinIndex.array[i*4+k]=bones.indexOf(weights[k][0]);skinWeight.array[i*4+k]=weights[k][1]/sum;}
    }
    geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();
    return geometry;
}

// Close the imported finger fan for this grip only. Other actions retain their
// original skin; the source fingers are wider/longer than the finger controllers.
export function setTabletHandFit(root,enabled){
  const skin=root.userData.bodySkin;if(!skin)return;
  let fit=root.userData.tabletHandFit;
  if(enabled&&!fit){
    const original=skin.geometry,geometry=createGripHandGeometry(skin);
    fit=root.userData.tabletHandFit={original,geometry};
  }
  if(fit)skin.geometry=enabled?fit.geometry:fit.original;
}

export function applyTabletHands(root){
  const {tablet}=root.userData.leisure;
  for(const rig of root.userData.arms){
    const {arm,elbow,hand,side}=rig;
    const target=new THREE.Vector3(side*.17,.014,-.115).applyQuaternion(tablet.quaternion).add(tablet.position);
    const pose=solveHingeArm(rig,target,new THREE.Vector3(side,-1.3,.1)),forearm=pose.forearm;
    arm.quaternion.copy(pose.upper);elbow.quaternion.copy(pose.lower);
    // Keep the wrist straight and distribute the turn through the forearm.
    const hy=forearm.clone().normalize().negate(),hz=new THREE.Vector3(0,-1,0).applyQuaternion(tablet.quaternion);
    hz.addScaledVector(hy,-hz.dot(hy)).normalize();const hx=hy.clone().cross(hz).normalize();
    const rotation=new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(hx,hy,hz));
    hand.quaternion.copy(arm.quaternion).multiply(elbow.quaternion).invert().multiply(rotation);
    for(const finger of rig.fingers){finger.rotation.set(.15,0,0);finger.userData.links[0].rotation.x=.15;finger.userData.links[1].rotation.x=.08;}
    rig.thumb.position.set(-side*.033,-.051,.013);
    rig.thumb.rotation.set(.35,side*.15,-side*.15);rig.thumb.userData.ip.rotation.x=.1;
  }
}
