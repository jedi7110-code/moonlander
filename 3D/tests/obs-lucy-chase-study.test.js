import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {Vector3} from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {createCabinLucy,animateCabinLucy,decodeGroomCache} from '../src/obs/lucy-cabin.js';
import {MouseChase,mousePose,runCycle,RUN_STRIDE,RUN_SPEED,MOUSE_RUN_SPEED,MOUSE_WALK_SPEED,MOUSE_TIMING,CHASE_PREVIEW_DURATION} from '../studies/lucy/chase-motion.js';
import {createLucyRunRig} from '../studies/lucy/run-rig.js';
import {createStudyMouse} from '../studies/lucy/mouse-model.js';
import {mouseRunCycle,MOUSE_STRIDE} from '../studies/lucy/mouse-gait.js';

test('mouse paws stay on the ground during stance and recover forward, never backward in world space',()=>{
  const previous={};let stanceChecks=0,swingChecks=0;
  for(let i=0;i<=1200;i++){
    const distance=i/600*MOUSE_STRIDE,{feet}=mouseRunCycle(distance);
    assert.equal(feet.frontL.planted,feet.rearR.planted,'diagonal pair lands together');
    assert.equal(feet.frontR.planted,feet.rearL.planted,'opposite pair lands together');
    for(const [key,foot]of Object.entries(feet)){
      const z=distance+foot.z,prior=previous[key];
      if(prior){
        assert.ok(z>=prior.z-1e-10,`${key}: the paw must not step backward while the mouse advances`);
        if(foot.planted&&prior.planted){assert.ok(Math.abs(z-prior.z)<1e-9,'stance cancels root travel');stanceChecks++;}
        else if(!foot.planted&&!prior.planted){assert.ok(z>prior.z,'swing moves forward');swingChecks++;}
      }
      if(foot.planted)assert.equal(foot.lift,0);
      else assert.ok(foot.lift>0&&foot.lift<=.009);
      previous[key]={z,planted:foot.planted};
    }
  }
  assert.ok(stanceChecks>2000&&swingChecks>2000);
  assert.notEqual(mouseRunCycle(.1*MOUSE_STRIDE).feet.frontL.planted,mouseRunCycle(.1*MOUSE_STRIDE).feet.frontR.planted,'left and right alternate');
  assert.ok(Object.values(mouseRunCycle(.58).feet).every(f=>f.planted),'all paws are down before surveying');
});

test('actual mouse paw contacts remain fixed through acceleration in either travel direction',()=>{
  const point=new Vector3();let checked=0;
  for(const direction of [-1,1]){
    const sim=new MouseChase({random:()=>.5,direction}),model=createStudyMouse(),previous={};sim.appear(0);
    for(let i=0;i<4400;i++){
      sim.update(1/480);const m=sim.mouse;
      model.root.position.set(m.x,0,m.z);model.root.rotation.y=sim.direction*Math.PI/2;
      const pose=model.update(m);
      for(const leg of model.legs){
        const planted=pose.feet[leg.key].planted,prior=previous[leg.key];leg.paw.getWorldPosition(point);
        if(planted&&prior?.planted&&['emerge','walk','run'].includes(m.phase)&&prior.phase===m.phase){
          assert.ok(point.distanceTo(prior.point)<1e-8,`${direction}/${leg.key}: grounded paw slides`);checked++;
        }
        previous[leg.key]={point:point.clone(),planted,phase:m.phase};
      }
    }
  }
  assert.ok(checked>4000);
});

test('the mouse surveys, walks slowly until noticed, then runs away',()=>{
  for(const direction of [-1,1]){
    const sim=new MouseChase({random:()=>.5,direction});sim.appear(0);
    const phases=[];let minLook=0,maxLook=0,maxUpright=0,previousPose={upright:0},runStarted=false;
    for(let i=0;i<1800;i++){
      sim.update(1/120);const m=sim.mouse,pose=mousePose(m);
      if(!m.spotted)assert.ok(m.speed<=MOUSE_WALK_SPEED+1e-9,'unseen mice never sprint, including emergence');
      if(phases.at(-1)!==m.phase)phases.push(m.phase);
      if(m.phase==='survey'||m.phase==='settle'){
        assert.equal(m.speed,0);assert.equal(m.x,-3.84*direction);
        assert.equal(sim.cat.speed,0);assert.equal(sim.cat.phase,'watch');
        minLook=Math.min(minLook,pose.look);maxLook=Math.max(maxLook,pose.look);maxUpright=Math.max(maxUpright,pose.upright);
      }
      if(m.phase==='run'&&!runStarted){
        assert.ok(previousPose.upright<.002,'the mouse lowers before accelerating');
        assert.equal(pose.upright,0);assert.equal(sim.cat.phase,'notice');assert.equal(m.spotted,true);runStarted=true;
      }
      previousPose=pose;
    }
    assert.deepEqual(phases,['emerge','survey','settle','walk','run','hidden']);
    assert.equal(maxUpright,1);assert.ok(minLook<-.65&&maxLook>.45,'the head surveys both sides');
    assert.equal(sim.cat.phase,'idle');
  }
});

test('the mouse model keeps hind feet planted and folds its forepaws above the floor while surveying',()=>{
  const sim=new MouseChase({random:()=>.5}),model=createStudyMouse();sim.appear(0);
  const point=new Vector3(),nose=model.root.getObjectByName('Mouse nose');let low=Infinity,highestNose=0;
  for(let i=0;i<Math.ceil((MOUSE_TIMING.emerge+MOUSE_TIMING.survey+MOUSE_TIMING.settle)*60);i++){
    sim.update(1/60);const pose=model.update(sim.mouse);
    highestNose=Math.max(highestNose,nose.getWorldPosition(point).y);
    for(const leg of model.legs){
      if(sim.mouse.phase==='survey'||sim.mouse.phase==='settle'){
        if(leg.rear)assert.ok(Math.abs(leg.paw.getWorldPosition(point).y-.006)<1e-9,'hind feet remain on the deck');
        else if(pose.upright>.99)assert.ok(leg.paw.getWorldPosition(point).y>.06,'forepaws tuck against the chest');
      }
    }
    model.root.traverse(mesh=>{
      if(!mesh.isMesh)return;
      const positions=mesh.geometry.attributes.position;
      for(let j=0;j<positions.count;j++){
        point.fromBufferAttribute(positions,j).applyMatrix4(mesh.matrixWorld);
        assert.ok(Number.isFinite(point.x)&&Number.isFinite(point.y)&&Number.isFinite(point.z));
        low=Math.min(low,point.y);
      }
    });
  }
  assert.ok(highestNose>.10,'the torso genuinely rises into a semi-upright pose');
  assert.ok(low>-.001,`the mouse must not sink into the floor: ${low}`);
});

test('a mouse on another floor never changes Lucy’s floor or starts a chase',()=>{
  const sim=new MouseChase({random:()=>.5});sim.appear(1);
  for(let i=0;i<CHASE_PREVIEW_DURATION*60;i++){
    sim.update(1/60);assert.equal(sim.cat.floor,0);assert.equal(sim.cat.x,-3.65);assert.equal(sim.cat.speed,0);
    assert.equal(sim.mouse.spotted,false);assert.ok(sim.mouse.speed<=MOUSE_WALK_SPEED+1e-9);
  }
  assert.equal(sim.active,false);assert.equal(sim.mouse.visible,false);
});
test('a mouse keeps walking until Lucy notices it, even after the original escape time',()=>{
  const sim=new MouseChase({random:()=>.5});sim.appear(1);
  for(let i=0;i<20*60;i++)sim.update(1/60);
  assert.equal(sim.mouse.phase,'walk');assert.equal(sim.mouse.spotted,false);
  const before=sim.mouse.x;sim.cat.floor=1;sim.cat.phase='watch';sim.update(1/120);
  assert.equal(sim.cat.phase,'notice');assert.equal(sim.mouse.phase,'run');assert.equal(sim.mouse.spotted,true);
  assert.ok(sim.mouse.x-before<.01,'noticing never teleports the mouse');
  const paused=JSON.stringify(sim);sim.update(0);assert.equal(JSON.stringify(sim),paused);
  sim.update(.5);assert.ok(sim.mouse.speed>2,'the escape accelerates from walking');
});
test('same-floor pursuit accelerates, keeps clearance, brakes and returns to rare appearances',()=>{
  for(const direction of [-1,1]){
    const sim=new MouseChase({random:()=>.5,direction});sim.appear(0);let fastest=0,mouseFastest=0,prior=0,travel=0;
    for(let i=0;i<900;i++){
      sim.update(1/60);const c=sim.cat;fastest=Math.max(fastest,c.speed);mouseFastest=Math.max(mouseFastest,sim.mouse.speed);travel=c.distance;
      assert.ok(Math.abs(c.speed-prior)<=7/60+1e-9);prior=c.speed;
      assert.ok(Math.abs(c.x)<3.8);assert.equal(c.floor,0);
      if(c.speed>.1&&sim.mouse.visible)assert.ok((sim.mouse.x-c.x)*direction>.38,'no overlapping bodies');
    }
    assert.ok(fastest>2.5,'Lucy actually reaches the faster pace');assert.ok(mouseFastest>2.8,'the mouse also crosses faster');
    assert.ok(travel>5);assert.equal(sim.cat.phase,'idle');assert.equal(sim.cat.speed,0);
    assert.equal(sim.events,1);assert.ok(sim.wait>60);
    const frozen=JSON.stringify(sim);sim.update(0);assert.equal(JSON.stringify(sim),frozen);
  }
});
test('faster travel comes from longer steps at the existing running cadence',()=>{
  assert.ok(RUN_STRIDE>.9&&MOUSE_STRIDE>.18,'each cycle covers more ground');
  assert.ok(Math.abs(RUN_SPEED/RUN_STRIDE-1.65/.58)<1e-10,'Lucy keeps the approved cycle tempo');
  assert.ok(Math.abs(MOUSE_RUN_SPEED/MOUSE_STRIDE-1.70/.116)<1e-10,'the mouse does not spin its legs faster');
});
test('gallop plants forefeet then hindfeet and stance cancels world travel',()=>{
  for(const [key,offset]of Object.entries({frontL:0,frontR:.08,rearR:.5,rearL:.58})){
    const a=runCycle(offset+.02).feet[key],b=runCycle(offset+.21).feet[key];
    assert.ok(a.planted&&b.planted);assert.equal(a.lift,0);assert.equal(b.lift,0);
    assert.ok(Math.abs((b.z-a.z)+RUN_STRIDE*.19)<1e-10);
  }
  for(const phase of [.38,.91])assert.ok(Object.values(runCycle(phase).feet).every(f=>!f.planted),'short suspension between pairs');
});
test('forepaw swing is continuous through the cycle and touches down without a position or velocity snap',()=>{
  for(const key of ['frontL','frontR']){
    const epsilon=1e-5,offset=key==='frontL'?0:.08;
    for(const phase of [offset,offset+.24]){
      const before=runCycle(phase-epsilon).feet[key],at=runCycle(phase).feet[key],after=runCycle(phase+epsilon).feet[key];
      for(const field of ['z','lift','roll','shoulder']){
        assert.ok(Math.abs(after[field]-before[field])<2e-5,`${key} ${field} position continuity`);
        assert.ok(Math.abs((after[field]-at[field])-(at[field]-before[field]))/epsilon<.01,`${key} ${field} velocity continuity`);
      }
    }
  }
});
test('the actual Lucy rig reaches past the nose without stretching limbs, detaching paws or piercing the deck',async()=>{
  const read=name=>fs.readFileSync(new URL('../public/assets/obs/lucy/'+name,import.meta.url));
  const bytes=read('lucy-cabin.glb'),bin=read('lucy-groom.bin'),poses=JSON.parse(read('lucy-approved.json'));
  const gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
  const root=createCabinLucy({gltf,poses,cache:decodeGroomCache(bin.buffer.slice(bin.byteOffset,bin.byteOffset+bin.byteLength),poses.groom)},{random:()=>.5}),rig=createLucyRunRig(root);
  const coat=root.userData.cabin.coat,baseGeometry=coat.geometry;
  const sourceWeights=baseGeometry.attributes.skinWeight.array.slice();let nose;
  root.traverse(mesh=>{if(mesh.material?.name==='Muted pink nose')nose=mesh;});
  assert.ok(nose,'measure the visible nose, not the head bone');
  const spans=[];
  for(const side of ['L','R'])for(const names of [
    ['paw1_','paw2_'],['paw2_','Lucy contact paw3_'],
    ['leg1_','leg2_'],['leg2_','leg3_'],['leg3_','Lucy contact feet_'],
  ]){
    const [a,b]=names.map(name=>root.getObjectByName(name+side));
    spans.push({a,b,length:a.getWorldPosition(new Vector3()).distanceTo(b.getWorldPosition(new Vector3()))});
  }
  for(const [from,to]of [['Bone002','Bone004'],...Array.from({length:4},(_,i)=>['tail'+(i+1),'tail'+(i+2)])]){
    const a=root.getObjectByName(from),b=root.getObjectByName(to);
    spans.push({a,b,length:a.getWorldPosition(new Vector3()).distanceTo(b.getWorldPosition(new Vector3()))});
  }
  const p=new Vector3(),reach={frontL:0,frontR:0},reachFrames={frontL:0,frontR:0};let maxGap=0,minSole=Infinity;
  const tailMiddle=[],tailTip=[];
  for(let i=0;i<=120;i++){
    animateCabinLucy(root,{dt:1/60,time:0,mode:'idle',yaw:0,headingControlled:true});
    const state=rig.update({distance:i/120*RUN_STRIDE,speed:RUN_SPEED,weight:1});
    coat.skeleton.update();
    let noseZ=-Infinity;
    for(let index=0;index<nose.geometry.attributes.position.count;index++)noseZ=Math.max(noseZ,nose.getVertexPosition(index,p).applyMatrix4(nose.matrixWorld).z);
    for(const {a,b,length}of spans)assert.ok(Math.abs(a.getWorldPosition(new Vector3()).distanceTo(b.getWorldPosition(new Vector3()))-length)<1e-6,'bones retain their lengths');
    const chest=root.getObjectByName('Bone002').getWorldPosition(new Vector3()),head=root.getObjectByName('Bone004').getWorldPosition(new Vector3());
    assert.ok(head.y-chest.y>0&&head.y-chest.y<.014,'the neck reaches forward close to chest height');
    const tailBase=root.getObjectByName('tail1').getWorldPosition(new Vector3());
    tailMiddle.push(root.getObjectByName('tail3').getWorldPosition(new Vector3()).y-tailBase.y);
    tailTip.push(root.getObjectByName('tail5').getWorldPosition(new Vector3()).y-tailBase.y);
    for(const f of rig.feet){
      const end=root.getObjectByName('Lucy contact '+(f.rear?'feet_':'paw3_')+f.side);
      maxGap=Math.max(maxGap,end.getWorldPosition(new Vector3()).distanceTo(f.paw.getWorldPosition(new Vector3())));
      if(f.rear&&Math.abs(state.phase-(.75+2/12))<1e-6){
        const hip=root.getObjectByName('leg1_'+f.side).getWorldPosition(new Vector3());
        const knee=root.getObjectByName('leg2_'+f.side).getWorldPosition(new Vector3());
        const hock=root.getObjectByName('leg3_'+f.side).getWorldPosition(new Vector3());
        const toes=end.getWorldPosition(new Vector3());
        assert.ok(hip.z-toes.z>.20,`${f.key}: frame 3 trails behind the pelvis instead of hanging below it`);
        assert.ok(hip.clone().sub(knee).angleTo(hock.clone().sub(knee))>Math.PI*.8,`${f.key}: frame 3 opens the knee after the push-off`);
        assert.ok(toes.y>.05,`${f.key}: the extended hind paw clears the deck`);
      }
      if(!f.rear){
        const shoulder=root.getObjectByName('paw1_'+f.side).getWorldPosition(new Vector3());
        const elbow=root.getObjectByName('paw2_'+f.side).getWorldPosition(new Vector3());
        const wrist=f.paw.getWorldPosition(new Vector3());
        const angle=shoulder.clone().sub(elbow).angleTo(wrist.clone().sub(elbow));
        assert.ok(angle>Math.PI/3,`${f.key}: elbow must not collapse into an acute fold`);
        assert.ok(shoulder.y-elbow.y>.025,`${f.key}: elbow must stay below the shoulder`);
        const phase=((state.phase-(f.side==='L'?0:.08))+1)%1;
        if(phase>.38&&phase<.54){
          assert.ok(shoulder.y-wrist.y>.11,`${f.key}: recover below the chest, not at the shoulder`);
          // Check the visible toe surface, not only the authored wrist angle.
          const toes=f.vertices.filter(index=>coat.geometry.attributes.position.getZ(index)>.153);
          let toeHeight=0;
          for(const index of toes)toeHeight+=coat.getVertexPosition(index,p).applyMatrix4(coat.matrixWorld).y;
          assert.ok(toeHeight/toes.length<wrist.y-.006,`${f.key}: toes fold down, not upward into the chest`);
        }
      }
      let toeZ=-Infinity;
      for(const index of f.vertices){
        const y=coat.getVertexPosition(index,p).applyMatrix4(coat.matrixWorld).y;
        toeZ=Math.max(toeZ,p.z);
        assert.ok(Number.isFinite(y));minSole=Math.min(minSole,y);
        if(state.feet[f.key].planted)assert.ok(y<.09,'stance toes remain near the deck');
      }
      if(!f.rear&&!state.feet[f.key].planted){
        reach[f.key]=Math.max(reach[f.key],toeZ-noseZ);
        if(toeZ>noseZ+.015)reachFrames[f.key]++;
      }
    }
  }
  assert.ok(maxGap<.012,`foot / leg separation ${maxGap}`);
  assert.ok(minSole>-.012,`lowest sole ${minSole}`);
  const range=values=>Math.max(...values)-Math.min(...values);
  assert.ok(range(tailMiddle)>.02&&range(tailMiddle)<.04,'the tail centre has a restrained rise and fall relative to its base');
  assert.ok(range(tailMiddle)>range(tailTip)*4,'tail motion forms an arch rather than pivoting rigidly at its root');
  for(const key of ['frontL','frontR']){
    assert.ok(reach[key]>.04,`${key} must reach visibly beyond the nose: ${reach[key]}`);
    assert.ok(reachFrames[key]>=12,`${key} forward reach must last, not flash for one frame`);
  }
  assert.deepEqual(baseGeometry.attributes.skinWeight.array,sourceWeights,'running keeps the approved coat weights intact');
  assert.deepEqual(coat.geometry.attributes.position.array,baseGeometry.attributes.position.array,'skin correction preserves the existing body shape');
  animateCabinLucy(root,{dt:1/60,time:0,mode:'idle',yaw:0,headingControlled:true});
  assert.equal(coat.geometry,baseGeometry,'returning to idle restores the approved coat');
  rig.dispose();
});
