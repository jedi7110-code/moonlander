import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Box3,Group,Matrix4,Mesh,MeshStandardMaterial,Triangle,Vector3} from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {createMilo} from '../src/obs/characters.js';
import {createBunk,animateBunk} from '../src/obs/bunk.js';
import {headGeometry} from '../src/obs/head.js';
import {createHair} from '../src/obs/hair.js';
import {applyBedEntry,sampleBedEntry,ENTRY_STUDY,SEQUENTIAL_SECONDS} from '../studies/milo/bed-entry-model.js';

const materials=()=>new Proxy({},{get:(o,k)=>o[k]??=new MeshStandardMaterial()});
const point=object=>object.getWorldPosition(new Vector3());
const pose=(root,kind,time,sequential=true)=>{const sample=sampleBedEntry(kind,time,sequential);applyBedEntry(root,sample);root.updateMatrixWorld(true);return sample;};
const joints=root=>[root,root.userData.body,root.userData.head,...root.userData.legs.flatMap(r=>[r.leg,r.knee,r.boot]),...root.userData.arms.flatMap(r=>[r.arm,r.elbow,r.hand])];

for(const kind of ['bunk','medical']){
  test(`${kind}: anatomical left leads while the following foot stays planted`,()=>{
    const root=createMilo(materials()),start=ENTRY_STUDY[kind].start;
    const left=root.userData.legs.find(r=>r.side===1),right=root.userData.legs.find(r=>r.side===-1);
    pose(root,kind,start);const anchor=point(right.boot),leftStart=point(left.boot);
    for(let i=1;i<=42;i++){
      pose(root,kind,start+SEQUENTIAL_SECONDS*i/100);
      assert.ok(point(right.boot).distanceTo(anchor)<1e-8,'the following foot must not slide as the pelvis turns');
    }
    assert.ok(point(left.boot).y>leftStart.y+.5,'left foot is raised before right begins');
    const top=kind==='bunk'?.59:.86,center=kind==='bunk'?.38:-.22;
    assert.ok(Math.abs(point(left.boot).z-center)<.15,'left foot reaches the bed first');
    assert.ok(point(left.boot).y<top+.15,'left foot settles before lifting the right');
    pose(root,kind,start+SEQUENTIAL_SECONDS*.76);
    assert.ok(point(right.boot).y>anchor.y+.5);
    pose(root,kind,start+1.3,false);
    assert.ok(Math.abs(point(right.boot).y-point(left.boot).y)<1e-8,'the original remains the simultaneous comparison');
  });

  test(`${kind}: boots clear the real bedding, limbs remain reachable and transitions are continuous`,()=>{
    const root=createMilo(materials()),start=ENTRY_STUDY[kind].start,top=kind==='bunk'?.59:.86,center=kind==='bunk'?.38:-.22;
    const halfWidth=kind==='bunk'?.595:.53,halfLength=kind==='bunk'?1.15:1.39;
    root.updateMatrixWorld(true);
    const vertices=root.userData.legs.map(({boot})=>{
      const points=[];boot.traverse(mesh=>{if(!mesh.isMesh)return;const p=mesh.geometry.attributes.position;
        for(let i=0;i<p.count;i++)points.push(boot.worldToLocal(new Vector3().fromBufferAttribute(p,i).applyMatrix4(mesh.matrixWorld)));
      });return points;
    });
    let previous=null;
    for(let frame=-1;frame<=Math.ceil(SEQUENTIAL_SECONDS*60)+1;frame++){
      const time=start+frame/60;pose(root,kind,time);
      assert.ok((root.userData.bedEntryReachError??0)<1e-6,`leg target beyond reach at ${time}`);
      const current=joints(root).map(point);
      if(previous)current.forEach((p,i)=>assert.ok(p.distanceTo(previous[i])<.035,`joint ${i} jumps at ${time}`));
      previous=current;
      const pelvisBottom=new Box3().setFromObject(root.userData.hips,true).min.y;
      assert.ok(Math.abs(pelvisBottom-top)<.008,'pelvis must stay supported by the mattress');
      root.userData.legs.forEach(({boot},j)=>{
        for(const p of vertices[j]){
          const v=p.clone().applyMatrix4(boot.matrixWorld);
          if(Math.abs(v.x)<halfLength&&Math.abs(v.z-center)<halfWidth)assert.ok(v.y>=top-.002,`boot penetrates bedding at ${time}`);
        }
      });
    }
    // Both endpoints meet the existing poses without a snap; seeking is deterministic.
    const baseline=createMilo(materials());
    for(const age of [0,SEQUENTIAL_SECONDS]){
      pose(root,kind,start+age);pose(baseline,kind,start+(age?3:0),false);
      joints(root).forEach((joint,i)=>joint.matrixWorld.elements.forEach((value,j)=>assert.ok(Math.abs(value-joints(baseline)[i].matrixWorld.elements[j])<1e-6)));
    }
    pose(root,kind,start+1.7);const expected=joints(root).map(j=>j.matrixWorld.clone());
    for(const age of [5,2,0,3,1.7])pose(root,kind,start+age);
    joints(root).forEach((joint,i)=>joint.matrixWorld.elements.forEach((value,j)=>assert.ok(Math.abs(value-expected[i].elements[j])<1e-9)));
  });
}

test('the scanned head and hair clear the raised capsule throughout sequential boarding',async()=>{
  const bytes=await readFile(new URL('../public/assets/obs/head/LeePerrySmith.glb',import.meta.url));
  const gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
  const geometry=headGeometry(gltf.scene.getObjectByName('LeePerrySmith').geometry),head=new Group();
  head.add(new Mesh(geometry,new MeshStandardMaterial()),createHair(geometry));
  const bounds=new Box3().setFromObject(head,true).expandByScalar(.05/.055);head.scale.setScalar(.055);
  const m=materials(),root=createMilo(m,head),bunk=createBunk(m),shell=bunk.root.getObjectByName('Capsule glazing').geometry;
  const positions=shell.attributes.position,index=shell.index,transform=new Matrix4(),triangle=new Triangle();
  for(let frame=0;frame<=Math.ceil(sampleBedEntry('bunk',0).duration*30);frame++){
    const sample=pose(root,'bunk',frame/30);animateBunk(bunk,sample.pose);bunk.root.updateMatrixWorld(true);
    transform.copy(head.matrixWorld).invert().multiply(bunk.lid.matrixWorld);
    for(let i=0;i<index.count;i+=3){
      triangle.a.fromBufferAttribute(positions,index.getX(i)).applyMatrix4(transform);
      triangle.b.fromBufferAttribute(positions,index.getX(i+1)).applyMatrix4(transform);
      triangle.c.fromBufferAttribute(positions,index.getX(i+2)).applyMatrix4(transform);
      assert.ok(!bounds.intersectsTriangle(triangle),`head clips capsule at ${frame/30}`);
    }
  }
});
