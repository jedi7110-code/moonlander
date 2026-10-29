import test from 'node:test';
import assert from 'node:assert/strict';
import {Group,Mesh,BoxGeometry,MeshStandardMaterial} from 'three';
import {DroidRoutine} from '../src/obs/droid-routine.js';
import {Supplies} from '../src/obs/state.js';
import {PlantBed} from '../src/obs/plant-state.js';
import {createDroid} from '../src/obs/droid-model.js';
import {createDroidServiceRig,droidServiceExpression} from '../src/obs/droid-service.js';

test('work expressions reflect feeding, heavy carrying and the whole return to charging',()=>{
  const droid=createDroid({detail:'obs'}),cargo=Array.from({length:3},()=>new Mesh(new BoxGeometry(.61,.54,.43),new MeshStandardMaterial()));
  const rig=createDroidServiceRig({droid,cable:new Group()},{cargo});
  const seek=(routine,predicate)=>{
    for(let i=0;i<20000;i++){
      if(predicate(routine.pose)){rig.update(routine);return routine.pose;}
      routine.update(.05);
    }
    assert.fail('routine never reached the requested action');
  };
  try{
    for(const job of ['feed','cargo']){
      const care=new Supplies();if(job==='cargo')care.lastDelivery=1;
      const routine=new DroidRoutine({care,brain:{plants:new PlantBed(),actStation:null},actor:{x:1040,climbing:false},cat:{mode:'sleep'}});
      assert.ok(routine.request(job));
      seek(routine,p=>p.walking&&!p.returning&&!p.carrying);assert.equal(droid.face.expression,'neutral');
      if(job==='feed'){
        seek(routine,p=>p.action==='food-pour');assert.equal(droid.face.expression,'happy');
        routine.update(0);rig.update(routine);assert.equal(droid.face.expression,'happy','pause keeps the feeding expression');
        seek(routine,p=>p.action!=='food-pour');assert.equal(droid.face.expression,'neutral','stop smiling when the pour is complete');
      }else{
        seek(routine,p=>p.carrying==='cargo'&&p.walking);assert.equal(droid.face.expression,'strained');
        seek(routine,p=>p.action==='cargo-place');assert.equal(droid.face.expression,'strained','keep the effort face while lowering the load');
        seek(routine,p=>!p.carrying);assert.equal(droid.face.expression,'neutral','relax after placing the load');
      }
      seek(routine,p=>p.returning&&p.walking);assert.equal(droid.face.expression,'sleepy','already sleepy on the way back');
      seek(routine,p=>p.returning&&p.climb);assert.equal(droid.face.expression,'sleepy','returning expression also survives ladder travel');
      seek(routine,p=>p.mode==='charging');assert.equal(droid.face.expression,'sleepy');
    }
  }finally{
    droid.root.removeFromParent();droid.dispose();
    const geometries=new Set(),materials=new Set();rig.root.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material)materials.add(o.material);});
    geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());
  }
});

test('light loads stay neutral and heavy lifting starts when the cargo is raised',()=>{
  for(const carrying of ['food','cloth','greens','waste',null])assert.equal(droidServiceExpression({carrying}),'neutral');
  assert.equal(droidServiceExpression({action:'cargo-pick',age:1,duration:2.6}),'neutral');
  assert.equal(droidServiceExpression({action:'cargo-pick',age:1.5,duration:2.6}),'strained');
  assert.equal(droidServiceExpression({mode:'wake',returning:false}),'neutral');
});

test('blocked travel is sad and a visible mouse on any deck takes priority until it disappears',()=>{
  let blocked=false;
  const cat={mode:'sleep',motion:{blocksDroid:()=>blocked},mouseChase:{mouse:{visible:false,floor:2}}};
  const routine=new DroidRoutine({care:new Supplies(),brain:{plants:new PlantBed()},actor:{x:1040},cat});
  const droid=createDroid({detail:'obs'}),rig=createDroidServiceRig({droid},{cargo:[]});
  try{
    assert.ok(routine.request('feed'));
    for(let i=0;i<300&&!routine.pose.walking;i++)routine.update(.05);
    assert.ok(routine.pose.walking);
    const position={...routine.position},age=routine.age;
    blocked=true;routine.update(.1);rig.update(routine);
    assert.deepEqual(routine.position,position);assert.equal(routine.age,age);
    assert.equal(routine.pose.waiting,true);assert.equal(droid.face.expression,'sad');
    cat.mouseChase.mouse.visible=true;rig.update(routine);
    assert.notEqual(cat.mouseChase.mouse.floor,routine.pose.floor);
    assert.equal(droid.face.expression,'surprised','react before the cat begins chasing, including another deck');
    cat.mouseChase.mouse.visible=false;rig.update(routine);assert.equal(droid.face.expression,'sad');
    blocked=false;routine.update(.1);rig.update(routine);
    assert.equal(routine.pose.waiting,false);assert.equal(droid.face.expression,'neutral');
    routine.returning=true;blocked=true;routine.update(.1);rig.update(routine);
    assert.equal(droid.face.expression,'sad','being blocked also overrides the sleepy return face');
    assert.equal(droidServiceExpression({mode:'work',action:'food-pour'}),'happy');
    assert.equal(droidServiceExpression({mode:'work',action:'food-pour',mouseVisible:true}),'surprised');
    assert.equal(droidServiceExpression({mode:'charging',mouseVisible:true,waiting:true}),'sleepy');
  }finally{
    droid.root.removeFromParent();droid.dispose();
    const geometries=new Set(),materials=new Set();rig.root.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material)materials.add(o.material);});
    geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());
  }
});

test('charging updates the battery even when the docked service pose is cached',()=>{
  const routine=new DroidRoutine({care:new Supplies(),brain:{plants:new PlantBed()}});
  routine.restUntil=Infinity;routine.battery=.25;
  const droid=createDroid({detail:'obs'}),rig=createDroidServiceRig({droid},{cargo:[]});
  try{
    rig.update(routine);assert.equal(droid.battery.level,1);
    routine.update(24);rig.update(routine);
    assert.equal(droid.battery.level,4);assert.equal(droid.face.expression,'sleepy');
    assert.equal(droid.root.getObjectByName('OBS droid / nixie expression image').visible,false);
    assert.equal(droid.battery.mesh.visible,true);
  }finally{
    droid.root.removeFromParent();droid.dispose();
    const geometries=new Set(),materials=new Set();rig.root.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material)materials.add(o.material);});
    geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());
  }
});
