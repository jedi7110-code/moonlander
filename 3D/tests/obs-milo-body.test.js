import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Group,Matrix3,Matrix4,Mesh,MeshStandardMaterial,Vector3} from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {headGeometry} from '../src/obs/head.js';
import {loadMiloBody,sampleMiloNeckline} from '../src/obs/milo-body.js';
import {createMilo,animateMilo} from '../src/obs/characters.js';

const data=JSON.parse(await readFile(new URL('../public/assets/obs/milo/body.json',import.meta.url)));
await loadMiloBody(`data:application/json;base64,${Buffer.from(JSON.stringify(data)).toString('base64')}`);
function character(head){
  const materials={};return createMilo(new Proxy(materials,{get:(o,k)=>o[k]??=(new MeshStandardMaterial())}),head);
}
test('tattoos stay attached to the forearm skin and away from clothing and hands',async()=>{
  const root=character(),skin=root.userData.bodySkin;
  const {position,tattooUv,tattooMask,armRegion}=skin.geometry.attributes;
  assert.equal(tattooUv.count,position.count);assert.equal(tattooMask.count,position.count);
  const sides=[0,0],vertices=[];
  for(let i=0;i<position.count;i++){
    const u=tattooUv.getX(i),v=tattooUv.getY(i),mask=tattooMask.getX(i);
    assert.ok(Number.isFinite(u)&&Number.isFinite(v)&&mask>=0&&mask<=1);
    if(mask<=.1||u<0||u>1||v<0||v>1)continue;
    assert.ok(armRegion.getX(i)>.9);
    assert.ok(position.getY(i)>.95&&position.getY(i)<1.16);
    sides[position.getX(i)<0?0:1]++;vertices.push(i);
  }
  assert.ok(sides.every(n=>n>3),'both forearms contain tattoo surface vertices');
  const uvBefore=tattooUv.array.slice(),maskBefore=tattooMask.array.slice();
  for(const time of [0,.3,.7]){
    animateMilo(root,{moving:true,climbing:false,facing:1,time,walkDistance:time,action:null});
    root.updateMatrixWorld(true);skin.skeleton.update();
    for(const i of vertices){
      const p=skin.applyBoneTransform(i,new Vector3().fromBufferAttribute(position,i));
      assert.ok(p.toArray().every(Number.isFinite));
    }
  }
  assert.deepEqual(tattooUv.array,uvBefore);assert.deepEqual(tattooMask.array,maskBefore);
  for(const name of ['cosmo-atomic-bold','cat-red']){
    const image=await readFile(new URL(`../public/assets/obs/milo/tattoo-${name}.png`,import.meta.url));
    assert.equal(image.subarray(0,8).toString('hex'),'89504e470d0a1a0a','original color PNG is packaged');
    assert.equal(image.readUInt32BE(16)*3,image.readUInt32BE(20),'keep the supplied 1:3 aspect ratio');
    if(name==='cosmo-atomic-bold')assert.equal(image[25],6,'cosmos artwork retains its RGBA transparency');
  }
});
test('the collar follows the scanned neck instead of leaving wide side openings',async()=>{
  const bytes=await readFile(new URL('../public/assets/obs/head/LeePerrySmith.glb',import.meta.url));
  const gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
  const head=new Group(),scan=new Mesh(headGeometry(gltf.scene.getObjectByName('LeePerrySmith').geometry));
  scan.name='Milo scanned head';head.add(scan);head.scale.setScalar(.055);
  const radii=sampleMiloNeckline(scan.geometry);
  assert.equal(radii?.length,128,'every collar direction must hit the actual neck');
  const fitted=character(head).userData.bodySkin.geometry.attributes.position;
  let checked=0;
  for(let i=0;i<fitted.count;i++){
    const [x,y,z]=data.positions.slice(i*3,i*3+3),r=Math.hypot(x,z+.009);
    const edge=1.563-.020*(z+.009)/r;
    if(r<.001||r>.1||y<1.54||Math.abs(y-edge)>.004)continue;
    const sample=(Math.atan2(z+.009,x)+Math.PI*2)%(Math.PI*2)*128/(Math.PI*2),k=Math.floor(sample);
    const neck=radii[k]+(radii[(k+1)%128]-radii[k])*(sample-k);
    const actual=Math.hypot(fitted.getX(i),fitted.getZ(i)+.009);
    assert.ok(actual<=neck+.004,'the collar and the first 4 mm of fabric must stay close to the scanned neck');
    assert.ok(actual>=neck+.0008,'the collar must cover the skin intersection without scalloped clipping');
    checked++;
  }
  assert.ok(checked>8,'check both sides of the actual collar');
  scan.geometry.dispose();gltf.scene.traverse(o=>o.geometry?.dispose());
});
test('the supplied human surface is one connected mesh across every body joint',()=>{
  const root=character(),skin=root.userData.bodySkin;
  assert.ok(skin?.isSkinnedMesh);assert.equal(root.userData.bodySource,'FinalBaseMesh.obj');
  assert.equal(skin.skeleton.bones.length,49,'two intermediate elbow supports preserve the bend');
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
test('thumb IP flexion moves the distal skin without rotating the thumb base',()=>{
  const root=character(),skin=root.userData.bodySkin,{position,skinIndex,skinWeight}=skin.geometry.attributes;
  root.updateMatrixWorld(true);skin.skeleton.update();
  for(const {thumb,side} of root.userData.arms){
    const id=skin.skeleton.bones.findIndex(b=>b.name===`Milo skin ${side<0?'L':'R'}_thumbIP`);
    assert.ok(id>=0);
    const affected=[];
    for(let i=0;i<position.count;i++)for(let k=0;k<4;k++){
      if(skinIndex.array[i*4+k]===id&&skinWeight.array[i*4+k]>.5)affected.push(i);
    }
    assert.ok(affected.length>5);
    const before=affected.map(i=>skin.applyBoneTransform(i,new Vector3().fromBufferAttribute(position,i)));
    const base=thumb.quaternion.clone();thumb.userData.ip.rotation.x=.28;
    root.updateMatrixWorld(true);skin.skeleton.update();
    const movement=affected.map((i,k)=>before[k].distanceTo(skin.applyBoneTransform(i,new Vector3().fromBufferAttribute(position,i))));
    assert.ok(Math.max(...movement)>.003,'the visible distal phalanx must bend');
    assert.deepEqual(thumb.quaternion.toArray(),base.toArray());
    thumb.userData.ip.rotation.x=0;root.updateMatrixWorld(true);skin.skeleton.update();
    for(const [k,i] of affected.entries())assert.ok(before[k].distanceTo(skin.applyBoneTransform(i,new Vector3().fromBufferAttribute(position,i)))<1e-7);
  }
});
test('work trousers retain ease through the calf, knee and thigh',()=>{
  const p=character().userData.bodySkin.geometry.attributes.position;
  for(const [height,minWidth,minDepth]of [[.30,.14,.16],[.535,.15,.18],[.72,.15,.20]]){
    const section=[];
    for(let i=0;i<data.positions.length/3;i++){
      const x=p.getX(i),y=p.getY(i),z=p.getZ(i);
      if(x>0&&Math.abs(y-height)<.018&&data.armRegions[i]<.1)section.push([x,z]);
    }
    assert.ok(section.length>12);
    const width=Math.max(...section.map(p=>p[0]))-Math.min(...section.map(p=>p[0]));
    const depth=Math.max(...section.map(p=>p[1]))-Math.min(...section.map(p=>p[1]));
    assert.ok(width>minWidth&&depth>minDepth,`trousers must not follow bare-leg contours at ${height}: ${width}, ${depth}`);
    assert.ok(width<.24&&depth<.29,'ease must not become balloon trousers');
  }
});
test('cargo legs follow a straight outer contour and an open, even inner line',()=>{
  const p=character().userData.bodySkin.geometry.attributes.position;
  for(const side of [-1,1])for(const height of [.25,.35,.45,.535,.60,.65,.70,.74]){
    const section=[];
    for(let i=0;i<p.count;i++)if(data.armRegions[i]<.1&&side*p.getX(i)>0&&Math.abs(p.getY(i)-height)<.012)section.push(side*p.getX(i));
    assert.ok(section.length>20);
    const inner=Math.min(...section),outer=Math.max(...section);
    assert.ok(outer>.175&&outer<.186,`straight outer line at ${height}: ${outer}`);
    assert.ok(inner>.013&&inner<.028,`even inner line at ${height}: ${inner}`);
    assert.ok(outer-inner>.15,'retain loose cloth instead of a skin-tight leg');
  }
  for(let i=0;i<p.count;i++)if(data.armRegions[i]<.1){
    const [x,y]=data.positions.slice(i*3,i*3+2);
    if(y<=.17||(y>=.94&&y<=.96))assert.equal(p.getX(i),Math.fround(x),'boot opening and hips stay connected');
  }
});
test('the crotch has no folded bridge between the legs below the true seam',()=>{
  const p=character().userData.bodySkin.geometry.attributes.position;
  let lowestCrossing=Infinity,checked=0;
  for(let j=0;j<data.indices.length;j+=3){
    const ids=data.indices.slice(j,j+3),xs=ids.map(i=>p.getX(i));
    if(Math.min(...xs)<-1e-6&&Math.max(...xs)>1e-6)lowestCrossing=Math.min(lowestCrossing,...ids.map(i=>p.getY(i)));
  }
  assert.ok(lowestCrossing>.855&&lowestCrossing<.87,'legs join at the original crotch, not a second bridge beneath it');
  for(let i=0;i<p.count;i++){
    const [x,y]=data.positions.slice(i*3,i*3+2);
    if(Math.abs(x)>=.050||y<=.78||y>=.85||data.armRegions[i]>=.05)continue;
    const anatomicalX=Math.cos((data.uvs[i*2]-.5)*Math.PI*2);
    assert.ok(p.getX(i)*anatomicalX>=0,'each inner-thigh vertex stays on its original anatomical side');
    assert.equal(p.getY(i),Math.fround(y),'unfold the surface without raising the crotch');checked++;
  }
  assert.ok(checked>100);
});
test('rear clothing connects the shirt hem, waist, seat and thighs without inward notches',()=>{
  const p=character().userData.bodySkin.geometry.attributes.position;
  const depthAt=y=>{
    let depth=0,count=0;
    for(let i=0;i<p.count;i++)if(data.armRegions[i]<.1&&Math.abs(p.getY(i)-y)<.012){
      depth=Math.max(depth,-p.getZ(i));count++;
    }
    assert.ok(count>30,'profile needs enough surface samples');return depth;
  };
  const thigh=[.74,.78,.82,.86,.90,.94].map(depthAt);
  for(let i=1;i<thigh.length;i++)assert.ok(thigh[i]>=thigh[i-1]-.002&&thigh[i]-thigh[i-1]<.012,'rear contour must flow from thigh to seat');
  for(const y of [1.045,1.065,1.085,1.105,1.125])assert.ok(depthAt(y)>.120&&depthAt(y)<.145,'hem must reach the waistband without a hollow or bulge');
  for(let i=0;i<p.count;i++)if(data.positions[i*3+1]<1.19&&(data.armRegions[i]>.3||data.positions[i*3+2]>=0)){
    const y=data.positions[i*3+1];
    if(data.armRegions[i]>.95&&y>.855&&y<1.24)continue;
    assert.equal(p.getZ(i),Math.fround(data.positions[i*3+2]),'front and arms outside the forearm adjustment keep their original shape');
  }
});
test('shirt, waistband and hips follow the drawn waist silhouette without changing arms',()=>{
  const p=character().userData.bodySkin.geometry.attributes.position;
  let left=0,right=0,preserved=0;
  for(let i=0;i<p.count;i++){
    const [x,y,z]=data.positions.slice(i*3,i*3+3);
    if(data.armRegions[i]>.05||y>=1.37)continue;
    const reduction=Math.abs(x)-Math.abs(p.getX(i));
    if(y>=.94)assert.ok(reduction>=-1e-7&&reduction<=.030,'reshape the waist without widening or excessively pinching it');
    if(y>=1.14&&y<=1.19&&Math.abs(x)>=.165){
      assert.ok(reduction>.020&&reduction<.029,'the drawn waist is visibly narrower, not a 4 mm adjustment');
      if(x<0)left++;else right++;
    }
    if(y<=.17||(y>=.94&&y<=.96)||y>=1.36){
      assert.equal(p.getX(i),Math.fround(x),'hips, lower legs and chest outside the cargo adjustment retain their width');preserved++;
    }
    assert.equal(p.getY(i),Math.fround(y));
    if(z>=0)assert.equal(p.getZ(i),Math.fround(z),'leave abdominal depth and shirt ease unchanged');
  }
  assert.ok(left>5&&right>5&&preserved>100);
});
test('shirt shoulders retain a convex front-to-back deltoid volume',()=>{
  const p=character().userData.bodySkin.geometry.attributes.position;let rounded=0,depthChanges=0;
  for(let i=0;i<p.count;i++){
    const x=Math.abs(data.positions[i*3]),y=data.positions[i*3+1];
    if(x>=.17&&x<.29&&y>=1.46){
      const radius=Math.hypot((Math.abs(p.getX(i))-.175)/.085,(p.getY(i)-1.40)/.140,(p.getZ(i)+.025)/.098);
      assert.ok(radius>=1-2e-6&&radius<1.10,'shoulder stays rounded, with only a small lift across the upper hollow');
      rounded++;
      if(Math.abs(p.getZ(i)-data.positions[i*3+2])>.002)depthChanges++;
    }else if((y<=1.37||x>=.29||(x<=.11&&y<=1.51))&&!(y<1.178&&data.armRegions[i]>.8)){
      assert.equal(p.getY(i),Math.fround(y),'neck and lower body stay unchanged');
    }
    if(x>.11&&x<.29&&y>1.37)assert.ok(new Vector3().fromBufferAttribute(p,i).distanceTo(new Vector3(...data.positions.slice(i*3,i*3+3)))<.04,'shoulder adjustment stays local');
  }
  assert.ok(rounded>50&&depthChanges>50,'rounding adjusts depth as well as height');
});
test('the continuous shirt uses a crew neck, short sleeves and cuff trim',()=>{
  const skin=character().userData.bodySkin;
  const shader={uniforms:{},vertexShader:'#include <common>\n#include <begin_vertex>',fragmentShader:'#include <common>\n#include <color_fragment>'};
  skin.material.onBeforeCompile(shader);
  assert.ok(shader.uniforms.shirtColor);
  assert.match(shader.fragmentShader,/float sleeve=/);
  assert.match(shader.fragmentShader,/float collar=/);
  assert.match(shader.fragmentShader,/float cuff=/);
  assert.match(shader.fragmentShader,/float neckline=1.563-.020/,'front and rear neckline join continuously');
  let fittedVertices=0;
  const fitted=skin.geometry.attributes.position;
  for(let i=0;i<fitted.count;i++){
    const x=Math.abs(data.positions[i*3]),y=data.positions[i*3+1],z=data.positions[i*3+2],radius=Math.hypot(x,z+.009);
    if(x<=.11&&radius>.001&&radius<.11&&y>1.54){
      assert.ok(Math.abs(fitted.getY(i)-y)<1e-6,'collar fitting preserves the connected torso topology');
      const depth=(z+.009)/radius>0?.081:.070;
      const neckline=1.563-.020*(z+.009)/radius;
      const neckFit=1/Math.hypot((x/radius)/.076,((z+.009)/radius)/depth);
      if(y<=neckline){
        assert.ok(Math.hypot(fitted.getX(i),fitted.getZ(i)+.009)>=neckFit-1e-6,'shirt reaches the neck without a separate overlay');
        fittedVertices++;
      }
    }
  }
  assert.ok(fittedVertices>5,'the original shirt supplies the collar surface');
  assert.doesNotMatch(shader.fragmentShader,/tankColor|float strap=/);
  const p=data.positions;
  const front=[];
  for(let i=0;i<p.length/3;i++)if(Math.abs(p[i*3])<.025&&Math.abs(p[i*3+1]-1.30)<.03&&p[i*3+2]>0)front.push(p[i*3+2]);
  assert.ok(front.length>5&&Math.min(...front)>.115,'shirt chest has fabric ease instead of following the bare torso');
});
test('cargo trousers use cloth grain, worn fold shading and subtle displaced wrinkles',()=>{
  const skin=character().userData.bodySkin;
  const shader={uniforms:{},vertexShader:'#include <common>\n#include <begin_vertex>',fragmentShader:'#include <common>\n#include <color_fragment>\n#include <normal_fragment_maps>\n#include <roughnessmap_fragment>'};
  skin.material.onBeforeCompile(shader);
  assert.ok('trouserMap' in shader.uniforms);
  assert.match(shader.vertexShader,/trouserVertex/);assert.match(shader.vertexShader,/kneeShape/);assert.match(shader.vertexShader,/transformed\+=normal/);
  for(const zone of ['backKneeShape','waistShape','crotchShape'])assert.match(shader.vertexShader,new RegExp(zone));
  assert.match(shader.fragmentShader,/texture2D\(trouserMap/);assert.match(shader.fragmentShader,/weaveTone/);assert.match(shader.fragmentShader,/foldShade/);assert.match(shader.fragmentShader,/backThighSmooth/);
  for(const zone of ['backKneeZone','waistZone','crotchZone','seatZone'])assert.match(shader.fragmentShader,new RegExp(zone));
  assert.match(shader.fragmentShader,/trouserBumpMask/);assert.match(shader.fragmentShader,/mix\(smoothBodyNormal,normal,trouserBumpMask\)/);
  assert.match(shader.fragmentShader,/roughnessFactor=mix\(roughnessFactor,.96,trousers\)/);
});
test('belt, fly and pockets are surface patterns rather than floating meshes',()=>{
  const root=character(),skin=root.userData.bodySkin;
  const shader={uniforms:{},vertexShader:'#include <common>\n#include <begin_vertex>',fragmentShader:'#include <common>\n#include <color_fragment>\n#include <normal_fragment_maps>\n#include <roughnessmap_fragment>'};
  skin.material.onBeforeCompile(shader);
  for(const detail of ['beltLoop','frontFly','handPocket','cargoOuter','cargoFlap','rearPocket','rearFlap','garmentLines'])assert.match(shader.fragmentShader,new RegExp(detail));
  for(const name of ['Contoured waist belt','Cargo belt loop','Cargo pocket','Cargo pocket flap','Garment front fly stitching','Garment rear patch pocket','Garment rear pocket flap'])assert.equal(root.getObjectsByProperty('name',name).length,0,`${name} must be painted into the deforming trouser surface`);
});
test('the Milo study renders the production character modules directly',async()=>{
  const [html,script]=await Promise.all([
    readFile(new URL('../studies/milo/index.html',import.meta.url),'utf8'),
    readFile(new URL('../studies/milo/study.js',import.meta.url),'utf8'),
  ]);
  assert.match(html,/マイロ・スタディー/);assert.match(html,/正面/);assert.match(html,/背面/);assert.match(html,/ズボン拡大/);
  assert.match(script,/src\/obs\/characters\.js/);assert.match(script,/src\/obs\/milo-body\.js/);assert.match(script,/createMilo/);assert.match(script,/animateMilo/);
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
test('hand proportions and position blend through both wrist joints',()=>{
  const root=character();
  animateMilo(root,{moving:false,climbing:false,facing:1,time:0,action:null});
  const skin=root.userData.bodySkin;
  for(const {side,hand}of root.userData.arms){
    const elbow=root.userData.arms.find(r=>r.hand===hand).elbow;
    assert.ok(Math.abs(elbow.position.z+hand.position.z+.025)<1e-9,'the shifted elbow retains the original resting wrist location');
    assert.equal(hand.position.y,-.244);
    assert.deepEqual(hand.scale.toArray(),[1.16,1.05,1.08].map(value=>value*1.08));
    const prefix=side<0?'L':'R';
    for(let j=1;j<=2;j++){
      const driver=skin.skeleton.bones.find(b=>b.name===`Milo skin ${prefix}_wrist${j}`).parent;
      assert.ok(Math.abs(driver.position.z+elbow.position.z-(-.025*j/3))<1e-9);
      for(const axis of ['x','y','z'])assert.ok(Math.abs(driver.scale[axis]-(1+(hand.scale[axis]-1)*j/3))<1e-9);
    }
  }
});
test('the wrist surface fills out gradually without changing the hand mesh',()=>{
  const p=character().userData.bodySkin.geometry.attributes.position;
  let expanded=0,unchanged=0;
  for(let i=0;i<p.count;i++){
    if(data.armRegions[i]<.95)continue;
    const [x,y,z]=data.positions.slice(i*3,i*3+3);
    if(y>.895&&y<.913&&Math.hypot(p.getX(i)-x,p.getZ(i)-z)>.003)expanded++;
    if(y<.855){
      assert.ok(new Vector3().fromBufferAttribute(p,i).distanceTo(new Vector3(x,y+.030,z))<1e-6,'the hand moves up as one piece, retaining its shape');
      unchanged++;
    }
  }
  assert.ok(expanded>20&&unchanged>20);
});
test('upper arm reduction is subtle and does not flatten the back of the arm',()=>{
  const p=character().userData.bodySkin.geometry.attributes.position;
  let front=0,rear=0;
  for(let i=0;i<p.count;i++){
    const [x,y,z]=data.positions.slice(i*3,i*3+3);
    if(data.armRegions[i]<.95||y<1.29||y>1.37)continue;
    assert.ok(Math.abs(p.getX(i)-x)<.003,'width reduction stays below 3 mm per side');
    if(z>.015){
      assert.ok(p.getZ(i)<z-.004&&p.getZ(i)>z-.012,'reduce the biceps belly, not the whole arm');front++;
    }
    if(z<-.065){assert.ok(Math.abs(p.getZ(i)-z)<1e-7,'retain the triceps contour');rear++;}
  }
  assert.ok(front>10&&rear>10);
});
function relaxedArms(){
  const root=character(),skin=root.userData.bodySkin;
  for(const {arm,elbow,hand,side}of root.userData.arms){
    arm.rotation.set(0,0,0);elbow.rotation.set(0,0,0);hand.rotation.set(0,side*Math.PI/2,0);
  }
  root.userData.updateWristTwists();root.updateMatrixWorld(true);skin.skeleton.update();
  const geometry=skin.geometry.clone(),p=geometry.attributes.position,q=new Vector3();
  for(let i=0;i<p.count;i++){
    skin.applyBoneTransform(i,q.fromBufferAttribute(p,i));p.setXYZ(i,q.x,q.y,q.z);
  }
  geometry.computeVertexNormals();return {skin,geometry};
}
test('both forearms taper continuously without repeated wrist bulges',()=>{
  const {geometry}=relaxedArms(),p=geometry.attributes.position;
  for(const side of [-1,1]){
    const sections=[];
    for(let step=0;step<=24;step++){
      const sourceHeight=.890+step*.010,height=sourceHeight+.030*Math.max(0,Math.min(1,(1.178-sourceHeight)/.274)),points=[];
      for(let k=0;k<data.indices.length;k+=3){
        const ids=data.indices.slice(k,k+3);
        if(ids.some(i=>p.getX(i)*side<.14||data.armRegions[i]<.95))continue;
        for(let edge=0;edge<3;edge++){
          const a=ids[edge],b=ids[(edge+1)%3],ya=p.getY(a),yb=p.getY(b);
          if((ya-height)*(yb-height)>=0)continue;
          const t=(height-ya)/(yb-ya);
          points.push([p.getX(a)+(p.getX(b)-p.getX(a))*t,p.getZ(a)+(p.getZ(b)-p.getZ(a))*t]);
        }
      }
      assert.ok(points.length>20,'cross-sections must span the complete arm');
      sections.push([0,1].flatMap(axis=>[Math.min(...points.map(q=>q[axis])),Math.max(...points.map(q=>q[axis]))]));
    }
    for(let k=1;k<sections.length;k++){
      for(const axis of [0,2]){
        const width=sections[k][axis+1]-sections[k][axis],before=sections[k-1][axis+1]-sections[k-1][axis];
        assert.ok(width>=before-.0008,'the wrist-to-forearm taper must not form successive beads');
      }
      if(k>1)for(let edge=0;edge<4;edge++){
        const bend=sections[k][edge]-2*sections[k-1][edge]+sections[k-2][edge];
        assert.ok(Math.abs(bend)<.0015,`abrupt contour change on side ${side}, section ${k}: ${bend}`);
      }
    }
  }
  geometry.dispose();
});
test('twisted wrist shading follows the relaxed surface rather than the bind-space creases',()=>{
  const {skin,geometry}=relaxedArms(),expected=geometry.attributes.normal;
  const normal=new Vector3(),sum=new Vector3(),matrix=new Matrix4(),linear=new Matrix3();let checked=0;
  for(let i=0;i<expected.count;i++){
    const y=data.positions[i*3+1];if(data.armRegions[i]<.95||y<.885||y>1.13)continue;
    sum.set(0,0,0);
    for(let k=0;k<4;k++){
      matrix.fromArray(skin.skeleton.boneMatrices,data.joints[i*4+k]*16);linear.setFromMatrix4(matrix);
      normal.fromBufferAttribute(skin.geometry.attributes.normal,i).applyMatrix3(linear);
      sum.addScaledVector(normal,data.weights[i*4+k]);
    }
    normal.fromBufferAttribute(expected,i);
    assert.ok(sum.normalize().dot(normal)>.995,'skinned normals must agree with the actual unbroken forearm surface');checked++;
  }
  assert.ok(checked>300);geometry.dispose();
});
