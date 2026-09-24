import test from 'node:test';
import assert from 'node:assert/strict';
import {Box3,BoxGeometry,Group,Mesh,MeshStandardMaterial,Vector3} from 'three';
import {WASTE_INCINERATOR as WASTE,CABIN_AISLE} from '../src/obs/layout.js';
import {createWasteIncinerator} from '../src/obs/waste-incinerator.js';
import {DroidRoutine} from '../src/obs/droid-routine.js';
import {createDroid} from '../src/obs/droid-model.js';
import {createDroidServiceRig} from '../src/obs/droid-service.js';
import {Supplies} from '../src/obs/state.js';
import {PlantBed} from '../src/obs/plant-state.js';

function setup(job){
  const care=new Supplies(),brain={plants:new PlantBed(),actStation:null};
  if(job==='cargo')care.lastDelivery=1;
  const routine=new DroidRoutine({care,brain,actor:{x:1040},cat:{mode:'sleep'}});
  assert.ok(routine.request(job));return {care,routine};
}
function dispose(root){
  const geometries=new Set(),materials=new Set();
  root.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material)materials.add(o.material);});
  geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());
}

test('sealed waste unit fits left of the galley below its existing wall equipment',()=>{
  const metal=new MeshStandardMaterial(),unit=createWasteIncinerator({metal,dark:metal});
  try{
    for(const opening of [0,.25,.6,1]){
      unit.update(opening,false);unit.root.updateMatrixWorld(true);
      const bounds=new Box3().setFromObject(unit.root);
      assert.ok(bounds.min.x>-12.87&&bounds.max.x<-11.555,'clear of the hull and galley cabinets');
      assert.ok(bounds.min.y>=-.001&&bounds.max.y<1.05,'floor mounted below the wall equipment');
      assert.ok(bounds.max.z<CABIN_AISLE.crewZ,'door clears the main traffic lane');
    }
    let lights=0;unit.root.traverse(o=>{if(o.isLight)lights++;});assert.equal(lights,0);
    unit.update(0,true);assert.equal(unit.indicator.color.getHex(),0xe18c37);
    unit.update(0,false);assert.equal(unit.indicator.color.getHex(),0x6e8c65);
  }finally{dispose(unit.root);metal.dispose();}
});

test('empty cartons, food wrappers and kitchen scraps are carried, deposited once and burned after closing',()=>{
  for(const [job,expected,kind]of [['cargo',3,'carton'],['feed',1,'wrapper'],['cook',1,'scraps']]){
    const {care,routine}=setup(job),inventory={...care.supplies};
    let seenCarry=0,seenDeposit=0,seenBurn=0,previousCount=0;
    for(let i=0;i<20000&&!routine.docked;i++){
      routine.update(.05);const p=routine.pose;
      if(p.carrying==='waste'&&p.walking){seenCarry++;assert.equal(p.wasteKind,kind);}
      if(routine.disposedWaste>previousCount){
        assert.equal(routine.disposedWaste,previousCount+1);previousCount++;
        assert.equal(p.action,'waste-insert');assert.ok(p.age>=WASTE.depositAt);
        assert.equal(routine.incineratorOpen,1);assert.equal(routine.binWaste,kind);
        assert.equal(p.carrying,null);assert.equal(p.floor,WASTE.floor);
        assert.ok(Math.abs(p.x-WASTE.x)<1e-8&&Math.abs(p.z-WASTE.approachZ)<1e-8);
        seenDeposit++;
      }
      if(p.action==='waste-burn'){
        assert.equal(routine.incineratorOpen,0);assert.equal(routine.binWaste,kind);seenBurn++;
      }
      if(job==='feed'&&p.carrying==='waste'){
        assert.equal(care.catBowl,1);assert.equal(care.catBowlFilling,false,'Lucy need not wait for trash disposal');
      }
      if(p.action==='waste-insert'&&p.age>1){
        const before=[routine.time,routine.age,routine.disposedWaste,routine.incineratorOpen];routine.update(0);
        assert.deepEqual([routine.time,routine.age,routine.disposedWaste,routine.incineratorOpen],before);
      }
    }
    assert.ok(routine.docked&&seenCarry>20&&seenBurn>20);assert.equal(seenDeposit,expected);
    assert.equal(routine.disposedWaste,expected);assert.equal(routine.binWaste,null);assert.equal(routine.incineratorOpen,0);
    assert.deepEqual(care.supplies,job==='feed'?{...inventory,catfood:inventory.catfood-1}:inventory,'discarding packaging never consumes the contents');
    if(job==='cargo')assert.deepEqual(routine.stored,[0,1,2]);
    if(job==='cook')assert.equal(care.preparedMeals,1);
  }
});

test('visible refuse follows both palms, enters the chamber before the door closes, then disappears after burning',()=>{
  const droid=createDroid({detail:'obs'}),metal=new MeshStandardMaterial();
  const cargo=[.61,.53,.61].map(width=>{
    const g=new Group(),mesh=new Mesh(new BoxGeometry(width,.54,.43),metal);mesh.position.y=.27;g.add(mesh);return g;
  });
  const incinerator=createWasteIncinerator({metal,dark:metal}),rig=createDroidServiceRig({droid,cable:new Group()},{cargo,incinerator});
  try{
    for(const job of ['cargo','feed','cook']){
      const {routine}=setup(job);let checked=0;
      for(let i=0;i<12000&&!routine.docked;i++){
        routine.update(.1);rig.update(routine);rig.root.updateMatrixWorld(true);
        const p=routine.pose,waste=rig.props.waste;
        if(p.carrying==='waste'){
          assert.equal(waste.visible,true);
          const variant=rig.wasteVariants[p.wasteKind],bounds=new Box3().setFromObject(variant);
          assert.ok(!bounds.isEmpty());
          for(const arm of droid.arms){
            const point=arm.palm.carryGrip.getWorldPosition(new Vector3());
            assert.ok(bounds.clone().expandByScalar(.003).containsPoint(point),'held waste does not float away from the hands');
          }
          checked++;
        }
        if(routine.binWaste&&routine.time-routine.wasteDroppedAt>.5){
          const bounds=new Box3().setFromObject(rig.wasteVariants[routine.binWaste]);
          assert.ok(bounds.min.x>WASTE.x-.32&&bounds.max.x<WASTE.x+.32);
          assert.ok(bounds.min.y>.21&&bounds.max.y<.86,'waste rests within the chamber');
          assert.ok(bounds.min.z>WASTE.z-.40&&bounds.max.z<WASTE.z+.40,'waste clears the closing door');
          assert.equal(waste.visible,true);
        }
      }
      assert.ok(routine.docked&&checked>20);assert.equal(rig.props.waste.visible,false);
    }
  }finally{droid.dispose();dispose(rig.root);dispose(incinerator.root);metal.dispose();}
});
