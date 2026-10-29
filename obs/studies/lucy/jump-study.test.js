import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {Quaternion,Vector3} from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {createLucy,animateLucy} from '../../src/obs/lucy.js';
import {sampleJump,createJumpStudy} from './jump-study.js';
test('front paws leave first and land before the hind paws',()=>{
  assert(sampleJump(.58).front>.07);assert.equal(sampleJump(.58).rear,0);
  assert(sampleJump(1.17).front>.25&&sampleJump(1.17).rear>.25);
  assert.equal(sampleJump(1.56).front,0);assert(sampleJump(1.56).rear>.10);
  assert.equal(sampleJump(1.82).rear,0);
  assert(sampleJump(.58).pitch<0&&sampleJump(1.56).pitch>0);
  assert(sampleJump(.58).frontReach>=.08,'reach forward during takeoff, not just upward');
  assert(sampleJump(1.04).frontReach>=.20,'forepaws extend in the direction of travel');
  assert(sampleJump(1.04).rearReach<=-.17,'hind paws extend back after pushing off');
});
test('jump rig keeps feet connected, grounded contacts and source mesh intact',{
  skip:!process.env.LUCY_SLEEP_BASE_ASSET,
},async()=>{
  const bytes=fs.readFileSync(process.env.LUCY_SLEEP_BASE_ASSET);
  const gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
  const cat=createLucy(gltf,{random:()=>.5});animateLucy(cat,{time:0,dt:.1,mode:'idle',yaw:0});
  const jump=createJumpStudy(cat);let coat;cat.traverse(m=>{if(m.material?.name==='Lucy calico coat')coat=m;});
  const original=coat.geometry.attributes.position.array.slice(),a=coat.geometry.attributes.position;
  const lengths=coat.skeleton.bones.filter(b=>!b.name.includes('control')&&b.name!=='CONTROLLER').map(b=>[b,b.position.clone()]);
  let maxGap=0,minFloor=Infinity;
  for(let t=0;t<=3;t+=.03){
    jump.update(t);coat.skeleton.update();
    for(const chain of cat.userData.ik.iks){
      const bones=cat.userData.ik.mesh.skeleton.bones;
      maxGap=Math.max(maxGap,bones[chain.target].getWorldPosition(new Vector3()).distanceTo(bones[chain.effector].getWorldPosition(new Vector3())));
    }
    for(let i=0;i<a.count;i++){
      const p=coat.getVertexPosition(i,new Vector3()).applyMatrix4(coat.matrixWorld);
      assert(p.toArray().every(Number.isFinite));
      if(a.getY(i)<.023&&a.getZ(i)>-.06&&a.getZ(i)<.225)minFloor=Math.min(minFloor,p.y);
    }
    for(const [b,p]of lengths)assert(b.position.equals(p),`${b.name}: preserve bone length`);
  }
  console.log({maxGap,minFloor});assert(maxGap<.008,'IK chains remain attached');assert(minFloor>=-.003,'feet do not sink into floor');
  for(const time of [.58,1.56]){
    jump.update(time);coat.skeleton.update();const feet={front:Infinity,rear:Infinity};
    for(let i=0;i<a.count;i++)if(a.getY(i)<.023&&a.getZ(i)>-.06&&a.getZ(i)<.225&&(a.getZ(i)<.08||a.getZ(i)>.13)){
      const key=a.getZ(i)>.13?'front':'rear';feet[key]=Math.min(feet[key],coat.getVertexPosition(i,new Vector3()).applyMatrix4(coat.matrixWorld).y);
    }
    if(time<1){assert(feet.front>.06);assert(Math.abs(feet.rear+.0015)<.002);}
    else{assert(Math.abs(feet.front+.0015)<.002);assert(feet.rear>.08);}
  }
  for(const time of [.78,1.04,1.17]){
    jump.update(time);
    for(const side of ['L','R']){
      const shoulder=cat.getObjectByName('paw1_'+side).getWorldPosition(new Vector3());
      const wrist=cat.getObjectByName('paw3_'+side).getWorldPosition(new Vector3());
      const head=cat.getObjectByName('Bone004').getWorldPosition(new Vector3());
      assert(wrist.z>head.z+.025,'wrist reaches forward past the head joint');
      assert(wrist.z-shoulder.z>.15,'front limb is extended forward');
      assert(Math.abs(wrist.y-shoulder.y)<.12,'front limb is not hanging below the chest');
      const elbow=cat.getObjectByName('paw2_'+side).getWorldPosition(new Vector3());
      const length=shoulder.distanceTo(elbow)+elbow.distanceTo(wrist);
      assert(shoulder.distanceTo(wrist)/length>.94,'open the elbow instead of folding it under the chest');
    }
  }
  for(const time of [.78,1.04,1.17,1.4]){
    jump.update(time);
    for(const side of ['L','R']){
      const p=name=>cat.getObjectByName(name+side).getWorldPosition(new Vector3());
      const hip=p('leg1_'),knee=p('leg2_'),hock=p('leg3_'),paw=p('feet_');
      const end=cat.getObjectByName('Lucy contact feet_'+side).getWorldPosition(new Vector3());
      assert(paw.z<hip.z-.11,'hind paw trails behind the hip');
      const upperLength=hip.distanceTo(knee)+knee.distanceTo(hock);
      assert(hip.distanceTo(hock)/upperLength>.9,'upper hind leg remains extended behind the body');
      if(time>=1.04){
        const distal=end.clone().sub(hock).normalize(),shin=hock.clone().sub(knee).normalize();
        const toe=new Vector3(0,1,0).applyQuaternion(cat.getObjectByName('feet_'+side).getWorldQuaternion(new Quaternion()));
        assert(distal.y<-.99,'distal hind limb hangs down from the hock');
        assert(distal.dot(toe)>.999,'paw continues straight from the metatarsal, without a second ankle kink');
        assert(shin.dot(distal)<.9,'the visible bend belongs at the hock');
      }
    }
  }
  jump.update(1.56);const planted=cat.getObjectByName('paw3_L').getWorldPosition(new Vector3());
  for(const time of [1.7,1.82,2.12]){
    jump.update(time);assert(cat.getObjectByName('paw3_L').getWorldPosition(new Vector3()).distanceTo(planted)<1e-7,'front contact stays fixed during absorption');
  }
  jump.update(.58);const before=coat.skeleton.bones.map(b=>b.matrixWorld.elements.slice());jump.update(2);jump.update(.58);
  coat.skeleton.bones.forEach((b,i)=>assert.deepEqual(b.matrixWorld.elements,before[i],'seeking is deterministic'));
  assert.deepEqual(coat.geometry.attributes.position.array,original);
});
