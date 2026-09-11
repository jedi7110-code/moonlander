import test from 'node:test';
import assert from 'node:assert/strict';
import {CrewHealth} from '../src/obs/health.js';
import {healthDisplay} from '../src/obs/health-display.js';

test('the compact health label tracks symptoms and recovery in both languages',()=>{
  const health=new CrewHealth();
  assert.equal(healthDisplay(health).label,'健康');assert.equal(healthDisplay(health).detail,'異常は見られない');
  health.startCondition('fever');assert.equal(healthDisplay(health).label,'発熱');assert.equal(healthDisplay(health,{lang:'en'}).label,'Fever');
  assert.equal(healthDisplay(health).title,'発熱 / 要手当て');
  health.value=54;assert.equal(healthDisplay(health).stage,'urgent');
  health.value=29;assert.equal(healthDisplay(health).stage,'critical');
  health.beginTreatment();health.treatment.elapsed=2.1;
  assert.equal(healthDisplay(health).label,'治療');assert.equal(healthDisplay(health,{lang:'en'}).label,'Care');
  assert.equal(healthDisplay(health).detail,'処置完了まで 34秒');
  health.treatment=null;health.condition=null;health.value=84;
  assert.equal(healthDisplay(health).label,'回復');assert.equal(healthDisplay(health,{lang:'en'}).label,'Recovery');
  health.value=100;assert.equal(healthDisplay(health).label,'健康');
  health.startCondition('injury');assert.equal(healthDisplay(health).label,'怪我');assert.equal(healthDisplay(health,{lang:'en'}).title,'Left arm injury / Needs treatment');
});

test('the detail action distinguishes travelling, examination and treatment',()=>{
  const health=new CrewHealth();
  assert.equal(healthDisplay(health,{medical:true}).treatmentLabel,'移動中');
  assert.equal(healthDisplay(health,{medical:true,exam:true}).treatmentLabel,'健診中');
  assert.equal(healthDisplay(health,{medical:true,exam:true}).detail,'健康状態を測定中');
  health.startCondition('fever');health.beginTreatment();health.treatment.elapsed=100;
  assert.equal(healthDisplay(health,{medical:true}).treatmentLabel,'治療中');
  assert.equal(healthDisplay(health).detail,'処置完了まで 0秒');
});
