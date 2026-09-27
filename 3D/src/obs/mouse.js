import * as THREE from 'three';
import {mousePose} from './lucy-run-motion.js';
import {mouseRunCycle,MOUSE_STRIDE} from './mouse-gait.js';

function furTexture(){
  const width=256,height=256,data=new Uint8Array(width*height*4);
  const noise=(x,y)=>{const n=Math.sin(x*127.1+y*311.7)*43758.5453;return n-Math.floor(n);};
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const strand=noise(x,Math.floor(y/5)),grain=noise(x,y),patch=noise(Math.floor(x/9),Math.floor(y/18));
    const value=Math.round(145+strand*69+grain*20+patch*16),i=(y*width+x)*4;
    data[i]=data[i+1]=data[i+2]=value;data[i+3]=255;
  }
  const map=new THREE.DataTexture(data,width,height);map.colorSpace=THREE.SRGBColorSpace;
  map.wrapS=map.wrapT=THREE.RepeatWrapping;map.repeat.set(2,1);map.magFilter=THREE.LinearFilter;
  map.minFilter=THREE.LinearMipmapLinearFilter;map.generateMipmaps=true;map.needsUpdate=true;
  return map;
}
export function createCabinMouse(){
  const root=new THREE.Group();root.name='Wall mouse';
  const body=new THREE.Group();root.add(body);
  const head=new THREE.Group();body.add(head);
  const material=(name,color,roughness=1)=>new THREE.MeshStandardMaterial({name,color,roughness});
  const fur=material('Mouse warm grey fur',0x857a65),muzzle=material('Mouse pale muzzle',0xa2967e);
  fur.map=furTexture();fur.bumpMap=fur.map;fur.bumpScale=.00045;
  const skin=material('Mouse paws and nose',0xa17b6d),earSkin=material('Mouse inner ear',0x9e8973);
  const tailSkin=material('Mouse brown tail',0x72604e),eye=material('Mouse dark eyes',0x080a08,.16);
  const glint=new THREE.MeshBasicMaterial({color:0xcac8b8});
  const whiskerMat=new THREE.LineBasicMaterial({color:0x514d42,transparent:true,opacity:.66,depthWrite:false});
  const clip=[new THREE.Plane(new THREE.Vector3(1,0,0),4.12),new THREE.Plane(new THREE.Vector3(-1,0,0),4.12)];
  for(const m of [fur,muzzle,skin,earSkin,tailSkin,eye,glint,whiskerMat]){m.clippingPlanes=clip;m.clipShadows=true;}
  const sphere=new THREE.SphereGeometry(1,16,10),limbGeometry=new THREE.CylinderGeometry(1,1,1,7);
  const v=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);
  function ellipsoid(parent,mat,pos,size,name){
    const mesh=new THREE.Mesh(sphere,mat);mesh.position.set(...pos);mesh.scale.set(...size);
    mesh.name=name??mat.name;mesh.castShadow=mesh.receiveShadow=true;parent.add(mesh);return mesh;
  }
  ellipsoid(body,fur,[0,.014,.034],[.034,.033,.065],'Mouse torso');
  const haunches=[-1,1].map(side=>ellipsoid(root,fur,[side*.018,.025,-.040],[.017,.020,.027],'Mouse haunch'));
  ellipsoid(head,fur,[0,.006,.010],[.025,.024,.034],'Mouse head');
  ellipsoid(head,muzzle,[0,-.005,.034],[.016,.013,.027],'Mouse muzzle');
  ellipsoid(head,skin,[0,-.003,.059],[.006,.005,.004],'Mouse nose');
  const ears=[];
  for(const side of [-1,1]){
    const ear=new THREE.Group();ear.position.set(side*.026,.029,-.004);ear.rotation.set(0,side*.14,-side*.17);head.add(ear);ears.push(ear);
    ellipsoid(ear,fur,[0,0,0],[.019,.026,.006],'Mouse outer ear');
    ellipsoid(ear,earSkin,[0,0,.005],[.0145,.020,.0025],'Mouse inner ear');
    const eyeMesh=ellipsoid(head,eye,[side*.019,.016,.032],[.0065,.008,.0055],'Mouse eye');eyeMesh.rotation.y=side*.45;
    ellipsoid(head,glint,[side*.018,.019,.037],[.0014,.0014,.0012],'Mouse eye highlight');
  }
  const whiskers=[];
  for(const side of [-1,1])for(let i=0;i<4;i++){
    const a=v(side*.008,-.005,.050),b=v(side*.035,-.009+i*.007,.054),c=v(side*.065,-.020+i*.013,.025+i*.009);
    whiskers.push(...a.toArray(),...b.toArray(),...b.toArray(),...c.toArray());
  }
  const whiskerLines=new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(whiskers,3)),whiskerMat);
  whiskerLines.name='Mouse whiskers';head.add(whiskerLines);

  function link(radius,mat){const mesh=new THREE.Mesh(limbGeometry,mat);mesh.userData.radius=radius;mesh.castShadow=true;root.add(mesh);return mesh;}
  function setLink(mesh,a,b){mesh.position.copy(a).add(b).multiplyScalar(.5);mesh.scale.set(mesh.userData.radius,a.distanceTo(b),mesh.userData.radius);mesh.quaternion.setFromUnitVectors(v(0,1,0),b.clone().sub(a).normalize());}
  const legs=[];
  for(const rear of [false,true])for(const side of [-1,1]){
    const paw=new THREE.Group();paw.name=rear?'Mouse hind foot':'Mouse forepaw';root.add(paw);
    ellipsoid(paw,skin,[0,0,0],rear?[.009,.004,.017]:[.007,.0035,.009]);
    for(let i=0;i<3;i++)ellipsoid(paw,skin,[(i-1)*.004,-.001,rear?.014:.007],rear?[.0022,.0025,.006]:[.0018,.002,.004]);
    const key=(rear?'rear':'front')+(side===1?'L':'R');
    legs.push({key,rear,side,paw,upper:link(rear?.007:.0047,fur),lower:link(rear?.004:.0034,skin)});
  }
  const tail=Array.from({length:10},(_,i)=>link(.0037*(1-i/11),tailSkin));
  function update(mouse){
    const {upright,look}=mousePose(mouse),moving=Math.min(1,mouse.speed/.5)*(1-upright);
    const gait=mouseRunCycle(mouse.distance),phase=mouse.distance/MOUSE_STRIDE*Math.PI*2,time=mouse.age;
    body.position.set(0,.027+Math.sin(phase*2)*.0015*moving+Math.sin(time*7)*.0005*upright,-.038);
    body.rotation.set(-1.05*upright,look*.12,0,'YXZ');
    head.position.set(0,.011+Math.sin(time*16)*.0006*upright,.079);
    head.rotation.set(.82*upright,look,Math.sin(time*3)*.025*upright,'YXZ');
    ears.forEach((ear,i)=>ear.rotation.z=(i?-.17:.17)+Math.sin(time*6+i)*.035*upright);
    haunches.forEach(mesh=>mesh.scale.y=.020+.002*upright);
    const torsoPoint=p=>p.applyEuler(body.rotation).add(body.position);
    for(const leg of legs){
      const {rear,side,paw,key}=leg,step=gait.feet[key];
      // Paws stay independent of the body's bob and of the speed envelope:
      // shrinking their stroke at low speed would make planted feet slide.
      const foot=v(side*(rear?.032:.024),.006+step.lift,(rear?-.030:.026)+step.z);
      const shoulder=rear?v(side*.023,.029,-.042):torsoPoint(v(side*.025,.004,.057));
      let elbow=shoulder.clone().lerp(foot,.53).add(v(side*.004,0,rear?.012:-.010));
      if(!rear){
        foot.lerp(torsoPoint(v(side*.020,-.029,.070)),upright);
        elbow.lerp(torsoPoint(v(side*.028,-.018,.047)),upright);
      }
      setLink(leg.upper,shoulder,elbow);setLink(leg.lower,elbow,foot);
      paw.position.copy(foot);paw.rotation.set(step.roll*(1-upright)+(rear?0:.48*upright),0,rear?0:-side*.27*upright);
      if(!rear&&upright>0)step.planted=false;
    }
    let previous=torsoPoint(v(0,.003,-.020));
    const tailBase=previous.clone();
    tail.forEach((mesh,i)=>{
      const u=(i+1)/tail.length;
      const next=v(Math.sin(u*Math.PI)*.021+Math.sin(phase*.3-i*.45)*.005*u*moving,.004+(tailBase.y-.004)*Math.exp(-u*7),tailBase.z-u*.205);
      setLink(mesh,previous,next);previous=next;
    });
    root.updateMatrixWorld(true);
    return {...gait,upright,look};
  }
  return {root,update,body,head,legs,setBounds(left,right){clip[0].constant=-left;clip[1].constant=right;}};
}
