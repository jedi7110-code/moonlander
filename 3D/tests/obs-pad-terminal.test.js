import test from 'node:test';
import assert from 'node:assert/strict';
import {Group,Box3,Vector3,MeshStandardMaterial} from 'three';
import {createPadModel,createPadTerminal} from '../src/obs/pad-terminal.js';
import {PAD_FINISH,PAD_SCREENS,nextPadScreen,FALL_LINE_URL,paintPadScreen} from '../src/obs/pad-screen.js';
import {createTableLeisureProps,updateTableLeisureProps} from '../src/obs/lounge-table-props.js';

test('live pads use the approved finish, retain the study bounds and batch static parts',()=>{
  const study=createPadModel(),live=createPadTerminal({random:()=>.5});
  study.root.rotation.y=Math.PI;
  assert.equal(study.shell.color.getHexString(),'3d4849');assert.equal(study.wear.visible,false);assert.equal(PAD_FINISH.brightness,.85);
  const a=new Box3().setFromObject(study.root),b=new Box3().setFromObject(live);
  assert.ok(a.min.distanceTo(b.min)<1e-7&&a.max.distanceTo(b.max)<1e-7);
  assert.ok(b.getSize(new Vector3()).y<.04);let count=0;live.traverse(o=>{if(o.isMesh)count++;});assert.ok(count<30,`only ${count} material batches`);
  const other=createPadTerminal();assert.notEqual(live.getObjectByName('Inset display').material,other.getObjectByName('Inset display').material);
});
test('random pages do not repeat and the lounge page includes all games plus FALL-LINE',()=>{
  for(const prior of [null,...PAD_SCREENS])for(const random of [0,.49,.99]){const next=nextPadScreen(prior,()=>random);assert.ok(PAD_SCREENS.includes(next));assert.notEqual(next,prior);}
  const text=[],ctx=new Proxy({fillText:value=>text.push(value)},{get:(t,k)=>t[k]??(()=>{}),set:(t,k,v)=>(t[k]=v,true)});
  paintPadScreen({width:768,height:936,getContext:()=>ctx},{page:'lounge'});
  for(const title of ['チェス','ポーカー','リバーシ','小説を読む','FALL-LINE'])assert.ok(text.includes(title));
  assert.equal(FALL_LINE_URL,'/story/saga.html');
});
test('the visible table pad changes page once per pickup and rests on the tabletop',()=>{
  const m=new Proxy({},{get:()=>new MeshStandardMaterial()}),table=new Group(),props=createTableLeisureProps(table,m,.8);
  const held={tablet:createPadTerminal(),phones:new Group(),toy:new Group()};new Group().add(...Object.values(held));
  for(const p of Object.values(held))p.visible=false;
  assert.ok(Math.abs(new Box3().setFromObject(props.tablet).min.y-.8)<1e-7);
  const initial=props.tablet.userData.padPage;held.tablet.visible=true;updateTableLeisureProps(props,held);const next=props.tablet.userData.padPage;assert.notEqual(next,initial);
  for(let i=0;i<10;i++){held.tablet.visible=true;updateTableLeisureProps(props,held);assert.equal(props.tablet.userData.padPage,next);}
  updateTableLeisureProps(props,held);held.tablet.visible=true;updateTableLeisureProps(props,held);assert.notEqual(props.tablet.userData.padPage,next);
});
