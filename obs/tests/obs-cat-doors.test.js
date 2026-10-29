import test from 'node:test';
import assert from 'node:assert/strict';
import {Box3,Group,MeshStandardMaterial,Raycaster,Vector3} from 'three';
import {CatMotion,FLOORS} from '../src/obs/state.js';
import {CAT_PORT} from '../src/obs/layout.js';
import {catPort,catPortOpening,animateCatPorts} from '../src/obs/cat-ports.js';
import {box} from '../src/obs/materials.js';

test('cat doors unplug and slide into clipped side pockets while their frames stay fixed',()=>{
  const material=new MeshStandardMaterial(),m=new Proxy({},{get:()=>material});
  const fixed=new Group(),animated=new Group(),x=(CAT_PORT.x-700)*.022;
  const ctx={fillRect(){},fillText(){},measureText(){return{width:100};}};
  globalThis.document={createElement:()=>({getContext:()=>ctx})};
  let ports;
  try{ports=FLOORS.map((floor,level)=>catPort(fixed,m,x,(870-floor.y)*.016,level,animated));}
  finally{delete globalThis.document;}
  for(const port of ports){
    assert.equal(port.door.parent,animated,'moving leaves are never merged into the static ship');
    const initial=port.door.position.clone(),frame=port.root.position.clone();
    box(fixed,material,x,frame.y+.38,CAT_PORT.wallZ-.156,1,1,.06);
    const bounds=new Box3().setFromObject(port.door);
    assert.ok(bounds.min.x<x-CAT_PORT.width/2&&bounds.max.x>x+CAT_PORT.width/2);
    const mouth=port.root.children.find(mesh=>mesh.material?.isMeshBasicMaterial&&!mesh.material.map);
    for(const fraction of [0,.1,.2,.4,.6,.8,1]){
      animateCatPorts(ports,{from:port.level,to:(port.level+1)%3,phase:'open',age:fraction,duration:1});
      const opening=catPortOpening({from:port.level,phase:'open',age:fraction,duration:1},port.level);
      assert.deepEqual(port.root.position.toArray(),frame.toArray());
      assert.equal(port.door.position.y,initial.y);
      assert.deepEqual(port.door.rotation.toArray().slice(0,3),[0,0,0]);
      if(opening<=.32)assert.equal(port.door.position.x,initial.x);
      if(port.door.position.x<initial.x)assert.equal(port.door.position.z,initial.z-.03);
      assert.ok(port.door.position.z-.014>port.root.position.z+mouth.position.z,'recess does not hide the inward sliding leaf');
      for(const other of ports)if(other!==port)assert.ok(other.door.position.equals(other.door.userData.shutter.closed));
    }
    assert.ok(new Box3().setFromObject(port.door).max.x<x-CAT_PORT.width/2,'open leaf fully clears the passage');
    fixed.updateMatrixWorld(true);animated.updateMatrixWorld(true);
    const ray=new Raycaster(new Vector3(x,frame.y+.38,10),new Vector3(0,0,-1));
    assert.equal(ray.intersectObjects([fixed,animated],true)[0].object,mouth,'the open gate reveals the dark duct, not the rear lining');
    port.door.traverse(part=>{
      if(!part.isMesh)return;
      assert.equal(part.material.clippingPlanes.length,2);assert.equal(part.material.clipShadows,true);
      assert.notEqual(part.material,material);
    });
    animateCatPorts(ports,null);assert.ok(port.door.position.equals(initial));
  }
  assert.equal(material.clippingPlanes,null);
  for(const root of [fixed,animated])root.traverse(part=>{part.geometry?.dispose();if(part.material!==material){part.material?.map?.dispose();part.material?.dispose();}});
  material.dispose();
});

for(const from of [0,1,2])for(const to of [0,1,2])if(from!==to)test(`deck ${from} to ${to}: open, enter, close, travel, open, exit, close`,()=>{
  const motion=new CatMotion({floor:from,x:CAT_PORT.x}),phases=[],seen=new Set();let arrived=0;
  motion.goTo({floor:to,x:CAT_PORT.x+30},()=>arrived++);
  let previous=[0,0,0];
  for(let frame=0;frame<60*60&&motion.busy;frame++){
    motion.update(1/60);
    const p=motion.portal,openings=FLOORS.map((_,level)=>catPortOpening(p,level));
    assert.ok(openings.filter(value=>value>0).length<=1,'entrance closes before the destination opens');
    openings.forEach((value,level)=>assert.ok(Math.abs(value-previous[level])<.04,'door movement remains continuous between phases'));
    previous=openings;
    if(!p)continue;
    if(phases.at(-1)!==p.phase)phases.push(p.phase);
    if(['enter','exit'].includes(p.phase))assert.equal(openings[p.phase==='enter'?from:to],1,'Lucy only crosses a fully open doorway');
    if(['close','transit','reopen'].includes(p.phase)){assert.equal(motion.hidden,true);assert.equal(motion.z,CAT_PORT.insideZ);}
    if(p.phase==='transit')assert.deepEqual(openings,[0,0,0]);
    if(p.phase==='shut')assert.ok(Math.abs(motion.z-(CAT_PORT.walkZ-CAT_PORT.turnInset))<1e-12,'tail has cleared the exit before closing');
    if(!seen.has(p.phase)){
      seen.add(p.phase);const before=[motion.x,motion.y,motion.z,p.age];motion.update(0);
      assert.deepEqual([motion.x,motion.y,motion.z,p.age],before);
      assert.deepEqual(FLOORS.map((_,level)=>catPortOpening(p,level)),openings,'pause freezes both doors');
    }
  }
  assert.deepEqual(phases,['turnIn','open','enter','close','transit','reopen','exit','shut','turnOut']);
  assert.equal(arrived,1);assert.equal(motion.floor,to);assert.equal(motion.busy,false);
  assert.deepEqual(FLOORS.map((_,level)=>catPortOpening(motion.portal,level)),[0,0,0]);
});
