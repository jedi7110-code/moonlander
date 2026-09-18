import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Group,PerspectiveCamera,Vector3} from 'three';
import {CabinBrain} from '../src/obs/brain.js';
import {CrewMotion,Supplies,getStation} from '../src/obs/state.js';
import {ObservationView} from '../src/obs/view.js';
import {loungeGamePromptAvailable,loungeGamePromptPosition,updateLoungeGamePrompt} from '../src/obs/lounge-prompt.js';

test('the invitation appears only after sitting and opens the chooser without walking again',()=>{
  let opened=0,kind='unset';
  const actor=new CrewMotion({floor:getStation('lounge').floor,x:1060});
  const brain=new CabinBrain({obsUI:{hideWant(){},openGame(selected){opened++;kind=selected;}}},actor,{care:new Supplies(),random:()=>.8});
  brain.health.nextIncident=Infinity;
  assert.equal(loungeGamePromptAvailable(brain),false);
  brain.clickLounge();assert.equal(loungeGamePromptAvailable(brain),false);
  for(let i=0;i<120;i++)actor.update(1/60);
  assert.ok(brain.loungeEntry);assert.equal(loungeGamePromptAvailable(brain),false);
  brain.update(2.4);assert.equal(loungeGamePromptAvailable(brain),true);
  assert.equal(loungeGamePromptAvailable(brain,true),false);
  const version=actor.commandVersion;
  assert.equal(brain.requestGame(),true);assert.equal(opened,1);assert.equal(kind,null);
  assert.equal(actor.commandVersion,version);assert.equal(loungeGamePromptAvailable(brain),false);
  assert.equal(brain.requestGame(),false);assert.equal(opened,1);
  brain.finishGame();assert.ok(brain.loungeExit);assert.equal(loungeGamePromptAvailable(brain),false);
  brain.update(2.8);assert.equal(loungeGamePromptAvailable(brain),false);
});

test('the invitation follows the head and stays above it at desktop and mobile sizes',()=>{
  for(const [width,height]of [[1440,720],[390,524]]){
    const center=loungeGamePromptPosition({x:width/2,y:height/2,z:0},width,height,204,44);
    assert.deepEqual(center,{x:width/2,y:height/2-10});
    for(const x of [0,8,width-8,width]){
      const position=loungeGamePromptPosition({x,y:height/2,z:0},width,height,204,44);
      assert.ok(position.x-102>=12&&position.x+102<=width-12);
      assert.equal(position.y,height/2-10);
    }
    for(const point of [null,{x:-1,y:200,z:0},{x:width+1,y:200,z:0},{x:100,y:-1,z:0},{x:100,y:height+1,z:0},{x:100,y:200,z:1.1},{x:100,y:200,z:-1.1},{x:100,y:20,z:0},{x:NaN,y:200,z:0}]){
      assert.equal(loungeGamePromptPosition(point,width,height,204,44),null);
    }
  }
});

test('projection tracks the actual seated head through pan, zoom and aspect changes',()=>{
  const view=Object.create(ObservationView.prototype),milo=new Group(),body=new Group(),head=new Group();
  milo.add(body);body.add(head);milo.userData.head=head;head.position.set(0,1.637,-.009);head.scale.setScalar(.055);
  body.position.y=-.45;milo.position.set(5,4,.8);
  view.milo=milo;view.camera=new PerspectiveCamera(24,2,.1,150);
  for(const [width,height]of [[1440,720],[390,524]])for(const fov of [8,24])for(const pan of [-3,0,3]){
    view.width=width;view.height=height;view.camera.aspect=width/height;view.camera.fov=fov;view.camera.updateProjectionMatrix();
    view.camera.position.set(5+pan,5,40);view.camera.lookAt(5+pan,5,0);view.camera.updateMatrixWorld(true);
    const projected=view.miloHeadScreenPosition(),crown=new Vector3(0,0,0);
    head.getWorldPosition(crown);crown.y+=.26;crown.project(view.camera);
    assert.ok(Math.abs(projected.x-(crown.x+1)*width/2)<1e-8);
    assert.ok(Math.abs(projected.y-(1-crown.y)*height/2)<1e-8);
    assert.equal(projected.z,crown.z);
  }
  const previous=view.miloHeadScreenPosition();body.position.y-=.2;
  assert.ok(view.miloHeadScreenPosition().y>previous.y,'sitting/head movement updates the anchor without a stale matrix');
  milo.visible=false;assert.equal(view.miloHeadScreenPosition(),null);
});

test('the DOM prompt updates while paused and hides for games, departure and offscreen heads',()=>{
  const element={hidden:true,style:{},offsetWidth:204,offsetHeight:44};
  const brain={isSeatedInLounge:()=>true};
  let point={x:600,y:300,z:0};
  const view={width:1200,height:600,miloHeadScreenPosition:()=>point};
  updateLoungeGamePrompt(element,brain,false,view);
  assert.equal(element.hidden,false);assert.deepEqual(element.style,{left:'600px',top:'290px'});
  point={x:640,y:280,z:0};updateLoungeGamePrompt(element,brain,false,view);
  assert.deepEqual(element.style,{left:'640px',top:'270px'});
  updateLoungeGamePrompt(element,brain,true,view);assert.equal(element.hidden,true);
  updateLoungeGamePrompt(element,brain,false,view);assert.equal(element.hidden,false);
  point=null;updateLoungeGamePrompt(element,brain,false,view);assert.equal(element.hidden,true);
  brain.loungeExit={age:0};updateLoungeGamePrompt(element,brain,false,view);assert.equal(element.hidden,true);
});

test('the head invitation reuses the talk design and is a localized keyboard-accessible game button',()=>{
  const html=readFileSync(new URL('../src/obs.html',import.meta.url),'utf8');
  const main=readFileSync(new URL('../src/obs/main.js',import.meta.url),'utf8');
  assert.match(html,/id="lounge-game-prompt" class="call-alert" hidden/);
  assert.match(html,/id="open-lounge-games" type="button" aria-haspopup="dialog" aria-controls="cabin-games"/);
  assert.match(html,/data-ja="ラウンジゲーム" data-en="Lounge games"/);
  assert.match(main,/\$\('open-lounge-games'\)\.addEventListener\('click'/);
  assert.match(main,/updateLoungeGamePrompt\(\$\('lounge-game-prompt'\),brain,games.open,view\)/);
});
