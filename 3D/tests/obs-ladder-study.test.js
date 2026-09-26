import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {MeshStandardMaterial,Vector3,Quaternion} from 'three';
import {loadMiloBody} from '../src/obs/milo-body.js';
import {createMilo,animateMilo} from '../src/obs/characters.js';
import {cloneMiloSkinGeometry} from '../src/obs/milo-elbow.js';
import {LADDER,LADDER_WRIST_OFFSET,sampleLadder,applyLadderStudy} from '../studies/milo/ladder-study.js';
import {setLadderHandFit} from '../studies/milo/ladder-hand-fit.js';
const bytes=await readFile(new URL('../public/assets/obs/milo/body.json',import.meta.url));
await loadMiloBody(`data:application/json;base64,${bytes.toString('base64')}`);

test('ladder study holds at least three contacts on real rungs and closes the climbing loop',()=>{
  for(let i=0;i<=400;i++){
    const sample=sampleLadder(i/100);
    assert.ok(sample.contacts.filter(c=>!c.moving).length>=3);
    for(const c of sample.contacts.filter(c=>!c.moving)){
      const rung=(c.point.y+sample.travel)/LADDER.spacing;
      assert.ok(Math.abs(rung-Math.round(rung))<1e-9);
      assert.equal(c.point.z,LADDER.depth);
      const next=sampleLadder(i/100+.00001).contacts.find(n=>n.id===c.id);
      if(!next.moving)assert.ok(Math.abs(next.point.y-c.point.y+.00001*2*LADDER.spacing/LADDER.duration)<1e-9,'held limbs move exactly with the ladder');
    }
  }
  const first=sampleLadder(0),last=sampleLadder(LADDER.duration);
  first.contacts.forEach((c,i)=>assert.ok(c.point.distanceTo(last.contacts[i].point)<1e-9));
});

test('actual Milo hands and boot soles reach their targets continuously without stretching the shoulders',()=>{
  const root=createMilo(new Proxy({},{get:(o,k)=>o[k]??=new MeshStandardMaterial()}));
  let previous=null;
  for(let i=0;i<=240;i++){
    animateMilo(root,{time:0,moving:false,facing:1});root.rotation.y=0;
    const sample=applyLadderStudy(root,i/60);root.updateMatrixWorld(true);
    const points=[];
    for(const c of sample.contacts){
      if(c.hand){
        const rig=root.userData.arms.find(r=>r.side===c.side);
        const wrist=rig.hand.getWorldPosition(new Vector3());
        assert.ok(wrist.distanceTo(c.point.clone().add(LADDER_WRIST_OFFSET))<.001);
        assert.ok(rig.arm.position.distanceTo(new Vector3(c.side*.207,1.488,0))<.001,'shoulder must not stretch to the rung');
        points.push(wrist);
      }else{
        const rig=root.userData.legs.find(r=>r.side===c.side);
        const sole=rig.boot.localToWorld(new Vector3(0,-.107,.12));
        assert.ok(sole.distanceTo(c.point.clone().add(new Vector3(0,LADDER.radius,0)))<.001,'sole must stay on its supporting rung');
        points.push(sole);
      }
    }
    if(previous)points.forEach((p,j)=>assert.ok(p.distanceTo(previous[j])<.025,'no jump when changing support'));
    previous=points;
  }
});

test('ladder arms keep a single elbow hinge and never flip or fold the wrist during ascent or descent',()=>{
  const root=createMilo(new Proxy({},{get:(o,k)=>o[k]??=new MeshStandardMaterial()}));
  for(const direction of [1,-1]){
    let previous=null;
    // Two cycles include the wrap; reverse sampling covers the descent control.
    for(let i=0;i<=800;i++){
      animateMilo(root,{time:0,moving:false,facing:1});root.rotation.y=0;
      applyLadderStudy(root,direction*i/100);root.updateMatrixWorld(true);
      const rotations=root.userData.arms.map((rig,j)=>{
        const {arm,elbow,hand}=rig;
        assert.equal(elbow.rotation.y,0);assert.equal(elbow.rotation.z,0);
        assert.ok(elbow.rotation.x<0&&elbow.rotation.x>-150*Math.PI/180,'elbow must flex, not fold back on itself');
        assert.ok(elbow.getWorldPosition(new Vector3()).y<hand.getWorldPosition(new Vector3()).y-.09,'elbow stays below the wrist even while standing on the higher foot');
        assert.ok(hand.quaternion.angleTo(new Quaternion())<70*Math.PI/180,'no extreme wrist bend/twist');
        const current=[arm.quaternion.clone(),hand.quaternion.clone()];
        if(previous)current.forEach((q,k)=>assert.ok(q.angleTo(previous[j][k])<.07,'no shoulder-plane or wrist rotation flip'));
        return current;
      });
      previous=rotations;
    }
  }
});

test('actual arm, knee and torso surfaces clear both rungs and rails throughout the climb',()=>{
  const root=createMilo(new Proxy({},{get:(o,k)=>o[k]??=new MeshStandardMaterial()}));
  applyLadderStudy(root,0);
  const skin=root.userData.bodySkin,{position,armRegion}=skin.geometry.attributes;
  const vertices=[];
  // Exclude hands and boots: their contact with the ladder is intentional.
  for(let i=0;i<position.count;i++){
    const y=position.getY(i),arm=armRegion.getX(i);
    if((arm>.8&&y>1.015)||(arm<.1&&y>.34&&y<1.5))vertices.push(i);
  }
  const p=new Vector3();let minimum=Infinity;
  for(let frame=0;frame<=240;frame++){
    animateMilo(root,{time:0,moving:false,facing:1});root.rotation.y=0;
    const sample=applyLadderStudy(root,frame/60);root.updateMatrixWorld(true);skin.skeleton.update();
    for(const i of vertices){
      skin.applyBoneTransform(i,p.fromBufferAttribute(position,i)).applyMatrix4(skin.matrixWorld);
      const rungY=Math.round((p.y+sample.travel)/LADDER.spacing)*LADDER.spacing-sample.travel;
      const rungGap=Math.hypot(Math.max(0,Math.abs(p.x)-LADDER.width/2),p.y-rungY,p.z-LADDER.depth)-LADDER.radius;
      const railGap=Math.hypot(Math.abs(p.x)-LADDER.width/2,p.z-LADDER.depth)-.04;
      minimum=Math.min(minimum,rungGap,railGap);
    }
  }
  assert.ok(minimum>.005,`body surfaces need at least 5 mm clearance, got ${minimum}`);
});

test('rear silhouette keeps knees under the hips and elbows near their own shoulders',()=>{
  const root=createMilo(new Proxy({},{get:(o,k)=>o[k]??=new MeshStandardMaterial()}));
  for(let frame=0;frame<=240;frame++){
    animateMilo(root,{time:0,moving:false,facing:1});root.rotation.y=0;
    applyLadderStudy(root,frame/60);root.updateMatrixWorld(true);
    for(const {side,leg,knee} of root.userData.legs){
      const hip=leg.getWorldPosition(new Vector3()),p=knee.getWorldPosition(new Vector3());
      assert.ok(p.x*side>.07&&Math.abs(p.x-hip.x)<.12,'no splayed frog-leg pose from behind');
    }
    for(const {arm,elbow} of root.userData.arms){
      const shoulder=arm.getWorldPosition(new Vector3()),p=elbow.getWorldPosition(new Vector3());
      assert.ok(Math.abs(p.x-shoulder.x)<.06,'do not fold the elbows across the chest to avoid rungs');
    }
  }
  for(const [time,foot,rung]of [[1,'rightFoot',.56],[3,'leftFoot',.84]]){
    const sample=sampleLadder(time),support=sample.contacts.find(c=>c.id===foot);
    assert.equal(support.moving,false);
    assert.ok(Math.abs(support.point.y+sample.travel-rung)<1e-9,'higher foot support is established before the opposite hand reaches');
  }
});

test('both hands grip the actual rung with four fingers, palm and opposing thumb without burying the pads',()=>{
  const root=createMilo(new Proxy({},{get:(o,k)=>o[k]??=new MeshStandardMaterial()}));
  applyLadderStudy(root,0);
  const skin=root.userData.bodySkin,{position,skinIndex,skinWeight}=skin.geometry.attributes;
  const names=skin.skeleton.bones.map(b=>b.name),groups=[];
  for(const side of [-1,1])for(const part of ['finger0','finger1','finger2','finger3','thumb','hand']){
    const prefix=(side<0?'L':'R')+'_'+part,vertices=[];
    for(let i=0;i<position.count;i++){
      let w=0;for(let k=0;k<4;k++)if(names[skinIndex.array[i*4+k]].includes(prefix))w+=skinWeight.array[i*4+k];
      if(w>.5)vertices.push(i);
    }
    assert.ok(vertices.length>10);groups.push({side,part,vertices});
  }
  const p=new Vector3();
  for(let frame=0;frame<=120;frame++){
    animateMilo(root,{time:0,moving:false,facing:1});root.rotation.y=0;
    const sample=applyLadderStudy(root,frame/30);root.updateMatrixWorld(true);skin.skeleton.update();
    for(const {side,part,vertices}of groups){
      const contact=sample.contacts.find(c=>c.hand&&c.side===side);if(contact.moving)continue;
      let closest=Infinity,minimum=Infinity;
      for(const i of vertices){
        skin.applyBoneTransform(i,p.fromBufferAttribute(position,i)).applyMatrix4(skin.matrixWorld);
        const distance=Math.hypot(p.y-contact.point.y,p.z-contact.point.z);
        closest=Math.min(closest,Math.abs(distance-LADDER.radius));minimum=Math.min(minimum,distance);
      }
      assert.ok(closest<.0025,`${side} ${part} must touch its rung, gap ${closest}`);
      assert.ok(minimum>LADDER.radius-.0015,`${side} ${part} must not disappear inside the rung: ${minimum}`);
    }
  }
});

test('study hand fitting is reversible and independent of the first scrubbed frame',()=>{
  const material=()=>new Proxy({},{get:(o,k)=>o[k]??=new MeshStandardMaterial()});
  const root=createMilo(material()),fresh=createMilo(material()),original=root.userData.bodySkin.geometry;
  const watch=root.userData.watch.group,watchPosition=watch.position.clone(),watchRotation=watch.quaternion.clone();
  const originalStrap=watch.getObjectByName('Fitted graphite watch strap').geometry;
  const before=cloneMiloSkinGeometry(root.userData.bodySkin).attributes.position.array.slice(),weights=original.attributes.skinWeight.array.slice();
  for(const time of [1.4,0,2,3.5,4]){animateMilo(root,{time:0,moving:false,facing:1});applyLadderStudy(root,time);}
  animateMilo(fresh,{time:0,moving:false,facing:1});applyLadderStudy(fresh,4);
  const a=root.userData.bodySkin.geometry.attributes.position.array,b=fresh.userData.bodySkin.geometry.attributes.position.array;
  assert.ok(a.every((v,i)=>Math.abs(v-b[i])<1e-6),'first entering during a release must give the same grip');
  setLadderHandFit(root,false);
  assert.equal(root.userData.bodySkin.geometry,original);
  assert.equal(watch.getObjectByName('Fitted graphite watch strap').geometry,originalStrap);
  assert.ok(watch.position.distanceTo(watchPosition)<1e-9&&watch.quaternion.angleTo(watchRotation)<1e-7);
  assert.deepEqual(cloneMiloSkinGeometry(root.userData.bodySkin).attributes.position.array,before);assert.deepEqual(original.attributes.skinWeight.array,weights);
});

test('gripping wrists retain a round cross-section instead of a flattened paddle',()=>{
  const root=createMilo(new Proxy({},{get:(o,k)=>o[k]??=new MeshStandardMaterial()}));
  applyLadderStudy(root,0);
  const skin=root.userData.bodySkin,original=root.userData.ladderHandFit.original.attributes.position;
  const {position,armRegion}=skin.geometry.attributes;
  for(const time of [0,.4,1,1.4,2,2.4,3,3.4,4]){
    animateMilo(root,{time:0,moving:false,facing:1});root.rotation.y=0;applyLadderStudy(root,time);root.updateMatrixWorld(true);skin.skeleton.update();
    for(const {side,hand}of root.userData.arms){
      const points=[];
      for(let i=0;i<position.count;i++){
        if(original.getX(i)*side<.14||Math.abs(original.getY(i)-.934)>.008||armRegion.getX(i)<.95)continue;
        const p=skin.applyBoneTransform(i,new Vector3().fromBufferAttribute(position,i)).applyMatrix4(skin.matrixWorld);
        points.push(hand.worldToLocal(p));
      }
      assert.ok(points.length>20);
      const mean=points.reduce((sum,p)=>sum.add(p),new Vector3()).divideScalar(points.length),cov=Array.from({length:3},()=>[0,0,0]);
      for(const p of points){const d=p.clone().sub(mean).toArray();for(let a=0;a<3;a++)for(let b=0;b<3;b++)cov[a][b]+=d[a]*d[b]/points.length;}
      // Principal plane avoids mistaking an oblique wrist ring for a flat one.
      for(let iteration=0;iteration<20;iteration++){
        const [a,b]=[[0,1],[0,2],[1,2]].sort((p,q)=>Math.abs(cov[q[0]][q[1]])-Math.abs(cov[p[0]][p[1]]))[0];
        if(Math.abs(cov[a][b])<1e-12)break;
        const angle=.5*Math.atan2(2*cov[a][b],cov[b][b]-cov[a][a]),c=Math.cos(angle),s=Math.sin(angle),aa=cov[a][a],bb=cov[b][b],ab=cov[a][b];
        for(let k=0;k<3;k++)if(k!==a&&k!==b){const ka=cov[k][a],kb=cov[k][b];cov[k][a]=cov[a][k]=c*ka-s*kb;cov[k][b]=cov[b][k]=s*ka+c*kb;}
        cov[a][a]=c*c*aa-2*s*c*ab+s*s*bb;cov[b][b]=s*s*aa+2*s*c*ab+c*c*bb;cov[a][b]=cov[b][a]=0;
      }
      const eigen=[cov[0][0],cov[1][1],cov[2][2]].sort((a,b)=>b-a),minor=2*Math.sqrt(2*eigen[1]),major=2*Math.sqrt(2*eigen[0]);
      assert.ok(minor>.030&&major<.080,`stable wrist thickness: ${minor}, ${major}`);
    }
  }
});
