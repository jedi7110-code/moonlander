import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const config=JSON.parse(fs.readFileSync(new URL('../../vercel.json',import.meta.url),'utf8'));
const immutableRules=(config.headers??[]).filter(rule=>rule.headers.some(header=>
  header.key.toLowerCase()==='cache-control'&&header.value.split(',').some(value=>value.trim()==='immutable')));

// These sources use literal paths and regex groups only (no named Vercel
// parameters). Anchor the actual configuration, not a second copy of its regex.
function cached(path){
  const pathname=new URL(path,'https://example.test').pathname;
  return immutableRules.some(rule=>new RegExp(`^(?:${rule.source})$`).test(pathname));
}

test('immutable cache accepts Vite eight-character JS and CSS hashes',()=>{
  assert.equal(immutableRules.length,1);
  assert.equal(immutableRules[0].headers.find(header=>header.key.toLowerCase()==='cache-control').value,
    'public, max-age=31536000, immutable');
  for(const path of [
    '/3D/assets/obs-CDqZyxBf.js',
    '/3D/assets/milo-body--ujSeFPX.js',
    '/3D/assets/three-D_l1qIn7.js',
    '/3D/assets/hatchRepairStudy-C1brO8-7.css',
    '/3D/assets/obs-CDqZyxBf.js?v=2',
  ])assert.ok(cached(path),path);
});

test('immutable cache excludes fixed names, other assets and other directories',()=>{
  for(const path of [
    '/3D/assets/config.js',
    '/3D/assets/config.js?v=CDqZyxBf',
    '/3D/assets/style.css',
    '/3D/assets/service-worker.js',
    '/3D/assets/obs-CDqZyxB.js',
    '/3D/assets/obs-CDqZyxBf0.js',
    '/3D/assets/obs-CDqZyxBfXjs',
    '/3D/assets/obs-CDqZyxBf.js.map',
    '/3D/assets/obs-CDqZyxBf.webp',
    '/3D/assets/obs-CDqZyxBf.glb',
    '/3D/assets/nested/config.js',
    '/3D/assets/nested/obs-CDqZyxBf.js',
    '/assets/obs-CDqZyxBf.js',
    '/3D/obs.html',
  ])assert.equal(cached(path),false,path);
});

test('every shipped JS and CSS bundle retains the long-lived cache',()=>{
  const files=fs.readdirSync(new URL('../dist/assets/',import.meta.url)).filter(name=>/\.(js|css)$/.test(name));
  assert.ok(files.length>0,'build output must be present');
  for(const name of files)assert.ok(cached(`/3D/assets/${name}`),name);
});

test('public JS and CSS files cannot accidentally inherit the immutable policy',()=>{
  const files=fs.readdirSync(new URL('../public/assets/',import.meta.url),{recursive:true});
  for(const name of files.filter(name=>/\.(js|css)$/.test(name))){
    assert.equal(cached(`/3D/assets/${name}`),false,`${name}: reserve hashed names for generated bundles`);
  }
});
