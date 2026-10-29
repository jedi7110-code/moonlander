import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

export function habitatMountLayout({radius,podDepth,podCenterZ}){
  const skinY=-podDepth/2-.95,supportRadius=radius+skinY-1.05;
  return {skinY,podRadius:radius,ringRadius:radius+skinY-1.35,supportRadius,pinY:supportRadius-radius,
    width:13.4,depth:4.2,centerZ:podCenterZ,ringSegments:48,railXs:[-2.15,2.15],sparXs:[-1.75,1.75]};
}

export function ringRailSeat(radius,z,segments=48){
  const step=Math.PI*2/segments,start=Math.floor(Math.asin(z/radius)/step)*step,end=start+step;
  const fraction=(z-radius*Math.sin(start))/(radius*(Math.sin(end)-Math.sin(start)));
  return {y:radius*(Math.cos(start)+(Math.cos(end)-Math.cos(start))*fraction),angle:(start+end)/2};
}

export function addHabitatFoundation(pod,m,layout,{addMesh,box,rod,pipe,bake}){
  const {skinY,ringRadius,width,depth,centerZ,railXs,sparXs}=layout;
  const radius=layout.podRadius,pinY=layout.pinY-skinY;
  const outline=new THREE.Shape(),halfWidth=width/2,front=centerZ-depth/2,back=centerZ+depth/2,cut=.42;
  outline.moveTo(-halfWidth+cut,front);outline.lineTo(halfWidth-cut,front);
  outline.lineTo(halfWidth,front+cut);outline.lineTo(halfWidth,back-cut);
  outline.lineTo(halfWidth-cut,back);outline.lineTo(-halfWidth+cut,back);
  outline.lineTo(-halfWidth,back-cut);outline.lineTo(-halfWidth,front+cut);outline.closePath();
  const opening=new THREE.Path();opening.moveTo(-1.10,centerZ-.55);opening.lineTo(-1.10,centerZ+.55);
  opening.lineTo(1.10,centerZ+.55);opening.lineTo(1.10,centerZ-.55);opening.closePath();outline.holes.push(opening);
  const plate=addMesh(pod,new THREE.ExtrudeGeometry(outline,{depth:.28,bevelEnabled:false,curveSegments:1}),
    m.patch,'Habitat structural load-spreader',[0,skinY+.02,0]);plate.rotation.x=Math.PI/2;
  for(const z of [centerZ-1.25,centerZ+1.25]){
    box(pod,m.steel,[0,skinY-.48,z],[12.6,.46,.28],'Foundation boxed longitudinal girder');
    box(pod,m.patch,[0,skinY-.75,z],[12.8,.12,.55],'Foundation girder lower flange');
    box(pod,m.steel,[0,skinY+.90,z],[12.0,.18,.45],'Pressure-roof structural doubler');
    for(const x of [-5.8,-2.15,2.15,5.8]){
      box(pod,m.steel,[x,skinY+.44,z],[.32,1.08,.45],'Through-skin structural hardpoint');
      box(pod,m.patch,[x,skinY-.47,z],[.16,.48,.65],'Foundation girder stiffener');
    }
  }
  for(const x of [-5.9,-3.9,-1.6,1.6,3.9,5.9])for(const z of [front+.22,back-.22]){
    rod(pod,m.steel,[x,skinY-.27,z],[x,skinY-.37,z],.085,'Load-spreader captive bolt');
  }
  for(const x of railXs)for(const z of [centerZ-1.30,centerZ+1.30]){
    const railSeat=ringRailSeat(ringRadius,z-centerZ),railY=railSeat.y-radius,web=new THREE.Shape();
    web.moveTo(x-.78,skinY-.25);web.lineTo(x+.78,skinY-.25);
    web.lineTo(x+.31,railY+.10);web.lineTo(x-.31,railY+.10);web.closePath();
    const coolantSeat=ringRailSeat(ringRadius+.6,z-centerZ),coolantY=coolantSeat.y-radius,coolantBore=new THREE.Path();
    coolantBore.absarc(x,coolantY,.14,0,Math.PI*2,true);web.holes.push(coolantBore);
    addMesh(pod,new THREE.ExtrudeGeometry(web,{depth:.22,bevelEnabled:false,curveSegments:1}),
      m.patch,'Ring saddle tapered shear web',[0,0,z-.11]);
    const restraint=addMesh(pod,new THREE.TorusGeometry(.11,.04,4,8),m.steel,'Ring coolant cushioned restraint',[x,coolantY,z]);
    restraint.rotation.x=coolantSeat.angle;
    const clamp=new THREE.Group();clamp.name='Ring rail split saddle';
    clamp.position.set(x,railY,z);clamp.rotation.x=railSeat.angle;pod.add(clamp);
    addMesh(clamp,new THREE.TorusGeometry(.23,.08,4,12),m.steel,'Rail saddle clamp');
    for(const side of [-1,1]){
      box(clamp,m.steel,[side*.31,0,0],[.18,.16,.38],'Saddle split flange');
      rod(clamp,m.pipe,[side*.31,-.14,0],[side*.31,.14,0],.065,'Saddle through bolt');
    }
  }
  const neckBottom=ringRadius-radius-.12,neckTop=skinY+.95,neckHeight=neckTop-neckBottom;
  for(const x of [-1.04,1.04])box(pod,m.patch,[x,(neckTop+neckBottom)/2,centerZ],[.12,neckHeight,1.02],'Sealed radial access neck side');
  for(const z of [centerZ-.45,centerZ+.45])box(pod,m.patch,[0,(neckTop+neckBottom)/2,z],[1.98,neckHeight,.12],'Sealed radial access neck face');
  for(const y of [neckBottom+.22,skinY-.30]){
    for(const x of [-1.12,1.12])box(pod,m.steel,[x,y,centerZ],[.16,.16,1.20],'Access neck bolted flange');
    for(const z of [centerZ-.54,centerZ+.54])box(pod,m.steel,[0,y,z],[2.08,.16,.12],'Access neck bolted flange');
  }
  const sockets=sparXs.map(x=>{
    const socket=new THREE.Group();socket.name='Radial spar pinned foundation shoe';
    socket.position.set(x,skinY,centerZ);pod.add(socket);
    box(socket,m.steel,[0,-.40,0],[2.12,.28,1.58],'Spar shoe bedplate');
    for(const z of [-.52,.52]){
      const cheek=new THREE.Shape();cheek.moveTo(-.94,-.47);cheek.lineTo(.94,-.47);
      cheek.lineTo(.55,pinY-.20);cheek.lineTo(.28,pinY-.39);
      cheek.lineTo(-.28,pinY-.39);cheek.lineTo(-.55,pinY-.20);cheek.closePath();
      const bore=new THREE.Path();bore.absarc(0,pinY,.18,0,Math.PI*2,true);cheek.holes.push(bore);
      addMesh(socket,new THREE.ExtrudeGeometry(cheek,{depth:.18,bevelEnabled:false,curveSegments:3}),
        m.steel,'Spar double-shear clevis',[0,0,z-.09]);
      for(const side of [-1,1])rod(socket,m.steel,[side*.74,-.45,z],[side*.74,-.57,z],.085,'Spar shoe anchor bolt');
    }
    rod(socket,m.steel,[0,pinY,-.79],[0,pinY,.79],.17,'Radial spar transverse pivot pin');
    for(const z of [-.78,.78])rod(socket,m.steel,[0,pinY,z-.045],[0,pinY,z+.045],.26,'Pivot pin retaining cap');
    pipe(socket,m.steel,[[0,pinY,.34],[.32,pinY+.18,.34],[.70,-.65,1.05],[.70,.10,1.05]],.095,'Sealed spar utility feedthrough');
    bake(socket);socket.userData.panelDetailExclude=true;socket.userData.sparX=x;
    return socket;
  });
  pod.userData.panelKeepouts??=[];
  pod.userData.panelKeepouts.push({min:[-halfWidth-.02,neckBottom-.45,front-.02],max:[halfWidth+.02,skinY+.03,back+.02]});
  pod.userData.habitatMount={...layout};
  return sockets;
}

export function batchHabitatSockets(pod,sockets,material){
  const target=pod.children.find(mesh=>mesh.isMesh&&mesh.material===material);
  const geometries=[target.geometry],ranges=[];
  let start=target.geometry.attributes.position.count;
  for(const socket of sockets){
    socket.updateMatrix();
    const mesh=socket.children[0],geometry=mesh.geometry.clone().applyMatrix4(socket.matrix),positions=geometry.attributes.position;
    const restX=Float32Array.from({length:positions.count},(_,index)=>positions.getX(index));
    ranges.push({socket,start,restX});start+=positions.count;geometries.push(geometry);
    mesh.removeFromParent();mesh.geometry.dispose();
  }
  target.geometry=mergeGeometries(geometries,false);geometries.forEach(geometry=>geometry.dispose());
  return scale=>{
    const positions=target.geometry.attributes.position;let changed=false;
    for(const {socket,start,restX}of ranges){
      const x=socket.userData.sparX*scale;if(x===socket.position.x)continue;
      const offset=x-socket.userData.sparX;socket.position.x=x;changed=true;
      for(let index=0;index<restX.length;index++)positions.setX(start+index,restX[index]+offset);
    }
    if(changed){positions.needsUpdate=true;target.geometry.computeBoundingBox();target.geometry.computeBoundingSphere();}
  };
}
