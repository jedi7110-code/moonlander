import * as THREE from 'three';
import {ASHTRAY} from './layout.js';
import {mouthPosition} from './dining.js';

export const CIGARETTE={length:.084,heldAt:.030,grip:new THREE.Vector3(.014,-.102,.017)};
export const LIGHTER_TIP=new THREE.Vector3(0,-.153,.025);
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
  mesh(lighter,new THREE.BoxGeometry(.024,.050,.014),paint(0x4b5351,.45),'Lighter case',v(0,-.105,.025));
  mesh(lighter,new THREE.BoxGeometry(.025,.013,.015),paint(0xaaa99d,.3),'Lighter cap',v(0,-.136,.025));
  const flame=mesh(lighter,new THREE.ConeGeometry(.0035,.018,5),new THREE.MeshBasicMaterial({color:0xffc47b}),'Lighter flame',LIGHTER_TIP);
  flame.rotation.z=Math.PI;flame.visible=false;
  const smoke=new THREE.Group();smoke.name='Cigarette smoke';root.add(smoke);
  const map=smokeTexture();
  const particles=Array.from({length:24},()=>{
    const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map,color:0xcbd4d5,transparent:true,depthWrite:false,opacity:0}));
    sprite.visible=false;smoke.add(sprite);return{sprite,age:Infinity,life:2.5,origin:v(0,0,0),velocity:v(0,0,0),exhale:false};
  });
  const props={cigarette,lighter,flame,ember:cigarette.getObjectByName('Cigarette ember'),smoke,particles,emission:0,serial:0};root.userData.smokingProps=props;return props;
}

export function updateSmokingSmoke(root,dt){
  const props=root.userData.smokingProps;if(!props)return;
  const signal=root.userData.smokingSignal;
  if(!signal&&!props.particles.some(p=>p.age<p.life))return;
  root.updateWorldMatrix(true,true);
  const step=Number.isFinite(dt)&&dt>0?Math.min(dt,.1):0;
  if(step>0){
    for(const particle of props.particles)particle.age+=step;
    const emitting=signal?.lit||signal?.exhale;
    props.emission=emitting?props.emission+step*(signal.exhale?12:5):0;
    while(props.emission>=1){
      props.emission-=1;const serial=props.serial++,particle=props.particles[serial%props.particles.length];
      particle.exhale=Boolean(signal.exhale);particle.age=0;particle.life=particle.exhale?2.1:2.8;
      if(particle.exhale){
        particle.origin.copy(root.userData.body.localToWorld(mouthPosition(root.userData.head)));
        particle.velocity.set(0,.04,.18).applyQuaternion(root.getWorldQuaternion(new THREE.Quaternion()));
      }else{
        particle.origin.copy(props.cigarette.localToWorld(v(0,0,CIGARETTE.length)));
        particle.velocity.set(.014*Math.sin(serial*2.4),.09,.016*Math.cos(serial*1.7));
      }
      particle.sprite.material.rotation=serial*2.4;
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
