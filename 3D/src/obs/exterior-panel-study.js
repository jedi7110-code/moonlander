import * as THREE from 'three';
import {createPanelWearMap,installPanelSoot} from './exterior-panel-weathering.js';

const paintNames=new Set(['Aged Macintosh beige','Habitat service skin','Replacement panel','Probe aged pressure panels']);
const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
export function clipPanelPolygon(subject,boundary){
  let result=subject;
  for(let edge=0;edge<boundary.length&&result.length;edge++){
    const a=boundary[edge],b=boundary[(edge+1)%boundary.length],input=result;result=[];
    for(let i=0;i<input.length;i++){
      const p=input[i],q=input[(i+1)%input.length],dp=cross(a,b,p),dq=cross(a,b,q);
      if(dp>=-1e-8)result.push(p);
      if((dp>=0)!==(dq>=0)){const t=dp/(dp-dq);result.push([p[0]+(q[0]-p[0])*t,p[1]+(q[1]-p[1])*t]);}
    }
  }
  return result;
}
const noise=(a,b,c)=>{const n=Math.sin(a*127.1+b*311.7+c*74.7)*43758.5453;return n-Math.floor(n);};

function clipPaintHeight(polygon,plane,height,lower){
  const result=[],distance=point=>plane.u.y*point[0]+plane.v.y*point[1]+plane.normal.y*plane.d-height;
  for(let index=0;index<polygon.length;index++){
    const start=polygon[index],end=polygon[(index+1)%polygon.length],startDistance=distance(start),endDistance=distance(end);
    const startInside=lower?startDistance<=0:startDistance>=0,endInside=lower?endDistance<=0:endDistance>=0;
    if(startInside)result.push(start);
    if(startInside!==endInside){const amount=startDistance/(startDistance-endDistance);result.push([start[0]+(end[0]-start[0])*amount,start[1]+(end[1]-start[1])*amount]);}
  }
  return result;
}

export function collectPaintPlanes(group){
  group.updateWorldMatrix(true,true);
    const inverse=group.matrixWorld.clone().invert(),planes=new Map(),point=new THREE.Vector3();
    group.traverse(mesh=>{
      if(!mesh.isMesh||mesh.material.transparent||!paintNames.has(mesh.material.name))return;
      for(let parent=mesh;parent&&parent!==group;parent=parent.parent)if(parent.userData.panelDetailExclude)return;
      const transform=inverse.clone().multiply(mesh.matrixWorld),geometry=mesh.geometry;
      const positions=geometry.attributes.position,index=geometry.index,count=index?.count??positions.count;
      for(let i=0;i<count;i+=3){
        const xyz=[0,1,2].map(j=>point.fromBufferAttribute(positions,index?index.getX(i+j):i+j).applyMatrix4(transform).clone());
        if(group.userData.panelKeepouts?.some(box=>xyz.every(p=>p.toArray().every((v,axis)=>v>=box.min[axis]-1e-5&&v<=box.max[axis]+1e-5))))continue;
        const normal=new THREE.Vector3().crossVectors(xyz[1].clone().sub(xyz[0]),xyz[2].clone().sub(xyz[0]));
        const area=normal.length()/2;if(area<1e-7)continue;normal.normalize();
        const d=normal.dot(xyz[0]),key=[...normal.toArray(),d].map(n=>Math.round(n*1000)).join('/');
        let plane=planes.get(key);
        if(!plane){
          const u=new THREE.Vector3(1,0,0).addScaledVector(normal,-normal.x);
          if(u.lengthSq()<.01)u.set(0,0,1).addScaledVector(normal,-normal.z);
          u.normalize();const v=new THREE.Vector3().crossVectors(normal,u);
          plane={normal,u,v,d,triangles:[],sources:[],area:0,min:[Infinity,Infinity],max:[-Infinity,-Infinity]};planes.set(key,plane);
        }
        const triangle=xyz.map(p=>[p.dot(plane.u),p.dot(plane.v)]);
        if(cross(...triangle)<0)triangle.reverse();
        plane.triangles.push(triangle);plane.sources.push({mesh,start:i});plane.area+=area;
        for(const p of triangle)for(let axis=0;axis<2;axis++){plane.min[axis]=Math.min(plane.min[axis],p[axis]);plane.max[axis]=Math.max(plane.max[axis],p[axis]);}
      }
    });
  return planes;
}

// This optional overlay belongs only to the craft study. Every plate is clipped
// to the real painted hull triangles, so it follows slopes and never bridges a
// window opening. The original model/materials are left intact for A/B switching.
export function createExteriorPanelStudy(ship,{probeOnly=false,replaceSkin=false,seamWidth=1,seamColor=0x50564f}={}){
  const faceMaterial=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.74,metalness:.23,flatShading:true});
  faceMaterial.name='Study / segmented exterior plates';
  const wearMap=createPanelWearMap(),weathering={value:0};installPanelSoot(faceMaterial,weathering);
  const edgeMaterial=new THREE.MeshStandardMaterial({color:seamColor,roughness:.72,metalness:.50,flatShading:true});
  edgeMaterial.name='Study / recessed joints and retainers';
  const roots=[],resources=[],stats={plates:0,triangles:0,replacedTriangles:0},covered=new Map();
  const oldResidue=[];
  (probeOnly?ship.dockedLander:ship.root).traverse(mesh=>{
    if(mesh.isMesh&&mesh.material?.name==='Local exhaust residue')oldResidue.push({mesh,visible:mesh.visible});
  });
  const parts=probeOnly?[{group:ship.dockedLander,pitch:[1.0,.8],gap:.018,depth:.010}]:[
    {group:ship.core,pitch:[3.2,1.9],gap:.022,depth:.010},
    ...ship.pods.map(group=>({group,pitch:[5.8,3.5],gap:.05,depth:.016})),
  ];
  for(const {group,pitch,gap:baseGap,depth}of parts){
    const gap=baseGap*seamWidth;
    // A's habitat paint combines its warm gray material tint with the beige
    // atlas. Preserve that darker finish on the optional segmented plates.
    const panelPaint=ship.pods.includes(group)?new THREE.Color(0xe0ded0).multiply(new THREE.Color(0xc1baa5)):new THREE.Color(0xc7c1ac);
    const planes=collectPaintPlanes(group);
    const positions=[],colors=[],edges=[],uvs=[];
    for(const [planeIndex,plane]of [...planes.values()].entries()){
      if(plane.area<(probeOnly?.12:.35))continue;
      const {u,v,normal,d}=plane;
      const beak=group===ship.core&&plane.triangles.every(triangle=>triangle.every(([horizontal,vertical])=>{
        const axial=u.x*horizontal+v.x*vertical+normal.x*d,height=u.y*horizontal+v.y*vertical+normal.y*d;
        const tip=axial>=15.6-1e-5&&height<=1.5+1e-5;
        const lowerBand=normal.y<-.3&&axial>=13.4-1e-5&&axial<=15.6+1e-5&&height<=-1;
        return tip||lowerBand;
      }));
      const facePaint=beak?new THREE.Color(0x767b72):panelPaint;
      const sideBand=group===ship.core&&Math.abs(normal.y)<1e-5&&Math.abs(normal.z)>.8&&plane.triangles.every(triangle=>triangle.every(([horizontal,vertical])=>{
        const axial=u.x*horizontal+v.x*vertical+normal.x*d;
        return axial>=13.4-1e-5&&axial<=15.6+1e-5;
      }));
      function vertex(dest,p,z){dest.push(u.x*p[0]+v.x*p[1]+normal.x*(d+z),u.y*p[0]+v.y*p[1]+normal.y*(d+z),u.z*p[0]+v.z*p[1]+normal.z*(d+z));}
      const nx=Math.max(1,Math.ceil((plane.max[0]-plane.min[0])/pitch[0]));
      // Keep the bow end as one continuous face: a central horizontal gap
      // reads as a mouth beneath the command windows.
      const bowEnd=group===ship.core&&plane.normal.x>.999&&Math.abs(plane.d-17.3)<.01;
      const ny=bowEnd?1:Math.max(1,Math.ceil((plane.max[1]-plane.min[1])/pitch[1]));
      const dx=(plane.max[0]-plane.min[0])/nx,dy=(plane.max[1]-plane.min[1])/ny;
      if(dx<gap*8||dy<gap*8)continue;
      if(replaceSkin)for(const {mesh,start}of plane.sources){
        if(!covered.has(mesh))covered.set(mesh,new Set());covered.get(mesh).add(start);
      }
      // Dark substrate makes actual panel gaps readable. It also prevents the
      // old painted seams from peeking through the new cut lines.
      for(const triangle of plane.triangles)for(const p of triangle)vertex(edges,p,.0015);
      for(let ix=0;ix<nx;ix++)for(let iy=0;iy<ny;iy++){
        const l=plane.min[0]+ix*dx+gap/2,r=l+dx-gap,b=plane.min[1]+iy*dy+gap/2,t=b+dy-gap;
        const k=Math.min(dx,dy)*(.02+noise(ix,iy,planeIndex)*.025);
        // Chamfered access plates and small offsets break the plain square grid.
        const cut=noise(ix,iy,planeIndex+9)>.5;
        const outline=cut?[[l+k,b],[r,b],[r,t-k],[r-k,t],[l,t],[l,b+k]]:
          [[l,b],[r,b],[r,t],[l,t]];
        const tone=noise(ix,iy,planeIndex+4);
        const color=facePaint.clone().multiplyScalar(.97+tone*.05);
        let added=false;
        for(const triangle of plane.triangles){
          const polygon=clipPanelPolygon(triangle,outline);if(polygon.length<3)continue;
          const surfaces=sideBand?[
            [clipPaintHeight(polygon,plane,-.5,true),new THREE.Color(0x767b72).multiplyScalar(.97+tone*.05)],
            [clipPaintHeight(polygon,plane,-.5,false),color],
          ]:[[polygon,color]];
          for(const [surface,tint]of surfaces)for(let corner=1;corner<surface.length-1;corner++){
            if(Math.abs(cross(surface[0],surface[corner],surface[corner+1]))<1e-8)continue;
            for(const point of [surface[0],surface[corner],surface[corner+1]]){
              vertex(positions,point,depth);colors.push(tint.r,tint.g,tint.b);
              const tile=Math.floor(noise(ix,iy,planeIndex+31)*4),flip=noise(ix,iy,planeIndex+15)>.5;
              const pu=(point[0]-l)/(r-l),pv=(point[1]-b)/(t-b);
              uvs.push((tile%2+.005+(flip?1-pu:pu)*.99)/2,(Math.floor(tile/2)+.005+pv*.99)/2);
            }
            stats.triangles++;added=true;
          }
          for(let j=0;j<polygon.length;j++){
            const p=polygon[j],q=polygon[(j+1)%polygon.length];
            // Sidewalls only at plate boundaries, never internal triangulation.
            if(!outline.some((a,i)=>Math.abs(cross(a,outline[(i+1)%outline.length],p))<1e-6&&Math.abs(cross(a,outline[(i+1)%outline.length],q))<1e-6))continue;
            for(const [coord,z]of [[p,0],[q,0],[q,depth],[p,0],[q,depth],[p,depth]])vertex(edges,coord,z);
          }
        }
        if(!added)continue;stats.plates++;
        // Inset retaining slots stay well inside their plate and actual skin.
        for(const [cx,cy]of [[l+dx*.16,b+dy*.15],[r-dx*.16,t-dy*.15]]){
          if(!plane.triangles.some(tri=>tri.every((p,i)=>cross(p,tri[(i+1)%3],[cx,cy])>=-1e-6)))continue;
          const w=Math.min(dx*.045,probeOnly?.025:.075),h=w*2.5;
          if(cx-w<l+k||cx+w>r-k||cy-h<b+k||cy+h>t-k)continue;
          const a=[cx-w/2,cy-h/2],bb=[cx+w/2,cy-h/2],c=[cx+w/2,cy+h/2],dd=[cx-w/2,cy+h/2];
          for(const p of [a,bb,c,a,c,dd])vertex(edges,p,depth+.002);
        }
      }
    }
    const overlay=new THREE.Group();overlay.name='Optional panel detail comparison';overlay.visible=false;group.add(overlay);roots.push(overlay);
    // Warnings and the aft wordmark sit just above A's skin. Lift copies onto
    // B's raised plates so their added thickness cannot bury the printed ink.
    group.updateWorldMatrix(true,true);const inverse=group.matrixWorld.clone().invert(),warnings=[];
    group.traverse(mesh=>{if(mesh.isMesh&&(mesh.userData.exteriorDecal||mesh.material?.userData?.exteriorInk))warnings.push(mesh);});
    for(const source of warnings){
      const geometry=(source.geometry.index?source.geometry.toNonIndexed():source.geometry.clone()).applyMatrix4(inverse.clone().multiply(source.matrixWorld));
      const p=geometry.attributes.position,a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3(),normal=new THREE.Vector3();
      for(let i=0;i<p.count;i+=3){
        a.fromBufferAttribute(p,i);b.fromBufferAttribute(p,i+1);c.fromBufferAttribute(p,i+2);normal.crossVectors(b.sub(a),c.sub(a)).normalize();
        for(let j=0;j<3;j++){const v=new THREE.Vector3().fromBufferAttribute(p,i+j).addScaledVector(normal,depth+.004);p.setXYZ(i+j,v.x,v.y,v.z);}
      }
      const ink=new THREE.Mesh(geometry,source.material);ink.name=source.userData.exteriorDecal?'Study B / preserved warning ink':'Study B / preserved wordmark ink';ink.receiveShadow=source.receiveShadow;overlay.add(ink);resources.push(geometry);
    }
    for(const [data,material,withColor]of [[positions,faceMaterial,true],[edges,edgeMaterial,false]]){
      if(!data.length)continue;
      const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(data,3));
      if(withColor){
        geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
        geometry.setAttribute('weatherRole',new THREE.Float32BufferAttribute(new Float32Array(data.length/3).fill(probeOnly?2:group===ship.core?0:1),1));
      }geometry.computeVertexNormals();
      // Once the old skin is removed, its continuous backing must still cast
      // the hull silhouette. Only the backing casts, avoiding a second almost
      // coplanar shadow surface for every raised paint face.
      const mesh=new THREE.Mesh(geometry,material);mesh.castShadow=replaceSkin&&!withColor;mesh.receiveShadow=true;mesh.name=material.name;overlay.add(mesh);resources.push(geometry);
    }
  }
  // Production replaces the buried painted triangles instead of drawing a
  // second complete pressure skin. Keep apertures, hatches and small fittings.
  if(replaceSkin)for(const [mesh,removed]of covered){
    const source=mesh.geometry,indices=source.index,count=indices?.count??source.attributes.position.count,kept=[];
    for(let i=0;i<count;i+=3)if(!removed.has(i))for(let j=0;j<3;j++)kept.push(indices?indices.getX(i+j):i+j);
    const geometry=new THREE.BufferGeometry();
    for(const [name,attribute]of Object.entries(source.attributes)){
      const values=new attribute.array.constructor(kept.length*attribute.itemSize);
      kept.forEach((index,i)=>{for(let j=0;j<attribute.itemSize;j++)values[i*attribute.itemSize+j]=attribute.array[index*attribute.itemSize+j];});
      geometry.setAttribute(name,new THREE.BufferAttribute(values,attribute.itemSize,attribute.normalized));
    }
    stats.replacedTriangles+=removed.size;mesh.geometry=geometry;source.dispose();
    if(!kept.length)mesh.visible=false;
  }
  return{stats,setEnabled(value){roots.forEach(group=>{group.visible=Boolean(value);});oldResidue.forEach(({mesh,visible})=>{mesh.visible=value?false:visible;});},
    setWeathering(value){weathering.value=value?1:0;faceMaterial.map=value?wearMap:null;faceMaterial.roughness=value?.90:.74;faceMaterial.needsUpdate=true;},
    dispose(){oldResidue.forEach(({mesh,visible})=>{mesh.visible=visible;});roots.forEach(group=>group.removeFromParent());resources.forEach(geometry=>geometry.dispose());wearMap?.dispose();faceMaterial.dispose();edgeMaterial.dispose();}};
}
