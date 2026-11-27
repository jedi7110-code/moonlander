import * as THREE from 'three';

const smooth=(a,b,x)=>THREE.MathUtils.smoothstep(x,a,b);
// Measure cross-sections of the posed skin. Its forearm is asymmetric and
// offset from the elbow/wrist axis, unlike the old procedural cylinder.
function forearmEnvelope(root,arm,surfaces){
  const skin=root.userData.bodySkin,{position,armRegion}=skin.geometry.attributes;
  const sourceIndex=skin.geometry.index.array,faces=[];
  for(let i=0;i<sourceIndex.length;i+=3){
    const face=Array.from(sourceIndex.slice(i,i+3));
    if(face.every(j=>position.getX(j)*arm.side>0&&armRegion.getX(j)>.9)&&
      face.some(j=>position.getY(j)>.85&&position.getY(j)<1.29))faces.push(...face);
  }
  const sources=[{mesh:skin,index:faces},...surfaces.map(mesh=>({mesh,index:mesh.geometry.index?.array??Array.from({length:mesh.geometry.attributes.position.count},(_,i)=>i)}))]
    .map(source=>({...source,vertices:[...new Set(source.index)],points:new Map()}));
  const slices=48,point=new THREE.Vector3(),matrix=new THREE.Matrix4(),inverse=new THREE.Matrix4();
  return {update(axis,u,v,length){
    root.userData.updateWristTwists?.();root.updateMatrixWorld(true);skin.skeleton.update();
    inverse.copy(arm.elbow.matrixWorld).invert();
    const sections=Array.from({length:slices+1},()=>[]);
    for(const {mesh,index,vertices,points} of sources){
      if(!mesh.visible)continue;
      matrix.multiplyMatrices(inverse,mesh.matrixWorld);
      for(const i of vertices){
        mesh.getVertexPosition(i,point);point.applyMatrix4(matrix);
        const p=points.get(i)??new THREE.Vector3();
        p.set(point.dot(u),point.dot(v),point.dot(axis)/length);points.set(i,p);
      }
      for(let i=0;i<index.length;i+=3){
        const triangle=[points.get(index[i]),points.get(index[i+1]),points.get(index[i+2])];
        const first=Math.max(0,Math.ceil(Math.min(...triangle.map(p=>p.z))*slices));
        const last=Math.min(slices,Math.floor(Math.max(...triangle.map(p=>p.z))*slices));
        for(let section=first;section<=last;section++)for(let edge=0;edge<3;edge++){
          const a=triangle[edge],b=triangle[(edge+1)%3],t=section/slices;
          if((a.z<=t&&b.z>t)||(b.z<=t&&a.z>t)){
            const f=(t-a.z)/(b.z-a.z);
            sections[section].push([THREE.MathUtils.lerp(a.x,b.x,f),THREE.MathUtils.lerp(a.y,b.y,f)]);
          }
        }
      }
    }
    const rings=sections.map((points,i)=>{
      if(!points.length)throw new Error(`Missing forearm cross-section ${i}`);
      const xs=points.map(p=>p[0]),zs=points.map(p=>p[1]);
      const minX=Math.min(...xs),maxX=Math.max(...xs),minZ=Math.min(...zs),maxZ=Math.max(...zs);
      const x=(minX+maxX)/2,z=(minZ+maxZ)/2,rx=Math.max(.001,(maxX-minX)/2),rz=Math.max(.001,(maxZ-minZ)/2);
      // Enclose all sampled skin and new muscle lobes, including diagonals.
      const cover=Math.max(1,...points.map(p=>Math.hypot((p[0]-x)/rx,(p[1]-z)/rz)));
      return [x,z,rx*cover,rz*cover];
    });
    return t=>{
      const sample=THREE.MathUtils.clamp(t,0,.9999)*slices,i=Math.floor(sample),f=sample-i;
      return rings[i].map((n,k)=>THREE.MathUtils.lerp(n,rings[i+1][k],f));
    };
  }};
}

// Worn overlapping gauze on the right forearm, already present before infection.
export function createInjuryBandage(root,arm,surfaces=[]){
  const group=new THREE.Group();group.name='Curtis lunar injury bandage';arm.elbow.add(group);
  const envelope=forearmEnvelope(root,arm,surfaces);
  const material=new THREE.MeshStandardMaterial({color:0xffffff,vertexColors:true,roughness:1,side:THREE.DoubleSide});
  material.onBeforeCompile=shader=>{
    shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nattribute vec2 bandageUv;varying vec2 vBandageUv;')
      .replace('#include <begin_vertex>','#include <begin_vertex>\nvBandageUv=bandageUv;');
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec2 vBandageUv;')
      .replace('#include <color_fragment>',`#include <color_fragment>
        float weave=sin(vBandageUv.x*620.)*sin(vBandageUv.y*54.);
        float selvedge=1.-smoothstep(.015,.09,min(vBandageUv.y,1.-vBandageUv.y));
        diffuseColor.rgb*=(.94+.06*weave)*(1.-.15*selvedge);`);
  };
  material.customProgramCacheKey=()=> 'curtis-right-arm-gauze';
  const wraps=[],rows=64,across=4,stride=across+1;
  for(let turn=0;turn<6;turn++){
    const geometry=new THREE.BufferGeometry(),positions=new Float32Array((rows+1)*stride*3),colors=positions.slice(),uvs=new Float32Array((rows+1)*stride*2),indices=[];
    for(let j=0;j<=rows;j++)for(let edge=0;edge<=across;edge++){
      const a=j*stride+edge;uvs.set([j/rows,edge/across],a*2);
      if(j<rows&&edge<across)indices.push(a,a+1,a+stride,a+1,a+stride+1,a+stride);
    }
    geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));geometry.setAttribute('color',new THREE.BufferAttribute(colors,3));geometry.setAttribute('bandageUv',new THREE.BufferAttribute(uvs,2));geometry.setIndex(indices);
    const mesh=new THREE.Mesh(geometry,material);mesh.name=`Overlapping gauze wrap ${turn+1}`;mesh.frustumCulled=false;mesh.castShadow=true;group.add(mesh);wraps.push(mesh);
  }
  const clean=new THREE.Color('#ded4b9'),worn=new THREE.Color('#928c76'),color=new THREE.Color();
  return {update(phase){
    group.visible=phase<.98;if(!group.visible)return;
    const axis=arm.hand.position.clone().normalize(),u=new THREE.Vector3().crossVectors(axis,new THREE.Vector3(0,0,1)).normalize(),v=new THREE.Vector3().crossVectors(axis,u);
    const length=arm.hand.position.length(),sectionAt=envelope.update(axis,u,v,length);
    for(let turn=0;turn<wraps.length;turn++){
      const mesh=wraps[turn],rip=smooth(.28+turn*.05,.61+turn*.05,phase);
      mesh.visible=rip<.99;
      if(!mesh.visible)continue;
      for(let j=0;j<=rows;j++)for(let edge=0;edge<=across;edge++){
        const f=j/rows,width=edge/across,t=.16+(turn+f)*.107+(width-.5)*.145,a=f*Math.PI*2;
        const radial=u.clone().multiplyScalar(Math.cos(a)).addScaledVector(v,Math.sin(a));
        const [cx,cz,rx,rz]=sectionAt(t);
        const margin=.0035+.01*smooth(0,.8,phase)+turn*.00055+.0015*(1-width)**3;
        const flap=smooth(.12,.9,f)*rip,flutter=Math.sin(f*7+turn)*flap*.012;
        const point=axis.clone().multiplyScalar(t*length)
          .addScaledVector(u,cx+Math.cos(a)*(rx+margin)).addScaledVector(v,cz+Math.sin(a)*(rz+margin))
          .addScaledVector(radial,flap*.12);
        point.addScaledVector(u,flutter).addScaledVector(axis,flap*flap*.14);
        const i=j*stride+edge;mesh.geometry.attributes.position.setXYZ(i,...point.toArray());
        const dirt=.12+.23*Math.exp(-Math.pow((t-.48)/.16,2))+width*.08+Math.sin(f*30+turn)*.03;
        color.copy(clean).lerp(worn,dirt);mesh.geometry.attributes.color.setXYZ(i,color.r,color.g,color.b);
      }
      mesh.geometry.attributes.position.needsUpdate=true;mesh.geometry.attributes.color.needsUpdate=true;mesh.geometry.computeVertexNormals();
    }
  }};
}
