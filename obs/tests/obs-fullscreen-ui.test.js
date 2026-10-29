import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {updateFullscreenUI} from '../src/obs/fullscreen-ui.js';

const ja=(ja,en)=>ja,en=(ja,en)=>en;
function setup(){
  const button={dataset:{},attributes:{},setAttribute(key,value){this.attributes[key]=value;}};
  const document={fullscreenEnabled:true,fullscreenElement:null,getElementById:id=>{assert.equal(id,'obs-fullscreen');return button;}};
  let renders=0;
  return {button,document,update:(words=ja)=>updateFullscreenUI(document,words,()=>renders++),renders:()=>renders};
}

test('wide view uses a frame and fullscreen uses visibly different diagonal arrows',()=>{
  const html=readFileSync(new URL('../src/obs.html',import.meta.url),'utf8');
  assert.match(html,/<button id="view-all"[^>]*><i data-lucide="scan"/);
  assert.match(html,/<button id="obs-fullscreen"[^>]*><i data-lucide="maximize-2"/);
  const main=readFileSync(new URL('../src/obs/main.js',import.meta.url),'utf8');
  assert.match(main,/document\.addEventListener\('fullscreenchange',\(\)=>updateFullscreenUI\(document,words,refreshIcons\)\)/);
  assert.match(main,/const icons=\{[^}]*Maximize2,Minimize2/);
});

test('fullscreen entry and exit synchronize arrows, tooltip and accessible state',()=>{
  const ui=setup();ui.update();
  assert.equal(ui.button.dataset.fullscreenIcon,'maximize-2');
  assert.equal(ui.button.dataset.tip,'全画面');assert.equal(ui.button.attributes['aria-pressed'],'false');
  assert.equal(ui.button.hidden,false);
  ui.document.fullscreenElement={};ui.update();
  assert.match(ui.button.innerHTML,/data-lucide="minimize-2"/);
  assert.equal(ui.button.dataset.tip,'全画面を解除');assert.equal(ui.button.attributes['aria-pressed'],'true');
  ui.update(en);assert.equal(ui.button.attributes['aria-label'],'Exit fullscreen');
  assert.equal(ui.renders(),2,'localizing must not recreate an unchanged icon');
  ui.document.fullscreenElement=null;ui.update(en);
  assert.match(ui.button.innerHTML,/data-lucide="maximize-2"/);
  assert.equal(ui.button.attributes['aria-label'],'Fullscreen');assert.equal(ui.button.attributes['aria-pressed'],'false');
});

test('unsupported fullscreen stays hidden and a rejected request keeps the current state',()=>{
  const ui=setup();ui.document.fullscreenEnabled=false;ui.update();assert.equal(ui.button.hidden,true);
  ui.document.fullscreenEnabled=true;ui.update();assert.equal(ui.button.hidden,false);
  ui.update();assert.equal(ui.button.dataset.fullscreenIcon,'maximize-2');assert.equal(ui.renders(),1);
});
