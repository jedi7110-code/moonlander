import test from 'node:test';
import assert from 'node:assert/strict';
import {BufferGeometry,Float32BufferAttribute,Box3,Mesh,MeshBasicMaterial,DoubleSide,Raycaster,Vector3} from 'three';
import {triangleSubset} from '../src/obs/triangle-subset.js';

const seeded=seed=>()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
function soup(random,triangles,indexed){
  const positions=[],indices=[];
  for(let i=0;i<triangles*3;i++)positions.push(random()*2-1,random()*2-1,random()*2-1);
  const geometry=new BufferGeometry();geometry.setAttribute('position',new Float32BufferAttribute(positions,3));
  if(indexed){for(let i=triangles*3-1;i>=0;i--)indices.push(i);geometry.setIndex(indices);}
  return geometry;
}
const hits=(geometry,rays)=>{
  const mesh=new Mesh(geometry,new MeshBasicMaterial({side:DoubleSide}));mesh.updateMatrixWorld();
  const ray=new Raycaster();
  return rays.map(([x,y])=>{ray.set(new Vector3(x,y,4),new Vector3(0,0,-1));const hit=ray.intersectObject(mesh)[0];return hit?[hit.point.x,hit.point.y,hit.point.z,hit.distance,hit.face.a,hit.face.b,hit.face.c]:null;});
};
for(const indexed of [false,true])test(`a footprint subset returns the same nearest hits as the full ${indexed?'indexed':'non-indexed'} surface`,()=>{
  const random=seeded(indexed?7:11),geometry=soup(random,600,indexed);
  const box=new Box3(new Vector3(-.2,-.15,-Infinity),new Vector3(.1,.25,Infinity));
  const rays=Array.from({length:300},()=>[box.min.x+random()*(box.max.x-box.min.x),box.min.y+random()*(box.max.y-box.min.y)]);
  const subset=triangleSubset(geometry,box);
  assert.ok(subset.index.count<(geometry.index?.count??geometry.attributes.position.count),'the subset is smaller than the surface');
  assert.equal(subset.attributes.position,geometry.attributes.position,'positions are shared, not copied');
  const full=hits(geometry,rays),reduced=hits(subset,rays);
  assert.ok(full.filter(Boolean).length>50,'enough rays hit the surface for the comparison to mean something');
  assert.deepEqual(reduced,full);
});
test('an explicit triangle list restricts the subset to those triangles, in order',()=>{
  const geometry=soup(seeded(3),50,false),chosen=[9,10,11,0,1,2,30,31,32];
  const subset=triangleSubset(geometry,new Box3(new Vector3(-Infinity,-Infinity,-Infinity),new Vector3(Infinity,Infinity,Infinity)),chosen);
  assert.deepEqual(Array.from(subset.index.array),chosen);
});
