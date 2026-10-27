import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Group,Matrix3,MathUtils,MeshStandardMaterial,Vector3} from 'three';
import {createMilo,createMiloBoot} from '../src/obs/characters.js';
import {loadMiloBody} from '../src/obs/milo-body.js';
import {finishCurtisBoots} from '../src/obs/curtis-model.js';
import {batchCurtisBootDetails,createCurtisShirtGeometry} from '../src/obs/curtis-rendering.js';
import {limitShadowCasters} from '../src/obs/lighting.js';
import {setLadderHandFit} from '../src/obs/ladder-hand-fit.js';
import {createLocalNormalUpdater} from '../src/obs/local-vertex-normals.js';

const data=await readFile(new URL('../public/assets/obs/milo/body.json',import.meta.url));
await loadMiloBody(`data:application/json;base64,${data.toString('base64')}`);
const materials=()=>new Proxy({},{get:(o,key)=>o[key]??=new MeshStandardMaterial()});
const details=new Set(['Combat boot sole lug','Metal boot eyelet','Crossed boot lace','Tightened top lace','Tied boot lace loop','Boot lace end','Curtis boot lace details']);
function surfaces(boot){
  const groups=new Map(),p=new Vector3(),n=new Vector3();
  for(const mesh of boot.children.filter(o=>details.has(o.name))){
    mesh.updateMatrix();const normalMatrix=new Matrix3().getNormalMatrix(mesh.matrix);
    const {position,normal,uv}=mesh.geometry.attributes,index=mesh.geometry.index;
    const key=`${mesh.material.uuid}/${mesh.castShadow}/${mesh.receiveShadow}`;
    if(!groups.has(key))groups.set(key,[]);
    const vertices=groups.get(key);
    for(let i=0;i<(index?.count??position.count);i++){
      const j=index?index.getX(i):i;
      p.fromBufferAttribute(position,j).applyMatrix4(mesh.matrix);n.fromBufferAttribute(normal,j).applyMatrix3(normalMatrix).normalize();
      vertices.push(p.x,p.y,p.z,n.x,n.y,n.z,uv.getX(j),uv.getY(j));
    }
  }
  return groups;
}
test('Curtis boot batches preserve every triangle, UV, normal and shadow flag on both articulated feet',()=>{
  const root=new Group(),m=materials(),boots=[-1,1].map(side=>createMiloBoot(root,m,side));
  finishCurtisBoots(root);limitShadowCasters(root);
  const before=boots.map(surfaces),originals=boots.flatMap(b=>b.children).map(mesh=>({geometry:mesh.geometry,position:mesh.geometry.attributes.position.array.slice()}));
  const count=boots.reduce((n,b)=>n+b.children.length,0);
  batchCurtisBootDetails(root);
  assert.ok(boots.reduce((n,b)=>n+b.children.length,0)<count/3);
  boots.forEach((boot,i)=>{
    const after=surfaces(boot);assert.deepEqual([...after.keys()].sort(),[...before[i].keys()].sort());
    for(const [key,a]of before[i]){const b=after.get(key);assert.equal(a.length,b.length);for(let j=0;j<a.length;j++)assert.ok(Math.abs(a[j]-b[j])<1e-6,`surface ${j}`);}
    for(const name of ['Continuous leather boot upper','Anatomical combat boot sole'])assert.ok(boot.getObjectByName(name),'silhouette and ink surfaces stay separate');
    boot.rotation.x=.6*(i?1:-1);boot.updateMatrixWorld(true);
    assert.ok(boot.children.every(mesh=>mesh.parent===boot),'batches still move with their own foot');
  });
  for(const original of originals)assert.deepEqual(original.geometry.attributes.position.array,original.position,'shared Milo geometry stays untouched');
});

// Evaluate the actual garment shader's rest-space cutouts, independently of
// the conservative triangle bounds used by the geometry builder.
function shirtVisible(position,region){
  const {x,y,z}=position;
  const neckline=1.563-.020*(z+.009)/Math.max(Math.hypot(x,z+.009),.001);
  const sleeve=MathUtils.lerp(1,MathUtils.smoothstep(y,1.203,1.207),MathUtils.smoothstep(region,.20,.50));
  const shirt=(1-MathUtils.smoothstep(y,neckline-.001,neckline+.001))*sleeve;
  return y<=neckline&&shirt>=.5&&y>=1.135&&!(z>.025&&Math.abs(x)<.039);
}
test('the aloha shader keeps its entire visible surface while skipping the hidden legs, hands and open-front triangles',()=>{
  const root=createMilo(materials()),source=root.userData.bodySkin.geometry,geometry=createCurtisShirtGeometry(source);
  try{
    assert.ok(geometry.index.count<source.index.count*.5,'less than half of the full body is submitted again as a shirt');
    for(const [name,attribute]of Object.entries(source.attributes))assert.equal(geometry.attributes[name],attribute,'live skin attributes remain shared');
    const faces=new Set();for(let i=0;i<geometry.index.count;i+=3)faces.add([0,1,2].map(k=>geometry.index.getX(i+k)).join(','));
    const {position,armRegion}=source.attributes,point=new Vector3(),vertices=[new Vector3(),new Vector3(),new Vector3()];
    const samples=[[1,0,0],[0,1,0],[0,0,1],[.5,.5,0],[0,.5,.5],[.5,0,.5],[1/3,1/3,1/3]];
    for(let i=0;i<source.index.count;i+=3){
      const ids=[0,1,2].map(k=>source.index.getX(i+k));if(faces.has(ids.join(',')))continue;
      ids.forEach((id,k)=>vertices[k].fromBufferAttribute(position,id));
      for(const weights of samples){
        point.set(0,0,0);let region=0;
        weights.forEach((w,k)=>{point.addScaledVector(vertices[k],w);region+=armRegion.getX(ids[k])*w;});
        assert.equal(shirtVisible(point,region),false,'discarded triangles cannot contain visible fabric');
      }
    }
  }finally{geometry.dispose();root.userData.bodySkin.skeleton.dispose();}
});

test('local hand normal updates match a full normal rebuild across grip changes without visiting the rest of the body',()=>{
  const root=createMilo(materials());setLadderHandFit(root,true);
  const geometry=root.userData.ladderHandFit.geometry.clone(),{position,normal,armRegion}=geometry.attributes;
  const moving=[];for(let i=0;i<position.count;i++)if(position.getY(i)<.910&&armRegion.getX(i)>.95)moving.push(i);
  const base=position.array.slice(),update=createLocalNormalUpdater(geometry,moving);
  try{
    for(const weight of [0,.05,.4,1,.7,.2,0]){
      position.array.set(base);
      for(const i of moving){const y=position.getY(i),z=position.getZ(i);position.setXYZ(i,position.getX(i),y+.003*weight*Math.sin(i),z+.004*weight*Math.cos(i));}
      let reads=0;const getX=position.getX;position.getX=function(i){reads++;return getX.call(this,i);};
      update();position.getX=getX;
      assert.ok(reads<geometry.index.count/2,'the fingers do not trigger a whole-body normal pass');
      const reference=geometry.clone();reference.computeVertexNormals();
      const expected=reference.attributes.normal.array;for(let i=0;i<expected.length;i++)assert.ok(Math.abs(expected[i]-normal.array[i])<1e-6,`normal ${i}`);
      reference.dispose();
    }
  }finally{geometry.dispose();root.userData.bodySkin.skeleton.dispose();}
});
