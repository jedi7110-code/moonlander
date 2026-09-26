import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {MeshStandardMaterial,Vector3} from 'three';
import {loadMiloBody} from '../src/obs/milo-body.js';
import {createMilo,animateMilo} from '../src/obs/characters.js';
import {cloneMiloSkinGeometry} from '../src/obs/milo-elbow.js';
import {LOUNGE_SEAT} from '../src/obs/layout.js';
import {setLadderHandFit} from '../studies/milo/ladder-hand-fit.js';
import {applyLadderStudy} from '../studies/milo/ladder-study.js';

await loadMiloBody(`data:application/json;base64,${(await readFile(new URL('../public/assets/obs/milo/body.json',import.meta.url))).toString('base64')}`);
const create=()=>createMilo(new Proxy({},{get:()=>new MeshStandardMaterial()}));
function pose(root,leisure,time=3){
  animateMilo(root,{action:'lounge',leisure,time,actionTime:time,actionDuration:36,moving:false});
  root.position.z=LOUNGE_SEAT.depth;root.updateMatrixWorld(true);root.userData.bodySkin.skeleton.update();
}
function hands(root,space=null){
  const skin=root.userData.bodySkin,{position,armRegion,skinIndex,skinWeight}=skin.geometry.attributes;
  const result=[{palm:[],thumb:[],fingers:[]},{palm:[],thumb:[],fingers:[]}];
  for(let i=0;i<position.count;i++){
    if(position.getY(i)>=.91||armRegion.getX(i)<.95)continue;
    let max=-1,name='';
    for(let j=0;j<4;j++)if(skinWeight.array[i*4+j]>max){max=skinWeight.array[i*4+j];name=skin.skeleton.bones[skinIndex.array[i*4+j]].name;}
    const part=name.includes('thumb')?'thumb':name.includes('finger')?'fingers':'palm';
    const p=skin.applyBoneTransform(i,new Vector3().fromBufferAttribute(position,i)).applyMatrix4(skin.matrixWorld);
    if(space)space.worldToLocal(p);
    result[position.getX(i)<0?0:1][part].push(p);
  }
  return result;
}
function tabletDistance(p){
  const q=[Math.abs(p.x)-.107,Math.abs(p.y),Math.abs(p.z)-.142];
  return Math.hypot(...q.map(v=>Math.max(v,0)))+Math.min(0,Math.max(...q))-.008;
}

test('seated palms and fingers rest on the real lounge tabletop without clipping or reaching past its edge',()=>{
  const root=create(),top=LOUNGE_SEAT.top+.32;
  for(const yaw of [0,.15]){
    root.rotation.y=yaw;pose(root,null);
    for(const hand of hands(root)){
      const palmHeight=Math.min(...hand.palm.map(p=>p.y));
      assert.ok(palmHeight>=top&&palmHeight<top+.005);
      const points=Object.values(hand).flat();
      assert.ok(points.every(p=>p.y>=top-.001));
      assert.ok(points.every(p=>p.z>.51&&p.z<1.31&&Math.abs(p.x+.11)<.755));
    }
  }
});

test('both hands support the lower tablet back with opposing thumbs throughout reading',()=>{
  const root=create();
  for(const time of [0,.4,.8,1.2,1.5,3,34.5,35.2,36]){
    pose(root,'tablet',time);const tablet=root.userData.leisure.tablet;
    for(const [side,hand]of hands(root,tablet).entries()){
      const points=Object.values(hand).flat();
      assert.ok(points.every(p=>p.toArray().every(Number.isFinite)));
      assert.ok(points.every(p=>tabletDistance(p)>-.0015),'skin must not pass through the tablet');
      assert.ok(Math.min(...hand.fingers.map(tabletDistance))<.003,'finger pads support the back');
      assert.ok(Math.min(...hand.thumb.map(tabletDistance))<.003,'thumb contacts the rounded edge');
      assert.ok(hand.thumb.some(p=>p.y>.008),'thumb opposes the fingers across the edge');
      assert.ok(hand.fingers.every(p=>side?p.x>.005:p.x<-.005),'left and right fingers do not overlap');
    }
  }
});

test('tablet side grip keeps the hand aligned with the forearm instead of folding it inward',()=>{
  const root=create();let previous;
  for(let i=0;i<=180;i++){
    pose(root,'tablet',i/120);
    const positions=[];
    for(const {side,arm,elbow,hand}of root.userData.arms){
      const wrist=hand.getWorldPosition(new Vector3());
      const forearm=wrist.clone().sub(elbow.getWorldPosition(new Vector3())).normalize();
      const fingers=hand.localToWorld(new Vector3(0,-1,0)).sub(wrist).normalize();
      const bend=Math.acos(Math.max(-1,Math.min(1,forearm.dot(fingers))));
      assert.ok(bend<.001,`wrist bends ${bend*180/Math.PI} degrees`);
      const chest=root.userData.chest;
      const shoulder=new Vector3(side*.207,1.488,0).applyQuaternion(chest.quaternion).add(chest.position);
      assert.ok(arm.position.distanceTo(shoulder)<1e-8,'shoulders follow the torso rather than moving independently to fake reach');
      positions.push(root.userData.body.worldToLocal(wrist));
    }
    if(previous)positions.forEach((p,j)=>assert.ok(p.distanceTo(previous[j])<.005));
    previous=positions;
  }
});

test('tablet thumb opposition resets for walking, sleep, medical and other seated modes',()=>{
  for(const action of [null,'bunk','medical','console','lounge']){
    const root=create(),fresh=create(),original=root.userData.bodySkin.geometry;
    const positions=cloneMiloSkinGeometry(root.userData.bodySkin).attributes.position.array.slice();pose(root,'tablet');
    assert.notEqual(root.userData.bodySkin.geometry,original,'tablet closes the finger fan on a separate geometry');
    for(const model of [root,fresh])animateMilo(model,{action,moving:!action,time:17,actionTime:17,actionDuration:40,leisure:action==='lounge'?'music':null});
    for(let i=0;i<2;i++)for(const name of ['arm','elbow','hand','thumb']){
      const a=root.userData.arms[i][name],b=fresh.userData.arms[i][name];
      assert.deepEqual(a.position.toArray(),b.position.toArray());assert.deepEqual(a.quaternion.toArray(),b.quaternion.toArray());
    }
    assert.equal(root.userData.bodySkin.geometry,original,'other actions restore their original hand shape');
    assert.deepEqual(cloneMiloSkinGeometry(root.userData.bodySkin).attributes.position.array,positions,'the neutral skin is unchanged; only the current elbow crease animates');
  }
});

test('study switches between tablet and ladder fits without cloning an already fitted hand',()=>{
  for(const sequence of [['tablet','ladder','tablet','ladder'],['ladder','tablet','ladder','tablet']]){
    const root=create(),source=root.userData.bodySkin.geometry;
    for(const mode of sequence){
      setLadderHandFit(root,false);
      if(mode==='tablet')pose(root,'tablet');
      else{animateMilo(root,{time:0,moving:false,facing:1});applyLadderStudy(root,0);}
      const fit=root.userData[mode==='tablet'?'tabletHandFit':'ladderHandFit'];
      assert.equal(fit.original,source);
      assert.equal(root.userData.bodySkin.geometry,fit.geometry);
    }
  }
});
