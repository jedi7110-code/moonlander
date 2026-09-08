import test from 'node:test';
import assert from 'node:assert/strict';
import {MoonGame,RULES,landingCheck,beamPower} from '../js/game.js';

const dt=1/60;
const make=()=>new MoonGame({random:()=>.5});
function tick(g,seconds,input={}){for(let i=0;i<Math.ceil(seconds/dt);i++)g.update(dt,typeof input==='function'?input(g.state,i):input);}
function surface(){const g=make();g.start();g.state.phase='surface';g.state.ship.y=0;g.state.player.x=0;g.state.player.z=8;g.state.player.facing=0;g.state.spawnTimer=1e6;g.state.trail=[{x:0,y:0,z:8}];return g;}
function enemy(g,x,z,boss=false){const e=g.spawnEnemy(boss,{x,z});e.emerging=0;return e;}
const ship={x:0,z:0,y:0,vy:-1,vx:0,vz:0,roll:0,pitch:0};

test('landing requires pad, vertical speed, horizontal speed and combined tilt',()=>{
  assert.equal(landingCheck(ship,{x:0,z:0}),null);
  for(const [change,expected]of [[{x:5},'zone'],[{vy:-1.41},'speed'],[{vx:1.1,vz:1.1},'drift'],[{roll:.09},'tilt'],[{pitch:.07,roll:.07},'tilt']])assert.equal(landingCheck({...ship,...change},{x:0,z:0}),expected);
  assert.equal(landingCheck({...ship,vy:-1.4,roll:RULES.maxTilt},{x:0,z:0}),null);
});
test('a full, manually controllable descent reaches a safe landing with fuel remaining',()=>{
  const g=make();g.start();
  for(let i=0;i<60*90&&g.state.phase==='landing';i++){
    const p=g.state.ship,goal=g.state.pad,targetSpeed=-Math.min(4,.65+p.y*.2);
    g.update(dt,{x:Math.max(-1,Math.min(1,(goal.x-p.x)*.5)),z:Math.max(-1,Math.min(1,(goal.z-p.z)*.5)),fire:p.vy<targetSpeed});
  }
  assert.equal(g.state.phase,'disembark',g.state.failure||'descent timed out');assert.ok(g.state.ship.fuel>50);
  tick(g,1.2,{interact:true});assert.equal(g.state.phase,'surface');assert.equal(g.state.player.y,0);
});
test('uncontrolled descent crashes, and a dry fuel tank cannot produce thrust',()=>{
  const g=make();g.start();g.state.ship.fuel=0;tick(g,15,{fire:true});assert.equal(g.state.phase,'failed');assert.equal(g.state.ship.fuel,0);assert.equal(g.state.failureType,'ship');
});
test('flight has movement in two horizontal axes and a hard altitude ceiling',()=>{
  const g=make();g.start();g.state.debris=[];const start={...g.state.ship};tick(g,1,{x:1,z:-1,fire:true});assert.ok(g.state.ship.x>start.x);assert.ok(g.state.ship.z<start.z);
  g.state.ship.y=79.99;g.state.ship.vy=3;g.update(dt,{fire:true});assert.equal(g.state.ship.y,80);assert.equal(g.state.ship.vy,0);
});
test('touching debris fails the flight on localhost-equivalent simulations too',()=>{
  const g=make();g.start();const p=g.state.ship;g.state.debris=[{x:p.x,y:p.y+3,z:p.z,r:1,vx:0,vz:0}];g.update(dt);assert.equal(g.state.phase,'failed');
});
test('normal beam strength follows the original three energy bands',()=>{
  assert.equal(beamPower(100),3);assert.equal(beamPower(67),3);assert.equal(beamPower(66),2);assert.equal(beamPower(34),2);assert.equal(beamPower(33),1);
  const g=surface();g.fire();assert.equal(g.state.energy,78);assert.equal(g.state.shots[0].power,3);
});
test('tap fires on release; holding for 1.5 s fires one piercing beam only',()=>{
  const g=surface();tick(g,.1,{fire:true});assert.equal(g.state.shots.length,0);g.update(dt,{fire:false});assert.equal(g.state.shots.length,1);assert.equal(g.state.shots[0].charged,false);
  g.state.shots=[];g.state.energy=100;g.drainEvents();tick(g,2,{fire:true});assert.equal(g.drainEvents().filter(e=>e.type==='fire').length,1);assert.equal(g.state.chargedFired,true);
  g.update(dt,{fire:false});assert.equal(g.drainEvents().filter(e=>e.type==='fire').length,0);
});
test('charge eligibility is locked at initial press, before later regeneration',()=>{
  const g=surface();g.state.energy=10;g.state.player.z=0;tick(g,1.7,{fire:true});assert.equal(g.state.chargeAllowed,false);assert.equal(g.state.chargedFired,false);assert.equal(g.state.shots.length,0);
});
test('normal shots use swept collision and hit only the nearest alien',()=>{
  const g=surface();enemy(g,0,10);const farther=enemy(g,0,12);g.fire(false);g.updateShots(.05);assert.equal(g.state.kills,1);assert.equal(g.state.enemies.length,1);assert.equal(g.state.enemies[0].id,farther.id);
});
test('charged beams pierce multiple aliens, and never damage one twice',()=>{
  const g=surface();enemy(g,0,13);enemy(g,0,18);const boss=enemy(g,0,24,true);g.fire(true);g.updateShots(dt);assert.equal(g.state.kills,2);assert.equal(boss.hp,4);g.updateShots(dt);assert.equal(boss.hp,4);assert.equal(g.state.energy,50);
});
test('every fifth defeat queues one boss, with original 10 HP',()=>{
  const g=surface();g.state.kills=4;enemy(g,0,12);g.fire();g.updateShots(.05);g.updateShots(.05);assert.equal(g.state.kills,5);assert.equal(g.state.bossesDue,1);const b=g.spawnEnemy();assert.equal(b.boss,true);assert.equal(b.hp,10);assert.equal(g.state.bossesDue,0);
});
test('low energy prevents shooting and expired shots are cleaned up',()=>{
  const g=surface();g.state.energy=4;g.fire();assert.equal(g.state.shots.length,0);g.state.energy=100;g.fire();g.updateShots(2);assert.equal(g.state.shots.length,0);
});
test('jump length responds to holding, and all jumps land again',()=>{
  const short=surface(),long=surface();short.update(dt,{jump:true});long.update(dt,{jump:true});tick(short,.27,{});tick(long,.27,{jump:true});assert.ok(long.state.player.y>short.state.player.y);tick(long,4);assert.equal(long.state.player.y,0);
});
test('ship and rover recharge at the original 90/s rate; elsewhere 15/s',()=>{
  const g=surface();g.state.energy=0;g.state.player.z=15;tick(g,1);assert.ok(Math.abs(g.state.energy-15)<.01);g.state.player.x=g.state.ship.x;g.state.player.z=g.state.ship.z;g.state.energy=0;tick(g,1);assert.ok(Math.abs(g.state.energy-90)<.01);
});
test('emerging aliens are not targetable until above the surface',()=>{
  const g=surface();g.spawnEnemy(false,{x:0,z:9});g.fire(true);g.updateShots(.05);assert.equal(g.state.enemies[0].hp,3);
});
test('player contact is lethal; a high jump avoids a small alien',()=>{
  const g=surface();enemy(g,0,8);g.update(dt);assert.equal(g.state.phase,'failed');
  const j=surface();j.state.player.y=2.1;enemy(j,0,8);j.update(dt);assert.equal(j.state.phase,'surface');
});
test('crew contact is lethal even while the crew member is climbing the ladder',()=>{
  const g=surface();g.state.rescued=true;g.state.player.x=8;const c=g.state.crews[0];Object.assign(c,{x:0,z:2.2,y:1,mode:'boarding',timer:.8});enemy(g,0,2.2);g.update(dt);assert.equal(g.state.phase,'failed');assert.equal(g.state.failureType,'crew');
});
test('approaching the wreck recruits the full crew; airborne disembarkation is protected',()=>{
  const g=surface();Object.assign(g.state.player,{x:g.state.rover.x,z:g.state.rover.z});g.update(dt);assert.equal(g.state.phase,'return');assert.equal(g.state.rescued,true);assert.equal(g.state.crews.length,2);assert.ok(g.state.crews.every(c=>c.mode==='emerging'));
});
test('crew trace the travelled path and can board sequentially without an early escape',()=>{
  const g=surface();const s=g.state;s.player.x=s.rover.x;s.player.z=s.rover.z;g.update(dt);tick(g,2);assert.ok(s.crews.every(c=>c.mode==='following'));
  // Drive with valid movement input back to the hatch, leaving the full path behind.
  for(let i=0;i<60*30;i++){const d=distance2(s.player,s.ship);g.update(dt,{x:d>1?(s.ship.x-s.player.x)/d:0,z:d>1?(s.ship.z-s.player.z)/d:0,interact:true});if(s.boarded===s.crews.length)break;}
  assert.equal(s.boarded,2);assert.notEqual(s.phase,'launch','holding E before boarding must not accidentally launch');
  g.update(dt,{interact:false});g.update(dt,{interact:true});assert.equal(s.phase,'launch');tick(g,10);assert.equal(s.phase,'complete');
});
function distance2(a,b){return Math.hypot(a.x-b.x,a.z-b.z);}
test('reset increases crew count only for the requested round and clears combat state',()=>{
  const g=surface();enemy(g,3,2);g.state.kills=18;g.state.boarded=2;g.state.charge=1;g.start(2);assert.equal(g.state.crews.length,3);assert.equal(g.state.kills,0);assert.equal(g.state.boarded,0);assert.equal(g.state.enemies.length,0);assert.equal(g.state.charge,0);
});
test('cancelling input on pause prevents a phantom shot after resume',()=>{
  const g=surface();tick(g,.7,{fire:true});g.cancelInput();g.update(dt,{});assert.equal(g.state.shots.length,0);assert.equal(g.state.charge,0);
});
test('a failed state cannot continue moving, shooting or boarding',()=>{
  const g=surface();g.fail('test');const before=JSON.stringify(g.state);tick(g,4,{x:1,fire:true,interact:true});assert.equal(JSON.stringify(g.state),before);
});
test('rocks block and slide moving entities instead of permitting clipping',()=>{
  const g=new MoonGame({obstacles:[{x:0,z:0,r:2}]});const e={x:3,z:0};g.moveWithObstacles(e,1,0);assert.ok(e.x>=2.38);g.moveWithObstacles(e,150,-150);assert.equal(e.x,104);assert.equal(e.z,-104);
});
test('contact with the existing black hexagonal artifact restores energy once per visit frame',()=>{
  const g=surface();Object.assign(g.state.player,{x:-37,z:-35});g.state.energy=1;g.update(dt);assert.equal(g.state.energy,100);assert.equal(g.drainEvents().filter(e=>e.type==='monolith').length,1);g.update(dt);assert.equal(g.drainEvents().filter(e=>e.type==='monolith').length,0);
});
