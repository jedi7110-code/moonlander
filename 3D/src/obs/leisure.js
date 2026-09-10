import * as THREE from 'three';
import {box,ball,rod} from './materials.js';
import {placeHand} from './dining.js';

export const LEISURE_LABELS={book:['ラウンジで読書中','Reading in the lounge'],music:['音楽を聴いている','Listening to music'],cat:['猫と遊んでいる','Playing with the cat']};

export function createLeisureProps(body,m){
  const book=new THREE.Group(),phones=new THREE.Group(),toy=new THREE.Group();
  book.name='Open paperback';phones.name='Personal headphones';toy.name='Cat teaser';
  for(const prop of [book,phones,toy]){body.add(prop);prop.visible=false;}
  for(const side of [-1,1]){
    const half=new THREE.Group();half.rotation.z=side*.13;book.add(half);
    box(half,m.olive,side*.074,0,0,.148,.012,.20,.003);
    box(half,m.white,side*.071,.014,0,.139,.018,.188,.002);
    for(let i=0;i<12;i++)box(half,m.dark,side*.071,.024,-.078+i*.013,.105-(i%4)*.006,.0008,.001,.0001);
  }
  const page=new THREE.Group();book.add(page);box(page,m.white,.068,.027,0,.136,.002,.185,.001);
  const curve=new THREE.EllipseCurve(0,0,.112,.142,0,Math.PI,false,0);
  const path=new THREE.CatmullRomCurve3(curve.getPoints(36).map(p=>new THREE.Vector3(p.x,p.y,0)));
  phones.add(new THREE.Mesh(new THREE.TubeGeometry(path,36,.009,8,false),m.dark));
  for(const side of [-1,1]){
    ball(phones,m.rubber,side*.111,-.012,0,.024,.047,.037);
    ball(phones,m.metal,side*.131,-.012,0,.008,.034,.028);
  }
  rod(toy,m.olive,[0,0,0],[-.29,.26,0],.006);
  rod(toy,m.dark,[-.29,.26,0],[-.31,.04,0],.0015);
  ball(toy,m.orange, -.31,.03,0,.018,.032,.018);
  return{book,phones,toy,page};
}

export function applyLeisurePose(root,mode,time,duration=36,catReady=false){
  const {leisure,head,arms}=root.userData,{book,phones,toy,page}=leisure;
  const ease=THREE.MathUtils.smoothstep(Math.min(time,duration-time),0,1.5);
  if(mode==='book'){
    book.visible=true;book.position.set(0,1.02+.09*ease,.29);book.rotation.x=.23;
    const turn=(time%9)/9;page.rotation.z=turn>.78?(turn-.78)/.22*Math.PI:0;
    head.rotation.set(.26*ease,.035*Math.sin(time*.6),0);
    for(const rig of arms)placeHand(rig,new THREE.Vector3(rig.side*.148,1.10,.30),new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI/2,0,rig.side*.3)),.4);
  }else if(mode==='music'){
    phones.visible=true;phones.position.copy(head.position).add(new THREE.Vector3(0,.094,-.008));phones.quaternion.copy(head.quaternion);
    head.rotation.set(.035*Math.sin(time*2.4),.03*Math.sin(time*.6),.025*Math.sin(time*1.2));
    for(const rig of arms){rig.arm.rotation.x=-.24;rig.elbow.rotation.x=-.64;rig.hand.rotation.y=rig.side*Math.PI/2;}
  }else if(mode==='cat'){
    const swing=Math.sin(time*2.1)*(catReady?.07:.025)*ease;
    toy.visible=true;toy.position.set(-.31,1.23,.08+swing);toy.rotation.z=Math.sin(time*1.4)*.10*ease;
    placeHand(arms[0],toy.position.clone(),new THREE.Quaternion().setFromEuler(new THREE.Euler(0,0,-.4)),.9);
    arms[1].arm.rotation.x=-.25;arms[1].elbow.rotation.x=-.65;
    head.rotation.set(.18,-.4,0);
  }
}
