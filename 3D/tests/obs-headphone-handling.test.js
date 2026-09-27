import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Group,Mesh,MeshStandardMaterial,Vector3,Triangle,Box3} from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {headGeometry,MILO_HEAD_FORWARD} from '../src/obs/head.js';
import {loadMiloBody} from '../src/obs/milo-body.js';
import {createMiloToon} from '../src/obs/milo-toon.js';
import {createLoungeStudyActors,applyLoungeStudy} from '../studies/milo/lounge-model.js';

await loadMiloBody('data:application/json;base64,'+(await readFile(new URL('../public/assets/obs/milo/body.json',import.meta.url))).toString('base64'));
const bytes=await readFile(new URL('../public/assets/obs/head/LeePerrySmith.glb',import.meta.url));
const gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
const scan=gltf.scene.getObjectByName('LeePerrySmith').geometry;
function setup(){
  const material=new MeshStandardMaterial(),head=new Group();head.scale.setScalar(.055);head.userData.faceForward=MILO_HEAD_FORWARD;
  const face=new Mesh(headGeometry(scan,MILO_HEAD_FORWARD/.055),material);face.name='Milo scanned head';head.add(face);
  const actors=createLoungeStudyActors(new Proxy({},{get:()=>material}),head);new Group().add(actors.milo,actors.furniture);return actors;
}

test('both elbows remain on their own side throughout headphone pickup and return',()=>{
  const actors=setup();
  for(let frame=0;frame<=27*60;frame++){
    const time=frame/60;applyLoungeStudy(actors,'music',time);
    const {body,head,arms}=actors.milo.userData;
    for(const {elbow,hand,side}of arms){
      const e=body.worldToLocal(elbow.getWorldPosition(new Vector3()));
      const wrist=body.worldToLocal(hand.getWorldPosition(new Vector3()));
      assert.ok(e.x*side>.18,`elbow crosses the torso at ${time}`);
      if(wrist.y>head.position.y-.08&&wrist.z<head.position.z+.16)assert.ok(wrist.x*side>.12,`forearm crosses the face at ${time}`);
    }
  }
});

function cupSurface(mesh){
  const {position}=mesh.geometry.attributes,index=mesh.geometry.index.array,triangles=[];
  for(let i=0;i<index.length;i+=3){
    const points=[0,1,2].map(k=>new Vector3().fromBufferAttribute(position,index[i+k]).multiply(mesh.scale).add(mesh.position));
    triangles.push({triangle:new Triangle(...points),box:new Box3().setFromPoints(points)});
  }
  return{mesh,triangles};
}
function surfaceDistance(point,{mesh,triangles}){
  let distance=Infinity;const nearest=new Vector3();
  for(const {triangle,box}of triangles){
    if(box.distanceToPoint(point)>=distance)continue;
    triangle.closestPointToPoint(point,nearest);distance=Math.min(distance,nearest.distanceTo(point));
  }
  return point.clone().sub(mesh.position).divide(mesh.scale).length()<1?-distance:distance;
}

test('real finger pads and opposing thumbs touch the earcups without burying the hands',()=>{
  const actors=setup(),phones=actors.furniture.userData.loungeProps.phones;
  const surfaces=[-1,1].map(side=>['Headphone cushion ','Headphone shell '].map(name=>cupSurface(phones.getObjectByName(name+side))));
  for(const time of [9.01,9.15,9.9,10.86,11.1,16,16.8,17.65]){
    applyLoungeStudy(actors,'music',time);
    const skin=actors.milo.userData.bodySkin,{position,armRegion,skinIndex,skinWeight}=skin.geometry.attributes;skin.skeleton.update();
    const contacts=[{finger:Infinity,thumb:Infinity},{finger:Infinity,thumb:Infinity}];
    for(let i=0;i<position.count;i++){
      if(position.getY(i)>.91||armRegion.getX(i)<.95)continue;
      const side=position.getX(i)<0?0:1;
      const point=phones.worldToLocal(skin.applyBoneTransform(i,new Vector3().fromBufferAttribute(position,i)).applyMatrix4(skin.matrixWorld));
      const distance=Math.min(...surfaces[side].map(s=>surfaceDistance(point,s)));
      assert.ok(distance>-.003,`hand penetrates the earcup at ${time}: ${distance}`);
      let weight=-1,name='';
      for(let k=0;k<4;k++)if(skinWeight.array[i*4+k]>weight){weight=skinWeight.array[i*4+k];name=skin.skeleton.bones[skinIndex.array[i*4+k]].name;}
      const part=name.includes('thumb')?'thumb':name.includes('finger')?'finger':null;
      if(part)contacts[side][part]=Math.min(contacts[side][part],Math.abs(distance));
    }
    for(const hand of contacts)for(const distance of Object.values(hand))assert.ok(distance<.004,`grip floats away at ${time}: ${distance}`);
  }
});

test('the worn cushions cover the scanned ears and remain attached as the head moves',()=>{
  const actors=setup(),head=actors.milo.userData.head,phones=actors.furniture.userData.loungeProps.phones;
  const source=scan.attributes.position,ears=[];
  for(let i=0;i<source.count;i++)if(Math.abs(source.getX(i))>1.7&&source.getY(i)>.5){
    ears.push(new Vector3(source.getX(i)*.055,source.getY(i)*.055,source.getZ(i)*.055+MILO_HEAD_FORWARD));
  }
  assert.ok(ears.length>100);
  for(const time of [12.25,13.4,14.53]){
    applyLoungeStudy(actors,'music',time);
    for(const ear of ears){
      const point=phones.worldToLocal(ear.clone().applyQuaternion(head.quaternion).add(head.position).applyMatrix4(head.parent.matrixWorld));
      const side=Math.sign(ear.x),pad=phones.getObjectByName('Headphone cushion '+side),dy=(point.y-pad.position.y)/pad.scale.y,dz=(point.z-pad.position.z)/pad.scale.z;
      assert.ok(dy*dy+dz*dz<1,'the whole ear must fit inside the cushion outline');
      const outside=side*pad.position.x+pad.scale.x*Math.sqrt(1-dy*dy-dz*dz);
      assert.ok(outside>side*point.x+.003,'the cushion must cover the outer ear');
    }
  }
});

test('listening pushes the head forward once per 95 BPM beat with very little vertical bob',()=>{
  const actors=setup(),head=actors.milo.userData.head,beat=60/95,start=12.25;
  const pose=time=>{applyLoungeStudy(actors,'music',time);return{position:head.position.clone(),rotation:head.quaternion.clone()};};
  const rest=pose(start),forward=pose(start+beat/2),next=pose(start+beat*1.5);
  assert.ok(forward.position.z-rest.position.z>.025&&forward.position.z-rest.position.z<.032,'visible forward neck motion');
  assert.ok(Math.abs(forward.position.y-rest.position.y)<.004,'avoid a large up-and-down nod');
  assert.ok(forward.rotation.angleTo(rest.rotation)<.04,'keep the gaze nearly level');
  assert.ok(next.position.distanceTo(forward.position)<1e-8,'repeat every 60/95 seconds');
  assert.ok(pose(start+beat).position.distanceTo(rest.position)<1e-8,'return between beats');
  for(let frame=0;frame<=90;frame++){
    applyLoungeStudy(actors,'music',12.25+frame/60);
    const phones=actors.furniture.userData.loungeProps.phones;
    const offset=head.worldToLocal(phones.getWorldPosition(new Vector3())).multiplyScalar(.055);
    assert.ok(offset.distanceTo(new Vector3(0,.088,.002+MILO_HEAD_FORWARD))<1e-7,'headphones follow the neck motion');
  }
});

test('the actual neck surface stays fixed at the collar while the skull moves to the beat',()=>{
  const actors=setup(),{body,head}=actors.milo.userData,mesh=head.getObjectByName('Milo scanned head');
  const toon=createMiloToon(actors.milo),outline=head.children.find(child=>child.name==='Milo toon outline');
  assert.equal(outline.morphTargetInfluences,mesh.morphTargetInfluences,'ink follows the same anchored neck');
  const position=mesh.geometry.attributes.position,base=[],skull=[];
  for(let i=0;i<position.count;i++){
    if(position.getY(i)<=-1.35)base.push(i);
    if(position.getY(i)>1)skull.push(i);
  }
  assert.ok(base.length>100&&skull.length>100,'sample both the collar and the skull');
  const point=i=>{
    const p=body.worldToLocal(mesh.getVertexPosition(i,new Vector3()).applyMatrix4(mesh.matrixWorld));
    // The collar expands slightly with the torso's breathing.
    p.x/=actors.milo.userData.chest.scale.x;return p;
  };
  applyLoungeStudy(actors,'music',12.25);
  const rest=base.map(point),top=point(skull[0]);
  for(let frame=0;frame<=60;frame++){
    applyLoungeStudy(actors,'music',12.25+frame/60);
    for(let i=0;i<base.length;i+=17)assert.ok(point(base[i]).distanceTo(rest[i])<1e-7,'neck root separates from the torso');
  }
  applyLoungeStudy(actors,'music',12.25+30/95);
  assert.ok(point(skull[0]).z-top.z>.025,'the skull still advances above the anchored neck');
  applyLoungeStudy(actors,'tablet',12.25);
  assert.equal(mesh.morphTargetInfluences[0],0,'reset neck bend when leaving the music activity');
  toon.dispose();
});

test('listening alternates relaxed hands one at a time at 95 BPM with straight wrists',()=>{
  const actors=setup(),{body,arms,bodySkin:skin}=actors.milo.userData,beat=60/95;
  const wrists=time=>{
    applyLoungeStudy(actors,'music',time);
    return arms.map(r=>body.worldToLocal(r.hand.getWorldPosition(new Vector3())));
  };
  const rest=wrists(12.25),first=wrists(12.25+beat/2),second=wrists(12.25+beat*1.5),repeat=wrists(12.25+beat*2.5);
  for(let i=0;i<arms.length;i++){
    const active=arms[i].side===-1?first:second,inactive=arms[i].side===-1?second:first;
    assert.ok(active[i].y-rest[i].y>.02&&active[i].z-rest[i].z>.02,'each fist pulses on its own beat');
    assert.ok(inactive[i].distanceTo(rest[i])<1e-7,'the other fist holds its guard');
    assert.ok(first[i].distanceTo(repeat[i])<1e-7,'the same hand repeats every two beats');
  }
  for(let frame=0;frame<=90;frame++){
    const current=wrists(12.25+frame/60);skin.skeleton.update();
    assert.ok(current.some((p,i)=>p.distanceTo(rest[i])<1e-7),'never pulse both hands at once');
    for(const rig of arms){
      const wrist=rig.hand.getWorldPosition(new Vector3()),elbow=rig.elbow.getWorldPosition(new Vector3());
      const forearm=wrist.clone().sub(elbow).normalize(),knuckles=rig.hand.localToWorld(new Vector3(0,-1,0)).sub(wrist).normalize();
      assert.ok(forearm.angleTo(knuckles)<.01,'guard wrist follows the forearm without folding');
    }
    const {position,armRegion}=skin.geometry.attributes;
    for(let i=0;i<position.count;i+=7){
      if(position.getY(i)>.91||armRegion.getX(i)<.95)continue;
      const hand=body.worldToLocal(skin.getVertexPosition(i,new Vector3()).applyMatrix4(skin.matrixWorld));
      assert.ok(hand.x*Math.sign(position.getX(i))>.07,'relaxed fingers retain at least 14 cm of separation');
      assert.ok(hand.z>.17&&hand.y>1.25&&hand.y<1.50,`hand stays clear of the chest and table: ${hand.toArray()}`);
    }
  }
});
