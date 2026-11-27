import * as THREE from 'three';

const smooth=(a,b,x)=>THREE.MathUtils.smoothstep(x,a,b);
const profile=(t,points)=>{
  for(let i=1;i<points.length;i++)if(t<=points[i][0]){
    const [a,ra]=points[i-1],[b,rb]=points[i];
    return THREE.MathUtils.lerp(ra,rb,smooth(a,b,t));
  }
  return points.at(-1)[1];
};

// A continuous, tapered hide around the moving joints. This is geometry, not
// a uniform scale of the human forearm: thick muscle lobes lead into a wrist.
function organicLimb(material,points){
  const rows=48,cols=32,geometry=new THREE.BufferGeometry();
  const positions=new Float32Array((rows+1)*(cols+1)*3),colors=positions.slice(),indices=[];
  for(let j=0;j<rows;j++)for(let i=0;i<cols;i++){
    const a=j*(cols+1)+i,b=a+cols+1;indices.push(a,a+1,b,a+1,b+1,b);
  }
  geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));
  geometry.setAttribute('color',new THREE.BufferAttribute(colors,3));geometry.setIndex(indices);
  const mesh=new THREE.Mesh(geometry,material),direction=new THREE.Vector3(),u=new THREE.Vector3(),v=new THREE.Vector3();
  mesh.frustumCulled=false;
  const dark=new THREE.Color('#354034'),light=new THREE.Color('#7d7860'),bruise=new THREE.Color('#4b3532'),color=new THREE.Color();
  return {mesh,update(start,end,growth){
    direction.copy(end).sub(start).normalize();
    u.crossVectors(direction,new THREE.Vector3(0,0,1)).normalize();v.crossVectors(direction,u).normalize();
    for(let j=0;j<=rows;j++){
      const t=j/rows,center=start.clone().lerp(end,t);
      center.addScaledVector(u,Math.sin(Math.PI*t)*growth*.025);
      const radius=THREE.MathUtils.lerp(.038,profile(t,points),growth);
      for(let i=0;i<=cols;i++){
        const angle=i/cols*Math.PI*2,index=j*(cols+1)+i;
        const tendon=Math.pow(.5+.5*Math.cos(angle*5+t*3),6);
        const fold=Math.pow(.5+.5*Math.sin(t*71+Math.sin(angle*3)*1.5),9);
        const uneven=1+growth*(.13*Math.sin(angle*3+t*8)+.15*tendon-.055*fold);
        const point=center.clone().addScaledVector(u,Math.cos(angle)*radius*uneven)
          .addScaledVector(v,Math.sin(angle)*radius*uneven*.83);
        geometry.attributes.position.setXYZ(index,...point.toArray());
        color.copy(dark).lerp(light,.28+tendon*.46).lerp(bruise,fold*.33);
        geometry.attributes.color.setXYZ(index,color.r,color.g,color.b);
      }
    }
    geometry.attributes.position.needsUpdate=true;geometry.attributes.color.needsUpdate=true;
    geometry.computeVertexNormals();mesh.visible=growth>.015;
  }};
}

function bluntNailGeometry(){
  // Short, rounded nail plate. No tapered point or hooked extension.
  const geometry=new THREE.SphereGeometry(1,16,10);
  geometry.scale(.009,.014,.0035);geometry.translate(0,-.016,-.008);
  return geometry;
}

export function createMonsterArm(root,arm){
  const hide=new THREE.MeshStandardMaterial({color:0xffffff,vertexColors:true,roughness:.86,metalness:0,side:THREE.DoubleSide});
  const horn=new THREE.MeshStandardMaterial({color:'#343a2c',roughness:.58,metalness:0});
  const plateMat=new THREE.MeshStandardMaterial({color:'#555b43',roughness:.9,metalness:0});
  const forearm=organicLimb(hide,[[0,.046],[.16,.087],[.34,.105],[.53,.076],[.72,.083],[.9,.054],[1,.036]]);
  const upper=organicLimb(hide,[[0,.049],[.2,.064],[.55,.075],[.85,.065],[1,.052]]);
  arm.elbow.add(forearm.mesh);arm.arm.add(upper.mesh);
  const elbowMass=new THREE.Mesh(new THREE.IcosahedronGeometry(1,2),plateMat);
  arm.elbow.add(elbowMass);
  const plates=[];
  for(let i=0;i<5;i++){
    const plate=new THREE.Mesh(new THREE.IcosahedronGeometry(1,1),plateMat);
    arm.elbow.add(plate);plates.push(plate);
  }
  const talons=arm.fingers.map(finger=>{
    const mesh=new THREE.Mesh(bluntNailGeometry(),horn);finger.userData.links[1].add(mesh);return mesh;
  });
  const thumbNail=new THREE.Mesh(bluntNailGeometry(),horn);arm.thumb.userData.ip.add(thumbNail);talons.push(thumbNail);
  // A pale ring marks the original elbow. Gold points follow the actual rig.
  const markerMaterial=new THREE.MeshBasicMaterial({color:'#ffb957',depthTest:false});
  const oldMaterial=new THREE.MeshBasicMaterial({color:'#a4b9be',wireframe:true,transparent:true,opacity:.65,depthTest:false});
  const oldElbow=new THREE.Mesh(new THREE.SphereGeometry(.042,12,8),oldMaterial);
  oldElbow.position.copy(arm.elbow.position);arm.arm.add(oldElbow);
  const markers=[arm.arm,arm.elbow,arm.hand].map(parent=>{
    const mesh=new THREE.Mesh(new THREE.SphereGeometry(.025,12,8),markerMaterial);mesh.renderOrder=20;parent.add(mesh);return mesh;
  });
  const prefix=arm.side<0?'L':'R';
  const support=root.userData.bodySkin.skeleton.bones.find(b=>b.name===`Milo skin ${prefix}_elbow support`);
  const zero=new THREE.Vector3(),upperStart=new THREE.Vector3(0,-.16,0);
  return {forearmSurfaces:[forearm.mesh,...plates],update(phase,showJoints){
    const growth=smooth(.2,.94,phase);
    // The intermediate support bone must follow the relocated hinge too.
    if(support)support.position.copy(arm.elbow.position);
    forearm.update(zero,arm.hand.position,growth);upper.update(upperStart,arm.elbow.position,growth);
    elbowMass.visible=growth>.015;elbowMass.scale.set(.067*growth,.077*growth,.067*growth);
    elbowMass.position.set(0,.015,-.025);
    plates.forEach((plate,i)=>{
      const t=.13+i*.145;plate.position.copy(arm.hand.position).multiplyScalar(t);
      plate.position.x+=arm.side*growth*(.053+.012*Math.sin(t*Math.PI));plate.position.z-=growth*.02;
      plate.rotation.set(.15,-.2,(i%2?-.25:.2));
      plate.scale.set(.045*growth,(.059-i*.004)*growth,.045*growth);plate.visible=growth>.015;
    });
    const claws=smooth(.46,1,phase);talons.forEach(t=>{t.visible=claws>.01;t.scale.setScalar(claws);});
    oldElbow.visible=showJoints;markers.forEach(m=>m.visible=showJoints);
  }};
}
