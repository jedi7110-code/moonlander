import test from 'node:test';
import assert from 'node:assert/strict';
import {CatRoutine,Supplies,FLOORS,CrewMotion,advanceCabinTraffic} from '../src/obs/state.js';
import {CAT_PORT,DECK,getStation} from '../src/obs/layout.js';
import {CabinBrain} from '../src/obs/brain.js';
import {RUN_SPEED,MOUSE_WALK_SPEED} from '../src/obs/lucy-run-motion.js';
import {Box3,MeshStandardMaterial,Raycaster,Vector3} from 'three';
import {buildShip,FLOOR_Y,HABITAT_VIEW} from '../src/obs/ship.js';
import {MOUSE_ROUTES,OPENING_MOUSE_ROUTE} from '../src/obs/mouse-route.js';
import {createCabinMouse} from '../src/obs/mouse.js';

function fixture({floor=2,x=510,facing=1}={}){
  const cat=new CatRoutine(new Supplies(),{turns:true,mouseChase:true,random:()=>.5});
  Object.assign(cat.motion,{floor,x,y:FLOORS[floor].y,z:CAT_PORT.walkZ,onSofa:false,elevation:0,heading:facing*Math.PI/2,facing,turn:null});
  Object.assign(cat,{mode:'idle',modeTime:0,remaining:100,hunger:90,energy:90});
  return cat;
}
const advance=(cat,seconds,check=()=>{})=>{for(let t=0;t<seconds-1e-9;t+=1/60){cat.update(1/60);check(cat);}};

test('OBS uses the approved study chase on every floor without teleporting Lucy or changing her lane',()=>{
  for(const floor of [0,1,2])for(const facing of [-1,1]){
    const cat=fixture({floor,x:facing===1?510:1000,facing}),start=cat.motion.x,route=cat.mouseChase;
    assert.equal(route.appear(cat,floor),true);assert.equal(cat.motion.x,start);
    let previous=start,fastest=0,travel=0;
    for(let i=0;i<1800&&route.controlled;i++){
      cat.update(1/60);
      assert.equal(cat.motion.floor,floor);assert.equal(cat.motion.y,FLOORS[floor].y);assert.equal(cat.motion.z,CAT_PORT.walkZ);
      assert.ok(Math.abs(cat.motion.x-previous)*.022<=RUN_SPEED/60+1e-8,'no position jumps');
      travel+=Math.abs(cat.motion.x-previous)*.022;previous=cat.motion.x;
      fastest=Math.max(fastest,route.pose?.speed??0);
    }
    assert.ok(fastest>1.5);assert.ok(travel>.45);assert.equal(route.controlled,false);assert.equal(route.mouse.visible,false);
    assert.equal(cat.motion.chase,null);assert.equal(cat.motion.turn,null);assert.ok(route.wait>60);
  }
});

test('other floors and occupied activities do not interrupt Lucy',()=>{
  for(const mode of ['eat','fetch','play','joinPlay']){
    const cat=fixture();cat.mode=mode;
    cat.mouseChase.appear(cat,cat.motion.floor);
    assert.equal(cat.mouseChase.controlled,false);assert.equal(cat.pendingMove,null);assert.equal(cat.mode,mode);
    for(let i=0;i<12*60;i++){
      cat.mouseChase.update(1/60,cat);
      assert.equal(cat.mouseChase.mouse.spotted,false);assert.ok(cat.mouseChase.mouse.speed<=MOUSE_WALK_SPEED+1e-9);
    }
  }
  const cat=fixture();cat.mouseChase.appear(cat,0);advance(cat,12);
  assert.equal(cat.motion.x,510);assert.equal(cat.motion.floor,2);assert.equal(cat.mouseChase.controlled,false);
  assert.equal(cat.mouseChase.mouse.visible,true);assert.equal(cat.mouseChase.mouse.phase,'walk');
  advance(cat,53);assert.equal(cat.mouseChase.mouse.visible,false);
  for(const property of ['onSofa','portal','hop']){
    const occupied=fixture();occupied.motion[property]=true;
    occupied.mouseChase.appear(occupied,2);assert.equal(occupied.mouseChase.controlled,false);
  }
});

test('resting Lucy finishes rising before a chase and a feeding command cancels chase preparation',()=>{
  const cat=fixture();cat.mode='sleep';cat.modeTime=6;
  cat.mouseChase.appear(cat,2);
  assert.equal(cat.pendingMove.kind,'mouse');assert.equal(cat.mouseChase.controlled,false);
  advance(cat,.3);assert.equal(cat.motion.x,510);
  advance(cat,3);assert.equal(cat.mouseChase.controlled,true);
  advance(cat,3);const x=cat.motion.x;cat.fetch();
  assert.equal(cat.mouseChase.controlled,false);assert.equal(cat.mode,'fetch');assert.equal(cat.motion.x,x);
  assert.equal(cat.motion.chase,null);assert.equal(cat.pendingMove,null);
  const sleeper=fixture();sleeper.mode='sleep';sleeper.modeTime=6;
  sleeper.mouseChase.appear(sleeper,2);sleeper.fetch();
  assert.equal(sleeper.pendingMove.kind,'fetch');advance(sleeper,3);
  assert.equal(sleeper.mouseChase.controlled,false);assert.notEqual(sleeper.mode,'chase');
});

test('pause freezes appearance and pursuit, and passing crew cannot deadlock a chase',()=>{
  const cat=fixture(),route=cat.mouseChase,actor=new CrewMotion({floor:2,x:510});
  const wait=route.wait;cat.update(0);assert.equal(route.wait,wait);
  route.appear(cat,2);advance(cat,6);
  const state=JSON.stringify([route.sim,cat.motion.x,cat.motion.walkDistance]);cat.update(0);
  assert.equal(JSON.stringify([route.sim,cat.motion.x,cat.motion.walkDistance]),state);
  actor.goTo({floor:2,x:1000});
  for(let i=0;i<1200;i++){advanceCabinTraffic(actor,cat,1/60);assert.equal(actor.waitingForCat,false);}
  assert.equal(route.controlled,false);assert.equal(actor.x,1000);
});

test('occasional mice select all three floors and do not spawn again immediately after escaping',()=>{
  for(const random of [()=>0,()=>.5,()=>.99]){
    const cat=fixture(),route=cat.mouseChase;route.random=random;route.wait=.01;
    cat.update(1/60);assert.equal(route.mouse.floor,Math.floor(random()*3));assert.equal(route.mouse.visible,true);
    advance(cat,65);assert.equal(route.mouse.visible,false);assert.ok(route.wait>50);
  }
});

test('the opening mouse overtakes walking Lucy after landing, then escapes behind the sofa',()=>{
  const care=new Supplies(),actor=new CrewMotion(),cat=new CatRoutine(care,{turns:true,mouseChase:true,random:()=>.5});
  const brain=new CabinBrain({obsUI:{hideWant(){}}},actor,{care,random:()=>.5});brain.catRoutine=cat;brain.beginWakeUp();
  const chase=cat.mouseChase;let started=false,overtaken=false,walked=false,spawnX,previous=cat.motion.x,fastest=0;
  for(let i=0;i<40*60;i++){
    if(!started&&chase.appearOpening(cat)){
      started=true;spawnX=cat.motion.x;
      assert.equal(cat.bunkWake,null);assert.equal(cat.mode,'walk');assert.equal(chase.controlled,false);
      assert.ok(chase.mouse.x<(getStation('bunk').x-700)*.022);
      assert.ok(chase.mouse.x<(cat.motion.x-700)*.022);
      const snapshot=JSON.stringify([chase.sim,cat.motion.x,cat.motion.walkDistance]);cat.update(0);
      assert.equal(JSON.stringify([chase.sim,cat.motion.x,cat.motion.walkDistance]),snapshot);
    }
    advanceCabinTraffic(actor,cat,1/60);brain.update(1/60);
    assert.ok(Math.abs(cat.motion.x-previous)*.022<=RUN_SPEED/60+1e-8,'no teleport when walking becomes pursuit');previous=cat.motion.x;
    if(started&&!overtaken){
      if(chase.controlled){
        overtaken=true;assert.ok(walked,'Lucy must keep walking before she notices');
        assert.ok(chase.mouse.x>(cat.motion.x-700)*.022+.64,'the mouse has passed her nose');
      }else{
        walked||=cat.motion.x>spawnX+10;assert.equal(cat.mode,'walk');assert.equal(chase.mouse.spotted,false);
      }
    }
    fastest=Math.max(fastest,chase.pose?.speed??0);
    if(started&&!chase.sim.active)break;
  }
  assert.ok(started&&overtaken&&fastest>1.5);
  assert.equal(chase.mouse.visible,false);assert.equal(chase.controlled,false);assert.equal(chase.overtaking,false);
  assert.ok(chase.mouse.x>5.3&&chase.mouse.x<9.49);assert.ok(chase.mouse.z<-.7);
  assert.ok(chase.wait>60);
  chase.appear(cat,0);assert.equal(chase.sim.route,MOUSE_ROUTES[0]);assert.equal(chase.sim.overtake,false);
});

test('feeding before the opening mouse overtakes Lucy cancels her reaction',()=>{
  const cat=fixture({floor:DECK.HABITATION,x:534}),chase=cat.mouseChase;
  cat.mode='walk';cat.motion.goTo({floor:DECK.HABITATION,x:1005});
  assert.equal(chase.appearOpening(cat),true);advance(cat,.5);cat.fetch();
  assert.equal(chase.overtaking,false);
  for(let i=0;i<25*60;i++){
    chase.update(1/60,cat);assert.equal(chase.controlled,false);assert.equal(chase.mouse.spotted,false);
  }
  assert.equal(chase.mouse.visible,false);
});

test('rear furniture hides both ends, while the mouse follows a visible, supported route through its gaps',()=>{
  const ctx=new Proxy({measureText:t=>({width:t.length*8}),createLinearGradient:()=>({addColorStop(){}})},{get:(o,k)=>k in o?o[k]:()=>{}});
  const material=new MeshStandardMaterial();let ship;
  globalThis.document={createElement:()=>({getContext:()=>ctx})};
  try{ship=buildShip(new Proxy({},{get:()=>material}),{mergeStatic:false});}finally{delete globalThis.document;}
  const meshes=[],geometries=new Set(),materials=new Set();
  for(const root of [ship.staticMesh,ship.animated]){
    root.updateMatrixWorld(true);
    root.traverseVisible(mesh=>{if(mesh.isMesh&&mesh.material.visible!==false&&mesh.material.opacity!==0)meshes.push(mesh);});
    root.traverse(mesh=>{if(mesh.geometry)geometries.add(mesh.geometry);if(mesh.material)materials.add(mesh.material);});
  }
  const eye=new Vector3(0,HABITAT_VIEW.centerY+1.6,Math.sqrt(40**2-1.6**2)),ray=new Raycaster();
  // The additive screen glow batches nine separate glass apertures across
  // several decks. Its combined AABB includes empty space, not solid furniture.
  const boxes=meshes.filter(mesh=>mesh.name!=='Telemetry screen halos').map(mesh=>new Box3().setFromObject(mesh));
  try{
    for(const [floor,route]of [...MOUSE_ROUTES.entries(),[DECK.HABITATION,OPENING_MOUSE_ROUTE]]){
      const y=FLOOR_Y[floor];let visible=0;
      for(let i=0;i<=240;i++){
        const p=route.sample(route.length*i/240),x=route.center+p.x,z=p.z,head=new Vector3(x,y+.07,z);
        ray.set(eye,head.clone().sub(eye).normalize());ray.far=eye.distanceTo(head)-.01;
        if(!ray.intersectObjects(meshes,false).length)visible++;
        ray.set(new Vector3(x,y+.10,z),new Vector3(0,-1,0));ray.far=.12;
        assert.ok(ray.intersectObjects(meshes,false).some(hit=>Math.abs(hit.point.y-y)<.02),'floor supports every part of the route');
        const body=new Box3(new Vector3(x-.045,y+.025,z-.045),new Vector3(x+.045,y+.12,z+.045));
        assert.ok(!boxes.some(box=>box.intersectsBox(body)),`furniture clearance on deck ${floor}, sample ${i}`);
      }
      assert.ok(visible/241>.7,'the crossing remains visible between the hiding places');
      for(const direction of [-1,1])for(const distance of [0,route.length]){
        const p=route.sample(distance,direction);
        assert.ok(p.z<-.7,'both endpoints return to the rear furniture');
        for(const cameraX of [-8,0,8])for(const along of [-.26,-.1,0,.1]){
          const camera=eye.clone();camera.x=cameraX;
          const target=new Vector3(route.center+p.x+Math.sin(p.yaw)*along,y+.07,p.z+Math.cos(p.yaw)*along);
          ray.set(camera,target.clone().sub(camera).normalize());ray.far=camera.distanceTo(target)-.01;
          assert.ok(ray.intersectObjects(meshes,false).length,'head, body and tail hide behind furniture before appearing/disappearing');
        }
      }
    }
  }finally{
    geometries.forEach(geometry=>geometry.dispose());
    materials.forEach(m=>{m.map?.dispose();m.bumpMap?.dispose();m.roughnessMap?.dispose();m.dispose();});
  }
});

test('curved travel drives the mouse gait and heading without clipping it at imaginary walls',()=>{
  const cat=fixture(),chase=cat.mouseChase;cat.mode='eat';chase.appear(cat,1);
  let previous=chase.mouse,distance=0;
  for(let i=0;i<65*60&&chase.mouse.visible;i++){
    chase.update(1/60,cat);const mouse=chase.mouse;
    const step=Math.hypot(mouse.x-previous.x,mouse.z-previous.z);
    assert.ok(step<=MOUSE_WALK_SPEED/60+.00004);
    if(step>1e-5){
      const angle=Math.atan2(mouse.x-previous.x,mouse.z-previous.z);
      assert.ok(Math.cos(mouse.yaw-angle)>.98,'nose follows the curve');
    }
    distance+=step;previous=mouse;
  }
  assert.equal(chase.mouse.visible,false);
  assert.ok(Math.abs(chase.mouse.distance-distance)<.003,'footfall distance includes turns into the rear gaps');
  const mouse=createCabinMouse({clipAtStudyWalls:false});
  mouse.root.traverse(part=>{if(part.material)assert.equal(part.material.clippingPlanes.length,0);});
});
