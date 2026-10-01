import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';

function block(parent,material,x,y,z,w,h,d,r=.005,name=''){
  const geometry=r?new RoundedBoxGeometry(w,h,d,1,Math.min(r,w/3,h/3,d/3)):new THREE.BoxGeometry(w,h,d);
  const mesh=new THREE.Mesh(geometry,material);mesh.position.set(x,y,z);mesh.name=name;
  mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;
}
function cylinder(parent,material,x,y,z,r,depth,name=''){
  const mesh=new THREE.Mesh(new THREE.CylinderGeometry(r,r,depth,24),material);
  mesh.rotation.x=Math.PI/2;mesh.position.set(x,y,z);mesh.name=name;
  mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;
}
function tube(parent,material,points,r=.015,name=''){
  const path=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)),false,'centripetal');
  const mesh=new THREE.Mesh(new THREE.TubeGeometry(path,Math.max(16,points.length*10),r,10,false),material);
  mesh.name=name;mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;
}
function print(parent,value,x,y,z,w,h,color='#d9dfd0',size=37){
  const canvas=document.createElement('canvas');canvas.width=512;canvas.height=128;
  const ctx=canvas.getContext('2d');
  ctx.fillStyle=color;ctx.font=`600 ${size}px ui-monospace, monospace`;
  ctx.textBaseline='middle';ctx.fillText(value,12,64);
  const map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;
  const material=new THREE.MeshBasicMaterial({map,transparent:true,depthWrite:false,toneMapped:false,side:THREE.DoubleSide});
  const mesh=new THREE.Mesh(new THREE.PlaneGeometry(w,h),material);
  mesh.position.set(x,y,z);parent.add(mesh);return mesh;
}
function screw(parent,m,x,y,z){
  cylinder(parent,m.metal,x,y,z,.011,.008);
  block(parent,m.dark,x,y,z+.006,.011,.002,.001,0);
}
function wall(m){
  const root=new THREE.Group();
  block(root,m.dark,0,0,-.095,2.61,1.38,.17,.028,'wall backing');
  block(root,m.shipPaint,0,0,.012,2.56,1.34,.055,.011,'worn cabin wall');
  for(const x of [-1.245,1.245])block(root,m.metal,x,0,.057,.015,1.30,.025,.003,'wall seam');
  for(const y of [-.62,.62])block(root,m.dark,0,y,.053,2.48,.008,.012,.002,'wall joint');
  for(const x of [-1.18,1.18])for(const y of [-.55,.55])screw(root,m,x,y,.066);
  return root;
}
function cassette(m){
  const root=wall(m),body=new THREE.Group();root.add(body);
  block(body,m.dark,0,.015,.10,2.17,.88,.105,.035,'recessed service opening');
  block(body,m.rubber,0,.015,.165,2.09,.805,.025,.021,'black perimeter gasket');
  block(body,m.enamel,-.06,.016,.212,1.91,.735,.075,.022,'flush painted service door');
  block(body,m.metal,-.06,-.351,.258,1.86,.009,.009,.002,'lower hinge seam');
  block(body,m.dark,.912,.015,.265,.011,.585,.012,.002,'opening seam');
  block(body,m.metal,.906,.016,.276,.054,.238,.022,.006,'recessed pull');
  block(body,m.rubber,.913,.016,.290,.017,.145,.008,.002,'pull shadow');
  block(body,m.dark,-.775,.284,.263,.43,.097,.013,.004,'inventory plate');
  print(body,'SERVICE PARTS',-.777,.285,.272,.382,.061,'#d6dfd0',32);
  print(body,'SP-031 / DRY STORES',-.445,-.252,.257,.72,.075,'#59615b',22);
  for(const x of [-1.025,1.025])for(const y of [-.385,.41])screw(body,m,x,y,.167);
  return root;
}
function rack(m){
  const root=wall(m),body=new THREE.Group();root.add(body);
  block(body,m.metal,0,.012,.11,2.19,.91,.10,.025,'machined outer surround');
  block(body,m.dark,0,.012,.18,2.10,.81,.074,.014,'open equipment recess');
  block(body,m.rubber,0,-.375,.235,2.01,.026,.045,.003,'lower retaining lip');
  block(body,m.metal,0,.388,.235,2.01,.023,.038,.003,'upper case rail');
  const colors=[0x626c63,0x777d70,0x646e70];
  const labels=['FILTER','SEALS','FASTENERS'];
  for(let i=0;i<3;i++){
    const x=(i-1)*.67;
    const paint=m.enamel.clone();paint.name=`case ${i+1} painted shell`;
    paint.color.setHex(colors[i]);paint.metalness=.15;paint.roughness=.79;
    block(body,m.rubber,x,-.003,.245,.608,.652,.053,.016,'case seal');
    block(body,paint,x,-.003,.286,.57,.614,.061,.019,`service cartridge ${i+1}`);
    block(body,m.metal,x,.312,.286,.57,.034,.058,.008,'case top edge');
    block(body,m.dark,x,-.285,.325,.495,.055,.012,.004,'case label plate');
    print(body,labels[i],x,-.284,.334,.456,.046,'#dfe5d4',28);
    block(body,m.rubber,x,.095,.331,.215,.042,.012,.005,'pull inset');
    block(body,m.metal,x,.095,.342,.165,.014,.014,.004,'pull edge');
    for(const sx of [-.242,.242])block(body,m.dark,x+sx,0,.325,.022,.54,.018,.005,'moulded case rib');
  }
  for(const x of [-1.02,1.02])for(const y of [-.39,.415])screw(body,m,x,y,.24);
  return root;
}
function manifold(m){
  const root=wall(m),body=new THREE.Group();root.add(body);
  block(body,m.dark,0,.011,.11,2.18,.90,.105,.025,'recessed inspection housing');
  block(body,m.rubber,0,.13,.176,2.02,.56,.023,.010,'equipment shadow well');
  block(body,m.metal,0,-.315,.208,2.12,.226,.066,.012,'lower removable cover');
  for(const x of [-.97,.97])for(const y of [-.39,.405])screw(body,m,x,y,.225);
  for(const [y,z,r] of [[.265,.249,.022],[.105,.272,.025],[-.06,.248,.018]]){
    tube(body,y===.105?m.pipeSteel:m.cable,[[-.92,y,z],[-.47,y,z],[.19,y,z],[.91,y,z]],r,'service pipe');
    for(const x of [-.78,.62]){
      block(body,m.dark,x,y,z+.016,.065,.10,.036,.007,'pipe saddle');
      screw(body,m,x,y,z+.038);
    }
  }
  tube(body,m.pipeSteel,[[-.28,.265,.251],[-.28,.13,.29],[-.16,.105,.29]],.027,'service branch');
  tube(body,m.pipeSteel,[[.40,.105,.29],[.40,-.025,.29],[.57,-.06,.264]],.024,'return branch');
  cylinder(body,m.dark,.10,.105,.310,.084,.031,'valve body');
  cylinder(body,m.metal,.10,.105,.334,.061,.02,'valve ring');
  cylinder(body,m.rubber,.10,.105,.349,.031,.017,'valve hub');
  for(let i=0;i<4;i++){
    const a=i*Math.PI/2;
    tube(body,m.metal,[[.10+Math.cos(a)*.027,.105+Math.sin(a)*.027,.35],[.10+Math.cos(a)*.073,.105+Math.sin(a)*.073,.35]],.008,'valve spoke');
  }
  cylinder(body,m.metal,.79,.105,.313,.080,.025,'pressure gauge');
  cylinder(body,m.white,.79,.105,.331,.061,.007,'gauge face');
  block(body,m.dark,.79,.105,.339,.066,.007,.005,0,'gauge needle').rotation.z=-.38;
  block(body,m.dark,-.65,-.315,.246,.48,.10,.015,.004,'equipment tag');
  print(body,'SERVICE / 03',-.65,-.315,.258,.43,.066,'#dce3d4',30);
  for(const x of [-.72,-.43,-.14,.15,.44,.73])block(body,m.dark,x,-.313,.250,.011,.076,.018,.002,'cover vent');
  return root;
}

export function createServicePartsPanel(m,variant){
  if(variant==='cassette')return cassette(m);
  if(variant==='manifold')return manifold(m);
  if(variant==='rack')return rack(m);
  throw new Error(`Unknown service parts panel: ${variant}`);
}
