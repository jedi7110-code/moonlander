import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {createDroidLowParts,batchDroidLow} from './droid-low.js';
import {DROID_STARTUP_SECONDS,droidStartupLight} from './droid-startup.js';

const V=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z),DOWN=V(0,-1,0),UP=V(0,1,0);
const TAU=Math.PI*2,clamp=THREE.MathUtils.clamp;
export const DROID_SPEC=Object.freeze({serial:'3817',height:1.72,shoulderHalfWidth:.175,upperLeg:.34,middleLeg:.29,lowerLeg:.35,upperArm:.31,forearm:.295,stepPeriod:1.4,stance:.64});
export const DROID_POSTURE=Object.freeze({idleLean:.13,walkLean:.18,bodyZ:-.02});
export const DROID_EXPRESSIONS=Object.freeze({neutral:'通常',happy:'喜び',sad:'悲しみ',surprised:'驚き',angry:'怒り',sleepy:'眠い'});

function wornTexture(){
  const n=128,data=new Uint8Array(n*n*4);let seed=3817;
  const random=()=>((seed=(1664525*seed+1013904223)>>>0)/4294967296);
  for(let y=0;y<n;y++)for(let x=0;x<n;x++){
    const edge=Math.min(x,y,n-1-x,n-1-y),noise=random(),chip=edge<4&&noise>.58;
    const stain=Math.sin(x*.17+Math.sin(y*.11)*3)*Math.sin(y*.095+x*.041);
    const c=chip?80+noise*40:220+stain*13+noise*18;
    const i=(y*n+x)*4;data[i]=c;data[i+1]=c*.985;data[i+2]=c*.95;data[i+3]=255;
  }
  const texture=new THREE.DataTexture(data,n,n,THREE.RGBAFormat);
  texture.colorSpace=THREE.SRGBColorSpace;texture.needsUpdate=true;
  texture.wrapS=texture.wrapT=THREE.RepeatWrapping;return texture;
}

function headWearTexture(){
  const n=256,data=new Uint8Array(n*n*4);let seed=731;
  const random=()=>((seed=(1664525*seed+1013904223)>>>0)/4294967296);
  const hash=(x,y)=>{let h=Math.imul(x+191,374761393)^Math.imul(y+73,668265263);h=Math.imul(h^(h>>>13),1274126177);return ((h^(h>>>16))>>>0)/4294967295;};
  const noise=(x,y)=>{const ix=Math.floor(x),iy=Math.floor(y),u=x-ix,v=y-iy;const sx=u*u*(3-2*u),sy=v*v*(3-2*v);return THREE.MathUtils.lerp(THREE.MathUtils.lerp(hash(ix,iy),hash(ix+1,iy),sx),THREE.MathUtils.lerp(hash(ix,iy+1),hash(ix+1,iy+1),sx),sy);};
  for(let y=0;y<n;y++)for(let x=0;x<n;x++){
    const c=210+noise(x/33,y/33)*24+random()*15,i=(y*n+x)*4;
    data[i]=c;data[i+1]=c;data[i+2]=c*.977;data[i+3]=255;
  }
  for(let k=0;k<300;k++){
    const x=Math.floor(random()*n),y=Math.floor(random()*n),length=2+Math.floor(random()*9),slope=random()-.5;
    for(let j=0;j<length;j++){
      const px=(x+j)%n,py=(y+Math.round(j*slope)+n)%n,i=(py*n+px)*4,c=100+random()*65;
      data[i]=c;data[i+1]=c*.98;data[i+2]=c*.92;
    }
  }
  const texture=new THREE.DataTexture(data,n,n,THREE.RGBAFormat);texture.colorSpace=THREE.SRGBColorSpace;
  texture.magFilter=THREE.LinearFilter;texture.minFilter=THREE.LinearMipmapLinearFilter;texture.generateMipmaps=true;texture.needsUpdate=true;return texture;
}

function palette(){
  const texture=wornTexture(),headTexture=headWearTexture();
  const metal=(name,color,metalness,roughness)=>{
    const m=new THREE.MeshStandardMaterial({name,color,metalness,roughness});m.userData.cabinKeepSurface=true;return m;
  };
  const paint=new THREE.MeshStandardMaterial({name:'Droid / worn warm gray paint',color:0x96978b,map:texture,metalness:.42,roughness:.67});
  const haloData=new Uint8Array(32*32*4);
  for(let y=0;y<32;y++)for(let x=0;x<32;x++){
    const r=Math.hypot((x-15.5)/15.5,(y-15.5)/15.5),i=(y*32+x)*4;
    haloData[i]=255;haloData[i+1]=89;haloData[i+2]=15;haloData[i+3]=Math.max(0,1-r)**2*70;
  }
  const haloTexture=new THREE.DataTexture(haloData,32,32,THREE.RGBAFormat);haloTexture.needsUpdate=true;haloTexture.colorSpace=THREE.SRGBColorSpace;
  return {
    paint,steel:metal('Droid / oxidized titanium',0x686b64,.83,.43),
    headPaint:new THREE.MeshStandardMaterial({name:'Droid / worn head casing',color:0x989c90,map:headTexture,metalness:.54,roughness:.55}),
    window:new THREE.MeshPhysicalMaterial({name:'Droid / recessed face glass',color:0x454c40,roughness:.12,metalness:.08,transparent:true,opacity:.08,depthWrite:false}),
    bright:metal('Droid / machined piston',0xa4acab,.92,.25),
    dark:metal('Droid / graphite steel',0x292c29,.78,.49),
    copper:metal('Droid / aged copper cable',0x70432f,.6,.58),
    brass:metal('Droid / brass coupling',0x8d7545,.8,.4),
    rubber:new THREE.MeshStandardMaterial({name:'Droid / rubber cable',color:0x191d1b,roughness:.9}),
    ceramic:new THREE.MeshStandardMaterial({name:'Droid / white ceramic',color:0xece9de,roughness:.28}),
    cloth:new THREE.MeshStandardMaterial({name:'Droid / folded cloth',color:0xb7b0a0,roughness:1}),
    amber:new THREE.MeshBasicMaterial({name:'Droid / nixie cathode',color:0xffb660,toneMapped:false}),
    halo:new THREE.MeshBasicMaterial({name:'Droid / tube illumination',map:haloTexture,transparent:true,depthWrite:false,toneMapped:false,blending:THREE.AdditiveBlending}),
    glow:new THREE.MeshBasicMaterial({name:'Droid / nixie halo',color:0xff530d,transparent:true,opacity:.12,depthWrite:false,toneMapped:false}),
    glass:new THREE.MeshPhysicalMaterial({name:'Droid / tube glass',color:0x9a6b3c,metalness:.05,roughness:.12,transparent:true,opacity:.13,depthWrite:false}),
    texture,headTexture,haloTexture,
  };
}

function mesh(parent,geometry,material,position=[0,0,0]){
  const object=new THREE.Mesh(geometry,material);object.position.set(...position);object.castShadow=!material.transparent;object.receiveShadow=true;parent.add(object);return object;
}
function box(parent,m,p,size,r=.006){return mesh(parent,new RoundedBoxGeometry(...size,2,r),m,p);}
function rod(parent,m,a,b,r=.008,segments=10){
  a=Array.isArray(a)?V(...a):a;b=Array.isArray(b)?V(...b):b;
  const delta=b.clone().sub(a),o=mesh(parent,new THREE.CylinderGeometry(r,r,delta.length(),segments),m,a.clone().add(b).multiplyScalar(.5).toArray());
  o.quaternion.setFromUnitVectors(UP,delta.normalize());return o;
}
function tube(parent,m,points,r=.006){
  const curve=new THREE.CatmullRomCurve3(points.map(p=>V(...p)));
  return mesh(parent,new THREE.TubeGeometry(curve,Math.max(12,points.length*5),r,6,false),m);
}
function cylinder(parent,m,p,r,length,axis='y',segments=16){
  const o=mesh(parent,new THREE.CylinderGeometry(r,r,length,segments),m,p);
  if(axis==='x')o.rotation.z=Math.PI/2;if(axis==='z')o.rotation.x=Math.PI/2;return o;
}
function ring(parent,m,p,r,thickness=.006,axis='z'){
  const o=mesh(parent,new THREE.TorusGeometry(r,thickness,6,24),m,p);
  if(axis==='x')o.rotation.y=Math.PI/2;if(axis==='y')o.rotation.x=Math.PI/2;return o;
}
function bolts(parent,m,p,w,h){
  for(const x of [-1,1])for(const y of [-1,1])cylinder(parent,m,[p[0]+x*w/2,p[1]+y*h/2,p[2]],.008,.005,'z',6);
}
function bearing(parent,m,p,r=.037,width=.075){
  cylinder(parent,m.dark,p,r,width,'x');
  for(const side of [-1,1]){
    const x=p[0]+side*(width/2+.004);cylinder(parent,m.steel,[x,p[1],p[2]],r*.87,.009,'x');
    ring(parent,m.bright,[x+side*.006,p[1],p[2]],r*.68,.003,'x');
    cylinder(parent,m.brass,[x+side*.012,p[1],p[2]],r*.29,.007,'x',6);
  }
}
function panel(parent,m,p,size){const o=box(parent,m.paint,p,size,.009);bolts(parent,m.dark,[p[0],p[1],p[2]+size[2]/2+.003],size[0]-.028,size[1]-.028);return o;}

function chamferProfile(w,h,top=.026,bottom=.012){
  return [[-w,-h+bottom],[-w+bottom,-h],[w-bottom,-h],[w,-h+bottom],[w,h-top],[w-top,h],[-w+top,h],[-w,h-top]];
}
function profileShape(outline,hole){
  const shape=new THREE.Shape(outline.map(p=>new THREE.Vector2(...p)));shape.closePath();
  if(hole){const path=new THREE.Path(hole.slice().reverse().map(p=>new THREE.Vector2(...p)));path.closePath();shape.holes.push(path);}
  return shape;
}
function plateProfile(parent,m,outline,z,depth,hole){
  const geometry=new THREE.ExtrudeGeometry(profileShape(outline,hole),{depth,steps:1,bevelEnabled:true,bevelSegments:1,bevelSize:.001,bevelThickness:.0007,curveSegments:1});
  geometry.computeBoundingBox();
  const bounds=geometry.boundingBox,span=bounds.getSize(V()),p=geometry.attributes.position,n=geometry.attributes.normal,uv=geometry.attributes.uv;
  for(let i=0;i<p.count;i++){
    const x=(p.getX(i)-bounds.min.x)/span.x,y=(p.getY(i)-bounds.min.y)/span.y,d=(p.getZ(i)-bounds.min.z)/span.z;
    if(Math.abs(n.getZ(i))>.5)uv.setXY(i,x,y);
    else if(Math.abs(n.getX(i))>.5)uv.setXY(i,d,y);
    else uv.setXY(i,x,d);
  }
  return mesh(parent,geometry,m,[0,0,z]);
}
function sidePlate(parent,m,side,x,outline,depth=.005){
  const o=plateProfile(parent,m,outline.map(([z,y])=>[-side*z,y]),0,depth);o.rotation.y=side*Math.PI/2;o.position.x=side*x;return o;
}
function foldedPlate(parent,m,points,thickness=.006){
  const top=points.map(p=>V(...p)),normal=top[1].clone().sub(top[0]).cross(top[2].clone().sub(top[0])).normalize();
  const vertices=[...top,...top.map(p=>p.clone().addScaledVector(normal,-thickness))];
  const triangles=[[0,1,2],[0,2,3],[4,6,5],[4,7,6]];
  for(let i=0;i<4;i++){const j=(i+1)%4;triangles.push([i,i+4,j+4],[i,j+4,j]);}
  const positions=[],uv=[];
  for(const tri of triangles)for(const index of tri){const p=vertices[index];positions.push(...p.toArray());uv.push((p.x+.16)/.32,(p.z+.14)/.34);}
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geometry.computeVertexNormals();
  return mesh(parent,geometry,m);
}
function fastener(parent,m,p,axis='z',r=.0028){
  cylinder(parent,m.dark,p,r*1.4,.0025,axis,16);
  const cap=[...p],index=axis==='x'?0:axis==='y'?1:2;cap[index]+=.0018;
  cylinder(parent,m.steel,cap,r,.0028,axis,6);
}

// Every batch stays under its own rigid joint; nothing is merged across a hinge.
function batchRigid(root){
  root.traverse(group=>{
    if(!group.isGroup)return;
    const batches=new Map();
    for(const child of [...group.children]){
      if(!child.isMesh||child.userData.dynamic||child.material.transparent)continue;
      child.updateMatrix();const geometry=(child.geometry.index?child.geometry.toNonIndexed():child.geometry.clone()).applyMatrix4(child.matrix);
      if(!batches.has(child.material))batches.set(child.material,[]);
      batches.get(child.material).push(geometry);child.geometry.dispose();group.remove(child);
    }
    for(const [material,parts]of batches){
      const geometry=mergeGeometries(parts,false);parts.forEach(p=>p.dispose());
      const result=mesh(group,geometry,material);result.name=material.name;
    }
  });
}

function faceArc(x,y,rx,ry,start=0,end=TAU){
  return Array.from({length:25},(_,i)=>{const a=start+(end-start)*i/24;return [x+Math.cos(a)*rx,y+Math.sin(a)*ry];});
}
function expressionPaths(expression){
  const paths=[];
  for(const side of [-1,1]){
    const x=side*.060;
    if(expression==='happy')paths.push(faceArc(x,.016,.020,.028,0,Math.PI));
    else if(expression==='sad'){
      paths.push(faceArc(x,.025,.017,.024,Math.PI,TAU));
      paths.push([[x+side*.019,.041],[x,.055],[x-side*.016,.057]]);
    }else if(expression==='angry')paths.push([[x+side*.019,.050],[x-side*.018,.026],[x+side*.019,.002]]);
    else if(expression==='sleepy'){
      paths.push([[x-.020,.036],[x+.020,.036]]);
      paths.push(faceArc(x,.021,.018,.017,Math.PI,TAU));
    }else paths.push(faceArc(x,.026,.017,expression==='surprised'?.037:.033));
  }
  if(expression==='happy')paths.push(faceArc(0,-.053,.028,.018,Math.PI,TAU));
  else if(expression==='surprised')paths.push(faceArc(0,-.056,.010,.012));
  else paths.push([[-.018,-.057],[.018,-.057]]);
  return paths;
}
function headAssembly(parent,m){
  const head=new THREE.Group();head.name='Chamfered service droid head';parent.add(head);
  const casing=new THREE.Group();casing.name='Layered head casing';head.add(casing);
  // A hollow octagonal frame, with independent cover plates and a recessed face.
  plateProfile(casing,m.dark,chamferProfile(.115,.103,.027,.014),-.105,.239,chamferProfile(.104,.092,.025,.011));
  plateProfile(casing,m.dark,chamferProfile(.109,.090,.016,.011),.069,.009);
  const faceOuter=chamferProfile(.124,.107,.028,.014),faceInner=chamferProfile(.106,.089,.014,.009);
  plateProfile(casing,m.headPaint,faceOuter,.139,.008,faceInner);
  plateProfile(casing,m.rubber,chamferProfile(.109,.092,.015,.010),.128,.008,chamferProfile(.101,.084,.014,.009));
  plateProfile(casing,m.steel,chamferProfile(.110,.093,.015,.010),.137,.002,chamferProfile(.107,.090,.014,.009));
  // The roof projects well beyond the glass; the two corner facets are actual
  // sloping plates, not rounded corners on a rectangular box.
  const visor=new THREE.Group();visor.name='Projecting visor and diagonal upper corners';head.add(visor);
  foldedPlate(visor,m.headPaint,[[-.088,.140,-.065],[-.095,.114,.180],[.095,.114,.180],[.088,.140,-.065]]);
  foldedPlate(visor,m.headPaint,[[-.088,.140,-.065],[-.121,.108,-.065],[-.128,.086,.174],[-.095,.114,.180]]);
  foldedPlate(visor,m.headPaint,[[.088,.140,-.065],[.095,.114,.180],[.128,.086,.174],[.121,.108,-.065]]);
  rod(visor,m.dark,[-.095,.108,.178],[.095,.108,.178],.0026,8);
  rod(visor,m.steel,[-.094,.114,.181],[.094,.114,.181],.0014,8);
  for(const side of [-1,1]){
    rod(visor,m.dark,[side*.087,.140,-.064],[side*.094,.114,.179],.0011,6);
    for(const z of [-.032,.098])fastener(visor,m,[side*.078,.140-(z+.065)*.106+.0015,z],'y',.0024);
    for(const y of [-.078,.025])fastener(casing,m,[side*.115,y,.150]);
    fastener(casing,m,[side*.095,-.099,.150]);
  }
  const cheek=[[.134,.036],[.073,.097],[-.055,.098],[-.093,.067],[-.091,-.077],[-.061,-.105],[.075,-.100],[.108,-.062]];
  for(const side of [-1,1]){
    const sideModule=new THREE.Group();sideModule.name=(side<0?'Left':'Right')+' geared side module';head.add(sideModule);
    sidePlate(sideModule,m.rubber,side,.110,cheek,.004);
    sidePlate(sideModule,m.headPaint,side,.114,cheek,.005);
    for(const [z,y]of [[.095,.024],[.052,.080],[-.049,.080],[-.074,.052],[-.071,-.071],[.054,-.085]]){
      cylinder(sideModule,m.dark,[side*.121,y,z],.0038,.0028,'x');
      cylinder(sideModule,m.steel,[side*.124,y,z],.0028,.003,'x',6);
    }
    // An octagonal mounting plate, seal, stepped rotor and a bolted hub.
    const mount=Array.from({length:8},(_,i)=>{const a=(i+.5)*TAU/8;return [-.022+Math.cos(a)*.066,-.008+Math.sin(a)*.066];});
    sidePlate(sideModule,m.dark,side,.120,mount,.0025);
    sidePlate(sideModule,m.headPaint,side,.123,mount,.004);
    cylinder(sideModule,m.dark,[side*.129,-.008,-.022],.052,.009,'x',32);
    cylinder(sideModule,m.bright,[side*.135,-.008,-.022],.047,.008,'x',32);
    ring(sideModule,m.dark,[side*.140,-.008,-.022],.044,.0015,'x');
    cylinder(sideModule,m.steel,[side*.141,-.008,-.022],.037,.006,'x',32);
    ring(sideModule,m.bright,[side*.145,-.008,-.022],.033,.0015,'x');
    cylinder(sideModule,m.brass,[side*.146,-.008,-.022],.018,.004,'x',24);
    cylinder(sideModule,m.dark,[side*.149,-.008,-.022],.007,.003,'x',12);
    for(let i=0;i<12;i++){
      const a=i*TAU/12,y=-.008+Math.sin(a)*.040,z=-.022+Math.cos(a)*.040;
      cylinder(sideModule,m.dark,[side*.140,y,z],.0021,.003,'x',6);
    }
    for(let i=0;i<8;i++){
      const a=(i+.5)*TAU/8,y=-.008+Math.sin(a)*.058,z=-.022+Math.cos(a)*.058;
      cylinder(sideModule,m.dark,[side*.128,y,z],.0033,.003,'x',16);
      cylinder(sideModule,m.brass,[side*.130,y,z],.0021,.0025,'x',6);
    }
    for(const y of [-.059,-.082]){
      cylinder(sideModule,m.brass,[side*.124,y,-.087],.006,.015,'x',12);
      tube(sideModule,m.rubber,[[side*.130,y,-.087],[side*.130,y-.014,-.115],[side*.102,y-.018,-.125]],.004);
    }
    // A short rear access cover leaves a wiring channel beside the side housing.
    sidePlate(sideModule,m.headPaint,side,.103,[[-.095,.079],[-.118,.065],[-.120,-.059],[-.095,-.077]],.007);
    for(const y of [-.053,.056])cylinder(sideModule,m.brass,[side*.114,y,-.108],.0028,.003,'x',6);
  }
  const rear=new THREE.Group();rear.name='Rear service cover, heat sink and wiring';head.add(rear);
  plateProfile(rear,m.dark,chamferProfile(.101,.090,.019,.015),-.116,.008);
  plateProfile(rear,m.headPaint,chamferProfile(.083,.079,.013,.010),-.125,.006);
  box(rear,m.dark,[0,.022,-.131],[.113,.063,.006],.002);
  for(let i=0;i<7;i++)box(rear,m.steel,[0,-.002+i*.008,-.137],[.106,.0028,.014],.001);
  for(const x of [-.071,.071])for(const y of [-.064,.064]){
    cylinder(rear,m.dark,[x,y,-.129],.0038,.003,'z');
    cylinder(rear,m.steel,[x,y,-.132],.0025,.003,'z',6);
  }
  box(rear,m.steel,[0,-.049,-.131],[.076,.027,.004],.002);
  for(let i=0;i<5;i++)box(rear,m.dark,[-.026+i*.012,-.049,-.134],[.003,.013,.001],.0003);
  for(const side of [-1,1]){
    for(let i=0;i<3;i++){
      const x=side*(.085+i*.006);
      tube(rear,i===1?m.copper:m.rubber,[[x,.080,-.106],[x+side*.003,.055,-.124],[x+side*.003,-.044,-.125],[side*.075,-.092,-.109]],i===1?.0027:.0022);
    }
    cylinder(rear,m.brass,[side*.084,-.079,-.120],.007,.011,'z',12);
    tube(rear,m.copper,[[side*.084,-.079,-.125],[side*.086,-.107,-.125],[side*.052,-.120,-.083]],.004);
    tube(rear,m.rubber,[[side*.070,.105,-.052],[side*.088,.130,-.058],[side*.097,.117,-.092],[side*.102,.074,-.112]],.005);
  }
  // Low lifting rail and its fittings replace the oversized suitcase handle.
  tube(head,m.dark,[[-.067,.136,-.041],[-.067,.153,-.041],[.067,.153,-.041],[.067,.136,-.041]],.0045);
  for(const side of [-1,1]){
    box(head,m.steel,[side*.068,.138,-.043],[.018,.007,.028],.002);
    for(const z of [-.052,-.034])fastener(head,m,[side*.068,.143,z],'y',.0020);
  }
  cylinder(head,m.brass,[.044,.153,-.041],.006,.013,'x',12);
  const base=new THREE.Group();base.name='Underside neck mount and connectors';head.add(base);
  box(base,m.dark,[0,-.110,-.026],[.130,.016,.110],.008);
  box(base,m.steel,[0,-.120,-.026],[.078,.012,.075],.004);
  cylinder(base,m.dark,[0,-.123,-.025],.036,.010,'y',24);
  ring(base,m.brass,[0,-.128,-.025],.027,.002,'y');
  for(const side of [-1,1]){
    box(base,m.headPaint,[side*.071,-.110,-.054],[.029,.023,.049],.003);
    for(const z of [-.063,-.043])cylinder(base,m.dark,[side*.071,-.124,z],.003,.003,'y',6);
    cylinder(base,m.brass,[side*.090,-.110,.032],.007,.014,'y',12);
    tube(base,m.rubber,[[side*.091,-.108,.032],[side*.097,-.125,.017],[side*.060,-.125,-.025]],.0035);
    box(base,m.dark,[side*.044,-.117,.058],[.024,.015,.015],.002);
    for(const x of [-.004,.004])cylinder(base,m.brass,[side*.044+x,-.126,.058],.0018,.006,'y',8);
  }
  const eyes=[];
  for(const side of [-1,1]){
    const eye=new THREE.Group();eye.name=side<0?'Left glass eye tube':'Right glass eye tube';eye.position.set(side*.048,.022,.108);head.add(eye);eyes.push(eye);
    cylinder(eye,m.dark,[0,-.065,0],.028,.010,'y',24);
    ring(eye,m.dark,[0,-.060,0],.025,.0015,'y');
    const bulbProfile=[[0,-.060],[.024,-.060],[.030,-.054],[.031,.045],[.028,.056],[.020,.061],[0,.062]].map(p=>new THREE.Vector2(...p));
    const bulb=mesh(eye,new THREE.LatheGeometry(bulbProfile,24),m.glass);bulb.scale.z=.58;
    mesh(eye,new THREE.PlaneGeometry(.072,.127),m.halo,[0,0,.006]);
    for(let j=0;j<7;j++)rod(eye,m.copper,[-.022+j*.0073,-.050,-.005],[-.022+j*.0073,.050,-.005],.00035,5);
    for(let j=0;j<9;j++)rod(eye,m.copper,[-.026,-.047+j*.012,-.004],[.026,-.047+j*.012,-.004],.0003,5);
    for(let j=0;j<4;j++){
      tube(eye,m.copper,[[-.020,-.044+j*.018,-.007],[.021,-.031+j*.018,-.007],[-.019,-.018+j*.018,-.007]],.0003);
    }
    for(const x of [-.016,0,.016])rod(eye,m.brass,[x,-.077,0],[x,-.061,0],.0010,6);
  }
  const mouth=new THREE.Group();mouth.name='Horizontal mouth tube and black socket';mouth.position.set(0,-.065,.116);head.add(mouth);
  const mouthProfile=[[0,-.038],[.012,-.038],[.016,-.029],[.018,-.022],[.018,.022],[.016,.029],[.012,.038],[0,.038]].map(p=>new THREE.Vector2(...p));
  const mouthBulb=mesh(mouth,new THREE.LatheGeometry(mouthProfile,24),m.glass);mouthBulb.rotation.z=Math.PI/2;mouthBulb.scale.z=.7;
  box(mouth,m.dark,[0,-.014,-.011],[.075,.008,.010],.002);
  for(const side of [-1,1]){
    cylinder(mouth,m.dark,[side*.038,0,0],.013,.006,'x',24);
    ring(mouth,m.dark,[side*.035,0,0],.012,.0012,'x');
    for(const y of [-.005,.005])rod(mouth,m.dark,[side*.041,y,0],[side*.047,y,0],.0009,6);
  }
  for(let i=0;i<7;i++)rod(mouth,m.copper,[-.024+i*.008,-.011,-.004],[-.024+i*.008,.011,-.004],.0003,5);
  for(const y of [-.009,0,.009])rod(mouth,m.copper,[-.026,y,-.004],[.026,y,-.004],.0003,5);
  mesh(head,new THREE.PlaneGeometry(.072,.050),m.halo,[0,-.060,.123]);
  const glass=new THREE.Mesh(new THREE.ShapeGeometry(profileShape(chamferProfile(.100,.082,.012,.008))),m.window);glass.position.z=.140;head.add(glass);
  const expressions={};
  for(const expression of Object.keys(DROID_EXPRESSIONS)){
    const group=new THREE.Group();group.name='Face expression / '+expression;head.add(group);expressions[expression]=group;
    for(const points of expressionPaths(expression)){
      const path=points.map(([x,y])=>[x*.8,y<-.030?y-.005:y,.127]);
      const core=tube(group,m.amber,path,.00125),glow=tube(group,m.glow,path,.0038);
      core.castShadow=false;glow.castShadow=false;
    }
  }
  let current='neutral';
  function setExpression(value){
    if(!Object.hasOwn(expressions,value))return false;
    current=value;for(const [name,group]of Object.entries(expressions))group.visible=name===value;
    return true;
  }
  setExpression(current);
  return {head,face:{eyes,expressions,setExpression,get expression(){return current;}}};
}

function limb(parent,m,length,kind,side){
  const g=new THREE.Group();g.name=kind;parent.add(g);
  const leg=kind.includes('leg'),width=leg?.046:.032;
  bearing(g,m,[0,0,0],leg?.042:.034,leg?.082:.07);
  for(const x of [-width,width]){
    rod(g,m.dark,[x,-.035,0],[x,-length+.035,0],.010);
    rod(g,m.bright,[x*.75,-.072,.020],[x*.75,-length+.062,.020],.005);
  }
  cylinder(g,m.steel,[0,-length*.46,.022],leg?.025:.019,length*.46);
  cylinder(g,m.bright,[0,-length*.79,.022],leg?.013:.010,length*.29);
  for(const y of [-length*.23,-length*.67])cylinder(g,m.dark,[0,y,.022],leg?.028:.022,.016);
  const plate=panel(g,m,[side*width*.7,-length*.44,.049],[leg?.070:.057,length*.43,.021]);plate.rotation.z=side*.035;
  tube(g,m.copper,[[side*width,-.035,-.01],[side*(width+.012),-length*.28,-.035],[side*(width+.019),-length*.74,-.028],[side*width,-length+.025,0]],.005);
  tube(g,m.rubber,[[-side*width,-.035,-.015],[-side*(width+.025),-length*.2,-.039],[-side*(width+.025),-length*.7,-.032],[-side*width,-length+.03,-.01]],.006);
  for(const y of [-length*.26,-length*.64])box(g,m.steel,[0,y,-.006],[width*2+.028,.018,.038],.003);
  if(kind==='Forearm'){
    // Axial wrist swivel lets the palm turn without rotating the elbow hinge.
    cylinder(g,m.dark,[0,-length+.016,0],.026,.022);
    ring(g,m.bright,[0,-length+.012,0],.024,.003,'y');
  }
  return g;
}
function kneeLink(parent,m,side){
  const g=new THREE.Group();g.name='Knee to reverse hock link';parent.add(g);
  const length=DROID_SPEC.middleLeg;
  // Short fork between two distinct hinges, as in the reference's three-part leg.
  bearing(g,m,[0,0,0],.047,.104);
  for(const x of [-.046,.046]){
    box(g,m.paint,[x,-length/2,0],[.018,length-.075,.074],.007);
    for(const y of [-.061,-length+.061]){
      cylinder(g,m.dark,[x+Math.sign(x)*.012,y,0],.011,.009,'x',6);
      cylinder(g,m.bright,[x+Math.sign(x)*.018,y,0],.004,.006,'x',6);
    }
  }
  for(const z of [-.031,.031])rod(g,m.dark,[0,-.038,z],[0,-length+.037,z],.009);
  for(const y of [-.078,-length+.077])rod(g,m.steel,[-.052,y,0],[.052,y,0],.010);
  tube(g,m.copper,[[side*.060,-.021,-.014],[side*.070,-.075,-.047],[side*.073,-.20,-.050],[side*.059,-length+.015,-.008]],.006);
  return g;
}
function hand(parent,m,side){
  const g=new THREE.Group();g.name=(side<0?'Left':'Right')+' service hand';parent.add(g);
  bearing(g,m,[0,0,0],.022,.051);
  box(g,m.steel,[0,-.041,0],[.074,.071,.036],.009);
  panel(g,m,[0,-.039,-.018],[.064,.054,.012]);
  const fingers=[];
  for(let i=0;i<4;i++){
    const chain=[],base=new THREE.Group();base.position.set((i-1.5)*.020,-.076,0);g.add(base);let joint=base;
    for(let j=0;j<3;j++){
      const len=(j===0?.027:j===1?.023:.019)*(i===0||i===3?.87:1);
      cylinder(joint,m.dark,[0,0,0],.008,.015,'x',10);
      box(joint,m.steel,[0,-len/2,0],[.013,len-.005,.015],.003);
      if(j===2)box(joint,m.rubber,[0,-len*.68,.006],[.012,len*.60,.008],.003);
      chain.push(joint);const next=new THREE.Group();next.position.y=-len;joint.add(next);joint=next;
    }
    fingers.push(chain);
  }
  const thumb=new THREE.Group();thumb.position.set(side*.044,-.021,.004);thumb.rotation.z=side*.7;g.add(thumb);
  for(let j=0;j<2;j++){
    box(thumb,j?m.rubber:m.steel,[side*j*.014,-.024-j*.016,.007+j*.012],[.022,.036,.019],.005);
    cylinder(thumb,m.dark,[side*j*.014,-.008-j*.02,.007],.009,.018,'x');
  }
  const grip=new THREE.Object3D();grip.name='Palm contact';grip.position.set(0,-.082,.018);g.add(grip);
  const carryGrip=new THREE.Object3D();carryGrip.name='Palm side contact';carryGrip.position.set(0,-.041,.018);g.add(carryGrip);
  // Centre of a 28 mm rung, inside the curled fingers (not the palm surface).
  const ladderGrip=new THREE.Object3D();ladderGrip.name='Rung contact';ladderGrip.position.set(0,-.076,.036);g.add(ladderGrip);
  return {root:g,fingers,thumb,grip,carryGrip,ladderGrip};
}
function foot(parent,m,side){
  const g=new THREE.Group();g.name='Grounded foot';parent.add(g);
  // A low heel, two forward toes and rubber pads, rather than a human boot.
  box(g,m.dark,[0,-.078,.035],[.147,.040,.274],.013);
  box(g,m.paint,[0,-.05,-.039],[.141,.032,.131],.012);
  for(const x of [-.038,.038]){
    box(g,m.paint,[x,-.047,.111],[.065,.039,.139],.010);
    box(g,m.rubber,[x,-.094,.118],[.060,.009,.121],.005);
    for(const z of [.079,.146])cylinder(g,m.dark,[x,-.024,z],.007,.006,'y',6);
  }
  box(g,m.rubber,[0,-.094,-.054],[.122,.009,.08],.004);
  bearing(g,m,[0,0,0],.032,.077);
  rod(g,m.steel,[side*.035,.005,-.015],[side*.052,-.047,-.077],.012);
  rod(g,m.steel,[-side*.035,.005,-.015],[-side*.052,-.047,-.077],.012);
  return g;
}

function trayAssembly(parent,m){
  const g=new THREE.Group();g.name='Service tray';parent.add(g);
  box(g,m.steel,[0,0,0],[.52,.018,.29],.013);
  box(g,m.rubber,[0,.011,0],[.46,.003,.235],.006);
  for(const x of [-1,1]){
    rod(g,m.bright,[x*.257,.022,-.085],[x*.257,.022,.085],.006);
    for(const z of [-.085,.085])rod(g,m.steel,[x*.242,0,z],[x*.283,.034,z],.006);
    rod(g,m.dark,[x*.283,.034,-.085],[x*.283,.034,.085],.009);
  }
  // Cup with an actual open rim, inner surface and a handle.
  const cup=new THREE.Group();cup.position.set(-.115,.014,.009);g.add(cup);
  const profile=[[0,0],[.030,0],[.036,.01],[.039,.085],[.035,.089],[.031,.082],[.028,.011],[0,.011]].map(p=>new THREE.Vector2(...p));
  mesh(cup,new THREE.LatheGeometry(profile,24),m.ceramic);
  tube(cup,m.ceramic,[[.031,.070,0],[.065,.071,0],[.068,.035,0],[.035,.028,0]],.006);
  cylinder(cup,m.copper,[0,.071,0],.031,.001,'y',24);
  for(let i=0;i<3;i++)box(g,m.cloth,[.095,.024+i*.015,0],[.15,.015,.16],.008);
  for(let i=0;i<5;i++)rod(g,m.ceramic,[.025,.063+i*.0004,-.061+i*.029],[.167,.063+i*.0004,-.061+i*.029],.00065,5);
  return g;
}

// Solve both rigid links exactly; the bend pole sets the exposed elbow/knee side.
export function solveDroidLimb(origin,target,upper,lower,pole){
  const axis=target.clone().sub(origin),distance=clamp(axis.length(),Math.abs(upper-lower)+1e-5,upper+lower-1e-5);axis.normalize();
  const along=(upper*upper-lower*lower+distance*distance)/(2*distance);
  const bend=pole.clone().addScaledVector(axis,-pole.dot(axis)).normalize();
  return origin.clone().addScaledVector(axis,along).addScaledVector(bend,Math.sqrt(Math.max(0,upper*upper-along*along)));
}
function solveDroidLeg(origin,target){
  const axis=target.clone().sub(origin).normalize();
  const forward=V(0,0,1).addScaledVector(axis,-axis.z).normalize();
  // The thigh leans toward the toe; the second hinge folds back. This extra
  // degree of freedom remains deterministic when scrubbing the walk cycle.
  const knee=origin.clone().addScaledVector(axis,DROID_SPEC.upperLeg*Math.cos(.43))
    .addScaledVector(forward,DROID_SPEC.upperLeg*Math.sin(.43));
  const hock=solveDroidLimb(knee,target,DROID_SPEC.middleLeg,DROID_SPEC.lowerLeg,V(0,0,-1));
  return {knee,hock};
}
function orient(group,start,end){group.position.copy(start);group.quaternion.setFromUnitVectors(DOWN,end.clone().sub(start).normalize());}

// Small walking circuit. A stance foot stays at its world touchdown position.
const PATH_RADIUS=.56,PATH_RATE=.38;
function pathPose(time){const a=time*PATH_RATE;return {x:PATH_RADIUS*Math.sin(a),z:PATH_RADIUS*Math.cos(a),yaw:a+Math.PI/2};}
function landing(time,side){const p=pathPose(time),local=V(side*.137,.099,.10);local.applyAxisAngle(UP,p.yaw);return {point:local.add(V(p.x,0,p.z)),yaw:p.yaw};}
export function droidFootstep(time,side){
  const period=DROID_SPEC.stepPeriod,shift=side<0?period*.5:0;
  const cycle=Math.floor((time+shift)/period),phase=(time+shift)/period-cycle;
  const first=landing(cycle*period-shift,side),next=landing((cycle+1)*period-shift,side);
  if(phase<DROID_SPEC.stance)return {...first,stance:true,phase};
  const u=(phase-DROID_SPEC.stance)/(1-DROID_SPEC.stance),blend=u*u*(3-2*u);
  return {point:first.point.lerp(next.point,blend).add(V(0,.082*Math.sin(Math.PI*u),0)),yaw:THREE.MathUtils.lerp(first.yaw,next.yaw,blend),stance:false,phase};
}

function buildDroidDetailed(){
  const root=new THREE.Group();root.name='Household support droid 3817';const m=palette();
  const chassis=new THREE.Group();chassis.name='Torso chassis';root.add(chassis);
  cylinder(chassis,m.dark,[0,.245,-.035],.039,.49);
  for(let i=0;i<7;i++){
    cylinder(chassis,i%2?m.steel:m.dark,[0,.10+i*.051,-.035],.052,.025);
    for(const side of [-1,1])rod(chassis,m.steel,[0,.105+i*.05,-.03],[side*(.095+i*.009),.13+i*.05,.025],.007);
  }
  box(chassis,m.dark,[0,.035,0],[.245,.095,.115],.015);
  for(const side of [-1,1]){
    bearing(chassis,m,[side*.125,0,0],.047,.065);
    panel(chassis,m,[side*.084,.064,.065],[.074,.104,.024]);
    rod(chassis,m.dark,[side*.092,.03,-.035],[side*.146,.46,-.039],.016);
    rod(chassis,m.bright,[side*.076,.16,.051],[side*.108,.395,.054],.010);
    cylinder(chassis,m.steel,[side*.076,.16,.051],.019,.103);
    tube(chassis,m.copper,[[side*.148,.46,-.05],[side*.12,.49,.064],[side*.09,.28,.095],[side*.115,.105,.068],[side*.03,-.02,.088]],.008);
    tube(chassis,m.rubber,[[side*.12,.49,-.07],[side*.154,.44,-.01],[side*.150,.18,-.026],[side*.075,.035,-.07]],.010);
    tube(chassis,m.brass,[[side*.125,.44,.067],[side*.15,.40,.082],[side*.15,.25,.08],[side*.03,.11,.06]],.004);
  }
  rod(chassis,m.dark,[-DROID_SPEC.shoulderHalfWidth,.47,0],[DROID_SPEC.shoulderHalfWidth,.47,0],.027);
  panel(chassis,m,[-.072,.341,.071],[.103,.246,.032]);
  panel(chassis,m,[.098,.33,.068],[.058,.181,.038]);
  box(chassis,m.dark,[0,.326,.092],[.027,.073,.017],.003);
  for(let i=0;i<4;i++)box(chassis,i===0?m.amber:m.brass,[-.001,.35-i*.015,.103],[.013,.004,.003],.001);
  panel(chassis,m,[0,.306,-.156],[.242,.294,.080]);
  for(const side of [-1,1]){
    box(chassis,m.steel,[side*.113,.32,-.204],[.023,.234,.014],.003);
    for(const y of [.221,.421])cylinder(chassis,m.dark,[side*.107,y,-.218],.009,.013,'z',6);
    tube(chassis,m.dark,[[side*.074,.465,-.13],[side*.075,.52,-.18],[side*.104,.51,-.24],[side*.14,.31,-.24],[side*.111,.15,-.17]],.011);
  }
  for(let i=0;i<7;i++)box(chassis,m.dark,[0,.32+i*.019,-.201],[.151,.007,.006],.002);
  cylinder(chassis,m.steel,[0,.509,-.027],.027,.080);
  for(let i=0;i<3;i++)cylinder(chassis,m.dark,[0,.487+i*.019,-.027],.037,.009);
  for(const side of [-1,1]){
    rod(chassis,m.bright,[side*.062,.469,-.012],[side*.055,.551,-.034],.009);
    tube(chassis,m.copper,[[side*.08,.441,.06],[side*.087,.506,.045],[side*.060,.544,.023],[side*.07,.603,-.07]],.007);
    tube(chassis,m.rubber,[[side*.085,.45,-.09],[side*.085,.515,-.12],[side*.073,.585,-.1]],.010);
  }
  const neckPivot=new THREE.Group();neckPivot.name='Head support pivot';neckPivot.position.set(0,.542,-.015);chassis.add(neckPivot);
  const {head,face}=headAssembly(neckPivot,m);head.position.set(0,.125,.040);
  const arms=[],legs=[];
  for(const side of [-1,1]){
    const upper=limb(root,m,DROID_SPEC.upperArm,'Upper arm',side),lower=limb(root,m,DROID_SPEC.forearm,'Forearm',side),palm=hand(root,m,side);
    arms.push({side,upper,lower,palm});
    const thigh=limb(root,m,DROID_SPEC.upperLeg,'Upper leg / forward thigh',side),middle=kneeLink(root,m,side);
    const shin=limb(root,m,DROID_SPEC.lowerLeg,'Lower leg / reverse hock',side),shoe=foot(root,m,side);
    legs.push({side,upper:thigh,middle,lower:shin,foot:shoe});
  }
  const tray=trayAssembly(root,m);tray.position.set(0,1.058,.421);
  const actuators=[];
  function actuator(startGroup,start,endGroup,end,radius){
    const housing=mesh(root,new THREE.CylinderGeometry(radius,radius,1,12),m.steel),shaft=mesh(root,new THREE.CylinderGeometry(radius*.51,radius*.51,1,10),m.bright);
    housing.userData.dynamic=shaft.userData.dynamic=true;
    const a=new THREE.Object3D(),b=new THREE.Object3D();a.position.set(...start);b.position.set(...end);startGroup.add(a);endGroup.add(b);
    actuators.push({a,b,housing,shaft});
  }
  for(const a of arms)actuator(a.upper,[a.side*.055,-.115,-.025],a.lower,[a.side*.044,-.13,-.015],.015);
  for(const l of legs){
    actuator(l.upper,[l.side*.075,-.19,-.025],l.middle,[l.side*.075,-.095,-.025],.019);
    actuator(l.middle,[l.side*.077,-.19,.030],l.lower,[l.side*.077,-.125,.028],.018);
  }
  batchRigid(root);
  return {root,m,chassis,neckPivot,head,face,arms,legs,tray,actuators};
}

export function createDroid({detail='study'}={}){
  const low=detail==='obs';
  const {root,m,chassis,neckPivot,head,face,arms,legs,tray,actuators}=low?createDroidLowParts(DROID_SPEC,DROID_EXPRESSIONS,expressionPaths):buildDroidDetailed();
  root.userData.droidDetail=low?'obs':'study';
  root.userData.toonOutlineWidth=1.2; // Match Milo and Lucy at every camera distance.
  const poweredMeshes=[];
  root.traverse(o=>{if(o.isMesh&&[m.amber,m.halo,m.glow].includes(o.material))poweredMeshes.push(o);});
  const poweredMaterials=[m.amber,m.halo,m.glow].filter(Boolean).map(material=>({material,color:material.color.clone()}));
  function update(time=0,mode='idle',pose={}){
    time=Number.isFinite(time)?Math.max(0,time):0;
    const wakeAge=pose.wakeAge??(mode==='wake'?time:null),waking=Number.isFinite(wakeAge);
    const walk=mode==='walk',carry=mode==='carry',rest=pose.rest??(mode==='charging'?1:waking?1-THREE.MathUtils.smoothstep(wakeAge,0,DROID_STARTUP_SECONDS):0),charging=rest>=.98;const route=walk?pathPose(time):{x:0,z:0,yaw:0};
    const facePower=waking?droidStartupLight(wakeAge):charging?0:1;
    const walkAmount=pose.walkAmount??(walk?1:0),walkPhase=pose.walkPhase??time/DROID_SPEC.stepPeriod;
    root.position.set(route.x,0,route.z);root.rotation.y=route.yaw;
    const bob=walk?.006*Math.cos(TAU*time/DROID_SPEC.stepPeriod*2):0;
    const lean=THREE.MathUtils.lerp(DROID_POSTURE.idleLean,DROID_POSTURE.walkLean,walkAmount);
    chassis.position.set(pose.bodyX??0,pose.hipHeight??THREE.MathUtils.lerp(.905+bob,.837,rest),pose.bodyZ??THREE.MathUtils.lerp(DROID_POSTURE.bodyZ,-.028,rest));chassis.rotation.set(pose.lean??THREE.MathUtils.lerp(lean,.11,rest),0,0);
    neckPivot.rotation.set(pose.nod??THREE.MathUtils.lerp(-lean*.6,.63,rest),0,-.055*rest);
    // Blend out of the resting head pose instead of snapping at the power threshold.
    head.rotation.set(THREE.MathUtils.lerp(-.025+(carry?.055:Math.sin(time*.62)*.014),.025,rest),THREE.MathUtils.lerp(Math.sin(time*.38)*.11,-.055,rest),Math.sin(time*.29)*.012*(1-rest));
    poweredMeshes.forEach(mesh=>mesh.visible=facePower>0);
    for(const {material,color}of poweredMaterials)material.color.copy(color).multiplyScalar(facePower);
    const fromChassis=point=>point.applyQuaternion(chassis.quaternion).add(chassis.position);
    const feet=[];
    for(const l of legs){
      const origin=fromChassis(V(l.side*.125,0,0));
      const step=walk?droidFootstep(time,l.side):{point:V(l.side*.137,.099,.045),yaw:0,stance:true};
      const target=pose.feet?.[l.side<0?0:1]?V(...pose.feet[l.side<0?0:1]):step.point.clone().sub(root.position).applyAxisAngle(UP,-route.yaw);
      const {knee,hock}=solveDroidLeg(origin,target);
      orient(l.upper,origin,knee);orient(l.middle,knee,hock);orient(l.lower,hock,target);
      l.foot.position.copy(target);l.foot.rotation.set(0,pose.footYaws?.[l.side<0?0:1]??step.yaw-route.yaw,0);
      feet.push({...step,local:target.clone(),knee:knee.clone(),hock:hock.clone(),hip:origin.clone()});
    }
    tray.visible=carry;tray.position.y=1.058+bob;
    const hands=[];
    for(const a of arms){
      const origin=fromChassis(V(a.side*DROID_SPEC.shoulderHalfWidth,.47,0));
      const index=a.side<0?0:1,contact=pose.hands?.[index],handWeight=contact?(pose.handWeight??1):carry?1:0;
      // Swing from the shoulder with a flexed elbow. The ipsilateral hand moves
      // back as its foot lands forward; the wrist follows the forearm, palm in.
      const swing=Math.cos(TAU*(walkPhase+(a.side<0?.5:0)))*walkAmount;
      const upperPitch=.13+.30*swing,flex=.53+.13*walkAmount-.05*swing,lowerPitch=upperPitch-flex;
      const upperLength=Math.sqrt(DROID_SPEC.upperArm**2-.037**2),lowerLength=Math.sqrt(DROID_SPEC.forearm**2-.01**2);
      const freeElbow=origin.clone().add(V(a.side*.037,-upperLength*Math.cos(upperPitch),-upperLength*Math.sin(upperPitch)));
      const freeWrist=freeElbow.clone().add(V(a.side*.01,-lowerLength*Math.cos(lowerPitch),-lowerLength*Math.sin(lowerPitch)));
      const freeQ=new THREE.Quaternion().setFromAxisAngle(V(1,0,0),lowerPitch).multiply(new THREE.Quaternion().setFromAxisAngle(UP,-a.side*Math.PI/2));
      const q=freeQ.clone();
      const gripKind=pose.gripKinds?.[index]??pose.gripKind;
      if(handWeight){
        const workingQ=pose.wristQuaternions?.[index]?new THREE.Quaternion().fromArray(pose.wristQuaternions[index]):new THREE.Quaternion().setFromEuler(new THREE.Euler(...(pose.wristRotation??[-Math.PI/2,0,0])));
        q.slerp(workingQ,handWeight);
      }
      if(charging)q.setFromAxisAngle(UP,-a.side*Math.PI/2).multiply(new THREE.Quaternion().setFromAxisAngle(V(1,0,0),.32));
      let wrist=freeWrist.clone();
      if(contact){
        const grip=gripKind==='ladder'?a.palm.ladderGrip:gripKind==='carry'?a.palm.carryGrip:a.palm.grip;
        wrist.lerp(V(...contact).sub(grip.position.clone().applyQuaternion(q)),handWeight);
      }else if(carry){
        const contact=V(a.side*.283,tray.position.y+.034,tray.position.z);
        wrist=contact.clone().sub(a.palm.grip.position.clone().applyQuaternion(q));
      }else if(charging){
        wrist=origin.clone().add(V(a.side*.035,-.587,.026));
      }
      // Physical reach limit: never stretch a rigid forearm to reach a prop.
      const reach=wrist.clone().sub(origin),limit=DROID_SPEC.upperArm+DROID_SPEC.forearm-.004;
      if(reach.length()>limit)wrist.copy(origin).add(reach.setLength(limit));
      const workingPole=gripKind==='ladder'?V(a.side*.18,-1,-.55):V(a.side,0,-.6);
      const pole=freeElbow.clone().sub(origin).normalize().lerp(workingPole.normalize(),handWeight);
      const elbow=solveDroidLimb(origin,wrist,DROID_SPEC.upperArm,DROID_SPEC.forearm,charging?V(a.side*.55,0,-1):pole);
      orient(a.upper,origin,elbow);orient(a.lower,elbow,wrist);a.palm.root.position.copy(wrist);a.palm.root.quaternion.copy(q);
      const curl=gripKind==='ladder'?[.4,.7,.62]:gripKind==='carry'?[.08,.6,.65]:[.25,1.1,.95],gripWeight=handWeight*(pose.handGripWeights?.[index]??1);
      for(const [finger,chain]of a.palm.fingers.entries())chain.forEach((joint,j)=>joint.rotation.x=-(charging?[.08,.18,.14][j]+finger*.015:THREE.MathUtils.lerp([.16,.28,.21][j],curl[j],gripWeight)));
      a.palm.thumb.rotation.z=a.side*(charging?.48:.7);
      hands.push({shoulder:origin,elbow,wrist});
    }
    root.updateMatrixWorld(true);
    for(const p of actuators){
      const a=root.worldToLocal(p.a.getWorldPosition(V())),b=root.worldToLocal(p.b.getWorldPosition(V())),d=b.clone().sub(a),length=d.length();d.normalize();
      for(const [part,from,to]of [[p.housing,0,.58],[p.shaft,.52,1]]){
        part.position.copy(a).addScaledVector(d,length*(from+to)/2);part.scale.y=length*(to-from);part.quaternion.setFromUnitVectors(UP,d);
      }
    }
    root.updateMatrixWorld(true);return {mode,powered:facePower>0,facePower,feet,hands};
  }
  update(0);
  const skin=low?batchDroidLow(root,m.body):null;
  function dispose(){
    const geometries=new Set();root.traverse(o=>{if(o.geometry)geometries.add(o.geometry);});geometries.forEach(g=>g.dispose());
    Object.values(m).forEach(v=>v.dispose?.());
    skin?.skeleton.dispose();
  }
  return {root,head,face,neckPivot,chassis,arms,legs,tray,actuators,skin,update,dispose};
}
