import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {EXTERIOR_SCENE_CATALOG,exteriorSceneURL,CAMERA_REVISION} from '../src/obs/exterior-scene-catalog.js';
import {sampleExteriorCinema,sampleExteriorCinemaFrame,exteriorCinemaShots} from '../src/obs/exterior-cinematic.js';
import {sampleExteriorCinema as savedCinema,sampleExteriorCinemaFrame as savedFrame} from '../src/obs/exterior-cinematic-20261013-r1.js';

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
    if(entry.status.includes('保存版'))assert.equal(options.revision,CAMERA_REVISION,entry.id);
    const play=new URL(exteriorSceneURL(entry,{time:entry.start,paused:false}),url);
    assert.equal(play.searchParams.has('paused'),false);assert.equal(Number(play.searchParams.get('time')),entry.start);
  }
});
test('the current B ending is five percent faster and scene 07 adopts right-below, while other earlier scenes and saved takes stay unchanged',()=>{
  const options={opening:true,approach:'bow',ending:'underside'},saved={...options,revision:CAMERA_REVISION};
  for(const time of [0,15,43,54,73.75,77.5])assert.deepEqual(sampleExteriorCinemaFrame(time,options),sampleExteriorCinemaFrame(time,saved));
  const right=sampleExteriorCinema(64.8,options),left=sampleExteriorCinema(64.8,saved);
  assert.ok(right.eye[0]>right.target[0]);assert.ok(left.eye[0]<left.target[0]);
  for(const key of ['probe','shipX','angle','target','fov','start','end'])assert.deepEqual(right[key],left[key]);
  const approved=EXTERIOR_SCENE_CATALOG.find(entry=>entry.id==='07-docking-right');
  assert.equal(approved.status,'採用・現行');assert.deepEqual(approved.options,{});
  const start=78.75;
  for(const time of [start,82.75,87,100,150,300]){
    const current=sampleExteriorCinema(time,options),before=sampleExteriorCinema(time,saved);
    assert.equal(before.shipSpeed,2);assert.equal(current.shipSpeed,2.1);
    assert.deepEqual(current.eye,before.eye);assert.equal(current.fov,before.fov);assert.deepEqual(current.probe,before.probe);
    assert.ok(Math.abs(current.shipX-before.shipX-(time-start)*.1)<1e-9);
  }
  assert.equal(exteriorCinemaShots(options).at(-1).speed,2.1);
  assert.equal(sampleExteriorCinema(100,{opening:true,penultimate:'underside'}).number,9);
});
