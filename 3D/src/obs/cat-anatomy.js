import * as THREE from 'three';

export function createCatEar(material,side){
  const group=new THREE.Group();group.position.set(side*.083,.073,-.006);group.rotation.z=-side*.18;group.rotation.y=side*.68;
  const positions=[],colors=[],uvs=[],indices=[],rows=24,columns=20,stride=columns+1,count=(rows+1)*stride;
  const outer=new THREE.Color(side<0?0x303330:0xac6737),inner=new THREE.Color(0xa77571),color=new THREE.Color();
  // Two thin curved surfaces meet around a rim; the front cups inward.
  for(let back=0;back<2;back++)for(let row=0;row<=rows;row++)for(let col=0;col<=columns;col++){
    const t=row/rows,u=col/columns*2-1,width=.055*Math.pow(1-t,.68)+.001;
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
  const curve=new THREE.CatmullRomCurve3(TAIL_POSES.sleep.map(p=>new THREE.Vector3(...p))),segments=64,sides=12;
  const geometry=new THREE.TubeGeometry(curve,segments,.035,sides,false),mesh=new THREE.Mesh(geometry,material);
  geometry.attributes.position.setUsage(THREE.DynamicDrawUsage);geometry.attributes.normal.setUsage(THREE.DynamicDrawUsage);
  mesh.position.set(0,.35,-.38);mesh.castShadow=true;mesh.receiveShadow=true;mesh.name='Continuous tapered tail';
  mesh.userData={curve,segments,sides,lastTime:null,point:new THREE.Vector3(),normal:new THREE.Vector3(),target:new THREE.Vector3()};
  animateCatTail(mesh,{time:0,resting:true,moving:false});return mesh;
}

export function animateCatTail(mesh,{time,resting,moving,crouching=false,grooming=0}){
  const data=mesh.userData,{curve,segments,sides,point,normal,target}=data;
  if(data.lastTime===time)return;
  const blend=data.lastTime===null?1:1-Math.exp(-Math.max(0,Math.min(.1,time-data.lastTime))*8);data.lastTime=time;
  const pose=TAIL_POSES[crouching?'duct':resting?'sleep':moving?'walk':'idle'];
  pose.forEach((p,i)=>{const fraction=i/(pose.length-1),g=TAIL_POSES.groom[i];target.set(p[0]+(g[0]-p[0])*grooming,p[1]+(g[1]-p[1])*grooming,p[2]+(g[2]-p[2])*grooming);target.x+=Math.sin(time*(resting?.65:1.15)-fraction*1.7)*(resting||grooming>.5?.006:.025)*fraction*fraction;curve.points[i].lerp(target,blend);});
  curve.updateArcLengths();const frames=curve.computeFrenetFrames(segments,false),positions=mesh.geometry.attributes.position,normals=mesh.geometry.attributes.normal;
  // Reuse one mesh and its buffers so bending never exposes separate segments.
  for(let i=0;i<=segments;i++){
    const t=i/segments,radius=.035*Math.pow(1-t,.50);curve.getPointAt(t,point);
    for(let j=0;j<=sides;j++){
      const theta=j/sides*Math.PI*2,index=i*(sides+1)+j;
      normal.copy(frames.normals[i]).multiplyScalar(-Math.cos(theta)).addScaledVector(frames.binormals[i],Math.sin(theta));
      positions.setXYZ(index,point.x+normal.x*radius,point.y+normal.y*radius,point.z+normal.z*radius);
      normal.addScaledVector(frames.tangents[i],i===segments?50:.025/Math.sqrt(Math.max(.015,1-t))).normalize();normals.setXYZ(index,normal.x,normal.y,normal.z);
    }
  }
  positions.needsUpdate=true;normals.needsUpdate=true;mesh.geometry.computeBoundingSphere();
}
