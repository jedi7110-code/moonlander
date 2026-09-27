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
