import test from 'node:test';
import assert from 'node:assert/strict';
import {MeshStandardMaterial} from 'three';
import {BATHROOM_LIGHT_FADE,createBathroomCeilingLight,updateBathroomCeilingLight} from '../src/obs/bathroom-lighting.js';
import {BathroomVisit} from '../src/obs/bathroom.js';

const fixture=type=>createBathroomCeilingLight({dark:new MeshStandardMaterial()},0,0,type);
const occupied={inside:true,opening:0,phase:'use'};
function advance(light,pose,seconds,fps=60){
  for(let i=0;i<Math.round(seconds*fps);i++)updateBathroomCeilingLight(light,pose,1/fps);
}
for(const type of ['toilet','shower'])test(`${type}: ceiling and room bounce softly fade in and out with exact endpoints`,()=>{
  const light=fixture(type),samples=[];
  updateBathroomCeilingLight(light,occupied,0);assert.equal(light.power.value,0);
  for(let frame=0;frame<48;frame++){
    updateBathroomCeilingLight(light,occupied,1/60);samples.push(light.power.value);
    assert.ok(Math.abs(light.diffuser.color.r-(.009+.991*light.power.value))<1e-12);
    assert.ok(Math.abs(light.diffuser.color.g-(.012+.878*light.power.value))<1e-12);
    assert.ok(Math.abs(light.diffuser.color.b-(.011+.689*light.power.value))<1e-12);
  }
  assert.ok(samples[0]>0&&samples[0]<.005,'ease gently away from darkness');
  assert.ok(Math.abs(samples[23]-.5)<1e-9);assert.equal(samples.at(-1),1);
  for(let i=1;i<samples.length;i++)assert.ok(samples[i]>=samples[i-1]&&samples[i]-samples[i-1]<.04);
  updateBathroomCeilingLight(light,null,1/60);assert.ok(light.power.value>.999&&light.power.value<1);
  advance(light,null,BATHROOM_LIGHT_FADE.off-1/60);assert.equal(light.power.value,0);
  assert.equal(light.root.userData.bathroomLighting.power,light.power,'no shader material rebuild during fade');
});
test('fade timing is frame-rate independent and survives pause, reversal and independent rooms',()=>{
  const a=fixture('toilet'),b=fixture('shower');
  advance(a,occupied,.4,30);advance(b,occupied,.4,120);
  assert.ok(Math.abs(a.power.value-b.power.value)<1e-12);
  const value=a.power.value,otherValue=b.power.value;updateBathroomCeilingLight(a,null,0);assert.equal(a.power.value,value,'paused state remains unchanged');
  updateBathroomCeilingLight(a,null,.1);assert.ok(a.power.value<value&&a.power.value>0);
  const dimmed=a.power.value;updateBathroomCeilingLight(a,occupied,0);assert.equal(a.power.value,dimmed,'reversing does not restart at black or full');
  updateBathroomCeilingLight(a,occupied,1/60);assert.ok(a.power.value>dimmed&&a.power.value-dimmed<.04);
  assert.equal(b.power.value,otherValue,'other room is unaffected');
  advance(a,occupied,1);assert.equal(a.power.value,1);advance(a,null,2);assert.equal(a.power.value,0);
});
test('entry, occupied use, exit and droid cleaning keep their previous switch conditions',()=>{
  const light=fixture('toilet');
  for(const phase of ['reach','open','shut']){
    updateBathroomCeilingLight(light,{opening:.999,inside:false,phase},.1);assert.equal(light.targetPower,0);
  }
  updateBathroomCeilingLight(light,{opening:1,phase:'open'},.1);assert.equal(light.targetPower,0,'rounded door easing alone does not switch early');
  updateBathroomCeilingLight(light,{opening:1,phase:'enter'},.1);assert.equal(light.targetPower,1);
  updateBathroomCeilingLight(light,occupied,.8);assert.equal(light.power.value,1);
  updateBathroomCeilingLight(light,{opening:1,phase:'leave'},.1);assert.equal(light.power.value,1);
  updateBathroomCeilingLight(light,{opening:.99,phase:'shut'},.1);assert.ok(light.power.value<1&&light.power.value>0);
  updateBathroomCeilingLight(light,{opening:1,inside:false},.1);assert.equal(light.targetPower,1,'droid cleaning retains lighting');
});
test('a complete visit fades naturally after the actor leaves, even once the pose is removed',()=>{
  const light=fixture('shower'),visit=new BathroomVisit('shower');let using=0,last=0,sawRise=false,sawFall=false;
  for(let i=0;i<1800;i++){
    visit.update(1/120);if(visit.phase==='use'&&(using+=1/120)>1)visit.requestExit();
    updateBathroomCeilingLight(light,visit.done?null:visit.pose,1/120);
    const value=light.power.value;sawRise||=value>0&&value<1&&value>last;sawFall||=value>0&&value<1&&value<last;
    assert.ok(Math.abs(value-last)<.02,'no sudden room-light switch');last=value;
  }
  assert.ok(visit.done&&sawRise&&sawFall);assert.equal(light.power.value,0);
});
