import * as THREE from 'three';
import {box,ball,cylinder,pipe,rod} from './materials.js';

const up=new THREE.Vector3(0,1,0),down=new THREE.Vector3(0,-1,0);
const samples=81,linkLength=.98,parkDrop=.46;
// Hair growth nudges its morph weights every frame; changes this small cannot move the stripe.
const morphTolerance=1e-3,primeBudget=20000;
const _skinTransform=new THREE.Matrix4(),_boneMatrices=[],_a=new THREE.Vector3(),_b=new THREE.Vector3(),_c=new THREE.Vector3();

// SkinnedMesh.applyBoneTransform rebuilds a bone matrix for every vertex
// influence. Build each one once per bake; the vertex maths is otherwise the same.
function prepareSkin(mesh,transform){
  const {bones,boneInverses}=mesh.skeleton;
  for(let i=0;i<bones.length;i++)(_boneMatrices[i]??=new THREE.Matrix4()).multiplyMatrices(bones[i].matrixWorld,boneInverses[i]).multiply(mesh.bindMatrix);
  _skinTransform.multiplyMatrices(transform,mesh.bindMatrixInverse);
}

// Direct typed-array reads; interleaved or quantised attributes are expanded first.
function floats(attribute){
  if(!attribute.isInterleavedBufferAttribute&&!attribute.normalized)return attribute.array;
  const out=new Float32Array(attribute.count*attribute.itemSize),get=['getX','getY','getZ','getW'];
  for(let i=0;i<attribute.count;i++)for(let k=0;k<attribute.itemSize;k++)out[i*attribute.itemSize+k]=attribute[get[k]](i);
  return out;
}

// Mesh.getVertexPosition + SkinnedMesh.applyBoneTransform, written straight into
// the baked array: three's per-vertex helpers made each bake several times slower.
// Returns the baked x range, which is all the beam needs from the bounds.
function bakeSurface(mesh,transform,positions){
  const geometry=mesh.geometry,count=geometry.attributes.position.count,source=floats(geometry.attributes.position),out=positions.array;
  const influences=mesh.morphTargetInfluences,relative=geometry.morphTargetsRelative;
  const morphs=(geometry.morphAttributes.position??[]).flatMap((attribute,k)=>influences?.[k]?[[floats(attribute),influences[k]]]:[]);
  const skinned=mesh.isSkinnedMesh,skinIndex=skinned&&floats(geometry.attributes.skinIndex),skinWeight=skinned&&floats(geometry.attributes.skinWeight);
  if(skinned)prepareSkin(mesh,transform);
  const e=(skinned?_skinTransform:transform).elements;
  let minX=Infinity,maxX=-Infinity;
  for(let i=0;i<count;i++){
    let x=source[i*3],y=source[i*3+1],z=source[i*3+2];
    if(morphs.length){
      let mx=0,my=0,mz=0;
      for(const [morph,weight] of morphs){
        const ax=morph[i*3],ay=morph[i*3+1],az=morph[i*3+2];
        if(relative){mx+=ax*weight;my+=ay*weight;mz+=az*weight;}else{mx+=(ax-x)*weight;my+=(ay-y)*weight;mz+=(az-z)*weight;}
      }
      x+=mx;y+=my;z+=mz;
    }
    if(skinned){
      let sx=0,sy=0,sz=0;
      for(let k=i*4;k<i*4+4;k++){
        const weight=skinWeight[k];if(weight===0)continue;
        const b=_boneMatrices[skinIndex[k]].elements;
        sx+=(b[0]*x+b[4]*y+b[8]*z+b[12])*weight;sy+=(b[1]*x+b[5]*y+b[9]*z+b[13])*weight;sz+=(b[2]*x+b[6]*y+b[10]*z+b[14])*weight;
      }
      x=sx;y=sy;z=sz;
    }
    const px=e[0]*x+e[4]*y+e[8]*z+e[12];
    out[i*3]=px;out[i*3+1]=e[1]*x+e[5]*y+e[9]*z+e[13];out[i*3+2]=e[2]*x+e[6]*y+e[10]*z+e[14];
    if(px<minX)minX=px;if(px>maxX)maxX=px;
  }
  positions.needsUpdate=true;
  return [minX,maxX];
}

// Expects rig.surfaceTransform to hold the mesh-to-rig transform.
function scanSurface(mesh,rig){
  let cached=rig.surfaces.get(mesh);
  if(!cached||cached.source!==mesh.geometry){
    const geometry=new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.Float32BufferAttribute(mesh.geometry.attributes.position.count*3,3));
    geometry.setIndex(new THREE.BufferAttribute(new Uint32Array(mesh.geometry.index?.count??mesh.geometry.attributes.position.count),1));
    cached={source:mesh.geometry,mesh:new THREE.Mesh(geometry,mesh.material),transform:new THREE.Matrix4()};
    rig.surfaces.set(mesh,cached);
  }
  // Deform each vertex once per pose, not once for every ray/triangle. This
  // CPU-only surface is never rendered and follows the same skin/morphs as the GPU.
  const target=cached.mesh,positions=target.geometry.attributes.position;
  if(mesh.isSkinnedMesh)mesh.skeleton.update();
  const bones=mesh.isSkinnedMesh?mesh.skeleton.boneMatrices:null,morphs=mesh.morphTargetInfluences,version=mesh.geometry.attributes.position.version;
  if(version!==cached.version||!cached.transform.equals(rig.surfaceTransform)||bones?.some((value,i)=>value!==cached.bones[i])||morphs?.some((weight,i)=>Math.abs(weight-cached.morphs[i])>morphTolerance)){
    cached.transform.copy(rig.surfaceTransform);
    [cached.minX,cached.maxX]=bakeSurface(mesh,cached.transform,positions);rig.bakedVertices+=positions.count;
    if(bones){cached.bones??=new Float32Array(bones.length);cached.bones.set(bones);}
    if(morphs)cached.morphs=[...morphs];
    cached.version=version;
  }
  return cached;
}

function scanSlice({source,mesh:target},material,rig,sweep){
  // Only triangles crossing this scan plane can meet its downward rays.
  // Keep material groups while culling the rest before the per-sample raycasts.
  const positions=target.geometry.attributes.position.array,index=source.index?.array,filtered=target.geometry.index.array;
  const groups=source.groups.length?source.groups:[{start:0,count:index?.length??positions.length/3,materialIndex:0}];
  let count=0;target.geometry.clearGroups();
  for(const group of groups){
    const start=count,end=Math.min(group.start+group.count,source.drawRange.start+source.drawRange.count);
    for(let i=Math.max(group.start,source.drawRange.start);i<end;i+=3){
      const a=index?index[i]:i,b=index?index[i+1]:i+1,c=index?index[i+2]:i+2;
      const ax=positions[a*3],bx=positions[b*3],cx=positions[c*3];
      if(Math.min(ax,bx,cx)>sweep||Math.max(ax,bx,cx)<sweep)continue;
      filtered[count++]=a;filtered[count++]=b;filtered[count++]=c;
    }
    target.geometry.addGroup(start,count-start,group.materialIndex);
  }
  target.geometry.setDrawRange(0,count);
  target.material=material;target.matrixWorld.copy(rig.root.matrixWorld);
  return target;
}

function boom(parent,m){
  const root=new THREE.Group();parent.add(root);
  cylinder(root,m.dark,0,.5,0,.047,1,.047,16);
  box(root,m.enamel,0,.38,0,.125,.54,.13,.024).name='Diagnostic arm housing';
  box(root,m.teal,0,.40,.067,.07,.19,.009,.006);
  // Seat collars beyond the cover ends instead of cutting through its faces.
  for(const yy of [.075,.70])cylinder(root,m.metal,0,yy,0,.067,.055,.067,16).name='Diagnostic arm collar';
  rod(root,m.rubber,[.076,.09,0],[.076,.83,0],.016);
  return root;
}

function arm(parent,m,index){
  const root=new THREE.Group();root.name=index?'Ceiling diagnostic arm / probe':'Ceiling diagnostic arm / scanner';parent.add(root);
  const base=new THREE.Vector3(index?.85:-.65,2.63,index?.12:-.30),side=index?1:-1;
  cylinder(root,m.dark,base.x,2.70,base.z,.14,.12,.14,24);
  const shoulder=ball(root,m.metal,...base.toArray(),.105,.105,.105);
  const upper=boom(root,m),lower=boom(root,m),elbow=ball(root,m.dark,0,0,0,.104,.104,.104);
  const tip=new THREE.Group();tip.name=index?'Non-contact examination probe':'Green line scanner';root.add(tip);
  ball(tip,m.metal,0,.09,0,.079,.079,.079);
  box(tip,m.enamel,0,-.025,0,index?.19:.29,.17,index?.22:.32,.036);
  box(tip,m.rubber,0,-.116,0,index?.14:.24,.02,index?.18:.22,.006);
  const glow=new THREE.MeshBasicMaterial({color:0x65ff87,toneMapped:false});
  const lens=box(tip,glow,0,-.129,0,index?.055:.19,.013,index?.09:.027,.004);
  if(index)for(const xx of [-.06,.06])cylinder(tip,m.metal,xx,-.13,.065,.016,.037,.016,16);
  // Leave room between the folded housings; closing to .30 makes their flat
  // front faces overlap in the same plane and flicker as the camera moves.
  return{root,base,side,shoulder,upper,lower,elbow,tip,lens,glow,park:base.clone().add(new THREE.Vector3(0,-parkDrop,0)),target:new THREE.Vector3(),joint:new THREE.Vector3(),axis:new THREE.Vector3(),bend:new THREE.Vector3()};
}

function placeArm(arm,work,extension){
  arm.target.copy(arm.park).lerp(work,extension);
  arm.axis.copy(arm.target).sub(arm.base);
  const distance=arm.axis.length();arm.axis.normalize();
  arm.bend.set(arm.side,0,0).addScaledVector(arm.axis,-arm.side*arm.axis.x).normalize();
  arm.joint.copy(arm.base).addScaledVector(arm.axis,distance/2).addScaledVector(arm.bend,Math.sqrt(Math.max(0,linkLength**2-distance**2/4)));
  arm.elbow.position.copy(arm.joint);arm.tip.position.copy(arm.target);
  for(const [part,a,b]of [[arm.upper,arm.base,arm.joint],[arm.lower,arm.joint,arm.target]]){
    part.position.copy(a);arm.axis.copy(b).sub(a);part.scale.y=arm.axis.length();part.quaternion.setFromUnitVectors(up,arm.axis.normalize());
  }
}

export function createMedicalRig(m,{x,y,depth,top}){
  const root=new THREE.Group();root.name='Ceiling diagnostic rig';root.position.set(x,y,0);
  box(root,m.dark,0,2.74,-.10,3.40,.10,.56,.018);
  for(const zz of [-.32,.13])rod(root,m.metal,[-1.62,2.675,zz],[1.62,2.675,zz],.025);
  for(const xx of [-1.2,0,1.2]){
    box(root,m.enamel,xx,2.735,.20,.40,.12,.20,.014);
    box(root,m.coolLamp,xx,2.668,.20,.31,.014,.12,.008);
  }
  for(const side of [-1,1]){
    pipe(root,m.rubber,[[side*1.48,2.70,-.28],[side*1.48,2.64,-.70],[side*1.28,2.53,-1.34]],.026);
    box(root,m.metal,side*1.48,2.63,-.74,.10,.12,.075,.009);
  }
  const arms=[arm(root,m,0),arm(root,m,1)];
  const scan=new THREE.Group();scan.name='Surface-following green scan';root.add(scan);scan.visible=false;
  const fanGeometry=new THREE.BufferGeometry(),stripeGeometry=new THREE.BufferGeometry();
  fanGeometry.setAttribute('position',new THREE.BufferAttribute(new Float32Array((samples-1)*9),3));
  stripeGeometry.setAttribute('position',new THREE.BufferAttribute(new Float32Array((samples-1)*18),3));
  const fan=new THREE.Mesh(fanGeometry,new THREE.MeshBasicMaterial({color:0x42ff78,transparent:true,opacity:.045,blending:THREE.AdditiveBlending,side:THREE.DoubleSide,depthWrite:false,toneMapped:false}));
  const stripe=new THREE.Mesh(stripeGeometry,new THREE.MeshBasicMaterial({color:0x67ff8c,transparent:true,opacity:.94,side:THREE.DoubleSide,depthWrite:false,toneMapped:false}));
  fan.frustumCulled=false;stripe.frustumCulled=false;scan.add(fan,stripe);
  // Hidden objects are not drawn, so these shaders would compile on the first scan
  // frame. Empty, always-drawn copies compile them with the rest of the cabin.
  for(const material of [fan.material,stripe.material]){
    const primer=new THREE.Mesh(new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute([],3)),material);
    primer.name='Scan shader primer';primer.frustumCulled=false;root.add(primer);
  }
  const rig={root,arms,scan,fan,stripe,depth,top,bakedVertices:0,work:new THREE.Vector3(),beam:new THREE.Ray(new THREE.Vector3(),down.clone()),heights:new Float64Array(samples),point:new THREE.Vector3(),source:new THREE.Vector3(),points:Array.from({length:samples},()=>new THREE.Vector3()),targets:[],rayTargets:[],surfaces:new WeakMap(),surfaceTransform:new THREE.Matrix4(),bounds:new THREE.Box3(),patient:null};
  animateMedicalRig(rig,{extension:0,elevation:0},0);return rig;
}

const sweepAt=age=>-.82+1.60*(1-Math.cos(age*Math.PI/4))/2;

// The patient already lies still while the arms deploy. Bake the rigid parts a few
// per frame, then rehearse the first sweep once in a frame of its own, so the first
// scan frame neither bakes the head/hair nor runs cold code.
function primeScan(rig,patient){
  if(rig.primed===patient)return;
  if(rig.rehearse===patient){scanPatient(rig,patient,sweepAt(0));rig.primed=patient;return;}
  patient.updateWorldMatrix(true,false);patient.updateMatrixWorld(true);rig.root.updateWorldMatrix(true,false);
  const start=rig.bakedVertices;let pending=false;
  patient.traverseVisible(mesh=>{
    if(!mesh.isMesh||/toon outline$/.test(mesh.name))return;
    // Skins re-bake on every scan frame anyway (breathing); one early bake warms that path.
    if(mesh.isSkinnedMesh&&rig.surfaces.get(mesh)?.source===mesh.geometry)return;
    if(rig.bakedVertices-start>=primeBudget){pending=true;return;}
    rig.surfaceTransform.copy(rig.root.matrixWorld).invert().multiply(mesh.matrixWorld);scanSurface(mesh,rig);
  });
  if(!pending)rig.rehearse=patient;
}

export function animateMedicalRig(rig,pose,age,{patient=null,scanning=false}={}){
  const sweep=sweepAt(age);
  rig.work.set(sweep,1.56,rig.depth);placeArm(rig.arms[0],rig.work,pose.extension);
  rig.work.set(-.23+.16*Math.sin(age*.7),1.50+.045*Math.sin(age*.9),rig.depth+.17);placeArm(rig.arms[1],rig.work,pose.extension);
  for(const arm of rig.arms)arm.glow.color.setHex(scanning?0x65ff87:0x315244);
  rig.scan.visible=scanning&&Boolean(patient)&&pose.extension===1;
  if(!rig.scan.visible){if(patient&&pose.phase==='deploying')primeScan(rig,patient);return;}
  rig.primed=rig.rehearse=null;scanPatient(rig,patient,sweep);
  const fan=rig.fan.geometry.attributes.position,stripe=rig.stripe.geometry.attributes.position;
  for(let i=0;i<samples-1;i++){
    const a=rig.points[i],b=rig.points[i+1];
    fan.setXYZ(i*3,rig.source.x,rig.source.y,rig.source.z);fan.setXYZ(i*3+1,a.x,a.y,a.z);fan.setXYZ(i*3+2,b.x,b.y,b.z);
    const offsets=[[-.01,a],[.01,a],[-.01,b],[.01,a],[.01,b],[-.01,b]];
    offsets.forEach(([offset,p],j)=>stripe.setXYZ(i*6+j,p.x+offset,p.y,p.z));
  }
  fan.needsUpdate=true;stripe.needsUpdate=true;
}

function scanPatient(rig,patient,sweep){
  patient.updateWorldMatrix(true,false);patient.updateMatrixWorld(true);rig.root.updateWorldMatrix(true,true);
  // The connected skin is a sibling of the old body parts, not their child.
  // Refresh visible targets also after asynchronous model attachment/replacement.
  rig.patient=patient;rig.targets.length=0;rig.rayTargets.length=0;
  patient.traverseVisible(mesh=>{
    // Toon ink shells repeat the surface they outline.
    if(!mesh.isMesh||/toon outline$/.test(mesh.name))return;
    rig.targets.push(mesh);
    rig.surfaceTransform.copy(rig.root.matrixWorld).invert().multiply(mesh.matrixWorld);
    // Rigid parts keep their local bounds, so bake them only once the beam reaches them.
    if(!mesh.isSkinnedMesh){
      if(!mesh.geometry.boundingBox)mesh.geometry.computeBoundingBox();
      rig.bounds.copy(mesh.geometry.boundingBox).applyMatrix4(rig.surfaceTransform);
      if(sweep<rig.bounds.min.x||sweep>rig.bounds.max.x)return;
    }
    const surface=scanSurface(mesh,rig);
    if(sweep>=surface.minX&&sweep<=surface.maxX)rig.rayTargets.push(scanSlice(surface,mesh.material,rig,sweep));
  });
  rig.source.set(0,-.14,0);rig.arms[0].tip.localToWorld(rig.source);rig.root.worldToLocal(rig.source);
  // Project onto the visible character surface, falling back to the pad at the sides.
  // The parallel rays are 1 cm apart: test each slice triangle only against the rays over it.
  const beamZ=i=>rig.depth-.40+i*.80/(samples-1),dz=.80/(samples-1);
  rig.heights.fill(-Infinity);
  for(const target of rig.rayTargets){
    const {index,attributes:{position},groups}=target.geometry;
    for(const group of groups){
      const side=(Array.isArray(target.material)?target.material[group.materialIndex]:target.material).side;
      for(let i=group.start;i<group.start+group.count;i+=3){
        _a.fromBufferAttribute(position,index.getX(i));_b.fromBufferAttribute(position,index.getX(i+1));_c.fromBufferAttribute(position,index.getX(i+2));
        const first=Math.max(0,Math.floor((Math.min(_a.z,_b.z,_c.z)-beamZ(0))/dz)),last=Math.min(samples-1,Math.ceil((Math.max(_a.z,_b.z,_c.z)-beamZ(0))/dz));
        for(let s=first;s<=last;s++){
          rig.beam.origin.set(sweep,rig.source.y,beamZ(s));
          // Same face culling as Raycaster for each material side.
          const hit=side===THREE.BackSide?rig.beam.intersectTriangle(_c,_b,_a,true,rig.point):rig.beam.intersectTriangle(_a,_b,_c,side===THREE.FrontSide,rig.point);
          if(hit&&hit.y>rig.heights[s])rig.heights[s]=hit.y;
        }
      }
    }
  }
  for(let i=0;i<samples;i++)rig.points[i].set(sweep,Math.max(rig.top+.014,rig.heights[i])+.009,beamZ(i));
}
