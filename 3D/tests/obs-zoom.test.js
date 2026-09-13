import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {ObservationView} from '../src/obs/view.js';

function setup(width=1200,height=600,mode='all'){
  const view=Object.create(ObservationView.prototype),rect={left:30,top:185,width,height},handlers={};
  Object.assign(view,{canvas:{style:{},getBoundingClientRect:()=>rect},width,height,fitHeight:Math.max(15,29.4/(width/height)),mode,zoom:1,center:new THREE.Vector3(2,5,0),targetCenter:new THREE.Vector3(2,5,0),viewHeight:mode==='cat'?3.3:mode==='milo'?5.3:15});
  view.targetHeight=view.viewHeight;view.camera=new THREE.OrthographicCamera(-1,1,1,-1,.1,150);
  view.bind=(name,fn)=>handlers[name]=fn;view.bindControls();update(view);
  return{view,handlers,pointer:(x,y)=>({clientX:rect.left+x*width,clientY:rect.top+y*height})};
}
function update(view){
  view.setFrustum();view.camera.position.set(view.center.x,view.center.y+1.6,40);view.camera.lookAt(view.center.x,view.center.y,0);view.camera.updateMatrixWorld(true);
}
function pixel(view,point){
  const p=point.clone().project(view.camera),r=view.canvas.getBoundingClientRect();
  return new THREE.Vector2(r.left+(p.x+1)*r.width/2,r.top+(1-p.y)*r.height/2);
}
function anchor(view,pointer,z){
  const r=view.canvas.getBoundingClientRect(),ray=new THREE.Raycaster();
  ray.setFromCamera(new THREE.Vector2((pointer.clientX-r.left)/r.width*2-1,1-(pointer.clientY-r.top)/r.height*2),view.camera);
  return ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0,0,1),-z),new THREE.Vector3());
}
function settle(view,point,pointer,frames=120){
  for(let frame=0;frame<frames;frame++){
    const alpha=1-Math.exp(-5/60);view.center.lerp(view.targetCenter,alpha);view.viewHeight=THREE.MathUtils.lerp(view.viewHeight,view.targetHeight,alpha);update(view);
    assert.ok(pixel(view,point).distanceTo(new THREE.Vector2(pointer.clientX,pointer.clientY))<1e-6,'the pointed surface remains pinned throughout the easing');
  }
}

test('wheel zoom anchors center and off-center surfaces at all depths on desktop and mobile',()=>{
  for(const [width,height]of [[1440,720],[472,850]])for(const ratio of [1.15,1/1.15])for(const z of [-1.5,0,.8,1.8])for(const [x,y]of [[.5,.5],[.12,.17],[.86,.81]]){
    const {view,pointer}=setup(width,height),p=pointer(x,y),point=anchor(view,p,z),before=view.center.clone();
    view.changeZoom(ratio,p);assert.equal(view.mode,'manual');assert.deepEqual(view.center,before);settle(view,point,p);
  }
});
test('rapid wheel input and a moving pointer use the currently visible view, not the pending center',()=>{
  const {view,pointer}=setup();
  for(const [x,y,ratio]of [[.9,.2,1.15],[.9,.2,1.15],[.1,.8,1.15],[.8,.6,1/1.15],[.8,.6,1.15]]){
    const p=pointer(x,y),point=anchor(view,p,.6);view.changeZoom(ratio,p);settle(view,point,p,3);
  }
});
test('scrolling while following keeps the current magnification and switches to manual only once',()=>{
  for(const mode of ['milo','cat']){
    const {view,handlers,pointer}=setup(472,850,mode),modes=[];view.onModeChange=mode=>modes.push(mode);
    const before=view.viewHeight,p=pointer(.72,.33),point=anchor(view,p,.8);let prevented=0;
    handlers.wheel({...p,deltaY:-100,preventDefault(){prevented++;}});
    assert.equal(view.targetHeight,before/1.15);settle(view,point,p,3);
    handlers.wheel({...p,deltaY:-100,preventDefault(){prevented++;}});settle(view,point,p);
    assert.deepEqual(modes,['manual']);assert.equal(prevented,2);
  }
});
test('zoom buttons retain tracking, limits are stable, and horizontal-only wheel input does nothing',()=>{
  const {view,handlers,pointer}=setup(1200,600,'milo'),center=view.targetCenter.clone();
  view.changeZoom(1.3);assert.equal(view.mode,'milo');assert.deepEqual(view.targetCenter,center);
  const target=view.targetHeight;handlers.wheel({...pointer(.8,.4),deltaY:0,preventDefault(){assert.fail('horizontal scroll must not be captured');}});assert.equal(view.targetHeight,target);
  const p=pointer(.7,.3),point=anchor(view,p,0);view.changeZoom(100,p);assert.equal(view.targetHeight,1.9);settle(view,point,p);
  const atLimit=view.targetCenter.clone();view.changeZoom(1.15,pointer(.1,.1));assert.deepEqual(view.targetCenter,atLimit);
  view.changeZoom(.001,p);assert.equal(view.targetHeight,view.fitHeight*1.25);
  for(const ratio of [0,-1,NaN,Infinity,1])view.changeZoom(ratio,p);
  assert.equal(view.targetHeight,view.fitHeight*1.25);
  view.setMode('cat');assert.equal(view.targetHeight,3.3);view.setMode('all');assert.equal(view.targetHeight,view.fitHeight);
});
