import test from 'node:test';
import assert from 'node:assert/strict';
import {Vector3} from 'three';
import {CabinEnvironment,EVA_PRESSURE} from '../src/obs/environment.js';
import {createEVALeak,evaLeakPoint,EVA_LEAK} from '../src/obs/eva-leak.js';
import {AirlockPassage} from '../src/obs/airlock.js';
import {CrewMotion,Supplies} from '../src/obs/state.js';
import {CabinBrain} from '../src/obs/brain.js';
import {EVA_PASSAGE,getStation,CABIN_AISLE} from '../src/obs/layout.js';
import {HatchRepairVisit,HATCH_REPAIR_PHASES,OUTER_HATCH_REPAIR_PHASES} from '../src/obs/hatch-repair.js';

function effect(){const value=createEVALeak(6.784);return value;}
function dispose(effect){effect.root.geometry.dispose();effect.root.material.dispose();}

test('the small isolated leak stays active and loses pressure gradually until the actual repair',()=>{
  const environment=new CabinEnvironment();environment.triggerFault();
  assert.equal(environment.fault.id,'airlock');assert.equal(environment.fault.serviceStation,'airlock');
  environment.update(60);
  const difference=environment.pressure-environment.bayPressure;
  assert.ok(difference>.1&&difference<.2,'a small leak permits a short unsuited maintenance visit');
  assert.ok(environment.leakFlow>0);assert.equal(environment.fault.sealed,false);
  environment.innerDoorOpening=1;environment.update(1);
  assert.ok(environment.leakFlow>0,'outer seal continues leaking while the inner hatch is open');
  environment.setStage(environment.fault.serial,'verify');assert.equal(environment.leakFlow,0);
  assert.equal(environment.readyToVerify,true);
  assert.equal(environment.resolve(environment.fault.serial),true);
});

test('large pressure differences hold the door closed until the passive valve has equalized it',()=>{
  const environment=new CabinEnvironment({random:()=>0});
  environment.update(300,{bayOccupied:true});assert.equal(environment.fault,null);
  environment.update(1,{bayOccupied:false});assert.ok(environment.fault);
  environment.bayPressure=95;
  const actor=new CrewMotion({floor:EVA_PASSAGE.floor,x:EVA_PASSAGE.x-25}),door=new AirlockPassage();
  actor.goTo({floor:EVA_PASSAGE.floor,x:EVA_PASSAGE.x+80});let waited=false,opened=false;
  for(let i=0;i<360;i++){
    door.update(1/60,actor,environment);
    if(door.opening>0){opened=true;assert.ok(Math.abs(environment.pressure-environment.bayPressure)<=EVA_PRESSURE.safeDifference);}
    waited||=actor.waitingForHatch;
    if(!actor.waitingForHatch)actor.update(1/60);
    environment.update(1/60);
  }
  assert.equal(waited,true);assert.equal(opened,true);assert.ok(actor.x>EVA_PASSAGE.x);
  assert.ok(environment.leakFlow>0,'equalization never repairs or switches off the leak');
});

test('suit-room maintenance requests target the outer hatch while the inner door enforces safe entry',()=>{
  const actor=new CrewMotion({floor:EVA_PASSAGE.floor,x:990});
  const brain=new CabinBrain({time:{delayedCall(){}},obsUI:{hideWant(){}}},actor,{care:new Supplies(),random:()=>.5});
  brain.environment.triggerFault();brain._go(getStation('eva'));
  assert.equal(brain.cur.id,'airlock');brain._go(getStation('airlock'));assert.equal(brain.cur.id,'airlock');
});

test('elapsed time and the former 15 second cutoff never seal or refill the room',()=>{
  const environment=new CabinEnvironment();environment.triggerFault();const serial=environment.fault.serial;
  for(const seconds of [14,1,10,30,300]){
    environment.update(seconds);
    assert.ok(environment.leakFlow>0);assert.equal(environment.fault.sealed,false);
    assert.equal(environment.fault.serial,serial);
  }
  const difference=environment.pressure-environment.bayPressure;
  environment.setStage(serial,'verify');environment.update(30);
  assert.ok(Math.abs((environment.pressure-environment.bayPressure)-difference)<1e-8,'repair stops loss without adding air');
});

test('hatch equalization shares existing gas without an external supply',()=>{
  const environment=new CabinEnvironment(),reference=new CabinEnvironment();
  for(const env of [environment,reference]){env.bayPressure=90;env.triggerFault();env.setStage(env.fault.serial,'verify');}
  environment.equalizationRequested=true;
  environment.update(.5);reference.update(.5);
  const gas=env=>env.pressure*EVA_PRESSURE.cabinVolume+env.bayPressure*EVA_PRESSURE.bayVolume;
  assert.ok(Math.abs(gas(environment)-gas(reference))<1e-8);
  assert.ok(environment.pressure<reference.pressure);assert.ok(environment.bayPressure>reference.bayPressure);
});

test('verification holds at its final pose until pressure is equal, without replaying the tool stroke',()=>{
  const visit=new HatchRepairVisit(1);
  const throughVerify=Object.entries(HATCH_REPAIR_PHASES).slice(0,6).reduce((n,[,t])=>n+t,0);
  visit.update(throughVerify+10,{canVerify:false});assert.equal(visit.phase,'verify');assert.equal(visit.repaired,false);
  const pose=visit.pose;visit.update(10,{canVerify:false});assert.deepEqual(visit.pose,pose);
  visit.update(.01,{canVerify:true});assert.equal(visit.repaired,true);assert.equal(visit.phase,'release');
});

test('tracers stay inside the EVA room and travel toward the outer seal, never through the inner door',()=>{
  const outlet=new Vector3(...Object.values(EVA_LEAK.outlet));
  for(let i=0;i<EVA_LEAK.count;i++){
    let previous=evaLeakPoint(i,0);
    for(let n=1;n<=100;n++){
      const point=evaLeakPoint(i,n/100);
      assert.ok(point.x>previous.x);assert.ok(point.x>=EVA_LEAK.left&&point.x<=outlet.x);
      assert.ok(point.y>=.35&&point.y<=2.65);assert.ok(point.z>=EVA_LEAK.back&&point.z<=EVA_LEAK.front);
      assert.ok(point.distanceTo(outlet)<previous.distanceTo(outlet));previous=point;
    }
    assert.ok(previous.distanceTo(outlet)<1e-8);
  }
});

test('one reusable tracer draw freezes with the environment, stops when sealed and adds no lights',t=>{
  const fx=effect();t.after(()=>dispose(fx));const environment=new CabinEnvironment();
  fx.update(environment);assert.equal(fx.root.visible,false);assert.equal(fx.root.children.length,0);
  environment.triggerFault();environment.update(.2);fx.update(environment);
  assert.equal(fx.root.visible,true);assert.equal(fx.root.material.depthTest,true);assert.equal(fx.root.material.depthWrite,false);
  assert.equal(fx.root.geometry.attributes.position.count,EVA_LEAK.count*EVA_LEAK.segments*2);
  const geometry=fx.root.geometry,positions=geometry.attributes.position.array,copy=positions.slice();
  assert.equal(fx.update(environment),false);assert.deepEqual(positions,copy,'paused clock never moves a streak');
  environment.update(.1);fx.update(environment);assert.notDeepEqual(positions,copy);assert.equal(fx.root.geometry,geometry);
  environment.setStage(environment.fault.serial,'verify');environment.update(1);fx.update(environment);assert.equal(fx.root.visible,false);
});


test('outer-hatch arrival stays facing the door without turn, sidestep or extra footfalls',()=>{
  const duration=Object.values(OUTER_HATCH_REPAIR_PHASES).reduce((n,t)=>n+t,0);
  for(const cancelledAt of [Infinity,1,8,16]){
    const visit=new HatchRepairVisit(1,{hatch:'outer'});assert.equal(visit.phase,'inspect');
    visit.startYaw=Math.PI/2;
    for(let t=0;t<duration+1;t+=1/60){
      if(t>=cancelledAt)visit.requestExit();
      const pose=visit.pose;
      assert.equal(pose.depth,CABIN_AISLE.crewZ);assert.equal(pose.yaw,Math.PI/2);
      assert.equal(pose.turn,null);assert.equal(pose.moving,false);assert.equal(pose.walkDistance,0);
      visit.update(1/60);
    }
    assert.equal(visit.done,true);
  }
});
