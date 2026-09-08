import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {MoonGame} from '../js/game.js';
import {MoonScene,terrainHeight} from '../js/scene.js';

test('entire mission can be completed using normal input with real terrain, rocks and live enemies',()=>{
  const scenery={scene:new THREE.Scene()};MoonScene.prototype.makeTerrain.call(scenery);
  const game=new MoonGame({random:()=>.5,height:terrainHeight,obstacles:scenery.obstacles});game.start();
  const phases=new Set();
  for(let i=0;i<60*160;i++){
    const s=game.state,p=s.player,ship=s.ship;phases.add(s.phase);let input={};
    if(['failed','complete'].includes(s.phase))break;
    if(s.phase==='landing'){
      input={x:Math.max(-1,Math.min(1,(s.pad.x-ship.x)*.5)),z:Math.max(-1,Math.min(1,(s.pad.z-ship.z)*.5)),fire:ship.vy<-Math.min(4,.65+ship.y*.2)};
    }else if(s.phase==='disembark')input={interact:true};
    else if(['surface','return','boarding'].includes(s.phase)){
      const target=s.rescued?ship:s.rover,dx=target.x-p.x,dz=target.z-p.z,d=Math.hypot(dx,dz);
      const enemy=s.enemies.filter(e=>e.emerging<=0).sort((a,b)=>Math.hypot(a.x-p.x,a.z-p.z)-Math.hypot(b.x-p.x,b.z-p.z))[0];
      input={x:d>1?dx/d:0,z:d>1?dz/d:0,aim:enemy?{x:enemy.x,z:enemy.z}:null,fire:!!enemy&&i%33<32,interact:s.boarded===s.crews.length};
    }
    game.update(1/60,input);game.drainEvents();
  }
  assert.equal(game.state.phase,'complete',game.state.failure||'Mission timed out');
  for(const phase of ['landing','disembark','surface','return','boarding','launch','complete'])assert.ok(phases.has(phase),phase);
  assert.equal(game.state.boarded,2);assert.ok(game.state.kills>0);assert.ok(game.state.ship.fuel>0);
});
