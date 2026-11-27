import * as THREE from 'three';

export function createCreatureNeck(root){
  const {body,head,spine}=root.userData,rows=18,cols=28;
  const surfaceCount=(rows+1)*(cols+1),positions=new Float32Array((surfaceCount+2)*3),colors=positions.slice(),indices=[];
  for(let j=0;j<rows;j++)for(let i=0;i<cols;i++){
    const a=j*(cols+1)+i,b=a+cols+1;indices.push(a,a+1,b,a+1,b+1,b);
  }
  // Closed, buried ends prevent a dark open rim from becoming visible as the
  // head lifts and the shoulder armor changes angle.
  for(let i=0;i<cols;i++){
    indices.push(surfaceCount,i+1,i);
    indices.push(surfaceCount+1,rows*(cols+1)+i,rows*(cols+1)+i+1);
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));geometry.setAttribute('color',new THREE.BufferAttribute(colors,3));geometry.setIndex(indices);
  const mesh=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({color:0xffffff,vertexColors:true,roughness:.88,side:THREE.DoubleSide}));
  mesh.name='Curtis continuous armored nape';mesh.castShadow=true;mesh.frustumCulled=false;body.add(mesh);
  const dark=new THREE.Color('#4c573c'),light=new THREE.Color('#737957'),color=new THREE.Color();
  return {update(progress){
    const growth=THREE.MathUtils.smoothstep(progress,.04,.48);mesh.visible=growth>.005;if(!mesh.visible)return;
    root.updateMatrixWorld(true);
    // Bury both ends inside the shoulders and lower skull; follow head pitch.
    const start=body.worldToLocal(spine.drivers[3].localToWorld(new THREE.Vector3(0,1.505,-.085)));
    const end=body.worldToLocal(head.localToWorld(new THREE.Vector3(0,.30,-.45)));
    const axis=end.clone().sub(start).normalize(),u=new THREE.Vector3(1,0,0);
    u.addScaledVector(axis,-u.dot(axis)).normalize();const v=new THREE.Vector3().crossVectors(axis,u).normalize();
    for(let j=0;j<=rows;j++){
      const t=j/rows,centre=start.clone().lerp(end,t),fold=.5+.5*Math.cos(t*Math.PI*8);
      const width=THREE.MathUtils.lerp(.140,.078,t)*growth,depth=THREE.MathUtils.lerp(.125,.075,t)*growth;
      for(let i=0;i<=cols;i++){
        const a=i/cols*Math.PI*2,k=j*(cols+1)+i,r=1+.035*fold;
        const point=centre.clone().addScaledVector(u,Math.cos(a)*width*r).addScaledVector(v,Math.sin(a)*depth*r);
        geometry.attributes.position.setXYZ(k,...point.toArray());
        color.copy(dark).lerp(light,.35+fold*.45);geometry.attributes.color.setXYZ(k,color.r,color.g,color.b);
      }
    }
    geometry.attributes.position.setXYZ(surfaceCount,...start.toArray());geometry.attributes.position.setXYZ(surfaceCount+1,...end.toArray());
    for(const i of [surfaceCount,surfaceCount+1])geometry.attributes.color.setXYZ(i,light.r,light.g,light.b);
    geometry.attributes.position.needsUpdate=true;geometry.attributes.color.needsUpdate=true;geometry.computeVertexNormals();
  }};
}
