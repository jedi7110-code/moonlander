import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Group,MeshStandardMaterial,Raycaster,Vector3} from 'three';
import {loadMiloBody} from '../src/obs/milo-body.js';
import {createMilo,animateMilo} from '../src/obs/characters.js';
import {medicalTransferPose,medicalDuration,MED_BED} from '../src/obs/medical.js';
import {createMedicalRig,animateMedicalRig} from '../src/obs/medical-rig.js';

const data=await readFile(new URL('../public/assets/obs/milo/body.json',import.meta.url));
await loadMiloBody(`data:application/json;base64,${data.toString('base64')}`);
const m=new Proxy({},{get:()=>new MeshStandardMaterial()});
function fixture(){
  const patient=createMilo(m),rig=createMedicalRig(m,{...MED_BED,y:0});
  const cabin=new Group();cabin.position.set(2,3.392,-1);cabin.add(patient,rig.root);
  patient.position.x=MED_BED.x;
  return{patient,rig,cabin};
}
test('both actual hands rest on the examination pad, beside the hips, without changing sleeping pose',()=>{
  const {patient}=fixture(),skin=patient.userData.bodySkin;
  for(const time of [10.05,17,medicalDuration()-10.05]){
    animateMilo(patient,{action:'medical',moving:false,time,actionTime:time});
    patient.parent.updateMatrixWorld(true);skin.skeleton.update();
    const p=skin.geometry.attributes.position,arm=skin.geometry.attributes.armRegion;
    for(const side of [-1,1]){
      const points=[];
      for(let i=0;i<p.count;i++)if(p.getX(i)*side>0&&p.getY(i)<.90&&arm.getX(i)>.95){
        const v=skin.applyBoneTransform(i,new Vector3().fromBufferAttribute(p,i)).applyMatrix4(skin.matrixWorld);
        patient.parent.worldToLocal(v);points.push(v);
      }
      const min=Math.min(...points.map(v=>v.y)),pad=MED_BED.examTop+.012;
      assert.ok(min>=pad-.001&&min<pad+.005,`hand surface should touch pad: ${min-pad}`);
      assert.ok(points.every(v=>Math.abs(v.z-MED_BED.depth)<MED_BED.width/2-.025));
      assert.ok(points.every(v=>Math.abs(v.z-MED_BED.depth)>.20),'hands remain beside the hips');
    }
  }
  const fresh=createMilo(m);
  for(const root of [patient,fresh])animateMilo(root,{action:'bunk',moving:false,time:23,actionTime:23,actionDuration:46});
  for(let i=0;i<2;i++)for(const key of ['arm','elbow','hand'])assert.deepEqual(patient.userData.arms[i][key].quaternion.toArray(),fresh.userData.arms[i][key].quaternion.toArray());
});

test('scan hits the connected animated skin on its first frame and follows each new pose in cabin coordinates',()=>{
  const {patient,rig}=fixture(),ray=new Raycaster(),down=new Vector3(0,-1,0);
  for(const age of [1,2,3,4,5,6,7]){
    const time=MED_BED.transition+age;
    animateMilo(patient,{action:'medical',moving:false,time,actionTime:time});
    // Mimic a cached standing-pose bound and require the scan to refresh it.
    if(age===1)patient.userData.bodySkin.computeBoundingBox();
    if(age===3){patient.userData.arms[0].arm.rotation.x-=.05;patient.parent.position.y+=.1;}
    animateMedicalRig(rig,medicalTransferPose(time),age,{patient,scanning:true});
    assert.ok(rig.targets.includes(patient.userData.bodySkin));
    assert.ok(rig.targets.every(mesh=>{for(let node=mesh;node;node=node.parent)if(!node.visible)return false;return true;}));
    let hits=0;
    for(const point of rig.points){
      const origin=rig.root.localToWorld(new Vector3(point.x,2,point.z));
      ray.set(origin,down);
      const hit=ray.intersectObject(patient.userData.bodySkin,false)[0];
      if(!hit)continue;
      const surface=rig.root.worldToLocal(hit.point);
      assert.ok(point.y>=surface.y+.008,'stripe must stay above the visible skin');hits++;
    }
    assert.ok(hits>0,`sweep ${age} should intersect the actual body`);
    const snapshot=rig.stripe.geometry.attributes.position.array.slice();
    animateMedicalRig(rig,medicalTransferPose(time),age,{patient,scanning:true});
    assert.deepEqual(rig.stripe.geometry.attributes.position.array,snapshot);
  }
});

test('scan reuses the deformed surface while still refreshing changed bones and geometry',()=>{
  const {patient,rig}=fixture(),skin=patient.userData.bodySkin;
  animateMilo(patient,{action:'medical',moving:false,time:12,actionTime:12});
  let count=0;const vertex=skin.getVertexPosition.bind(skin);
  skin.getVertexPosition=(i,p)=>{count++;return vertex(i,p);};
  const scan=age=>animateMedicalRig(rig,medicalTransferPose(12),age,{patient,scanning:true});
  scan(2);assert.equal(count,skin.geometry.attributes.position.count);
  count=0;scan(2.1);assert.equal(count,0,'moving beam alone does not re-skin the patient');
  assert.ok(rig.surfaces.get(skin).mesh.geometry.drawRange.count<skin.geometry.index.count/10,'only the scan slice is ray-tested');
  patient.userData.arms[0].elbow.rotation.x-=.01;scan(2.2);
  assert.equal(count,skin.geometry.attributes.position.count);
  count=0;skin.geometry.attributes.position.needsUpdate=true;scan(2.3);
  assert.equal(count,skin.geometry.attributes.position.count);
});
