import { BufferGeometry, TubeGeometry, CatmullRomCurve3, Vector3, Float32BufferAttribute,
  Uint16BufferAttribute, SkinnedMesh, Mesh, Raycaster, MeshStandardMaterial, DoubleSide } from 'three';

const smooth = (a, b, v) => {
  const t = Math.max(0, Math.min(1, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
// Same head refinement as the approved surface, applied to the new lids.
function refine(x) {
  return x - x * .07 - Math.sign(x) * .0012 * smooth(0, .012, Math.abs(x));
}

// Complete surfaces replace the open-eye islands in this sleeping study.
// They are bound to the skull, rather than flattened eyeballs or empty sockets.
export function addSleepingEyelids(root) {
  if(root.getObjectByName('Sleeping eyelid L')) return;
  let source;
  root.traverse(mesh => {
    if(mesh.material?.name === 'Lucy calico coat') source = mesh;
    if(['Hazel iris', 'Pupils and eye margin'].includes(mesh.material?.name)) mesh.visible = false;
  });
  const head = source.skeleton.bones.findIndex(bone => bone.name === 'Bone004');
  if(head < 0) throw new Error('Sleeping eyelids require the Lucy skull bone');
  const lidMaterial = new MeshStandardMaterial({name:'Closed eyelid coat', vertexColors:true, roughness:.88, side:DoubleSide});
  const seamMaterial = new MeshStandardMaterial({name:'Closed eyelid crease', color:0x594535, roughness:1});
  const inspectionMaterial = new MeshStandardMaterial({side:DoubleSide});
  const inspection = new Mesh(source.geometry,inspectionMaterial);
  inspection.updateMatrixWorld();
  const ray = new Raycaster();
  function attach(geometry, material, name) {
    const count = geometry.attributes.position.count;
    const joints = new Uint16Array(count * 4), weights = new Float32Array(count * 4);
    for(let i=0;i<count;i++){joints[i*4]=head;weights[i*4]=1;}
    geometry.setAttribute('skinIndex',new Uint16BufferAttribute(joints,4));
    geometry.setAttribute('skinWeight',new Float32BufferAttribute(weights,4));
    const mesh = new SkinnedMesh(geometry,material);mesh.name=name;
    mesh.position.copy(source.position);mesh.quaternion.copy(source.quaternion);mesh.scale.copy(source.scale);
    mesh.bind(source.skeleton,source.bindMatrix);mesh.frustumCulled=false;
    source.parent.add(mesh);return mesh;
  }
  for(const [side,label] of [[-1,'R'],[1,'L']]) {
    // Sample the socket rim on the actual coat. A curved patch meets that
    // sloping rim; a separate ellipsoid would look like a button on the face.
    const segments=64,rings=12,cx=side*.015,cy=.1875,rx=.007,ry=.0045;
    const rim=Array.from({length:segments},(_,i)=>{
      const angle=i/segments*Math.PI*2;
      ray.set(new Vector3(cx+rx*Math.cos(angle),cy+ry*Math.sin(angle),.30),new Vector3(0,0,-1));
      const hit=ray.intersectObject(inspection).find(hit=>hit.point.z>.23);
      if(!hit) throw new Error('Closed eyelid rim must meet the face');
      return hit.point.z;
    });
    const middle=rim.reduce((a,b)=>a+b,0)/segments;
    function depth(u,v){
      const r=Math.min(1,Math.hypot(u,v)),angle=(Math.atan2(v,u)+Math.PI*2)%(Math.PI*2);
      const at=angle/(Math.PI*2)*segments,i=Math.floor(at),t=at-i;
      const edge=rim[i]*(1-t)+rim[(i+1)%segments]*t;
      return middle+(edge-middle)*r+.00015*(1-r*r)-.00002*r**8;
    }
    const geometry=new BufferGeometry(),positions=[],colors=[],indices=[];
    function vertex(u,v){
      const x=cx+rx*u,y=cy+ry*v;
      positions.push(refine(x),y,depth(u,v));
      const white=Math.max(1-smooth(.174,.184,y),1-smooth(.004,.009,Math.abs(x)));
      const dark=(1-smooth(-.025,-.015,x))*smooth(.184,.210,y);
      for(const [ginger,ivory,black] of [[.37,.80,.018],[.13,.77,.022],[.035,.69,.021]]){
        const base=ginger+(black-ginger)*dark;colors.push(base+(ivory-base)*white);
      }
    }
    vertex(0,0);
    for(let ring=1;ring<=rings;ring++)for(let i=0;i<segments;i++){
      const angle=i/segments*Math.PI*2;vertex(Math.cos(angle)*ring/rings,Math.sin(angle)*ring/rings);
    }
    for(let i=0;i<segments;i++)indices.push(0,1+i,1+(i+1)%segments);
    for(let ring=1;ring<rings;ring++)for(let i=0;i<segments;i++){
      const a=1+(ring-1)*segments+i,b=1+(ring-1)*segments+(i+1)%segments,c=a+segments,d=b+segments;
      indices.push(a,c,b,b,c,d);
    }
    geometry.setAttribute('position',new Float32BufferAttribute(positions,3));geometry.setIndex(indices);
    geometry.setAttribute('color',new Float32BufferAttribute(colors,3));geometry.computeVertexNormals();
    attach(geometry,lidMaterial,'Sleeping eyelid '+label);
    const points=[];
    for(let i=0;i<=24;i++) {
      const u=-.93+i/24*1.86;
      const v=-.14-.12*(1-u*u),y=cy+v*ry;
      points.push(new Vector3(refine(cx+u*rx),y,depth(u,v)+.00008));
    }
    attach(new TubeGeometry(new CatmullRomCurve3(points),32,.00014,6,false),seamMaterial,'Sleeping eyelid crease '+label);
  }
  inspectionMaterial.dispose();
}
