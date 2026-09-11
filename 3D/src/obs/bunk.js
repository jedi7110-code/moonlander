import * as THREE from 'three';
import {box,cylinder,pipe,rod} from './materials.js';
import {BUNK_BED,BUNK_TRAY} from './recline.js';

export const BUNK_DOME={length:2.42,width:1.36,height:.62,rim:.67,angle:.43,cap:.35,lift:.56};
const CLEAR_GLASS=new THREE.Color(0xb9d6cf),SMOKED_GLASS=new THREE.Color(0x18231f);

function capsuleRings(){
  const d=BUNK_DOME,rings=[],steps=16;
  for(let i=0;i<=steps;i++){const a=i/steps*Math.PI/2;rings.push([d.cap*(1-Math.cos(a)),Math.sin(a)]);}
  for(let i=1;i<=24;i++)rings.push([d.cap+(d.length-2*d.cap)*i/24,1]);
  for(let i=1;i<=steps;i++){const a=i/steps*Math.PI/2;rings.push([d.length-d.cap+d.cap*Math.sin(a),Math.cos(a)]);}
  return rings;
}

export function createCapsuleGlazing(){
  const d=BUNK_DOME,rings=capsuleRings(),vertices=[],normals=[],indices=[],na=40;
  for(const [x,radius]of rings)for(let j=0;j<=na;j++){
    const a=j/na*Math.PI,y=Math.sin(a)*d.height*radius,z=Math.cos(a)*d.width/2*radius;
    vertices.push(x,y,z);
    // Analytic normals join the ellipsoidal ends smoothly to the cylindrical center.
    const nx=x<d.cap?(x-d.cap)/d.cap**2:x>d.length-d.cap?(x-d.length+d.cap)/d.cap**2:0;
    const normal=new THREE.Vector3(nx,y/d.height**2,z/(d.width/2)**2).normalize();normals.push(...normal.toArray());
  }
  for(let i=0;i<rings.length-1;i++)for(let j=0;j<na;j++){
    const a=i*(na+1)+j,b=a+na+1;
    if(i>0)indices.push(a,b,a+1);
    if(i<rings.length-2)indices.push(b,b+1,a+1);
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));geometry.setIndex(indices);
  return geometry;
}

export function createBunk(m){
  const root=new THREE.Group();root.name='Sleeping capsule';
  const {depth,top,length,width}=BUNK_BED,d=BUNK_DOME;
  box(root,m.dark,0,.18,depth,2.5,.20,1.36,.04).name='Fixed capsule plinth';
  const tray=new THREE.Group();tray.name='Sliding sleep tray';root.add(tray);
  box(tray,m.metal,0,.345,depth,2.40,.07,1.31,.035).name='Tray pan';
  box(tray,m.cushion,0,.45,depth,length,.18,width,.07).name='Tray mattress';
  box(tray,m.olive,.32,top-.05,depth+.01,1.60,.10,1.13,.03).name='Tray blanket';
  box(tray,m.cloth,-.87,.59,depth,.47,.18,.91,.08).name='Tray pillow';
  for(let i=0;i<10;i++)rod(tray,m.olive,[-.36+i*.14,.597,depth-.53],[-.34+i*.14,.60,depth+.51],.008);
  const runners=new THREE.Group();runners.name='Telescoping bed rails';root.add(runners);
  for(const x of [-.86,.86]){
    box(root,m.dark,x,.285,depth,.12,.10,1.21,.012);
    box(runners,m.metal,x,.295,depth+.05,.082,.065,1.12,.008);
    box(tray,m.metal,x,.30,depth+.04,.048,.04,1.04,.005);
    for(const z of [depth-.35,depth+.43]){
      const roller=cylinder(runners,m.black,x,.30,z,.045,.095);roller.rotation.z=Math.PI/2;
    }
  }
  box(root,m.dark,-1.30,.47,depth,.10,.30,.55,.035);
  const hingeCarriage=new THREE.Group();hingeCarriage.name='Elevating head hinge';root.add(hingeCarriage);
  const lid=new THREE.Group();lid.name='Head-hinged glass dome';lid.position.set(-d.length/2,d.rim,depth);hingeCarriage.add(lid);
  const glass=new THREE.MeshPhysicalMaterial({color:CLEAR_GLASS,metalness:.04,roughness:.10,transparent:true,opacity:.13,side:THREE.DoubleSide,depthWrite:false,clearcoat:1,envMapIntensity:.35});
  const shell=new THREE.Mesh(createCapsuleGlazing(),glass);shell.name='Capsule glazing';lid.add(shell);
  const rings=capsuleRings(),outline=[...rings.map(([x,r])=>[x,0,r*d.width/2]),...rings.slice(1,-1).reverse().map(([x,r])=>[x,0,-r*d.width/2]),[0,0,0]];
  pipe(lid,m.metal,outline,.020);
  pipe(lid,m.rubber,outline.map(([x,y,z])=>[x,-.028,z]),.025);
  rod(lid,m.metal,[0,0,-.72],[0,0,.72],.025);
  const liftPistons=[];
  for(const side of [-1,1]){
    const z=depth+side*.72;
    box(root,m.dark,-d.length/2,.46,z,.13,.37,.14,.02).name='Hinge lift guide';
    cylinder(root,m.metal,-d.length/2,.62,z,.060,.04);
    const piston=cylinder(root,m.metal,-d.length/2,.645,z,.036,.05);piston.name='Telescoping hinge post';liftPistons.push(piston);
    const hinge=cylinder(hingeCarriage,m.metal,-d.length/2,d.rim,z,.055,.13);hinge.rotation.x=Math.PI/2;hinge.name='Head hinge';
  }
  const glow=new THREE.MeshStandardMaterial({color:0xd5b58a,emissive:0xffbf75,emissiveIntensity:.18});
  box(root,m.dark,-.95,.64,depth-.49,.28,.075,.08,.012);
  box(root,glow,-.95,.653,depth-.443,.21,.025,.01,.005);
  const light=new THREE.PointLight(0xffc387,.65,1.5,2);light.position.set(-.92,.74,depth-.40);root.add(light);
  return {root,lid,hingeCarriage,liftPistons,light,glow,glass,tray,runners};
}

export function animateBunk(bunk,pose){
  const open=THREE.MathUtils.clamp(pose?.open??0,0,1);
  const elevation=THREE.MathUtils.clamp(pose?.lift??open,0,1)*BUNK_DOME.lift;
  bunk.hingeCarriage.position.y=elevation;
  for(const piston of bunk.liftPistons){piston.position.y=.645+elevation/2;piston.scale.y=(.05+elevation)/.05;}
  bunk.lid.rotation.z=open*BUNK_DOME.angle;
  const extension=THREE.MathUtils.clamp(pose?.tray??0,0,1)*BUNK_TRAY.travel;
  bunk.tray.position.z=extension;bunk.runners.position.z=extension*.5;
  const smoke=pose?.occupied?THREE.MathUtils.smoothstep(1-open,0,1):0;
  bunk.glass.color.copy(CLEAR_GLASS).lerp(SMOKED_GLASS,smoke);
  bunk.glass.opacity=THREE.MathUtils.lerp(.13,.78,smoke);
  const brightness=pose?.light??.2;
  bunk.light.intensity=.65*brightness;bunk.glow.emissiveIntensity=.18*brightness;
}
