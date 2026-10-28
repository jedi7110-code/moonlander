import test from 'node:test';
import assert from 'node:assert/strict';
import {BoxGeometry,DoubleSide,Group,Mesh,MeshStandardMaterial,Plane,Scene,Vector3} from 'three';
import {createGroupShadowProxySteps} from '../src/obs/group-shadow-proxy.js';
import {finishPreparationSteps} from '../src/obs/background-preparation.js';

function fixture(){
  const scene=new Scene(),animated=new Group(),group=new Group();group.name='Wall rack';
  group.position.set(1.5,.7,-2);group.rotation.y=.4;animated.add(group);scene.add(animated);
  const opaque=new MeshStandardMaterial(),geometry=new BoxGeometry(.2,.1,.05);
  const caster=(parent,material,name,x)=>{const mesh=new Mesh(geometry,material);mesh.name=name;mesh.castShadow=true;mesh.position.x=x;parent.add(mesh);return mesh;};
  const shelf=caster(group,opaque,'Shelf',0);
  const hinge=new Group();hinge.position.set(.3,.2,0);hinge.rotation.z=.3;group.add(hinge);
  const door=caster(hinge,opaque,'Door',.1);
  const strip=caster(group,opaque,'Strip',-.3);strip.geometry=geometry.toNonIndexed();strip.rotation.x=.5;
  const leaf=caster(group,new MeshStandardMaterial({side:DoubleSide}),'Leaf',.5);
  const pane=caster(group,new MeshStandardMaterial({transparent:true}),'Pane',.7);
  const clipped=caster(group,new MeshStandardMaterial({clippingPlanes:[new Plane()]}),'Clipped',.9);
  const quiet=caster(group,opaque,'Quiet',1.1);quiet.castShadow=false;
  const solo=new Group();solo.name='Solo';animated.add(solo);caster(solo,opaque,'Only',0);
  return {scene,animated,group,hinge,shelf,door,strip,leaf,pane,clipped,quiet,solo,opaque};
}
const worldPoints=mesh=>{
  const points=[],p=new Vector3(),{position}=mesh.geometry.attributes;
  mesh.updateWorldMatrix(true,false);
  for(let i=0;i<position.count;i++)points.push(p.fromBufferAttribute(position,i).applyMatrix4(mesh.matrixWorld).toArray());
  return points;
};
const indexRange=(proxy,part)=>{const first=part.indices[0];let lo=Infinity,hi=-Infinity;for(const i of part.indices){lo=Math.min(lo,i);hi=Math.max(hi,i);}return [lo,hi,first];};
const activeIndices=proxy=>Array.from(proxy.index.subarray(0,proxy.activeCount));

test('rigid casters merge into one position-only proxy per group that reproduces their world surfaces',()=>{
  const f=fixture();
  const proxies=finishPreparationSteps(createGroupShadowProxySteps(f.animated));
  assert.equal(proxies.proxies.length,1,'only the rack has two or more front-side casters');
  const [proxy]=proxies.proxies;
  assert.equal(proxy.group,f.group);assert.equal(proxy.mesh.parent,f.group);
  assert.deepEqual(proxy.parts.map(part=>part.mesh.name),['Shelf','Door','Strip']);
  for(const mesh of [f.shelf,f.door,f.strip])assert.equal(mesh.castShadow,false);
  for(const mesh of [f.leaf,f.pane,f.clipped])assert.equal(mesh.castShadow,true,`${mesh.name} keeps its own shadow`);
  assert.equal(f.quiet.castShadow,false);assert.equal(f.solo.children.length,1,'single casters get no proxy');
  const merged=worldPoints(proxy.mesh);let offset=0;
  for(const part of proxy.parts){
    const expected=worldPoints(part.mesh);
    for(const [i,point] of expected.entries())for(let k=0;k<3;k++)assert.ok(Math.abs(point[k]-merged[offset+i][k])<1e-6,`${part.mesh.name} vertex ${i}`);
    offset+=expected.length;
  }
  const triangles=proxy.parts.reduce((n,{mesh:{geometry}})=>n+(geometry.index?geometry.index.count:geometry.attributes.position.count)/3,0);
  assert.equal(proxy.activeCount/3,triangles);
  assert.equal(proxy.mesh.geometry.drawRange.count,proxy.activeCount);
  proxy.mesh.onBeforeRender();assert.equal(proxy.mesh.geometry.drawRange.count,0,'the main pass draws nothing');
  proxy.mesh.onAfterRender();assert.equal(proxy.mesh.geometry.drawRange.count,proxy.activeCount,'the next shadow pass draws every active part');
  assert.ok(proxy.mesh.material.userData.cabinAlwaysPowered&&proxy.mesh.material.userData.cabinNoOutline);
  assert.equal(proxy.mesh.raycast(),undefined);
});

test('a part that moves, hides or changes material leaves the proxy before the shadow pass and returns when it is rigid again',()=>{
  const f=fixture();
  const proxies=finishPreparationSteps(createGroupShadowProxySteps(f.animated));
  const [proxy]=proxies.proxies,[shelf,door,strip]=proxy.parts,full=proxy.activeCount;
  f.group.position.x+=2;f.group.rotation.y-=.7;f.scene.updateMatrixWorld();proxies.update();
  assert.equal(proxy.activeCount,full,'moving the whole group keeps every part');
  f.hinge.rotation.z+=.5;f.scene.updateMatrixWorld();proxies.update();
  assert.equal(door.active,false);assert.equal(f.door.castShadow,true);
  assert.equal(proxy.activeCount,full-door.indices.length);
  const [lo,hi]=indexRange(proxy,door);
  assert.ok(activeIndices(proxy).every(i=>i<lo||i>hi),'the open door is no longer in the merged index');
  f.hinge.rotation.z-=.5;f.scene.updateMatrixWorld();proxies.update();
  assert.equal(door.active,true);assert.equal(f.door.castShadow,false);assert.equal(proxy.activeCount,full);
  f.strip.visible=false;proxies.update();
  assert.equal(strip.active,false);assert.equal(f.strip.castShadow,true);
  f.strip.visible=true;proxies.update();assert.equal(strip.active,true);assert.equal(f.strip.castShadow,false);
  f.shelf.material=new MeshStandardMaterial({transparent:true});proxies.update();
  assert.equal(shelf.active,false,'a transparent material needs its own shadow path');
  const replacement=new MeshStandardMaterial();f.shelf.material=replacement;proxies.update();
  assert.equal(shelf.active,true);assert.equal(shelf.material,replacement);
  assert.equal(proxy.activeCount,full);assert.deepEqual(proxies.report(),[]);
  f.door.geometry.attributes.position.needsUpdate=true;proxies.update();
  assert.equal(door.active,false,'rewritten vertices leave the baked copy');
  f.door.geometry=f.shelf.geometry;proxies.update();assert.equal(door.active,false,'a replaced geometry stays out');
});

test('parts that keep flipping or whose caster flag is set by other code retire to their own shadows',()=>{
  const f=fixture();
  const proxies=finishPreparationSteps(createGroupShadowProxySteps(f.animated));
  const [proxy]=proxies.proxies,shelf=proxy.parts[0],door=proxy.parts[1],full=proxy.activeCount;
  for(let i=0;i<5;i++){f.hinge.rotation.z+=.3;f.scene.updateMatrixWorld();proxies.update();f.hinge.rotation.z-=.3;f.scene.updateMatrixWorld();proxies.update();}
  assert.equal(door.retired,true);assert.equal(door.active,false);assert.equal(f.door.castShadow,true);
  f.scene.updateMatrixWorld();proxies.update();assert.equal(door.active,false,'a retired part never rejoins');
  f.shelf.castShadow=true;proxies.update();
  assert.equal(shelf.retired,true);assert.equal(shelf.active,false);assert.equal(f.shelf.castShadow,true);
  assert.equal(proxy.activeCount,full-door.indices.length-shelf.indices.length);
  assert.deepEqual(proxies.report().map(({group,mesh,retired})=>[group,mesh,retired]),[['Wall rack','Shelf',true],['Wall rack','Door',true]]);
  proxies.dispose();
  assert.equal(f.strip.castShadow,true,'dispose hands the shadows back');assert.equal(proxy.mesh.parent,null);
});
