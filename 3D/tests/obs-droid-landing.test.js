import test from 'node:test';
import assert from 'node:assert/strict';
import {Vector3} from 'three';
import {createDroid,DROID_SPEC} from '../src/obs/droid-model.js';
import {sampleDroidServicePose} from '../src/obs/droid-service.js';
import {DROID_LADDER_LANDING,LADDER_ENTRY} from '../src/obs/pace.js';

test('droid grips from the deck before transferring its feet, including upper-deck openings',()=>{
  const droid=createDroid({detail:'obs'});
  try{
    for(const [start,end,depth]of [[0,3.392,.34],[3.392,0,1.34],[3.392,6.784,1.34],[6.784,0,1.34]])for(let i=0;i<150;i++){
      const u=i/150,y=start+Math.sign(end-start)*LADDER_ENTRY.droidHeight*u;
      const pose=sampleDroidServicePose({y,z:depth,climb:{from:start,to:end,startDepth:depth},age:u*3,duration:20,rest:0});
      const actual=droid.update(u*3,'service',pose);
      if(u>=.38)for(const [j,arm]of droid.arms.entries()){
        const grip=arm.palm.ladderGrip.getWorldPosition(new Vector3());
        assert.ok(grip.distanceTo(new Vector3(...pose.hands[j]))<.001,'fingers meet the rung before and after the first step');
      }
      droid.root.position.set(0,y,depth);droid.root.rotation.y=Math.PI;droid.root.updateMatrixWorld(true);
      for(const r of droid.legs){
        const sole=r.foot.localToWorld(new Vector3(0,-.099,0));
        if(u<=.4||r.side===1&&u<=.62){assert.ok(Math.abs(sole.y-start)<1e-7);assert.ok(Math.abs(sole.z-depth+.045)<1e-7);}
      }
      for(const f of actual.feet)for(const [a,b,length]of [[f.hip,f.knee,DROID_SPEC.upperLeg],[f.knee,f.hock,DROID_SPEC.middleLeg],[f.hock,f.local,DROID_SPEC.lowerLeg]])
        assert.ok(Math.abs(a.distanceTo(b)-length)<1e-6,'mounting must not stretch a leg segment');
    }
  }finally{droid.dispose();}
});

test('droid steps backwards onto either deck while holding the ladder until both feet land',()=>{
  const droid=createDroid({detail:'obs'});
  try{
    for(const [end,depth]of [[0,.34],[3.392,1.34]]){
    let planted;
    for(let i=0;i<=200;i++){
      const u=i/200,y=end+DROID_LADDER_LANDING.height*(1-u),z=.34+(depth-.34)*u;
      const pose=sampleDroidServicePose({y,z,climb:{from:6.784,to:end,endDepth:depth},age:10+u,duration:20,rest:0});
      const actual=droid.update(u,'service',pose);
      if(u>=.21&&u<=.62)for(const [j,arm]of droid.arms.entries()){
        const grip=arm.palm.ladderGrip.getWorldPosition(new Vector3());
        assert.ok(grip.distanceTo(new Vector3(...pose.hands[j]))<.001,'hands support the descent');
        assert.ok(Math.abs(z-grip.z-.03)<1e-6,'hands stay on the fixed rung plane');
      }
      droid.root.position.set(0,y,z);droid.root.rotation.y=Math.PI;droid.root.updateMatrixWorld(true);
      const feet=droid.legs.map(r=>({side:r.side,p:r.foot.localToWorld(new Vector3(0,-.099,0))}));
      const first=feet.find(f=>f.side===1).p,second=feet.find(f=>f.side===-1).p;
      assert.ok(first.y>=end-1e-7&&second.y>=end-1e-7,'neither sole penetrates the deck');
      assert.ok(Math.abs(first.x+.137)<1e-7&&Math.abs(second.x-.137)<1e-7,'both steps move straight back');
      if(u>=.14&&u<=.39)assert.ok(Math.abs(second.z-.03)<1e-7&&second.y>end+.1,'following foot stays on its rung');
      if(u>=.38){planted??=first.clone();assert.ok(first.distanceTo(planted)<1e-7,'first sole stays fixed during weight transfer');}
      if(u>=.60)assert.ok(Math.abs(second.y-end)<1e-7,'second sole finishes on the floor');
      for(const f of actual.feet){
        for(const [a,b,length]of [[f.hip,f.knee,DROID_SPEC.upperLeg],[f.knee,f.hock,DROID_SPEC.middleLeg],[f.hock,f.local,DROID_SPEC.lowerLeg]])
          assert.ok(Math.abs(a.distanceTo(b)-length)<1e-6,'landing must not stretch a leg segment');
      }
    }
    assert.ok(Math.abs(planted.z-depth+.045)<1e-7,'stand behind the opening');
    }
  }finally{droid.dispose();}
});
