import test from 'node:test';
import assert from 'node:assert/strict';
import {Box3,Raycaster,Vector3,MeshStandardMaterial} from 'three';
import {readFileSync} from 'node:fs';
import {createGalley,GALLEY} from '../src/obs/galley.js';
import {batchStatic} from '../src/obs/materials.js';
import {coplanarSurfaces} from './helpers/coplanar-surfaces.js';
import {createDiningStation} from '../src/obs/ship.js';

function fixture(){const root=createGalley();root.position.x=0;root.updateMatrixWorld(true);return root;}
function down(root,x,z,fromY=1.18){return new Raycaster(new Vector3(x,fromY,z),new Vector3(0,-1,0)).intersectObject(root,true);}

test('galley sink has a real unobstructed opening, sloping inner walls and a recessed floor',()=>{
  const root=fixture(),s=GALLEY.sink;
  for(const dx of [-.24,0,.24])for(const dz of [-.15,0,.15]){
    const hits=down(root,s.x+dx,s.z+dz);
    assert.ok(hits.length);
    assert.ok(hits[0].point.y<.85,'the counter, cabinet and rim do not fill the sink');
    assert.equal(hits[0].object.name,'Galley / sink floor');
  }
  // Normal orientation must face into the basin, not disappear when viewed inside.
  for(const [dx,dz]of [[.39,0],[-.39,0],[0,.26],[0,-.26]]){
    const hit=down(root,s.x+dx,s.z+dz)[0];
    assert.equal(hit.object.name,'Galley / open tapered sink walls');
    assert.ok(hit.point.y>.90&&hit.point.y<1.04);
  }
  assert.ok(root.getObjectByName('Galley / drain strainer'));
  assert.ok(GALLEY.top-s.bottom>.24,'a useful basin, not a flat dark rectangle');
});

test('sink rim seals the real counter cutout and the faucet points into the basin',()=>{
  const root=fixture(),s=GALLEY.sink;
  for(const [dx,dz]of [[s.width/2+.014,0],[-s.width/2-.014,0],[0,s.depth/2+.014],[0,-s.depth/2-.014]]){
    const hits=down(root,s.x+dx,s.z+dz);
    assert.equal(hits[0].object.name,'Galley / rolled sink rim');
  }
  const outlet=new Box3().setFromObject(root.getObjectByName('Galley / faucet outlet')).getCenter(new Vector3());
  assert.ok(Math.abs(outlet.x-s.x)<s.width/2);
  assert.ok(Math.abs(outlet.z-s.z)<s.depth/2);
  assert.ok(outlet.y>GALLEY.top+.20);
});

test('galley fits the existing kitchen envelope and retains the cooking contact positions',()=>{
  const root=createGalley(),bounds=new Box3().setFromObject(root);
  assert.ok(Math.abs(bounds.min.x-(-11.58))<1e-5);
  assert.ok(Math.abs(bounds.max.x-(-8.52))<1e-5);
  assert.ok(bounds.min.y>=0&&bounds.max.y<3.0);
  assert.ok(bounds.max.z<.25&&bounds.min.z>-1.2,'does not grow into the walking aisle or wall');
  const pot=root.userData.pot.getWorldPosition(new Vector3());
  assert.ok(pot.distanceTo(new Vector3(-10.56,1.075,-.17))<1e-9);
  assert.equal(root.userData.pot.visible,true);
  root.position.x=0;root.updateMatrixWorld(true);
  for(const [x,z]of [[.05,-.015],[.145,.10]]){
    const hit=down(root,x,z)[0];assert.equal(hit.object.name,'Galley / cutout stainless worktop');
    assert.ok(Math.abs(hit.point.y-GALLEY.top)<1e-6,'chopping and meal surface height stays unchanged');
  }
});

test('aircraft service hardware is low-poly, batched and non-dynamic',()=>{
  const root=fixture();let triangles=0,lights=0;
  root.traverse(o=>{if(o.isMesh)triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;if(o.isLight)lights++;});
  assert.ok(triangles<8000,`geometry budget: ${triangles}`);
  assert.equal(lights,0,'no added light or reflection render pass');
  const batch=batchStatic(root);assert.ok(batch.children.length<=9,'all detail shares a few static material batches');
  const meshCount=name=>{let count=0;root.traverse(o=>{if(o.name===name)count++;});return count;};
  assert.equal(meshCount('Galley / red rotary restraint'),14);
  assert.ok(meshCount('Galley / flush U handle')>=10);
  assert.ok(root.userData.materials.ink.polygonOffset,'small printing cannot fight with panel depth');
});

test('the approved study and OBS use the same fixture without duplicating the droid saucepan',()=>{
  const study=readFileSync(new URL('../src/galley-study.js',import.meta.url),'utf8');
  const production=readFileSync(new URL('../src/obs/ship.js',import.meta.url),'utf8');
  assert.match(study,/createGalley\(m\)/);assert.match(study,/sink:\{eye/);assert.match(study,/OBS共通モデル/);
  assert.match(production,/createGalley\(m,\{cookware:false\}\)/);
  const material=new MeshStandardMaterial(),m=new Proxy({},{get:()=>material});
  const station=createDiningStation(m,'galley'),galley=station.root.getObjectByName('Aircraft cabin galley');
  assert.ok(galley);assert.equal(galley.userData.pot,null);
  assert.equal(galley.getObjectByName('Galley / permanent saucepan'),undefined);
  assert.deepEqual(station.docks.bowl.position.toArray(),[station.stationX+.095,1.077,.10]);
  assert.deepEqual(station.docks.spoon.position.toArray(),[station.stationX-.17,1.039,.10]);
  const reference=createGalley(m,{cookware:false});
  assert.ok(new Box3().setFromObject(reference).equals(new Box3().setFromObject(galley)),'same dimensions and installation position');
  assert.doesNotMatch(study,/setAnimationLoop|setInterval/,'render only on camera and viewport changes');
});

test('galley panel seams, handles and trims have no coincident flickering faces',()=>{
  assert.deepEqual(coplanarSurfaces([fixture()]),[]);
});
