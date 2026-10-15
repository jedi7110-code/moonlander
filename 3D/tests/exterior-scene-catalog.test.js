import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {EXTERIOR_SCENE_CATALOG,exteriorSceneURL,CAMERA_REVISION,PREVIOUS_CAMERA_REVISION,LOW_CAMERA_REVISION,FAST_CAMERA_REVISION,FULL_CAMERA_REVISION,LEVEL_CAMERA_REVISION,ENTRY_CAMERA_REVISION,BEFORE_EXIT_REVISION} from '../src/obs/exterior-scene-catalog.js';
import {sampleExteriorCinema,sampleExteriorCinemaFrame,exteriorCinemaShots} from '../src/obs/exterior-cinematic.js';
import {sampleExteriorCinema as previousCinema,sampleExteriorCinemaFrame as previousFrame} from '../src/obs/exterior-cinematic-20261013-r2.js';
import {sampleExteriorCinema as savedCinema,sampleExteriorCinemaFrame as savedFrame} from '../src/obs/exterior-cinematic-20261013-r1.js';

// Faster/longer early shots shift the shared world origin; compare later camera geometry
// after removing that translation, rather than requiring its old absolute X.
const currentShots=exteriorCinemaShots();
const dockingExtension=currentShots.find(shot=>shot.id==='lander').duration-8.8;
const filmDelay=dockingExtension+currentShots[0].duration-36.75+currentShots[1].duration-12;
const archiveTravelGain=dockingExtension*2+(currentShots[0].duration-5.9)*currentShots[0].speed-(36.75-5.9)*10.12*.97+(currentShots[1].duration-(currentShots[1].flightOrigin??0))*currentShots[1].speed-12*48;
const assertTranslated=(a,b,gain=archiveTravelGain)=>a.forEach((value,index)=>assert.ok(Math.abs(value-b[index]-(index===0?gain:0))<1e-8));

test('the before-speed camera archive stays immutable and routes to its independent sampler',()=>{
  const source=readFileSync(new URL('../src/obs/exterior-cinematic-20261013-r1.js',import.meta.url));
  assert.equal(createHash('sha256').update(source).digest('hex'),'87ca9cc93469295b05d73753979c0659b8eab9c29194241963288b3d280daff8','create a new revision rather than editing an existing archive');
  for(const options of [{},{approach:'bow',ending:'underside'},{penultimate:'bow'},{penultimate:'bow-slide'},{penultimate:'underside'},{penultimate:'probe-wide'}])
    for(const time of [0,38,54,64.8,73.75,78.75,82.75,86.75,87,150,300,10000]){
      const revised={...options,opening:true,revision:CAMERA_REVISION};
      assert.deepEqual(sampleExteriorCinema(time,revised),savedCinema(time,{...options,opening:true}));
      assert.deepEqual(sampleExteriorCinemaFrame(time,revised),savedFrame(time,{...options,opening:true}));
    }
});
test('every scene catalog link samples its advertised scene, including all 05 alternatives and the old 09',()=>{
  assert.equal(new Set(EXTERIOR_SCENE_CATALOG.map(entry=>entry.id)).size,EXTERIOR_SCENE_CATALOG.length);
  assert.deepEqual([...new Set(EXTERIOR_SCENE_CATALOG.map(entry=>entry.number))],[1,2,3,7,4,5,9]);
  for(const entry of EXTERIOR_SCENE_CATALOG){
    const url=new URL(exteriorSceneURL(entry),'https://example.test/3D/');
    assert.equal(url.pathname,'/3D/ship-exterior-cinema.html');assert.equal(url.searchParams.get('paused'),'1');
    const options=Object.fromEntries(url.searchParams);options.opening=options.mode==='opening';
    assert.equal(sampleExteriorCinema(Number(options.time),options).number,entry.number,entry.id);
    if(entry.status.includes('保存版'))assert.ok([CAMERA_REVISION,PREVIOUS_CAMERA_REVISION,LOW_CAMERA_REVISION,FAST_CAMERA_REVISION,FULL_CAMERA_REVISION,LEVEL_CAMERA_REVISION,ENTRY_CAMERA_REVISION,BEFORE_EXIT_REVISION].includes(options.revision),entry.id);
    const play=new URL(exteriorSceneURL(entry,{time:entry.start,paused:false}),url);
    assert.equal(play.searchParams.has('paused'),false);assert.equal(Number(play.searchParams.get('time')),entry.start);
  }
});
test('current camera takes preserve docking and B flight in scene-local time after trimming 01',()=>{
  const options={opening:true,approach:'bow',ending:'underside'},saved={...options,revision:CAMERA_REVISION};
  const right=sampleExteriorCinema(63.55+filmDelay-dockingExtension,options),left=sampleExteriorCinema(64.8,saved);
  assert.ok(right.eye[0]>right.target[0]);assert.ok(left.eye[0]<left.target[0]);
  for(const key of ['position','rotation'])right.probe[key].forEach((value,i)=>assert.ok(Math.abs(value-left.probe[key][i])<1e-10));
  assert.equal(right.probe.latched,left.probe.latched);assert.equal(right.probe.visible,left.probe.visible);
  assert.ok(Math.abs(right.probe.thrusterClock.seconds-left.probe.thrusterClock.seconds)<1e-10);
  assert.ok(right.fov>left.fov,'07 extends its zoom through the earlier cut');
  const relative=(vector,origin)=>vector.map((v,i)=>v-(i===0?origin:0));
  relative(right.target,right.shipX).forEach((value,i)=>assert.ok(Math.abs(value-relative(left.target,left.shipX)[i]+(i===1?.4:0))<1e-10));

  const approved=EXTERIOR_SCENE_CATALOG.find(entry=>entry.id==='07-docking-probe-follow');
  assert.equal(approved.status,'採用・現行');assert.deepEqual(approved.options,{approach:'bow',ending:'underside',docking:'probe-follow'});
  for(const entry of EXTERIOR_SCENE_CATALOG.filter(entry=>entry.status.startsWith('採用')))
    assert.deepEqual(entry.options,approved.options,'all adopted scene links play the same approved film');
  const docked=sampleExteriorCinemaFrame(approved.start,{...approved.options,opening:true});
  assert.equal(docked.from.number,3);assert.equal(docked.to.mode,'probe-follow');assert.equal(docked.mix,.5);assert.equal(docked.to.habitatsVisible,true);
  const start=77.5+filmDelay,full={...options,revision:FULL_CAMERA_REVISION};
  for(const offset of [0,4,8.25,21.25,71.25,221.25]){
    const current=sampleExteriorCinema(start+offset,options),before=sampleExteriorCinema(start-filmDelay+offset+4.5,full);
    for(const key of ['shipSpeed','fov','probe'])assert.deepEqual(current[key],before[key]);
    assertTranslated(current.target,before.target);
    assert.ok(Math.abs(current.shipX-before.shipX-archiveTravelGain)<1e-8);
    assert.ok(Math.abs(current.eye[0]-before.eye[0]-archiveTravelGain)<1e-8);assert.equal(current.eye[2],before.eye[2]);
    if(offset<=3.5)assertTranslated(current.eye,before.eye);else assert.ok(current.eye[1]<before.eye[1]);
  }
  assert.equal(exteriorCinemaShots(options).at(-1).speed,2.1);
  assert.equal(sampleExteriorCinema(100,{opening:true,penultimate:'underside'}).number,9);
});

test('the immediate prior camera take keeps its 35s edit and constant B speed without the upward framing',()=>{
  const source=readFileSync(new URL('../src/obs/exterior-cinematic-20261013-r2.js',import.meta.url));
  assert.equal(createHash('sha256').update(source).digest('hex'),'f170076cf591e2d77b8903a6b538c97d6d8be54aa62c706577d7a9ee831d1f88');
  const options={opening:true,approach:'bow',ending:'underside'},revised={...options,revision:PREVIOUS_CAMERA_REVISION};
  for(const time of [0,15,35,35.75,51.75,62.55,76.5,80.5,84.5,120,300]){
    assert.deepEqual(sampleExteriorCinema(time,revised),previousCinema(time,options));
    assert.deepEqual(sampleExteriorCinemaFrame(time,revised),previousFrame(time,options));
  }
  assert.equal(sampleExteriorCinema(100,revised).shipSpeed,2.1);
});

test('the before-rise take remains immutable and keeps the low observer after the slide',()=>{
  const source=readFileSync(new URL('../src/obs/exterior-cinematic-20261013-r3.js',import.meta.url));
  assert.equal(createHash('sha256').update(source).digest('hex'),'44b99373dad99a7459b89a69a060b37864b05c3ebeaf8bf86c7cf68784771e3f');
  const options={opening:true,approach:'bow',ending:'underside',revision:LOW_CAMERA_REVISION};
  assert.equal(exteriorCinemaShots(options)[0].duration,36.75);
  const a=sampleExteriorCinema(85.5,options),b=sampleExteriorCinema(120,options);
  assert.deepEqual(a.eye,b.eye);assert.equal(b.eye[1],-52);assert.ok(Math.abs(b.shipSpeed-7.95)<1e-9);
  assert.equal(sampleExteriorCinemaFrame(36.75,options).mix,.5);
});

test('05 reduces flight by five percent while retaining the exact camera path and edit times',()=>{
  const source=readFileSync(new URL('../src/obs/exterior-cinematic-20261013-r4.js',import.meta.url));
  assert.equal(createHash('sha256').update(source).digest('hex'),'5133a6cb5809bb805513474642c2580a814c4e1796c81a884cf57dc34b0f69cc');
  const options={opening:true,approach:'bow',ending:'underside',revision:FULL_CAMERA_REVISION},saved={...options,revision:FAST_CAMERA_REVISION};
  const start=77.5,origin=sampleExteriorCinema(start,options).shipX;
  for(const offset of [0,1,4,7,8,16,24,100]){
    const a=sampleExteriorCinema(start+offset,options),b=sampleExteriorCinema(start+offset,saved);
    assert.deepEqual(a.eye,b.eye);assert.equal(a.fov,b.fov);assert.equal(a.start,b.start);assert.equal(a.end,b.end);
    assert.ok(Math.abs(a.shipSpeed-b.shipSpeed*.95)<1e-10);
    assert.ok(Math.abs((a.shipX-origin)-(b.shipX-origin)*.95)<1e-9);
  }
  assert.deepEqual(sampleExteriorCinema(40,options),sampleExteriorCinema(40,saved));
});

test('05 starts at the approved 79.5s angle, preserves the edit and the shared rotation clock',()=>{
  const source=readFileSync(new URL('../src/obs/exterior-cinematic-20261013-r5.js',import.meta.url));
  assert.equal(createHash('sha256').update(source).digest('hex'),'e5bc697f00ad128f687a6873b96308f80ec5962b4c2d6b5625449ceb695f7bab');
  const options={opening:true,approach:'bow',ending:'underside',revision:ENTRY_CAMERA_REVISION},before={...options,revision:FULL_CAMERA_REVISION};
  const frame=sampleExteriorCinemaFrame(77.5,options),old=sampleExteriorCinema(79.5,before);
  assert.equal(frame.from.number,4);assert.equal(frame.to.number,5);assert.equal(frame.mix,.5);
  for(const key of ['eye','target','shipX','shipSpeed','fov'])assert.deepEqual(frame.to[key],old[key]);
  assert.equal(frame.from.angle,frame.to.angle);
  assert.equal(exteriorCinemaShots(options)[0].duration,36.75);
});

test('05 settles below the hull without changing its start framing, speed or lens response settings',()=>{
  const source=readFileSync(new URL('../src/obs/exterior-cinematic-20261013-r6.js',import.meta.url));
  assert.equal(createHash('sha256').update(source).digest('hex'),'1dc1dab84c112c99936f0f609a3fed7e46d26d25fc240a6f669c0f13f3f6d682');
  const options={opening:true,approach:'bow',ending:'underside',revision:ENTRY_CAMERA_REVISION},before={...options,revision:LEVEL_CAMERA_REVISION};
  for(const time of [77.5,80,83.5,90,99.5,115]){
    const a=sampleExteriorCinema(time,options),b=sampleExteriorCinema(time,before);
    for(const key of ['shipX','shipSpeed','target','fov','optics','start','end'])assert.deepEqual(a[key],b[key]);
    if(time<=83.5)assert.deepEqual(a.eye,b.eye);
    else assert.ok(a.eye[1]<b.eye[1]);
  }
  const stop=sampleExteriorCinema(99.5,options);assert.equal(stop.eye[1],-26);assert.equal(stop.target[1],0);
});

test('05 enters at the previous 80s camera angle while keeping the film edit and flight path',()=>{
  const source=readFileSync(new URL('../src/obs/exterior-cinematic-20261013-r7.js',import.meta.url));
  assert.equal(createHash('sha256').update(source).digest('hex'),'0d771d776e1f872b6e7f7c2f2b9bc09b2b38a32e3336e5b1d67b26969b69f06e');
  const options={opening:true,approach:'bow',ending:'underside'},saved={...options,revision:ENTRY_CAMERA_REVISION};
  const start=77.5+filmDelay;
  for(const offset of [0,1,3.5,11.5,19.5,50]){
    const a=sampleExteriorCinema(start+offset,options),b=sampleExteriorCinema(80+offset,saved);
    for(const key of ['shipSpeed','fov','probe'])assert.deepEqual(a[key],b[key]);
    assert.deepEqual(a.optics,{...b.optics,streakRatio:1.3});
    const u=Math.max(0,Math.min(1,(offset-3.5)/16)),rise=u*u*(3-2*u);
    assertTranslated(a.eye.map((value,i)=>value-(i===1?1.3*rise:0)),b.eye);assertTranslated(a.target,b.target);
    assert.ok(Math.abs(a.shipX-b.shipX-archiveTravelGain)<1e-8);
    assert.equal(a.start,start);
  }
  const a=sampleExteriorCinema(75+filmDelay,options),b=sampleExteriorCinema(75,saved);
  for(const key of ['fov','probe'])assert.deepEqual(a[key],b[key]);
  // The 0.75s transferred from docking to 04 moves its midpoint anchor by 0.75m.
  assertTranslated(a.eye,b.eye,archiveTravelGain-.75);assertTranslated(a.target,b.target,archiveTravelGain-.75);
  const frame=sampleExteriorCinemaFrame(start,options);
  assert.equal(frame.shot.number,5);assert.equal(frame.mix,0);assert.equal(frame.to,null);
  assert.equal(sampleExteriorCinemaFrame(currentShots[0].duration,options).mix,.5);
});

test('the before-exit timing remains available as an immutable comparison',()=>{
  const source=readFileSync(new URL('../src/obs/exterior-cinematic-20261014-r8.js',import.meta.url));
  assert.equal(createHash('sha256').update(source).digest('hex'),'b126cb21365e709db5b0e4d21ef0b3ea8ef5657f592a1a1ae19a98d3fb385e16');
  const options={opening:true,approach:'bow',ending:'underside',revision:BEFORE_EXIT_REVISION};
  assert.equal(exteriorCinemaShots(options)[0].duration,36.75);
  assert.equal(sampleExteriorCinemaFrame(36.75,options).mix,.5);
  assert.equal(sampleExteriorCinema(67,options).number,4);
  assert.equal(sampleExteriorCinema(77.5,options).number,5);
});
