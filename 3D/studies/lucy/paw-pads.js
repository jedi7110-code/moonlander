import { BufferGeometry, Float32BufferAttribute, Uint16BufferAttribute,
  Mesh, MeshBasicMaterial, MeshStandardMaterial, DoubleSide, Raycaster,
  Vector3, Triangle, SkinnedMesh } from 'three';

// Small fitted skin patches, not spheres stuck through the feet. Sample both
// the sole and its rig weights so the pads follow the same wrist/toe surface.
export function addLucyPawPads(root) {
  if(root.getObjectByName('Lucy paw pad front L central')) return;
  let source;
  root.traverse(m => {if(m.material?.name === 'Lucy calico coat') source = m;});
  if(!source) throw new Error('Paw pads require the Lucy coat');
  const a = source.geometry.attributes;
  // Raycast only foot triangles. Scanning the whole cat for each pad sample
  // otherwise adds seconds to the study's initial load.
  const inspectionGeometry=new BufferGeometry(), soleIndices=[];
  const sourceIndex=source.geometry.index;
  for(let i=0;i<(sourceIndex?.count??a.position.count);i+=3) {
    const tri=[0,1,2].map(k=>sourceIndex?sourceIndex.getX(i+k):i+k);
    if(tri.every(j=>a.position.getY(j)<.035)) soleIndices.push(...tri);
  }
  inspectionGeometry.setAttribute('position',a.position);inspectionGeometry.setIndex(soleIndices);
  const inspection = new Mesh(inspectionGeometry,new MeshBasicMaterial({side:DoubleSide}));
  inspection.updateMatrixWorld();
  const ray = new Raycaster(), bary = new Vector3();
  const material = new MeshStandardMaterial({name:'Soft pink paw pads',color:0xc98c91,roughness:.76});
  const segments = 48, rings = 8;
  for(const side of ['L','R']) for(const rear of [false,true]) {
    const sign = side === 'L' ? 1 : -1;
    const shiftZ = rear ? -.158 : 0;
    const layout = [
      ['central',.022,.146,.0056,rear?.0056:.0045],
      ['toe 1',.0148,.153,.0021,.0025],
      ['toe 2',.0198,.158,.0022,.0026],
      ['toe 3',.025,.1578,.0022,.0026],
      ['toe 4',.030,.1527,.0020,.0025],
    ];
    for(const [label,cx,cz,rx,rz] of layout) {
      const positions=[],joints=[],weights=[],indices=[];
      const morphEntries=Object.entries(source.geometry.morphAttributes);
      const morphs=Object.fromEntries(morphEntries.map(([key,list])=>[key,list.map(()=>[])]));
      function vertex(radius,angle) {
        const contour = label === 'central' ? 1+.105*Math.sin(angle*3) : 1;
        const x=sign*(cx+rx*radius*Math.cos(angle)*contour);
        const z=cz+shiftZ+rz*radius*Math.sin(angle)*contour;
        ray.set(new Vector3(x,-.035,z),new Vector3(0,1,0));
        const hit=ray.intersectObject(inspection)[0];
        if(!hit || hit.point.y>.025) throw new Error(`Paw pad outside sole: ${side} ${rear} ${label}`);
        const corners=[hit.face.a,hit.face.b,hit.face.c];
        Triangle.getBarycoord(hit.point,...corners.map(i=>new Vector3().fromBufferAttribute(a.position,i)),bary);
        const blend=bary.toArray();
        // The rim overlaps the fur very slightly; the middle rises by <0.4 mm
        // at the study scale, preserving the existing ground clearance.
        positions.push(x,hit.point.y-.00020*(1-radius*radius)+.000015*radius**8,z);
        const contributions=new Map();
        corners.forEach((i,j)=>{
          for(let k=0;k<4;k++) {
            const bone=a.skinIndex.array[i*4+k],weight=a.skinWeight.array[i*4+k]*blend[j];
            contributions.set(bone,(contributions.get(bone)??0)+weight);
          }
        });
        const sorted=[...contributions].filter(([,w])=>w>0).sort((a,b)=>b[1]-a[1]).slice(0,4);
        const sum=sorted.reduce((s,[,w])=>s+w,0);
        for(let i=0;i<4;i++){joints.push(sorted[i]?.[0]??0);weights.push((sorted[i]?.[1]??0)/sum);}
        for(const [key,list] of morphEntries) list.forEach((attribute,m)=>{
          const v=new Vector3();corners.forEach((i,j)=>v.addScaledVector(new Vector3().fromBufferAttribute(attribute,i),blend[j]));
          morphs[key][m].push(...v.toArray());
        });
      }
      vertex(0,0);
      for(let ring=1;ring<=rings;ring++)for(let i=0;i<segments;i++)vertex(ring/rings,i/segments*Math.PI*2);
      for(let i=0;i<segments;i++) indices.push(0,1+i,1+(i+1)%segments);
      for(let ring=1;ring<rings;ring++)for(let i=0;i<segments;i++){
        const a=1+(ring-1)*segments+i,b=1+(ring-1)*segments+(i+1)%segments,c=a+segments,d=b+segments;
        indices.push(a,c,b,b,c,d);
      }
      // Mirroring x reverses winding; the visible side must still face out.
      if(sign<0) for(let i=0;i<indices.length;i+=3)[indices[i+1],indices[i+2]]=[indices[i+2],indices[i+1]];
      const geometry=new BufferGeometry();
      geometry.setAttribute('position',new Float32BufferAttribute(positions,3));
      geometry.setAttribute('skinIndex',new Uint16BufferAttribute(joints,4));
      geometry.setAttribute('skinWeight',new Float32BufferAttribute(weights,4));
      geometry.setIndex(indices);geometry.computeVertexNormals();
      for(const [key,list] of Object.entries(morphs)) geometry.morphAttributes[key]=list.map(values=>new Float32BufferAttribute(values,3));
      geometry.morphTargetsRelative=source.geometry.morphTargetsRelative;
      const mesh=new SkinnedMesh(geometry,material);
      mesh.name=`Lucy paw pad ${rear?'rear':'front'} ${side} ${label}`;
      mesh.position.copy(source.position);mesh.quaternion.copy(source.quaternion);mesh.scale.copy(source.scale);
      mesh.bind(source.skeleton,source.bindMatrix);mesh.frustumCulled=false;
      mesh.morphTargetDictionary={...source.morphTargetDictionary};mesh.morphTargetInfluences=source.morphTargetInfluences;
      mesh.castShadow=true;mesh.receiveShadow=true;source.parent.add(mesh);
    }
  }
  inspection.material.dispose();
  inspectionGeometry.dispose();
}
