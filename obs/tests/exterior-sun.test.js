import test from 'node:test';
import assert from 'node:assert/strict';
import {DirectionalLight,PerspectiveCamera,Vector3,Group,Mesh,BoxGeometry,MeshStandardMaterial} from 'three';
import {createExteriorSun} from '../src/obs/exterior-sun.js';
import {createExteriorCruise} from '../src/obs/exterior-cruise.js';
import {EXTERIOR_SUN_LENS,sunLensGhosts} from '../src/obs/exterior-sun-lens.js';

test('the Jupiter-8 topology supplies distinct surface-pair ghosts across all three optical groups',()=>{
  const {surfaces,paths,ghosts}=sunLensGhosts();
  assert.equal(EXTERIOR_SUN_LENS.groups.reduce((sum,group)=>sum+group.elements,0),6);
  assert.equal(surfaces.length,9,'six elements in three cemented groups have nine distinct interfaces');
  assert.equal(surfaces.filter(surface=>surface.air).length,6);
  assert.equal(paths.length,36);assert.equal(paths.filter(path=>path.air).length,15,'all main two-reflection pairs are enumerated');
  assert.equal(new Set(paths.map(path=>`${path.front}/${path.rear}`)).size,36);
  assert.equal(ghosts.length,9);assert.equal(new Set(ghosts.map(ghost=>ghost.groupPair)).size,6);
  assert.ok(Math.max(...ghosts.map(ghost=>ghost.axis))-Math.min(...ghosts.map(ghost=>ghost.axis))>3,'reflections occupy a line through both sides of the optical centre');
  assert.ok(new Set(ghosts.map(ghost=>ghost.radius)).size>6,'different paths must not become repeated copies of one ring');
  assert.ok(ghosts.every(ghost=>ghost.strength>0&&ghost.strength<.1&&ghost.radius>0));
});

test('visible sunlight shares the shadow light direction without nearby parallax during cruise or an origin reset',()=>{
  const light=new DirectionalLight();light.position.set(64,-110,92);
  const sun=createExteriorSun(light),camera=new PerspectiveCamera(38,16/9,.1,2400);
  const ship={root:{position:new Vector3()}},controls={target:new Vector3()};
  const cruise=createExteriorCruise({ship,camera,controls,lights:[light]});
  camera.position.set(-180,140,-125);camera.lookAt(controls.target);camera.updateMatrixWorld(true);
  const direction=new Vector3(64,-110,92).normalize();
  try{
    sun.update(camera);const initial=sun.mesh.position.clone().project(camera);
    for(const seconds of [1,100,1801]){
      cruise.step(seconds);camera.updateMatrixWorld(true);sun.update(camera);
      assert.ok(sun.mesh.position.clone().sub(camera.position).normalize().distanceTo(direction)<1e-12);
      assert.ok(sun.mesh.position.clone().project(camera).distanceTo(initial)<1e-10);
    }
    assert.equal(sun.mesh.material.depthTest,true,'foreground hull depth hides the distant emitter');
    assert.equal(sun.mesh.material.depthWrite,false,'the glow cannot hide other distant scenery');
    light.position.copy(light.target.position).add(new Vector3(-64,110,-92));sun.update(camera);
    assert.ok(sun.mesh.position.clone().sub(camera.position).normalize().distanceTo(direction.negate())<1e-12);
  }finally{sun.dispose();}
});

test('direct sunlight glare disappears behind the hull and returns when the star clears its edge',()=>{
  const light=new DirectionalLight();light.position.set(0,0,-10);
  const root=new Group(),body=new Mesh(new BoxGeometry(2,2,2),new MeshStandardMaterial());
  body.castShadow=true;body.position.z=-10;root.add(body);
  const camera=new PerspectiveCamera(38,16/9,.1,2400);camera.lookAt(0,0,-1);
  const sun=createExteriorSun(light,{ship:{root}});
  try{
    sun.update(camera);assert.equal(sun.glare.material.uniforms.exposure.value,0,'occluded star cannot wash over the ship');
    body.position.x=4;sun.update(camera);assert.equal(sun.glare.material.uniforms.exposure.value,1,'looking directly at the clear star gives full glare');
    assert.ok(sun.glare.material.uniforms.source.value.length()<1e-12);
    camera.lookAt(0,0,1);sun.update(camera);assert.equal(sun.glare.visible,false,'a star behind the observer creates no front-facing glare');
  }finally{sun.dispose();body.geometry.dispose();body.material.dispose();}
});

test('the study sun remains beyond the hull and is occluded from a ten kilometre viewpoint',()=>{
  const light=new DirectionalLight();light.position.set(0,0,-10);
  const root=new Group(),body=new Mesh(new BoxGeometry(200,200,200),new MeshStandardMaterial());
  body.castShadow=true;body.position.z=-10000;root.add(body);
  const camera=new PerspectiveCamera(38,16/9,4900,100000);camera.lookAt(0,0,-1);
  const sun=createExteriorSun(light,{ship:{root},distance:50000});
  try{
    sun.update(camera);
    assert.equal(sun.mesh.position.distanceTo(camera.position),50000);
    assert.equal(sun.glare.material.uniforms.exposure.value,0,'a distant hull still blocks the flare');
    body.position.x=400;sun.update(camera);
    assert.equal(sun.glare.material.uniforms.exposure.value,1);
    const projected=sun.mesh.position.clone().project(camera);
    assert.ok(projected.z>-1&&projected.z<1,'the emitter remains inside the extended camera depth range');
  }finally{sun.dispose();body.geometry.dispose();body.material.dispose();}
});

test('planet transits attenuate both the luminous source and its lens flare',()=>{
  const light=new DirectionalLight();light.position.set(0,0,-10);
  let transmission=1;const sun=createExteriorSun(light,{visibility:()=>transmission});
  const camera=new PerspectiveCamera(38,16/9,.1,2400);camera.lookAt(0,0,-1);
  try{
    sun.update(camera);assert.equal(sun.glare.material.uniforms.exposure.value,1);
    transmission=.35;sun.update(camera);
    assert.equal(sun.mesh.material.uniforms.transmission.value,.35);
    assert.equal(sun.glare.material.uniforms.exposure.value,.35);
    transmission=0;sun.update(camera);
    assert.equal(sun.mesh.visible,false);assert.equal(sun.glare.visible,false);
    assert.equal(sun.glare.material.uniforms.exposure.value,0);
  }finally{sun.dispose();}
});

test('off-screen flare fades continuously past every edge in landscape and portrait',()=>{
  const light=new DirectionalLight(),sun=createExteriorSun(light);
  try{
    for(const aspect of [16/9,4/5])for(const axis of ['x','y'])for(const sign of [-1,1]){
      const camera=new PerspectiveCamera(38,aspect,.1,2400);
      const halfField=Math.atan(Math.tan(38*Math.PI/360)*(axis==='x'?aspect:1));
      const atAngle=angle=>{
        light.position.set(0,0,-1);light.position[axis]=sign*Math.tan(angle);
        sun.update(camera);return sun.glare.material.uniforms.exposure.value;
      };
      assert.equal(atAngle(0),1);
      assert.ok(atAngle(halfField+.02)>0,'ghosts remain after the emitter leaves the image');
      const oldCutoff=Math.atan(Math.tan(halfField)*1.5);
      assert.ok(atAngle(oldCutoff+1e-6)>0,'the old off-screen cutoff must no longer hide the flare');
      assert.ok(Math.abs(atAngle(oldCutoff-1e-6)-atAngle(oldCutoff+1e-6))<1e-4);
      let previous=atAngle(halfField);
      for(let step=1;step<=160;step++){
        const exposure=atAngle(halfField+step*.002);
        assert.ok(exposure<=previous+1e-12,'attenuation must not brighten on the way out');
        assert.ok(previous-exposure<.02,'there must be no hard jump to zero');
        previous=exposure;
      }
      assert.equal(atAngle(halfField+.321),0);
      assert.equal(sun.glare.visible,false,'cull only after the flare has faded to zero');
      assert.equal(atAngle(0),1,'returning to the source restores glare without a stale fade');
    }
  }finally{sun.dispose();}
});
