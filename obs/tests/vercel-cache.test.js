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
    '/obs/assets/obs-CDqZyxBf.js',
    '/obs/assets/milo-body--ujSeFPX.js',
    '/obs/assets/three-D_l1qIn7.js',
    '/obs/assets/hatchRepairStudy-C1brO8-7.css',
    '/obs/assets/obs-CDqZyxBf.js?v=2',
  ])assert.ok(cached(path),path);
});

test('immutable cache excludes fixed names, other assets and other directories',()=>{
  for(const path of [
    '/obs/assets/config.js',
    '/obs/assets/config.js?v=CDqZyxBf',
    '/obs/assets/style.css',
    '/obs/assets/service-worker.js',
    '/obs/assets/obs-CDqZyxB.js',
    '/obs/assets/obs-CDqZyxBf0.js',
    '/obs/assets/obs-CDqZyxBfXjs',
    '/obs/assets/obs-CDqZyxBf.js.map',
    '/obs/assets/obs-CDqZyxBf.webp',
    '/obs/assets/obs-CDqZyxBf.glb',
    '/obs/assets/nested/config.js',
    '/obs/assets/nested/obs-CDqZyxBf.js',
    '/assets/obs-CDqZyxBf.js',
    '/obs/obs.html',
  ])assert.equal(cached(path),false,path);
});

test('every shipped JS and CSS bundle retains the long-lived cache',()=>{
  const files=fs.readdirSync(new URL('../dist/assets/',import.meta.url)).filter(name=>/\.(js|css)$/.test(name));
  assert.ok(files.length>0,'build output must be present');
  for(const name of files)assert.ok(cached(`/obs/assets/${name}`),name);
});

test('public JS and CSS files cannot accidentally inherit the immutable policy',()=>{
  const files=fs.readdirSync(new URL('../public/assets/',import.meta.url),{recursive:true});
  for(const name of files.filter(name=>/\.(js|css)$/.test(name))){
    assert.equal(cached(`/obs/assets/${name}`),false,`${name}: reserve hashed names for generated bundles`);
  }
});

test('the retired /3D/ prefix permanently redirects to /obs/ and nothing else is served under it',()=>{
  assert.deepEqual(config.redirects,[
    {source:'/3D',destination:'/obs/',permanent:true},
    {source:'/3D/:path*',destination:'/obs/:path*',permanent:true},
  ]);
  for(const rule of [...config.rewrites,...config.headers]){
    assert.ok(rule.source.startsWith('/obs'),rule.source);
    if(rule.destination)assert.ok(rule.destination.startsWith('/obs/dist/'),rule.destination);
  }
});
