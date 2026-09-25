import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {makeXRWideGeometry} from '../src/obs/xr-geometry.js';
import {ObservationXRQuality,XRCharacterPicker} from '../src/obs/xr-quality.js';
import {batchStatic} from '../src/obs/materials.js';
import {buildShip} from '../src/obs/ship.js';
import {limitCabinLights} from '../src/obs/lighting.js';

const triangles=g=>(g.index?.count??g.attributes.position.count)/3;
function withCanvas(fn){
  const previous=globalThis.document;
  const ctx=new Proxy({measureText:t=>({width:t.length*8}),createLinearGradient:()=>({addColorStop(){}})},{get:(o,k)=>k in o?o[k]:()=>{}});
  globalThis.document={createElement:()=>({getContext:()=>ctx})};
  try{return fn();}finally{if(previous===undefined)delete globalThis.document;else globalThis.document=previous;}
}

test('distant curved geometry preserves sampled positions, UVs and outward winding',()=>{
  const curve=new T.CatmullRomCurve3([new T.Vector3(-2,0,0),new T.Vector3(0,2,0),new T.Vector3(2,0,0)]);
  const sources=[new T.SphereGeometry(1,32,24),new T.TorusGeometry(1,.2,16,64),new T.TubeGeometry(curve,80,.1,16)];
  for(const source of sources){
    source.translate(.3,.4,.5);
    const reduced=makeXRWideGeometry(source);
    assert.ok(triangles(reduced)<triangles(source)*.3);
    const vertices=new Set(Array.from({length:source.attributes.position.count},(_,i)=>{
      const p=source.attributes.position,uv=source.attributes.uv;
      return [p.getX(i),p.getY(i),p.getZ(i),uv.getX(i),uv.getY(i)].join(',');
    }));
    for(let i=0;i<reduced.attributes.position.count;i++){
      const p=reduced.attributes.position,uv=reduced.attributes.uv;
      assert.ok(vertices.has([p.getX(i),p.getY(i),p.getZ(i),uv.getX(i),uv.getY(i)].join(',')));
    }
    for(let i=0;i<reduced.index.count;i+=3){
      const ids=[0,1,2].map(j=>reduced.index.getX(i+j));
      const [a,b,c]=ids.map(j=>new T.Vector3().fromBufferAttribute(reduced.attributes.position,j));
      const normal=ids.reduce((v,j)=>v.add(new T.Vector3().fromBufferAttribute(reduced.attributes.normal,j)),new T.Vector3());
      assert.ok(b.sub(a).cross(c.sub(a)).dot(normal)>-1e-6,source.type+' winding');
    }
    reduced.dispose();source.dispose();
  }
});

test('instanced VR fixtures follow parent motion and visibility without hiding mesh children or changing desktop layers',()=>{
  const scene=new T.Scene(),animated=new T.Group();scene.add(animated);
  const material=new T.MeshStandardMaterial(),geometry=new T.BoxGeometry(.2,.2,.2),sources=[];
  for(let i=0;i<3;i++){
    const parent=new T.Group();parent.position.set(i,2,0);animated.add(parent);
    const mesh=new T.Mesh(geometry,material);parent.add(mesh);sources.push(mesh);
  }
  const child=new T.Mesh(new T.BoxGeometry(.15,.15,.15),new T.MeshBasicMaterial());sources[0].add(child);
  const view={scene,ship:{animated},camera:new T.PerspectiveCamera(),renderer:{shadowMap:{enabled:true}}};
  const quality=new ObservationXRQuality(view);
  sources[1].parent.position.x=7;sources[2].parent.visible=false;
  quality.beginFrame('milo');
  const batch=quality.batches[0].mesh,matrix=new T.Matrix4();
  assert.equal(batch.count,2);batch.getMatrixAt(1,matrix);assert.equal(matrix.elements[12],7);
  assert.equal(sources[0].layers.mask,0);assert(sources[0].visible&&child.visible);
  assert.equal(child.layers.mask,1,'children still participate in scene traversal');
  quality.endFrame();assert(sources.every(s=>s.layers.mask===1));assert(!batch.visible);
  assert.equal(sources[2].parent.visible,false,'the routine still owns hidden objects');
  quality.dispose();assert.equal(scene.children.length,1);
  geometry.dispose();material.dispose();child.geometry.dispose();child.material.dispose();
});

test('static LOD retains large structures and signs, releases alternates with the original geometry',()=>{
  const root=new T.Group(),mat=new T.MeshStandardMaterial();
  const rounded=new T.Mesh(new RoundedBoxGeometry(2,1,1,2,.08),mat);root.add(rounded);
  const small=new T.Mesh(new T.SphereGeometry(.02),mat);root.add(small);
  const sign=new T.Mesh(new T.PlaneGeometry(.04,.04),new T.MeshBasicMaterial({name:'Sign: EXIT'}));root.add(sign);
  const result=batchStatic(root,{xrLOD:true});
  assert.equal(triangles(result.children[0].userData.xrWideGeometry),12);
  assert.equal(triangles(result.children[1].userData.xrWideGeometry),2);
  let disposed=0;for(const mesh of result.children){mesh.userData.xrWideGeometry.addEventListener('dispose',()=>disposed++);mesh.geometry.dispose();}
  assert.equal(disposed,2);root.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});
});

test('the full cabin reduces wide triangles, local lights and shadow passes and restores all state',()=>{
  const mats=new Map();
  const ship=withCanvas(()=>buildShip(new Proxy({},{get:(_,key)=>{
    if(!mats.has(key))mats.set(key,new T.MeshStandardMaterial({name:key}));return mats.get(key);
  }})));
  limitCabinLights(ship.animated);
  const scene=new T.Scene();scene.add(ship.staticMesh,ship.animated,new T.HemisphereLight(),new T.DirectionalLight());
  const view={ship,scene,camera:new T.PerspectiveCamera(),renderer:{shadowMap:{enabled:true}}},quality=new ObservationXRQuality(view);
  let before=0,after=0;
  ship.staticMesh.traverse(o=>{if(o.isMesh)before+=triangles(o.geometry);});
  const visibleBefore=[];scene.traverse(o=>visibleBefore.push([o,o.visible]));
  assert.equal(quality.lights.filter(l=>l.visible).length,16);
  quality.beginFrame('all');
  ship.staticMesh.traverseVisible(o=>{if(o.isMesh)after+=triangles(o.geometry);});
  assert.ok(after<before*.4,`${before} -> ${after}`);
  assert.equal(quality.lights.filter(l=>l.visible).length,0);
  assert.equal(view.renderer.shadowMap.enabled,false);
  assert.ok(quality.batches.reduce((n,b)=>n+b.mesh.count,0)>250,'batch repeated animated fixture meshes');
  quality.endFrame();
  assert.equal(view.renderer.shadowMap.enabled,true);
  assert.ok(visibleBefore.every(([o,visible])=>o.visible===visible));
  quality.beginFrame('milo');
  let close=0;ship.staticMesh.traverse(o=>{if(o.isMesh)close+=triangles(o.geometry);});
  assert.equal(close,before,'close view returns to full geometry even during VR');quality.endFrame();
  quality.dispose();assert.equal(scene.children.filter(o=>o.isInstancedMesh).length,0);
  const geometries=new Set(),materials=new Set();scene.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material)materials.add(o.material);});
  geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());
});

test('VR selection uses bounds, follows motion, ignores hidden characters, and still selects stations',()=>{
  const milo=new T.Group(),cat=new T.Group(),scene=new T.Scene();scene.add(milo,cat);
  const body=new T.Mesh(new T.BoxGeometry(1,2,1),new T.MeshBasicMaterial());body.position.y=1;milo.add(body);
  body.raycast=()=>{throw Error('must not raycast character triangles');};
  const station=new T.Mesh(new T.BoxGeometry(1,1,1),new T.MeshBasicMaterial());station.position.set(3,1,0);station.userData.station='medical';scene.add(station);
  const picker=new XRCharacterPicker({milo,cat,ship:{targets:[station]}});
  scene.updateMatrixWorld(true);picker.update();
  const ray=new T.Raycaster(new T.Vector3(0,1,5),new T.Vector3(0,0,-1),0,10);
  assert.equal(picker.pick(ray).id,'milo');
  milo.position.x=3;scene.updateMatrixWorld(true);picker.update();assert.equal(picker.pick(ray),null);
  ray.ray.origin.x=3;assert.equal(picker.pick(ray).id,'milo','character wins over equipment');
  milo.visible=false;picker.update();assert.equal(picker.pick(ray).id,'medical');
  ray.far=1;assert.equal(picker.pick(ray),null);
  body.geometry.dispose();body.material.dispose();station.geometry.dispose();station.material.dispose();
});
