import * as THREE from 'three';
import {ASHTRAY} from './layout.js';
import {mouthPosition} from './dining.js';

export const CIGARETTE={length:.084,heldAt:.030,grip:new THREE.Vector3(.014,-.102,.017)};
export const LIGHTER_TIP=new THREE.Vector3(-.003,-.140,-.040);
const v=(x,y,z)=>new THREE.Vector3(x,y,z);
const paint=(color,roughness=.8)=>new THREE.MeshStandardMaterial({color,roughness});
function mesh(parent,geometry,material,name,position){
  const part=new THREE.Mesh(geometry,material);part.name=name;part.position.copy(position);parent.add(part);return part;
}

export function addSmokingAshtray(parent,m,floor){
  const root=new THREE.Group();root.name='Red ashtray / shower left';root.position.set(ASHTRAY.x,floor+ASHTRAY.y,ASHTRAY.z);parent.add(root);
  // Keep the original red can and shelf, but give it an actual recessed well.
  const profile=[[0,-.29],[.109,-.29],[.115,-.28],[.115,-.014],[.106,-.004],[.094,-.004],[.090,-.032],[0,-.032]];
  mesh(root,new THREE.LatheGeometry(profile.map(([r,y])=>new THREE.Vector2(r,y)),12),m.red,'Ashtray body',v(0,0,0));
  const rim=mesh(root,new THREE.TorusGeometry(.101,.009,4,12),m.metal,'Ashtray rim',v(0,-.003,0));rim.rotation.x=Math.PI/2;
  mesh(root,new THREE.CylinderGeometry(.088,.088,.007,12),m.dark,'Ash bed',v(0,-.026,0));
  for(const [x,z,yaw]of [[-.024,.019,.6],[.028,-.016,-.5]]){
    const butt=mesh(root,new THREE.CylinderGeometry(.006,.006,.024,6),m.cloth,'Extinguished butt',v(x,-.017,z));butt.rotation.set(Math.PI/2,0,yaw);
  }
  return root;
}

function smokeTexture(){
  const size=32,data=new Uint8Array(size*size*4);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const dx=(x+.5-size/2)/(size/2),dy=(y+.5-size/2)/(size/2),r=dx*dx+dy*dy,i=(y*size+x)*4;
    data[i]=data[i+1]=data[i+2]=230;data[i+3]=Math.round(255*Math.max(0,1-r)**2*(.86+.14*Math.sin(x*1.7+y*.9)));
  }
  const texture=new THREE.DataTexture(data,size,size);texture.needsUpdate=true;return texture;
}

export function attachSmokingProps(root){
  const {arms}=root.userData,right=arms[0],left=arms[1];
  const cigarette=new THREE.Group();cigarette.name='Held cigarette';right.hand.add(cigarette);
  cigarette.position.copy(CIGARETTE.grip).z-=CIGARETTE.heldAt;cigarette.visible=false;
  const paper=paint(0xe8e0cc),filter=paint(0xab7040),coal=paint(0x3c241a);
  coal.emissive.setHex(0xff571d);coal.emissiveIntensity=0;
  for(const [length,z,material,name]of [[.024,.012,filter,'Cigarette filter'],[.056,.052,paper,'Cigarette paper'],[.004,.082,coal,'Cigarette ember']]){
    const part=mesh(cigarette,new THREE.CylinderGeometry(.0044,.0044,length,8),material,name,v(0,0,z));part.rotation.x=Math.PI/2;
  }
  const lighter=new THREE.Group();lighter.name='Pocket lighter';left.hand.add(lighter);lighter.visible=false;
  const steel=new THREE.MeshStandardMaterial({color:0xa5aaa7,metalness:.8,roughness:.38}),dark=paint(0x252923,.5);
  mesh(lighter,new THREE.BoxGeometry(.034,.045,.014),steel,'Lighter case',v(0,-.075,-.040));
  mesh(lighter,new THREE.BoxGeometry(.017,.024,.012),steel,'Lighter chimney',v(.001,-.109,-.040));
  for(const z of [-.0462,-.0338])for(const x of [-.004,.003,.008])for(const y of [-.108,-.116]){
    const hole=mesh(lighter,new THREE.CircleGeometry(.0015,8),dark,'Chimney ventilation hole',v(x,y,z));if(z<-.04)hole.rotation.y=Math.PI;
  }
  const wheel=mesh(lighter,new THREE.CylinderGeometry(.0048,.0048,.008,12),dark,'Lighter flint wheel',v(-.013,-.103,-.040));wheel.rotation.z=Math.PI/2;
  mesh(lighter,new THREE.CylinderGeometry(.0014,.0014,.004,8),paint(0x302d23),'Lighter wick',v(.002,-.124,-.040));
  const lid=new THREE.Group();lid.name='Lighter lid hinge';lid.position.set(.017,-.0975,-.040);lighter.add(lid);
  mesh(lid,new THREE.BoxGeometry(.034,.019,.015),steel,'Lighter cap',v(-.017,-.0095,0));
  const flame=mesh(lighter,new THREE.ConeGeometry(.0035,.018,5),new THREE.MeshBasicMaterial({color:0xffc47b}),'Lighter flame',LIGHTER_TIP);
  flame.rotation.z=Math.PI;flame.visible=false;
  const smoke=new THREE.Group();smoke.name='Cigarette smoke';root.add(smoke);
  const map=smokeTexture();
  const particles=Array.from({length:24},()=>{
    const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map,color:0xcbd4d5,transparent:true,depthWrite:false,opacity:0}));
    sprite.visible=false;smoke.add(sprite);return{sprite,age:Infinity,life:2.5,origin:v(0,0,0),velocity:v(0,0,0),exhale:false};
  });
  const props={cigarette,lighter,lid,wheel,flame,ember:cigarette.getObjectByName('Cigarette ember'),smoke,particles,emission:0,serial:0};root.userData.smokingProps=props;return props;
}

const smokeRate=signal=>signal?.lit||signal?.exhale?(signal.exhale?12:5):0;

function emitSmokingParticle(root,serial,exhale){
  const props=root.userData.smokingProps,particle=props.particles[serial%props.particles.length];
  particle.exhale=exhale;particle.age=0;particle.life=exhale?2.1:2.8;
  if(exhale){
    particle.origin.copy(root.userData.body.localToWorld(mouthPosition(root.userData.head)));
    // Follow the actual face, including seated head turns, rather than the root yaw.
    particle.velocity.set(0,.04,.18).applyQuaternion(root.userData.head.getWorldQuaternion(new THREE.Quaternion()));
  }else{
    particle.origin.copy(props.cigarette.localToWorld(v(0,0,CIGARETTE.length)));
    particle.velocity.set(.014*Math.sin(serial*2.4),.09,.016*Math.cos(serial*1.7));
  }
  particle.sprite.material.rotation=serial*2.4;
  return particle;
}

// Reconstruct only surviving particles when a study seeks. Sample the real pose
// at each birth so smoke remains in world space after the head or hand moves.
export function seekSmokingSmoke(root,time,{signalAt,poseAt}){
  const props=root.userData.smokingProps,events=new Array(props.particles.length);
  for(const p of props.particles){p.age=Infinity;p.sprite.visible=false;p.sprite.material.opacity=0;}
  let emission=0,serial=0,previous=0;
  const end=Math.max(0,Number.isFinite(time)?time:0);
  for(let frame=1;frame<=Math.ceil(end*60);frame++){
    const at=Math.min(frame/60,end),signal=signalAt(at),rate=smokeRate(signal);
    emission=rate?emission+(at-previous)*rate:0;previous=at;
    while(emission>=1){
      emission-=1;events[serial%events.length]={serial,time:at,exhale:Boolean(signal.exhale)};serial++;
    }
  }
  props.serial=serial;props.emission=emission;
  for(const event of events.filter(Boolean).sort((a,b)=>a.serial-b.serial)){
    const age=end-event.time;if(age>=(event.exhale?2.1:2.8))continue;
    poseAt(event.time);root.updateWorldMatrix(true,true);
    emitSmokingParticle(root,event.serial,event.exhale).age=age;
  }
}

export function updateSmokingSmoke(root,dt){
  const props=root.userData.smokingProps;if(!props)return;
  const signal=root.userData.smokingSignal;
  if(!signal&&!props.particles.some(p=>p.age<p.life))return;
  root.updateWorldMatrix(true,true);
  const step=Number.isFinite(dt)&&dt>0?Math.min(dt,.1):0;
  if(step>0){
    for(const particle of props.particles)particle.age+=step;
    const rate=smokeRate(signal);
    props.emission=rate?props.emission+step*rate:0;
    while(props.emission>=1){
      props.emission-=1;emitSmokingParticle(root,props.serial++,Boolean(signal.exhale));
    }
  }
  for(const p of props.particles){
    p.sprite.visible=p.age<p.life;if(!p.sprite.visible)continue;
    const u=p.age/p.life,world=p.origin.clone().addScaledVector(p.velocity,p.age);
    world.x+=Math.sin(p.age*2.4+props.serial*.01)*.014*u;world.y+=.055*p.age*p.age;
    p.sprite.position.copy(root.worldToLocal(world));p.sprite.scale.setScalar((p.exhale?.034:.018)+u*(p.exhale?.19:.105));
    p.sprite.material.opacity=(p.exhale?.20:.18)*Math.sin(Math.PI*u)**.7;
  }
}
