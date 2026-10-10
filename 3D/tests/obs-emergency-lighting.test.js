import test from 'node:test';
import assert from 'node:assert/strict';
import {Group,Mesh,BoxGeometry,MeshStandardMaterial,MeshBasicMaterial,ShaderLib,Vector3} from 'three';
import {CabinEmergencyLighting,emergencyLightPower,EMERGENCY_LIGHT_PERIOD,EMERGENCY_LIGHT_FADE} from '../src/obs/emergency-lighting.js';
import {CabinStartupLighting} from '../src/obs/startup-lighting.js';
import {CabinEnvironment} from '../src/obs/environment.js';
import {HatchRepairVisit,HATCH_REPAIR_PHASES} from '../src/obs/hatch-repair.js';
import {readFile} from 'node:fs/promises';

test('every hatch fault stage keeps the alarm on until the repair verification finishes',()=>{
  const environment=new CabinEnvironment(),effect=new CabinEmergencyLighting([]);
  effect.update(10,environment);assert.equal(effect.amount.value,0);
  environment.triggerFault();effect.update(.35,environment);assert.equal(effect.amount.value,1);
  const visit=new HatchRepairVisit(environment.fault.serial);
  for(const stage of ['turnIn','approach','align','inspect','repair']){
    environment.setStage(visit.serial,stage);visit.update(HATCH_REPAIR_PHASES[stage]);
    effect.update(.1,environment);assert.equal(effect.amount.value,1);assert.equal(visit.repaired,false);
  }
  assert.equal(visit.phase,'verify');visit.update(HATCH_REPAIR_PHASES.verify-.1);
  effect.update(.1,environment);assert.equal(effect.amount.value,1);assert.equal(visit.repaired,false);
  visit.update(.1);assert.equal(visit.repaired,true);environment.resolve(visit.serial);
  const phase=effect.time;effect.update(EMERGENCY_LIGHT_FADE.off/2,environment);
  assert.equal(effect.amount.value,.5);assert.equal(effect.time,phase,'hold the last red level during the recovery fade');
  effect.update(EMERGENCY_LIGHT_FADE.off/2,environment);assert.equal(effect.amount.value,0);
});

test('three-second warning pulses follow the strong buzzer attack and decay while reduced motion stays steady',async()=>{
  const levels=Array.from({length:301},(_,i)=>emergencyLightPower(i/100));
  assert.equal(Math.min(...levels),.15);assert.equal(Math.max(...levels),1.25);
  assert.equal(levels[0],levels[300]);assert.equal(EMERGENCY_LIGHT_PERIOD,3);
  for(let i=1;i<levels.length;i++)assert.ok(Math.abs(levels[i]-levels[i-1])<.15);
  const recording=await readFile(new URL('../public/assets/obs/audio/factory-warning-buzzer.wav',import.meta.url));
  const rate=recording.readUInt32LE(24),seconds=(recording.length-44)/2/rate;
  assert.equal(EMERGENCY_LIGHT_PERIOD,seconds,'the visual cycle has the exact shipped audio duration');
  const rms=time=>{let sum=0;const first=Math.round(time*rate),count=Math.round(.05*rate);for(let i=first;i<first+count;i++)sum+=(recording.readInt16LE(44+i*2)/32768)**2;return Math.sqrt(sum/count);};
  for(const time of [.2,.3,.4,.5]){assert.ok(rms(time)>.09);assert.equal(emergencyLightPower(time),1.25,'lights are bright during the strong warning');}
  for(const time of [1.8,2.2,2.8]){assert.ok(rms(time)<.005);assert.equal(emergencyLightPower(time),.15,'lights are dim in the quiet tail');}
  const effect=new CabinEmergencyLighting([],{reducedMotion:true}),environment={fault:{}};
  effect.update(.35,environment);const power=effect.power.value;
  effect.update(23.8,environment);assert.equal(effect.power.value,power);assert.equal(effect.amount.value,1);
});

test('an audio phase overrides render time without drifting and pause keeps the last phase',()=>{
  const effect=new CabinEmergencyLighting([]),environment={fault:{}};
  for(const [dt,phase]of [[.035,.3],[.05,2.1],[.1,3.3],[.003,12.3]]){
    effect.update(dt,environment,phase);assert.ok(Math.abs(effect.time-phase%3)<1e-9);
    assert.equal(effect.power.value,emergencyLightPower(phase));
  }
  const phase=effect.time;effect.update(0,environment);assert.equal(effect.time,phase);
  effect.update(.01,environment,0);assert.equal(effect.time,0,'a resumed audio voice resets the visual phase');
  environment.fault=null;effect.update(.1,environment,1);assert.equal(effect.time,0,'recovery keeps its previous red level');
});

test('pause freezes both the pulse and recovery; a renewed fault reverses the fade without a jump',()=>{
  const effect=new CabinEmergencyLighting([]),environment={fault:{}};
  effect.update(.7,environment);const before=[effect.time,effect.amount.value,effect.power.value];
  for(const dt of [0,-1,NaN,Infinity])effect.update(dt,environment);
  assert.deepEqual([effect.time,effect.amount.value,effect.power.value],before);
  environment.fault=null;effect.update(.4,environment);const partial=effect.amount.value;
  effect.update(0,environment);assert.equal(effect.amount.value,partial);
  environment.fault={};effect.update(0,environment);assert.equal(effect.amount.value,partial);
  effect.update(.35,environment);assert.equal(effect.amount.value,1);
});

test('cabin and character surfaces share a precompiled circuit with fixtures while screens keep their colors',()=>{
  const root=new Group(),surface=new MeshStandardMaterial(),lamp=new MeshBasicMaterial({name:'Ladder light diffuser'}),screen=new MeshBasicMaterial({name:'Powered telemetry screen'});
  lamp.userData.cabinAlwaysPowered=screen.userData.cabinAlwaysPowered=true;
  for(const material of [surface,lamp,screen])root.add(new Mesh(new BoxGeometry(),material));
  const original=surface.onBeforeCompile,screenCompile=screen.onBeforeCompile;
  const workCenter=new Vector3(6.84,8.169,1.085);
  const boot=new CabinStartupLighting([root],{start:false}),effect=new CabinEmergencyLighting([root],{workCenter});
  const shader={uniforms:{},vertexShader:ShaderLib.standard.vertexShader,fragmentShader:ShaderLib.standard.fragmentShader};
  surface.onBeforeCompile(shader);
  assert.equal(shader.uniforms.cabinBootActive,boot.active);assert.equal(shader.uniforms.cabinEmergencyAmount,effect.amount);
  assert.ok(shader.fragmentShader.indexOf('emergencyNormal')<shader.fragmentShader.indexOf('#include <tonemapping_fragment>'));
  assert.equal(shader.uniforms.cabinEmergencyWorkCenter,effect.workCenter);
  assert.deepEqual(effect.workCenter.value,workCenter);
  assert.ok(shader.vertexShader.includes('instanceMatrix * emergencyPosition'));
  assert.ok(shader.vertexShader.indexOf('vec4 emergencyPosition')>shader.vertexShader.indexOf('#include <skinning_vertex>'));
  assert.ok(shader.fragmentShader.includes('mix(emergencyLit, gl_FragColor.rgb, workPool)'));
  const fixtureShader={uniforms:{},vertexShader:ShaderLib.basic.vertexShader,fragmentShader:ShaderLib.basic.fragmentShader};
  lamp.onBeforeCompile(fixtureShader);assert.equal(fixtureShader.uniforms.cabinEmergencyPower,effect.power);
  assert.equal(fixtureShader.uniforms.cabinEmergencyWorkCenter,undefined,'only the work surfaces retain their normal light, not the red fixtures');
  assert.equal(screen.onBeforeCompile,screenCompile);assert.equal(effect.materials.length,2);
  const key=surface.customProgramCacheKey(),version=surface.version;
  effect.update(1,{fault:{}});effect.update(1.2,{fault:null});
  assert.equal(surface.version,version);assert.equal(surface.customProgramCacheKey(),key,'no shader compilation on fault or repair');
  effect.dispose();assert.equal(effect.amount.value,0);boot.dispose();assert.equal(surface.onBeforeCompile,original);
  root.traverse(mesh=>{mesh.geometry?.dispose();mesh.material?.dispose();});
});
