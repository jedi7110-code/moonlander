import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

// Exercise the actual UI without its browser-only stylesheet import.
const uiFile=new URL('../src/obs/exterior-cinema-ui.js',import.meta.url);
const policyFile=new URL('../src/obs/exterior-cinema-policy.js',import.meta.url);
const source=(await readFile(uiFile,'utf8')).replace("import './exterior-cinema-ui.css';",'')
  .replace('./exterior-cinema-policy.js',policyFile.href);
const {ExteriorCinemaUI}=await import(`data:text/javascript,${encodeURIComponent(source)}`);

function fixture(t){
  const previous={document:globalThis.document,window:globalThis.window,location:globalThis.location};
  let document;
  class Element{
    constructor(tag){this.tagName=tag;this.children=[];this.inert=false;this.hidden=false;this.attributes={};this.contentWindow={};}
    setAttribute(key,value){this.attributes[key]=value;}
    append(...elements){for(const element of elements){element.parent=this;this.children.push(element);}}
    focus(){document.activeElement=this;}
    remove(){if(this.parent)this.parent.children=this.parent.children.filter(element=>element!==this);}
  }
  const parent=new Element('main'),trigger=new Element('button'),alreadyInert=new Element('div');alreadyInert.inert=true;parent.append(trigger,alreadyInert);
  document={body:parent,documentElement:{dataset:{}},activeElement:trigger,createElement:tag=>new Element(tag),getElementById:()=>null,addEventListener(){},removeEventListener(){}};
  Object.assign(globalThis,{document,window:{addEventListener(){},removeEventListener(){}},location:{origin:'http://localhost',href:'http://localhost/3D/obs.html'}});
  const changes=[],ui=new ExteriorCinemaUI({parent,onChange:open=>changes.push(open)});
  t.after(()=>{ui.dispose();for(const [key,value]of Object.entries(previous)){if(value===undefined)delete globalThis[key];else globalThis[key]=value;}});
  const message=action=>ui.message({origin:location.origin,source:ui.frame.contentWindow,data:{type:'tara-exterior',action}});
  return{ui,parent,trigger,alreadyInert,changes,message,document};
}

test('loading completion reveals the entry cue while the opening remains open',t=>{
  const f=fixture(t);f.ui.show({opening:true,waitForHost:true});
  assert.equal(new URL(f.ui.frame.src).pathname,'/3D/ship-exterior-cinema.html');
  assert.equal(f.ui.closeButton.hidden,true);assert.equal(f.trigger.inert,true);
  f.message('ready');assert.equal(f.ui.closeButton.hidden,true,'exterior shaders being ready is not cabin readiness');
  f.ui.hostReady();assert.equal(f.ui.open,true);assert.equal(f.ui.closeButton.hidden,false);
  assert.equal(f.ui.closeButton.textContent,'クリックして船内映像を表示');
  assert.deepEqual(f.changes,[true]);
});
test('the cabin boot gate waits for playback rather than the sky or shader readiness',async t=>{
  const f=fixture(t);f.ui.show({opening:true,waitForHost:true});
  let released=false;const waiting=f.ui.whenPlaying().then(()=>{released=true;});
  f.message('space');f.message('ready');await Promise.resolve();assert.equal(released,false);
  f.ui.message({origin:location.origin,source:{},data:{type:'tara-exterior',action:'playing'}});
  await Promise.resolve();assert.equal(released,false,'another frame cannot start cabin loading');
  f.message('playing');await waiting;
  assert.equal(released,true);assert.ok(Number(f.document.documentElement.dataset.openingStartedMs)>0);
  assert.equal(f.ui.hostIsReady,false,'playback does not falsely mark the cabin ready');
});
test('opening startup failure rejects the cabin boot gate',async t=>{
  const f=fixture(t);f.ui.show({opening:true,waitForHost:true});
  const rejected=assert.rejects(f.ui.whenPlaying(),/Opening renderer could not start/);
  f.message('failed');await rejected;
});
test('an old end-of-movie message never enters the cabin, and a click restores the host',t=>{
  const f=fixture(t);f.ui.show({opening:true,waitForHost:true});f.ui.hostReady();
  f.message('done');f.message('done');assert.equal(f.ui.open,true);
  f.ui.closeButton.onclick();assert.equal(f.ui.open,false);assert.equal(f.ui.frame,null);
  assert.equal(f.trigger.inert,false);assert.equal(f.alreadyInert.inert,true);
  assert.equal(f.document.activeElement,f.trigger);assert.deepEqual(f.changes,[true,false]);
});
test('an early close cannot queue automatic entry when loading later finishes',t=>{
  const f=fixture(t);f.ui.show({opening:true,waitForHost:true});f.ui.close();f.message('exit');
  assert.equal(f.ui.open,true);f.ui.hostReady();assert.equal(f.ui.open,true);
  assert.deepEqual(f.changes,[true]);
  f.message('exit');assert.equal(f.ui.open,false,'explicit keyboard exit works once the cabin is ready');
});
test('the in-game exterior uses the study mouse viewer and can return immediately',t=>{
  const f=fixture(t);f.ui.show();assert.equal(f.ui.closeButton.hidden,false);assert.equal(f.ui.closeButton.textContent,'船内に戻る');
  const url=new URL(f.ui.frame.src);assert.equal(url.pathname,'/3D/ship-exterior-study.html');
  assert.equal(url.searchParams.get('viewer'),'free');assert.equal(url.searchParams.get('embedded'),'1');assert.equal(url.searchParams.has('mode'),false);
  f.ui.closeButton.onclick();assert.equal(f.ui.open,false);
  f.ui.show({opening:true,waitForHost:true});f.ui.dispose();assert.equal(f.ui.open,false);assert.equal(f.ui.frame,null);
});
test('the explicit study movie still opens the numbered cinematic viewer',t=>{
  const f=fixture(t);f.ui.show({cinematic:true,core:2.4,phase:70,rpm:5.3});
  const url=new URL(f.ui.frame.src);assert.equal(url.pathname,'/3D/ship-exterior-cinema.html');
  assert.equal(url.searchParams.get('mode'),'view');assert.equal(url.searchParams.get('core'),'2.4');assert.equal(url.searchParams.get('phase'),'70');assert.equal(url.searchParams.get('rpm'),'5.3');
  assert.equal(f.ui.closeButton.textContent,'戻る');
});
