import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {MeshStandardMaterial,Group,Vector3,Quaternion} from 'three';
import {loadMiloBody} from '../src/obs/milo-body.js';
import {LOUNGE_SMOKING_STUDY_DURATION as duration,LOUNGE_SMOKING_STUDY_PHASES as phases,sampleLoungeSmokingStudy,createLoungeSmokingStudyActors,applyLoungeSmokingStudy} from '../src/lounge-smoking-study-model.js';
import {CIGARETTE,LIGHTER_TIP} from '../src/obs/smoking-props.js';
import {mouthPosition} from '../src/obs/dining.js';

await loadMiloBody('data:application/json;base64,'+(await readFile(new URL('../public/assets/obs/milo/body.json',import.meta.url))).toString('base64'));
test('seeking restores visible exhalation from the real mouth, follows the face and fades after smoking',()=>{
  const m=new Proxy({},{get:(o,k)=>o[k]??=new MeshStandardMaterial()}),actors=createLoungeSmokingStudyActors(m,new Group());
  const scene=new Group();scene.position.set(3,.7,-2);scene.rotation.y=.6;scene.add(actors.milo,actors.furniture);
  const props=actors.milo.userData.smokingProps;
  const snapshot=()=>props.particles.map(p=>p.sprite.visible?{age:p.age,exhale:p.exhale,origin:p.origin.toArray(),position:p.sprite.position.toArray(),opacity:p.sprite.material.opacity,visible:true}:{visible:false});
  applyLoungeSmokingStudy(actors,15.05);
  const exhaled=props.particles.filter(p=>p.exhale&&p.sprite.visible);
  assert.ok(exhaled.length>=12,'paused study must show the first exhale, not erase the particles');
  assert.ok(exhaled.some(p=>p.sprite.material.opacity>.15),'exhaled smoke is visible');
  const expected=actors.milo.userData.body.localToWorld(mouthPosition(actors.milo.userData.head));
  for(const p of exhaled){
    assert.ok(p.origin.distanceTo(expected)<.006,'exhaled smoke originates at the mouth, not the cigarette');
    const forward=new Vector3(0,0,1).applyQuaternion(actors.milo.userData.head.getWorldQuaternion(new Quaternion()));
    assert.ok(p.velocity.clone().normalize().dot(forward)>.97,'smoke travels in front of the face');
  }
  const first=snapshot();
  applyLoungeSmokingStudy(actors,32);applyLoungeSmokingStudy(actors,15.05);assert.deepEqual(snapshot(),first,'backwards seek reproduces the same smoke');
  applyLoungeSmokingStudy(actors,15.05,{dt:0,resetSmoke:false});assert.deepEqual(snapshot(),first,'paused runtime freezes the restored smoke');
  applyLoungeSmokingStudy(actors,10);assert.ok(props.particles.every(p=>!p.sprite.visible),'no smoke before ignition');
  applyLoungeSmokingStudy(actors,37);assert.ok(props.particles.every(p=>!p.sprite.visible),'remaining particles fade after extinguishing');
});

test('direct seek and forward playback reproduce the same mouth and cigarette emission history',()=>{
  const m=new Proxy({},{get:(o,k)=>o[k]??=new MeshStandardMaterial()}),make=()=>{const a=createLoungeSmokingStudyActors(m,new Group());new Group().add(a.milo,a.furniture);return a;};
  const run=make(),seek=make();applyLoungeSmokingStudy(run,0);
  const time=15.05,frames=Math.round(time*60);
  for(let frame=1;frame<=frames;frame++)applyLoungeSmokingStudy(run,frame/60,{dt:frame/60-(frame-1)/60});
  applyLoungeSmokingStudy(seek,time);
  const a=run.milo.userData.smokingProps,b=seek.milo.userData.smokingProps;
  assert.equal(a.serial,b.serial);
  a.particles.forEach((p,i)=>{
    const q=b.particles[i];assert.equal(p.exhale,q.exhale);assert.equal(p.sprite.visible,q.sprite.visible);
    if(!p.sprite.visible)return;
    assert.ok(Math.abs(p.age-q.age)<1e-7);assert.ok(p.origin.distanceTo(q.origin)<1e-7);assert.ok(p.sprite.position.distanceTo(q.sprite.position)<1e-7);
  });
});

test('study samples use the actual seated visit, extinguish before standing, and clamp time',()=>{
  for(const phase of phases)assert.equal(sampleLoungeSmokingStudy(phase.time).phase.id,phase.id);
  assert.equal(sampleLoungeSmokingStudy(-1).time,0);assert.equal(sampleLoungeSmokingStudy(NaN).time,0);assert.equal(sampleLoungeSmokingStudy(999).time,duration);
  assert.equal(sampleLoungeSmokingStudy(17.8).visit.pose.gesture.inhale,true);
  assert.equal(sampleLoungeSmokingStudy(31.7).visit.phase,'extinguish');
  assert.equal(sampleLoungeSmokingStudy(33.8).visit,null);assert.ok(sampleLoungeSmokingStudy(33.8).exit);
});

test('resting between puffs holds the cigarette horizontally without slipping from the finger pinch',()=>{
  const m=new Proxy({},{get:(o,k)=>o[k]??=new MeshStandardMaterial()}),actors=createLoungeSmokingStudyActors(m,new Group());
  new Group().add(actors.milo,actors.furniture);
  for(const time of [15.05,15.567,15.57,20.3,23.2,28.1,29.8]){
    const sample=applyLoungeSmokingStudy(actors,time),{body,arms,smokingProps:props}=actors.milo.userData;
    assert.ok(sample.visit.pose.gesture.hand[1]>.999,'sample is a resting hold');
    const direction=props.cigarette.localToWorld(new Vector3(0,0,CIGARETTE.length)).sub(props.cigarette.getWorldPosition(new Vector3())).normalize();
    assert.ok(Math.abs(direction.y)<1e-7,`cigarette should be horizontal at ${time}`);
    const forward=new Vector3(0,0,1).applyQuaternion(body.getWorldQuaternion(new Quaternion()));forward.y=0;forward.normalize();
    assert.ok(direction.dot(forward)>.999,'ember points forward, away from the body');
    const right=arms[0],pinch=new Vector3();
    for(const i of [2,3]){const finger=right.fingers[i];pinch.add(finger.userData.links[0].position.clone().applyQuaternion(finger.quaternion).add(finger.position));}
    pinch.multiplyScalar(.5).add(new Vector3(0,-.019,-.027));right.hand.localToWorld(pinch);
    assert.ok(props.cigarette.localToWorld(new Vector3(0,0,CIGARETTE.heldAt)).distanceTo(pinch)<1e-7,'rotation preserves the finger pinch');
  }
  let before;
  for(let time=13.9;time<18;time+=1/60){
    applyLoungeSmokingStudy(actors,time);const q=actors.milo.userData.smokingProps.cigarette.getWorldQuaternion(new Quaternion());
    if(before)assert.ok(q.normalize().angleTo(before)<.09,`lowering to rest and lifting for a puff stay continuous at ${time}: ${q.angleTo(before)}`);before=q;
  }
});

test('lighting at twelve seconds keeps elbows outside the torso, forearms apart and flame at the cigarette tip',()=>{
  const m=new Proxy({},{get:(o,k)=>o[k]??=new MeshStandardMaterial()}),actors=createLoungeSmokingStudyActors(m,new Group());
  new Group().add(actors.milo,actors.furniture);
  actors.milo.userData.head.userData.faceForward=.025;
  const {body,arms,smokingProps:props}=actors.milo.userData;
  for(let time=10.8;time<=12.1;time+=1/60){
    applyLoungeSmokingStudy(actors,time);
    const forearms=arms.map(rig=>{
      const elbow=body.worldToLocal(rig.elbow.getWorldPosition(new Vector3())),wrist=body.worldToLocal(rig.hand.getWorldPosition(new Vector3()));
      assert.ok(elbow.x*rig.side>.17,'elbow stays outside the ribs');
      assert.ok(elbow.z>.18,'elbow stays ahead of the torso');
      assert.ok(wrist.x*rig.side>.035,'hands stay on their own side of the centre');
      return{elbow,wrist};
    });
    for(let a=0;a<=10;a++)for(let b=0;b<=10;b++){
      const right=forearms[0].elbow.clone().lerp(forearms[0].wrist,a/10),left=forearms[1].elbow.clone().lerp(forearms[1].wrist,b/10);
      assert.ok(right.distanceTo(left)>.10,'forearm surfaces must not intersect');
    }
    const flame=arms[1].hand.localToWorld(LIGHTER_TIP.clone()),tip=props.cigarette.localToWorld(new Vector3(0,0,CIGARETTE.length));
    assert.ok(flame.distanceTo(tip)<.018,'lighter still meets the cigarette after separating the arms');
    const left=arms[1],casePosition=left.hand.worldToLocal(props.lighter.getObjectByName('Lighter case').getWorldPosition(new Vector3()));
    assert.ok(casePosition.z<-.015,'lighter is inside the palm, not on the back of the hand');
    const palm=new Vector3(0,0,-1).applyQuaternion(left.hand.getWorldQuaternion(new Quaternion()));
    const toBody=body.getWorldPosition(new Vector3()).sub(left.hand.getWorldPosition(new Vector3()));toBody.y=0;toBody.normalize();
    assert.ok(palm.dot(toBody)>.70,'lighter palm faces the body throughout lighting');
    assert.ok(left.thumb.position.distanceTo(new Vector3(-.029,-.051,.025))<1e-8,'thumb base remains anatomically attached');
  }
});

test('actual finger and thumb skin grips the case without being pulled through it',()=>{
  const m=new Proxy({},{get:(o,k)=>o[k]??=new MeshStandardMaterial()}),actors=createLoungeSmokingStudyActors(m,new Group());
  new Group().add(actors.milo,actors.furniture);applyLoungeSmokingStudy(actors,11.4);
  const skin=actors.milo.userData.bodySkin,box=actors.milo.userData.smokingProps.lighter.getObjectByName('Lighter case');
  skin.skeleton.update();const {skinIndex:indices,skinWeight:weights}=skin.geometry.attributes,names=skin.skeleton.bones.map(b=>b.name);
  for(const part of ['thumbIP','finger0','finger1','finger2']){
    let contacts=0,vertices=0;
    for(let i=0;i<indices.count;i++){
      let influence=0;for(let k=0;k<4;k++)if(names[indices.array[i*4+k]].startsWith('Milo skin R_'+part))influence+=weights.array[i*4+k];
      if(influence<.5)continue;vertices++;
      const p=box.worldToLocal(skin.localToWorld(skin.getVertexPosition(i,new Vector3())));
      const distances=[Math.abs(p.x)-.017,Math.abs(p.y)-.0225,Math.abs(p.z)-.007],outside=Math.max(...distances);
      assert.ok(outside>-.0008,'actual skin stays outside the rigid case');
      if(Math.hypot(...distances.map(d=>Math.max(0,d)))<.003)contacts++;
    }
    assert.ok(vertices>20,'distal thumb is bound to its own joint');assert.ok(contacts>=3,part+' makes surface contact');
  }
});

test('ash disposal and extinguishing keep the seated torso fixed and the arm motion continuous',()=>{
  const m=new Proxy({},{get:(o,k)=>o[k]??=new MeshStandardMaterial()}),actors=createLoungeSmokingStudyActors(m,new Group());
  new Group().add(actors.milo,actors.furniture);applyLoungeSmokingStudy(actors,8);
  const {body,chest,arms,legs}=actors.milo.userData,torso=[body,chest,...arms.map(r=>r.arm)].map(n=>n.getWorldPosition(new Vector3())),feet=legs.map(r=>r.boot.getWorldPosition(new Vector3()));
  let previous;
  for(let t=8;t<33.8-1e-6;t+=1/60){
    applyLoungeSmokingStudy(actors,t);
    [body,chest,...arms.map(r=>r.arm)].forEach((n,i)=>assert.ok(n.getWorldPosition(new Vector3()).distanceTo(torso[i])<1e-7,'no forward torso lean'));
    legs.forEach((r,i)=>assert.ok(r.boot.getWorldPosition(new Vector3()).distanceTo(feet[i])<1e-7,'feet stay planted'));
    const current=arms.flatMap(r=>[r.elbow,r.hand]).map(n=>n.getWorldPosition(new Vector3()));
    if(previous)current.forEach((p,i)=>assert.ok(p.distanceTo(previous[i])<.025,`arm jumps at ${t}`));previous=current;
  }
});

test('opening, thumb strike, flame and closing follow one clock; direct seeking produces the same skin',()=>{
  const m=new Proxy({},{get:(o,k)=>o[k]??=new MeshStandardMaterial()}),make=()=>{const a=createLoungeSmokingStudyActors(m,new Group());new Group().add(a.milo,a.furniture);return a;};
  const run=make(),seek=make();
  for(let t=8;t<11.4;t+=1/60)applyLoungeSmokingStudy(run,t);
  applyLoungeSmokingStudy(run,11.4);applyLoungeSmokingStudy(seek,11.4);
  const a=run.milo.userData.bodySkin,b=seek.milo.userData.bodySkin;
  for(const name of ['position','skinIndex','skinWeight']){
    const p=a.geometry.attributes[name].array,q=b.geometry.attributes[name].array;
    for(let i=0;i<p.length;i++)assert.ok(Math.abs(p[i]-q[i])<1e-6,'seek-safe grip surface');
  }
  for(const [t,flame,open]of [[10.5,false,true],[11.4,true,true],[12.5,false,false]]){
    const sample=applyLoungeSmokingStudy(run,t),props=run.milo.userData.smokingProps;
    assert.equal(props.flame.visible,flame);assert.equal(Math.abs(props.lid.rotation.z)>1,open);
    if(flame)assert.ok(sample.visit.pose.gesture.strike>.99,'thumb strike precedes flame');
  }
  applyLoungeSmokingStudy(run,34);assert.equal(a.geometry,run.milo.userData.diningHandFit.original,'smoking surface is removed after leaving');
});
test('scrubbing backwards reproduces every joint and keeps the actual ashtray dock fixed',()=>{
  const m=new Proxy({},{get:(o,k)=>o[k]??=new MeshStandardMaterial()}),actors=createLoungeSmokingStudyActors(m,new Group());
  new Group().add(actors.milo,actors.furniture);
  const nodes=[actors.milo.userData.body,...actors.milo.userData.arms.flatMap(r=>[r.arm,r.elbow,r.hand]),...actors.milo.userData.legs.flatMap(r=>[r.leg,r.knee,r.boot])];
  const snapshot=()=>nodes.map(node=>[node.getWorldPosition(new Vector3()),node.getWorldQuaternion(new Quaternion())]);
  const references=phases.map(phase=>{applyLoungeSmokingStudy(actors,phase.time);return snapshot();});
  const ash=actors.furniture.userData.loungeProps.ashtray.getWorldPosition(new Vector3());
  for(const index of [7,2,6,1,5,0,4,3]){
    applyLoungeSmokingStudy(actors,phases[index].time);
    snapshot().forEach(([position,rotation],i)=>{assert.ok(position.distanceTo(references[index][i][0])<1e-7);assert.ok(rotation.angleTo(references[index][i][1])<1e-7);});
    assert.ok(actors.furniture.userData.loungeProps.ashtray.getWorldPosition(new Vector3()).distanceTo(ash)<1e-8);
  }
});
