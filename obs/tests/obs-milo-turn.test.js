import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createMilo,animateMilo} from '../src/obs/characters.js';
import {planMiloTurn,sampleMiloTurn,applyMiloTurn,captureMiloFeet} from '../src/obs/milo-turn.js';
import {headingEase} from '../src/obs/heading.js';
import {BathroomVisit} from '../src/obs/bathroom.js';
import {diningApproach,diningPhase} from '../src/obs/dining.js';

const v=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);
const character=()=>createMilo(new Proxy({},{get:(o,k)=>o[k]??=new THREE.MeshStandardMaterial()}));
const footprint=[[0,-.098],[.04,-.08],[.06,.02],[.068,.05],[.05,.13],[.01,.177],[-.03,.165],[-.063,.105],[-.065,.03],[-.048,-.047],[-.02,-.094]];
const support=[[-.04,-.107,-.09],[.04,-.107,-.09],[-.055,-.107,.105],[.055,-.107,.105],[-.02,-.107,.175],[.02,-.107,.175]];
function overlaps(a,b){
  return[a,b].every(polygon=>polygon.every((p,i)=>{
    const q=polygon[(i+1)%polygon.length],nx=-(q.z-p.z),nz=q.x-p.x;
    const x=a.map(p=>p.x*nx+p.z*nz),y=b.map(p=>p.x*nx+p.z*nz);
    return Math.min(...x)<Math.max(...y)&&Math.min(...y)<Math.max(...x);
  }));
}

test('small alternating steps keep a loaded sole still, clear the floor, and never cross the other boot',()=>{
  for(const degrees of [-180,-135,-90,-45,-10,10,45,90,135,180]){
    const plan=planMiloTurn(.61,.61+degrees*Math.PI/180,v(-1.88,3.392,.78));let previous;
    for(let i=0;i<=1000;i++){
      const state=sampleMiloTurn(plan,i/1000);
      assert.ok(state.feet.some(f=>f.planted),'one foot supports the body throughout');
      for(const foot of state.feet){
        const prior=previous?.feet.find(f=>f.side===foot.side);
        if(prior?.planted&&foot.planted){
          assert.ok(foot.position.distanceTo(prior.position)<1e-9,'a loaded ankle does not slide');
          assert.ok(foot.quaternion.angleTo(prior.quaternion)<1e-7,'a loaded shoe does not spin');
        }
        const floor=Math.min(...support.map(p=>v(...p).applyQuaternion(foot.quaternion).add(foot.position).y))-plan.origin.y;
        assert.ok(floor>=.003-1e-9&&floor<=.027+1e-9,'lift remains below 2.4 cm without sinking into the floor');
      }
      const polygons=state.feet.map(f=>footprint.map(([x,z])=>v(x*f.side,0,z).applyQuaternion(f.quaternion).add(f.position)));
      assert.equal(overlaps(...polygons),false,`${degrees} degrees, phase ${i/1000}: shoe silhouettes cross`);
      previous=state;
    }
  }
});

test('the actual hips, knees and ankles meet the planted world-space targets with modest knee flexion',()=>{
  const root=character(),origin=v(-1.88,3.392,.78);root.position.copy(origin);
  for(const degrees of [-180,-90,45,90,180]){
    const from=-Math.PI/2,plan=planMiloTurn(from,from+degrees*Math.PI/180,origin);
    for(let frame=0;frame<=240;frame++){
      animateMilo(root,{moving:false,time:0,dt:0});root.rotation.y=from+plan.delta*headingEase(frame/240);
      const state=applyMiloTurn(root,plan,frame/240);
      for(const rig of root.userData.legs){
        const foot=state.feet.find(f=>f.side===rig.side),ankle=rig.boot.getWorldPosition(v());
        assert.ok(ankle.distanceTo(foot.position)<1e-8);
        assert.ok(rig.boot.getWorldQuaternion(new THREE.Quaternion()).angleTo(foot.quaternion)<1e-7);
        const hip=rig.leg.getWorldPosition(v()),knee=rig.knee.getWorldPosition(v());
        const bend=Math.PI-hip.clone().sub(knee).angleTo(ankle.clone().sub(knee));
        assert.ok(bend>=0&&bend<.75,`knee flexion stays subtle: ${bend}`);
      }
      assert.ok(-root.userData.body.position.y<.03,'no large squat or bounce');
    }
  }
});

test('ordinary turns retain contacts when paused, retarget smoothly, and match at different frame rates',()=>{
  const snapshots=[];
  for(const fps of [30,60,120]){
    const root=character();animateMilo(root,{moving:false,time:0,dt:0});
    for(let i=0;i<fps*.5;i++)animateMilo(root,{moving:false,action:'plant',time:(i+1)/fps,dt:1/fps});
    const before=captureMiloFeet(root);snapshots.push(before);
    animateMilo(root,{moving:false,action:'plant',time:.5,dt:0});
    captureMiloFeet(root).forEach((foot,i)=>assert.ok(foot.position.distanceTo(before[i].position)<1e-8));
    animateMilo(root,{moving:false,action:'airlock',time:.5+1/fps,dt:1/fps});
    captureMiloFeet(root).forEach((foot,i)=>assert.ok(foot.position.distanceTo(before[i].position)<.005,'retarget from visible feet'));
    for(let i=0;i<fps*4;i++)animateMilo(root,{moving:false,action:'airlock',time:1+i/fps,dt:1/fps});
    root.userData.legs.forEach(r=>assert.ok(r.leg.rotation.toArray().slice(0,3).every(n=>Math.abs(n)<1e-8),'returns to the neutral stance'));
  }
  snapshots.slice(1).forEach(feet=>feet.forEach((f,i)=>assert.ok(f.position.distanceTo(snapshots[0][i].position)<1e-8)));
  const root=character();root.rotation.y=.14;
  for(let frame=0;frame<180;frame++)animateMilo(root,{moving:false,action:'idle',time:frame/60});
  assert.ok(Math.abs(root.rotation.y-.15)<1e-9,'a tiny heading correction completes without restarting forever');
});

test('bathroom turns use planted steps but seated, ladder and walking poses retain their own legs',()=>{
  const root=character();root.rotation.y=Math.PI/2;
  const visit=new BathroomVisit('shower');visit.update(.7);
  animateMilo(root,{moving:false,action:'shower',time:.7,bathroom:visit.pose});
  assert.ok(captureMiloFeet(root).some(f=>f.position.y+Math.min(...support.map(p=>v(...p).applyQuaternion(f.quaternion).y))>.008),'doorway turn lifts one foot');
  for(const options of [{action:'console',moving:false},{action:null,moving:true,facing:-1},{action:null,moving:false,climbing:true}]){
    animateMilo(root,{time:1,...options});assert.equal(root.userData.standingTurn,undefined);
  }
});

test('depth approaches do not pin the feet behind the moving body or force a deep squat',()=>{
  for(const action of ['galley','hydro','plant']){
    const root=character();root.rotation.y=Math.PI/2;root.position.z=.78;
    for(let frame=0;frame<240;frame++){
      const time=frame/60;
      root.position.z=action==='plant'?.78-.76*THREE.MathUtils.smoothstep(time,0,1.2):.78-diningApproach(action)*diningPhase(time,8).approach;
      animateMilo(root,{moving:false,action,time,actionTime:time,actionDuration:8,dt:1/60});
      assert.ok(root.userData.body.position.y>-.03,`${action}: hips remain at normal standing height`);
    }
  }
});
