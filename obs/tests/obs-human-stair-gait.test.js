import test from 'node:test';
import assert from 'node:assert/strict';
import {HUMAN_STAIR_GAIT as G,humanSchedule,sampleHumanStairs,soleExtremes} from '../studies/stairs/human-gait.js';
import {STAIRS,STAIR_SEGMENTS,STAIR_ROUTE_LENGTH as L,EXIT_START,humanPace} from '../studies/stairs/route.js';

const flights=STAIR_SEGMENTS.filter(s=>s.kind==='flight');
const T=STAIRS.tread,UPPER=.435,LOWER=Math.hypot(.425,.013),REACH=UPPER+LOWER;
const knee=d=>180-Math.acos(Math.max(-1,Math.min(1,(UPPER**2+LOWER**2-d*d)/(2*UPPER*LOWER))))*180/Math.PI;
const inFlight=s=>flights.some(f=>s>f.start+.3&&s<f.end-.3);
const flightD=(f,x)=>(x-f.a[0])*Math.sign(f.b[0]-f.a[0]);

// Walk the whole route at the traffic speed (60 fps), then the walk-off
// (StairTraffic raises exit by 0.6/s), and collect every frame.
function walk(direction){
  const frames=[];let s=direction>0?0:L;
  for(;;){
    frames.push({s,...sampleHumanStairs({s,direction,wait:0})});
    if(direction>0?s>=L:s<=0)break;
    const mid=s+direction*.66*humanPace(s,direction)/120;
    s=Math.max(0,Math.min(L,s+direction*.66*humanPace(mid,direction)/60));
  }
  for(let exit=.01;exit<=1+1e-9;exit+=.01)frames.push({s,exit,...sampleHumanStairs({s,direction,wait:Infinity,exit:Math.min(1,exit)})});
  return frames;
}
const runs={1:walk(1),[-1]:walk(-1)};
// Surface under a point, independent of the gait's own groundAt: the tread
// or landing of the flight below it (flights are stacked, so the highest one
// not above the point), else the floor level of the step the foot left.
function surface(p,foot){
  let best=-Infinity;
  for(const f of flights){
    if(Math.abs(p.z-f.a[2])>STAIRS.width/2+.1)continue;
    const d=flightD(f,p.x),run=Math.abs(f.b[0]-f.a[0]);if(d<-1.2||d>run+1.2)continue;
    const h=d<0?f.a[1]:d>=run-1e-9?f.b[1]:f.a[1]+Math.min(9,Math.floor(d/T+1e-9)+1)*STAIRS.rise;
    if(h<=p.y+.3)best=Math.max(best,h);
  }
  return best>-Infinity?best:foot.ground;
}
function soleClearance(foot){
  const {heel,toe}=soleExtremes(foot);let min=Infinity;
  for(let k=0;k<=10;k++){const p=heel.clone().lerp(toe,k/10);min=Math.min(min,p.y-surface(p,foot));}
  return min;
}

test('every flight is climbed step over step, one tread per step, feet alternating',()=>{
  for(const dir of [1,-1]){
    const steps=humanSchedule(dir);
    for(let k=1;k<steps.length;k++){assert.ok(steps[k].t>steps[k-1].t);assert.notEqual(steps[k].side,steps[k-1].side);}
    for(const f of flights){
      const on=steps.filter(s=>s.flight?.start===f.start).map(s=>s.tread);
      assert.deepEqual(on,dir>0?[1,2,3,4,5,6,7,8,9,10]:[10,9,8,7,6,5,4,3,2,1,0]);
    }
  }
});

test('feet land inside their treads: toes short of the riser going up, just past the nosing going down',()=>{
  for(const dir of [1,-1])for(const step of humanSchedule(dir)){
    if(!step.flight||step.tread<1||step.tread>9)continue;
    const d=flightD(step.flight,step.ankle.x),lo=(step.tread-1)*T,hi=step.tread*T;
    if(dir>0){
      const toe=d+G.foot.toe,heel=d-G.foot.heel;
      assert.ok(hi-toe>=.045&&hi-toe<=.06,`toe ${((hi-toe)*100).toFixed(1)} cm from the riser`);
      assert.ok(lo-heel<=.06,'most of the foot is on the tread');
    }else{
      const toe=d-G.foot.toe,heel=d+G.foot.heel;
      assert.ok(lo-toe>=0&&lo-toe<=.047,'shoe tip 0-47 mm past the nosing (F14)');
      assert.ok(hi-heel>=.02,'heel clear of the riser behind');
    }
    assert.ok(Math.abs(step.ground-(step.flight.a[1]+step.tread*STAIRS.rise))<1e-9);
  }
});

test('stair cadence matches measured stair gait (~90 steps/min up, ~105 down)',()=>{
  for(const dir of [1,-1]){
    const steps=humanSchedule(dir).filter(s=>s.flight&&s.tread>1&&s.tread<9),times=[];
    for(let i=1;i<steps.length;i++)if(steps[i].flight===steps[i-1].flight){
      const s=dir>0?steps[i].t:L-steps[i].t;times.push(Math.abs(steps[i].t-steps[i-1].t)/(.66*humanPace(s,dir)));
    }
    const cadence=60/(times.reduce((a,b)=>a+b)/times.length);
    if(dir>0)assert.ok(cadence>82&&cadence<100,`up ${cadence.toFixed(0)} steps/min`);
    else assert.ok(cadence>98&&cadence<115,`down ${cadence.toFixed(0)} steps/min`);
  }
});

test('a planted foot never slides: it rolls about its heel or toe',()=>{
  for(const dir of [1,-1]){
    const steps=humanSchedule(dir);
    for(const frame of runs[dir])for(const foot of frame.feet){
      if(!foot.planted)continue;
      const flat=soleExtremes({ankle:steps[foot.step].ankle,pitch:0,yaw:foot.yaw}),now=soleExtremes(foot);
      const pivot=foot.pitch>1e-9?'toe':foot.pitch<-1e-9?'heel':null;
      if(pivot)assert.ok(now[pivot].distanceTo(flat[pivot])<1e-9,'contact point fixed');
      else assert.ok(foot.ankle.distanceTo(steps[foot.step].ankle)<1e-9);
      assert.ok(soleClearance(foot)>-1e-6,'sole never below the tread');
    }
  }
});

test('swinging feet clear every nosing and riser; toes clear nosings by ~5 cm going up',()=>{
  for(const dir of [1,-1]){
    let nosingToe=Infinity;
    for(const frame of runs[dir])for(const foot of frame.feet){
      if(foot.planted)continue;
      const c=soleClearance(foot);
      assert.ok(c>-1e-6,`sole ${(c*100).toFixed(1)} cm into the stair at s=${frame.s.toFixed(2)}`);
      if(foot.swing>.3&&foot.swing<.7)assert.ok(c>.015,`mid-swing clearance ${(c*100).toFixed(1)} cm at s=${frame.s.toFixed(2)}`);
      if(dir>0){
        const {toe}=soleExtremes(foot);
        for(const f of flights){
          const d=flightD(f,toe.x);if(Math.abs(toe.z-f.a[2])>1||d<0||d>f.run)continue;
          const n=Math.floor(d/T);if(n<1||n>9||d-n*T>.01)continue;
          const top=f.a[1]+(n+1)*STAIRS.rise;if(Math.abs(toe.y-top)<.3)nosingToe=Math.min(nosingToe,toe.y-top);
        }
      }
    }
    if(dir>0)assert.ok(nosingToe>.04&&nosingToe<.09,`toe over the nosing ${(nosingToe*100).toFixed(1)} cm (S21: 4.9-5.5)`);
  }
});

test('legs stay within reach and bend like measured stair gait',()=>{
  for(const dir of [1,-1]){
    const contact=[],stance=[];let swingReach=0;
    for(const frame of runs[dir])frame.feet.forEach((foot,i)=>{
      const d=foot.ankle.distanceTo(frame.hips[i]);
      if(foot.planted)assert.ok(d<=REACH+.002,`stance leg overstretched ${((d-REACH)*1000).toFixed(0)} mm at s=${frame.s.toFixed(2)}`);
      else swingReach=Math.max(swingReach,d-REACH);
      if(foot.planted&&inFlight(frame.s)){const v=frame.phi-foot.step;if(v<.03)contact.push(knee(d));if(v>.4&&v<1)stance.push(knee(d));}
    });
    // a swinging foot may fall up to 3.5 cm short of its planned path (in the
    // air, right after the trailing foot leaves the floor for the second tread)
    assert.ok(swingReach<.035,`swing foot short by ${(swingReach*100).toFixed(1)} cm`);
    const mean=a=>a.reduce((x,y)=>x+y,0)/a.length;
    if(dir>0){
      assert.ok(mean(contact)>62&&mean(contact)<76,`knee at contact ${mean(contact).toFixed(0)}° (C: 69°)`);
      assert.ok(Math.min(...stance)<22,`stance knee extends to ${Math.min(...stance).toFixed(0)}° (R: ~10°)`);
    }else assert.ok(mean(contact)>12&&mean(contact)<32,`knee at contact ${mean(contact).toFixed(0)}° (C: 20°)`);
  }
});

test('the body rises and lowers smoothly, as fast as measured, with no jumps',()=>{
  for(const dir of [1,-1]){
    const frames=runs[dir],cut=frames.findIndex(f=>f.s===(dir>0?L:0));let vy=0,speed=null;
    for(let i=1;i<frames.length;i++){
      const a=frames[i-1],b=frames[i];
      const move=Math.hypot(b.pelvis.x-a.pelvis.x,b.pelvis.y-a.pelvis.y,b.pelvis.z-a.pelvis.z);
      assert.ok(move<.02,`pelvis moved ${(move*100).toFixed(1)} cm in a frame at s=${b.s.toFixed(2)}`);
      // walking speed (over 3 frames) changes gradually: no sudden stop or
      // start, incl. the stair ends, turns, exit path and walk-off
      // (the frame reaching the route end is shortened: skip windows across it)
      if(i>=3&&(cut<i-3||cut>i)){
        const c=frames[i-3],v=Math.hypot(b.pelvis.x-c.pelvis.x,b.pelvis.z-c.pelvis.z)*20;
        if(speed!==null)assert.ok(Math.abs(v-speed)<.04,`speed ${speed.toFixed(2)} -> ${v.toFixed(2)} m/s at s=${b.s.toFixed(2)} exit=${b.exit??0}`);
        speed=v;
      }
      b.feet.forEach((f,k)=>assert.ok(f.ankle.distanceTo(a.feet[k].ankle)<.09,`foot jumped at s=${b.s.toFixed(2)}`));
      if(inFlight(b.s))vy=Math.max(vy,Math.abs(b.pelvis.y-a.pelvis.y)*60);
    }
    // F19: peak downward COM velocity -0.55 m/s going down; going up slower
    if(dir>0)assert.ok(vy<.5,`up ${vy.toFixed(2)} m/s`);else assert.ok(vy>.4&&vy<.7,`down ${vy.toFixed(2)} m/s`);
  }
});

test('trunk leans ~11° going up, stays near upright going down, gaze lowered on the flights',()=>{
  for(const dir of [1,-1]){
    const on=runs[dir].filter(f=>inFlight(f.s)),lean=on.reduce((a,f)=>a+f.lean,0)/on.length*180/Math.PI;
    if(dir>0)assert.ok(lean>8&&lean<14,`up lean ${lean.toFixed(1)}°`);else assert.ok(lean<4,`down lean ${lean.toFixed(1)}°`);
    assert.ok(on.every(f=>f.gaze>.25));
    const floor=runs[dir].find(f=>f.weight===0);assert.ok(floor.lean<.05&&floor.gaze<.1);
  }
});

test('the exit off the top flight is walked at an even pace without a twist or crossed feet',()=>{
  for(const dir of [1,-1]){
    const on=runs[dir].filter(f=>f.s>EXIT_START+.05&&!f.exit);
    for(const frame of on){
      for(const foot of frame.feet){
        const twist=Math.abs(Math.atan2(Math.sin(foot.yaw-frame.pelvis.yaw),Math.cos(foot.yaw-frame.pelvis.yaw)));
        assert.ok(twist<.8,`foot turned ${(twist*57.3).toFixed(0)}° from the hips at s=${frame.s.toFixed(2)}`);
      }
      const [a,b]=frame.feet.map(f=>f.ankle),gap=Math.hypot(a.x-b.x,a.z-b.z);
      assert.ok(gap>.13,`feet ${(gap*100).toFixed(0)} cm apart at s=${frame.s.toFixed(2)}`);
    }
  }
});

test('the two boots never cut into each other, also on the turns',()=>{
  // boot footprint: heel 10.1 cm behind and toe 18.3 cm ahead of the ankle, 14 cm wide
  const rect=f=>{const fx=Math.sin(f.yaw),fz=Math.cos(f.yaw),c=Math.cos(f.pitch),pts=[];
    for(const a of [-G.foot.heel*c,G.foot.toe*c])for(const w of [-.07,.07])pts.push([f.ankle.x+fx*a+fz*w,f.ankle.z+fz*a-fx*w]);return pts;};
  const depth=(a,b)=>{let min=Infinity;
    for(const r of [a,b])for(const [i,j] of [[0,1],[0,2]]){
      const n=Math.hypot(r[j][0]-r[i][0],r[j][1]-r[i][1]),ax=[(r[j][0]-r[i][0])/n,(r[j][1]-r[i][1])/n];
      const pa=a.map(q=>q[0]*ax[0]+q[1]*ax[1]),pb=b.map(q=>q[0]*ax[0]+q[1]*ax[1]);
      min=Math.min(min,Math.min(Math.max(...pa),Math.max(...pb))-Math.max(Math.min(...pa),Math.min(...pb)));
    }
    return Math.max(0,min);};
  for(const dir of [1,-1])for(const frame of runs[dir]){
    const [a,b]=frame.feet,low=f=>Math.min(soleExtremes(f).heel.y,soleExtremes(f).toe.y);
    if(Math.abs(low(a)-low(b))>.19)continue; // one sole is above the other boot
    // the rectangle is a conservative boot outline (real toes and heels are rounded)
    const d=depth(rect(a),rect(b));assert.ok(d<.01,`boots overlap ${(d*100).toFixed(1)} cm at s=${frame.s.toFixed(2)}`);
  }
});

test('after the route it walks out and stops with both feet flat side by side',()=>{
  for(const dir of [1,-1]){
    const end=dir>0?L:0;let previous=null;
    for(let exit=0;exit<=1;exit+=1/100){
      const frame=sampleHumanStairs({s:end,direction:dir,wait:Infinity,exit});
      if(previous)assert.ok(Math.hypot(frame.pelvis.x-previous.pelvis.x,frame.pelvis.z-previous.pelvis.z)<.02,'walks on smoothly');
      previous=frame;
    }
    const last=sampleHumanStairs({s:end,direction:dir,wait:Infinity,exit:1});
    assert.ok(last.feet.every(f=>f.planted&&Math.abs(f.pitch)<1e-9));
    const [a,b]=last.feet.map(f=>f.ankle),along=Math.abs((b.x-a.x)*Math.sin(last.pelvis.yaw)+(b.z-a.z)*Math.cos(last.pelvis.yaw));
    assert.ok(along<.2,`feet ${(along*100).toFixed(0)} cm apart along the walk`);
  }
});

test('the pose is a pure function of the route position',()=>{
  for(const s of [.4,3.1,9.8,15.2,21.7,26.9])for(const direction of [1,-1]){
    const a=sampleHumanStairs({s,direction,wait:0}),b=sampleHumanStairs({s,direction,wait:0});
    assert.deepEqual(JSON.stringify(a),JSON.stringify(b));
  }
});
