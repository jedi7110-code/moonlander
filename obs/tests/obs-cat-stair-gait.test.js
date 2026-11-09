import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {Vector3} from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {createLucy,animateLucy} from '../src/obs/lucy.js';
import {CAT_STAIR_GAIT,sampleCatStairs,poseCatStairs,nearestFlight,treadHeight} from '../studies/stairs/cat-gait.js';
import {STAIRS,STAIR_ROUTE_LENGTH,STAIR_SEGMENTS} from '../studies/stairs/route.js';

async function cat(){
  const b=fs.readFileSync(new URL('../public/assets/obs/lucy/lucy-cabin.glb',import.meta.url));
  return createLucy(await new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),''),{random:()=>.5});
}
const shared=await cat();
const flights=STAIR_SEGMENTS.filter(s=>s.kind==='flight');
const id=f=>(f.leg?.rear??f.rear?'hind':'fore')+((f.leg?.side??f.side)>0?'L':'R');
const d=(flight,x)=>(x-flight.a[0])*Math.sign(flight.b[0]-flight.a[0]);
const inBand=(flight,z)=>Math.abs(z-flight.a[2])<STAIRS.width/2;
const midFlight=s=>flights.find(f=>s>f.start+.5&&s<f.end-.5);
const deg=r=>r*180/Math.PI;
// measured extent of the paw mesh ahead of / behind its contact point
const PAW={toe:.029,heel:.013};

test('standing paws never slide and the stair walk keeps the lateral sequence',()=>{
  const order=['hindL','foreL','hindR','foreR'];
  for(const direction of [1,-1])for(const flight of flights){
    const lifts=[];let previous=null;
    for(let s=flight.start-.3;s<=flight.end+.3;s+=.002){
      const a=sampleCatStairs(shared,{s,direction,wait:0});
      if(previous)for(const f of a.feet){
        const before=previous.feet.find(p=>id(p)===id(f));
        if(before.planted&&f.planted)assert.ok(Math.hypot(f.x-before.x,f.y-before.y,f.z-before.z)<1e-9,`${id(f)} slid at s=${s}`);
        if(before.planted&&!f.planted)lifts.push(id(f));
      }
      previous=a;
    }
    // Travelling down, s runs against time, so a "lift" seen with rising s is a
    // touchdown in time; reversed, those follow the same sequence.
    const sequence=direction>0?lifts:lifts.reverse();
    assert.ok(sequence.length>=30);
    sequence.slice(1).forEach((paw,i)=>assert.equal(order.indexOf(paw),(order.indexOf(sequence[i])+1)%4,`order broke after ${sequence[i]}`));
  }
});

test('on a flight every standing paw sits inside a tread, steps exactly one tread, and the standing paws span one tread at most',()=>{
  for(const direction of [1,-1]){
    const plants=new Map();
    for(let s=0;s<=STAIR_ROUTE_LENGTH;s+=.01){
      const flight=midFlight(s);if(!flight)continue;
      const a=sampleCatStairs(shared,{s,direction,wait:0}),treads=[];
      for(const f of a.feet){
        if(!f.planted)continue;
        const x=d(flight,f.x),k=Math.floor(x/STAIRS.tread);
        assert.ok(k>=-1&&k<=9);
        assert.ok(Math.abs(f.y-treadHeight(flight,x))<1e-9,'paw not on the tread surface');
        if(k>=0&&k<9){
          const into=x-k*STAIRS.tread,left=(k+1)*STAIRS.tread-x;
          // toes clear the riser ahead and the paw stays off the nosing behind
          assert.ok(Math.min(into,left)>=Math.min(CAT_STAIR_GAIT.toe,CAT_STAIR_GAIT.heel)-1e-9,`${id(f)} on a tread edge at s=${s}`);
        }
        treads.push(k);
        const key=id(f),list=plants.get(key)??[];
        if(!list.length||Math.abs(list.at(-1).x-f.x)>1e-9||Math.abs(list.at(-1).y-f.y)>1e-9)list.push({x:f.x,y:f.y,flight});
        plants.set(key,list);
      }
      if(treads.length>1)assert.ok(Math.max(...treads)-Math.min(...treads)<=1,`standing paws span ${Math.max(...treads)-Math.min(...treads)} treads at s=${s}`);
    }
    for(const [paw,list]of plants)for(let i=1;i<list.length;i++){
      if(list[i].flight!==list[i-1].flight)continue;
      // plants are listed with rising s, i.e. uphill in both directions
      const rise=Math.round((list[i].y-list[i-1].y)/STAIRS.rise);
      assert.equal(rise,1,`${paw} moved ${rise} treads in one stride`);
    }
  }
});

test('swinging paws clear every riser and nosing',()=>{
  let worst=0,at=null;
  for(const direction of [1,-1])for(let s=0;s<=STAIR_ROUTE_LENGTH;s+=.004){
    const a=sampleCatStairs(shared,{s,direction,wait:0}),{flight}=nearestFlight(s);
    for(const f of a.feet){
      if(f.planted||!inBand(flight,f.z))continue;
      const x=d(flight,f.x),ahead=direction>0?PAW.toe:PAW.heel,behind=direction>0?PAW.heel:PAW.toe;
      let floor=-Infinity;for(let o=-behind;o<=ahead+1e-9;o+=.002)floor=Math.max(floor,treadHeight(flight,x+o));
      if(floor-f.y>worst){worst=floor-f.y;at={s,direction,paw:id(f)};}
    }
  }
  assert.ok(worst<.001,`a swinging paw passes ${(worst*100).toFixed(1)} cm into the stair (${JSON.stringify(at)})`);
});

test('limbs keep their length, the visible paw stays on its leg, and standing paws reach the tread',async()=>{
  const root=await cat();let early=0,earlyAt=null,stance=0;
  for(const direction of [1,-1])for(let s=0;s<=STAIR_ROUTE_LENGTH;s+=.02){
    const result=poseCatStairs(root,{s,direction,wait:0},s/.5,1/60);
    assert.ok([root.position.x,root.position.y,root.position.z,result.pitch].every(Number.isFinite));
    for(const {leg,f,error}of root.userData.stairRequests){
      const joints=[...leg.links,leg.effector];
      for(let j=0;j<leg.lengths.length;j++){
        const actual=joints[j].getWorldPosition(new Vector3()).distanceTo(joints[j+1].getWorldPosition(new Vector3()));
        assert.ok(Math.abs(actual-leg.lengths[j])<1e-6,`${joints[j].name} stretched`);
      }
      if(result.stairWeight===1)assert.ok(leg.foot.getWorldPosition(new Vector3()).distanceTo(leg.effector.getWorldPosition(new Vector3()))<1e-6,'paw detached from the leg');
      if(f.planted&&f.stance<.5){
        if(midFlight(s))stance=Math.max(stance,error);
        if(error>early){early=error;earlyAt={s,direction,paw:id(f)};}
      }
    }
  }
  assert.ok(stance<.01,`a standing paw misses its tread by ${(stance*100).toFixed(1)} cm mid-flight`);
  assert.ok(early<.03,`a standing paw misses its tread by ${(early*100).toFixed(1)} cm (${JSON.stringify(earlyAt)})`);
});

test('at the study speed no paw jumps between frames and the paw never leaves its leg, even while blending',async()=>{
  const root=await cat(),frame=.5/60;
  for(const direction of [1,-1]){
    let previous=null,move=0,rise=0,gap=0,at=null;
    for(let t=0;t<=STAIR_ROUTE_LENGTH;t+=frame){
      const s=direction>0?t:STAIR_ROUTE_LENGTH-t,result=poseCatStairs(root,{s,direction,wait:0},t/.5,1/60);
      const legs=root.userData.stairRig.legs,paws=legs.map(l=>l.foot.getWorldPosition(new Vector3()));
      if(result.stairWeight>0)legs.forEach((l,i)=>gap=Math.max(gap,paws[i].distanceTo(l.effector.getWorldPosition(new Vector3()))));
      if(previous)paws.forEach((p,i)=>{const d=p.distanceTo(previous[i]);if(d>move){move=d;at={s:+s.toFixed(3),paw:legs[i].foot.name};}rise=Math.max(rise,Math.abs(p.y-previous[i].y));});
      previous=paws;
    }
    // a swinging paw peaks near 2.5 m/s; a tread-high pop would be 10+ cm in a frame
    assert.ok(move<.08,`a paw moves ${(move*100).toFixed(1)} cm in one frame (${JSON.stringify(at)})`);
    assert.ok(rise<.06,`a paw rises or drops ${(rise*100).toFixed(1)} cm in one frame`);
    assert.ok(gap<1e-6,`the visible paw sits ${(gap*100).toFixed(2)} cm off its leg`);
  }
});

test('the trunk rises and falls with the flight without rearing up or nodding abruptly',()=>{
  for(const direction of [1,-1]){
    const pitches=[];let previous=null,steepest=0;
    for(let s=0;s<=STAIR_ROUTE_LENGTH;s+=.005){
      const {body}=sampleCatStairs(shared,{s,direction,wait:0});
      if(previous!==null)steepest=Math.max(steepest,Math.abs(deg(body.pitch-previous))/.5);
      previous=body.pitch;
      if(midFlight(s))pitches.push(deg(body.pitch)*direction);
    }
    const mean=pitches.reduce((a,b)=>a+b,0)/pitches.length;
    assert.ok(Math.min(...pitches)>10,`the trunk flattens to ${Math.min(...pitches).toFixed(1)}°`);
    assert.ok(Math.max(...pitches)<45,`the trunk rears to ${Math.max(...pitches).toFixed(1)}°`);
    // the flight itself is 33° (10 risers over 9 treads)
    assert.ok(mean>18&&mean<34,`average trunk angle ${mean.toFixed(1)}°`);
    // at the 0.5 m/s walk, 5°/cm is 250°/s: anything faster reads as a snap
    assert.ok(steepest<5,`trunk pitch changes ${steepest.toFixed(1)}° per cm`);
  }
});

test('away from the flights the cat uses the cabin walk unchanged',async()=>{
  const root=await cat(),reference=await cat();
  for(const [s,direction] of [[.02,1],[26.6,1],[26.6,-1],[.02,-1]]){
    const result=poseCatStairs(root,{s,direction,wait:0},1,1/60);
    animateLucy(reference,{time:1,dt:1/60,moving:true,mode:'idle',yaw:result.center.yaw,headingControlled:true,walkDistance:result.walkDistance});
    assert.equal(result.stairWeight,0);assert.equal(result.pitch,0);
    for(const {bone}of root.userData.stairRig.sampledBones){
      const other=reference.getObjectByName(bone.name);
      assert.ok(bone.position.distanceTo(other.position)<1e-6,`${bone.name} moved`);
      assert.ok(1-Math.abs(bone.quaternion.dot(other.quaternion))<1e-6,`${bone.name} differs from the cabin walk`);
    }
  }
});

test('scrubbing, reversing and pausing reproduce the same pose',async()=>{
  const root=await cat(),agent={s:3.2,direction:1,wait:0};
  const sample=dt=>{poseCatStairs(root,agent,2,dt);return root.userData.stairRig.legs.flatMap(l=>[...l.links,l.effector,l.foot]).map(b=>b.getWorldPosition(new Vector3()));};
  const before=sample(1/60);poseCatStairs(root,{s:18.3,direction:-1,wait:0},20,1/60);
  const after=sample(1/60);after.forEach((p,i)=>assert.ok(p.distanceTo(before[i])<1e-6,'scrubbing retained a previous pose'));
  const paused=sample(0);paused.forEach((p,i)=>assert.ok(p.distanceTo(after[i])<1e-6,'a paused pose drifted'));
});

test('the skinned cat stays out of the treads, risers and landings',async()=>{
  const root=await cat(),meshes=[];root.traverse(o=>{if(o.isSkinnedMesh)meshes.push(o);});
  const v=new Vector3();let worst=0,at=null,checked=0,frames=0,grazing=0;
  for(const direction of [1,-1])for(const flight of flights)for(let s=flight.start-.6;s<=flight.end+.6;s+=.05){
    poseCatStairs(root,{s,direction,wait:0},s/.5,1/60);root.updateMatrixWorld(true);frames++;let deepest=0;
    for(const mesh of meshes)for(let i=0;i<mesh.geometry.attributes.position.count;i+=2){
      mesh.getVertexPosition(i,v).applyMatrix4(mesh.matrixWorld);
      if(!inBand(flight,v.z))continue;
      const x=d(flight,v.x);if(x<-1||x>flight.run+1)continue;
      const floor=treadHeight(flight,x);if(v.y>floor+.3)continue;
      checked++;if(floor<=v.y)continue;
      // depth into the solid: the shorter way out, straight up or back out
      // through the riser face it is behind
      let out=0;while(out<.3&&Math.min(treadHeight(flight,x-out),treadHeight(flight,x+out))>v.y)out+=.0005;
      const depth=Math.min(floor-v.y,out);deepest=Math.max(deepest,depth);
      if(depth>worst){worst=depth;at={s:+s.toFixed(2),direction};}
    }
    if(deepest>.02)grazing++;
  }
  assert.ok(checked>10000);
  // Soft paw pads settle up to ~1 cm; an elbow or forearm may graze a tread
  // edge by a few centimetres in a handful of frames, never more.
  assert.ok(worst<.035,`the skinned cat enters the stair by ${(worst*100).toFixed(1)} cm (${JSON.stringify(at)})`);
  assert.ok(grazing/frames<.03,`${grazing} of ${frames} frames graze a stair edge by more than 2 cm`);
});
