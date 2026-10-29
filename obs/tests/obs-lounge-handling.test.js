import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Group,MeshStandardMaterial,Vector3,Quaternion,MathUtils} from 'three';
import {loadMiloBody} from '../src/obs/milo-body.js';
import {createMilo,animateMilo} from '../src/obs/characters.js';
import {createLoungeTable} from '../src/obs/ship.js';
import {updateTableLeisureProps} from '../src/obs/lounge-table-props.js';
import {LOUNGE_SEAT,LOUNGE_TABLE} from '../src/obs/layout.js';
import {LOUNGE_PROP_KEYS,LOUNGE_STOW_SECONDS,loungeHandlingPhase} from '../src/obs/lounge-handling.js';
import {teaserHandCenter} from '../src/obs/cat-teaser-pose.js';
import {tabletGripContact} from '../src/obs/tablet-pose.js';
import {padSurfaceDistance} from './helpers/pad-surface.js';

await loadMiloBody(`data:application/json;base64,${(await readFile(new URL('../public/assets/obs/milo/body.json',import.meta.url))).toString('base64')}`);
function setup(){
  const material=new MeshStandardMaterial(),m=new Proxy({},{get:()=>material});
  const root=createMilo(m),table=createLoungeTable(m),scene=new Group();
  scene.add(root,table);root.position.set(8.36,0,LOUNGE_SEAT.depth);root.rotation.y=.15;table.position.set(LOUNGE_TABLE.x,0,LOUNGE_TABLE.z);
  const docks=table.userData.loungeProps;
  const pose=(mode,time,stow=null)=>{
    animateMilo(root,{action:'lounge',leisure:mode,time,actionTime:time,actionDuration:40,moving:false,dt:0,loungeDocks:docks,loungeStow:stow});
    updateTableLeisureProps(docks,root.userData.leisure);scene.updateMatrixWorld(true);
  };
  return{root,docks,pose};
}

test('the same visible objects move continuously from the table to the hands and return to their original pose',()=>{
  for(const mode of Object.keys(LOUNGE_PROP_KEYS)){
    const {root,docks,pose}=setup(),prop=docks[LOUNGE_PROP_KEYS[mode]];
    pose(mode,0);const home=prop.getWorldPosition(new Vector3()),rotation=prop.getWorldQuaternion(new Quaternion());let previous=home.clone();
    for(let i=0;i<=(4+LOUNGE_STOW_SECONDS)*60;i++){
      const time=i/60,stow=time>4?{age:time-4}:null;
      pose(mode,Math.min(time,4),stow);
      const position=prop.getWorldPosition(new Vector3());
      assert.ok(position.distanceTo(previous)<.025,`${mode}: no teleport at ${time}`);previous.copy(position);
      for(const key of Object.values(LOUNGE_PROP_KEYS)){
        assert.equal(docks[key].visible,true);assert.equal(root.userData.leisure[key].visible,false);
      }
      const phase=loungeHandlingPhase(Math.min(time,4),mode,stow);
      if(phase.reach>.999&&phase.grip>.99)for(const rig of mode==='cat'?[root.userData.arms[0]]:root.userData.arms){
        const actual=mode==='tablet'?rig.hand.getWorldPosition(new Vector3()):rig.hand.localToWorld(mode==='cat'?teaserHandCenter(rig,phase.lift):new Vector3(0,-.078,-.015));
        const contact=mode==='tablet'?tabletGripContact(rig.side):mode==='cat'?new Vector3(.0425,.012,0):new Vector3(rig.side*.159,-.012,0);
        assert.ok(actual.distanceTo(prop.localToWorld(contact))<.002,`${mode}: hands stay attached at ${time}`);
      }
    }
    assert.ok(previous.distanceTo(home)<1e-8);assert.ok(prop.getWorldQuaternion(new Quaternion()).angleTo(rotation)<1e-7);
    const wrists=root.userData.arms.map(r=>r.hand.getWorldPosition(new Vector3()));
    pose(null,4);
    root.userData.arms.forEach((r,i)=>assert.ok(r.hand.getWorldPosition(new Vector3()).distanceTo(wrists[i])<1e-7,'hands finish in the normal seated pose'));
  }
});

test('interrupting a reach or a lift starts the return at the current object position',()=>{
  for(const mode of Object.keys(LOUNGE_PROP_KEYS))for(const time of [.6,1.9,8]){
    const {root,docks,pose}=setup(),prop=docks[LOUNGE_PROP_KEYS[mode]];
    pose(mode,0);const home=prop.getWorldPosition(new Vector3());
    pose(mode,time);const before=prop.getWorldPosition(new Vector3()),rotation=prop.getWorldQuaternion(new Quaternion());
    pose(mode,time,{age:0});assert.ok(prop.getWorldPosition(new Vector3()).distanceTo(before)<1e-8);
    assert.ok(prop.getWorldQuaternion(new Quaternion()).angleTo(rotation)<1e-7);
    let wrists=root.userData.arms.map(r=>r.hand.getWorldPosition(new Vector3()));
    for(let frame=1;frame<=LOUNGE_STOW_SECONDS*60;frame++){
      pose(mode,time,{age:frame/60});
      const next=root.userData.arms.map(r=>r.hand.getWorldPosition(new Vector3()));
      next.forEach((p,i)=>assert.ok(p.distanceTo(wrists[i])<.025,`${mode}: no arm jump when interrupted at ${time}`));wrists=next;
    }
    pose(mode,time,{age:LOUNGE_STOW_SECONDS});assert.ok(prop.getWorldPosition(new Vector3()).distanceTo(home)<1e-8);
  }
});

test('the tablet stays between the actual finger pads and opposing thumbs while it tilts',()=>{
  const {root,docks,pose}=setup(),tablet=docks.tablet;
  for(const [time,stow]of [[1.15,null],[1.9,null],[3.1,null],[4,null],[4,{age:1.6}],[4,{age:2.7}]]){
    pose('tablet',time,stow);
    const skin=root.userData.bodySkin,{position,armRegion,skinIndex,skinWeight}=skin.geometry.attributes;
    skin.skeleton.update();const contacts=[{finger:Infinity,thumb:Infinity},{finger:Infinity,thumb:Infinity}];
    for(let i=0;i<position.count;i++){
      if(position.getY(i)>=.91||armRegion.getX(i)<.95)continue;
      const p=tablet.worldToLocal(skin.applyBoneTransform(i,new Vector3().fromBufferAttribute(position,i)).applyMatrix4(skin.matrixWorld));
      const distance=padSurfaceDistance(p);
      assert.ok(distance>-.0015,'skin must not pass through the tablet');
      let weight=-1,name='';
      for(let j=0;j<4;j++)if(skinWeight.array[i*4+j]>weight){weight=skinWeight.array[i*4+j];name=skin.skeleton.bones[skinIndex.array[i*4+j]].name;}
      const part=name.includes('thumb')?'thumb':name.includes('finger')?'finger':null;
      if(part){const contact=contacts[position.getX(i)<0?0:1];contact[part]=Math.min(contact[part],distance);}
    }
    for(const contact of contacts){assert.ok(contact.finger<.003,'finger pads support the protective side grips');assert.ok(contact.thumb<.003,'thumb contacts the edge');}
  }
});

test('the supported elbows and wrists follow continuous, comfortable paths while picking up and putting away',()=>{
  for(const mode of Object.keys(LOUNGE_PROP_KEYS)){
    const {root,pose}=setup();let previous=[];
    for(let frame=0;frame<=(4+LOUNGE_STOW_SECONDS)*60;frame++){
      const t=frame/60;pose(mode,Math.min(t,4),t>4?{age:t-4}:null);
      const sample=root.userData.arms.map(r=>{
        const wrist=r.hand.getWorldPosition(new Vector3()),elbow=r.elbow.getWorldPosition(new Vector3());
        const forearm=wrist.clone().sub(elbow).normalize(),fingers=r.hand.localToWorld(new Vector3(0,-1,0)).sub(wrist).normalize();
        const bend=MathUtils.radToDeg(Math.acos(MathUtils.clamp(forearm.dot(fingers),-1,1)));
        assert.ok(bend<65,`${mode} ${r.side} at ${t}: wrist bend ${bend}`);
        assert.ok(-r.elbow.rotation.x<MathUtils.degToRad(145),`${mode} ${r.side} at ${t}: elbow overfold`);
        assert.ok(Math.abs(r.elbow.quaternion.y)+Math.abs(r.elbow.quaternion.z)<1e-8,'elbow stays on the approved hinge axis');
        return{wrist,rotations:[r.arm,r.elbow,r.hand].map(j=>j.quaternion.clone())};
      });
      if(previous.length)sample.forEach((s,i)=>{
        assert.ok(s.wrist.distanceTo(previous[i].wrist)<.02,`${mode} hand ${i} jumps at ${t}`);
        s.rotations.forEach((q,j)=>assert.ok(q.angleTo(previous[i].rotations[j])<MathUtils.degToRad(8),`${mode} joint ${i}/${j} jumps at ${t}`));
      });
      previous=sample;
    }
    pose(null,4);
    root.userData.arms.forEach((r,i)=>[r.arm,r.elbow,r.hand].forEach((joint,j)=>assert.ok(joint.quaternion.angleTo(previous[i].rotations[j])<1e-7,'release finishes at the normal seated joint angles')));
  }
});
