import test from 'node:test';
import assert from 'node:assert/strict';
import {Group,Matrix4,MeshStandardMaterial,Vector3} from 'three';
import {createKibbleStream,kibbleDrops,KIBBLE_STREAM,sampleKibbleDrop} from '../src/obs/kibble-stream.js';
import {createDroid} from '../src/obs/droid-model.js';
import {createDroidServiceRig} from '../src/obs/droid-service.js';
import {DroidRoutine} from '../src/obs/droid-routine.js';
import {Supplies} from '../src/obs/state.js';
import {PlantBed} from '../src/obs/plant-state.js';
import {CAT_BOWL,LADDER_X} from '../src/obs/layout.js';
import {createCabinToon} from '../src/obs/cabin-toon.js';

const source=new Vector3(-4.57,.5,.92),bowl=new Vector3(-4.62,.135,.89);

test('every refill has staggered individual grains and a fresh, reproducible pattern',()=>{
  const a=kibbleDrops(0),b=kibbleDrops(1);
  assert.deepEqual(a,kibbleDrops(0));assert.notDeepEqual(a,b);
  assert.ok(a.length>100&&a.length<220);
  const gaps=a.slice(1).map((d,i)=>+(d.birth-a[i].birth).toFixed(5));
  assert.ok(new Set(gaps).size>80,'not synchronized clumps or a fixed repeating interval');
  assert.ok(new Set(a.map(d=>d.x)).size>100);
  for(const drop of a){
    assert.ok(drop.birth>=KIBBLE_STREAM.start&&drop.birth<5);
    assert.ok(Math.hypot(drop.x,drop.z)<.106,'land inside the bowl');
    assert.ok(drop.radius>=.009&&drop.radius<=.013);
  }
});

test('individual drops accelerate, bounce only in the bowl and expire below its rim',()=>{
  for(const d of kibbleDrops(5)){
    const a=new Vector3(),b=new Vector3(),c=new Vector3();
    assert.equal(sampleKibbleDrop(d,d.birth-.001,source,bowl,a),false);
    assert.ok(sampleKibbleDrop(d,d.birth,source,bowl,a));assert.equal(a.y,source.y);
    assert.ok(sampleKibbleDrop(d,d.birth+.05,source,bowl,b));
    assert.ok(sampleKibbleDrop(d,d.birth+.1,source,bowl,c));
    assert.ok(b.y-c.y>a.y-b.y,'grains accelerate separately instead of bobbing as a group');
    const flight=(Math.sqrt(d.down**2+2*KIBBLE_STREAM.gravity*(source.y-bowl.y))-d.down)/KIBBLE_STREAM.gravity;
    sampleKibbleDrop(d,d.birth+flight+.001,source,bowl,b);
    assert.ok(Math.hypot(b.x-bowl.x,b.z-bowl.z)<=.106);assert.ok(b.y>=bowl.y);
    sampleKibbleDrop(d,d.birth+flight+d.settle-.00001,source,bowl,c);
    assert.ok(c.y<bowl.y-.024);
    assert.equal(sampleKibbleDrop(d,d.birth+flight+d.settle+.001,source,bowl,c),false);
  }
});

test('the stream uses one bounded instanced draw and stays stable when paused or seeking',()=>{
  const material=new MeshStandardMaterial(),stream=createKibbleStream(material),mesh=stream.mesh;
  try{
    assert.equal(mesh.isInstancedMesh,true);assert.equal(mesh.castShadow,false);assert.equal(mesh.material,material);
    const root=new Group();root.add(mesh);const toon=createCabinToon([root]);toon.setStyle('cartoon');
    assert.equal(root.children.length,1,'no full-size non-instanced outline shell');toon.dispose();
    assert.equal(mesh.geometry.index.count/3,48);
    assert.equal(stream.update(1,6,0,source,bowl),0);
    let peak=0;
    for(let time=1.5;time<5.9;time+=1/120){
      const count=stream.update(time,6,0,source,bowl);peak=Math.max(peak,count);
      assert.ok(count<KIBBLE_STREAM.capacity,'no active grain is dropped due to pool exhaustion');
    }
    assert.ok(peak>12&&peak<40);assert.equal(mesh.count,0);
    const matrices=()=>mesh.instanceMatrix.array.slice(0,mesh.count*16);
    stream.update(3,6,0,source,bowl);const snapshot=matrices();
    stream.update(3,6,0,source,bowl);assert.deepEqual(matrices(),snapshot,'pause');
    stream.update(4,6,0,source,bowl);stream.update(3,6,0,source,bowl);
    assert.deepEqual(matrices(),snapshot,'seek back');
    stream.update(3,6,1,source,bowl);assert.notDeepEqual(matrices(),snapshot,'next refill');
    stream.update(6,6,1,source,bowl);assert.equal(mesh.count,0);assert.equal(mesh.visible,false);
  }finally{mesh.dispose();mesh.geometry.dispose();material.dispose();}
});

test('the OBS service rig emits from the pouch, stops without food and changes the next refill',()=>{
  const care=new Supplies(),routine=new DroidRoutine({care,brain:{plants:new PlantBed()},actor:{x:1040},cat:{mode:'sleep'}});
  const droid=createDroid({detail:'obs'}),rig=createDroidServiceRig({droid},{cargo:[]});
  try{
    assert.ok(routine.request('feed'));
    for(let i=0;i<20000&&!(routine.pose.action==='food-pour'&&routine.pose.age>=3);i++)routine.update(.01);
    assert.equal(routine.pose.action,'food-pour');rig.update(routine);
    const group=rig.props.kibble,mesh=group.children[0];
    assert.equal(group.children.length,1);assert.equal(mesh.isInstancedMesh,true);assert.ok(group.visible&&mesh.count>10);
    assert.deepEqual(group.position.toArray(),[0,0,0],'individual transforms carry all movement');
    const matrix=new Matrix4(),point=new Vector3(),lip=new Vector3(0,.125,.006).applyQuaternion(rig.props.food.quaternion).add(rig.props.food.position);
    const bottom=new Vector3(0,-.125,0).applyQuaternion(rig.props.food.quaternion).add(rig.props.food.position);
    assert.ok(lip.y<bottom.y-.1,'the open top points down while pouring, not the sealed bottom');
    for(let i=0;i<mesh.count;i++){
      mesh.getMatrixAt(i,matrix);point.setFromMatrixPosition(matrix);
      assert.ok(point.y<=lip.y+.001&&point.y>CAT_BOWL.foodHeight-.031);
      assert.ok(Math.abs(point.x-(CAT_BOWL.x-LADDER_X)*.022)<.35);
    }
    const snapshot=mesh.instanceMatrix.array.slice();routine.update(0);rig.update(routine);
    assert.deepEqual(mesh.instanceMatrix.array,snapshot);
    const pose=routine.pose;
    rig.update({...routine,pose:{...pose,time:pose.time+100},completed:{feed:1}});
    assert.notDeepEqual(mesh.instanceMatrix.array,snapshot);
    rig.update({...routine,pose:{...pose,time:pose.time+101},carriedFood:false});assert.equal(group.visible,false);
    for(let i=0;i<1000&&routine.pose.action==='food-pour';i++)routine.update(.01);
    rig.update(routine);assert.equal(group.visible,false);
    assert.equal(care.catBowl,1);assert.equal(care.supplies.catfood,2,'visual randomness never changes inventory');
  }finally{
    droid.dispose();const geometries=new Set(),materials=new Set();
    rig.root.traverse(o=>{if(o.isInstancedMesh)o.dispose();if(o.geometry)geometries.add(o.geometry);if(o.material)materials.add(o.material);});
    geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());
  }
});
