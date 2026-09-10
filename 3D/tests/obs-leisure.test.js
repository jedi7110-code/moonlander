import test from 'node:test';
import assert from 'node:assert/strict';
import {MeshStandardMaterial} from 'three';
import {CabinBrain} from '../src/obs/brain.js';
import {CrewMotion,Supplies,CatRoutine,getStation} from '../src/obs/state.js';
import {createMilo,animateMilo,createCat,animateCat} from '../src/obs/characters.js';

function setup(random=()=>0){
  const care=new Supplies(),actor=new CrewMotion({floor:0,x:1060});let opened=0;
  const brain=new CabinBrain({obsUI:{hideWant(){},openGame(){opened++;}}},actor,{care,random});
  brain.health.nextIncident=Infinity;
  return{care,actor,brain,opened:()=>opened};
}
test('first lounge click rests, en-route clicks do not queue chess, seated click opens without walking again',()=>{
  const {brain,actor,opened}=setup();
  assert.equal(brain.clickLounge(),'relax');assert.equal(brain.gamePending,false);
  assert.equal(brain.clickLounge(),'moving');assert.equal(opened(),0);
  for(let i=0;i<120;i++)actor.update(1/60);
  assert.ok(brain.isSeatedInLounge());assert.equal(brain.leisure,'tablet');assert.equal(opened(),0);
  const version=actor.commandVersion;
  assert.equal(brain.clickLounge(),'chess');assert.equal(opened(),1);assert.equal(actor.commandVersion,version);
  assert.equal(brain.clickLounge(),'pending');assert.equal(opened(),1);
});
test('random lounge activities vary between visits and never launch a game on their own',()=>{
  const {brain,opened}=setup(()=>.99);brain.catRoutine={canPlayLounge:()=>true,inviteLounge(){}};
  const modes=[];
  for(let i=0;i<5;i++){brain._startPerform(getStation('lounge'));modes.push(brain.leisure);assert.ok(brain.curDurSec>=32);brain._endPerform();}
  assert.equal(modes[0],'cat');assert.ok(modes.includes('music'));assert.ok(modes.every((m,i)=>!i||m!==modes[i-1]));assert.equal(opened(),0);
  brain.catRoutine.canPlayLounge=()=>false;brain._startPerform(getStation('lounge'));assert.notEqual(brain.leisure,'cat');
});
test('cat joins using the existing sofa hop and stops playing when chess starts',()=>{
  const {brain,care,actor}=setup(()=>.99),cat=new CatRoutine(care,{random:()=>.5});brain.catRoutine=cat;
  cat.hunger=80;cat.energy=80;brain.actor.x=getStation('lounge').x;
  brain._startPerform(getStation('lounge'));assert.equal(brain.leisure,'cat');
  for(let i=0;i<1200&&cat.mode!=='play';i++)cat.update(1/60,actor);
  assert.equal(cat.mode,'play');assert.ok(cat.motion.onSofa);assert.equal(cat.motion.floor,0);
  brain.requestGame();cat.update(1/60,actor);assert.equal(cat.mode,'look');assert.equal(cat.playHost,null);
});
test('leisure props only appear in their mode and animations remain finite',()=>{
  const material=new MeshStandardMaterial(),m=new Proxy({},{get:()=>material}),root=createMilo(m),cat=createCat(m);
  for(const mode of ['tablet','music','cat']){
    for(let i=0;i<120;i++){
      animateMilo(root,{moving:false,climbing:false,facing:1,action:'lounge',time:i/15,actionTime:i/15,actionDuration:40,leisure:mode,catReady:true});
      animateCat(cat,{time:i/15,moving:false,facing:1,mode:'play',actionTime:i/15,remaining:10,walkDistance:0});
      for(const model of [root,cat]){model.updateMatrixWorld(true);model.traverse(node=>assert.ok(node.matrixWorld.elements.every(Number.isFinite)));}
    }
    assert.equal(root.userData.leisure.tablet.visible,mode==='tablet');assert.equal(root.userData.leisure.phones.visible,mode==='music');assert.equal(root.userData.leisure.toy.visible,mode==='cat');
  }
  animateMilo(root,{moving:true,climbing:false,facing:1,time:0,action:null});
  for(const key of ['tablet','phones','toy'])assert.equal(root.userData.leisure[key].visible,false);
});
