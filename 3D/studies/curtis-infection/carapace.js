import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

// Geometry is batched per moving anatomical region, rather than one draw per bump.
export function createCarapace(root){
  const shell=new THREE.MeshStandardMaterial({color:'#454b33',roughness:.84,flatShading:true});
  const nodules=new THREE.MeshStandardMaterial({color:'#666b49',roughness:.9,flatShading:true});
  const horn=new THREE.MeshStandardMaterial({color:'#9a9670',roughness:.72,vertexColors:true});
  const regions=[];
  const up=new THREE.Vector3(0,1,0);
  function region(parent,position,onset,name){
    const group=new THREE.Group();group.name=name;group.position.set(...position);parent.add(group);
    const parts=[[],[],[]];regions.push({group,onset,parts});return parts;
  }
  function lump(parts,position,scale,type=0,rotation=0){
    const geo=new THREE.IcosahedronGeometry(1,type===0?1:0);
    geo.scale(...scale);geo.rotateZ(rotation);geo.translate(...position);parts[type].push(geo);
  }
  function spike(parts,position,direction,length,radius){
    const rows=9,cols=9,vertices=[],colors=[],indices=[];
    const q=new THREE.Quaternion().setFromUnitVectors(up,new THREE.Vector3(...direction).normalize());
    const base=new THREE.Color('#525a38'),tip=new THREE.Color('#c2b78c');
    for(let j=0;j<=rows;j++)for(let i=0;i<=cols;i++){
      const t=j/rows,a=i/cols*Math.PI*2,r=radius*Math.pow(1-t,.85)+.0005;
      const point=new THREE.Vector3(Math.cos(a)*r,t*length,Math.sin(a)*r-length*.20*t*t).applyQuaternion(q).add(new THREE.Vector3(...position));
      vertices.push(...point.toArray());colors.push(...base.clone().lerp(tip,t*t).toArray());
      if(j<rows&&i<cols){const v=j*(cols+1)+i,w=v+cols+1;indices.push(v,w,v+1,w,w+1,v+1);}
    }
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geo.setIndex(indices);geo.computeVertexNormals();parts[2].push(geo);
  }
  const {spine,arms}=root.userData;
  for(const {arm,side}of arms){
    const p=region(arm,[0,-.045,-.015],side<0?.02:.20,'Curtis knobbled shoulder carapace');
    lump(p,[0,0,0],[.145,.115,.143]);
    for(let j=0;j<3;j++)lump(p,[side*.015,-.055-j*.037,-.01],[.137-j*.012,.055,.125-j*.008],0,side*.13);
    for(let i=0;i<13;i++){
      const a=i*2.399,y=.015+Math.sin(i*1.8)*.045;
      const x=Math.cos(a)*.112,z=Math.sin(a)*.115;
      lump(p,[x,y,z],[.023+i%3*.004,.025,.024],1);
    }
    for(let i=0;i<5;i++){
      const a=-.8+i*.48,x=side*(.082+Math.cos(a)*.030),z=Math.sin(a)*.09;
      spike(p,[x,.055,z],[side*.7,.85,z*4],.095+(i%3)*.025,.026);
    }
  }
  for(const side of [-1,1]){
    const p=region(spine.drivers[2],[side*.115,1.405,-.225],side<0?.10:.22,'Curtis scapular shell');
    for(let i=0;i<3;i++)lump(p,[side*.014*i,-.078*i,-.018*i],[.125-i*.015,.116-i*.009,.064],0,side*.20);
    for(let i=0;i<11;i++){
      const a=i*2.4,r=.035+(i%3)*.018;
      lump(p,[Math.cos(a)*r,Math.sin(a)*r-.05,-.068],[.019,.021,.016],1);
    }
    for(let i=0;i<3;i++)spike(p,[side*.075,-i*.065,-.063],[side*.65,.35,-1],.105-i*.015,.025);
  }
  for(let i=0;i<8;i++){
    const y=1.10+i*.064,index=THREE.MathUtils.clamp(Math.round((y-1.02)/.18),0,3);
    const p=region(spine.drivers[index],[0,y,-.230-i*.003],.12+(7-i)*.018,`Curtis spined vertebra ${i}`);
    lump(p,[0,0,0],[.066,.052,.043]);
    lump(p,[-.044,0,-.024],[.022,.024,.022],1);lump(p,[.044,0,-.024],[.022,.024,.022],1);
    spike(p,[0,.008,-.030],[0,.32,-1],.075+i*.012,.025+i*.001);
  }
  for(const {group,parts}of regions)parts.forEach((geos,i)=>{
    if(!geos.length)return;
    const geometry=mergeGeometries(geos),mesh=new THREE.Mesh(geometry,[shell,nodules,horn][i]);
    mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);geos.forEach(g=>g.dispose());
  });
  return {update(progress){
    for(const {group,onset}of regions){
      const growth=THREE.MathUtils.smoothstep(progress,onset,onset+.44);
      group.visible=growth>.005;group.scale.setScalar(growth);
    }
  }};
}
