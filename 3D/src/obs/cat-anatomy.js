import * as THREE from 'three';

export function createCatLegSkin(leg,material){
  const rings=48,sides=20,vertices=(rings+1)*(sides+1),uvs=[],indices=[];
  for(let i=0;i<=rings;i++)for(let j=0;j<=sides;j++){
    uvs.push(j/sides,i/rings);
    if(i<rings&&j<sides){const a=i*(sides+1)+j,b=a+sides+1;indices.push(a,a+1,b,b,a+1,b+1);}
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(new Float32Array(vertices*3),3).setUsage(THREE.DynamicDrawUsage));
  geometry.setAttribute('normal',new THREE.Float32BufferAttribute(new Float32Array(vertices*3),3).setUsage(THREE.DynamicDrawUsage));
  if(leg.rear)geometry.setAttribute('coatPosition',geometry.attributes.position.clone());
  geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));geometry.setIndex(indices);
  const mesh=new THREE.Mesh(geometry,material);mesh.castShadow=true;mesh.receiveShadow=true;mesh.name=leg.rear?'Continuous hind leg':'Continuous foreleg';
  mesh.userData={rings,sides,coatBound:false,curve:new THREE.CatmullRomCurve3(Array.from({length:6},()=>new THREE.Vector3()),false,'catmullrom',.28),
    inverse:new THREE.Matrix4(),point:new THREE.Vector3(),axis:new THREE.Vector3(),tangent:new THREE.Vector3(),normal:new THREE.Vector3()};
  leg.body.add(mesh);leg.skin=mesh;return mesh;
}

export function updateCatLegSkins(root){
  const {body,legs}=root.userData;body.updateWorldMatrix(true,true);
  for(const leg of legs){
    const {rings,sides,curve,inverse,point,axis,tangent,normal}=leg.skin.userData;
    inverse.copy(body.matrixWorld).invert();
    const p=curve.points;
    leg.hip.getWorldPosition(p[0]).applyMatrix4(inverse);
    leg.knee.getWorldPosition(p[2]).applyMatrix4(inverse);
    leg.ankle.getWorldPosition(p[4]).applyMatrix4(inverse);
    leg.foot.getWorldPosition(p[5]).applyMatrix4(inverse);p[5].y+=.01;
    p[1].lerpVectors(p[0],p[2],.40);p[3].lerpVectors(p[2],p[4],.55);
    p[0].x*=.45;p[0].y+=.015;
    const radii=leg.rear?[.076,.079,.042,.037,.031,.034]:[.059,.052,.040,.035,.031,.034];
    const position=leg.skin.geometry.attributes.position;
    for(let i=0;i<=rings;i++){
      const t=i/rings,n=Math.min(4,Math.floor(t*5)),f=t*5-n,s=f*f*(3-2*f);
      const radius=THREE.MathUtils.lerp(radii[n],radii[n+1],s);
      curve.getPoint(t,point);curve.getTangent(t,tangent);
      axis.set(1,0,0).addScaledVector(tangent,-tangent.x).normalize();normal.crossVectors(tangent,axis).normalize();
      for(let j=0;j<=sides;j++){
        const angle=j/sides*Math.PI*2,c=Math.cos(angle)*radius,h=Math.sin(angle)*radius;
        position.setXYZ(i*(sides+1)+j,point.x+axis.x*c+normal.x*h,point.y+axis.y*c+normal.y*h,point.z+axis.z*c+normal.z*h);
      }
    }
    if(leg.rear&&!leg.skin.userData.coatBound){leg.skin.geometry.attributes.coatPosition.copyArray(position.array);leg.skin.userData.coatBound=true;}
    position.needsUpdate=true;leg.skin.geometry.computeVertexNormals();leg.skin.geometry.computeBoundingSphere();leg.skin.geometry.computeBoundingBox();
  }
}

export function createCatEar(material,side){
  const group=new THREE.Group();group.position.set(side*.084,.052,-.014);group.rotation.z=-side*.12;group.rotation.y=side*.38;
  const positions=[],colors=[],uvs=[],indices=[],rows=24,columns=20,stride=columns+1,count=(rows+1)*stride;
  const outer=new THREE.Color(side<0?0x303330:0xac6737),inner=new THREE.Color(0xa77571),color=new THREE.Color();
  // Two thin curved surfaces meet around a rim; the front cups inward.
  for(let back=0;back<2;back++)for(let row=0;row<=rows;row++)for(let col=0;col<=columns;col++){
    const t=row/rows,u=col/columns*2-1,width=.045*Math.pow(1-t,.68)+.001;
    const x=u*width+side*.010*t,y=.116*t;
    const z=.024*u*u*(1-t)-.025*t+.004*(1-t)-(back?.0035*(1-t)+.0015:0);
    positions.push(x,y,z);uvs.push(col/columns,t);
    const margin=THREE.MathUtils.smoothstep(Math.abs(u),.48,.93),base=1-THREE.MathUtils.smoothstep(t,0,.23),tip=THREE.MathUtils.smoothstep(t,.77,.96);
    color.copy(inner).lerp(outer,back?1:Math.max(margin,base,tip));colors.push(color.r,color.g,color.b);
    if(row<rows&&col<columns){const a=back*count+row*stride+col,b=a+1,c=a+stride,d=c+1;indices.push(...(back?[a,c,b,b,c,d]:[a,b,c,b,d,c]));}
  }
  const rim=[];for(let c=0;c<=columns;c++)rim.push(c);for(let r=1;r<=rows;r++)rim.push(r*stride+columns);for(let c=columns-1;c>=0;c--)rim.push(rows*stride+c);for(let r=rows-1;r>0;r--)rim.push(r*stride);
  for(let i=0;i<rim.length;i++){const a=rim[i],b=rim[(i+1)%rim.length];indices.push(a,a+count,b,b,a+count,b+count);}
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('normal',new THREE.Float32BufferAttribute(new Float32Array(positions.length),3));geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));geometry.setIndex(indices);geometry.computeVertexNormals();
  const mesh=new THREE.Mesh(geometry,material);mesh.castShadow=true;mesh.receiveShadow=true;mesh.name='Cupped ear';group.add(mesh);return group;
}

const TAIL_POSES={
  sleep:[[0,0,0],[0,-.025,-.10],[.06,-.07,-.19],[.19,-.115,-.19],[.255,-.115,-.07],[.25,-.10,.11],[.22,-.09,.22]],
  walk:[[0,0,0],[0,.06,-.095],[0,.14,-.185],[0,.24,-.26],[0,.32,-.30],[0,.355,-.27],[0,.35,-.205]],
  idle:[[0,0,0],[0,.005,-.10],[0,.005,-.205],[0,.025,-.31],[0,.08,-.39],[0,.14,-.41],[0,.18,-.37]],
  duct:[[0,0,0],[0,-.03,-.10],[0,-.05,-.20],[0,-.05,-.30],[0,-.03,-.40],[0,0,-.45],[0,.03,-.47]],
  groom:[[0,0,0],[0,-.045,-.10],[.10,-.13,-.15],[.22,-.17,-.11],[.25,-.175,.06],[.22,-.17,.21],[.16,-.17,.27]],
};

export function createCatTail(material){
  const curve=new THREE.CatmullRomCurve3(TAIL_POSES.sleep.map(p=>new THREE.Vector3(...p))),segments=64,capSegments=8,sides=16;
  const rings=segments+capSegments,vertices=(rings+1)*(sides+1),uvs=[],indices=[];
  for(let i=0;i<=rings;i++)for(let j=0;j<=sides;j++){
    uvs.push(i/rings,j/sides);
    if(i<rings&&j<sides){const a=i*(sides+1)+j,b=a+sides+1;indices.push(a,b,a+1,b,b+1,a+1);}
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(new Float32Array(vertices*3),3));
  geometry.setAttribute('normal',new THREE.Float32BufferAttribute(new Float32Array(vertices*3),3));
  geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));geometry.setIndex(indices);
  const mesh=new THREE.Mesh(geometry,material);
  geometry.attributes.position.setUsage(THREE.DynamicDrawUsage);geometry.attributes.normal.setUsage(THREE.DynamicDrawUsage);
  mesh.position.set(0,.35,-.38);mesh.castShadow=true;mesh.receiveShadow=true;mesh.name='Rounded-tip cat tail';
  mesh.userData={curve,segments,capSegments,sides,tipRadius:.026,lastTime:null,point:new THREE.Vector3(),normal:new THREE.Vector3(),target:new THREE.Vector3()};
  animateCatTail(mesh,{time:0,resting:true,moving:false});return mesh;
}

export function animateCatTail(mesh,{time,resting,moving,crouching=false,grooming=0}){
  const data=mesh.userData,{curve,segments,capSegments,sides,tipRadius,point,normal,target}=data;
  if(data.lastTime===time)return;
  const blend=data.lastTime===null?1:1-Math.exp(-Math.max(0,Math.min(.1,time-data.lastTime))*8);data.lastTime=time;
  const pose=TAIL_POSES[crouching?'duct':resting?'sleep':moving?'walk':'idle'];
  pose.forEach((p,i)=>{const fraction=i/(pose.length-1),g=TAIL_POSES.groom[i];target.set(p[0]+(g[0]-p[0])*grooming,p[1]+(g[1]-p[1])*grooming,p[2]+(g[2]-p[2])*grooming);target.x+=Math.sin(time*(resting?.65:1.15)-fraction*1.7)*(resting||grooming>.5?.006:.025)*fraction*fraction;curve.points[i].lerp(target,blend);});
  curve.updateArcLengths();const frames=curve.computeFrenetFrames(segments,false),positions=mesh.geometry.attributes.position,normals=mesh.geometry.attributes.normal,length=curve.getLength();
  // A gently tapered tube ends in a hemisphere, not a point or an attached bead.
  for(let i=0;i<=segments+capSegments;i++){
    const t=Math.min(i/segments,1),frame=Math.min(i,segments),cap=Math.max(0,i-segments)/capSegments*Math.PI/2;
    const radius=i<=segments?.037-(.037-tipRadius)*t*t*(3-2*t):tipRadius*Math.cos(cap);
    curve.getPointAt(t,point);point.addScaledVector(frames.tangents[frame],tipRadius*Math.sin(cap));
    for(let j=0;j<=sides;j++){
      const theta=j/sides*Math.PI*2,index=i*(sides+1)+j;
      normal.copy(frames.normals[frame]).multiplyScalar(-Math.cos(theta)).addScaledVector(frames.binormals[frame],Math.sin(theta));
      positions.setXYZ(index,point.x+normal.x*radius,point.y+normal.y*radius,point.z+normal.z*radius);
      if(i>segments)normal.multiplyScalar(Math.cos(cap)).addScaledVector(frames.tangents[frame],Math.sin(cap));
      else normal.addScaledVector(frames.tangents[frame],6*(.037-tipRadius)*t*(1-t)/length);
      normal.normalize();normals.setXYZ(index,normal.x,normal.y,normal.z);
    }
  }
  positions.needsUpdate=true;normals.needsUpdate=true;mesh.geometry.computeBoundingSphere();mesh.geometry.computeBoundingBox();
}
