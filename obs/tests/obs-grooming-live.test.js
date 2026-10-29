import test from 'node:test';
import assert from 'node:assert/strict';
import {Group,MeshBasicMaterial,Raycaster,Vector3} from 'three';
import {CabinBrain} from '../src/obs/brain.js';
import {CrewMotion,Supplies,getStation,FLOORS} from '../src/obs/state.js';
import {HairGrowthClock,GroomingVisit,GROOMING_VISIT_SECONDS} from '../src/obs/grooming-visit.js';
import {DroidRoutine} from '../src/obs/droid-routine.js';
import {groomingGateBounds,createStationInteraction,REAR_ROOM_GATES,positionX,positionY} from '../src/obs/ship.js';
import {ObservationView} from '../src/obs/view.js';

function setup(){
  const station=getStation('grooming'),actor=new CrewMotion({floor:station.floor,x:station.x}),care=new Supplies();
  const brain=new CabinBrain({time:{delayedCall(){}},obsUI:{hideWant(){}}},actor,{care,random:()=>.9});
  brain.wantCoolT=10000;brain.health.nextIncident=1e6;
  return{brain,actor,care};
}
function advance(brain,actor,seconds){for(let i=0;i<Math.ceil(seconds*60);i++){actor.update(1/60);brain.update(1/60);}}

test('hair and beard reach maximum at 15 running minutes and grooming becomes due at 20 minutes',()=>{
  const clock=new HairGrowthClock();
  clock.update(7.5*60);assert.equal(clock.progress,.5);
  clock.update(0);clock.update(-1);clock.update(NaN);clock.update(Infinity);clock.update(200,true);assert.equal(clock.age,7.5*60);
  clock.update(7.5*60-.01);assert.ok(clock.progress<1);assert.equal(clock.due,false);
  clock.update(.01);assert.equal(clock.progress,1);assert.equal(clock.due,false);
  clock.update(5*60-.01);assert.equal(clock.progress,1);assert.equal(clock.due,false);
  clock.update(.01);assert.equal(clock.progress,1);assert.equal(clock.due,true);
  clock.update(60);assert.equal(clock.progress,1);assert.equal(clock.due,true);
  clock.reset();assert.equal(clock.progress,0);assert.equal(clock.due,false);
  clock.update(15*60);assert.equal(clock.progress,1);assert.equal(clock.due,false);
});

test('a manual cut starts at the current length and never grows hair while cutting or shaving',()=>{
  const visit=new GroomingVisit(.26);let hair=.26,beard=.26;
  for(let frame=0;frame<=GROOMING_VISIT_SECONDS*60;frame++){
    const pose=visit.pose;
    assert.ok(pose.hair<=hair+1e-12&&pose.beard<=beard+1e-12);
    hair=pose.hair;beard=pose.beard;visit.update(1/60);
  }
  assert.ok(visit.done);assert.equal(hair,0);assert.equal(beard,0);
});

test('the visit returns to the exact aisle position and facing without jumping at either end',()=>{
  const visit=new GroomingVisit(.8);visit.startYaw=-Math.PI/2;
  const origin=new Vector3(REAR_ROOM_GATES[1].x,REAR_ROOM_GATES[1].floor,0);
  const station=getStation('grooming');
  assert.ok(Math.abs(origin.x-positionX(station.x))<1e-10);assert.equal(origin.y,positionY(FLOORS[station.floor].y));
  let last=visit.pose;
  assert.deepEqual([last.x,last.floor,last.z,last.yaw].map(n=>n+0),[0,0,.78,-Math.PI/2]);
  for(let i=0;i<GROOMING_VISIT_SECONDS*120+1;i++){
    visit.update(1/120);const p=visit.pose;
    assert.ok(Math.hypot(p.x-last.x,p.floor-last.floor,p.z-last.z)<.015);
    assert.ok(Math.abs(p.yaw-last.yaw)<.03,'the unwrapped heading remains continuous');
    if(p.z<=-1.62)assert.ok(Math.abs(p.floor-.11)<1e-10,'clear the raised floor at the threshold');
    last=p;
  }
  assert.deepEqual([last.x,last.floor,last.z].map(n=>n+0),[0,0,.78]);
  assert.ok(Math.abs(Math.sin(last.yaw-visit.startYaw))<1e-10);
});

test('gate orders reach the washbasin, pause safely, ignore repeated clicks and finish before following another order',()=>{
  const {brain,actor}=setup();brain.hairGrowth.update(900);
  assert.equal(brain.requestGrooming(),true);actor.update(.1);
  assert.equal(brain.state,'grooming');assert.equal(brain.actStation,'grooming');
  const visit=brain.grooming,age=brain.hairGrowth.age;
  advance(brain,actor,10);const t=visit.age;brain.update(0);assert.equal(visit.age,t);
  brain.requestGrooming();assert.equal(brain.grooming,visit);
  brain._go(getStation('hydro'));assert.equal(actor.busy,false);assert.equal(brain.grooming,visit);
  assert.equal(brain.hairGrowth.age,age,'growth is suspended during the cut');
  advance(brain,actor,GROOMING_VISIT_SECONDS-10);
  assert.equal(brain.grooming,null);assert.equal(brain.hairGrowth.age,0);
  assert.equal(brain.actStation,'hydro');assert.equal(brain.state,'goingTo');
  brain.update(1);assert.ok(brain.hairGrowth.progress>0);
  brain.state='playingGame';const before=brain.hairGrowth.age;brain.update(20);assert.equal(brain.hairGrowth.age,before);
});

test('the automatic appointment is due at 20 minutes and resets only after returning from the room',()=>{
  const {brain,actor}=setup();brain.plants.rows.forEach(row=>row.growth=.05);brain.hairGrowth.update(20*60-.01);
  brain._choose();assert.notEqual(brain.actStation,'grooming');
  brain.hairGrowth.update(.01);
  brain._choose();assert.equal(brain.actStation,'grooming');actor.update(.1);
  assert.equal(brain.grooming.initialGrowth,1);assert.ok(brain.hairGrowth.due);
  advance(brain,actor,GROOMING_VISIT_SECONDS);assert.equal(brain.hairGrowth.progress,0);assert.equal(brain.grooming,null);
});

test('laundry and grooming share the rear room and a queued haircut survives idle decisions',()=>{
  const {brain,actor,care}=setup();actor.x=1000;
  const droid=new DroidRoutine({brain,actor,care,cat:{mode:'sleep'}});brain.droidRoutine=droid;
  assert.ok(droid.request('laundry'));assert.ok(brain.requestGrooming());assert.ok(brain.groomingQueued);
  brain._maybeWant();brain._choose();assert.ok(brain.groomingQueued);assert.equal(actor.busy,false);
  for(let i=0;i<10000&&!droid.returning;i++)droid.update(.05);
  assert.ok(droid.returning);assert.equal(brain.groomingQueued,false);assert.equal(brain.actStation,'grooming');
  assert.ok(droid.position.z>0,'the droid clears the doorway before Milo enters');
  assert.equal(droid.available('laundry'),false);
});

test('a newer command cancels a pending haircut instead of interrupting it later',()=>{
  const {brain,actor,care}=setup();actor.x=1000;
  const droid=new DroidRoutine({brain,actor,care,cat:{mode:'sleep'}});brain.droidRoutine=droid;
  droid.request('laundry');brain.requestGrooming();brain._go(getStation('hydro'));
  assert.equal(brain.groomingQueued,false);assert.equal(droid.crewRequest,null);
  assert.equal(brain.actStation,'hydro');
});

test('urgent medical care takes precedence over a haircut even while the droid is using the room',()=>{
  const {brain,actor,care}=setup();actor.x=1000;
  const droid=new DroidRoutine({brain,actor,care,cat:{mode:'sleep'}});brain.droidRoutine=droid;droid.request('laundry');
  brain.health.startCondition('fever');brain.health.value=20;
  assert.equal(brain.requestGrooming(),false);assert.equal(brain.actStation,'medical');
  assert.equal(brain.grooming,null);assert.equal(droid.crewRequest,null);
});

test('the second-floor octagonal gate is pickable from a desktop or controller ray, without capturing other decks',()=>{
  const bounds=groomingGateBounds(),material=new MeshBasicMaterial({visible:false});
  const {mesh}=createStationInteraction('grooming',bounds,material);mesh.updateMatrixWorld(true);
  const view=Object.create(ObservationView.prototype);view.milo=new Group();view.cat=new Group();view.ship={targets:[mesh]};
  for(const [index,gate]of REAR_ROOM_GATES.entries()){
    const ray=new Raycaster(new Vector3(gate.x,gate.floor+1.3,4),new Vector3(0,0,-1));
    assert.equal(view.targetFromRay(ray)?.id,index===1?'grooming':undefined);
  }
  mesh.geometry.dispose();material.dispose();
});
