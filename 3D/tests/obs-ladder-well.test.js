import test from 'node:test';
import assert from 'node:assert/strict';
import {MeshStandardMaterial,Vector3} from 'three';
import {createMilo,animateMilo} from '../src/obs/characters.js';
import {applyCabinLadder,CABIN_LADDER} from '../src/obs/cabin-ladder.js';
import {LADDER,LADDER_WRIST_OFFSET} from '../src/obs/ladder-pose.js';
import {positionY,FLOOR_Y} from '../src/obs/ship.js';
import {CrewMotion} from '../src/obs/state.js';
import {crewWalkway} from '../src/obs/cabin-walkway.js';
import {FLOORS,LADDER_X} from '../src/obs/layout.js';

// Joint-level checks only: the skinned body is not loaded, so this runs quickly.
const material=new MeshStandardMaterial(),create=()=>createMilo(new Proxy({},{get:()=>material}));
// The eye in head space, from the standing pose (character camera anchor).
const EYE=(()=>{const root=create();animateMilo(root,{time:0,moving:false,dt:0});root.updateMatrixWorld(true);return root.userData.head.worldToLocal(new Vector3(0,1.73,.12));})();
// The top and middle decks have an open ladder well up to the bridge at z=.94.
// Drive their transfers the way the cabin does and sample every rendered frame.
const BOOT_OUTLINE=[[0,-.098],[.04,-.08],[.06,.02],[.068,.05],[.05,.13],[.01,.177],[-.03,.165],[-.063,.105],[-.065,.03],[-.048,-.047],[-.02,-.094]];
const RUNG_HEIGHTS=Array.from({length:47},(_,k)=>CABIN_LADDER.rungBase+k*LADDER.spacing);
const solidDeck=(level,x,z)=>level===2||Math.abs(x)>=.545||z>=.94;
function hullDistance(points,x,z){
  const p=points.map(q=>[q.x,q.z]).sort((a,b)=>a[0]-b[0]||a[1]-b[1]),cross=(o,a,b)=>(a[0]-o[0])*(b[1]-o[1])-(a[1]-o[1])*(b[0]-o[0]);
  const lower=[],upper=[];
  for(const q of p){while(lower.length>1&&cross(lower.at(-2),lower.at(-1),q)<=0)lower.pop();lower.push(q);}
  for(const q of [...p].reverse()){while(upper.length>1&&cross(upper.at(-2),upper.at(-1),q)<=0)upper.pop();upper.push(q);}
  const hull=lower.slice(0,-1).concat(upper.slice(0,-1));let inside=true,distance=Infinity;
  for(let i=0;i<hull.length;i++){
    const a=hull[i],b=hull[(i+1)%hull.length],ex=b[0]-a[0],ez=b[1]-a[1];
    if(ex*(z-a[1])-ez*(x-a[0])<0)inside=false;
    const t=Math.max(0,Math.min(1,((x-a[0])*ex+(z-a[1])*ez)/(ex*ex+ez*ez||1)));
    distance=Math.min(distance,Math.hypot(x-a[0]-t*ex,z-a[1]-t*ez));
  }
  return inside?0:distance;
}
function wellDeckFrame(root,deck,transfer){
  root.updateMatrixWorld(true);
  const feet=root.userData.legs.map(rig=>{
    const outline=BOOT_OUTLINE.map(([x,z])=>rig.boot.localToWorld(new Vector3(x*rig.side,-.107,z)));
    return {outline,sole:rig.boot.localToWorld(new Vector3(0,-.107,.12)),low:Math.min(...outline.map(p=>p.y))};
  });
  let penetration=0;
  for(const {outline}of feet)for(const p of outline)for(const [level,y]of FLOOR_Y.entries()){
    if(p.y<y-.002&&p.y>y-.33&&solidDeck(level,p.x,p.z))penetration=Math.max(penetration,y-p.y);
  }
  const onRung=feet.some(f=>Math.abs(f.sole.z-CABIN_LADDER.depth)<.02&&RUNG_HEIGHTS.some(y=>Math.abs(f.sole.y-y-LADDER.radius)<.012));
  const held=root.userData.arms.some(a=>{
    const grip=root.localToWorld(root.worldToLocal(a.hand.getWorldPosition(new Vector3())).sub(LADDER_WRIST_OFFSET));
    return Math.abs(grip.x)<.38&&RUNG_HEIGHTS.some(y=>Math.hypot(grip.y-y,grip.z-CABIN_LADDER.depth)<.02)&&a.fingers[1].rotation.x>.45;
  });
  const planted=feet.filter(f=>f.low>deck-.002&&f.low<deck+.005);
  const pelvis=root.userData.legs.map(r=>r.leg.getWorldPosition(new Vector3())).reduce((a,b)=>a.add(b).multiplyScalar(.5));
  const {head,arms,legs}=root.userData;
  const joints=[head,...arms.flatMap(a=>[a.elbow,a.hand]),...legs.flatMap(l=>[l.knee,l.boot])].map(n=>n.getWorldPosition(new Vector3()));
  // Lowest point of a boot that straddles the bridge edge, above the deck.
  let edgeClearance=Infinity;
  for(const {outline,low}of feet){
    const inWell=outline.filter(p=>Math.abs(p.x)<.545);
    if(inWell.some(p=>p.z<.94)&&inWell.some(p=>p.z>=.94))edgeClearance=Math.min(edgeClearance,low-deck);
  }
  const hands=transfer.contacts.filter(c=>c.hand).map(c=>({grip:c.grip,
    miss:arms.find(a=>a.side===c.side).hand.getWorldPosition(new Vector3()).distanceTo(root.localToWorld(c.point.clone().add(LADDER_WRIST_OFFSET)))}));
  const eye=head.localToWorld(EYE.clone()),face=new Vector3(0,0,1).applyQuaternion(head.getWorldQuaternion(head.quaternion.clone()));
  const toHands=arms.map(a=>a.hand.getWorldPosition(new Vector3())).reduce((a,b)=>a.add(b).multiplyScalar(.5)).sub(eye).normalize();
  return {penetration,free:!onRung&&!held,planted:planted.length,overhang:planted.length?hullDistance(planted.flatMap(f=>f.outline),pelvis.x,pelvis.z):Infinity,joints,pelvis,
    edgeClearance,hands,facePitch:Math.asin(-face.y)*180/Math.PI,faceToHands:face.angleTo(toHands)*180/Math.PI};
}
const JOINTS=['head','left elbow','left hand','right elbow','right hand','left knee','left boot','right knee','right boot'];
const wellDeckRuns=[];
function wellDeckTransfers(){
  if(wellDeckRuns.length)return wellDeckRuns;
  const root=create();
  // Entries from the top and middle decks (down, and up from the middle), the
  // middle-deck landing, and arrivals climbing up onto the middle and top decks.
  for(const fps of [60,120])for(const [from,to,phase]of [[0,1,'entry'],[1,2,'entry'],[1,0,'entry'],[0,1,'landing'],[1,0,'arrival'],[2,1,'arrival']])for(const yaw of [Math.PI/2,-Math.PI/2]){
    const actor=new CrewMotion({floor:from,x:LADDER_X}),startHeight=positionY(FLOORS[from].y),endHeight=positionY(FLOORS[to].y);
    if(phase!=='entry')actor.y=FLOORS[to].y+Math.sign(FLOORS[from].y-FLOORS[to].y)*.7/.016;
    actor.goTo({floor:to,x:LADDER_X});
    const frames=[],deck=phase==='entry'?startHeight:endHeight;
    for(let i=0;i<fps*20&&actor.climbing;i++){
      const height=positionY(actor.y);
      root.position.set(0,height,crewWalkway(0,from).z);animateMilo(root,{time:0,moving:false,dt:0});
      const sample=applyCabinLadder(root,{height,startHeight,endHeight,startYaw:yaw,endYaw:yaw,startDepth:crewWalkway(0,from).z,endDepth:crewWalkway(0,to).z});
      // Progress on the entry's own clock: a landing runs it backwards.
      // An arrival is judged over the final transfer height, whatever pose provides it.
      const transfer=sample[phase]??(phase==='arrival'&&endHeight-height<=CABIN_LADDER.transfer?{progress:1-(endHeight-height)/CABIN_LADDER.transfer,contacts:sample.contacts}:null);
      if(transfer)frames.push({u:transfer.progress,entryU:phase==='entry'?transfer.progress:1-transfer.progress,...wellDeckFrame(root,deck,transfer)});
      actor.update(1/fps);
    }
    wellDeckRuns.push({label:`${fps} fps ${phase} ${from}->${to}, approach ${Math.sign(yaw)}`,frames});
  }
  return wellDeckRuns;
}
test('well-deck transfers keep the pelvis over the planted soles whenever nothing is held',()=>{
  for(const {label,frames}of wellDeckTransfers()){
    assert.ok(frames.length>100,`${label}: samples the transfer`);
    for(const f of frames){
      if(!f.free)continue;
      assert.ok(f.planted>0,`${label}: something supports Milo at u=${f.u.toFixed(3)}`);
      assert.ok(f.overhang<=.05,`${label}: pelvis ${(f.overhang*1000).toFixed(0)} mm outside the planted soles at u=${f.u.toFixed(3)}`);
    }
  }
});
test('feet crossing the ladder well never pass through a deck slab',()=>{
  for(const {label,frames}of wellDeckTransfers()){
    const worst=frames.reduce((a,f)=>f.penetration>a.penetration?f:a,frames[0]);
    assert.ok(worst.penetration<1e-6,`${label}: a boot enters the deck by ${(worst.penetration*1000).toFixed(0)} mm at u=${worst.u.toFixed(3)}`);
  }
});
test('well-deck transfers stay continuous, with no reaching hand outrunning its arm',()=>{
  for(const {label,frames}of wellDeckTransfers()){
    if(!label.startsWith('120'))continue;
    for(let i=1;i<frames.length;i++)frames[i].joints.forEach((p,j)=>{
      const step=p.distanceTo(frames[i-1].joints[j]);
      assert.ok(step<.05,`${label}: ${JOINTS[j]} moves ${(step*1000).toFixed(0)} mm in one 120 fps frame at u=${frames[i].u.toFixed(3)}`);
    });
  }
});
test('a boot crossing the bridge edge clears it by at least 3 cm until its heel is over the well',()=>{
  for(const {label,frames}of wellDeckTransfers()){
    const worst=frames.reduce((a,f)=>f.edgeClearance<a.edgeClearance?f:a,frames[0]);
    assert.ok(frames.some(f=>f.edgeClearance<Infinity),`${label}: a boot crosses the edge`);
    assert.ok(worst.edgeClearance>=.03,`${label}: only ${(worst.edgeClearance*1000).toFixed(1)} mm above the deck over the edge at u=${worst.u.toFixed(3)}`);
  }
});
test('both hands close on the rung at u=.38, not before',()=>{
  for(const {label,frames}of wellDeckTransfers())for(const f of frames){
    if(f.entryU<.35)for(const h of f.hands)assert.ok(h.grip<.9&&h.miss>.002,`${label}: a hand grips early at u=${f.entryU.toFixed(3)}`);
    if(f.entryU>=.38&&f.entryU<=.78)for(const h of f.hands)assert.ok(h.grip>.999&&h.miss<.001,`${label}: a hand is off the rung at u=${f.entryU.toFixed(3)} (${(h.miss*1000).toFixed(1)} mm)`);
  }
});
test('the head looks toward the hands while reaching for and gripping the rung',()=>{
  for(const {label,frames}of wellDeckTransfers())for(const f of frames){
    if(f.entryU<.30||f.entryU>.45)continue;
    assert.ok(f.facePitch<=35,`${label}: face ${f.facePitch.toFixed(0)}° below horizontal at u=${f.entryU.toFixed(3)}`);
    assert.ok(f.faceToHands<=45,`${label}: face ${f.faceToHands.toFixed(0)}° away from the hands at u=${f.entryU.toFixed(3)}`);
  }
});
// Mounts, landings and arrivals on every deck, approaching or leaving either way.
const bootYaw=boot=>{const f=new Vector3(0,0,1).applyQuaternion(boot.getWorldQuaternion(boot.quaternion.clone()));return Math.atan2(f.x,f.z);};
const wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));
const transferRuns=[];
function ladderTransfers(){
  if(transferRuns.length)return transferRuns;
  const root=create();
  for(const [from,to,phase]of [[2,1,'entry'],[0,1,'entry'],[1,2,'entry'],[1,0,'entry'],[0,1,'landing'],[1,2,'landing'],[1,0,'arrival'],[2,1,'arrival']])for(const yaw of [Math.PI/2,-Math.PI/2]){
    const actor=new CrewMotion({floor:from,x:LADDER_X}),startHeight=positionY(FLOORS[from].y),endHeight=positionY(FLOORS[to].y);
    if(phase!=='entry')actor.y=FLOORS[to].y+Math.sign(FLOORS[from].y-FLOORS[to].y)*.7/.016;
    actor.goTo({floor:to,x:LADDER_X});
    const frames=[],deck=phase==='entry'?startHeight:endHeight;
    for(let i=0;i<1200&&actor.climbing;i++){
      const height=positionY(actor.y);
      root.position.set(0,height,crewWalkway(0,from).z);animateMilo(root,{time:0,moving:false,dt:0});
      const sample=applyCabinLadder(root,{height,startHeight,endHeight,startYaw:yaw,endYaw:yaw,startDepth:crewWalkway(0,from).z,endDepth:crewWalkway(0,to).z});
      root.updateMatrixWorld(true);
      if(sample[phase])frames.push({u:sample[phase].progress,entryU:phase==='entry'?sample[phase].progress:1-sample[phase].progress,feet:root.userData.legs.map(rig=>({side:rig.side,yaw:bootYaw(rig.boot),ankle:rig.boot.getWorldPosition(new Vector3()),
        clearance:Math.min(...BOOT_OUTLINE.map(([x,z])=>rig.boot.localToWorld(new Vector3(x*rig.side,-.107,z)).y))-deck-.003}))});
      actor.update(1/60);
    }
    // The pose on the deck at the end of the climb.
    root.position.set(0,endHeight,crewWalkway(0,to).z);animateMilo(root,{time:0,moving:false,dt:0});
    applyCabinLadder(root,{height:endHeight,startHeight,endHeight,startYaw:yaw,endYaw:yaw,startDepth:crewWalkway(0,from).z,endDepth:crewWalkway(0,to).z});root.updateMatrixWorld(true);
    transferRuns.push({label:`${phase} ${from}->${to}, heading ${Math.sign(yaw)}`,phase,yaw,frames,endYaw:root.rotation.y,endFeet:root.userData.legs.map(rig=>bootYaw(rig.boot))});
  }
  return transferRuns;
}
test('boots turn smoothly and never spin a full turn while stepping between deck and rungs',()=>{
  for(const {label,frames}of ladderTransfers()){
    assert.ok(frames.length>100,`${label}: samples the transfer`);
    for(const side of [-1,1]){
      let total=0;
      for(let i=1;i<frames.length;i++){
        const step=Math.abs(wrap(frames[i].feet.find(f=>f.side===side).yaw-frames[i-1].feet.find(f=>f.side===side).yaw));
        // Outside the stepping turn (entry clock u<.25) a boot only changes rung or deck.
        if(frames[i].entryU>=.25&&frames[i-1].entryU>=.25)assert.ok(step<8*Math.PI/180,`${label}: boot ${side} yaws ${(step*180/Math.PI).toFixed(1)}° in one 60 fps frame at u=${frames[i].u.toFixed(3)}`);
        total+=step;
      }
      assert.ok(total<=Math.PI*1.1,`${label}: boot ${side} turns ${(total*180/Math.PI).toFixed(0)}° in total`);
    }
  }
});
test('arriving on a well deck ends facing along the aisle after a planted stepping turn',()=>{
  for(const {label,phase,yaw,frames,endYaw,endFeet}of ladderTransfers()){
    if(phase!=='arrival')continue;
    assert.ok(Math.abs(wrap(endYaw-yaw))<1e-6,`${label}: faces the aisle heading`);
    endFeet.forEach(f=>assert.ok(Math.abs(wrap(f-yaw))<.02,`${label}: both boots point along the aisle`));
    const turn=frames.filter(f=>f.u>=.75),lifted=new Set();let drift=0;
    for(let i=1;i<turn.length;i++)for(const foot of turn[i].feet){
      const prior=turn[i-1].feet.find(f=>f.side===foot.side);
      if(foot.clearance>.008)lifted.add(foot.side);
      if(prior.clearance<.0005&&foot.clearance<.0005)drift+=Math.hypot(foot.ankle.x-prior.ankle.x,foot.ankle.z-prior.ankle.z);
    }
    assert.equal(lifted.size,2,`${label}: both feet step through the final turn`);
    assert.ok(drift<.006,`${label}: loaded boots slide ${(drift*1000).toFixed(1)} mm during the final turn`);
  }
});
