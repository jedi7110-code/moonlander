import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Group,Mesh,MeshStandardMaterial,Vector3,Quaternion,Box3,MathUtils} from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {headGeometry,MILO_HEAD_FORWARD,createMiloEye,MILO_EYE_OPENINGS} from '../src/obs/head.js';
import {loadMiloBody} from '../src/obs/milo-body.js';
import {animateMilo} from '../src/obs/characters.js';
import {createMiloToon} from '../src/obs/milo-toon.js';
import {createLoungeStudyActors,applyLoungeStudy} from '../studies/milo/lounge-model.js';
import {HeadLookRig} from '../src/obs/first-person-look.js';
import {updateMiloNeck} from '../src/obs/milo-neck.js';

await loadMiloBody('data:application/json;base64,'+(await readFile(new URL('../public/assets/obs/milo/body.json',import.meta.url))).toString('base64'));
const bytes=await readFile(new URL('../public/assets/obs/head/LeePerrySmith.glb',import.meta.url));
const gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
const scan=gltf.scene.getObjectByName('LeePerrySmith').geometry;
function setup(withEyes=false){
  const material=new MeshStandardMaterial(),head=new Group();head.scale.setScalar(.055);
  const face=new Mesh(headGeometry(scan,MILO_HEAD_FORWARD/.055),material);face.name='Milo scanned head';head.add(face);
  if(withEyes)for(const opening of MILO_EYE_OPENINGS){const eye=createMiloEye(scan,opening);eye.position.z=MILO_HEAD_FORWARD/.055;head.add(eye);}
  const actors=createLoungeStudyActors(new Proxy({},{get:()=>material}),head);new Group().add(actors.milo,actors.furniture);return actors;
}

test('first-person looking anchors the standing neck to its collar and restores the normal animation',()=>{
  const {milo}=setup(),{body,head,spine,neckProtraction:fit}=milo.userData;
  animateMilo(milo,{time:0,moving:false});
  const rig=new HeadLookRig(head,body,new Vector3(0,1.69,2.55),{neckAnchor:new Vector3(0,-.03,.009)});
  const samples=fit.vertices.filter(v=>fit.restPosition[v.i*3+1]<=-1.35).filter((_,i)=>i%17===0);
  assert.ok(samples.length>5);
  for(const [yaw,pitch]of [[1.3,.7],[-1.3,-.87],[0,0]]){
    rig.restore();animateMilo(milo,{time:0,moving:false});rig.apply(yaw,pitch);updateMiloNeck(milo,{attached:true});milo.updateMatrixWorld(true);
    for(const {i,spineMix}of samples){
      const bind=new Vector3().fromArray(fit.restPosition,i*3).applyMatrix4(fit.restMatrix);
      const expected=bind.clone().applyMatrix4(spine.drivers.at(-2).matrix).lerp(bind.clone().applyMatrix4(spine.drivers.at(-1).matrix),spineMix);
      const actual=body.worldToLocal(fit.mesh.getVertexPosition(i,new Vector3()).applyMatrix4(fit.mesh.matrixWorld));
      assert.ok(actual.distanceTo(expected)<1e-7,'POV neck stays attached at the largest look angles');
    }
  }
  rig.restore();animateMilo(milo,{time:0,moving:false});
  assert.deepEqual(fit.mesh.geometry.attributes.position.array,fit.restPosition);
  assert.deepEqual(fit.mesh.geometry.attributes.normal.array,fit.restNormal);
});

test('after lifting, Milo follows the moving rod tip from the actual eyes with an anchored, continuous neck',()=>{
  const actors=setup(true),{head}=actors.milo.userData,toy=actors.furniture.userData.loungeProps.toy;
  const eyes=[];head.traverse(mesh=>{if(mesh.name==='Fitted Milo eye surface')eyes.push(mesh);});
  const eyePosition=()=>eyes.reduce((sum,eye)=>sum.add(eye.localToWorld(new Vector3().fromBufferAttribute(eye.geometry.attributes.position,0))),new Vector3()).multiplyScalar(1/eyes.length);
  let previous=null,first=null,maxTurn=0;
  for(let frame=0;frame<=11*60;frame++){
    const time=8+frame/60;applyLoungeStudy(actors,'cat',time);
    const rotation=head.getWorldQuaternion(new Quaternion());
    if(previous)assert.ok(rotation.angleTo(previous)<MathUtils.degToRad(8),`gaze jumps at ${time}`);
    previous=rotation;
    if(time<11.1||time>15.6)continue;
    const target=toy.localToWorld(new Vector3(.38,.008,0)),direction=target.sub(eyePosition()).normalize();
    const forward=new Vector3(0,0,1).applyQuaternion(rotation);
    assert.ok(forward.angleTo(direction)<MathUtils.degToRad(2),`eyes miss the rod tip at ${time}`);
    first??=rotation.clone();maxTurn=Math.max(maxTurn,first.angleTo(rotation));
  }
  assert.ok(maxTurn>MathUtils.degToRad(5),'the head follows the swing instead of holding one fixed pose');
  applyLoungeStudy(actors,'cat',13.45);const reference=head.quaternion.clone();
  applyLoungeStudy(actors,'cat',9.3);applyLoungeStudy(actors,'cat',13.45);
  assert.ok(head.quaternion.angleTo(reference)<1e-7,'backward scrubbing reproduces the gaze');
});

test('the lower neck follows the shirt collar throughout the deep cat-teaser reach',()=>{
  const actors=setup(),{body,head,spine,neckProtraction:fit}=actors.milo.userData,mesh=fit.mesh;
  const samples=[];
  for(let i=0;i<fit.restPosition.length/3;i+=11)if(fit.restPosition[i*3+1]<=-1.35)samples.push(i);
  assert.ok(samples.length>100);
  for(const item of ['cat','tablet','music'])for(const time of [8,8.8,9.05,9.3,10.21,12.57,15.4,17.6,18.9]){
    applyLoungeStudy(actors,item,time);
    const top=spine.drivers.at(-1),lower=spine.drivers.at(-2);
    for(const i of samples){
      const bind=new Vector3().fromArray(fit.restPosition,i*3).applyMatrix4(fit.restMatrix);
      const blend=MathUtils.clamp((bind.y-spine.levels.at(-2))/(spine.levels.at(-1)-spine.levels.at(-2)),0,1);
      const attached=bind.clone().applyMatrix4(lower.matrix).lerp(bind.clone().applyMatrix4(top.matrix),blend);
      const actual=body.worldToLocal(mesh.getVertexPosition(i,new Vector3()).applyMatrix4(mesh.matrixWorld));
      assert.ok(actual.distanceTo(attached)<1e-7,`${item} neck leaves its collar at ${time}`);
      const normal=new Vector3().fromBufferAttribute(mesh.geometry.attributes.normal,i);
      assert.ok(Math.abs(normal.length()-1)<1e-6,'bent neck normals remain finite and normalized');
    }
    assert.ok(top.rotation.x-head.rotation.x<=.550001,'deep reaches do not hyperextend the neck to keep the face upright');
  }
});

test('neck bending preserves the face and tattoo coordinates, clears the table, and resets outside the lounge',()=>{
  const actors=setup(),{neckProtraction:fit}=actors.milo.userData,mesh=fit.mesh;
  const toon=createMiloToon(actors.milo),outline=mesh.parent.children.find(child=>child.name==='Milo toon outline');
  actors.furniture.updateMatrixWorld(true);const table=new Box3().setFromObject(actors.furniture.getObjectByName('Tabletop'));
  for(const time of [9.05,9.3,10.21,17.6]){
    applyLoungeStudy(actors,'cat',time);toon.update();
    const {position,headRestPosition}=mesh.geometry.attributes;
    assert.deepEqual(headRestPosition.array,fit.restPosition,'skin markings remain in the original scan coordinates');
    for(let i=0;i<position.count;i+=13){
      const rest=new Vector3().fromArray(fit.restPosition,i*3);
      if(rest.y>.7)assert.ok(new Vector3().fromBufferAttribute(position,i).distanceTo(rest)<1e-8,'face stays rigid');
      const point=mesh.getVertexPosition(i,new Vector3()).applyMatrix4(mesh.matrixWorld);
      if(point.x>table.min.x&&point.x<table.max.x&&point.z>table.min.z&&point.z<table.max.z)assert.ok(point.y>table.max.y,'head stays above the tabletop');
      assert.ok(outline.getVertexPosition(i,new Vector3()).applyMatrix4(outline.matrixWorld).distanceTo(point)<1e-7,'outline follows the connected neck');
    }
  }
  animateMilo(actors.milo,{moving:true,time:2,actionTime:2,facing:1});
  assert.deepEqual(mesh.geometry.attributes.position.array,fit.restPosition);
  assert.deepEqual(mesh.geometry.attributes.normal.array,fit.restNormal);
  toon.dispose();
});

test('turning toward the rod keeps the neck cross-sections rounded instead of collapsing into a thin crease',()=>{
  const actors=setup(),{neckProtraction:fit}=actors.milo.userData,rest=fit.restPosition;
  const a=new Vector3(),b=new Vector3(),edge=new Vector3(),across=[];
  // Real scan edges which run across the neck rather than along its bend.
  for(let i=0;i<rest.length/3;i+=3)for(let j=0;j<3;j++){
    const m=i+j,n=i+(j+1)%3;a.fromArray(rest,m*3);b.fromArray(rest,n*3);edge.subVectors(b,a);
    if(a.y>-.9&&a.y<.4&&b.y>-.9&&b.y<.4&&a.z<.5&&b.z<.5&&Math.abs(edge.y)<.012&&Math.abs(edge.z)<.012&&Math.abs(edge.x)>.02){
      across.push({m,n,length:edge.length()});
    }
  }
  assert.ok(across.length>=10,'measure actual neck surface sections');
  for(const time of [9.3,10.02,10.5,11.1,13.45,16.27,17.5]){
    applyLoungeStudy(actors,'cat',time);
    const position=fit.mesh.geometry.attributes.position;
    for(const {m,n,length}of across){
      const ratio=a.fromBufferAttribute(position,m).distanceTo(b.fromBufferAttribute(position,n))/length;
      assert.ok(ratio>.90&&ratio<1.12,`neck pinches or bulges at ${time}: ${ratio}`);
    }
  }
});
