import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {OPENING_CREDIT_ROLES,OPENING_CREDIT_NAME,sampleOpeningCredits} from '../src/obs/exterior-credits.js';
import {sampleExteriorCinema,OPENING_DURATION} from '../src/obs/exterior-cinematic.js';

const options={opening:true,ending:'underside',approach:'bow',docking:'probe-follow'};

test('opening staff roll retains every original moon credit in order',async()=>{
  const source=await readFile(new URL('../../js/preload.js',import.meta.url),'utf8');
  const credits=source.slice(source.indexOf('export function startCredits'));
  const english=credits.slice(credits.indexOf('        E: ['),credits.indexOf('        J: ['));
  const lines=[...english.matchAll(/'([^']*)'/g)].map(match=>match[1]);
  const names=lines.filter(line=>line.startsWith('> ............................ ')).map(line=>line.replace('> ............................ ',''));
  const roles=lines.filter((line,i)=>lines[i+1]?.startsWith('> ............................ ')).map(line=>line.slice(2));
  assert.equal(roles.length,25);assert.deepEqual(OPENING_CREDIT_ROLES,roles);
  assert.ok(names.every(name=>name===OPENING_CREDIT_NAME));
});

test('roll begins only after the final ascent settles, clears by the original film end and never loops',()=>{
  const begin=sampleOpeningCredits(98,options);
  assert.equal(begin.start,98);assert.equal(begin.end,OPENING_DURATION);assert.equal(begin.progress,0);assert.equal(begin.visible,true);
  assert.equal(sampleOpeningCredits(begin.start-.001,options).visible,false);
  assert.deepEqual(sampleExteriorCinema(92.15,options).eye,sampleExteriorCinema(begin.start,options).eye,'camera is already settled before the 98-second cue');
  assert.deepEqual(sampleExteriorCinema(begin.start,options).eye,sampleExteriorCinema(begin.start+2,options).eye);
  const middle=(begin.start+begin.end)/2;
  assert.ok(Math.abs(sampleOpeningCredits(middle,options).progress-.5)<1e-12);
  for(const time of [begin.end,begin.end+10,10000]){
    const sample=sampleOpeningCredits(time,options);assert.equal(sample.visible,false);assert.equal(sample.progress,1);
    assert.equal(sampleExteriorCinema(time,options).done,false,'ship keeps cruising after the roll');
  }
  const paused=sampleOpeningCredits(middle,options);
  sampleOpeningCredits(10000,options);
  assert.deepEqual(sampleOpeningCredits(middle,options),paused,'seeking restores the same roll position');
  assert.equal(sampleOpeningCredits(0,options).progress,0);
});

test('free views, other takes and historical cameras do not inherit opening credits',()=>{
  for(const other of [{},{opening:false,ending:'underside'},{opening:true},{...options,revision:'20261014-r8'}])
    assert.equal(sampleOpeningCredits(110,other).visible,false);
});
