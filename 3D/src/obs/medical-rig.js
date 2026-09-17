import * as THREE from 'three';
import {box,ball,cylinder,pipe,rod} from './materials.js';

const up=new THREE.Vector3(0,1,0),down=new THREE.Vector3(0,-1,0);
const samples=81,linkLength=.98;

function scanTarget(mesh,rig,sweep){
  if(!mesh.isSkinnedMesh)return mesh;
  let cached=rig.surfaces.get(mesh);
  if(!cached||cached.source!==mesh.geometry){
    const geometry=new THREE.BufferGeometry();
    geometry.setAttribute('position',mesh.geometry.attributes.position.clone());
    geometry.setIndex(new THREE.BufferAttribute(new Uint32Array(mesh.geometry.index?.count??mesh.geometry.attributes.position.count),1));
    cached={source:mesh.geometry,mesh:new THREE.Mesh(geometry,mesh.material),transform:new THREE.Matrix4()};
    rig.surfaces.set(mesh,cached);
  }
  // Deform each vertex once per scan, not once for every ray/triangle. This
  // CPU-only surface is never rendered and follows the same skin as the GPU.
  const target=cached.mesh,positions=target.geometry.attributes.position;
  rig.surfaceTransform.copy(rig.root.matrixWorld).invert().multiply(mesh.matrixWorld);
  mesh.skeleton.update();
  const bones=mesh.skeleton.boneMatrices,version=mesh.geometry.attributes.position.version;
  if(!cached.bones||version!==cached.version||!cached.transform.equals(rig.surfaceTransform)||bones.some((value,i)=>value!==cached.bones[i])){
    cached.transform.copy(rig.surfaceTransform);
    for(let i=0;i<positions.count;i++){
      mesh.getVertexPosition(i,rig.point).applyMatrix4(cached.transform);positions.setXYZ(i,rig.point.x,rig.point.y,rig.point.z);
    }
    cached.bones??=new Float32Array(bones.length);cached.bones.set(bones);cached.version=version;
    target.geometry.computeBoundingBox();target.geometry.computeBoundingSphere();
  }
  // Only triangles crossing this scan plane can meet its downward rays.
  // Keep material groups while culling the rest before the per-sample raycasts.
  const source=mesh.geometry,index=source.index,filtered=target.geometry.index;
  const groups=source.groups.length?source.groups:[{start:0,count:index?.count??positions.count,materialIndex:0}];
  let count=0;target.geometry.clearGroups();
  for(const group of groups){
    const start=count,end=Math.min(group.start+group.count,source.drawRange.start+source.drawRange.count);
    for(let i=Math.max(group.start,source.drawRange.start);i<end;i+=3){
      const a=index?index.getX(i):i,b=index?index.getX(i+1):i+1,c=index?index.getX(i+2):i+2;
      const ax=positions.getX(a),bx=positions.getX(b),cx=positions.getX(c);
      if(Math.min(ax,bx,cx)>sweep||Math.max(ax,bx,cx)<sweep)continue;
      filtered.setX(count++,a);filtered.setX(count++,b);filtered.setX(count++,c);
    }
    target.geometry.addGroup(start,count-start,group.materialIndex);
  }
  target.geometry.setDrawRange(0,count);
  target.material=mesh.material;target.matrixWorld.copy(rig.root.matrixWorld);
  return target;
}

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
  const rig={root,arms,scan,fan,stripe,depth,top,work:new THREE.Vector3(),ray:new THREE.Raycaster(),origin:new THREE.Vector3(),point:new THREE.Vector3(),source:new THREE.Vector3(),points:Array.from({length:samples},()=>new THREE.Vector3()),targets:[],rayTargets:[],surfaces:new WeakMap(),surfaceTransform:new THREE.Matrix4(),bounds:new THREE.Box3(),patient:null};
  animateMedicalRig(rig,{extension:0,elevation:0},0);return rig;
}

export function animateMedicalRig(rig,pose,age,{patient=null,scanning=false}={}){
  const sweep=-.82+1.60*(1-Math.cos(age*Math.PI/4))/2;
  rig.work.set(sweep,1.56,rig.depth);placeArm(rig.arms[0],rig.work,pose.extension);
  rig.work.set(-.23+.16*Math.sin(age*.7),1.50+.045*Math.sin(age*.9),rig.depth+.17);placeArm(rig.arms[1],rig.work,pose.extension);
  for(const arm of rig.arms)arm.glow.color.setHex(scanning?0x65ff87:0x315244);
  rig.scan.visible=scanning&&Boolean(patient)&&pose.extension===1;
  if(!rig.scan.visible)return;
  patient.updateWorldMatrix(true,false);patient.updateMatrixWorld(true);rig.root.updateWorldMatrix(true,true);
  // The connected skin is a sibling of the old body parts, not their child.
  // Refresh visible targets also after asynchronous model attachment/replacement.
  rig.patient=patient;rig.targets.length=0;rig.rayTargets.length=0;
  patient.traverseVisible(mesh=>{
    if(!mesh.isMesh)return;
    rig.targets.push(mesh);
    const target=scanTarget(mesh,rig,sweep);
    if(!target.geometry.boundingBox)target.geometry.computeBoundingBox();
    rig.surfaceTransform.copy(rig.root.matrixWorld).invert().multiply(target.matrixWorld);
    rig.bounds.copy(target.geometry.boundingBox).applyMatrix4(rig.surfaceTransform);
    if(sweep>=rig.bounds.min.x&&sweep<=rig.bounds.max.x)rig.rayTargets.push(target);
  });
  rig.source.set(0,-.14,0);rig.arms[0].tip.localToWorld(rig.source);rig.root.worldToLocal(rig.source);
  // Project onto the visible character surface, falling back to the pad at the sides.
  for(let i=0;i<samples;i++){
    const zz=rig.depth-.40+i*.80/(samples-1);
    rig.origin.set(sweep,rig.source.y,zz);rig.root.localToWorld(rig.origin);rig.ray.set(rig.origin,down);
    const hit=rig.ray.intersectObjects(rig.rayTargets,false)[0];
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
