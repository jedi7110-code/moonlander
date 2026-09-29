import test from 'node:test';
import assert from 'node:assert/strict';
import {Group,MeshStandardMaterial,Raycaster,Vector3} from 'three';
import {createDroid,DROID_SPEC} from '../src/obs/droid-model.js';
import {sampleDroidServicePose} from '../src/obs/droid-service.js';
import {DROID_LADDER_LANDING,LADDER_ENTRY} from '../src/obs/pace.js';
import {DroidRoutine,DROID_FLOORS} from '../src/obs/droid-routine.js';
import {createDeckFloor} from '../src/obs/ship.js';
import {Supplies} from '../src/obs/state.js';

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

test('upper-deck arrivals keep a real support until both soles reach the bridge before turning',()=>{
  const droid=createDroid({detail:'obs'}),navigation=new Group(),material=new MeshStandardMaterial();
  navigation.add(droid.root);
  const decks=DROID_FLOORS.map((y,level)=>createDeckFloor(new Proxy({},{get:()=>material}),y,level));
  decks.forEach(deck=>deck.updateMatrixWorld(true));
  const down=new Vector3(0,-1,0),ray=new Raycaster(),v=()=>new Vector3();
  const onDeck=point=>{
    ray.set(point.clone().addScaledVector(down,-.02),down);ray.far=.045;
    return ray.intersectObjects(decks,true).length>0;
  };
  const onRung=(point,sole=false)=>Math.abs(point.x)<.3&&Math.hypot(point.z-.03,
    point.y-(.12+Math.round((point.y-.12-(sole?.028:0))/.28)*.28)-(sole?.028:0))<.005;
  try{
    for(const destination of [0,1]){
      const routine=new DroidRoutine({care:new Supplies()});
      routine.position={x:0,y:0,z:.34,floor:2,yaw:Math.PI};routine.plan={...routine.position};
      routine.travel(destination,2,1.48);
      while(routine.step.kind!=='climb')routine.update(1/60);
      let landed=false,landingFrames=0,turnFrames=0;
      while(routine.steps.length){
        const p=routine.pose,pose=sampleDroidServicePose(p);
        droid.update(p.time,'service',pose);
        navigation.position.set(p.x,p.y,p.z);navigation.rotation.y=p.yaw;navigation.updateMatrixWorld(true);
        const soles=droid.legs.map(leg=>leg.foot.localToWorld(new Vector3(0,-.099,0)));
        const hands=droid.arms.map(arm=>arm.palm.ladderGrip.getWorldPosition(v()));
        assert.ok(hands.some(point=>onRung(point))||soles.some(point=>onRung(point,true)||onDeck(point)),
          'every frame needs a rung grip, a rung under a sole, or an actual deck surface');
        if(p.climb?.landingProgress!=null){
          landingFrames++;
          if(p.climb.landingProgress>=.61)assert.ok(soles.every(onDeck),'both feet finish on solid floor before releasing the hands');
        }
        if(!p.climb){
          if(!landed){
            landed=true;
            assert.ok(soles.every(onDeck),'climbing cannot finish while standing over the shaft');
            for(const leg of droid.legs)for(const x of [-.073,.073])for(const z of [-.107,.181])
              assert.ok(leg.foot.localToWorld(new Vector3(x,-.099,z)).z>.94,'the whole foot clears the bridge edge');
          }
          if(p.mode==='turn'){
            turnFrames++;
            assert.ok(soles.some(onDeck),'turning keeps its supporting foot on the actual deck');
          }else if(turnFrames)break;
        }
        routine.update(1/60);
      }
      assert.ok(landingFrames>=179&&turnFrames>0&&landed,'check the full transfer and following turn on each upper deck');
    }
  }finally{
    droid.dispose();material.dispose();decks.forEach(deck=>deck.traverse(o=>o.geometry?.dispose()));
  }
});
