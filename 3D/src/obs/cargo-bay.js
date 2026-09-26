import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {box as plainBox,cylinder,rod,pipe,label,batchStatic} from './materials.js';

function box(parent,material,x,y,z,w,h,d,r=0){
  if(!r)return plainBox(parent,material,x,y,z,w,h,d);
  // Small hardware needs a bevel highlight, not densely subdivided round edges.
  const mesh=new THREE.Mesh(new RoundedBoxGeometry(w,h,d,1,r),material);
  mesh.position.set(x,y,z);mesh.castShadow=mesh.receiveShadow=true;parent.add(mesh);return mesh;
}

function ring(parent,material,x,y,z,r,tube=.010){
  const mesh=new THREE.Mesh(new THREE.TorusGeometry(r,tube,6,36),material);
  mesh.position.set(x,y,z);mesh.castShadow=mesh.receiveShadow=true;parent.add(mesh);return mesh;
}

function frontCylinder(parent,material,x,y,z,r,depth,segments=24){
  const part=cylinder(parent,material,x,y,z,r,depth,r,segments);part.rotation.x=Math.PI/2;return part;
}

export function createCargoVentilation(m){
  const root=new THREE.Group();root.name='Cargo ventilation housing';root.position.set(12.03,2.39,-1.12);
  box(root,m.dark,0,0,-.035,.93,.92,.15,.035).name='Vent wall mount';
  box(root,m.enamel,0,0,.026,.87,.86,.15,.033).name='Vent service casing';
  frontCylinder(root,m.rubber,0,0,.112,.337,.025,36).name='Dark duct interior';
  // The deep annular throat leaves a clear gap behind the fixed wire guard.
  const throatMaterial=m.dark.clone();throatMaterial.side=THREE.DoubleSide;
  const throat=new THREE.Mesh(new THREE.CylinderGeometry(.327,.315,.13,36,1,true),throatMaterial);
  throat.rotation.x=Math.PI/2;throat.position.z=.18;root.add(throat);
  ring(root,m.rubber,0,0,.116,.331,.020);
  ring(root,m.metal,0,0,.253,.343,.024).name='Bolted intake flange';
  for(let i=0;i<8;i++){
    const a=i*Math.PI/4;
    frontCylinder(root,m.metal,Math.cos(a)*.389,Math.sin(a)*.389,.116,.016,.021,6);
  }
  for(const x of [-.384,.384])for(const y of [-.383,.383])frontCylinder(root,m.dark,x,y,.110,.016,.018,6);

  const blades=new THREE.Group(),shape=new THREE.Shape();
  shape.moveTo(.072,-.030);shape.quadraticCurveTo(.188,-.071,.274,.006);
  shape.quadraticCurveTo(.302,.040,.276,.080);shape.quadraticCurveTo(.184,.108,.077,.046);shape.closePath();
  const geometry=new THREE.ExtrudeGeometry(shape,{depth:.014,steps:1,bevelEnabled:false,curveSegments:5});
  const bladeMaterial=m.enamel.clone();bladeMaterial.name='Cargo / satin fan rotor';
  bladeMaterial.color.setHex(0x858d85);bladeMaterial.map=null;bladeMaterial.metalness=.65;bladeMaterial.roughness=.58;
  for(let i=0;i<4;i++){
    const blade=new THREE.Mesh(geometry,bladeMaterial);blade.rotation.z=i*Math.PI/2;
    blade.position.z=.159;blade.castShadow=true;blades.add(blade);
  }
  frontCylinder(blades,bladeMaterial,0,0,.182,.086,.046,24);
  frontCylinder(blades,m.dark,0,0,.209,.038,.019,12);
  // Only the rotor moves; all four vanes share one draw.
  const rotor=batchStatic(blades,{xrLOD:true});rotor.name='Cargo ventilation rotor';rotor.position.copy(root.position);

  for(const r of [.115,.205,.293])ring(root,m.dark,0,0,.270,r,.007);
  for(let i=0;i<6;i++){
    const a=i*Math.PI/3;
    rod(root,m.dark,[0,0,.282],[Math.cos(a)*.338,Math.sin(a)*.338,.282],.008);
  }
  frontCylinder(root,m.metal,0,0,.289,.030,.016,12).name='Stationary guard boss';
  label(root,'AIR RETURN',-.195,-.400,.115,.30,.050,{size:40});

  // An elbow into the overhead service run and an adjacent wired control box.
  pipe(root,m.pipeSteel,[[-.23,.38,-.047],[-.23,.53,-.047],[-.41,.57,-.047],[-.70,.57,-.047]],.069);
  for(const x of [-.48,-.66]){
    const clamp=cylinder(root,m.metal,x,.57,-.047,.077,.026,.077,12);clamp.rotation.z=Math.PI/2;
  }
  box(root,m.dark,.565,-.115,.005,.215,.37,.16,.015);
  box(root,m.enamel,.565,-.115,.094,.192,.344,.029,.010);
  for(let i=0;i<4;i++)box(root,m.rubber,.565,-.02-i*.039,.114,.125,.013,.012);
  frontCylinder(root,m.dark,.565,-.220,.124,.025,.019,12);
  pipe(root,m.cable,[[.565,-.304,.015],[.565,-.432,.015],[.456,-.460,-.031],[.395,-.348,-.031]],.016);
  return{root,rotor};
}

function webbingMaterial(){
  const canvas=document.createElement('canvas');canvas.width=64;canvas.height=128;
  const ctx=canvas.getContext('2d');ctx.fillStyle='#aaa08a';ctx.fillRect(0,0,64,128);
  for(let y=0;y<128;y+=4){ctx.fillStyle=y%8?'#9a927f':'#b3a991';ctx.fillRect(0,y,64,1);}
  for(let x=0;x<64;x+=4){ctx.fillStyle=x%8?'#c1b59a55':'#655e5055';ctx.fillRect(x,0,1,128);}
  // Woven selvedges and a fine repeated stitch, baked once, not separate geometry.
  for(const x of [3,59]){
    ctx.fillStyle='#716b5a';ctx.fillRect(x,0,2,128);
    ctx.fillStyle='#ccc0a1';for(let y=0;y<128;y+=9)ctx.fillRect(x,y,1,4);
  }
  const map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;
  map.wrapS=map.wrapT=THREE.RepeatWrapping;map.anisotropy=4;
  return new THREE.MeshStandardMaterial({name:'Cargo / woven rope webbing',color:0xb3ab98,map,roughness:.98,metalness:0});
}

function webbing(root,material,points,width=.026){
  const position=[],uv=[],indices=[],p=points.map(point=>new THREE.Vector3(...point));let distance=0;
  for(let i=0;i<p.length;i++){
    const tangent=p[Math.min(i+1,p.length-1)].clone().sub(p[Math.max(0,i-1)]);
    const across=new THREE.Vector3(-tangent.y,tangent.x,0).normalize().multiplyScalar(width/2);
    if(i)distance+=p[i].distanceTo(p[i-1]);
    for(const depth of [.003,-.003])for(const side of [-1,1]){
      position.push(p[i].x+across.x*side,p[i].y+across.y*side,p[i].z+depth);
      uv.push((side+1)/2,distance*12);
    }
    if(i){
      const a=(i-1)*4,b=i*4;
      indices.push(a,a+1,b,a+1,b+1,b, a+2,b+2,a+3,a+3,b+2,b+3,
        a,b,a+2,a+2,b,b+2, a+1,a+3,b+1,a+3,b+3,b+1);
    }
  }
  const end=(p.length-1)*4;indices.push(0,2,1,1,2,3,end,end+1,end+2,end+1,end+3,end+2);
  for(let i=0;i<indices.length;i+=3)[indices[i+1],indices[i+2]]=[indices[i+2],indices[i+1]];
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(position,3));
  geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geometry.setIndex(indices);geometry.computeVertexNormals();
  const mesh=new THREE.Mesh(geometry,material);mesh.castShadow=mesh.receiveShadow=true;root.add(mesh);return mesh;
}

const smooth=(a,b,v)=>THREE.MathUtils.smoothstep(v,a,b);
// Follow the broad crate faces, roll around the corners, then draw back to the rails.
function netDepth(x,y){
  const halfWidth=THREE.MathUtils.lerp(.625,.548,smooth(.91,1.045,y));
  return -.062-.39*smooth(halfWidth+.015,.745,Math.abs(x))-.32*smooth(1.385,1.465,y)-.20*(1-smooth(.08,.17,y));
}

function netEdge(root,material,a,b,width=.045,offset=.014){
  const points=[],steps=Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/.025);
  for(let i=0;i<=steps;i++){
    const t=i/steps,x=THREE.MathUtils.lerp(a[0],b[0],t),y=THREE.MathUtils.lerp(a[1],b[1],t);
    points.push([x,y,netDepth(x,y)+offset]);
  }
  return webbing(root,material,points,width);
}

export function createCargoStowage(m){
  const root=new THREE.Group();root.name='Restrained cargo bay';root.position.x=11.78;
  box(root,m.dark,0,.055,-.65,1.57,.105,1.08,.014).name='Cargo pallet';
  for(const x of [-.48,.48])box(root,m.metal,x,.115,-.64,.075,.040,.89);
  const colors=[0x717366,0x53716b,0x827a65];
  for(let i=0;i<3;i++){
    const w=i===2?1.08:1.235,h=.398,y=.323+i*.435,depth=i===1?.92:.84,z=-.16-depth/2;
    const paint=m.enamel.clone();paint.name='Cargo / storage case '+(i+1);paint.color.setHex(colors[i]);paint.metalness=.15;paint.roughness=.88;
    // A gasket belongs at the lid seam. A full rubber box here left its front
    // only 0.5 mm from the case wall, producing z-fighting through the net.
    box(root,m.rubber,0,y+h/2-.041,z+.008,w+.009,.012,depth+.007,.004).name='Cargo lid gasket';
    box(root,paint,0,y-.026,z+.008,w,h-.060,depth,.028).name='Cargo case body';
    box(root,paint,0,y+h/2-.015,z+.008,w+.026,.045,depth+.020,.016);
    for(const side of [-1,1]){
      box(root,m.dark,side*(w/2-.041),y,-.143,.065,h-.04,.064,.009);
      box(root,m.metal,side*w*.33,y+.135,-.123,.070,.089,.029,.008);
      box(root,m.rubber,side*w*.33,y+.141,-.104,.035,.045,.015);
    }
    box(root,m.rubber,0,y+.090,-.135,.265,.064,.050,.011);
    box(root,m.metal,0,y+.072,-.101,.191,.020,.035,.006);
    for(const x of [-w*.23,w*.23])box(root,paint,x,y-.044,-.133,.031,.205,.038,.006);
    box(root,m.metal,-w*.15,y-.083,-.133,.27,.084,.020);
    box(root,m.dark,-w*.17,y-.067,-.120,.196,.012,.008);
    box(root,m.dark,-w*.185,y-.094,-.120,.160,.008,.008);
  }

  const weave=webbingMaterial(),belt=weave.clone();belt.name='Cargo / dark rope tension straps';belt.color.setHex(0x787361);
  const left=-.724,right=.724,bottom=.105,top=1.445,pitch=.258,slope=1.07;
  // Clipped diagonal bands form real diamonds; crossing bands alternate over/under.
  for(const direction of [-1,1])for(let row=-3;row<=9;row++){
    const b=row*pitch,s=direction*slope,candidates=[];
    for(const x of [left,right]){const y=s*x+b;if(y>=bottom&&y<=top)candidates.push([x,y]);}
    for(const y of [bottom,top]){const x=(y-b)/s;if(x>left&&x<right)candidates.push([x,y]);}
    if(candidates.length!==2)continue;
    const [a,end]=candidates,length=Math.hypot(end[0]-a[0],end[1]-a[1]),steps=Math.ceil(length/.025),points=[];
    for(let i=0;i<=steps;i++){
      const t=i/steps,x=THREE.MathUtils.lerp(a[0],end[0],t),y=THREE.MathUtils.lerp(a[1],end[1],t);
      const crossing=(y+s*x)/pitch,over=direction*.005*Math.cos(Math.PI*(row+crossing));
      points.push([x,y,netDepth(x,y)+over]);
    }
    webbing(root,weave,points).name='Woven diamond cargo net';
  }
  netEdge(root,belt,[left,bottom],[right,bottom]);netEdge(root,belt,[left,top],[right,top]);
  netEdge(root,belt,[left,bottom],[left,top]);netEdge(root,belt,[right,bottom],[right,top]);

  for(const side of [-1,1]){
    const x=side*.788;
    box(root,m.dark,x,.795,-.61,.052,1.50,.07,.009).name='Cargo restraint anchor rail';
    for(const y of [.15,.79,1.435]){
      box(root,m.metal,x,y,-.54,.085,.125,.086,.011);
      for(const dy of [-.041,.041])frontCylinder(root,m.dark,x,y+dy,-.490,.010,.014,6);
      const eye=ring(root,m.metal,x,y,-.472,.036,.007);eye.scale.y=1.35;
      const endX=side*.724;
      webbing(root,belt,[[x,y,-.443],[endX,y,netDepth(endX,y)+.016]],.038);
    }
    // Broad cinch belts with a visible ratchet buckle and a short folded tail.
    const strapX=side*.427;netEdge(root,belt,[strapX,.13],[strapX,1.423],.051,.021);
    const y=side===-1?.65:.97,z=netDepth(strapX,y)+.036;
    box(root,m.dark,strapX,y,z,.096,.151,.026,.008);
    for(const dx of [-.044,.044])box(root,m.metal,strapX+dx,y,z+.020,.013,.139,.027);
    box(root,m.metal,strapX,y+.052,z+.023,.084,.018,.024);
    box(root,m.metal,strapX,y-.052,z+.025,.084,.018,.024);
    const lever=box(root,m.metal,strapX,y-.003,z+.040,.068,.073,.014,.005);lever.rotation.x=.20;
    webbing(root,belt,[[strapX,y-.058,z+.009],[strapX+.014,y-.16,z+.018],[strapX+.029,y-.208,z+.029]],.045);
  }
  return root;
}
