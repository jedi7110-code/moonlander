import test from 'node:test';
import assert from 'node:assert/strict';
import {Group,Vector3,PerspectiveCamera,MathUtils,MeshStandardMaterial} from 'three';
import {CharacterCamera,FOLLOW_OBLIQUE} from '../src/obs/character-camera.js';
import {HeadLookRig,LOOK_PROFILES} from '../src/obs/first-person-look.js';
import {updateCharacterCameraUI,updateFirstPersonOverlay} from '../src/obs/character-camera-ui.js';
import {ObservationView} from '../src/obs/view.js';
import {createMetalDeckStyle} from '../src/obs/metal-deck.js';

function setup(){
  const scene=new Group(),milo=new Group(),cat=new Group(),droid=new Group(),rigs={};
  for(const [id,root,height]of [['milo',milo,1.65],['cat',cat,.35],['droid',droid,1.4]]){
    const head=new Group();head.position.y=height;root.add(head);scene.add(root);root.userData.head=head;
    rigs[id]=new HeadLookRig(head,root,new Vector3(0,.08,.1));
  }
  const view={scene,milo,cat,droidBay:{droid:{root:droid}},camera:new PerspectiveCamera(),center:new Vector3(3,5,0),
    viewHeight:5.3,width:1280,height:720,immersive:{active:false},droidRoutine:{docked:false,pose:{mode:'idle'}},
    canvas:{getBoundingClientRect:()=>({left:0,top:0,width:1280,height:720}),setPointerCapture(){}}};
  const camera=new CharacterCamera(view,{rigs,wall:new Group()});view.characterCamera=camera;
  const frame={actor:{busy:false,climbing:false},brain:{state:'idle'},catRoutine:{mode:'walk'}};
  const tick=(dt=.4)=>{camera.restorePose();camera.update(dt,frame);ObservationView.prototype.setFrustum.call(view);};
  return{view,camera,rigs,frame,tick};
}
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-9,`${a} != ${b}`);

test('the inset deck receives the wall footlight wash only while the first-person enclosure is present',()=>{
  const {view,camera,tick}=setup();view.deckStyle=createMetalDeckStyle();
  const dark=new MeshStandardMaterial(),floor=view.deckStyle.buildFloor({dark},0,0);
  const panel=floor.children.find(mesh=>mesh.name==='Solid service plate');
  const shader={uniforms:{},vertexShader:'#include <common>\n#include <begin_vertex>',fragmentShader:'#include <common>\n#include <emissivemap_fragment>'};
  panel.material.onBeforeCompile(shader);const enabled=shader.uniforms.povFootlights;
  camera.select('milo');tick();assert.equal(enabled.value,0);
  camera.toggleFirstPerson();tick();assert.equal(enabled.value,1);assert.equal(camera.wall.visible,true);
  camera.cycleAngle();tick();assert.equal(enabled.value,0);
  camera.toggleFirstPerson();tick();assert.equal(enabled.value,1);
  view.immersive.active=true;tick();assert.equal(enabled.value,0);
  view.immersive.active=false;camera.select('all');tick();assert.equal(enabled.value,0);
  floor.traverse(mesh=>mesh.geometry?.dispose());dark.dispose();camera.dispose();
});

test('three follow angles retain framing, track the character, and finish at the unchanged front camera',()=>{
  const {view,camera,tick}=setup();camera.select('milo');tick();
  const front=view.camera.position.clone(),fov=view.camera.fov;
  for(const sign of [-1,1]){
    camera.cycleAngle();tick();
    const offset=view.camera.position.clone().sub(view.center),study=FOLLOW_OBLIQUE;
    near(offset.x/offset.z,sign*study.x/study.z);near(offset.y/offset.z,study.y/study.z);near(view.camera.fov,35);
    near(2*offset.length()*Math.tan(MathUtils.degToRad(view.camera.fov/2)),view.viewHeight);
    view.center.x+=2;tick();near(view.camera.position.x-offset.x,view.center.x);view.center.x-=2;tick();
  }
  camera.cycleAngle();tick();assert.ok(view.camera.position.distanceTo(front)<1e-9);near(view.camera.fov,fov);
  assert.equal(camera.angle,'front');assert.equal(camera.applyCamera(),false);
});

test('first-person returns to the selected angle; switching character or wide restores animation and hides the wall',()=>{
  const {view,camera,rigs,tick}=setup();camera.select('milo');tick();camera.cycleAngle();tick();
  const outside=view.camera.position.clone(),head=rigs.milo.head,neutral=head.quaternion.clone();
  camera.toggleFirstPerson();camera.pointerMove({pointerType:'mouse',clientX:1280,clientY:0});tick();
  assert.equal(camera.active,true);assert.equal(camera.wall.visible,true);assert.equal(view.camera.near,.025);
  assert.ok(head.quaternion.angleTo(neutral)>.1);
  camera.toggleFirstPerson();tick();assert.equal(camera.angle,'left');assert.ok(view.camera.position.distanceTo(outside)<1e-9);
  assert.ok(head.quaternion.angleTo(neutral)<1e-7);assert.equal(camera.wall.visible,false);
  for(const id of ['cat','droid','milo']){
    camera.select(id);assert.equal(camera.angle,'front');assert.equal(camera.firstPerson,false);tick();
    camera.toggleFirstPerson();tick();assert.equal(view.camera.fov,LOOK_PROFILES[id].fov);
    view.width=390;view.height=844;tick();near(view.camera.aspect,390/844);
  }
  camera.select('all');tick();assert.equal(camera.available,false);assert.equal(camera.wall.visible,false);assert.equal(view.camera.near,.1);
  camera.dispose();
});

test('touch looking remains bounded, sleep and treatment lock it, and WebXR owns its camera',()=>{
  const {view,camera,frame,tick}=setup();camera.select('milo');camera.toggleFirstPerson();tick();
  camera.pointerDown({pointerType:'touch',pointerId:2,clientX:100,clientY:100});
  camera.pointerMove({pointerType:'touch',pointerId:2,clientX:100000,clientY:100000});tick();
  near(camera.look.targetYaw,MathUtils.degToRad(75));near(camera.look.targetPitch,MathUtils.degToRad(-50));
  camera.pointerEnd({pointerId:2});assert.equal(camera.touch,null);
  frame.brain.bunkVisit={pose:{phase:'sleeping',recline:1,age:1}};tick();assert.equal(camera.rest.closure,1);assert.equal(camera.rest.locked,true);
  camera.pointerMove({pointerType:'mouse',clientX:1280,clientY:0});tick();assert.equal(camera.look.yaw,0);
  delete frame.brain.bunkVisit;Object.assign(frame.brain,{state:'performing',cur:{id:'medical'},curDurSec:30,performT:15});tick();
  assert.equal(camera.rest.medical,true);assert.equal(camera.rest.locked,true);assert.equal(camera.rest.closure,0);
  view.immersive.active=true;const position=view.camera.position.clone();tick();
  assert.equal(camera.available,false);assert.equal(camera.wall.visible,false);assert.ok(view.camera.position.equals(position));
});

function ui(){
  const nodes=new Map();const node=id=>{
    if(!nodes.has(id))nodes.set(id,{hidden:false,dataset:{},attributes:{},setAttribute(k,v){this.attributes[k]=v;},append(child){child.parentElement=this;}});
    return nodes.get(id);
  };
  return{getElementById:node,querySelector:node};
}

test('only the selected icon owns the controls, with localized state and sleep overlay cleared on exit',()=>{
  const {view,camera,tick}=setup(),document=ui(),words=(ja,en)=>ja,$=document.getElementById;
  updateCharacterCameraUI(document,view,words);assert.equal($('character-view-controls').hidden,true);
  for(const id of ['milo','cat','droid']){
    camera.select(id);tick();updateCharacterCameraUI(document,view,words);
    assert.equal($('character-view-controls').parentElement,document.querySelector(`[data-camera-character="${id}"]`));
    assert.equal($('view-'+id).attributes['aria-expanded'],'true');
    assert.equal($('follow-angle').attributes['aria-label'],'俯瞰角度を切り替える: 左斜め上');
  }
  camera.toggleFirstPerson();tick();updateCharacterCameraUI(document,view,words);
  assert.equal($('first-person').attributes['aria-pressed'],'true');assert.equal($('zoom-in').disabled,true);
  updateFirstPersonOverlay(document,{closure:1,locked:true},true);assert.equal($('first-person-eyelids').hidden,false);
  const curve=$('first-person-upper-lid').attributes.d.match(/V([\d.]+)Q50 ([\d.]+)/);
  near(Number(curve[1]),60);near(Number(curve[2]),40);
  camera.select('all');updateCharacterCameraUI(document,view,words);
  assert.equal($('character-view-controls').hidden,true);assert.equal($('first-person-eyelids').hidden,true);
});
