import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Box3,MeshStandardMaterial,Vector3} from 'three';
import {createMilo,animateMilo} from '../src/obs/characters.js';
import {loadMiloBody} from '../src/obs/milo-body.js';
import {applyMocapWalk,sampleWalk} from '../src/obs/mocap-walk.js';
import {BathroomVisit} from '../src/obs/bathroom.js';

const data=JSON.parse(await readFile(new URL('../src/obs/milo-walk-cycle.json',import.meta.url)));
const body=await readFile(new URL('../public/assets/obs/milo/body.json',import.meta.url));
await loadMiloBody(`data:application/json;base64,${body.toString('base64')}`);
const character=()=>createMilo(new Proxy({},{get:(o,k)=>o[k]??=new MeshStandardMaterial()}));
const idle={time:0,moving:false,climbing:false,facing:1,action:null};
function pose(root,time){animateMilo(root,idle);applyMocapWalk(root,data,time);root.updateMatrixWorld(true);}

test('the measured clip is compact, finite, traceable and periodically smooth',()=>{
  assert.match(data.sha256,/^[a-f0-9]{64}$/);
  assert.equal(data.frames.length,data.count);assert.ok(Math.abs(data.duration-1.12)<1e-9);
  for(const frame of data.frames){assert.equal(frame.length,data.names.length*3);assert.ok(frame.every(Number.isFinite));}
  const epsilon=1e-5,a=sampleWalk(data,-epsilon),b=sampleWalk(data,0),c=sampleWalk(data,epsilon);
  assert.deepEqual(sampleWalk(data,data.duration),b);
  for(const name of data.names){
    assert.ok(a[name].distanceTo(c[name])<.0002);
    const v1=b[name].clone().sub(a[name]).divideScalar(epsilon),v2=c[name].clone().sub(b[name]).divideScalar(epsilon);
    assert.ok(v1.distanceTo(v2)<.02,`${name} has a velocity discontinuity`);
  }
});

test('OBS defaults to the approved measured walk and advances by distance, not elapsed time',()=>{
  const root=character(),reference=character();
  const capture=r=>{const {body,chest,head,arms,legs}=r.userData;return [body,chest,head,...arms.flatMap(a=>[a.arm,a.elbow,a.hand]),...legs.flatMap(l=>[l.leg,l.knee,l.boot])].flatMap(o=>[...o.position.toArray(),...o.quaternion.toArray()]);};
  for(let i=0;i<24;i++){
    const time=i/24*data.duration;
    pose(reference,time);
    for(const clock of [0,127]){
      animateMilo(root,{...idle,moving:true,time:clock,walkDistance:i/24*data.cycleDistance});
      const expected=capture(reference);capture(root).forEach((v,j)=>assert.ok(Math.abs(v-expected[j])<1e-9));
    }
  }
  for(const extra of [{waiting:true},{climbing:true}]){
    animateMilo(root,{...idle,moving:true,walkDistance:.31,...extra});
    animateMilo(reference,{...idle,moving:true,walkDistance:.31,walkStyle:'legacy',...extra});
    assert.deepEqual(capture(root),capture(reference));
  }
});

for(const id of ['shower','toilet'])test(`${id}: entry and exit use the same distance-driven measured walk as the aisle`,()=>{
  const root=character(),reference=character(),visit=new BathroomVisit(id);
  const capture=r=>{const {body,chest,head,arms,legs}=r.userData;return [body,chest,head,...arms.flatMap(a=>[a.arm,a.elbow,a.hand]),...legs.flatMap(l=>[l.leg,l.knee,l.boot])].flatMap(o=>[...o.position.toArray(),...o.quaternion.toArray()]);};
  const phases=new Set();
  for(let frame=0;!visit.done&&frame<120*12;frame++){
    const bathroom=visit.pose;
    if(bathroom.moving&&frame%7===0){
      phases.add(bathroom.phase);
      for(const clock of [0,127]){
        animateMilo(root,{...idle,time:clock,action:id,bathroom,walkDistance:999,dt:0});
        animateMilo(reference,{...idle,moving:true,walkDistance:bathroom.walkDistance});
        const expected=capture(reference);
        capture(root).forEach((v,j)=>assert.ok(Math.abs(v-expected[j])<1e-9,`${bathroom.phase}: old gait or incorrect distance at ${j}`));
        assert.equal(root.position.z,bathroom.depth);
        root.updateMatrixWorld(true);
        const heights=root.userData.legs.map(({boot})=>new Box3().setFromObject(boot).min.y);
        assert.ok(heights.every(h=>h>=-.002)&&Math.min(...heights)<.012,'boots keep the measured ground contact');
      }
    }
    if(visit.phase==='use')visit.requestExit();
    visit.update(1/120);
  }
  assert.ok(visit.done);assert.deepEqual([...phases],['enter','leave']);
  animateMilo(root,{...idle,action:id,bathroom:visit.pose});
  animateMilo(reference,{...idle,action:id});
  assert.deepEqual(capture(root),capture(reference),'exit removes the measured walk pose');
});

test('both boots clear the floor while one foot remains in support',()=>{
  const root=character(),lifts=[0,0],contacts=[0,0];
  for(let i=0;i<240;i++){
    pose(root,i/240*data.duration);let ground=Infinity;
    root.userData.legs.forEach(({boot},j)=>{
      const height=new Box3().setFromObject(boot).min.y;
      assert.ok(height>=-.002,`sole penetrates floor: ${height}`);
      lifts[j]=Math.max(lifts[j],height);ground=Math.min(ground,height);
      if(height<.012)contacts[j]++;
    });
    assert.ok(ground<.012,'walking must not become a floating run');
  }
  for(let j=0;j<2;j++){assert.ok(lifts[j]>.04);assert.ok(contacts[j]>90);}
});

test('the connected body stays finite, keeps its rest shape and joins the head during mocap',()=>{
  const root=character(),{bodySkin:skin,chest,head}=root.userData,p=skin.geometry.attributes.position;
  const original=p.array.slice();
  for(let i=0;i<32;i++){
    pose(root,i/32*data.duration);skin.skeleton.update();
    const scanBase=new Vector3(0,-.030,.009).applyQuaternion(head.quaternion).add(head.position);
    assert.ok(scanBase.distanceTo(new Vector3(0,1.607,0).applyMatrix4(chest.matrix))<1e-9);
    for(let j=0;j<p.count;j+=17){
      const v=skin.applyBoneTransform(j,new Vector3().fromBufferAttribute(p,j));
      assert.ok(v.toArray().every(Number.isFinite));assert.ok(v.length()<3);
    }
  }
  assert.deepEqual(p.array,original);
});

test('measured transforms do not leak into idle, the old walk, climbing or sitting',()=>{
  const root=character(),fresh=character();
  const capture=r=>{const {body,chest,head,arms,legs}=r.userData;return [body,chest,head,...arms.flatMap(a=>[a.arm,a.elbow,a.hand,...a.fingers.flatMap(f=>[f,...f.userData.links])]),...legs.flatMap(l=>[l.leg,l.knee,l.boot])].flatMap(o=>[...o.position.toArray(),...o.quaternion.toArray(),...o.scale.toArray()]);};
  for(const extra of [{},{moving:true,walkDistance:.3,walkStyle:'legacy'},{moving:true,climbing:true},{action:'console',actionTime:3,actionDuration:8}]){
    pose(root,.43);animateMilo(root,{...idle,...extra});animateMilo(fresh,{...idle,...extra});
    const expected=capture(fresh);capture(root).forEach((v,i)=>assert.ok(Math.abs(v-expected[i])<1e-9,`pose reset differs at ${i}`));
  }
});

test('measured walking closes the upper arms without losing forward swing or elbow bend',()=>{
  const root=character();
  for(let i=0;i<64;i++){
    const time=i/64*data.duration,p=sampleWalk(data,time);pose(root,time);
    const y=p.Neck.clone().sub(p.Hips).normalize(),across=p.RightArm.clone().sub(p.LeftArm);
    const x=across.addScaledVector(y,-across.dot(y)).normalize(),z=new Vector3().crossVectors(x,y);
    for(const {arm,elbow,side}of root.userData.arms){
      const prefix=side<0?'Left':'Right',a=p[prefix+'ForeArm'].clone().sub(p[prefix+'Arm']).normalize(),b=p[prefix+'Hand'].clone().sub(p[prefix+'ForeArm']).normalize();
      const actual=new Vector3(0,-1,0).applyQuaternion(arm.quaternion).applyQuaternion(root.userData.chest.quaternion.clone().invert());
      assert.ok(Math.abs(Math.atan2(actual.x,-actual.y)-.68*Math.atan2(a.dot(x),-a.dot(y)))<1e-9);
      assert.ok(Math.abs(actual.z-a.dot(z))<1e-9,'front-to-back swing is retained');
      assert.ok(Math.abs(new Vector3(0,-1,0).dot(new Vector3(0,-1,0).applyQuaternion(elbow.quaternion))-a.dot(b))<1e-9,'elbow flexion is retained');
    }
  }
});

test('shorter forearms keep the wrists above the crotch without changing the upper arms or hands',()=>{
  const root=character();
  for(let i=0;i<120;i++){
    pose(root,i/120*data.duration);
    const crotch=root.userData.body.localToWorld(new Vector3(0,.875,0));
    for(const {elbow,hand}of root.userData.arms){
      assert.equal(elbow.position.y,-.310);assert.equal(hand.position.y,-.244);
      assert.ok(hand.getWorldPosition(new Vector3()).y>crotch.y+.035,'wrist should sit clearly above the crotch');
      assert.deepEqual(hand.scale.toArray(),[1.16,1.05,1.08].map(v=>v*1.08));
    }
  }
});
