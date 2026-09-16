import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {MeshStandardMaterial,Vector3} from 'three';
import {createMilo,animateMilo} from '../src/obs/characters.js';
import {applyMocapWalk} from '../src/obs/mocap-walk.js';

const clip=JSON.parse(await readFile(new URL('../src/obs/milo-walk-cycle.json',import.meta.url)));
const character=()=>createMilo(new Proxy({},{get:(o,k)=>o[k]??=new MeshStandardMaterial()}));
const idle={time:0,moving:false,climbing:false,facing:1,action:null};
const capture=rig=>[...rig.fingers.flatMap(f=>[f.rotation.x,...f.userData.links.map(l=>l.rotation.x)]),...rig.thumb.quaternion.toArray(),...rig.thumb.userData.ip.quaternion.toArray()];

test('relaxed hands curl toward the palm, progressively from index to little finger on both sides',()=>{
  const root=character();animateMilo(root,idle);root.updateMatrixWorld(true);
  for(const {hand,fingers,thumb,side}of root.userData.arms){
    const ordered=side<0?[...fingers].reverse():fingers;let previous=0;
    for(const finger of ordered){
      const links=finger.userData.links,total=finger.rotation.x+links[0].rotation.x+links[1].rotation.x;
      assert.ok(total>previous&&total<.36,'a shallow cascade, not a curled fist');previous=total;
      const tip=hand.worldToLocal(links[1].localToWorld(new Vector3(0,-.009,0)));
      assert.ok(tip.z<finger.position.z-.002,'the fingertip still returns gently toward the palm');
      assert.ok(finger.rotation.x>=-.08&&finger.rotation.x<=0,'the proximal segment opens slightly instead of curling into the trousers');
      assert.ok(links[0].rotation.x>=.24&&links[0].rotation.x<=.36,'the visible bend is concentrated at the PIP');
      assert.ok(links[1].rotation.x<=.035,'the tip continues the middle segment without hooking inward');
      assert.ok(links[0].rotation.x>links[1].rotation.x,'middle knuckle bends more than the fingertip');
    }
    assert.equal(thumb.rotation.x,.16);assert.equal(thumb.rotation.z,side*.10);
    assert.equal(thumb.userData.ip.rotation.x,.28,'the extra curl belongs to the thumb tip, not its base');
  }
});
test('idle and both walking modes share the same relaxed fingers without pose accumulation',()=>{
  const root=character();animateMilo(root,idle);const expected=root.userData.arms.map(capture);
  for(let i=0;i<24;i++){
    animateMilo(root,{...idle,time:i/24,moving:true,walkDistance:i/24});assert.deepEqual(root.userData.arms.map(capture),expected);
    applyMocapWalk(root,clip,i/24*clip.duration);assert.deepEqual(root.userData.arms.map(capture),expected);
  }
});
test('dedicated grip poses remain independent and release back to relaxed hands',()=>{
  const root=character(),fresh=character();animateMilo(root,idle);const relaxed=root.userData.arms.map(capture);
  for(const extra of [{climbing:true,moving:true},{action:'galley',actionTime:3,actionDuration:6},{action:'hydro',actionTime:2,actionDuration:5},{action:'gym',actionTime:2},{action:'console'}]){
    animateMilo(root,{...idle,...extra});animateMilo(fresh,{...idle,...extra});assert.deepEqual(root.userData.arms.map(capture),fresh.userData.arms.map(capture));
    animateMilo(root,idle);assert.deepEqual(root.userData.arms.map(capture),relaxed);
  }
});
