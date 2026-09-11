import test from 'node:test';
import assert from 'node:assert/strict';
import {MeshStandardMaterial,Vector3} from 'three';
import {CabinBrain} from '../src/obs/brain.js';
import {CrewMotion,Supplies,getStation,currentAction} from '../src/obs/state.js';
import {createMilo,animateMilo} from '../src/obs/characters.js';
import {LOUNGE_EXIT_SECONDS,loungeExitPose} from '../src/obs/lounge-exit.js';

function setup(){
  const actor=new CrewMotion({floor:0,x:1080}),brain=new CabinBrain({obsUI:{hideWant(){}}},actor,{care:new Supplies(),random:()=>.8});
  brain.health.nextIncident=Infinity;brain._startPerform(getStation('lounge'));brain.update(2.4);return{actor,brain};
}
test('a lounge departure waits for standing, keeps the latest destination, and freezes on pause',()=>{
  const {actor,brain}=setup(),version=actor.commandVersion;
  brain._go(getStation('hydro'));assert.equal(brain.state,'leavingLounge');assert.equal(currentAction(brain),'lounge');assert.equal(actor.commandVersion,version);
  brain.update(.7);const age=brain.loungeExit.age;brain._go(getStation('galley'));brain.update(0);assert.equal(brain.loungeExit.age,age);
  brain.update(1);assert.equal(actor.busy,false);assert.equal(actor.x,1080);
  brain.update(LOUNGE_EXIT_SECONDS);assert.equal(brain.loungeExit,null);assert.equal(brain.actStation,'galley');assert.ok(actor.busy);
});
test('natural completion rises before returning to idle, without granting more recovery',()=>{
  const {actor,brain}=setup();brain._endPerform();brain.needs.fun=70;
  brain.update(1);assert.equal(brain.state,'leavingLounge');assert.ok(brain.needs.fun<70);assert.equal(actor.busy,false);
  brain.update(2);assert.equal(brain.state,'idle');assert.equal(brain.loungeExit,null);
});
test('standing pose rises continuously and keeps boots above the floor',()=>{
  const material=new MeshStandardMaterial(),root=createMilo(new Proxy({},{get:()=>material}));let previous=null;
  for(let i=0;i<=168;i++){
    const age=i/60;root.position.z=loungeExitPose(age).depth;
    animateMilo(root,{action:'lounge',moving:false,climbing:false,facing:1,time:5,actionTime:5,actionDuration:32,leisure:'tablet',loungeExit:{age}});
    root.updateMatrixWorld(true);
    const hip=root.userData.hips.getWorldPosition(new Vector3());
    if(previous)assert.ok(hip.distanceTo(previous)<.025);previous=hip;
    for(const {boot}of root.userData.legs){const sole=boot.localToWorld(new Vector3(0,-.107,0));assert.ok(sole.y>-.006,`${age}: ${sole.y}`);assert.ok(sole.y<.07);}
  }
  assert.equal(Math.abs(root.userData.body.position.y),0);assert.equal(root.position.z,.78);assert.equal(root.userData.leisure.tablet.visible,false);
});
