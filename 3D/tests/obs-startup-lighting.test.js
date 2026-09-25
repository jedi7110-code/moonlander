import test from 'node:test';
import assert from 'node:assert/strict';
import {Group,Mesh,InstancedMesh,BoxGeometry,MeshStandardMaterial,MeshBasicMaterial,MeshPhysicalMaterial,ShaderLib,PointLight,AdditiveBlending,Raycaster,Vector3,Box3} from 'three';
import {CabinStartupLighting,STARTUP_LIGHT_DELAY,STARTUP_LIGHT_SECONDS,STARTUP_TOTAL_SECONDS,STARTUP_CIRCUITS,circuitDelay,circuitPower,revealStartupScene} from '../src/obs/startup-lighting.js';
import {createCabinToon} from '../src/obs/cabin-toon.js';
import {createAccessLadder,FLOOR_Y} from '../src/obs/ship.js';
import {screen,batchStatic} from '../src/obs/materials.js';
import {createPlantRack} from '../src/obs/plants.js';
import {createScreenGlow} from '../src/obs/screen-glow.js';
import {displayFrame} from '../src/obs/display-frame.js';
import {LADDER_LIGHT_LAYOUT,EVA_SPOT_LAYOUT} from '../src/obs/lighting.js';
import {createEVASpotlights} from '../src/obs/eva.js';

test('cold rendering stays behind the loader and a zero-power frame is presented before the startup clock can run',async()=>{
  const effect=new CabinStartupLighting([]),events=[],frames=[];
  let revealed=false,started=false,wallTime=0;
  const ready=revealStartupScene({
    draw:()=>{events.push(['draw',revealed,effect.time]);wallTime+=250;assert.equal(effect.active.value,1);assert.ok(effect.roomLevels.value.every(v=>v===0));},
    reveal:()=>{revealed=true;events.push(['reveal',effect.time]);},
    nextFrame:()=>new Promise(resolve=>frames.push(resolve)),
  }).then(()=>{started=true;});
  assert.deepEqual(events,[['draw',false,0]]);assert.equal(started,false);
  // Simulate an arbitrarily slow first upload; none of it advances the lamps.
  wallTime+=5000;frames.shift()();await Promise.resolve();
  assert.deepEqual(events,[['draw',false,0],['draw',false,0],['reveal',0]]);
  assert.equal(started,false);assert.equal(effect.time,0);assert.ok(wallTime>STARTUP_LIGHT_SECONDS*1000);
  frames.shift()();await ready;assert.equal(started,true);
  effect.update(1/60);assert.ok(effect.time<.02);assert.equal(effect.done,false);effect.dispose();
});

test('ceilings wait one second, then settle over 1.6 seconds from ignition',()=>{
  const delays=Array.from({length:STARTUP_CIRCUITS},(_,i)=>circuitDelay(i));
  assert.equal(new Set(delays).size,STARTUP_CIRCUITS);assert.ok(Math.max(...delays)-Math.min(...delays)<.07);
  assert.equal(STARTUP_LIGHT_SECONDS,1.6);
  assert.equal(STARTUP_LIGHT_DELAY,1);assert.equal(STARTUP_TOTAL_SECONDS,2.6);
  assert.ok(delays.slice(0,8).some((t,i)=>i&&t<delays[i-1]),'not a left-to-right sweep');
  for(let id=0;id<STARTUP_CIRCUITS;id++){
    for(const time of [0,.5,.999,1])assert.equal(circuitPower(id,time),0);
    assert.equal(circuitPower(id,STARTUP_TOTAL_SECONDS),1);
    assert.ok(circuitPower(id,1+delays[id]+.06)>.6);assert.equal(circuitPower(id,1+delays[id]+.19),0);
    let wasOn=false,attempts=0;
    for(let t=0;t<STARTUP_TOTAL_SECONDS;t+=.002){
      const value=circuitPower(id,t);assert.ok(value>=0&&value<=1);
      if(value>.1&&!wasOn)attempts++;wasOn=value>.1;
    }
    assert.equal(attempts,3,'two failed starts followed by a steady light');
  }
  assert.ok(delays.every((delay,i)=>circuitPower(i,1+delay+.02)>0),'every tube starts within the first 85 ms after the wait');
  assert.ok(delays.every((_,i)=>circuitPower(i,2.5)<1),'do not finish early: keep the requested 1.6-second settling length');
  assert.ok(delays.every((_,i)=>circuitPower(i,2.6)===1),'every circuit finishes at the shared deadline');
});

test('reduced motion keeps the one-second wait and slow frames do not extend the 2.6-second total',()=>{
  for(let id=0;id<STARTUP_CIRCUITS;id++){
    let previous=0;
    for(let time=0;time<7;time+=.01){const value=circuitPower(id,time,true);assert.ok(value>=previous);previous=value;}
  }
  const effect=new CabinStartupLighting([],{reducedMotion:true});
  effect.update(0);effect.update(-1);effect.update(NaN);assert.equal(effect.time,0);
  effect.update(1);assert.ok(effect.levels.value.every(p=>p===0));assert.ok(effect.roomLevels.value.every(p=>p===0));
  effect.update(1.6);
  assert.equal(effect.time,STARTUP_TOTAL_SECONDS);assert.equal(effect.done,true);assert.equal(effect.active.value,0);
  assert.ok(effect.levels.value.every(p=>p===1));assert.ok(effect.roomLevels.value.every(p=>p===1));effect.dispose();
});

test('vegetable grow lenses stay powered and rack surfaces keep independent grow illumination',()=>{
  const previous=globalThis.document;
  const ctx=new Proxy({measureText:t=>({width:t.length*8}),createLinearGradient:()=>({addColorStop(){}})},{get:(o,k)=>k in o?o[k]:()=>{}});
  globalThis.document={createElement:()=>({getContext:()=>ctx})};
  const material=new MeshStandardMaterial();let rack;
  try{rack=createPlantRack(new Proxy({},{get:()=>material}),-6.93);}finally{if(previous===undefined)delete globalThis.document;else globalThis.document=previous;}
  const lens=rack.root.getObjectByName('Grow light diffuser 1').material,compile=lens.onBeforeCompile;
  const effect=new CabinStartupLighting([rack.root]);
  assert.equal(lens.userData.cabinAlwaysPowered,true);assert.equal(lens.onBeforeCompile,compile);
  const shader={uniforms:{},vertexShader:ShaderLib.standard.vertexShader,fragmentShader:ShaderLib.standard.fragmentShader};material.onBeforeCompile(shader);
  assert.match(shader.fragmentShader,/return max\(cabinGrowPower\(\)/,'grow illumination is independent of the ceiling mask');
  assert.match(shader.fragmentShader,/vec3\(0.35, 0.42, 0.24\) \* cabinGrowPower\(\)/,'grow spill also survives VR light culling');
  effect.update(1);assert.ok(effect.levels.value.every(v=>v===0));assert.equal(lens.onBeforeCompile,compile);
  effect.dispose();const geometries=new Set(),materials=new Set();
  rack.root.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material)materials.add(o.material);});
  geometries.forEach(g=>g.dispose());materials.forEach(m=>{m.map?.dispose();m.dispose();});
});

test('each recessed screen has its own aperture-sized soft glow with no bloom over its panel',()=>{
  const glow=createScreenGlow();
  assert.equal(glow.geometry.index.count/3,14);assert.equal(glow.children.length,0);
  const p=glow.geometry.attributes.position;
  for(let i=0;i<7;i++){
    const width=p.getX(i*4+1)-p.getX(i*4),height=p.getY(i*4+2)-p.getY(i*4);
    assert.ok(width<=1.161&&height<=.611,'glow is inside the glass, not spread over the front panel');
    assert.ok(p.getZ(i*4)<(i<3?-.405:-1.2425),'glow sits behind the rim');
  }
  assert.equal(glow.material.blending,AdditiveBlending);assert.equal(glow.material.depthTest,true);assert.equal(glow.material.depthWrite,false);
  assert.equal(glow.castShadow,false);assert.equal(glow.receiveShadow,false);
  assert.match(glow.material.fragmentShader,/exp\(-dot\(p,p\)\*3.8\)/);
  assert.match(glow.material.fragmentShader,/1.0-smoothstep\(0.65,1.0,radius\)/,'halos disappear before their quad edges');
  assert.deepEqual(glow.material.uniforms,{});
  const effect=new CabinStartupLighting([glow]);assert.equal(effect.materials.length,0,'halo never flickers with ceiling power');
  effect.dispose();glow.geometry.dispose();glow.material.dispose();
});

test('recessed bezels have real holes, a forward rim, and knobs can stand in front of the panel',()=>{
  const root=new Group(),material=new MeshStandardMaterial();
  const panel=displayFrame(root,material,{x:0,y:0,z:-.49,width:1.46,height:.98,depth:.20,holeWidth:1.104,holeHeight:.742,offsetX:-.1,offsetY:.03});
  root.updateMatrixWorld(true);
  const ray=new Raycaster(new Vector3(-.1,.03,1),new Vector3(0,0,-1));
  assert.equal(ray.intersectObject(panel,true).length,0,'no solid front plate hides the recessed glass');
  ray.ray.origin.x=.65;assert.ok(ray.intersectObject(panel,true).length>0,'surrounding plate remains solid');
  const front=new Box3().setFromObject(panel).max.z;
  assert.ok(front>-.405&&front<-.35,'glass at -.45 is behind the panel; knob at -.35 is in front');
  panel.traverse(mesh=>mesh.geometry?.dispose());material.dispose();
});

test('ladder lenses and console screens keep their power through static batching and every ceiling phase',()=>{
  const mats=new Proxy({},{get:(target,key)=>target[key]??=(new MeshStandardMaterial({name:key}))});
  const root=createAccessLadder(mats),previous=globalThis.document;
  const ladderSources=[];root.traverse(o=>{if(o.name==='Ladder hand and foot light')ladderSources.push(o);});
  assert.equal(ladderSources.length,2*LADDER_LIGHT_LAYOUT.count);
  for(const side of [-1,1])for(let row=0;row<LADDER_LIGHT_LAYOUT.count;row++){
    const source=ladderSources.find(o=>o.position.x===side*LADDER_LIGHT_LAYOUT.sourceX&&Math.abs(o.position.y-(LADDER_LIGHT_LAYOUT.firstY+row*LADDER_LIGHT_LAYOUT.spacing+LADDER_LIGHT_LAYOUT.sourceYOffset))<1e-8);
    assert.ok(source,'shader pool layout must match every physical fixture');
    assert.equal(source.position.z,LADDER_LIGHT_LAYOUT.sourceZ);
  }
  const ctx=new Proxy({},{get:()=>()=>{}});
  globalThis.document={createElement:()=>({getContext:()=>ctx})};
  try{screen(root,-10.3,8.514,-.45);}finally{if(previous===undefined)delete globalThis.document;else globalThis.document=previous;}
  const batch=batchStatic(root,{xrLOD:true}),powered=batch.children.filter(mesh=>mesh.material.userData.cabinAlwaysPowered);
  assert.equal(powered.length,2);assert.ok(powered.every(mesh=>mesh.userData.xrWideGeometry.attributes.position.count>0));
  const originals=powered.map(mesh=>mesh.material.onBeforeCompile),effect=new CabinStartupLighting([batch]);
  for(const dt of [0,.5,.5,.08,.14,.17,.61,1]){
    effect.update(dt);
    powered.forEach((mesh,i)=>{
      assert.equal(mesh.material.onBeforeCompile,originals[i]);assert.ok(!effect.materials.some(entry=>entry.material===mesh.material));
    });
  }
  effect.dispose();
  const geometries=new Set(),materials=new Set();
  for(const group of [root,batch])group.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material)materials.add(o.material);});
  geometries.forEach(g=>g.dispose());materials.forEach(m=>{m.map?.dispose();m.dispose();});
});

test('always-on spill remains outside the ceiling mask, respects surface textures and does not add scene resources',()=>{
  const root=new Group(),geometry=new BoxGeometry(),material=new MeshStandardMaterial(),mesh=new Mesh(geometry,material);root.add(mesh);
  const children=[...root.children],effect=new CabinStartupLighting([root],{start:false});
  assert.equal(effect.done,true);assert.equal(effect.active.value,0);assert.deepEqual(root.children,children);
  const shader={uniforms:{},vertexShader:ShaderLib.standard.vertexShader,fragmentShader:ShaderLib.standard.fragmentShader};material.onBeforeCompile(shader);
  assert.match(shader.fragmentShader,/#define CABIN_PRACTICAL_SPILL/);
  assert.match(shader.fragmentShader,/diffuseColor.rgb \* cabinPracticalSpill\(inverseTransformDirection\(normal, viewMatrix\)\)/);
  assert.ok(shader.fragmentShader.indexOf('gl_FragColor.rgb +=')>shader.fragmentShader.indexOf('gl_FragColor.rgb *= cabinBootPower()'));
  assert.ok(shader.fragmentShader.indexOf('gl_FragColor.rgb +=')<shader.fragmentShader.indexOf('#include <tonemapping_fragment>'));
  assert.match(shader.fragmentShader,/p.z - 2.55/,'emergency spill is on the near-wall side');
  assert.match(shader.fragmentShader,/p.x \+ 4.57/,'monitor stack has its own green pool');
  assert.match(shader.fragmentShader,/dot\(surfaceNormal, normalize\(consoleSource - p/,'front-facing bezels reject light from glass behind them');
  assert.match(shader.fragmentShader,/growFloor \*= max\(0.0, surfaceNormal.y\)/,'grow light reaches the aisle floor without lighting its underside');
  assert.match(shader.fragmentShader,/vec3\(0.85, 0.58, 0.25\) \* emergency/,'emergency illumination is a softer yellow amber, not red-orange');
  assert.match(shader.fragmentShader,/vec3\(0.90, 0.80, 0.63\) \* cabinLadderSpill\(p, surfaceNormal\)/,'steady local ladder pools survive ceiling-off and VR light culling');
  assert.ok(shader.fragmentShader.includes(`floor((p.y - ${LADDER_LIGHT_LAYOUT.firstY.toFixed(2)}) / ${LADDER_LIGHT_LAYOUT.spacing.toFixed(2)} + 0.5)`),'pools repeat at the fixture pitch');
  assert.ok(shader.fragmentShader.includes(`0.0, ${(LADDER_LIGHT_LAYOUT.count-1).toFixed(1)})`),'no imaginary fixtures beyond the top or bottom');
  assert.match(shader.fragmentShader,/cabinSoftPool\(left \/ vec3\(0.82, 0.62, 0.80\)\) \* leftFacing/,'soft bounded falloff, not a uniform emissive ladder');
  assert.match(shader.fragmentShader,/dot\(surfaceNormal, right \/ max\(length\(right\), 0.001\)\)/,'opposite-facing rung surfaces stay dim and zero-length vectors stay finite');
  effect.restart();effect.update(1);assert.ok(effect.roomLevels.value.every(p=>p===0));
  effect.dispose();geometry.dispose();material.dispose();
});

test('three overhead EVA spots share one steady lens material and keep soft cones without real-time lights',()=>{
  const material=new MeshStandardMaterial(),m=new Proxy({},{get:()=>material});
  const root=createEVASpotlights(m,EVA_SPOT_LAYOUT.floorY),heads=[],lenses=[],lights=[];
  root.updateMatrixWorld(true);root.traverse(o=>{
    if(/^EVA overhead spot \d$/.test(o.name))heads.push(o);
    if(/^EVA spot lens \d$/.test(o.name))lenses.push(o);
    if(o.isLight)lights.push(o);
  });
  assert.equal(heads.length,3);assert.equal(lenses.length,3);assert.equal(lights.length,0);
  assert.equal(new Set(lenses.map(mesh=>mesh.material)).size,1);
  assert.equal(EVA_SPOT_LAYOUT.floorY,FLOOR_Y[0],'shader pools align with the actual operations deck');
  for(const [index,head]of heads.entries()){
    const target=new Vector3(EVA_SPOT_LAYOUT.suitX[index],EVA_SPOT_LAYOUT.floorY+EVA_SPOT_LAYOUT.targetY,EVA_SPOT_LAYOUT.targetZ);
    assert.equal(head.position.x,EVA_SPOT_LAYOUT.suitX[index]);
    const axis=new Vector3(0,-1,0).applyQuaternion(head.quaternion);
    assert.ok(axis.dot(target.sub(head.position).normalize())>.99999,'housing points down and back at its own helmet and chest');
    assert.equal(lenses[index].castShadow,false);assert.equal(lenses[index].material.userData.cabinAlwaysPowered,true);
  }
  const batch=batchStatic(root,{xrLOD:true}),effect=new CabinStartupLighting([batch]);
  assert.equal(batch.children.filter(o=>o.material.userData.cabinAlwaysPowered).length,1,'three small lenses share one draw after batching');
  assert.ok(!effect.materials.some(entry=>entry.material===lenses[0].material));
  const shader={uniforms:{},vertexShader:ShaderLib.standard.vertexShader,fragmentShader:ShaderLib.standard.fragmentShader};material.onBeforeCompile(shader);
  assert.match(shader.fragmentShader,/p.y < 6.784 \|\| p.y > 9.694/,'no spill through the ceiling or onto another deck');
  assert.match(shader.fragmentShader,/smoothstep\(0.898794, 0.961262, dot\(toLight, reverseAxis\)\)/,'26-degree cone has a soft 16-degree core');
  assert.match(shader.fragmentShader,/cone \* fade \* fade \* max\(0.0, dot\(surfaceNormal, toLight\)\)/,'finite distance and surface-facing attenuation, not self-emitting suits');
  assert.match(shader.fragmentShader,/vec3\(1.35, 1.18, 0.94\) \* cabinEVASpill\(p, surfaceNormal\)/);
  effect.update(1);assert.ok(effect.levels.value.every(v=>v===0));effect.update(1.6);assert.equal(effect.active.value,0);
  effect.dispose();const geometries=new Set();for(const group of [root,batch])group.traverse(o=>{if(o.geometry)geometries.add(o.geometry);});
  geometries.forEach(g=>g.dispose());lenses[0].material.dispose();material.dispose();
});

test('startup preserves material identities, geometry, local-light count and source shader hooks, including toon and instancing',()=>{
  const root=new Group(),geometry=new BoxGeometry(1,1,1),paint=new MeshStandardMaterial(),lamp=new MeshStandardMaterial({emissiveIntensity:2.2});
  const wall=new Mesh(geometry,paint),lens=new Mesh(geometry,lamp),glass=new Mesh(geometry,new MeshPhysicalMaterial({transparent:true}));
  const grow=new Mesh(geometry,new MeshBasicMaterial({name:'Full-spectrum grow diffuser'}));root.add(wall,lens,glass,grow);
  const light=new PointLight(0xffccaa,10);root.add(light);
  const toon=createCabinToon([root]);toon.setStyle('cartoon');
  const instanced=new InstancedMesh(geometry,wall.material,3);root.add(instanced);
  const nodes=[...root.children],materials=[wall,lens,glass,grow,instanced].map(m=>m.material);
  const originals=materials.map(m=>[m.onBeforeCompile,m.customProgramCacheKey,m.customProgramCacheKey()]);
  const effect=new CabinStartupLighting([root]);
  assert.equal(effect.materials.length,4,'shared instance materials are wrapped only once');
  assert.deepEqual(root.children,nodes);assert.deepEqual([wall,lens,glass,grow,instanced].map(m=>m.material),materials);
  for(const [i,material] of materials.entries()){
    const lib=material.isMeshToonMaterial?ShaderLib.toon:material.isMeshBasicMaterial?ShaderLib.basic:ShaderLib.physical;
    const shader={uniforms:{},vertexShader:lib.vertexShader,fragmentShader:lib.fragmentShader};material.onBeforeCompile(shader);
    assert.equal(shader.uniforms.cabinBootLevels,effect.levels);assert.equal(shader.uniforms.cabinBootActive,effect.active);
    assert.match(shader.vertexShader,/instanceMatrix \* bootPosition/);
    assert.ok(shader.vertexShader.indexOf('bootPosition = vec4(transformed')>shader.vertexShader.indexOf('#include <skinning_vertex>'));
    assert.ok(shader.fragmentShader.indexOf('gl_FragColor.rgb *= cabinBootPower()')<shader.fragmentShader.indexOf('#include <tonemapping_fragment>'));
    if(i===0)assert.match(shader.fragmentShader,/vec3 shade = mix/,'toon quantization remains installed');
    assert.equal(shader.fragmentShader.includes('#define CABIN_BOOT_FIXTURE'),i===1||i===3);
  }
  const versions=materials.map(m=>m.version);
  for(let i=0;i<400;i++)effect.update(1/60);
  assert.deepEqual(materials.map(m=>m.version),versions,'no shader recompilation at the end of startup');
  assert.equal(light.intensity,10);assert.equal(light.visible,true);
  const active=effect.active,levels=effect.levels,values=effect.levels.value;
  effect.restart(true);assert.equal(effect.active,active);assert.equal(effect.levels,levels);assert.equal(effect.levels.value,values);
  assert.equal(effect.time,0);assert.equal(effect.done,false);assert.equal(effect.active.value,1);assert.ok(values.every(p=>p===0));
  assert.deepEqual(materials.map(m=>m.version),versions,'replay keeps cached shader uniform bindings');
  effect.dispose();
  for(const [i,material] of materials.entries()){
    assert.equal(material.onBeforeCompile,originals[i][0]);assert.equal(material.customProgramCacheKey,originals[i][1]);assert.equal(material.customProgramCacheKey(),originals[i][2]);
  }
  toon.dispose();geometry.dispose();new Set([...materials,paint,lamp]).forEach(m=>m.dispose());
});

test('restarting and disposing lighting restores shaders without accumulating hooks or owning the scene assets',()=>{
  const root=new Group(),geometry=new BoxGeometry(),material=new MeshBasicMaterial(),mesh=new Mesh(geometry,material);root.add(mesh);
  const original=material.onBeforeCompile,key=material.customProgramCacheKey;
  let disposed=false;geometry.addEventListener('dispose',()=>{disposed=true;});
  for(let i=0;i<3;i++){
    const effect=new CabinStartupLighting([root]);assert.equal(effect.time,0);assert.equal(effect.active.value,1);
    effect.update(.05);effect.dispose();effect.dispose();
    assert.equal(material.onBeforeCompile,original);assert.equal(material.customProgramCacheKey,key);assert.equal(root.children.length,1);assert.equal(disposed,false);
  }
  geometry.dispose();material.dispose();
});
