import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {MeshStandardMaterial,Vector3} from 'three';
import {createMilo,animateMilo} from '../src/obs/characters.js';
import {loadMiloBody} from '../src/obs/milo-body.js';
import {applyMocapWalk,miloWalkData as data} from '../src/obs/mocap-walk.js';
import {MILO_GAIT,naturalStepLength,boutSpeed,planMiloWalk,miloWalkState,miloWalkSpeed,poseMiloWalk} from '../src/obs/milo-gait.js';

const body=await readFile(new URL('../public/assets/obs/milo/body.json',import.meta.url));
await loadMiloBody(`data:application/json;base64,${body.toString('base64')}`);
const character=()=>createMilo(new Proxy({},{get:(o,k)=>o[k]??=new MeshStandardMaterial()}));
const idle={time:0,dt:0,moving:false,climbing:false,facing:1,action:null};
const CABIN=54*.022,HZ=120;
const joints=root=>[...root.userData.legs.flatMap(({leg,knee,boot})=>[leg,knee,boot]),...root.userData.arms.flatMap(({arm,elbow})=>[arm,elbow]),root.userData.body,root.userData.chest,root.userData.head];
const snapshot=root=>joints(root).map(o=>({q:o.quaternion.clone(),p:o.position.clone()}));
const fallback=[[-.04,-.107,-.09],[.04,-.107,-.09],[-.055,-.107,.105],[.055,-.107,.105]];
// Play a plan and collect what the feet and the figure do. The figure walks along +z from 0.
function play(root,plan,options){
  const frames=[];
  for(let i=0;i<=Math.ceil(plan.duration*HZ);i++){
    const t=Math.min(plan.duration,i/HZ);animateMilo(root,idle);const state=poseMiloWalk(root,plan,t,options);
    root.position.set(0,0,state.x);root.rotation.set(0,0,0);root.updateMatrixWorld(true);
    const feet={};
    for(const {boot,side} of root.userData.legs){
      const sole=(boot.userData.walkSoleSupport??fallback).map(a=>boot.localToWorld(new Vector3(...a)));
      feet[side<0?'Left':'Right']={ankle:boot.getWorldPosition(new Vector3()),low:Math.min(...sole.map(p=>p.y)),high:Math.max(...sole.map(p=>p.y))};
    }
    frames.push({t,state,feet,pose:snapshot(root),wrist:root.userData.arms.map(({hand})=>hand.getWorldPosition(new Vector3()).z-state.x),hips:root.userData.body.localToWorld(new Vector3(0,.970,0))});
  }
  return frames;
}

test('step length and cadence follow the speed as people\'s do',()=>{
  assert.ok(Math.abs(naturalStepLength(MILO_GAIT.naturalSpeed)-data.cycleDistance/2)<1e-9,'the measured cycle is the anchor');
  // Grieve: step length grows with speed to the power 0.42
  const step=naturalStepLength(CABIN),cadence=CABIN/step*60;
  assert.ok(Math.abs(step-.728)<.005&&Math.abs(cadence-98)<1.5,`cabin speed: ${step.toFixed(3)} m, ${cadence.toFixed(0)} steps/min`);
  // the cabin's plain cycle keeps 0.777 m steps: 92 a minute at this speed, 44 when Milo is ill
  assert.ok(CABIN/(data.cycleDistance/2)*60<93);
  const ill=CABIN*.48,illStep=naturalStepLength(ill);
  assert.ok(illStep>.50&&illStep<.56&&ill/illStep*60>60,`ill: ${illStep.toFixed(2)} m, ${(ill/illStep*60).toFixed(0)} steps/min`);
  // a short walk does not reach the long-walk speed
  assert.ok(boutSpeed(1,CABIN)<boutSpeed(2,CABIN)&&boutSpeed(2,CABIN)<boutSpeed(6,CABIN)&&boutSpeed(12,CABIN)>.99*CABIN&&boutSpeed(12,CABIN)<=CABIN);
});

test('a planned walk starts and ends in the standing pose, at the place asked for',()=>{
  const root=character();
  for(const [distance,speed,first] of [[6,CABIN,'Left'],[2,CABIN,'Right'],[.5,CABIN,'Left'],[9,CABIN*.48,'Right']]){
    const plan=planMiloWalk(distance,speed,{first});
    animateMilo(root,idle);const standing=snapshot(root);
    for(const [label,t] of [['start',0],['end',plan.duration],['after',plan.duration+1]]){
      animateMilo(root,idle);const state=poseMiloWalk(root,plan,t);
      snapshot(root).forEach((joint,i)=>{
        assert.ok(joint.q.angleTo(standing[i].q)<1e-6&&joint.p.distanceTo(standing[i].p)<1e-9,`${distance} m ${label}: joint ${i} differs from standing`);
      });
      assert.ok(Math.abs(state.x-(t?distance:0))<1e-9,`${distance} m ${label}: at ${state.x}`);
    }
    assert.equal(plan.footfalls.length,plan.count+3);assert.equal(plan.footfalls.at(-1),distance);assert.equal(plan.footfalls[plan.count+1],distance);
    assert.equal(plan.owners[0],first);
  }
});

test('feet land on the planned footfalls, stay where they land and never sink',()=>{
  const root=character(),plan=planMiloWalk(6,CABIN),frames=play(root,plan);
  for(const foot of ['Left','Right']){
    // stretches in which the sole is flat on the floor
    let stretch=null;const stretches=[];
    for(const frame of frames){
      const flat=frame.feet[foot].high<.012;
      if(flat){stretch??=[];stretch.push(frame);}else if(stretch){stretches.push(stretch);stretch=null;}
    }
    if(stretch)stretches.push(stretch);
    const own=plan.footfalls.filter((x,i)=>plan.owners[i]===foot&&i<plan.footfalls.length-1||i===plan.footfalls.length-1&&plan.trailing===foot);
    assert.ok(stretches.length>=own.length-1,`${foot}: ${stretches.length} flat stretches for ${own.length} footfalls`);
    for(const flat of stretches){
      const zs=flat.map(f=>f.feet[foot].ankle.z),mid=zs[Math.floor(zs.length/2)];
      assert.ok(Math.max(...zs)-Math.min(...zs)<.012,`${foot} slides ${(Math.max(...zs)-Math.min(...zs)).toFixed(3)} m while flat at ${flat[0].t.toFixed(2)} s`);
      assert.ok(own.some(x=>Math.abs(mid-x)<.035),`${foot} is flat at ${mid.toFixed(3)}, not on a footfall`);
    }
  }
  for(const frame of frames)for(const foot of ['Left','Right'])assert.ok(frame.feet[foot].low>.0025,`${foot} sole at ${frame.feet[foot].low.toFixed(4)} at ${frame.t.toFixed(2)} s`);
  // one foot at least is on the floor throughout
  for(const frame of frames)assert.ok(Math.min(frame.feet.Left.low,frame.feet.Right.low)<.011,`both feet in the air at ${frame.t.toFixed(2)} s`);
});

test('the walk gathers speed over the first steps, and stops with the feet together',()=>{
  const root=character(),plan=planMiloWalk(6,CABIN),frames=play(root,plan);
  assert.ok(Math.abs(plan.steady-.70)<.05&&Math.abs(plan.cadence-100)<6,`${plan.count} steps of ${plan.steady.toFixed(2)} m at ${plan.cadence.toFixed(0)}/min`);
  // starting and stopping cost about a second over walking the distance at the cruising speed
  assert.ok(plan.duration-6/CABIN>.7&&plan.duration-6/CABIN<1.6,`duration ${plan.duration.toFixed(2)} s`);
  assert.ok(miloWalkSpeed(plan,0)<.01&&miloWalkSpeed(plan,plan.duration)<.01);
  const paces=frames.map(f=>f.state.pace);
  assert.ok(Math.max(...paces)<1.12*CABIN&&Math.max(...paces)>.95*CABIN,`peak ${Math.max(...paces).toFixed(2)} m/s`);
  for(let i=1;i<frames.length;i++)assert.ok(Math.abs(frames[i].state.x-frames[i-1].state.x)*HZ<1.9,'no jump of the figure');
  // the first foot does not leave the floor at once (the heel rolls up first); it touches down within a second
  const first=frames.find(f=>f.feet.Left.low>.02),touch=frames.find(f=>f.t>first.t&&f.feet.Left.low<.012),landed=frames.find(f=>f.t>first.t&&f.feet.Left.high<.012);
  assert.ok(first.t>.25&&first.t<.6&&touch.t>.7&&touch.t<1.0&&landed.t<1.2,`first foot off at ${first.t.toFixed(2)} s, touches at ${touch.t.toFixed(2)} s, flat at ${landed.t.toFixed(2)} s`);
  assert.ok(Math.abs(landed.feet.Left.ankle.z-.013-plan.footfalls[2])<.03&&plan.footfalls[2]<.9*plan.steady,'a shorter first step');
  // the body has moved little by then and has about three quarters of its speed (measured: 72%)
  assert.ok(touch.state.x<.30&&touch.state.pace>.6*CABIN&&touch.state.pace<.9*CABIN,`at first contact: ${touch.state.x.toFixed(2)} m, ${touch.state.pace.toFixed(2)} m/s`);
  // the first step is one movement: once the foot is off the floor it keeps going forward until
  // it lands (it does not hang in the air), and the body has set off before the foot is down
  const airborne=frames.filter(f=>f.t>=first.t&&f.t<touch.t);
  // (as in any step, it slows over the last few centimetres before the heel touches)
  for(let i=1;i<airborne.length;i++)if(airborne[i].feet.Left.low>.025)assert.ok((airborne[i].feet.Left.ankle.z-airborne[i-1].feet.Left.ankle.z)*HZ>.25,`first foot hangs at ${airborne[i].t.toFixed(2)} s`);
  assert.ok(first.state.x>.01&&touch.state.x>.15,`body at ${first.state.x.toFixed(3)} m when the foot leaves the floor, ${touch.state.x.toFixed(2)} m when it lands`);
  // from standing the foot is lifted less than in mid-walk
  const knee=frame=>2*Math.acos(Math.min(1,Math.abs(frame.pose[1].q.w)));
  assert.ok(Math.max(...airborne.map(knee))<Math.max(...frames.filter(f=>f.t>2&&f.t<4).map(knee))-.15,'less knee lift in the first step');
  // the last step is the shortest and the body brakes through it without first speeding up
  const lastStep=plan.footfalls[plan.count+1]-plan.footfalls[plan.count];
  assert.ok(lastStep<.75*plan.steady,`last step ${lastStep.toFixed(2)} m`);
  const braking=frames.filter(f=>f.state.x>plan.footfalls[plan.count]);
  for(let i=1;i<braking.length;i++)assert.ok(braking[i].state.pace<=braking[i-1].state.pace+.02,`speeds up at ${braking[i].t.toFixed(2)} s while stopping`);
  // at the end both feet are side by side at the standing width
  const end=frames.at(-1).feet;
  assert.ok(Math.abs(end.Left.ankle.z-end.Right.ankle.z)<1e-6&&Math.abs(end.Right.ankle.x-end.Left.ankle.x-2*MILO_GAIT.standHalfWidth)<1e-6);
  // poses change smoothly: no joint turns faster than a quick knee does
  for(let i=1;i<frames.length;i++)frames[i].pose.forEach((joint,k)=>assert.ok(joint.q.angleTo(frames[i-1].pose[k].q)*HZ<30,`joint ${k} at ${frames[i].t.toFixed(2)} s`));
});

test('the skin of the trunk follows the walking chest, so the neck stays joined to the head',()=>{
  // (the trunk's skin hangs on spine bones that copy the chest; they are fitted when the caller poses
  // the standing figure, and must be fitted again once the walk has turned the chest)
  const root=character(),plan=planMiloWalk(6,CABIN),{spine,chest,head,body:pelvis}=root.userData;
  assert.ok(spine?.drivers.length,'the figure has spine bones');
  let turned=0;
  for(let t=0;t<=plan.duration;t+=.05){
    animateMilo(root,idle);poseMiloWalk(root,plan,t);root.updateMatrixWorld(true);
    for(const bone of spine.drivers)assert.ok(bone.quaternion.angleTo(chest.quaternion)<1e-6&&bone.position.distanceTo(chest.position)<1e-9,`spine bone left behind at ${t.toFixed(2)} s`);
    turned=Math.max(turned,chest.quaternion.angleTo(pelvis.quaternion.clone().set(0,0,0,1)));
    // the head sits on the neck pivot carried by the chest
    const pivot=new Vector3(0,1.607,0).applyMatrix4(chest.matrix),seat=head.position.clone().add(new Vector3(0,-.030,.009).applyQuaternion(head.quaternion));
    assert.ok(seat.distanceTo(pivot)<.004,`head ${seat.distanceTo(pivot).toFixed(4)} m off the neck at ${t.toFixed(2)} s`);
  }
  assert.ok(turned>.03,'the chest does turn during the walk');
});

test('a slow walk takes shorter, slower steps with less arm swing and more side sway',()=>{
  const root=character(),fast=planMiloWalk(8,CABIN,{vary:false}),slow=planMiloWalk(8,CABIN*.48,{vary:false});
  assert.ok(slow.steady<fast.steady-.12&&slow.cadence<fast.cadence-20,`${slow.steady.toFixed(2)} m at ${slow.cadence.toFixed(0)}/min against ${fast.steady.toFixed(2)} m at ${fast.cadence.toFixed(0)}/min`);
  const middle=(plan,options)=>play(root,plan,options).filter(f=>f.t>plan.duration*.35&&f.t<plan.duration*.65);
  const range=values=>Math.max(...values)-Math.min(...values);
  const a=middle(fast),b=middle(slow),plain=middle(slow,{swing:false});
  assert.ok(range(b.map(f=>f.wrist[0]))<.85*range(a.map(f=>f.wrist[0])),'arms swing less');
  assert.ok(range(b.map(f=>f.hips.x))>1.2*range(a.map(f=>f.hips.x)),'more sway from side to side');
  assert.ok(range(b.map(f=>f.hips.y))<.8*range(a.map(f=>f.hips.y)),'less rise and fall');
  assert.ok(range(plain.map(f=>f.wrist[0]))>1.1*range(b.map(f=>f.wrist[0])),'swing:false keeps the measured arm swing');
});

test('short walks are one or two brisk steps; the variation is repeatable and small',()=>{
  const half=planMiloWalk(.5,CABIN),one=planMiloWalk(1,CABIN),two=planMiloWalk(2,CABIN);
  assert.equal(half.count,1);assert.equal(one.count,2);assert.ok(two.count===3||two.count===4);
  // (measured bouts of 2 m take about 3 to 3.4 s at this walking speed)
  assert.ok(half.duration<1.7&&one.duration<2.4&&two.duration<3.6&&two.duration>2.6,`${half.duration.toFixed(2)}, ${one.duration.toFixed(2)}, ${two.duration.toFixed(2)} s`);
  const a=planMiloWalk(9,CABIN,{vary:3}),b=planMiloWalk(9,CABIN,{vary:3}),c=planMiloWalk(9,CABIN,{vary:false});
  assert.deepEqual(a.footfalls,b.footfalls);
  const steps=plan=>plan.footfalls.slice(3,-2).map((x,i)=>x-plan.footfalls[i+2]);
  assert.ok(steps(a).some((s,i)=>Math.abs(s-steps(c)[i])>.003),'steps vary');
  for(const s of steps(a).slice(1,-2))assert.ok(Math.abs(s/a.steady-1)<.05,`step ${s.toFixed(3)} of ${a.steady.toFixed(3)}`);
  assert.throws(()=>planMiloWalk(0,CABIN));assert.throws(()=>planMiloWalk(3,0));
});

test('the plain cabin walk is unchanged by the shared pose function',()=>{
  // (applyMocapWalk now goes through applyMocapSample: with no options it must be the measured pose)
  const root=character();animateMilo(root,idle);applyMocapWalk(root,data,.31);root.updateMatrixWorld(true);
  const {legs,body:pelvis}=root.userData,ankle=legs[0].boot.getWorldPosition(new Vector3());
  assert.ok(Number.isFinite(ankle.x+ankle.y+ankle.z)&&pelvis.position.y<0&&pelvis.position.y>-.12);
  const state=miloWalkState(planMiloWalk(6,CABIN),2.5);
  assert.ok(state.walk===1&&state.feet.Left.turnout>=0&&state.pace>1);
});
