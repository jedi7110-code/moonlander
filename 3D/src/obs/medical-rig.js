import * as THREE from 'three';
import {box,ball,cylinder,pipe,rod} from './materials.js';

const up=new THREE.Vector3(0,1,0),down=new THREE.Vector3(0,-1,0);
const samples=25,linkLength=.98;

function boom(parent,m){
  const root=new THREE.Group();parent.add(root);
  cylinder(root,m.dark,0,.5,0,.047,1,.047,16);
  box(root,m.enamel,0,.38,0,.125,.54,.13,.024);
  box(root,m.teal,0,.40,.067,.07,.19,.009,.006);
  for(const yy of [.15,.63])cylinder(root,m.metal,0,yy,0,.067,.055,.067,16);
  rod(root,m.rubber,[.076,.09,0],[.076,.83,0],.016);
  return root;
}

function arm(parent,m,index){
  const root=new THREE.Group();root.name=index?'Ceiling diagnostic arm / probe':'Ceiling diagnostic arm / scanner';parent.add(root);
  const base=new THREE.Vector3(index?.85:-.65,2.63,index?.12:-.30),side=index?1:-1;
  cylinder(root,m.dark,base.x,2.70,base.z,.14,.12,.14,24);
  const shoulder=ball(root,m.metal,...base.toArray(),.105,.105,.105);
  const upper=boom(root,m),lower=boom(root,m),elbow=ball(root,m.dark,0,0,0,.104,.104,.104);
  const tip=new THREE.Group();tip.name=index?'Non-contact examination probe':'Green line scanner';root.add(tip);
  ball(tip,m.metal,0,.09,0,.079,.079,.079);
  box(tip,m.enamel,0,-.025,0,index?.19:.29,.17,index?.22:.32,.036);
  box(tip,m.rubber,0,-.116,0,index?.14:.24,.02,index?.18:.22,.006);
  const glow=new THREE.MeshBasicMaterial({color:0x65ff87,toneMapped:false});
  const lens=box(tip,glow,0,-.129,0,index?.055:.19,.013,index?.09:.027,.004);
  if(index)for(const xx of [-.06,.06])cylinder(tip,m.metal,xx,-.13,.065,.016,.037,.016,16);
  return{root,base,side,shoulder,upper,lower,elbow,tip,lens,glow,park:base.clone().add(new THREE.Vector3(0,-.30,0)),target:new THREE.Vector3(),joint:new THREE.Vector3(),axis:new THREE.Vector3(),bend:new THREE.Vector3()};
}

function placeArm(arm,work,extension){
  arm.target.copy(arm.park).lerp(work,extension);
  arm.axis.copy(arm.target).sub(arm.base);
  const distance=arm.axis.length();arm.axis.normalize();
  arm.bend.set(arm.side,0,0).addScaledVector(arm.axis,-arm.side*arm.axis.x).normalize();
  arm.joint.copy(arm.base).addScaledVector(arm.axis,distance/2).addScaledVector(arm.bend,Math.sqrt(Math.max(0,linkLength**2-distance**2/4)));
  arm.elbow.position.copy(arm.joint);arm.tip.position.copy(arm.target);
  for(const [part,a,b]of [[arm.upper,arm.base,arm.joint],[arm.lower,arm.joint,arm.target]]){
    part.position.copy(a);arm.axis.copy(b).sub(a);part.scale.y=arm.axis.length();part.quaternion.setFromUnitVectors(up,arm.axis.normalize());
  }
}

export function createMedicalRig(m,{x,y,depth,top}){
  const root=new THREE.Group();root.name='Ceiling diagnostic rig';root.position.set(x,y,0);
  box(root,m.dark,0,2.74,-.10,3.40,.10,.56,.018);
  for(const zz of [-.32,.13])rod(root,m.metal,[-1.62,2.675,zz],[1.62,2.675,zz],.025);
  for(const xx of [-1.2,0,1.2]){
    box(root,m.enamel,xx,2.735,.20,.40,.12,.20,.014);
    box(root,m.coolLamp,xx,2.668,.20,.31,.014,.12,.008);
  }
  for(const side of [-1,1]){
    pipe(root,m.rubber,[[side*1.48,2.70,-.28],[side*1.48,2.64,-.70],[side*1.28,2.53,-1.34]],.026);
    box(root,m.metal,side*1.48,2.63,-.74,.10,.12,.075,.009);
  }
  const arms=[arm(root,m,0),arm(root,m,1)];
  const scan=new THREE.Group();scan.name='Surface-following green scan';root.add(scan);scan.visible=false;
  const fanGeometry=new THREE.BufferGeometry(),stripeGeometry=new THREE.BufferGeometry();
  fanGeometry.setAttribute('position',new THREE.BufferAttribute(new Float32Array((samples-1)*9),3));
  stripeGeometry.setAttribute('position',new THREE.BufferAttribute(new Float32Array((samples-1)*18),3));
  const fan=new THREE.Mesh(fanGeometry,new THREE.MeshBasicMaterial({color:0x42ff78,transparent:true,opacity:.045,blending:THREE.AdditiveBlending,side:THREE.DoubleSide,depthWrite:false,toneMapped:false}));
  const stripe=new THREE.Mesh(stripeGeometry,new THREE.MeshBasicMaterial({color:0x67ff8c,transparent:true,opacity:.94,side:THREE.DoubleSide,depthWrite:false,toneMapped:false}));
  fan.frustumCulled=false;stripe.frustumCulled=false;scan.add(fan,stripe);
  const rig={root,arms,scan,fan,stripe,depth,top,work:new THREE.Vector3(),ray:new THREE.Raycaster(),origin:new THREE.Vector3(),point:new THREE.Vector3(),source:new THREE.Vector3(),points:Array.from({length:samples},()=>new THREE.Vector3()),targets:[],patient:null};
  animateMedicalRig(rig,{extension:0,elevation:0},0);return rig;
}

export function animateMedicalRig(rig,pose,age,{patient=null,scanning=false}={}){
  const sweep=-.82+1.60*(1-Math.cos(age*Math.PI/4))/2;
  rig.work.set(sweep,1.56,rig.depth);placeArm(rig.arms[0],rig.work,pose.extension);
  rig.work.set(-.23+.16*Math.sin(age*.7),1.50+.045*Math.sin(age*.9),rig.depth+.17);placeArm(rig.arms[1],rig.work,pose.extension);
  for(const arm of rig.arms)arm.glow.color.setHex(scanning?0x65ff87:0x315244);
  rig.scan.visible=scanning&&Boolean(patient)&&pose.extension===1;
  if(!rig.scan.visible)return;
  if(rig.patient!==patient){
    rig.patient=patient;rig.targets=[];
    const parts=patient.userData;
    for(const part of [parts.hips,parts.chest,parts.head,...parts.legs.map(l=>l.leg),...parts.arms.map(a=>a.arm)])part.traverse(o=>{if(o.isMesh)rig.targets.push(o);});
  }
  patient.updateWorldMatrix(true,true);rig.root.updateWorldMatrix(true,true);
  rig.source.set(0,-.14,0);rig.arms[0].tip.localToWorld(rig.source);rig.root.worldToLocal(rig.source);
  // Project onto the visible character surface, falling back to the pad at the sides.
  for(let i=0;i<samples;i++){
    const zz=rig.depth-.40+i*.80/(samples-1);
    rig.origin.set(sweep,rig.source.y,zz);rig.root.localToWorld(rig.origin);rig.ray.set(rig.origin,down);
    const hits=rig.ray.intersectObjects(rig.targets,false);
    const hit=hits.find(hit=>{let node=hit.object;while(node&&node!==patient){if(!node.visible)return false;node=node.parent;}return true;});
    if(hit){rig.point.copy(hit.point);rig.root.worldToLocal(rig.point);}
    else rig.point.set(sweep,rig.top+.014,zz);
    rig.point.y=Math.max(rig.top+.014,rig.point.y)+.009;rig.points[i].copy(rig.point);
  }
  const fan=rig.fan.geometry.attributes.position,stripe=rig.stripe.geometry.attributes.position;
  for(let i=0;i<samples-1;i++){
    const a=rig.points[i],b=rig.points[i+1];
    fan.setXYZ(i*3,rig.source.x,rig.source.y,rig.source.z);fan.setXYZ(i*3+1,a.x,a.y,a.z);fan.setXYZ(i*3+2,b.x,b.y,b.z);
    const offsets=[[-.01,a],[.01,a],[-.01,b],[.01,a],[.01,b],[-.01,b]];
    offsets.forEach(([offset,p],j)=>stripe.setXYZ(i*6+j,p.x+offset,p.y,p.z));
  }
  fan.needsUpdate=true;stripe.needsUpdate=true;
}
