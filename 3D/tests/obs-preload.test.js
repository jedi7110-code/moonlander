import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {LUCY_ASSET_VERSION} from '../src/obs/lucy-cabin.js';

const html=fs.readFileSync(new URL('../src/obs.html',import.meta.url),'utf8');
const preloads=[...html.matchAll(/<link rel="preload" href="([^"]+)" as="(fetch|image)" crossorigin/g)].map(m=>({href:m[1],as:m[2]}));

test('every preloaded cabin asset exists and carries the current Lucy version',()=>{
  assert.ok(preloads.length>=20);
  for(const {href,as} of preloads){
    const [path,query]=href.split('?');
    assert.ok(fs.existsSync(new URL('../public'+path,import.meta.url)),`${path} is missing from public/`);
    if(path.includes('/lucy/'))assert.equal(query,`v=${LUCY_ASSET_VERSION}`,`${path} must use the version the loader requests`);
    else assert.equal(query,undefined);
    assert.equal(as,/\.(glb|json|bin)$/.test(path)?'fetch':'image');
  }
});
