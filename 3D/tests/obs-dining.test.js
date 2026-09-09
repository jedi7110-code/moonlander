import test from 'node:test';
import assert from 'node:assert/strict';
import {MeshStandardMaterial,Vector3} from 'three';
import {createMilo,animateMilo} from '../src/obs/characters.js';
import {mouthPosition} from '../src/obs/dining.js';

const character=()=>createMilo(new Proxy({},{get:()=>new MeshStandardMaterial()}));
const pose=(root,action,time,duration=action==='galley'?6:5,extra={})=>{
  animateMilo(root,{action,moving:false,climbing:false,facing:1,time:19,actionTime:time,actionDuration:duration,...extra});root.updateMatrixWorld(true);
};
const point=(prop,xyz)=>prop.localToWorld(new Vector3(...xyz));
const handAt=(root,index,prop,grip)=>{
  const wrist=root.userData.arms[index].hand.getWorldPosition(new Vector3());
  assert.ok(wrist.distanceTo(point(prop,grip))<1e-8,`wrist misses the ${prop.name} grip`);
};

test('food uses a bowl and spoon, water uses a hollow cup',()=>{
  const root=character(),{dining}=root.userData;
  pose(root,'galley',1.5);assert.equal(dining.bowl.visible,true);assert.equal(dining.spoon.visible,true);assert.equal(dining.mug.visible,false);
  pose(root,'hydro',2);assert.equal(dining.bowl.visible,false);assert.equal(dining.spoon.visible,false);assert.equal(dining.mug.visible,true);
  assert.ok(dining.mug.getObjectByName('Hollow enamel cup'));
});

test('hands remain on the props through the full meal and drink',()=>{
  const root=character(),{dining}=root.userData;
  for(const action of ['galley','hydro'])for(let frame=0;frame<=360;frame++){
    pose(root,action,frame/60,6);
    if(action==='galley'){
      handAt(root,0,dining.bowl,[-.134,-.058,.015]);handAt(root,1,dining.spoon,[.027,.018,.164]);
    }else handAt(root,1,dining.mug,[.097,.067,.019]);
    for(const {arm,elbow,hand} of root.userData.arms)for(const q of [arm.quaternion,elbow.quaternion,hand.quaternion])assert.ok(q.toArray().every(Number.isFinite));
  }
});

test('two spoonfuls meet the lips, with food disappearing on consumption',()=>{
  const root=character(),{body,head,dining}=root.userData;
  for(const cycle of [0,1]){
    pose(root,'galley',( .13+(cycle+.46)/2*.74)*6);
    const mouth=body.localToWorld(mouthPosition(head));
    assert.ok(dining.spoon.getWorldPosition(new Vector3()).distanceTo(mouth)<.016);
    assert.equal(dining.bite.visible,true);
    pose(root,'galley',(.13+(cycle+.52)/2*.74)*6);assert.equal(dining.bite.visible,false);
  }
});

test('the cup tilts around its lip contact and lowers again',()=>{
  const root=character(),{body,head,dining}=root.userData;
  for(const fraction of [.33,.40,.5,.62,.70,.73]){
    pose(root,'hydro',fraction*5);
    const mouth=body.localToWorld(mouthPosition(head));
    assert.ok(point(dining.mug,[0,.067,-.043]).distanceTo(mouth)<.007);
  }
  pose(root,'hydro',2.5);assert.ok(dining.mug.rotation.x<-.9);
  pose(root,'hydro',5);assert.ok(Math.abs(dining.mug.rotation.x)<1e-10);assert.ok(dining.mug.position.y<1);
});

test('the liquid stays thin and inside the cup when raised, tilted, lowered and reused',()=>{
  const root=character(),{water}=root.userData.dining,position=water.geometry.attributes.position;
  const scale=water.scale.toArray();let highest=-Infinity,lowest=Infinity;
  for(let repeat=0;repeat<2;repeat++){
    for(let frame=0;frame<=180;frame++){
      pose(root,'hydro',frame/180*5);
      assert.deepEqual(water.scale.toArray(),scale,'water level must not stretch the surface');
      for(let i=0;i<position.count;i++){
        const p=new Vector3().fromBufferAttribute(position,i).applyMatrix4(water.matrix);
        assert.ok(p.y>-.052&&p.y<.057,'the liquid stays between the inner bottom and rim');
        const innerRadius=.033+(p.y+.052)/.109*.006;
        assert.ok(Math.hypot(p.x,p.z)<innerRadius,'the liquid stays inside the cup wall');
      }
      highest=Math.max(highest,water.position.y);lowest=Math.min(lowest,water.position.y);
    }
    pose(root,null,0,5,{moving:true});
  }
  assert.ok(highest-lowest>.014);assert.ok(water.scale.y<.003);
});

test('prop paths are continuous, pause with action time, and reset after interruption',()=>{
  const root=character(),{dining}=root.userData;
  for(const action of ['galley','hydro']){
    let previous=null;
    const prop=action==='galley'?dining.spoon:dining.mug;
    for(let frame=0;frame<=360;frame++){
      pose(root,action,frame/60,6);
      if(previous)assert.ok(prop.position.distanceTo(previous)<.045);
      previous=prop.position.clone();
    }
    pose(root,action,2);const position=prop.position.toArray(),rotation=prop.quaternion.toArray();
    pose(root,action,2);assert.deepEqual(prop.position.toArray(),position);assert.deepEqual(prop.quaternion.toArray(),rotation);
    pose(root,action,2,6,{health:{needsCare:true,condition:{kind:'injury'}}});
    handAt(root,1,prop,action==='galley'?[.027,.018,.164]:[.097,.067,.019]);
    pose(root,null,0,6,{moving:true});
    for(const prop of [dining.mug,dining.spoon,dining.bowl])assert.equal(prop.visible,false);
    for(const {arm,elbow,hand,fingers,side}of root.userData.arms){
      assert.equal(arm.rotation.y,0);assert.equal(elbow.rotation.y,0);assert.deepEqual(hand.rotation.toArray().slice(0,3),[0,side*Math.PI/2,0]);
      fingers.forEach(finger=>{assert.equal(finger.rotation.x,0);finger.userData.links.forEach(link=>assert.equal(link.rotation.x,0));});
    }
  }
});
