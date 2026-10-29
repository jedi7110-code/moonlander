import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Box3,Group,Matrix4,Mesh,MeshStandardMaterial,Triangle,Vector3} from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {BunkVisit,BUNK_PHASE_SECONDS} from '../src/obs/bunk-visit.js';
import {BUNK_BED,BUNK_TRAY} from '../src/obs/recline.js';
import {createBunk,animateBunk} from '../src/obs/bunk.js';
import {createMilo,animateMilo} from '../src/obs/characters.js';
import {headGeometry} from '../src/obs/head.js';
import {createHair} from '../src/obs/hair.js';

const materials=()=>new Proxy({},{get:()=>new MeshStandardMaterial()});
const advanceTo=(visit,phase)=>{for(let i=0;i<30&&visit.phase!==phase;i++)visit.update(BUNK_PHASE_SECONDS[visit.phase]);assert.equal(visit.phase,phase);};

test('tray extends before sitting, returns with the sleeper, and reverses the complete sequence on waking',()=>{
  const visit=new BunkVisit();advanceTo(visit,'extending');
  assert.equal(visit.pose.open,1);assert.equal(visit.pose.seat,0);assert.equal(visit.pose.tray,0);
  advanceTo(visit,'sitting');assert.equal(visit.pose.tray,1);assert.equal(visit.pose.seat,0);
  advanceTo(visit,'settled');assert.equal(visit.pose.seat,1);assert.equal(visit.pose.recline,0);
  advanceTo(visit,'entering');assert.equal(visit.pose.recline,1);assert.equal(visit.pose.tray,1);
  advanceTo(visit,'closing');assert.equal(visit.pose.tray,0);assert.equal(visit.pose.depth,BUNK_BED.depth);
  advanceTo(visit,'sleeping');visit.requestExit();advanceTo(visit,'leaving');assert.equal(visit.pose.open,1);
  advanceTo(visit,'rising');assert.equal(visit.pose.tray,1);assert.equal(visit.pose.recline,1);
  advanceTo(visit,'seated');assert.equal(visit.pose.recline,0);assert.equal(visit.pose.seat,1);
  advanceTo(visit,'retracting');assert.equal(visit.pose.seat,0);assert.equal(visit.pose.occupied,false);
  advanceTo(visit,'done');assert.equal(visit.pose.depth,BUNK_TRAY.walkDepth);assert.equal(visit.pose.tray,0);
});

test('bed linen and pillow move rigidly on the tray while the head hinge remains fixed',()=>{
  const bunk=createBunk(materials()),pivot=bunk.lid.position.clone();
  const names=['Tray pan','Tray mattress','Tray blanket','Tray pillow'];
  const initial=names.map(name=>bunk.root.getObjectByName(name).getWorldPosition(new Vector3()));
  for(let i=0;i<=20;i++){
    const t=i/20;animateBunk(bunk,{open:1,tray:t});bunk.root.updateMatrixWorld(true);
    assert.deepEqual(bunk.lid.position.toArray(),pivot.toArray());
    names.forEach((name,j)=>{
      const shift=bunk.root.getObjectByName(name).getWorldPosition(new Vector3()).sub(initial[j]);
      assert.ok(Math.abs(shift.z-BUNK_TRAY.travel*t)<1e-9);assert.equal(shift.x,0);assert.equal(shift.y,0);
    });
    assert.ok(new Box3().setFromObject(bunk.tray).max.z<1.3);
    assert.ok(bunk.runners.position.z<=bunk.tray.position.z);
  }
});

test('the scanned head and hair clear the glass and rim throughout boarding and waking',async()=>{
  const bytes=await readFile(new URL('../public/assets/obs/head/LeePerrySmith.glb',import.meta.url));
  const gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
  const geometry=headGeometry(gltf.scene.getObjectByName('LeePerrySmith').geometry),head=new Group();
  head.add(new Mesh(geometry,new MeshStandardMaterial()),createHair(geometry));
  // A padded head-space box conservatively covers the scan, hair and clearance to the rim.
  const headBounds=new Box3().setFromObject(head,true).expandByScalar(.05/.055);
  head.scale.setScalar(.055);
  const m=materials(),milo=createMilo(m,head),bunk=createBunk(m),visit=new BunkVisit();
  const shell=bunk.root.getObjectByName('Capsule glazing').geometry,positions=shell.attributes.position,index=shell.index;
  const transform=new Matrix4(),triangle=new Triangle();let woke=false,frames=0;
  while(visit.phase!=='done'&&frames++<1600){
    animateMilo(milo,{moving:false,action:'bunk',time:0,bunkVisit:visit});animateBunk(bunk,visit.pose);
    milo.updateMatrixWorld(true);bunk.root.updateMatrixWorld(true);
    transform.copy(head.matrixWorld).invert().multiply(bunk.lid.matrixWorld);
    for(let i=0;i<index.count;i+=3){
      triangle.a.fromBufferAttribute(positions,index.getX(i)).applyMatrix4(transform);
      triangle.b.fromBufferAttribute(positions,index.getX(i+1)).applyMatrix4(transform);
      triangle.c.fromBufferAttribute(positions,index.getX(i+2)).applyMatrix4(transform);
      assert.ok(!headBounds.intersectsTriangle(triangle),`head clips dome in ${visit.phase} at ${visit.age}`);
    }
    if(visit.phase==='sleeping'&&!woke){visit.requestExit();woke=true;}
    visit.update(1/30);
  }
  assert.equal(visit.phase,'done');
});

test('pelvis stays on the extended mattress, feet plant for sitting, and transport never slides the sleeper',()=>{
  const m=materials(),bunk=createBunk(m),milo=createMilo(m),visit=new BunkVisit();visit.startYaw=0;
  let previous=null,woke=false,frames=0;
  while(visit.phase!=='done'&&frames++<2400){
    const p=visit.pose;animateBunk(bunk,p);
    animateMilo(milo,{moving:false,facing:1,action:'bunk',time:frames/60,bunkVisit:visit});milo.updateMatrixWorld(true);bunk.root.updateMatrixWorld(true);
    const hip=milo.userData.hips.getWorldPosition(new Vector3()),head=milo.userData.head.getWorldPosition(new Vector3());
    if(previous){assert.ok(head.distanceTo(previous.head)<.045,`head jump in ${p.phase}`);assert.ok(hip.distanceTo(previous.hip)<.03,`hip jump in ${p.phase}`);}previous={head,hip};
    if(p.seat===1){
      assert.ok(Math.abs(new Box3().setFromObject(milo.userData.hips,true).min.y-BUNK_BED.top)<.008,`unsupported pelvis in ${p.phase}`);
      const center=BUNK_BED.depth+bunk.tray.position.z;assert.ok(Math.abs(hip.z-center)<BUNK_BED.width/2);
    }
    if(p.phase==='sitting'||p.phase==='standing')for(const {boot}of milo.userData.legs){
      const sole=boot.localToWorld(new Vector3(0,-.107,0));assert.ok(Math.abs(sole.y)<.01);assert.ok(Math.abs(sole.z-(BUNK_TRAY.standingDepth+.013))<.01);
    }
    if(['entering','leaving'].includes(p.phase)){assert.equal(p.recline,1);assert.ok(Math.abs(hip.z-bunk.tray.position.z-BUNK_BED.depth)<1e-9);}
    if(p.phase==='sleeping'&&!woke){visit.requestExit();woke=true;}
    visit.update(1/60);
  }
  assert.ok(frames<2400);
});

test('legs sweep low over the tray without drawing the knees up to the chest or clipping the bedding',()=>{
  const milo=createMilo(materials()),visit=new BunkVisit();visit.startYaw=0;
  const vertex=new Vector3(),kneePosition=new Vector3();let peakKnee=0;
  advanceTo(visit,'lowering');
  for(let frame=0;frame<=180;frame++){
    visit.age=frame/60;
    animateMilo(milo,{moving:false,facing:1,action:'bunk',time:0,bunkVisit:visit});milo.updateMatrixWorld(true);
    for(const {knee,boot}of milo.userData.legs){
      peakKnee=Math.max(peakKnee,knee.getWorldPosition(kneePosition).y);
      boot.traverse(mesh=>{
        if(!mesh.isMesh)return;
        const positions=mesh.geometry.attributes.position;
        for(let i=0;i<positions.count;i++){
          vertex.fromBufferAttribute(positions,i).applyMatrix4(mesh.matrixWorld);
          const overTray=Math.abs(vertex.x)<BUNK_BED.length/2&&Math.abs(vertex.z-BUNK_BED.depth-BUNK_TRAY.travel)<BUNK_BED.width/2;
          if(overTray)assert.ok(vertex.y>=BUNK_BED.top-.002,`boot clips bedding at frame ${frame}`);
        }
      });
    }
  }
  assert.ok(peakKnee<BUNK_BED.top+.38,`knees rise too far: ${peakKnee}`);
});

test('interruptions finish the current supported move and leave an empty, retracted capsule',()=>{
  for(const phase of Object.keys(BUNK_PHASE_SECONDS)){
    let exited=0;const visit=new BunkVisit({exited:()=>exited++});
    if(['waking','leaving','rising','seated','standing','retracting','sealing','departing'].includes(phase)){advanceTo(visit,'sleeping');visit.requestExit();}
    advanceTo(visit,phase);visit.update(BUNK_PHASE_SECONDS[phase]*.4);
    const before=visit.pose;visit.requestExit();assert.deepEqual(visit.pose,before);
    visit.update(40);assert.equal(visit.phase,'done');assert.equal(exited,1);assert.equal(visit.pose.tray,0);assert.equal(visit.pose.occupied,false);
  }
});
