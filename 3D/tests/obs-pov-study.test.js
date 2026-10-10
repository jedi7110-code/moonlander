import test from 'node:test';
import assert from 'node:assert/strict';
import {Group,Quaternion,Vector3,PerspectiveCamera,Mesh,MeshStandardMaterial,BoxGeometry,Raycaster} from 'three';
import {HeadLookRig,LookInput,LOOK_PROFILES} from '../studies/pov/look.js';
import {StableFirstPersonCamera,maskSelfView} from '../studies/pov/comfort.js';
import {createViewingWall,cabinWallMaterials} from '../studies/pov/front-wall.js';
import {EVA_BAY,createEVAHatch,createEVAPartitions} from '../src/obs/eva.js';
import {FLOOR_Y} from '../src/obs/ship.js';
import {DECK,LADDER_X} from '../src/obs/layout.js';
import {BunkVisit,BUNK_PHASE_SECONDS} from '../src/obs/bunk-visit.js';
import {sleepView} from '../studies/pov/sleep-view.js';
import {createMilo,animateMilo} from '../src/obs/characters.js';
import {applyCabinLadder,CABIN_LADDER} from '../src/obs/cabin-ladder.js';
import {LADDER} from '../src/obs/ladder-pose.js';
import {crewWalkway} from '../src/obs/cabin-walkway.js';
import {CrewMotion} from '../src/obs/state.js';

test('each viewer clamps mouse and touch input, recenters, and eases without frame-rate dependence',()=>{
  for(const id of Object.keys(LOOK_PROFILES)){
    const a=new LookInput(id),b=new LookInput(id);a.setNormalized(20,20);b.setNormalized(1,1);
    for(let i=0;i<60;i++)a.update(1/60);for(let i=0;i<30;i++)b.update(1/30);
    assert.ok(Math.abs(a.yaw-b.yaw)<1e-12);assert.ok(Math.abs(a.pitch-b.pitch)<1e-12);
    a.drag(100000,100000);assert.equal(a.targetYaw,LOOK_PROFILES[id].yaw*Math.PI/180);assert.equal(a.targetPitch,-LOOK_PROFILES[id].down*Math.PI/180);
    a.reset();assert.equal(a.yaw,0);assert.equal(a.targetPitch,0);
  }
});
test('look follows the actual skull while holding its neck attachment fixed and restores animation exactly',()=>{
  const root=new Group(),head=new Group();root.add(head);head.position.set(0,1.64,0);root.rotation.y=.6;
  const anchor=new Vector3(0,-.03,.009),initial=head.position.clone();
  const rig=new HeadLookRig(head,root,new Vector3(0,.10,.13),{neckAnchor:anchor});
  const pivot=anchor.clone().applyQuaternion(head.quaternion).add(head.position),first=rig.eyePosition();
  for(let i=0;i<100;i++)rig.apply(.6,.3);
  assert.ok(anchor.clone().applyQuaternion(head.quaternion).add(head.position).distanceTo(pivot)<1e-12);
  assert.ok(rig.eyePosition().distanceTo(first)>.03);const turned=head.quaternion.clone();
  rig.apply(.6,.3);assert.ok(head.quaternion.angleTo(turned)<1e-7,'paused frames must not accumulate rotations');
  rig.restore();assert.ok(head.position.distanceTo(initial)<1e-12);assert.ok(head.quaternion.angleTo(new Quaternion())<1e-7);
  root.position.x=12;assert.ok(Math.abs(rig.eyePosition().x-first.x-12)<1e-12,'eyes travel with their owner');
});
test('arbitrary bone axes still produce an anatomical right turn rather than skull roll',()=>{
  const root=new Group(),head=new Group();root.add(head);head.rotation.set(.4,.7,-1.1);
  const rig=new HeadLookRig(head,root,new Vector3());rig.apply(Math.PI/4,0);
  const forward=new Vector3(0,0,1).applyQuaternion(rig.orientation());
  assert.ok(forward.x<-.7);assert.ok(Math.abs(forward.y)<1e-12);assert.ok(forward.z>.7);
});

test('walking eyes keep a level horizon and height despite animated head bob, while looking still works',()=>{
  const root=new Group(),camera=new PerspectiveCamera(),eye=new Vector3(0,1.73,.12);
  const comfort=new StableFirstPersonCamera(root,eye);
  for(let i=0;i<360;i++){
    root.position.x=i/60;
    comfort.update(camera,{eye:new Vector3(root.position.x,1.73+.06*Math.sin(i),.12),yaw:.35,pitch:.2,dt:1/60});
    assert.ok(Math.abs(camera.position.y-1.73)<1e-10,'walking must not bob the eye level');
    assert.ok(Math.abs(new Vector3(1,0,0).applyQuaternion(camera.quaternion).y)<1e-10,'the horizon must not roll');
  }
  assert.ok(camera.position.x>5.8,'camera continues along with the character');
  assert.ok(new Vector3(0,0,-1).applyQuaternion(camera.quaternion).y>.19,'upward user input is preserved');
  comfort.update(camera,{eye:new Vector3(6,1.1,.12),standing:false,yaw:0,pitch:0,dt:1/60});
  assert.ok(camera.position.y<1.73&&camera.position.y>1.1,'sitting eases to the new height');
});

test('walking keeps a small eye clearance during travel and turns without pushing the viewpoint far forward',()=>{
  const root=new Group(),camera=new PerspectiveCamera(),neutral=new Vector3(0,1.73,.12);
  const comfort=new StableFirstPersonCamera(root,neutral);
  for(let i=0;i<360;i++){
    root.position.set(i/30,0,Math.sin(i/40));root.rotation.y=i/90;
    const eye=root.localToWorld(neutral.clone()),original=eye.clone();
    comfort.update(camera,{eye,yaw:Math.sin(i/12)*75*Math.PI/180,pitch:Math.cos(i/12)*50*Math.PI/180,dt:1/60});
    const local=root.worldToLocal(camera.position.clone());
    assert.ok(Math.abs(local.z-.16)<1e-9,'keep only 4 cm ahead of the eyes, allowing the chest and shoulders in view');
    assert.ok(Math.abs(local.x)<1e-9);assert.ok(Math.abs(local.y-1.73)<1e-9);
    assert.ok(eye.equals(original),'the actual skeletal eye anchor is not moved');
  }
});

test('ladder eyes and their near plane stay on the crew side of the rungs throughout ascent and descent',()=>{
  const material=new MeshStandardMaterial(),root=createMilo(new Proxy({},{get:()=>material}));
  const camera=new PerspectiveCamera(72,16/9,.025,150),neutral=new Vector3(0,1.73,.12);
  const rig=new HeadLookRig(root.userData.head,root.userData.body,root.userData.head.worldToLocal(neutral.clone()));
  const comfort=new StableFirstPersonCamera(root,neutral);
  for(const fps of [60,120])for(const [from,to]of [[2,1],[1,2],[2,0],[0,2],[1,0],[0,1]]){
    const startHeight=FLOOR_Y[from],endHeight=FLOOR_Y[to];
    const startDepth=crewWalkway(0,from).z,endDepth=crewWalkway(0,to).z;
    const actor=new CrewMotion({floor:from,x:LADDER_X});actor.goTo({floor:to,x:LADDER_X});
    comfort.reset();let previous;
    // Use OBS's supported three-second deck transfers, rather than sweeping
    // linearly through them several times faster than the running actor.
    for(let i=0;i<fps*35;i++){
      rig.restore();const height=(870-actor.y)*.016;
      root.position.set(0,height,startDepth);animateMilo(root,{time:0,moving:false});
      applyCabinLadder(root,{height,startHeight,endHeight,startYaw:Math.PI/2,endYaw:-Math.PI/2,startDepth,endDepth});
      const yaw=Math.sin(i/15)*75*Math.PI/180,pitch=Math.cos(i/17)*50*Math.PI/180;
      rig.apply(yaw,pitch);const eye=rig.eyePosition();
      comfort.update(camera,{eye,yaw,pitch,dt:1/fps,climbing:true});
      assert.ok(Math.abs(camera.position.x-eye.x)<1e-9&&Math.abs(camera.position.z-eye.z)<1e-9,'climbing uses the actual eye position without a forward offset');
      camera.updateMatrixWorld(true);
      for(const x of [-1,1])for(const y of [-1,1]){
        const corner=new Vector3(x,y,-1).unproject(camera);
        assert.ok(corner.z>CABIN_LADDER.depth+LADDER.radius+.02,`near plane crosses a rung at height ${height}`);
      }
      if(previous)assert.ok(camera.position.distanceTo(previous)<.1,'deck transfers remain continuous');
      previous=camera.position.clone();
      if(!actor.climbing)break;
      actor.update(1/fps);
    }
    assert.equal(actor.climbing,false,'every deck route completes');
  }
  root.traverse(mesh=>mesh.geometry?.dispose());material.dispose();
});

test('self-view masking never hides the head from another camera or leaves it hidden after switching/resizing',()=>{
  const mesh=new Mesh(new BoxGeometry(),new MeshStandardMaterial()),camera=new PerspectiveCamera(),mirror=new PerspectiveCamera();
  let active=true;const original=mesh.onBeforeRender,restore=maskSelfView(mesh,camera,()=>active);
  for(let i=0;i<6;i++){
    mesh.onBeforeRender(null,null,camera,mesh.geometry,mesh.material);
    assert.equal(mesh.material.colorWrite,false);assert.equal(mesh.material.depthWrite,false);assert.equal(mesh.visible,true);
    mesh.onAfterRender();
    assert.equal(mesh.material.colorWrite,true);assert.equal(mesh.material.depthWrite,true);
  }
  mesh.onBeforeRender(null,null,mirror,mesh.geometry,mesh.material);
  assert.equal(mesh.material.colorWrite,true,'mirror must see the head');mesh.onAfterRender();
  active=false;mesh.onBeforeRender(null,null,camera,mesh.geometry,mesh.material);
  assert.equal(mesh.material.colorWrite,true,'outside view must see the head');mesh.onAfterRender();
  restore();assert.equal(mesh.onBeforeRender,original);mesh.geometry.dispose();mesh.material.dispose();
});

test('first person follows the actual bed transfer head pose, and closes eyes only once lying down',()=>{
  const material=new MeshStandardMaterial(),root=createMilo(new Proxy({},{get:()=>material})),camera=new PerspectiveCamera();
  const {head,body}=root.userData,eyeLocal=head.worldToLocal(new Vector3(0,1.73,.12));
  const rig=new HeadLookRig(head,body,eyeLocal),comfort=new StableFirstPersonCamera(root,rig.eyePosition());
  const visit=new BunkVisit();visit.startYaw=0;
  let previous=null,frames=0,sawTurn=false,sawSleep=false;
  const heights={};
  while(visit.phase!=='done'&&frames++<2400){
    rig.restore();animateMilo(root,{moving:false,facing:1,action:'bunk',time:frames/60,bunkVisit:visit});
    root.updateMatrixWorld(true);
    const pose=visit.pose,state=sleepView(pose);
    rig.apply(0,0);
    const eye=rig.eyePosition(),orientation=rig.orientation();
    const args={eye,yaw:0,pitch:0,standing:false,recline:pose.recline,attachedOrientation:orientation,dt:1/60};
    comfort.update(camera,args);
    const direction=camera.getWorldDirection(new Vector3()),headForward=new Vector3(0,0,1).transformDirection(head.matrixWorld);
    assert.ok(direction.distanceTo(headForward)<1e-9,`camera must face with the actual head during ${pose.phase}`);
    assert.ok(camera.position.clone().sub(eye).normalize().distanceTo(headForward)<1e-9,'eye clearance follows the head, not a separate tilt');
    if(previous){
      assert.ok(previous.q.angleTo(camera.quaternion)<.05,`no heading snap in ${pose.phase}`);
      assert.ok(previous.p.distanceTo(camera.position)<.06,`no position jump in ${pose.phase}`);
    }
    previous={q:camera.quaternion.clone(),p:camera.position.clone()};
    if(frames%60===0){
      comfort.reset();comfort.update(camera,{...args,dt:0});
      assert.ok(previous.q.angleTo(camera.quaternion)<1e-7&&previous.p.distanceTo(camera.position)<1e-9,'paused view switches preserve the exact bed pose');
    }
    heights[pose.phase]??=camera.position.y;
    if(pose.phase==='lowering'&&pose.recline>.4&&pose.recline<.7&&direction.x>.3)sawTurn=true;
    if(pose.recline<1)assert.equal(state.closure,0,'no eyelids over sitting or lowering');
    if(state.closure>0)assert.ok(direction.y>.999,'close eyes only after the animated head is facing up');
    if(pose.phase==='sleeping'){
      sawSleep=true;assert.equal(state.closure,1);assert.ok(camera.position.distanceTo(eye)<.04);visit.requestExit();
    }
    visit.update(1/60);
  }
  assert.equal(visit.phase,'done');assert.ok(sawTurn&&sawSleep);
  assert.ok(heights.approaching-heights.entering>.65,'the viewer descends from standing to the pillow with Milo');
  assert.ok(heights.lowering-heights.entering>.4,'the actual lowering motion remains visible before closing');
  root.traverse(mesh=>mesh.geometry?.dispose());material.dispose();
});

test('eyelids follow bed entry and waking continuously, including paused and cancelled visits',()=>{
  for(const cancelAt of [null,'lowering','entering','closing']){
    const visit=new BunkVisit();let previous=0,sawClosed=false,requested=false;
    for(let i=0;i<4000&&visit.phase!=='done';i++){
      const state=sleepView(visit.pose);
      assert.ok(Math.abs(state.closure-previous)<.012,'no flash between bed phases');
      if(state.closure>0&&state.closure<1){
        const paused=sleepView(visit.pose);visit.update(0);
        assert.deepEqual(sleepView(visit.pose),paused,'pausing holds the partially closed eyelids');
      }
      if(visit.phase==='sleeping'){assert.equal(state.closure,1);sawClosed=true;visit.requestExit();}
      if(visit.phase===cancelAt&&visit.age>BUNK_PHASE_SECONDS[cancelAt]/2&&!requested){visit.requestExit();requested=true;}
      previous=state.closure;visit.update(1/60);
    }
    assert.equal(visit.phase,'done');assert.deepEqual(sleepView(visit.pose),{locked:false,recline:0,closure:0});
    if(!cancelAt)assert.equal(sawClosed,true);
  }
});

test('sleep darkness is scoped to Milo first person and restores immediately when returning',()=>{
  const visit=new BunkVisit({startAsleep:true}),pose=visit.pose;
  assert.equal(sleepView(pose).closure,1);
  for(const id of ['cat','droid',null])assert.deepEqual(sleepView(pose,id),{locked:false,recline:0,closure:0});
  assert.equal(sleepView(pose,'milo',true).closure,0);
  assert.equal(sleepView(pose,'milo').closure,1);
  assert.deepEqual(sleepView(null),{locked:false,recline:0,closure:0});
});

test('both pressure partitions seal the widened deck even when the viewing wall is hidden',()=>{
  const m=Object.fromEntries(Object.entries({enamel:'worn ivory',dark:'structural iron',metal:'brushed steel',rubber:'rubber'}).map(([key,name])=>[key,new MeshStandardMaterial({name:`Cabin toon / Industrial / ${name}`})]));
  const source=new Mesh(new BoxGeometry(),Object.values(m));assert.deepEqual(cabinWallMaterials(source),m);
  const enclosure=createViewingWall(m,{mergeStatic:false});enclosure.visible=true;
  const context=new Proxy({measureText:text=>({width:text.length*8})},{get:(o,k)=>o[k]??(()=>{})});
  const previous=globalThis.document;globalThis.document={createElement:()=>({getContext:()=>context})};
  let hatches;
  try{hatches=[true,false].map(inner=>createEVAHatch(new Proxy(m,{get:(o,k)=>o[k]??o.enamel}),FLOOR_Y[DECK.OPERATIONS],inner));}
  finally{if(previous)globalThis.document=previous;else delete globalThis.document;}
  const floor=FLOOR_Y[DECK.OPERATIONS];
  const partitions=createEVAPartitions(m,floor),world=new Group();world.add(enclosure,partitions,...hatches);world.updateMatrixWorld(true);
  const visible=hit=>{for(let node=hit.object;node;node=node.parent)if(!node.visible)return false;return true;};
  for(const showFront of [true,false])for(const x of [EVA_BAY.innerX,EVA_BAY.hatchX]){
    enclosure.visible=showFront;
    for(const height of [.4,1.5,2.78,2.9,3.12,...(x===EVA_BAY.innerX?[3.32]:[])])for(const z of [1.35,1.40,1.49,1.6,1.9,2.2,2.43]){
      const ray=new Raycaster(new Vector3(x-1,floor+height,z),new Vector3(1,0,0),0,1.7);
      assert.ok(ray.intersectObject(world,true).some(visible),`visible partition seals x=${x}, y=${height}, z=${z}, showFront=${showFront}`);
    }
  }
  // Raycaster also visits invisible meshes; omit the fully open leaf here.
  hatches[0].userData.door.removeFromParent();
  const opening=new Raycaster(new Vector3(EVA_BAY.innerX-1,floor+1.6,.78),new Vector3(1,0,0),0,1.7);
  assert.equal(opening.intersectObject(world,true).filter(visible).length,0,'the inner hatch still opens through the crew lane');
  enclosure.visible=true;
  const frontRay=new Raycaster(new Vector3(4,FLOOR_Y[1]+1.5,1),new Vector3(0,0,1));
  assert.equal(frontRay.intersectObject(enclosure,true)[0].object.material,m.enamel,'same actual ivory material as the cabin');
  world.traverse(mesh=>mesh.geometry?.dispose());source.geometry.dispose();Object.values(m).forEach(material=>material.dispose());
});
