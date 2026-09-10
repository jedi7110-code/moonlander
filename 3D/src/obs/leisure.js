import * as THREE from 'three';
import {box,ball,rod} from './materials.js';
import {placeHand} from './dining.js';

export const LEISURE_LABELS={tablet:['パッド端末を読んでいる','Reading on a tablet'],music:['音楽を聴いている','Listening to music'],cat:['猫と遊んでいる','Playing with the cat']};

export function createLeisureProps(body,m){
  const tablet=new THREE.Group(),phones=new THREE.Group(),toy=new THREE.Group();
  tablet.name='Reading tablet';phones.name='Personal headphones';toy.name='Cat teaser';
  for(const prop of [tablet,phones,toy]){body.add(prop);prop.visible=false;}
  box(tablet,m.dark,0,0,0,.23,.016,.30,.008);
  const display=new THREE.MeshStandardMaterial({color:0xadc5bd,roughness:.5,emissive:0x78988e,emissiveIntensity:.15});
  box(tablet,display,0,.009,-.002,.207,.002,.265,.003);
  const lines=new THREE.Group();tablet.add(lines);
  for(let i=0;i<16;i++)box(lines,m.dark,0,.011,-.11+i*.014,.164-(i%5)*.007,.0008,.0015,.0001);
  ball(tablet,m.metal,0,.010,.141,.007,.002,.004);
  const curve=new THREE.EllipseCurve(0,0,.112,.142,0,Math.PI,false,0);
  const path=new THREE.CatmullRomCurve3(curve.getPoints(36).map(p=>new THREE.Vector3(p.x,p.y,0)));
  phones.add(new THREE.Mesh(new THREE.TubeGeometry(path,36,.009,8,false),m.dark));
  for(const side of [-1,1]){
    ball(phones,m.rubber,side*.111,-.012,0,.024,.047,.037);
    ball(phones,m.metal,side*.131,-.012,0,.008,.034,.028);
  }
  rod(toy,m.olive,[0,0,0],[-.29,.26,-.16],.006);
  rod(toy,m.dark,[-.29,.26,-.16],[-.31,-.07,-.16],.0015);
  ball(toy,m.red,-.31,-.08,-.16,.018,.032,.018);
  return{tablet,phones,toy,lines};
}

export function applyLeisurePose(root,mode,time,duration=36,catReady=false){
  const {leisure,head,arms}=root.userData,{tablet,phones,toy,lines}=leisure;
  const ease=THREE.MathUtils.smoothstep(Math.min(time,duration-time),0,1.5);
  if(mode==='tablet'){
    tablet.visible=true;tablet.position.set(0,1.08+.24*ease,.29);tablet.rotation.x=-.35-.50*ease;
    lines.position.z=-.003*(time%8);
    head.rotation.set(.26*ease,.035*Math.sin(time*.6),0);
    for(const rig of arms)placeHand(rig,new THREE.Vector3(rig.side*.124,tablet.position.y-.015,.30),new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI/2,0,rig.side*.3)),.6);
  }else if(mode==='music'){
    head.rotation.set(.035*Math.sin(time*2.4),.03*Math.sin(time*.6),.025*Math.sin(time*1.2));
    phones.visible=true;phones.position.copy(head.position).add(new THREE.Vector3(0,.094,-.008).applyQuaternion(head.quaternion));phones.quaternion.copy(head.quaternion);
    for(const rig of arms){rig.arm.rotation.x=-.24;rig.elbow.rotation.x=-.64;rig.hand.rotation.y=rig.side*Math.PI/2;}
  }else if(mode==='cat'){
    const swing=Math.sin(time*2.1)*(catReady?.07:.025)*ease;
    toy.visible=true;toy.position.set(-.36,1.23,.24+swing);toy.rotation.z=Math.sin(time*1.4)*.10*ease;
    placeHand(arms[0],toy.position.clone(),new THREE.Quaternion().setFromEuler(new THREE.Euler(0,0,-.4)),.9);
    arms[1].arm.rotation.x=-.25;arms[1].elbow.rotation.x=-.65;
    head.rotation.set(.18,-.4,0);
  }
}
