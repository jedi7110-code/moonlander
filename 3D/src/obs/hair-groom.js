import * as THREE from 'three';

// A continuous directional groom. Each lock has a curved cross section and
// root-to-tip UVs; detail follows the lock rather than world-space scan faces.
const cache=new WeakMap();
function surfaceFor(scalp){
  if(cache.has(scalp))return cache.get(scalp);
  const center=new THREE.Vector3(0,1.9,0),mesh=new THREE.Mesh(scalp,new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));
  const ray=new THREE.Raycaster(),cols=96,rows=48,radii=[];
  for(let j=0;j<=rows;j++)for(let i=0;i<cols;i++){
    const p=j/rows*2.12,a=i/cols*Math.PI*2,d=new THREE.Vector3(Math.sin(p)*Math.sin(a),Math.cos(p),Math.sin(p)*Math.cos(a));
    ray.set(center.clone().addScaledVector(d,6),d.clone().negate());
    const hit=ray.intersectObject(mesh,false)[0];radii.push(hit?hit.point.distanceTo(center):1.7);
  }
  mesh.material.dispose();
  const sample=d=>{
    const x=((Math.atan2(d.x,d.z)/(Math.PI*2)+1)%1)*cols,y=Math.min(rows-.00001,Math.acos(THREE.MathUtils.clamp(d.y,-1,1))/2.12*rows);
    const i=Math.floor(x),j=Math.floor(y),u=x-i,v=y-j;
    const at=(a,b)=>radii[b*cols+(a%cols)];
    const r=THREE.MathUtils.lerp(THREE.MathUtils.lerp(at(i,j),at(i+1,j),u),THREE.MathUtils.lerp(at(i,j+1),at(i+1,j+1),u),v);
    return center.clone().addScaledVector(d,r);
  };
  cache.set(scalp,sample);return sample;
}

export function createGroom(scalp,style,hairline){
  const sample=surfaceFor(scalp),positions=[],uvs=[],seeds=[],indices=[];
  let seed=71023;
  const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  const rows=18,cols=2,total=16000;
  for(let id=0;id<total;id++){
    const y=1-rand()*1.40,a=id*2.3999632297,d=new THREE.Vector3(Math.sqrt(1-y*y)*Math.sin(a),y,Math.sqrt(1-y*y)*Math.cos(a));
    const root=sample(d),edge=root.y-hairline(root.x,root.z);
    if(edge<-.025)continue;
    const top=THREE.MathUtils.smoothstep(root.y,2.45,3.35),front=THREE.MathUtils.smoothstep(root.z,.3,1.4),r=rand(),tone=rand();
    const length=(.36+top*(style==='swept'?1.2:style==='fringe'?.78:.95))*(.85+r*.3);
    const width=(.009+top*.014)*(.85+rand()*.3),lift=(.004+top*(style==='rough'?.035:.018))*(.85+r*.3);
    const phase=rand()*6.28,base=positions.length/3;
    for(let j=0;j<=rows;j++){
      const t=j/rows;
      const flow=new THREE.Vector3(
        top*(style==='swept'?-1.2:style==='fringe'?-.22:-.8)+(1-top)*d.x*.18,
        top*.25-(1-top)*.6,
        style==='fringe'?top*.65-(1-top)*.6:style==='swept'?-.65:-1.0);
      flow.x+=top*(style==='rough'?.18:.06)*Math.sin(phase+t*2.5);
      flow.addScaledVector(d,-flow.dot(d)).normalize();
      if(j)d.addScaledVector(flow,length/rows/1.75).normalize();
      const p=sample(d),side=new THREE.Vector3().crossVectors(flow,d).normalize();
      const boundary=THREE.MathUtils.smoothstep(p.y-hairline(p.x,p.z),-.03,.14);
      const taper=THREE.MathUtils.smoothstep(t,0,.10)*(1-.96*THREE.MathUtils.smoothstep(t,.80,1))*boundary;
      const crown=THREE.MathUtils.smoothstep(p.y,2.65,3.5);
      const wave=.5+.5*Math.sin(p.x*5.0+p.z*2.7+Math.sin(p.z*2.2));
      const height=.004+boundary*(crown*(.12+.075*wave)+lift*Math.sin(Math.PI*t*.91));
      for(let k=0;k<=cols;k++){
        const u=k/cols,q=u*2-1;
        const v=p.clone().addScaledVector(side,q*width*taper).addScaledVector(d,height+(1-q*q)*width*.12);
        positions.push(v.x,v.y,v.z);uvs.push(u,t);seeds.push(tone);
        if(j<rows&&k<cols){const n=base+j*(cols+1)+k;indices.push(n,n+cols+1,n+1,n+1,n+cols+1,n+cols+2);}
      }
    }
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));geometry.setAttribute('lockSeed',new THREE.Float32BufferAttribute(seeds,1));geometry.setIndex(indices);
  geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();
  const material=new THREE.MeshStandardMaterial({color:0x493725,roughness:.68,metalness:0,side:THREE.DoubleSide});
  material.onBeforeCompile=shader=>{
    shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nattribute float lockSeed; varying float vLockSeed; varying vec2 vLockUv;').replace('#include <begin_vertex>','#include <begin_vertex>\nvLockSeed=lockSeed;vLockUv=uv;');
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`#include <common>
      varying float vLockSeed; varying vec2 vLockUv;
      float fiberPhase(){return vLockUv.x*57.0+sin(vLockUv.y*5.0+vLockSeed*14.0)*.5;}
    `).replace('#include <color_fragment>',`#include <color_fragment>
      float phase=fiberPhase();
      float fine=.5+.5*sin(phase),secondary=.5+.5*sin(phase*2.17+vLockSeed*81.0);
      float strand=.42+.43*fine+.15*secondary;
      float root=mix(.85,1.0,smoothstep(0.0,.25,vLockUv.y));
      diffuseColor.rgb*=strand*root*(.91+.18*vLockSeed);
      float margin=min(vLockUv.x,1.0-vLockUv.x);
      if(margin<.014+.025*secondary || vLockUv.y>.94+.059*fine)discard;
    `).replace('#include <normal_fragment_begin>',`#include <normal_fragment_begin>
      vec3 dp1=dFdx(vViewPosition),dp2=dFdy(vViewPosition);
      vec2 du1=dFdx(vLockUv),du2=dFdy(vLockUv);
      vec3 across=dp1*du2.y-dp2*du1.y;
      float len=length(across);
      if(len>0.000001)normal=normalize(normal+across/len*sin(fiberPhase())*.08);
    `);
  };
  material.customProgramCacheKey=()=> 'milo-groom-fibers-v1';
  const mesh=new THREE.Mesh(geometry,material);mesh.name=`Milo groom ${style}`;mesh.userData.style=style;mesh.castShadow=true;mesh.receiveShadow=true;return mesh;
}
