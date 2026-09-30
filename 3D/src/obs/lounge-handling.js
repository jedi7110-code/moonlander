import {Vector3,Quaternion,Euler,MathUtils} from 'three';
import {solveHingeArm} from './arm-ik.js';
import {applyDeskHands,applyMusicRhythm,applyMusicGuard,closeMusicFist} from './leisure.js';
import {applyLoungeSpine} from './milo-spine.js';
import {setMealHandFit,setTeaserHandFit} from './cup-hand-fit.js';
import {teaserHandCenter,applyTeaserGrip,applyTeaserGaze} from './cat-teaser-pose.js';
import {TABLET_GRIP,tabletGripContact} from './tablet-pose.js';

export const LOUNGE_STOW_SECONDS=4;
export const LOUNGE_PROP_KEYS={tablet:'tablet',music:'phones',cat:'toy'};
const smooth=(t,a,b)=>MathUtils.smoothstep(t,a,b);

export function loungeHandlingPhase(time,mode,stow=null){
  const lift=smooth(time,1.15,3.1),reach=smooth(time,0,1.05)*(mode==='music'?1-smooth(time,3.15,4.25):1),grip=mode==='music'?smooth(time,.5,.95):smooth(time,.75,1.15);
  if(!stow)return{lift,reach,grip};
  const age=stow.age,graspTime=mode==='music'?.95:.6,returning=smooth(age,graspTime+.05,2.75);
  return{lift:lift*(1-returning),reach:MathUtils.lerp(reach,1,smooth(age,0,graspTime))*(1-smooth(age,2.85,LOUNGE_STOW_SECONDS)),grip:grip*(1-smooth(age,2.75,3.05))};
}

export function loungePropHome(prop){
  if(!prop.userData.loungeHome){
    prop.updateWorldMatrix(true,false);
    prop.userData.loungeHome={position:prop.getWorldPosition(new Vector3()),quaternion:prop.getWorldQuaternion(new Quaternion())};
  }
  return prop.userData.loungeHome;
}

export function applyLoungeHandling(root,mode,time,{docks,stow=null,entering=false}={}){
  const key=LOUNGE_PROP_KEYS[mode];if(!key||!docks)return;
  const {body,head,arms,leisure}=root.userData,prop=leisure[key];
  const home=loungePropHome(docks[key]),phase=loungeHandlingPhase(entering?0:time,mode,stow);
  const listening=mode==='music'?phase.lift*(1-phase.reach):0,musicTime=time+(stow?.age??0);
  // Use the fitted fingers on both earcups, fading back to the resting mesh.
  if(mode==='music')setMealHandFit(root,phase.reach+listening);
  if(mode==='cat')setTeaserHandFit(root,phase.reach);
  const usePosition=prop.position.clone(),useRotation=prop.quaternion.clone();
  const tabletGrips=mode==='tablet'?arms.map(r=>useRotation.clone().invert().multiply(r.arm.quaternion).multiply(r.elbow.quaternion).multiply(r.hand.quaternion)):null;
  // Capture the seated hands before leaning. Their paths stay above the table;
  // blending separate joint rotations can otherwise swing through the torso.
  body.position.x=0;body.position.z=0;
  for(const rig of arms)rig.arm.position.set(rig.side*.207,1.488,0);
  applyDeskHands(root);
  if(mode==='music')applyMusicGuard(root,musicTime,phase.lift);
  root.updateWorldMatrix(true,true);
  const resting=arms.map(r=>({wrist:r.hand.getWorldPosition(new Vector3()),elbow:r.elbow.getWorldPosition(new Vector3()),rotation:r.hand.getWorldQuaternion(new Quaternion())}));
  const dockWeight=phase.reach*(1-phase.lift),reading=mode==='tablet'?phase.lift:0;
  // Lean from the cushion to the real table location, including side items.
  root.updateWorldMatrix(true,true);
  const localHome=root.worldToLocal(home.position.clone());
  body.position.x=MathUtils.clamp(localHome.x*.6,-.24,.24)*dockWeight;body.position.z=(mode==='cat'?.28:mode==='music'?.23:.18)*dockWeight;
  if(mode==='cat')head.rotation.y=-.4*phase.reach;
  applyLoungeSpine(root,(mode==='cat'?.35:.12)*dockWeight+.015*reading,(mode==='cat'?1.05:.85)*dockWeight+.20*reading,MathUtils.lerp(mode==='tablet'?.14:0,.40,dockWeight));
  if(mode==='music')applyMusicRhythm(root,musicTime,listening);
  body.updateWorldMatrix(true,true);
  const dockPosition=body.worldToLocal(home.position.clone()),dockRotation=body.getWorldQuaternion(new Quaternion()).invert().multiply(home.quaternion);
  if(mode==='music'){
    usePosition.copy(head.position).add(new Vector3(0,.088,.002+(head.userData.faceForward??0)).applyQuaternion(head.quaternion));
    useRotation.copy(head.quaternion);
  }
  prop.position.lerpVectors(dockPosition,usePosition,phase.lift);
  prop.position.y+=Math.sin(Math.PI*phase.lift)*(mode==='music'?.30:.13);
  prop.quaternion.slerpQuaternions(dockRotation,useRotation,phase.lift);
  prop.visible=!entering;
  const inverseBody=body.getWorldQuaternion(new Quaternion()).invert();
  arms.forEach((rig,i)=>{
    const active=mode!=='cat'||i===0,reach=active?phase.reach:0,grip=active?phase.grip*reach:0;
    const rest=resting[i],restWrist=body.worldToLocal(rest.wrist),restElbow=body.worldToLocal(rest.elbow),restRotation=inverseBody.clone().multiply(rest.rotation);
    const gripRotation=mode==='tablet'?tabletGrips[i]:mode==='cat'?new Quaternion().setFromEuler(new Euler(-Math.PI/2-.8*phase.lift,0,0)):
      new Quaternion().setFromAxisAngle(new Vector3(1,0,0),-phase.lift).multiply(new Quaternion().setFromEuler(new Euler(0,rig.side*Math.PI/2,Math.PI)));
    const rotation=prop.quaternion.clone().multiply(gripRotation);
    const contact=mode==='tablet'?tabletGripContact(rig.side):mode==='cat'?new Vector3(.0425,.012,0):new Vector3(rig.side*.159,-.012,0);
    const target=contact.applyQuaternion(prop.quaternion).add(prop.position);
    if(mode!=='tablet')target.sub((mode==='cat'?teaserHandCenter(rig,phase.lift):new Vector3(0,-.078,-.015)).multiply(rig.hand.scale).applyQuaternion(rotation));
    const wrist=restWrist.clone().lerp(target,reach);wrist.y+=Math.sin(Math.PI*reach)*.08;
    const handRotation=restRotation.slerp(rotation,reach);
    // Aim the elbow behind the hand along the forearm. The approved rearward
    // hinge and its real segment lengths determine the bend, not a wrist fold.
    const alignedElbow=target.clone().add(new Vector3(0,rig.hand.position.length(),0).applyQuaternion(rotation));
    // At head height an inward pole crosses the arms. Keep the headphone
    // elbows forward and outside, then restore the seated pole on release.
    const pole=mode==='music'?restElbow.sub(rig.arm.position).lerp(new Vector3(rig.side*.38,-.65,.9),reach):restElbow.lerp(alignedElbow,reach).sub(rig.arm.position);
    const pose=solveHingeArm(rig,wrist,pole);
    rig.arm.quaternion.copy(pose.upper);rig.elbow.quaternion.copy(pose.lower);
    const fingers=new Vector3(0,-1,0).applyQuaternion(handRotation),forearm=pose.forearm.clone().normalize();
    const bend=Math.acos(MathUtils.clamp(fingers.dot(forearm),-1,1));
    // Before contact the wrist can stay relaxed; settle into the exact grip
    // only at the item, without changing the approved fingers on its edges.
    if(bend>Math.PI/3.6){
      const ease=(1-Math.PI/3.6/bend)*(1-smooth(reach,.85,1));
      handRotation.premultiply(new Quaternion().slerp(new Quaternion().setFromUnitVectors(fingers,forearm),ease));
    }
    rig.hand.quaternion.copy(pose.upper).multiply(pose.lower).invert().multiply(handRotation);
    for(const finger of rig.fingers){
      finger.rotation.set(MathUtils.lerp(-.08,mode==='tablet'?.15:mode==='music'?.10:.45,grip),0,0);
      finger.userData.links[0].rotation.set((mode==='tablet'?.15:mode==='music'?.20:.65)*grip,0,0);
      finger.userData.links[1].rotation.set((mode==='tablet'?.08:mode==='music'?.10:.3)*grip,0,0);
    }
    rig.thumb.position.set(-rig.side*MathUtils.lerp(.029,mode==='music'?.050+.008*phase.lift:.033,mode==='tablet'||mode==='music'?grip:0),-.051,MathUtils.lerp(.025,TABLET_GRIP.thumbZ,mode==='tablet'?grip:0));
    rig.thumb.rotation.set((mode==='tablet'?.35:.25)*grip,mode==='tablet'?rig.side*.15*grip:0,rig.side*(mode==='tablet'?-.15:.3)*grip);
    rig.thumb.userData.ip.rotation.set(mode==='tablet'?.1*grip:0,0,0);
    if(mode==='music')closeMusicFist(rig,listening);
    if(mode==='cat'&&active)applyTeaserGrip(rig,grip,phase.lift);
  });
  if(mode==='cat')applyTeaserGaze(root,prop,phase);
  return phase;
}
