import test from 'node:test';
import assert from 'node:assert/strict';
import {LADDER,sampleLadder,ladderBodyPosition} from '../src/obs/ladder-pose.js';

test('ladder easing reduces hip acceleration spikes while preserving cycle and rung contacts',()=>{
  const dt=1/120,peaks=[];
  for(const easing of [false,true]){
    const body=t=>ladderBodyPosition(sampleLadder(t,{easing}),{easing});let peak=0;
    for(let i=0;i<480;i++){
      const time=i*dt,p=body(time),a=body(time-dt),b=body(time+dt);
      assert.ok(p.toArray().every(Number.isFinite));
      peak=Math.max(peak,b.add(a).addScaledVector(p,-2).length()/dt**2);
      assert.ok(p.distanceTo(body(time+LADDER.duration))<1e-8,'no loop seam');
      const sample=sampleLadder(time,{easing});
      assert.ok(sample.contacts.filter(c=>!c.moving).length>=3);
      for(const c of sample.contacts.filter(c=>!c.moving)){
        const rung=(c.point.y+sample.travel)/LADDER.spacing;
        assert.ok(Math.abs(rung-Math.round(rung))<1e-8,'support remains locked to its rung');
      }
    }
    peaks.push(peak);
  }
  assert.ok(peaks[1]<peaks[0]*.3,`hip acceleration peak ${peaks[0]} -> ${peaks[1]}`);
  assert.ok(peaks[1]<.15,'body itself follows a gentle curve, not a sequence of softened jolts');
});

test('the torso rises continuously instead of dipping between support changes',()=>{
  const dt=1/120;let previous;
  for(let i=-240;i<=720;i++){
    const sample=sampleLadder(i*dt),p=ladderBodyPosition(sample),height=p.y+sample.travel;
    if(previous!==undefined){
      const velocity=(height-previous)/dt;
      assert.ok(velocity>.09&&velocity<.19,`continuous upward velocity: ${velocity}`);
    }
    assert.equal(p.z,-.43,'no fore/aft body twitch at a support switch');
    previous=height;
  }
});

test('released limb depth and grip ease in and out with no acceleration jump',()=>{
  const dt=.0001;
  for(const boundary of [0,.92,1,1.92,2,2.92,3,3.92,4]){
    const samples=[boundary-dt,boundary,boundary+dt].map(t=>sampleLadder(t));
    for(let i=0;i<4;i++){
      const [a,b,c]=samples.map(s=>s.contacts[i]);
      assert.ok(Math.abs(c.point.z+a.point.z-2*b.point.z)/dt**2<.04);
      assert.ok(Math.abs(c.grip+a.grip-2*b.grip)/dt**2<.04);
    }
  }
});
