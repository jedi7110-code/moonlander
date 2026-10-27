import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {CURTIS_COFFEE,curtisCoffeePose} from '../src/obs/curtis-coffee.js';
import {CurtisRoutine} from '../src/obs/curtis-routine.js';

test('one coffee section gives extraction twenty seconds after the button, then drinks without changing section',()=>{
  const routine=new CurtisRoutine();routine.position={x:10.085,y:3.392,z:-.38};routine.coffee();
  const sections=routine.steps.filter(step=>step.kind!=='walk');
  assert.equal(sections.length,1);assert.equal(sections[0].kind,'coffee');
  assert.equal(CURTIS_COFFEE.pourEnd-CURTIS_COFFEE.button,20);
  assert.equal(sections[0].duration,35.6);assert.ok(CURTIS_COFFEE.drinkStart>CURTIS_COFFEE.pourEnd);
  assert.equal(curtisCoffeePose(CURTIS_COFFEE.button-.001).machineActive,false);
  assert.equal(curtisCoffeePose(CURTIS_COFFEE.button).machineTime,0);
  assert.equal(curtisCoffeePose(CURTIS_COFFEE.pourEnd-.001).machineActive,true);
  assert.equal(curtisCoffeePose(CURTIS_COFFEE.pourEnd).machineActive,false);
  for(const time of [CURTIS_COFFEE.drinkStart,30,CURTIS_COFFEE.duration]){
    assert.equal(curtisCoffeePose(time).machineActive,false);assert.equal(curtisCoffeePose(time).pouring,false);
  }
});
test('the coffee clock is deterministic and keeps a held cup at the drinking transition',()=>{
  const before=curtisCoffeePose(CURTIS_COFFEE.drinkStart-.0001),after=curtisCoffeePose(CURTIS_COFFEE.drinkStart+.0001);
  assert.equal(before.reach,1);assert.equal(before.transfer,1);assert.equal(before.fill,1);
  assert.equal(before.pouring,false);assert.equal(after.brewing,false);assert.equal(after.returning,0);
  assert.ok(Math.abs(before.drinkTime-after.drinkTime)<.001);
  for(const age of [0,3.6,7,12,18,23.6,24,30,35.6])assert.deepEqual(curtisCoffeePose(age),curtisCoffeePose(age));
});
test('the study has one combined coffee option and uses the production clock',async()=>{
  const html=await readFile(new URL('../src/curtis-study.html',import.meta.url),'utf8');
  assert.doesNotMatch(html,/value="brew"/);assert.equal((html.match(/value="coffee"/g)??[]).length,1);
  assert.match(html,/コーヒーを淹れて飲む/);
  const source=await readFile(new URL('../src/curtis-study.js',import.meta.url),'utf8');
  assert.match(source,/sounds\.curtisCoffee\(dt,routine\)/);
});
