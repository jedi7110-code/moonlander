import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {ObservationView} from '../src/obs/view.js';
import {HABITAT_VIEW} from '../src/obs/ship.js';

function setup(width=1200,height=600,mode='all'){
  const view=Object.create(ObservationView.prototype),rect={left:30,top:185,width,height},handlers={};
  Object.assign(view,{canvas:{style:{},getBoundingClientRect:()=>rect},width,height,fitHeight:Math.max(15,29.4/(width/height)),mode,zoom:1,center:new THREE.Vector3(2,5,0),targetCenter:new THREE.Vector3(2,5,0),viewHeight:mode==='cat'?3.3:mode==='milo'?5.3:15});
  view.targetHeight=view.viewHeight;view.camera=new THREE.PerspectiveCamera(24,1,.1,150);
  view.bind=(name,fn)=>handlers[name]=fn;view.bindControls();update(view);
  return{view,handlers,pointer:(x,y)=>({clientX:rect.left+x*width,clientY:rect.top+y*height})};
}
function update(view){
  view.setFrustum();
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

test('wheel zoom anchors the selected focus plane on desktop and mobile',()=>{
  for(const [width,height]of [[1440,720],[472,850]])for(const ratio of [1.15,1/1.15])for(const z of [-1.5,0,.8,1.8])for(const [x,y]of [[.5,.5],[.12,.17],[.86,.81]]){
    const {view,pointer}=setup(width,height);view.center.z=view.targetCenter.z=z;update(view);
    const p=pointer(x,y),point=anchor(view,p,z),before=view.center.clone();
    view.changeZoom(ratio,p);assert.equal(view.mode,'manual');assert.deepEqual(view.center,before);settle(view,point,p);
  }
});
test('rapid wheel input and a moving pointer use the currently visible view, not the pending center',()=>{
  const {view,pointer}=setup();
  for(const [x,y,ratio]of [[.9,.2,1.15],[.9,.2,1.15],[.1,.8,1.15],[.8,.6,1/1.15],[.8,.6,1.15]]){
    const p=pointer(x,y),point=anchor(view,p,view.center.z);view.changeZoom(ratio,p);settle(view,point,p,3);
  }
});
test('scrolling while following keeps the current magnification and switches to manual only once',()=>{
  for(const mode of ['milo','cat']){
    const {view,handlers,pointer}=setup(472,850,mode),modes=[];view.onModeChange=mode=>modes.push(mode);
    const before=view.viewHeight,p=pointer(.72,.33),point=anchor(view,p,view.center.z);let prevented=0;
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

test('panning produces depth parallax with a bounded orbit and no camera roll',()=>{
  for(const [width,height]of [[1440,720],[390,844]]){
    const {view}=setup(width,height);
    const near=new THREE.Vector3(0,5,1.8),far=new THREE.Vector3(0,5,-2);
    const beforeNear=pixel(view,near),beforeFar=pixel(view,far),rotation=view.camera.quaternion.clone();
    view.center.x+=3;view.targetCenter.copy(view.center);update(view);
    const nearMotion=pixel(view,near).x-beforeNear.x,farMotion=pixel(view,far).x-beforeFar.x;
    assert.ok(Math.abs(nearMotion)>Math.abs(farMotion)+1,'foreground travels faster than the back wall');
    assert.ok(view.camera.quaternion.angleTo(rotation)>.01,'moving across the cabin reveals side faces');
    for(const x of [-30,0,30])for(const y of [-20,6.35,30]){
      view.center.set(x,y,0);update(view);
      const offset=view.camera.position.clone().sub(view.center);
      assert.ok(Math.abs(offset.x)<=4&&offset.y>=.25&&offset.y<=3);
      assert.ok(Math.abs(offset.length()-40)<1e-9);
      assert.ok(Math.abs(new THREE.Vector3(1,0,0).applyQuaternion(view.camera.quaternion).y)<1e-9);
    }
  }
});

test('the wide perspective view fits the hull and ladder on desktop and mobile',()=>{
  for(const [width,height]of [[1440,720],[390,844],[2560,900]]){
    const {view}=setup(width,height);
    view.center.set(0,HABITAT_VIEW.centerY,0);view.targetCenter.copy(view.center);
    view.viewHeight=Math.max(HABITAT_VIEW.minHeight,29.4/(width/height));update(view);
    for(const x of [-13.5,13.5])for(const y of [-.6,13.4])for(const z of [-2.2,1.8]){
      const projected=new THREE.Vector3(x,y,z).project(view.camera);
      assert.ok(Math.abs(projected.x)<1&&Math.abs(projected.y)<1);
      assert.ok(projected.z>-1&&projected.z<1);
    }
  }
});

test('reduced motion disables orbit, and a drag releases the wheel anchor',()=>{
  const {view,handlers,pointer}=setup(),p=pointer(.7,.4);
  view.reducedMotion=true;update(view);const rotation=view.camera.quaternion.clone();
  view.center.set(10,9,0);update(view);assert.ok(rotation.angleTo(view.camera.quaternion)<1e-7);
  view.changeZoom(1.15,p);assert.ok(view.zoomAnchor);
  view.canvas.setPointerCapture=()=>{};view.targetAt=()=>null;
  handlers.pointerdown({...p,button:0,pointerId:1});assert.equal(view.zoomAnchor,null);
  handlers.pointermove({...p,clientX:p.clientX+50,pointerId:1});
  assert.notEqual(view.targetCenter.x,view.center.x);
  view.setMode('all');assert.equal(view.zoomAnchor,null);
});
