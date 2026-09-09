import * as THREE from 'three';

const SCALE=new THREE.Vector3(.118,.116,.115);
const gaussian=(x,y,cx,cy,rx,ry)=>Math.exp(-Math.pow((x-cx)/rx,2)-Math.pow((y-cy)/ry,2));

function section(y){
  const round=Math.sqrt(Math.max(0,1-Math.pow(y/.108,2)));
  const cheeks=1+.025*Math.exp(-Math.pow((y+.02)/.035,2));
  const jaw=1-.30*THREE.MathUtils.smoothstep(-y,.04,.102);
  return{width:.119*round*cheeks*jaw,depth:.122*round,back:.103*round,
    center:-.018+.022*THREE.MathUtils.smoothstep(-y,.015,.09)};
}

export function catFaceSurface(x,y,sockets=true){
  const s=section(y),across=s.width>1e-8?Math.sqrt(Math.max(0,1-Math.pow(x/s.width,2))):0;
  const front=THREE.MathUtils.smoothstep(across,0,.4);
  let relief=.016*gaussian(x,y,0,-.006,.025,.052)+.017*gaussian(x,y,0,-.022,.017,.019)+.014*gaussian(x,y,0,-.072,.050,.023);
  for(const side of [-1,1]){
    relief+=.040*gaussian(x,y,side*.026,-.044,.029,.024);
    if(sockets)relief-=.010*gaussian(x,y,side*.052,.023,.032,.025);
  }
  return s.center+s.depth*across+relief*front;
}

export function createCatSkull(material){
  const geometry=new THREE.SphereGeometry(1,96,64),position=geometry.attributes.position;
  for(let i=0;i<position.count;i++){
    const x=position.getX(i),y=position.getY(i)*.108,z=position.getZ(i),s=section(y);
    const ring=Math.hypot(x,z),px=ring>1e-8?s.width*x/ring:0;
    const pz=z>=0?catFaceSurface(px,y):s.center+s.back*z/Math.max(ring,1e-8);
    position.setXYZ(i,px/SCALE.x,y/SCALE.y,pz/SCALE.z);
  }
  geometry.setAttribute('facePosition',position.clone());
  geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();
  const mesh=new THREE.Mesh(geometry,material);mesh.scale.copy(SCALE);mesh.castShadow=true;mesh.receiveShadow=true;mesh.name='Contoured cat skull';return mesh;
}

function eyePoint(side,r,angle,opening=1,target=new THREE.Vector3()){
  const u=r*Math.cos(angle),v=r*Math.sin(angle);
  const blend=THREE.MathUtils.smoothstep(r,1,1.26);
  const aperture=THREE.MathUtils.lerp(opening,1,blend);
  const x=side*.052+u*.025,y=.023+v*.021*(.86+.14*Math.abs(Math.sin(angle)))*aperture+side*u*.004;
  const z=THREE.MathUtils.lerp(catFaceSurface(x,y,false)+.0035*(1-Math.min(r,1)**2),catFaceSurface(x,y),blend)+.0007;
  return target.set(x,y,z);
}

function eyeGeometry(side,start,end,rings){
  const segments=80,positions=[],uvs=[],face=[],indices=[];
  for(let row=0;row<=rings;row++)for(let col=0;col<=segments;col++){
    const r=THREE.MathUtils.lerp(start,end,row/rings),angle=col/segments*Math.PI*2,p=eyePoint(side,r,angle);
    positions.push(p.x-side*.052,p.y-.023,p.z);face.push(p.x/SCALE.x,p.y/SCALE.y,p.z/SCALE.z);
    uvs.push(.5+r*Math.cos(angle)/2,.5+r*Math.sin(angle)/2);
    if(row<rings&&col<segments){const a=row*(segments+1)+col,b=a+segments+1;indices.push(a,b,a+1,b,b+1,a+1);}
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));geometry.setAttribute('facePosition',new THREE.Float32BufferAttribute(face,3));geometry.setIndex(indices);
  geometry.userData={side,start,end,rings,segments,point:new THREE.Vector3()};
  geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();return geometry;
}

function colorIris(geometry){
  const uv=geometry.attributes.uv,colors=[],color=new THREE.Color(),green=new THREE.Color(0x65714e),gold=new THREE.Color(0x938155),rim=new THREE.Color(0x263a31),pupil=new THREE.Color(0x030809);
  for(let i=0;i<uv.count;i++){
    const u=(uv.getX(i)-.5)*2,v=(uv.getY(i)-.5)*2,x=u*.025,y=v*.021;
    const radius=Math.hypot(x,y)/.0215,angle=Math.atan2(y,x);
    const fibers=Math.sin(angle*53+radius*14)*Math.sin(angle*31-radius*28)*.10;
    color.copy(gold).lerp(green,THREE.MathUtils.smoothstep(radius,.2,.75)).multiplyScalar(1+fibers);
    color.lerp(rim,THREE.MathUtils.smoothstep(radius,.80,1.04));
    color.lerp(pupil,1-THREE.MathUtils.smoothstep(Math.hypot(x/.0105,y/.014),.94,1.05));
    colors.push(color.r,color.g,color.b);
  }
  if(geometry.attributes.color){geometry.attributes.color.copyArray(colors);geometry.attributes.color.needsUpdate=true;}
  else geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
}

export function createCatEyes(head,fur){
  const iris=new THREE.MeshPhysicalMaterial({color:0xffffff,vertexColors:true,roughness:.32,metalness:0,clearcoat:.1,clearcoatRoughness:.20,envMapIntensity:.06});
  const wetLid=new THREE.MeshStandardMaterial({color:0x302d29,roughness:.48,metalness:0});
  return [-1,1].map(side=>{
    const eye=new THREE.Group();eye.position.set(side*.052,.023,0);eye.name='Recessed cat eye';eye.userData.opening=1;head.add(eye);
    const geometry=eyeGeometry(side,0,1,28);colorIris(geometry);
    const surface=new THREE.Mesh(geometry,iris);surface.name='Almond eye surface';eye.add(surface);
    const rim=new THREE.Mesh(eyeGeometry(side,1,1.055,2),wetLid);rim.name='Eyelid margin';eye.add(rim);
    const lids=new THREE.Mesh(eyeGeometry(side,1.055,1.26,8),fur);faceUV(lids.geometry);lids.name='Furred eyelids';lids.castShadow=true;lids.receiveShadow=true;eye.add(lids);
    return eye;
  });
}

function faceUV(geometry){
  const {facePosition,uv}=geometry.attributes;
  for(let i=0;i<uv.count;i++){
    const x=facePosition.getX(i)*SCALE.x,y=facePosition.getY(i)*SCALE.y,width=section(y).width;
    uv.setXY(i,Math.acos(THREE.MathUtils.clamp(-x/width,-1,1))/(Math.PI*2),1-Math.acos(THREE.MathUtils.clamp(y/.108,-1,1))/Math.PI);
  }
  uv.needsUpdate=true;
}

export function updateCatEyes(eyes){
  for(const eye of eyes){
    const opening=THREE.MathUtils.clamp(eye.scale.y,.025,1);eye.scale.y=1;
    if(Math.abs(opening-eye.userData.opening)<.0002)continue;
    eye.userData.opening=opening;
    // Close the aperture over the iris instead of squashing the pupil into a horizontal line.
    for(const mesh of eye.children){
      const {geometry}=mesh,{side,start,end,rings,segments,point}=geometry.userData;
      const {position,facePosition,uv}=geometry.attributes;
      for(let row=0;row<=rings;row++)for(let col=0;col<=segments;col++){
        const r=THREE.MathUtils.lerp(start,end,row/rings),angle=col/segments*Math.PI*2,index=row*(segments+1)+col;
        eyePoint(side,r,angle,opening,point);
        position.setXYZ(index,point.x-side*.052,point.y-.023,point.z);
        facePosition.setXYZ(index,point.x/SCALE.x,point.y/SCALE.y,point.z/SCALE.z);
        uv.setXY(index,.5+r*Math.cos(angle)/2,.5+r*Math.sin(angle)*opening/2);
      }
      position.needsUpdate=true;facePosition.needsUpdate=true;uv.needsUpdate=true;
      if(geometry.attributes.color)colorIris(geometry);
      else if(mesh.name==='Furred eyelids')faceUV(geometry);
      geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();
    }
    eye.children[0].visible=opening>.055;
  }
}

function line(parent,points,material,radius=.0007){
  const curve=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)));
  const mesh=new THREE.Mesh(new THREE.TubeGeometry(curve,24,radius,5,false),material);parent.add(mesh);return mesh;
}

export function createCatMuzzle(head){
  const geometry=new THREE.SphereGeometry(1,40,24),position=geometry.attributes.position;
  const base=catFaceSurface(0,-.026);
  for(let i=0;i<position.count;i++){
    const x=position.getX(i),y=position.getY(i),z=position.getZ(i);
    const px=x*.015*(.35+.65*THREE.MathUtils.smoothstep(y,-.9,.35)),py=y*.013;
    position.setXYZ(i,px,py,catFaceSurface(px,py-.026)-base+.0005+(z+1)*.003);
  }
  geometry.computeVertexNormals();
  const nose=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({color:0x9d6861,roughness:.65,envMapIntensity:.12}));
  nose.position.set(0,-.026,base);nose.name='Triangular cat nose';head.add(nose);
  const lip=new THREE.MeshStandardMaterial({color:0x66534e,roughness:.9});
  const onFace=(x,y,lift=.0007)=>[x,y,catFaceSurface(x,y)+lift];
  line(head,[onFace(0,-.039),onFace(0,-.047),onFace(0,-.055)],lip,.00055);
  for(const side of [-1,1]){
    line(head,[onFace(0,-.055),onFace(side*.019,-.061),onFace(side*.035,-.056)],lip,.0005);
    line(head,[onFace(side*.007,-.025,.0055),onFace(side*.010,-.023,.0055),onFace(side*.013,-.021,.0055)],lip,.0011);
    for(let i=0;i<5;i++){
      const lift=(i-2)*.014;
      const whisker=line(head,[[side*.032,-.040+i*.003,.135],[side*.090,-.030+lift,.143],[side*(.175+i%2*.025),-.035+lift*2,.095]],new THREE.MeshBasicMaterial({color:0xd7d8cb,transparent:true,opacity:.52}),.00025);
      whisker.name='Whisker';
    }
  }
}
