import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {BufferGeometryLoader} from 'three';
import {trimSuppliedNape} from '../src/obs/supplied-hair.js';

test('nape trim removes flared lower corners without changing upper hair',async()=>{
  const source=new BufferGeometryLoader().parse(JSON.parse(await readFile(new URL('../public/assets/obs/head/supplied-hair/hair-solid.json',import.meta.url),'utf8')));
  const before=source.attributes.position.array.slice(),trimmed=trimSuppliedNape(source),p=trimmed.attributes.position;
  assert.deepEqual(source.attributes.position.array,before,'original lightweight asset stays intact');
  assert.ok(trimmed.index.count<source.index.count*1.02,'boundary cuts stay within the lightweight triangle budget');
  const points=new Set();
  for(let i=0;i<p.count;i++){
    assert.ok(Number.isFinite(p.getX(i)+p.getY(i)+p.getZ(i)));
    if(Math.abs(p.getX(i)+.11)>1.21)assert.ok(p.getY(i)>.69,'outer nape has no low flared tips');
    points.add([p.getX(i),p.getY(i),p.getZ(i)].join(','));
  }
  const original=source.attributes.position;
  for(let i=0;i<original.count;i++)if(original.getY(i)>1)assert.ok(points.has([original.getX(i),original.getY(i),original.getZ(i)].join(',')),'upper hairstyle is preserved');
  source.dispose();trimmed.dispose();
});

test('supplied hair retains UVs and finite indexed geometry fitted to Milo',async()=>{
  for(const name of ['hair','hair-lite','hair-solid','scalp']){
    const asset=new URL(`../public/assets/obs/head/supplied-hair/${name}.json`,import.meta.url);
    const geometry=new BufferGeometryLoader().parse(JSON.parse(await readFile(asset,'utf8')));
    const {position,normal,uv}=geometry.attributes;
    assert.ok(geometry.index.count>3000);
    assert.equal(position.count,normal.count);assert.equal(position.count,uv.count);
    for(const attribute of [position,normal,uv])assert.ok(attribute.array.every(Number.isFinite));
    for(const index of geometry.index.array)assert.ok(index<position.count);
    geometry.computeBoundingBox();const box=geometry.boundingBox;
    assert.ok(box.min.x>-2.5&&box.max.x<2.5,'hair fits skull width');
    assert.ok(box.min.y>-.7&&box.max.y<5,'asset is in head-local units, not source centimetres');
    assert.ok(box.max.y>3.5,'crown covers the scanned skull');
    assert.ok(box.min.z>-3&&box.max.z<3,'asset fits skull depth');
    geometry.dispose();
  }
});

test('lightweight hair halves triangles without losing the silhouette bounds',async()=>{
  const load=async name=>new BufferGeometryLoader().parse(JSON.parse(await readFile(new URL(`../public/assets/obs/head/supplied-hair/${name}.json`,import.meta.url),'utf8')));
  const original=await load('hair'),lite=await load('hair-lite');
  assert.equal(lite.index.count,original.index.count/2);
  assert.ok(lite.attributes.position.count<original.attributes.position.count*.65);
  original.computeBoundingBox();lite.computeBoundingBox();
  for(const end of ['min','max'])for(const axis of ['x','y','z'])assert.ok(Math.abs(original.boundingBox[end][axis]-lite.boundingBox[end][axis])<.06,'outer silhouette remains within 3.3mm');
  // The supplied atlas intentionally contains small out-of-range border UVs.
  const originalUV=original.attributes.uv.array;
  const minUV=originalUV.reduce((a,b)=>Math.min(a,b),Infinity),maxUV=originalUV.reduce((a,b)=>Math.max(a,b),-Infinity);
  for(const uv of lite.attributes.uv.array)assert.ok(uv>=minUV-1e-5&&uv<=maxUV+1e-5);
  original.dispose();lite.dispose();
});
