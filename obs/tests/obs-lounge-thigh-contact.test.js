import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Vector3,MeshStandardMaterial,BufferGeometry,Float32BufferAttribute,Mesh,MeshBasicMaterial,DoubleSide,Raycaster} from 'three';
import {createMilo,animateMilo} from '../src/obs/characters.js';
import {loadMiloBody} from '../src/obs/milo-body.js';

await loadMiloBody('data:application/json;base64,'+(await readFile(new URL('../public/assets/obs/milo/body.json',import.meta.url))).toString('base64'));

// Test the real skinned hands against the real skinned trouser surface, rather
// than checking the controller angles that previously put fingers inside it.
function handGaps(root){
  root.updateMatrixWorld(true);const skin=root.userData.bodySkin;skin.skeleton.update();
  const {position,armRegion}=skin.geometry.attributes,index=skin.geometry.index;
  const points=Array.from({length:position.count},(_,i)=>skin.applyBoneTransform(i,new Vector3().fromBufferAttribute(position,i)).applyMatrix4(skin.matrixWorld));
  const triangles=[];
  for(let i=0;i<index.count;i+=3){
    const ids=[0,1,2].map(k=>index.getX(i+k));
    if(ids.every(id=>armRegion.getX(id)<.2&&position.getY(id)>.53&&position.getY(id)<1.02))for(const id of ids)triangles.push(...points[id].toArray());
  }
  const mesh=new Mesh(new BufferGeometry().setAttribute('position',new Float32BufferAttribute(triangles,3)),new MeshBasicMaterial({side:DoubleSide}));mesh.updateMatrixWorld();
  const ray=new Raycaster(),direction=new Vector3(0,-1,0),gaps=[];
  try{
    for(const side of [-1,1]){
      let minimum=Infinity,count=0,sample=0;
      for(let i=0;i<position.count;i++){
        if(armRegion.getX(i)<=.95||position.getY(i)>=.93||Math.sign(position.getX(i))!==side||sample++%9)continue;
        const p=points[i];ray.set(new Vector3(p.x,p.y+.35,p.z),direction);
        const hit=ray.intersectObject(mesh)[0];if(hit){minimum=Math.min(minimum,p.y-hit.point.y);count++;}
      }
      gaps.push({side,minimum,count});
    }
  }finally{mesh.geometry.dispose();mesh.material.dispose();}
  return gaps;
}

test('both conversation roles rest their real hands above the fabric and keep fingers clear while gesturing',()=>{
  const root=createMilo(new Proxy({},{get:(o,k)=>o[k]??=new MeshStandardMaterial()}));
  for(const role of ['milo','curtis'])for(const age of [0,.5,2,4.85,5.5,7,9.85]){
    animateMilo(root,{action:'lounge',moving:false,climbing:false,time:age,leisure:'conversation',conversation:{age,weight:1,role}});
    for(const gap of handGaps(root)){
      assert.ok(gap.minimum>-.002,`${role} ${age}, hand ${gap.side}: finger penetrates fabric by ${-gap.minimum}`);
      if(age===4.85){
        assert.ok(gap.count>100,'the whole palm and fingers sit above the matching thigh');
        assert.ok(gap.minimum<.018,`${role}: hand should touch the thigh rather than float`);
      }
    }
  }
});

test('the hands also clear the trousers as Milo finishes sitting beside Curtis',()=>{
  const root=createMilo(new Proxy({},{get:(o,k)=>o[k]??=new MeshStandardMaterial()}));
  for(const age of [2.8,3.2,3.6,3.9,4]){
    animateMilo(root,{action:'lounge',moving:false,climbing:false,time:3,leisure:'conversation',loungeEntry:{age,companion:true}});
    for(const gap of handGaps(root))assert.ok(gap.minimum>-.003,`entry ${age}, hand ${gap.side}: finger penetrates fabric by ${-gap.minimum}`);
  }
});

test('the hands leave the thighs without cutting through the fabric during the rise',()=>{
  const root=createMilo(new Proxy({},{get:(o,k)=>o[k]??=new MeshStandardMaterial()}));
  for(const start of [2,4.85]){
    const exit={age:0,companion:true,seatedYaw:-.32,conversation:{age:start,weight:1}};
    for(const age of [0,.2,.4,.6,.8,1,1.5]){
      exit.age=age;animateMilo(root,{action:'lounge',moving:false,climbing:false,time:3+age,leisure:'conversation',loungeExit:exit});
      for(const gap of handGaps(root))assert.ok(gap.minimum>-.004,`rise ${age}, hand ${gap.side}: finger penetrates fabric by ${-gap.minimum}`);
    }
  }
});
