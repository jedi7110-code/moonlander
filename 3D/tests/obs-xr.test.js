import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {ObservationXR,frameXRViewer} from '../src/obs/xr.js';
import {ObservationView} from '../src/obs/view.js';
import {XR_MOVE_SPEED,XR_TURN_SPEED} from '../src/obs/xr-navigation.js';

class FakeButton extends EventTarget {
  disabled=false;dataset={};attributes={};classList={toggle(){}};
  setAttribute(key,value){this.attributes[key]=value;}
}
class FakeSession extends EventTarget {
  visibilityState='visible';ended=false;inputSources=[];
  async end(){this.ended=true;this.dispatchEvent(new Event('end'));}
}
function setup({secure=true,supported=true,missing=false,reject=null,setupError=false,request=null}={}){
  const button=new FakeButton(),notices=[],actions=[],stations=[];
  const session=new FakeSession(),controllers=[new THREE.Group(),new THREE.Group()];
  const manager={enabled:false,isPresenting:false,setReferenceSpaceType(){},setFramebufferScaleFactor(){},setFoveation(){},getReferenceSpace(){return{};},getController:i=>controllers[i],
    async setSession(s){if(setupError)throw Error('framebuffer failed');this.isPresenting=true;s.addEventListener('end',()=>{this.isPresenting=false;});}};
  const xr=new EventTarget();xr.calls=0;xr.isSessionSupported=async()=>supported;
  xr.requestSession=type=>{assert.equal(type,'immersive-vr');xr.calls++;if(reject)return Promise.reject(reject);return request?request():Promise.resolve(session);};
  const view={scene:new THREE.Scene(),camera:new THREE.PerspectiveCamera(24,1,.1,150),renderer:{xr:manager},mode:'cat',zoom:1.3,
    center:new THREE.Vector3(3,5,0),targetCenter:new THREE.Vector3(4,6,0),viewHeight:3,targetHeight:2.6,fitHeight:15,
    milo:new THREE.Group(),cat:new THREE.Group(),droidService:{actorRoot:new THREE.Group()},targetFromRay:()=>null,
    resize(){this.resized=(this.resized||0)+1;},setMode(mode){this.mode=mode;this.zoom=1;this.onModeChange?.(mode);},onStation:id=>stations.push(id)};
  view.camera.position.set(7,8,40);view.camera.rotation.set(.1,.2,.3);
  const panels=[];
  const immersive=new ObservationXR(view,{button,words:(ja,en)=>en,getLang:()=> 'en',notify:m=>notices.push(m),action:id=>actions.push(id),secure,xr:missing?null:xr,
    makePanel:()=>{const mesh=new THREE.Mesh(new THREE.PlaneGeometry(1.44,.72),new THREE.MeshBasicMaterial());const p={mesh,draw(){},buttonAt:()=> 'pause',dispose(){this.disposed=true;mesh.removeFromParent();mesh.geometry.dispose();mesh.material.dispose();}};panels.push(p);return p;}});
  view.immersive=immersive;view.onModeChange=mode=>immersive.focus(mode);
  return{immersive,view,button,xr,session,manager,notices,actions,stations,panels};
}
const transform=(x=0,y=0,z=0,yaw=0)=>({position:new THREE.Vector3(x,y,z),orientation:new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),yaw)});
const xrFrame=pose=>({getViewerPose:()=>({transform:pose})});
const close=(a,b)=>assert.ok(a.distanceTo(b)<1e-9,`${a.toArray()} != ${b.toArray()}`);
const inputSource=hand=>({handedness:hand,gamepad:{mapping:'xr-standard',connected:true,axes:[0,0,0,0],buttons:Array.from({length:7},()=>({pressed:false,value:0}))}});
async function start(){
  const s=setup();await s.immersive.ready;await s.immersive.toggle();
  s.left=inputSource('left');s.right=inputSource('right');
  // Deliberately reversed: hand assignment cannot depend on array index.
  s.session.inputSources=[s.right,s.left];
  s.immersive.update(1/72,xrFrame(transform()));
  return s;
}

test('miniature viewing centres an offset, rotated headset without flattening stereo or head motion',()=>{
  const rig=new THREE.Group(),target=new THREE.Vector3(4,5,-1),pose=transform(1,1.7,-2,Math.PI/3),scale=9;
  frameXRViewer(rig,pose,target,scale,2.8);
  const origin=rig.localToWorld(pose.position.clone());close(origin,target.clone().add(new THREE.Vector3(0,0,25.2)));
  const forward=new THREE.Vector3(0,0,-1).applyQuaternion(pose.orientation).applyQuaternion(rig.quaternion);close(forward,new THREE.Vector3(0,0,-1));
  const left=pose.position.clone().add(new THREE.Vector3(-.032,0,0).applyQuaternion(pose.orientation));
  const right=pose.position.clone().add(new THREE.Vector3(.032,0,0).applyQuaternion(pose.orientation));
  assert.ok(Math.abs(rig.localToWorld(left).distanceTo(rig.localToWorld(right))-.064*scale)<1e-9);
  const shifted=rig.localToWorld(pose.position.clone().add(new THREE.Vector3(.1,0,0)));
  assert.ok(Math.abs(shifted.distanceTo(origin)-.9)<1e-9);
});

test('insecure and unsupported browsers explain requirements and never request a session',async()=>{
  for(const options of [{secure:false},{supported:false},{missing:true}]){
    const s=setup(options);await s.immersive.ready;await s.immersive.toggle();
    assert.equal(s.xr.calls,0);assert.equal(s.immersive.active,false);assert.equal(s.button.disabled,false);assert.equal(s.notices.length,1);s.immersive.dispose();
  }
});

test('the click requests XR before yielding; double clicks cannot create two sessions',async()=>{
  let resolve;const s=setup({request:()=>new Promise(r=>{resolve=r;})});await s.immersive.ready;
  const first=s.immersive.toggle();assert.equal(s.xr.calls,1);assert.equal(s.button.disabled,true);
  await s.immersive.toggle();assert.equal(s.xr.calls,1);
  resolve(s.session);await first;assert.equal(s.immersive.active,true);assert.equal(s.button.attributes['aria-pressed'],'true');
  await s.immersive.exit();s.immersive.dispose();
});

test('head tracking owns the camera, focus follows translation, and ending restores the desktop view',async()=>{
  const s=setup();await s.immersive.ready;const original=s.view.camera.clone();
  await s.immersive.toggle();s.immersive.update(1/72,xrFrame(transform(.2,1.6,.3,.3)));
  assert.equal(s.view.camera.parent,s.immersive.rig);assert.equal(s.immersive.rig.scale.x,9);
  ObservationView.prototype.setFrustum.call(s.view);assert.equal(s.view.camera.position.z,0);
  s.view.setMode('milo');s.immersive.update(1/72,xrFrame(transform(.2,1.6,.3,.3)));
  const position=s.immersive.rig.position.clone();s.view.milo.position.x=10;
  s.immersive.update(1/72,xrFrame(transform(.3,1.6,.3,.3)));
  close(s.immersive.rig.position,position.clone().add(new THREE.Vector3(10*(1-Math.exp(-6/72)),0,0)));
  s.session.visibilityState='hidden';assert.equal(s.immersive.visible,false);
  await s.session.end();
  assert.equal(s.immersive.active,false);assert.equal(s.view.camera.parent,null);
  close(s.view.camera.position,original.position);assert.ok(s.view.camera.quaternion.angleTo(original.quaternion)<1e-7);
  assert.equal(s.view.mode,'cat');assert.equal(s.view.zoom,1.3);assert.equal(s.view.targetHeight,2.6);
  assert.equal(s.view.scene.children.length,0);assert.equal(s.panels[0].disposed,true);assert.equal(s.view.resized,1);
  s.immersive.dispose();
});

test('permission denial and renderer setup failures leave the desktop camera usable and permit retry',async()=>{
  for(const options of [{reject:{name:'NotAllowedError'}},{setupError:true}]){
    const s=setup(options);await s.immersive.ready;await s.immersive.toggle();
    assert.equal(s.immersive.active,false);assert.equal(s.immersive.pending,false);assert.equal(s.button.disabled,false);
    assert.equal(s.view.camera.parent,null);assert.equal(s.view.mode,'cat');assert.equal(s.notices.length,1);s.immersive.dispose();
  }
});

test('a pending permission request cannot recreate the scene after disposal',async()=>{
  let resolve;const s=setup({request:()=>new Promise(r=>{resolve=r;})});await s.immersive.ready;
  const pending=s.immersive.toggle();s.immersive.dispose();resolve(s.session);await pending;
  assert.equal(s.session.ended,true);assert.equal(s.immersive.active,false);assert.equal(s.panels.length,0);assert.equal(s.view.camera.parent,null);
});

test('controller rays select the VR panel or route characters and stations to existing actions',async()=>{
  const s=setup();await s.immersive.ready;await s.immersive.toggle();
  s.immersive.update(.1,xrFrame(transform()));
  const controller=s.immersive.controllers[0].controller;controller.position.set(0,-1,0);s.view.scene.updateMatrixWorld(true);
  controller.dispatchEvent({type:'select'});assert.deepEqual(s.actions,['pause']);
  controller.position.set(0,1,0);s.immersive.picker.pick=()=>({type:'station',id:'medical',distance:10});
  controller.dispatchEvent({type:'select'});assert.deepEqual(s.stations,['medical']);
  s.immersive.picker.pick=()=>({type:'character',id:'droid',distance:10});controller.dispatchEvent({type:'select'});assert.equal(s.view.mode,'droid');
  controller.dispatchEvent({type:'squeeze'});assert.equal(s.view.mode,'all');
  await s.immersive.exit();s.immersive.dispose();
});

test('repeated sessions release controllers and panel assets exactly once',async()=>{
  const s=setup();await s.immersive.ready;
  for(let i=0;i<3;i++){
    await s.immersive.toggle();assert.equal(s.immersive.controllers.length,2);
    await s.immersive.exit();assert.equal(s.manager.getController(0).children.length,0);
    assert.equal(s.view.scene.children.length,0);assert.equal(s.view.camera.parent,null);
  }
  assert.equal(s.panels.length,3);assert.ok(s.panels.every(p=>p.disposed));s.immersive.dispose();
});

test('right stick moves relative to head yaw with dead zone, normalized diagonals and frame-rate independence',async()=>{
  const s=await start(),xr=s.immersive,rig=xr.rig,original=rig.position.clone();
  s.right.gamepad.axes=[1,1,.1,-.1];xr.update(1/72,xrFrame(transform()));close(rig.position,original);
  s.right.gamepad.axes=[0,0,0,-1];
  for(let i=0;i<72;i++)xr.update(1/72,xrFrame(transform()));
  close(rig.position,original.clone().add(new THREE.Vector3(0,0,-XR_MOVE_SPEED*9)));
  rig.position.copy(original);
  for(let i=0;i<90;i++)xr.update(1/90,xrFrame(transform()));
  close(rig.position,original.clone().add(new THREE.Vector3(0,0,-XR_MOVE_SPEED*9)));
  rig.position.copy(original);s.right.gamepad.axes=[0,0,1,-1];
  for(let i=0;i<72;i++)xr.update(1/72,xrFrame(transform()));
  assert.ok(Math.abs(rig.position.distanceTo(original)-XR_MOVE_SPEED*9)<1e-9);
  rig.position.copy(original);s.right.gamepad.axes=[0,0,0,-1];
  const pose=transform(0,0,0,Math.PI/2);pose.orientation.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),.6));
  xr.update(.05,xrFrame(pose));close(rig.position,original.clone().add(new THREE.Vector3(-XR_MOVE_SPEED*9*.05,0,0)));
  s.immersive.dispose();
});

test('left stick turns in place around the offset physical head; it never pitches or translates the eye',async()=>{
  const s=await start(),xr=s.immersive,rig=xr.rig,pose=transform(.8,1.6,-.4,.4);
  xr.update(1/72,xrFrame(pose));const eye=rig.localToWorld(pose.position.clone());
  s.left.gamepad.axes=[0,0,1,1];
  for(let i=0;i<72;i++)xr.update(1/72,xrFrame(pose));
  close(rig.localToWorld(pose.position.clone()),eye);
  close(new THREE.Vector3(0,0,-1).applyQuaternion(rig.quaternion),new THREE.Vector3(Math.sin(XR_TURN_SPEED),0,-Math.cos(XR_TURN_SPEED)));
  close(new THREE.Vector3(0,1,0).applyQuaternion(rig.quaternion),new THREE.Vector3(0,1,0));
  s.immersive.dispose();
});

test('all three characters follow in world coordinates while manual movement and headset orientation remain independent',async()=>{
  const s=await start(),xr=s.immersive,rig=xr.rig;
  const parent=new THREE.Group();parent.position.set(3,2,1);parent.rotation.y=.3;s.view.scene.add(parent);parent.add(s.view.droidService.actorRoot);
  for(const [mode,root] of [['milo',s.view.milo],['cat',s.view.cat],['droid',s.view.droidService.actorRoot]]){
    s.view.setMode(mode);xr.update(1/72,xrFrame(transform()));
    const position=rig.position.clone(),rootBefore=root.getWorldPosition(new THREE.Vector3()),orientation=rig.quaternion.clone();
    root.position.add(new THREE.Vector3(1,2,.5));root.rotation.y=1;
    const delta=root.getWorldPosition(new THREE.Vector3()).sub(rootBefore);
    s.right.gamepad.axes[2]=1;
    xr.update(.05,xrFrame(transform(.2,1.7,-.1)));
    close(rig.position,position.clone().addScaledVector(delta,1-Math.exp(-.3)).add(new THREE.Vector3(XR_MOVE_SPEED*rig.scale.x*.05,0,0)));
    assert.ok(rig.quaternion.angleTo(orientation)<1e-7);
    s.right.gamepad.axes[2]=0;
    const moved=rig.position.clone();
    xr.update(.05,xrFrame(transform(.3,1.7,-.1)));
    close(rig.position,moved.addScaledVector(delta,Math.exp(-.3)*(1-Math.exp(-.3))));
  }
  s.view.setMode('all');xr.update(1/72,xrFrame(transform()));const position=rig.position.clone();
  s.view.milo.position.x+=10;xr.update(.05,xrFrame(transform()));close(rig.position,position);
  s.immersive.dispose();
});

test('A/X summons a readable panel in front of the current eye once per press; hidden panels cannot intercept rays',async()=>{
  const s=await start(),xr=s.immersive,pose=transform(.7,1.8,-.4,1.2);
  const controller=xr.controllers[0].controller;
  for(const source of [s.right,s.left]){
    source.gamepad.buttons[4].pressed=true;xr.update(.05,xrFrame(pose));
    assert.equal(xr.panel.mesh.visible,true);assert.equal(xr.menuOpen,true);
    close(xr.panel.mesh.position,new THREE.Vector3(0,-.08,-1.6).applyQuaternion(pose.orientation).add(pose.position));
    assert.ok(xr.panel.mesh.quaternion.angleTo(pose.orientation)<1e-7);
    controller.position.copy(pose.position);controller.quaternion.copy(pose.orientation);s.view.scene.updateMatrixWorld(true);
    assert.equal(xr.pick(controller).type,'control');
    for(let i=0;i<5;i++)xr.update(.05,xrFrame(pose));assert.equal(xr.menuOpen,true);
    source.gamepad.buttons[4].pressed=false;xr.update(.05,xrFrame(pose));
    source.gamepad.buttons[4].pressed=true;xr.update(.05,xrFrame(pose));
    assert.equal(xr.panel.mesh.visible,false);assert.equal(xr.menuOpen,false);
    xr.picker.pick=()=>({type:'station',id:'medical'});assert.equal(xr.pick(controller).type,'station');
    source.gamepad.buttons[4].pressed=false;xr.update(.05,xrFrame(pose));
  }
  s.immersive.dispose();
});

test('B/Y returns to the full view even after roaming in all mode and overrides simultaneous sticks/menu',async()=>{
  const s=await start(),xr=s.immersive,rig=xr.rig,pose=transform(.5,1.6,.2,.7);
  for(const source of [s.right,s.left]){
    s.view.setMode('cat');xr.update(.05,xrFrame(pose));
    s.right.gamepad.axes[3]=-1;s.left.gamepad.axes[2]=1;xr.update(.05,xrFrame(pose));
    source.gamepad.buttons[5].pressed=true;source.gamepad.buttons[4].pressed=true;xr.update(.05,xrFrame(pose));
    assert.equal(s.view.mode,'all');assert.equal(xr.followRoot,null);assert.equal(rig.scale.x,9);assert.equal(xr.menuOpen,false);
    const expected=new THREE.Group();frameXRViewer(expected,pose,new THREE.Vector3(0,xr.rig.localToWorld(pose.position.clone()).y,0),9,2.8);
    close(rig.position,expected.position);assert.ok(rig.quaternion.angleTo(expected.quaternion)<1e-7);
    xr.update(.05,xrFrame(pose));assert.ok(rig.position.distanceTo(expected.position)>.01); // holding B does not reset repeatedly
    source.gamepad.buttons[5].pressed=false;source.gamepad.buttons[4].pressed=false;xr.update(.05,xrFrame(pose));
    source.gamepad.buttons[5].pressed=true;xr.update(.05,xrFrame(pose));close(rig.position,expected.position);
    source.gamepad.buttons[5].pressed=false;s.right.gamepad.axes[3]=0;s.left.gamepad.axes[2]=0;xr.update(.05,xrFrame(pose));
  }
  s.immersive.dispose();
});

test('input stops on blur, missing pose or disconnect; held buttons on reconnect do not fire and long frames are capped',async()=>{
  const s=await start(),xr=s.immersive,rig=xr.rig,position=rig.position.clone();
  s.right.gamepad.axes[3]=-1;
  for(const state of ['visible-blurred','hidden']){
    s.session.visibilityState=state;s.session.dispatchEvent(new Event('visibilitychange'));
    xr.update(20,xrFrame(transform()));close(rig.position,position);
    s.right.gamepad.buttons[4].pressed=true;
  }
  s.session.visibilityState='visible';s.session.dispatchEvent(new Event('visibilitychange'));
  xr.update(20,{getViewerPose:()=>null});close(rig.position,position);
  xr.update(20,xrFrame(transform()));assert.equal(xr.menuOpen,false);
  close(rig.position,position.clone().add(new THREE.Vector3(0,0,-XR_MOVE_SPEED*9*.05)));
  s.session.inputSources=[];const disconnected=rig.position.clone();xr.update(.05,xrFrame(transform()));close(rig.position,disconnected);
  s.session.inputSources=[s.right];s.right.gamepad.axes[3]=0;xr.update(.05,xrFrame(transform()));assert.equal(xr.menuOpen,false);
  s.right.gamepad.buttons[4].pressed=false;xr.update(.05,xrFrame(transform()));
  s.right.gamepad.buttons[4].pressed=true;xr.update(.05,xrFrame(transform()));assert.equal(xr.menuOpen,true);
  s.immersive.dispose();assert.equal(xr.navigation,null);
});
