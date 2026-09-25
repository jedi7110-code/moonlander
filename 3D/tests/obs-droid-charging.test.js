import test from 'node:test';
import assert from 'node:assert/strict';
import {Box3,Vector3,Quaternion,MathUtils} from 'three';
import {createDroid,DROID_SPEC} from '../src/obs/droid-model.js';
import {createDroidChargingBay,DROID_DOCK} from '../src/obs/droid-charging.js';
import {CABIN_AISLE,DECK} from '../src/obs/layout.js';
import {FLOOR_Y} from '../src/obs/ship.js';
import {DROID_STARTUP_SECONDS} from '../src/obs/droid-startup.js';
import {sampleDroidServicePose,createDroidServiceRig} from '../src/obs/droid-service.js';
import {DroidRoutine} from '../src/obs/droid-routine.js';
import {Supplies} from '../src/obs/state.js';
import {PlantBed} from '../src/obs/plant-state.js';

test('charging slumps from the neck with grounded feet, attached arms and no powered face',()=>{
  const droid=createDroid(),v=()=>new Vector3();
  try{
    droid.face.setExpression('happy');
    const pose=droid.update(0,'charging');
    assert.equal(pose.powered,false);
    assert.ok(droid.head.getWorldDirection(v()).y<-.6,'face hangs down');
    assert.ok(droid.chassis.position.y<.86,'hips settle into bent knees');
    for(const arm of droid.arms){
      const anchor=droid.chassis.localToWorld(new Vector3(arm.side*DROID_SPEC.shoulderHalfWidth,.47,0));
      assert.ok(anchor.distanceTo(arm.upper.getWorldPosition(v()))<1e-7,'arms follow the leaning shoulders');
      assert.ok(arm.upper.localToWorld(new Vector3(0,-DROID_SPEC.upperArm,0)).distanceTo(arm.lower.getWorldPosition(v()))<1e-7);
      assert.ok(arm.lower.localToWorld(new Vector3(0,-DROID_SPEC.forearm,0)).distanceTo(arm.palm.root.getWorldPosition(v()))<1e-7);
    }
    for(const leg of droid.legs){
      assert.ok(Math.abs(new Box3().setFromObject(leg.foot).min.y)<.003,'feet remain on the floor');
      for(const [part,length,next]of [[leg.upper,DROID_SPEC.upperLeg,leg.middle],[leg.middle,DROID_SPEC.middleLeg,leg.lower],[leg.lower,DROID_SPEC.lowerLeg,leg.foot]]){
        assert.ok(part.localToWorld(new Vector3(0,-length,0)).distanceTo(next.getWorldPosition(v()))<1e-7);
      }
    }
    const lamps=[];droid.root.traverse(o=>{if(o.isMesh&&/nixie cathode|nixie halo|tube illumination/.test(o.material.name))lamps.push(o);});
    assert.ok(lamps.length>0);assert.ok(lamps.every(o=>!o.visible));
    const before=[];droid.root.traverse(o=>before.push(...o.matrixWorld.elements));
    droid.update(480,'charging');
    const after=[];droid.root.traverse(o=>after.push(...o.matrixWorld.elements));
    assert.deepEqual(after,before,'resting pose does not look around or swing its arms over time');
    assert.equal(droid.update(0,'idle').powered,true);assert.ok(lamps.every(o=>o.visible));
    assert.equal(droid.face.expression,'happy','waking preserves the selected expression');
  }finally{droid.dispose();}
});

test('both faces strike twice, then warm up without adding render resources',()=>{
  for(const detail of ['study','obs']){
    const droid=createDroid({detail}),lamps=[],materials=new Map();
    droid.root.traverse(o=>{
      if(o.isMesh&&/nixie cathode|nixie halo|tube illumination/.test(o.material.name)){
        lamps.push(o);materials.set(o.material,o.material.color.clone());
      }
    });
    const resources=()=>{
      const ids=[];droid.root.traverse(o=>{
        assert.ok(!o.isLight,'startup adds no lights');
        ids.push(o.uuid,o.geometry?.uuid,o.material?.uuid,o.material?.map?.uuid);
      });return ids;
    };
    const before=resources();
    try{
      droid.face.setExpression('sad');
      const sample=age=>{
        const p=droid.update(age,'wake');
        assert.ok(lamps.every(o=>o.visible===p.powered));
        for(const [m,c]of materials)assert.ok(m.color.equals(c.clone().multiplyScalar(p.facePower)));
        return p.facePower;
      };
      assert.equal(sample(0),0);
      assert.ok(sample(.21)>.7,'first short flash');
      assert.equal(sample(.4),0,'dark between the two flashes');
      assert.equal(sample(.58),1,'second short flash');
      assert.equal(sample(.76),0,'dark before warming up');
      const ramp=[1,1.5,2,2.6,3.2].map(sample);
      assert.ok(ramp[0]>0&&ramp[0]<.05,'glow starts very faint');
      assert.ok(ramp.every((p,i)=>i===0||p>ramp[i-1]),'glow rises smoothly');
      assert.equal(ramp.at(-1),1);assert.equal(sample(20),1);
      const dim=sample(1.5);sample(.58);assert.equal(sample(1.5),dim,'scrubbing is deterministic');
      assert.equal(droid.face.expression,'sad','startup keeps the chosen expression');
      droid.update(400,'charging');assert.ok(lamps.every(o=>!o.visible));
      assert.equal(sample(0),0,'next startup begins dark again');
      assert.equal(droid.update(0,'idle').facePower,1);
      for(const [m,c]of materials)assert.ok(m.color.equals(c),'full brightness is restored exactly');
      assert.deepEqual(resources(),before,'no new meshes, materials or textures during startup');
    }finally{droid.dispose();}
  }
});

test('waking head moves continuously through power-on and into the working pose',()=>{
  for(const detail of ['study','obs']){
    const droid=createDroid({detail});
    try{
      for(const live of [false,true]){
        let previous=null;
        for(let frame=0;frame<=Math.ceil((DROID_STARTUP_SECONDS+.05)*60);frame++){
          const age=frame/60;
          if(live){
            const waking=age<DROID_STARTUP_SECONDS;
            const p={mode:waking?'wake':'idle',age:waking?age:age-DROID_STARTUP_SECONDS,duration:waking?DROID_STARTUP_SECONDS:1,rest:waking?1-MathUtils.smoothstep(age,0,DROID_STARTUP_SECONDS):0};
            droid.update(14+age,'service',sampleDroidServicePose(p));
          }else droid.update(age,'wake');
          const current={q:droid.head.getWorldQuaternion(new Quaternion()),position:droid.head.getWorldPosition(new Vector3())};
          if(previous){
            assert.ok(previous.q.angleTo(current.q)<MathUtils.degToRad(1),`${detail}, live=${live}, age=${age}: head must not snap`);
            assert.ok(previous.position.distanceTo(current.position)<.004,`${detail}, live=${live}, age=${age}: head must not jump forward when rest ends`);
          }
          previous=current;
        }
      }
    }finally{droid.dispose();}
  }
});

test('charging bay fits left of the console, inside the hull and behind both traffic lanes',()=>{
  const bay=createDroidChargingBay(FLOOR_Y[DROID_DOCK.floor]);
  try{
    const bounds=new Box3().setFromObject(bay.root);
    assert.equal(DROID_DOCK.floor,DECK.OPERATIONS);
    assert.ok(bounds.min.x>-12.85,'clear of the left hull wall');
    assert.ok(bounds.max.x<-11.05,'clear of the leftmost console');
    assert.ok(bounds.max.z<CABIN_AISLE.crewZ-.35,'clear of the crew and cat aisles');
    assert.ok(Math.abs(bounds.min.y-FLOOR_Y[DECK.OPERATIONS])<.003,'charging platform meets the deck');
    let lights=0;bay.root.traverse(o=>{if(o.isLight)lights++;});assert.equal(lights,0,'charging adds no light sources');
  }finally{
    bay.droid.dispose();
    const geometries=new Set(),materials=new Set();bay.dock.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material)materials.add(o.material);});
    geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());
  }
});

test('charging cable stays fixed on the stand through waking, work and return instead of disappearing',()=>{
  const bay=createDroidChargingBay(FLOOR_Y[DROID_DOCK.floor]);
  const rig=createDroidServiceRig(bay,{cargo:[]});
  const routine=new DroidRoutine({care:new Supplies(),brain:{plants:new PlantBed(),actStation:null},actor:{x:1040},cat:{mode:'sleep'}});
  const modes=new Set(),cable=bay.cable,mesh=cable.children[0];
  const geometry=mesh.geometry,material=mesh.material;
  bay.root.updateMatrixWorld(true);const bounds=new Box3().setFromObject(cable);
  try{
    assert.equal(cable.name,'Fixed charging stand cable');assert.equal(cable.parent,bay.root);
    assert.equal(bay.droid.root.getObjectByName('Droid charging connector'),undefined,'no loose connector remains on the moving droid');
    const path=geometry.parameters.path.points;
    assert.deepEqual(path[0].toArray(),[-.435,.74,-.555],'lower end stays attached to the power unit');
    assert.deepEqual(path.at(-1).toArray(),[-.255,1.035,-.25],'upper end terminates inside the fixed support pad');
    const check=()=>{
      rig.update(routine);modes.add(routine.pose.mode);
      assert.equal(cable.visible,true);assert.equal(mesh.visible,true);
      assert.equal(mesh.geometry,geometry);assert.equal(mesh.material,material);
      assert.ok(new Box3().setFromObject(cable).equals(bounds),'cable does not move or follow the departing droid');
    };
    check();assert.ok(routine.request('laundry'));
    for(let i=0;i<5000&&!routine.docked;i++){routine.update(.1);check();}
    assert.ok(routine.docked);check();
    for(const mode of ['charging','wake','walk','work','sleep'])assert.ok(modes.has(mode),mode);
    assert.ok(routine.request('feed'));routine.update(2);check();
  }finally{
    bay.droid.dispose();const geometries=new Set(),materials=new Set();
    for(const root of [bay.root,rig.root])root.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material)materials.add(o.material);});
    geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());
  }
});
