import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {MeshStandardMaterial,Vector3} from 'three';
import {loadMiloBody} from '../src/obs/milo-body.js';
import {createMilo,animateMilo} from '../src/obs/characters.js';

const data=JSON.parse(await readFile(new URL('../public/assets/obs/milo/body.json',import.meta.url)));
await loadMiloBody(`data:application/json;base64,${Buffer.from(JSON.stringify(data)).toString('base64')}`);
function character(){
  const materials={};return createMilo(new Proxy(materials,{get:(o,k)=>o[k]??=(new MeshStandardMaterial())}));
}
test('the supplied human surface is one connected mesh across every body joint',()=>{
  const root=character(),skin=root.userData.bodySkin;
  assert.ok(skin?.isSkinnedMesh);assert.equal(root.userData.bodySource,'FinalBaseMesh.obj');
  assert.equal(skin.skeleton.bones.length,45);
  const parent=Array.from({length:data.positions.length/3},(_,i)=>i),used=new Set();
  function find(i){while(parent[i]!==i){parent[i]=parent[parent[i]];i=parent[i];}return i;}
  for(let i=0;i<data.indices.length;i+=3){
    const [a,b,c]=data.indices.slice(i,i+3);used.add(a);used.add(b);used.add(c);parent[find(b)]=find(a);parent[find(c)]=find(a);
  }
  assert.equal(new Set([...used].map(find)).size,1,'shoulders, arms, hands, hips and legs cannot be separate objects');
  for(let i=0;i<skin.geometry.attributes.position.count;i++){
    const weights=skin.geometry.attributes.skinWeight.array.slice(i*4,i*4+4);
    assert.ok(Math.abs(weights.reduce((a,b)=>a+b,0)-1)<1e-5);
  }
  assert.equal(root.userData.neck.visible,false,'the old separate torso is not drawn');
});
test('walking, sitting, climbing and eating deform the connected surface without broken joints',()=>{
  const root=character(),skin=root.userData.bodySkin,p=skin.geometry.attributes.position,a=new Vector3(),b=new Vector3();
  const pairs=[];
  for(let i=0;i<data.indices.length;i+=3){
    const x=data.indices[i],y=data.indices[i+1];a.fromBufferAttribute(p,x);b.fromBufferAttribute(p,y);
    const length=a.distanceTo(b);if(length>.003)pairs.push([x,y,length]);
  }
  const poses=[{}, {moving:true}, {moving:true,climbing:true}, {action:'lounge'}, {action:'hydro',actionTime:2,actionDuration:5}, {action:'galley',actionTime:2,actionDuration:6}, {action:'gym',actionTime:2}, {action:'bunk',actionTime:23,actionDuration:46}, {action:'medical',actionTime:20,actionDuration:40}];
  for(const pose of poses)for(const time of [0,.4,.8]){
    animateMilo(root,{moving:false,climbing:false,facing:1,time,walkDistance:time,action:null,...pose});root.updateMatrixWorld(true);skin.skeleton.update();
    for(let i=0;i<p.count;i+=13){a.fromBufferAttribute(p,i);skin.applyBoneTransform(i,a);assert.ok(a.toArray().every(Number.isFinite));}
    let maxRatio=0,worst;
    for(const [x,y,length]of pairs){a.fromBufferAttribute(p,x);b.fromBufferAttribute(p,y);skin.applyBoneTransform(x,a);skin.applyBoneTransform(y,b);const ratio=a.distanceTo(b)/length;if(ratio>maxRatio){maxRatio=ratio;worst=[x,y,new Vector3().fromBufferAttribute(p,x).toArray(),data.joints.slice(x*4,x*4+4),data.joints.slice(y*4,y*4+4)];}}
    assert.ok(maxRatio<9,`excessive skin stretching in ${pose.action??(pose.climbing?'climbing':pose.moving?'walking':'idle')}: ${maxRatio}, ${JSON.stringify(worst)}`);
  }
});
test('the sample fingers follow the existing grasp controllers',()=>{
  const root=character(),skin=root.userData.bodySkin,p=skin.geometry.attributes.position;
  root.updateMatrixWorld(true);skin.skeleton.update();
  const fingerIndex=data.bones.findIndex(b=>b.name==='R_finger2_1');
  let vertex=-1;
  for(let i=0;i<p.count;i++)if(data.joints.slice(i*4,i*4+4).some((id,k)=>id===fingerIndex&&data.weights[i*4+k]>.3)){vertex=i;break;}
  assert.ok(vertex>=0,'the sample finger must have joint weights');
  const before=skin.applyBoneTransform(vertex,new Vector3().fromBufferAttribute(p,vertex));
  root.userData.arms[1].fingers[2].userData.links[0].rotation.x=-.8;root.updateMatrixWorld(true);skin.skeleton.update();
  const after=skin.applyBoneTransform(vertex,new Vector3().fromBufferAttribute(p,vertex));
  assert.ok(before.distanceTo(after)>.002,'grasping must deform the visible fingers, not hidden old parts');
});
test('work trousers retain ease through the calf, knee and thigh',()=>{
  for(const [height,minWidth,minDepth]of [[.30,.14,.16],[.535,.15,.18],[.72,.17,.20]]){
    const section=[];
    for(let i=0;i<data.positions.length/3;i++){
      const [x,y,z]=data.positions.slice(i*3,i*3+3);
      if(x>0&&Math.abs(y-height)<.018&&data.armRegions[i]<.1)section.push([x,z]);
    }
    assert.ok(section.length>12);
    const width=Math.max(...section.map(p=>p[0]))-Math.min(...section.map(p=>p[0]));
    const depth=Math.max(...section.map(p=>p[1]))-Math.min(...section.map(p=>p[1]));
    assert.ok(width>minWidth&&depth>minDepth,`trousers must not follow bare-leg contours at ${height}: ${width}, ${depth}`);
    assert.ok(width<.24&&depth<.29,'ease must not become balloon trousers');
  }
});
test('the continuous shirt uses a crew neck, short sleeves and cuff trim',()=>{
  const skin=character().userData.bodySkin;
  const shader={uniforms:{},vertexShader:'#include <common>\n#include <begin_vertex>',fragmentShader:'#include <common>\n#include <color_fragment>'};
  skin.material.onBeforeCompile(shader);
  assert.ok(shader.uniforms.shirtColor);
  assert.match(shader.fragmentShader,/float sleeve=/);
  assert.match(shader.fragmentShader,/float collar=/);
  assert.match(shader.fragmentShader,/float cuff=/);
  assert.doesNotMatch(shader.fragmentShader,/tankColor|float strap=/);
  const p=data.positions;
  const front=[];
  for(let i=0;i<p.length/3;i++)if(Math.abs(p[i*3])<.025&&Math.abs(p[i*3+1]-1.30)<.03&&p[i*3+2]>0)front.push(p[i*3+2]);
  assert.ok(front.length>5&&Math.min(...front)>.115,'shirt chest has fabric ease instead of following the bare torso');
});
test('the source jaw remnant stays inside the scanned neck',()=>{
  let vertices=0;
  for(let i=0;i<data.positions.length;i+=3){
    const [x,y,z]=data.positions.slice(i,i+3);if(y<1.582)continue;
    assert.ok(Math.hypot(x/.024,(z+.008)/.022)<1.01,'the old jaw must not protrude through the visible scanned neck');vertices++;
  }
  assert.ok(vertices>10);
});
test('both wrists retain thickness while the palms turn and grasp',()=>{
  const root=character(),skin=root.userData.bodySkin,p=skin.geometry.attributes.position;
  const poses=[{}, {moving:true}, {moving:true,climbing:true}, {action:'lounge'}, {action:'hydro',actionTime:2,actionDuration:5}, {action:'galley',actionTime:2,actionDuration:6}];
  for(const pose of poses){
    animateMilo(root,{moving:false,climbing:false,facing:1,time:.4,walkDistance:.4,action:null,...pose});root.updateMatrixWorld(true);skin.skeleton.update();
    for(const {side,hand}of root.userData.arms){
      const points=[];
      for(let i=0;i<p.count;i++){
        if(p.getX(i)*side<.14||Math.abs(p.getY(i)-.904)>.009||data.armRegions[i]<.95)continue;
        const q=skin.applyBoneTransform(i,new Vector3().fromBufferAttribute(p,i)).applyMatrix4(skin.matrixWorld);hand.worldToLocal(q);points.push(q);
      }
      assert.ok(points.length>20);
      // Measure in the ring's own 3D plane: a bent wrist is oblique to the
      // hand axes, so a projected XZ measurement falsely reports flattening.
      const mean=points.reduce((s,q)=>s.add(q),new Vector3()).divideScalar(points.length);
      const covariance=Array.from({length:3},()=>[0,0,0]);
      for(const q of points){const d=q.clone().sub(mean).toArray();for(let a=0;a<3;a++)for(let b=0;b<3;b++)covariance[a][b]+=d[a]*d[b]/points.length;}
      for(let iteration=0;iteration<20;iteration++){
        const [a,b]=[[0,1],[0,2],[1,2]].sort((p,q)=>Math.abs(covariance[q[0]][q[1]])-Math.abs(covariance[p[0]][p[1]]))[0];
        if(Math.abs(covariance[a][b])<1e-12)break;
        const angle=.5*Math.atan2(2*covariance[a][b],covariance[b][b]-covariance[a][a]),c=Math.cos(angle),s=Math.sin(angle);
        const aa=covariance[a][a],bb=covariance[b][b],ab=covariance[a][b];
        for(let k=0;k<3;k++)if(k!==a&&k!==b){const ka=covariance[k][a],kb=covariance[k][b];covariance[k][a]=covariance[a][k]=c*ka-s*kb;covariance[k][b]=covariance[b][k]=s*ka+c*kb;}
        covariance[a][a]=c*c*aa-2*s*c*ab+s*s*bb;covariance[b][b]=s*s*aa+2*s*c*ab+c*c*bb;covariance[a][b]=covariance[b][a]=0;
      }
      const minor=[0,1,2].map(i=>covariance[i][i]).sort((a,b)=>b-a)[1],diameter=2*Math.sqrt(2*minor);
      assert.ok(diameter>.028,`wrist must not collapse into a thin strip: ${side}, ${pose.action||'locomotion'}, ${diameter}`);
    }
  }
});
