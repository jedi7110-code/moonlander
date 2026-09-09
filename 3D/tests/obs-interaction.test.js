import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {ObservationView} from '../src/obs/view.js';
import {HABITAT_VIEW,FLOOR_Y,createLounge,createStationInteraction} from '../src/obs/ship.js';

test('the lounge target and frame follow the furniture instead of the crew destination',()=>{
  const material=new THREE.MeshBasicMaterial(),lounge=createLounge(new Proxy({},{get:()=>material}));
  lounge.position.y=FLOOR_Y[0];
  const furniture=new THREE.Box3().setFromObject(lounge),bounds=furniture.clone().expandByScalar(.06);
  const {mesh,group}=createStationInteraction('lounge',bounds,material);
  const view=Object.create(ObservationView.prototype),scene=new THREE.Scene();
  view.milo=new THREE.Group();view.cat=new THREE.Group();view.ship={targets:[mesh]};scene.add(mesh,group);scene.updateMatrixWorld(true);
  const hitBox=new THREE.Box3().setFromObject(mesh);
  assert.ok(hitBox.containsBox(furniture));assert.ok(Math.abs(mesh.position.x-7.405)<.001);
  assert.equal(group.position.x,mesh.position.x);assert.equal(group.position.y,bounds.min.y);
  assert.ok(bounds.max.y-FLOOR_Y[0]<1.4);
  assert.ok(Math.abs(group.children[0].scale.x-(bounds.max.x-bounds.min.x))<1e-7);
  view.camera=new THREE.OrthographicCamera(-6,6,3,-3,.1,50);view.camera.position.set(7.4,FLOOR_Y[0]+1,20);view.camera.updateMatrixWorld(true);
  view.raycaster=new THREE.Raycaster();view.pointer=new THREE.Vector2();view.canvas={getBoundingClientRect:()=>({left:0,top:0,width:1200,height:600})};
  const at=(x,y)=>{const p=new THREE.Vector3(x,FLOOR_Y[0]+y,bounds.max.z).project(view.camera);return view.targetAt({clientX:(p.x+1)*600,clientY:(1-p.y)*300});};
  for(const [x,y]of [[5.32,.6],[6.05,.7],[8.25,.8],[9.49,.6]])assert.deepEqual(at(x,y),{type:'station',id:'lounge'});
  for(const [x,y]of [[10.15,.7],[7.4,2],[4.9,.6]])assert.equal(at(x,y),null);
});

test('character meshes take priority over station hit volumes, but hidden parts do not',()=>{
  const view=Object.create(ObservationView.prototype),scene=new THREE.Scene(),material=new THREE.MeshBasicMaterial(),geometry=new THREE.BoxGeometry(1,1,1);
  view.milo=new THREE.Group();view.cat=new THREE.Group();view.milo.position.x=-1;view.cat.position.x=1;
  const miloBody=new THREE.Mesh(geometry,material),catBody=new THREE.Mesh(geometry,material);view.milo.add(miloBody);view.cat.add(catBody);
  const station=new THREE.Mesh(new THREE.BoxGeometry(8,8,1),material);station.position.z=2;station.userData.station='lounge';view.ship={targets:[station]};scene.add(view.milo,view.cat,station);scene.updateMatrixWorld(true);
  view.camera=new THREE.OrthographicCamera(-5,5,5,-5,.1,50);view.camera.position.z=10;view.camera.updateMatrixWorld(true);
  view.raycaster=new THREE.Raycaster();view.pointer=new THREE.Vector2();view.canvas={getBoundingClientRect:()=>({left:10,top:20,width:200,height:200})};
  assert.deepEqual(view.targetAt({clientX:90,clientY:120}),{type:'character',id:'milo'});
  assert.deepEqual(view.targetAt({clientX:130,clientY:120}),{type:'character',id:'cat'});
  view.milo.visible=false;assert.deepEqual(view.targetAt({clientX:90,clientY:120}),{type:'station',id:'lounge'});
  catBody.visible=false;assert.deepEqual(view.targetAt({clientX:130,clientY:120}),{type:'station',id:'lounge'});
  assert.equal(view.targetAt({clientX:205,clientY:25}),null);
  geometry.dispose();station.geometry.dispose();material.dispose();
});

function controls(){
  const view=Object.create(ObservationView.prototype),handlers={},orders=[],modes=[];
  Object.assign(view,{canvas:{style:{},setPointerCapture(){}},feedback:{hovered:null},targetCenter:new THREE.Vector3(0,5,0),height:400,viewHeight:12,fitHeight:12,mode:'all',zoom:1,onStation:id=>orders.push(id),onModeChange:id=>modes.push(id)});
  view.bind=(name,handler)=>handlers[name]=handler;view.targetAt=()=>({type:'character',id:'cat'});view.bindControls();
  const event=(x=100,y=100,more={})=>({clientX:x,clientY:y,pointerId:1,isPrimary:true,button:0,...more});
  return {view,handlers,orders,modes,event};
}

test('a character tap zooms and follows the pressed subject without issuing a station order',()=>{
  const {view,handlers,orders,modes,event}=controls();
  handlers.pointermove(event());assert.equal(view.canvas.style.cursor,'zoom-in');assert.equal(view.feedback.hovered,null);
  handlers.pointerdown(event());view.targetAt=()=>({type:'station',id:'lounge'});handlers.pointerup(event(102,101));
  assert.equal(view.mode,'cat');assert.equal(view.targetHeight,3.3);assert.deepEqual(orders,[]);assert.deepEqual(modes,['cat']);
  view.targetAt=()=>({type:'character',id:'milo'});handlers.pointerdown(event());handlers.pointerup(event());
  assert.equal(view.targetHeight,5.3);assert.equal(view.mode,'milo');
  view.setMode('all');assert.equal(view.targetHeight,12);assert.equal(view.mode,'all');assert.equal(view.targetCenter.y,HABITAT_VIEW.centerY);
});

test('panning can reach the upper shaft and wide view restores habitation framing',()=>{
  const {view,handlers,event}=controls();handlers.pointerdown(event());handlers.pointermove(event(100,1100));handlers.pointerup(event(100,1100));
  assert.equal(view.mode,'manual');assert.equal(view.targetCenter.y,HABITAT_VIEW.panMaxY);
  handlers.pointerdown(event());handlers.pointermove(event(100,-900));handlers.pointerup(event(100,-900));
  assert.equal(view.targetCenter.y,HABITAT_VIEW.panMinY);
  view.setMode('all');assert.equal(view.targetCenter.y,HABITAT_VIEW.centerY);
});

test('station taps remain commands while dragging and cancelled touches never follow',()=>{
  const {view,handlers,orders,modes,event}=controls();
  view.targetAt=()=>({type:'station',id:'shower'});handlers.pointerdown(event());handlers.pointerup(event());assert.deepEqual(orders,['shower']);assert.equal(view.mode,'all');
  view.targetAt=()=>({type:'character',id:'cat'});handlers.pointerdown(event());handlers.pointermove(event(120,120));handlers.pointerup(event(120,120));
  assert.equal(view.mode,'manual');assert.deepEqual(modes,['manual']);assert.notEqual(view.targetCenter.x,0);
  view.setMode('all');handlers.pointerdown(event());handlers.pointercancel(event());handlers.pointerup(event());assert.equal(view.mode,'all');
  handlers.pointerdown(event());handlers.lostpointercapture(event());handlers.pointerup(event());assert.equal(view.mode,'all');
  handlers.pointerdown(event());handlers.pointerdown(event(100,100,{pointerId:2,isPrimary:false}));handlers.pointerup(event(100,100,{pointerId:2,isPrimary:false}));assert.equal(view.mode,'all');
  handlers.pointerup(event());assert.equal(view.mode,'cat');assert.deepEqual(orders,['shower']);
});
