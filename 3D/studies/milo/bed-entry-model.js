import {MathUtils,Quaternion,Vector3} from 'three';
import {animateMilo} from '../../src/obs/characters.js';
import {BunkVisit} from '../../src/obs/bunk-visit.js';
import {BUNK_BED,BUNK_TRAY} from '../../src/obs/recline.js';
import {applySleepingHands} from '../../src/obs/bunk-pose.js';
import {MED_BED,MED_TRANSFER,medicalTransferPose,medicalDuration} from '../../src/obs/medical.js';

const smooth=(t,a,b)=>MathUtils.smootherstep(t,a,b),lerp=MathUtils.lerp;
const X=new Vector3(1,0,0),Y=new Vector3(0,1,0);
export const ENTRY_STUDY={bunk:{start:6.95,end:14.05},medical:{start:5.05,end:10.05}};
export const SEQUENTIAL_SECONDS=5.4;
const extra=SEQUENTIAL_SECONDS-3;

// This is a study-only timeline. The production phase lengths stay unchanged.
export function sampleBedEntry(kind,time,sequential=true){
  const config=ENTRY_STUDY[kind],age=time-config.start;
  const sourceTime=!sequential||age<=0?time:age<SEQUENTIAL_SECONDS?config.start+age*3/SEQUENTIAL_SECONDS:time-extra;
  let visit=null,pose;
  if(kind==='bunk'){visit=new BunkVisit();visit.startYaw=0;visit.update(sourceTime);pose=visit.pose;}
  else pose=medicalTransferPose(sourceTime);
  const u=MathUtils.clamp(age/SEQUENTIAL_SECONDS,0,1);
  const active=sequential&&age>=0&&age<=SEQUENTIAL_SECONDS;
  const stages={approaching:'ベッドに近づく',opening:'カバーを開ける',extending:'トレーを引き出す',sitting:'腰を下ろす',settled:'座面で支える',elevating:'治療台を上げる',raised:'座面で支える',lowering:'両足を持ち上げる',entering:'ベッドを戻す',closing:'カバーを閉じる',sleeping:'横になる',deploying:'診察位置へ',examining:'診察位置'};
  const stage=active?(u<.22?'左足を持ち上げる':u<.42?'左足を先に乗せる':u<.66?'右足を持ち上げる':u<.84?'右足を乗せる':'上体をゆっくり倒す'):stages[pose.phase]??pose.phase;
  return {kind,time,sourceTime,visit,pose,u,active,stage,duration:config.end+(sequential?extra:0)+.6};
}

function legIK(rig,target,pole){
  const {leg,knee,boot}=rig,offset=target.clone().sub(leg.position),distance=offset.length(),axis=offset.clone().normalize();
  const a=knee.position.length(),b=boot.position.length(),reach=MathUtils.clamp(distance,Math.abs(a-b)+1e-6,a+b-1e-6);
  const along=(a*a+reach*reach-b*b)/(2*reach),height=Math.sqrt(Math.max(0,a*a-along*along));
  const bend=pole.clone().addScaledVector(axis,-pole.dot(axis)).normalize();
  const joint=axis.clone().multiplyScalar(along).addScaledVector(bend,height);
  leg.quaternion.setFromUnitVectors(knee.position.clone().normalize(),joint.clone().normalize());
  const lower=new Quaternion().setFromUnitVectors(boot.position.clone().normalize(),offset.sub(joint).normalize());
  knee.quaternion.copy(leg.quaternion).invert().multiply(lower);
  return Math.max(0,distance-(a+b));
}

export function applyBedEntry(root,sample){
  const {kind,sourceTime,visit,pose,u,active}=sample;
  root.userData.medicalStartYaw=0;
  animateMilo(root,{moving:false,facing:1,action:kind==='bunk'?'bunk':'medical',time:0,actionTime:sourceTime,actionDuration:medicalDuration(),bunkVisit:visit});
  if(!active)return;
  const {body,head,arms,legs}=root.userData;
  const bed=kind==='bunk'?BUNK_BED:MED_BED,transfer=kind==='bunk'?BUNK_TRAY:MED_TRANSFER;
  const elevation=kind==='medical'?pose.elevation:0,top=bed.top+elevation;
  const bedDepth=bed.depth+(kind==='bunk'?BUNK_TRAY.travel:0);
  const lay=smooth(u,.43,1),angle=-Math.PI/2*lay,c=Math.cos(angle),s=Math.sin(angle);
  const turn=.42*smooth(u,.08,.43)+.58*smooth(u,.46,.86);
  root.rotation.set(0,Math.PI/2*turn,0);
  root.position.z=lerp(transfer.seatDepth,bedDepth,smooth(u,.60,.88));
  body.rotation.set(angle,0,0);
  body.position.set(0,top+Math.hypot(.134*c,.119*s)-c*.988,-s*.988);
  head.rotation.set(-.05*(1-lay),0,0);
  for(const {arm,elbow,hand,side}of arms){
    arm.rotation.set(lerp(.08,-.10,lay),0,side*.07*(1-lay));
    elbow.rotation.set(lerp(-.12,-.18,lay),0,0);hand.rotation.set(0,0,0);
    if(kind==='medical'){
      const rest=smooth(lay,.25,1);
      arm.rotation.x=lerp(arm.rotation.x,.07,rest);arm.rotation.z=lerp(arm.rotation.z,side*.12,rest);
      elbow.rotation.x=lerp(elbow.rotation.x,-.04,rest);hand.rotation.x=lerp(0,-.03,rest);
    }
  }
  if(kind==='bunk')applySleepingHands(root,lay);
  root.updateMatrixWorld(true);
  const bodyRotation=body.getWorldQuaternion(new Quaternion());
  const kneePole=Y.clone().applyQuaternion(bodyRotation.clone().invert());
  const finalFoot=new Quaternion().setFromAxisAngle(Y,Math.PI/2).multiply(new Quaternion().setFromAxisAngle(X,-Math.PI/2));
  let reachError=0;
  for(const rig of legs){
    // Anatomical left is +X in this rig; legacy L/R bone labels are reversed.
    const left=rig.side===1;
    const lift=smooth(u,left?0:.42,left?.28:.67);
    const swing=smooth(u,left?.20:.63,left?.43:.84);
    const lateral=smooth(u,left?.07:.46,left?.30:.73);
    const extend=smooth(u,left?.45:.82,1);
    const settle=smooth(u,left?.32:.78,left?.43:.91);
    const target=new Vector3(
      lerp(lerp(rig.side*.100,.64,lateral),.878,extend),
      lerp(lerp(.110+elevation,top+.185,lift),top+.132,settle),
      lerp(transfer.standingDepth+.013,bedDepth-rig.side*.100,swing)
    );
    // Keep the following foot stationary until its own lift starts, even as the pelvis turns.
    target.x+=root.position.x;target.y+=root.position.y;
    body.worldToLocal(target);
    reachError=Math.max(reachError,legIK(rig,target,kneePole));
    const foot=new Quaternion().slerp(finalFoot,smooth(u,left?.16:.54,left?.47:.89));
    rig.boot.quaternion.copy(bodyRotation).multiply(rig.leg.quaternion).multiply(rig.knee.quaternion).invert().multiply(foot);
  }
  root.userData.bedEntryReachError=reachError;
  root.userData.updateWristTwists?.();root.updateMatrixWorld(true);
}
