import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createLander,createAstronaut,createAlien,createRover,createPad,animateAstronaut,animateAlien} from '../src/js/models.js';
import {MoonScene,terrainHeight} from '../src/js/scene.js';
import {registerGameTools} from '../src/js/webmcp.js';
import {MoonGame} from '../src/js/game.js';

// Three.js model-construction test without a browser or a GPU; only text texture
// rasterization is replaced. Visual rendering is not asserted by this test.
globalThis.document={createElement:()=>({width:0,height:0,getContext:()=>({fillRect(){},fillText(){}})})};
test('all referenced 3D models construct with finite transforms and geometry',()=>{
  const models=[createLander(),createAstronaut(),createAstronaut(true,1),createAlien(),createAlien(true),createRover(),createPad()];
  for(const model of models){model.updateMatrixWorld(true);let count=0;model.traverse(child=>{assert.ok(child.matrixWorld.elements.every(Number.isFinite));if(child.isMesh){count++;assert.ok(child.geometry.attributes.position.count>0);}});assert.ok(count>=4);assert.ok(count<50,'shared materials should be merged into a bounded number of meshes');}
  animateAstronaut(models[1],{speed:5,y:0},1);animateAstronaut(models[2],{speed:1,y:1,mode:'boarding'},1);animateAlien(models[3],1);animateAlien(models[4],1);
});
test('lunar ground and scenery build with finite elevations and instance transforms',()=>{
  const world={scene:new THREE.Scene()};MoonScene.prototype.makeTerrain.call(world);assert.ok(world.obstacles.length>0);assert.equal(world.rocks.count,650);
  for(let x=-104;x<104;x+=8)for(let z=-104;z<104;z+=8)assert.ok(Number.isFinite(terrainHeight(x,z)));
  assert.equal(terrainHeight(0,0),0);
});
test('optional WebMCP registration gracefully skips unsupported browsers',()=>{assert.equal(registerGameTools({},null),null);});
test('WebMCP contract uses the same state, validates input and names its side effect',()=>{
  const registered=new Map(),g=new MoonGame();g.start();let paused=false;
  const controller=registerGameTools({getState:()=>g.state,isPaused:()=>paused,pause:v=>{paused=v;}},{registerTool:t=>registered.set(t.name,t)});
  const read=registered.get('read_moonlander_mission'),pause=registered.get('set_moonlander_pause');assert.equal(read.annotations.readOnlyHint,true);assert.equal(pause.annotations.readOnlyHint,false);
  assert.equal(read.execute({}).phase,'landing');assert.equal(pause.execute({paused:true}).paused,true);assert.throws(()=>pause.execute({paused:'yes'}));assert.equal(paused,true);assert.throws(()=>read.execute({extra:1}));controller.abort();
});
