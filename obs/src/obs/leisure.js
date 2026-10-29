import * as THREE from 'three';
import {ball} from './materials.js';
import {placeHand} from './dining.js';
import {applyTabletHands} from './tablet-pose.js';
import {applyLoungeSpine} from './milo-spine.js';
import {MILO_NECK_PROTRACTION,setMiloNeckProtraction} from './milo-neck.js';
import {solveHingeArm} from './arm-ik.js';
import {setMealHandFit} from './cup-hand-fit.js';
import {createCatTeaser} from './cat-teaser.js';
import {createPadTerminal} from './pad-terminal.js';

export const LEISURE_LABELS={tablet:['パッド端末を読んでいる','Reading on a tablet'],music:['音楽を聴いている','Listening to music'],cat:['猫と遊んでいる','Playing with the cat']};

export const MUSIC_BPM=95;
const musicBeat=time=>.5-.5*Math.cos((time-4.25)*MUSIC_BPM/60*Math.PI*2);
export function applyMusicRhythm(root,time,weight=1){
  const push=musicBeat(time)*weight,head=root.userData.head;
  // Advance the skull while the neck surface stays anchored inside the collar.
  setMiloNeckProtraction(root,push);
  head.position.z+=MILO_NECK_PROTRACTION*push;
}

export function applyMusicGuard(root,time,weight=1){
  if(weight<=0)return;
  const {body,arms}=root.userData,alternating=Math.sin((time-4.25)*MUSIC_BPM/60*Math.PI);
  root.updateWorldMatrix(true,true);
  const inverseBody=body.getWorldQuaternion(new THREE.Quaternion()).invert();
  for(const rig of arms){
    // One complete pulse per beat, then pass it to the other hand.
    const beat=Math.max(0,-rig.side*alternating)**2;
    const rest=body.worldToLocal(rig.hand.getWorldPosition(new THREE.Vector3()));
    const target=new THREE.Vector3(rig.side*.17,1.31+.024*beat+(rig.side===1?.012:0),.27+.025*beat);
    const pole=new THREE.Vector3(rig.side*.32,-.8,.15);
    const guard=solveHingeArm(rig,target,pole);
    // Point the knuckles along the forearm and keep the palms facing inward.
    const rotation=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,-1,0),guard.forearm.clone().normalize())
      .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),rig.side*Math.PI/2));
    const handRotation=inverseBody.clone().multiply(rig.hand.getWorldQuaternion(new THREE.Quaternion())).slerp(rotation,weight);
    const pose=solveHingeArm(rig,rest.lerp(target,weight),pole);
    rig.arm.quaternion.copy(pose.upper);rig.elbow.quaternion.copy(pose.lower);
    rig.hand.quaternion.copy(pose.upper).multiply(pose.lower).invert().multiply(handRotation);
  }
}

export function closeMusicFist(rig,weight){
  for(const finger of rig.fingers){
    finger.rotation.x=THREE.MathUtils.lerp(finger.rotation.x,.42,weight);
    finger.userData.links[0].rotation.x=THREE.MathUtils.lerp(finger.userData.links[0].rotation.x,.65,weight);
    finger.userData.links[1].rotation.x=THREE.MathUtils.lerp(finger.userData.links[1].rotation.x,.30,weight);
  }
  rig.thumb.position.lerp(new THREE.Vector3(-rig.side*.031,-.051,.019),weight);
  rig.thumb.quaternion.slerp(new THREE.Quaternion().setFromEuler(new THREE.Euler(.32,rig.side*.15,rig.side*.78)),weight);
  rig.thumb.userData.ip.rotation.x=THREE.MathUtils.lerp(rig.thumb.userData.ip.rotation.x,.32,weight);
}

export function applyDeskHands(root,top=.80,reach=.47){
  const {body,arms}=root.userData;
  const rotation=new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI/2,0,0));
  for(const rig of arms){
    placeHand(rig,new THREE.Vector3(rig.side*.22,top+.044-body.position.y,reach),rotation,0);
    for(const finger of rig.fingers)finger.rotation.x=-.08;
    rig.thumb.rotation.set(0,0,0);
  }
}

export function createLeisureProps(body,m){
  const tablet=createPadTerminal(),phones=new THREE.Group(),toy=new THREE.Group();
  tablet.name='Reading tablet';phones.name='Personal headphones';toy.name='Cat teaser';
  for(const prop of [tablet,phones,toy]){body.add(prop);prop.visible=false;}
  const curve=new THREE.EllipseCurve(0,0,.112,.142,0,Math.PI,false,0);
  const path=new THREE.CatmullRomCurve3(curve.getPoints(36).map(p=>new THREE.Vector3(p.x,p.y,0)));
  phones.add(new THREE.Mesh(new THREE.TubeGeometry(path,36,.009,8,false),m.dark));
  for(const side of [-1,1]){
    ball(phones,m.rubber,side*.111,-.012,0,.028,.060,.048).name=`Headphone cushion ${side}`;
    ball(phones,m.metal,side*.133,-.012,0,.012,.052,.042).name=`Headphone shell ${side}`;
  }
  createCatTeaser(toy,m);
  return{tablet,phones,toy};
}

export function applyLeisurePose(root,mode,time,duration=36,catReady=false){
  const {leisure,head,arms}=root.userData,{tablet,phones,toy}=leisure;
  const ease=THREE.MathUtils.smoothstep(Math.min(time,duration-time),0,1.5);
  if(mode==='tablet'){
    applyLoungeSpine(root,.015,.20,.14*ease);
    tablet.visible=true;tablet.position.set(0,1.44,.37);tablet.rotation.set(-1.23,0,0);
    head.rotation.set(.14*ease,.035*Math.sin(time*.6),0);
    applyTabletHands(root);
  }else if(mode==='music'){
    head.rotation.set(0,0,0);
    const listening=THREE.MathUtils.smoothstep(time,3.15,4.25);
    applyMusicRhythm(root,time,listening);
    phones.visible=true;phones.position.copy(head.position).add(new THREE.Vector3(0,.088,.002+(head.userData.faceForward??0)).applyQuaternion(head.quaternion));phones.quaternion.copy(head.quaternion);
    applyDeskHands(root);applyMusicGuard(root,time,listening);setMealHandFit(root,listening);
    for(const rig of arms)closeMusicFist(rig,listening);
  }else if(mode==='cat'){
    const swing=Math.sin(time*2.1)*(catReady?.07:.025)*ease;
    toy.visible=true;toy.position.set(-.36,1.23,.24+swing);
    toy.quaternion.setFromUnitVectors(new THREE.Vector3(1,0,0),new THREE.Vector3(-.29,.26,-.16).normalize());
    toy.rotateZ(Math.sin(time*1.4)*.10*ease);
    placeHand(arms[0],toy.position.clone(),new THREE.Quaternion().setFromEuler(new THREE.Euler(0,0,-.4)),.9);
    arms[1].arm.rotation.x=-.25;arms[1].elbow.rotation.x=-.65;
    head.rotation.set(.18,-.4,0);
  }
}
