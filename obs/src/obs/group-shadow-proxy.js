import * as THREE from 'three';

// Animated fixtures (racks, rigs, capsules, couches) move as a whole while most
// of their parts stay rigid inside the group. Each group casts those parts'
// shadows through one merged, position-only mesh that never draws in the main
// pass. Every frame each part is checked against its baked pose, visibility and
// material; a part that differs leaves the proxy before the shadow pass and
// casts its own shadow again, so the shadow map never changes.
const MATRIX_TOLERANCE=1e-7,MAX_FLIPS=8,hooks=THREE.Object3D.prototype;
const SIDES=new Set([THREE.FrontSide,THREE.DoubleSide]);

export function shadowEquivalent(material,side){
  return Boolean(material)&&!Array.isArray(material)&&material.side===side&&material.shadowSide==null&&!material.transparent&&
    !(material.alphaTest>0)&&!material.alphaMap&&!material.wireframe&&!(material.clippingPlanes?.length)&&!(material.displacementMap&&material.displacementScale!==0);
}
function proxyCandidate(mesh){
  const {geometry,material}=mesh;
  return Boolean(mesh.isMesh&&mesh.castShadow&&!mesh.isSkinnedMesh&&!mesh.isInstancedMesh&&!mesh.customDepthMaterial&&
    !mesh.morphTargetInfluences?.length&&!geometry.morphAttributes?.position&&geometry.attributes.position&&
    geometry.drawRange.start===0&&geometry.drawRange.count===Infinity&&
    mesh.onBeforeRender===hooks.onBeforeRender&&mesh.onAfterRender===hooks.onAfterRender&&!/shadow proxy$/.test(mesh.name)&&
    SIDES.has(material?.side)&&shadowEquivalent(material,material.side));
}
function visibleUnder(mesh,group){
  for(let node=mesh;node!==group;node=node.parent)if(!node||!node.visible)return false;
  return true;
}
function matrixClose(a,b){
  const x=a.elements,y=b.elements;
  for(let i=0;i<16;i++)if(Math.abs(x[i]-y[i])>MATRIX_TOLERANCE)return false;
  return true;
}

export class GroupShadowProxy {
  constructor(group,side,meshes,inverse){
    this.group=group;this.side=side;this.activeCount=0;
    let vertexTotal=0,indexTotal=0;
    for(const {geometry} of meshes){vertexTotal+=geometry.attributes.position.count;indexTotal+=geometry.index?geometry.index.count:geometry.attributes.position.count;}
    const positions=new Float32Array(vertexTotal*3),point=new THREE.Vector3();
    let vertexBase=0;
    this.parts=meshes.map(mesh=>{
      const local=new THREE.Matrix4().multiplyMatrices(inverse,mesh.matrixWorld);
      const {geometry}=mesh,position=geometry.attributes.position,count=position.count;
      for(let i=0;i<count;i++){point.fromBufferAttribute(position,i).applyMatrix4(local);point.toArray(positions,(vertexBase+i)*3);}
      const source=geometry.index?.array,length=source?source.length:count,indices=new Uint32Array(length);
      for(let i=0;i<length;i++)indices[i]=(source?source[i]:i)+vertexBase;
      vertexBase+=count;
      mesh.castShadow=false;
      return {mesh,local,material:mesh.material,geometry,version:position.version,indices,active:true,flips:0,retired:false};
    });
    const geometry=new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));
    this.index=new Uint32Array(indexTotal);
    geometry.setIndex(new THREE.BufferAttribute(this.index,1));
    const material=new THREE.MeshBasicMaterial({side});
    material.name=`${group.name||'Fixture'} shadow proxy`;
    Object.assign(material.userData,{cabinAlwaysPowered:true,cabinKeepSurface:true,cabinNoOutline:true});
    const proxy=this.mesh=new THREE.Mesh(geometry,material);
    proxy.name=`${group.name||'Fixture'} shadow proxy`;proxy.castShadow=true;proxy.receiveShadow=false;proxy.frustumCulled=false;
    proxy.raycast=()=>{};
    // The shadow pass skips these hooks, so only the main pass sees no triangles.
    proxy.onBeforeRender=()=>{geometry.drawRange.count=0;};
    proxy.onAfterRender=()=>{geometry.drawRange.count=this.activeCount;};
    group.add(proxy);
    this.rebuild();
  }
  rebuild(){
    let offset=0;
    for(const part of this.parts){
      if(!part.active)continue;
      this.index.set(part.indices,offset);offset+=part.indices.length;
    }
    this.activeCount=offset;
    const {geometry}=this.mesh;geometry.drawRange.count=offset;geometry.index.needsUpdate=true;
  }
  retire(part){
    part.retired=true;
    if(!part.active)return false;
    part.active=false;part.mesh.castShadow=true;return true;
  }
  update(expected){
    let dirty=false;
    for(const part of this.parts){
      if(part.retired)continue;
      const {mesh}=part;
      // Someone else changed the caster flag: hand the part back for good.
      if(mesh.castShadow===part.active){dirty=this.retire(part)||dirty;continue;}
      // Replaced or rewritten geometry can only be baked again; drop it.
      let ok=visibleUnder(mesh,this.group)&&mesh.material?.visible!==false&&mesh.geometry===part.geometry&&
        part.geometry.attributes.position.version===part.version&&
        matrixClose(mesh.matrixWorld,expected.multiplyMatrices(this.group.matrixWorld,part.local));
      if(ok&&mesh.material!==part.material){
        if(shadowEquivalent(mesh.material,this.side))part.material=mesh.material;else ok=false;
      }
      if(ok===part.active)continue;
      if(++part.flips>MAX_FLIPS){dirty=this.retire(part)||dirty;continue;}
      part.active=ok;mesh.castShadow=!ok;dirty=true;
    }
    if(dirty)this.rebuild();
  }
  dispose(){
    for(const part of this.parts)if(part.active)part.mesh.castShadow=true;
    this.mesh.removeFromParent();this.mesh.geometry.dispose();this.mesh.material.dispose();
  }
}

export class GroupShadowProxies {
  constructor(proxies){this.proxies=proxies;this.expected=new THREE.Matrix4();}
  get partCount(){return this.proxies.reduce((count,{parts})=>count+parts.length,0);}
  // Call after animation and matrix updates, before the shadow pass renders.
  update(){for(const proxy of this.proxies)proxy.update(this.expected);}
  // Parts that left their proxy; these are the fixtures that really move.
  report(){
    return this.proxies.flatMap(({group,parts})=>parts.filter(part=>!part.active).map(part=>
      ({group:group.name||group.type,mesh:part.mesh.name||part.mesh.type,retired:part.retired,flips:part.flips})));
  }
  dispose(){for(const proxy of this.proxies)proxy.dispose();this.proxies=[];}
}

// One proxy per top-level animated group and material side. Single-part groups
// gain nothing from merging and keep their own caster.
export function* createGroupShadowProxySteps(root,{minParts=2}={}){
  root.updateMatrixWorld(true);
  const proxies=[],inverse=new THREE.Matrix4();let batchStart=performance.now();
  for(const group of root.children){
    if(group.isMesh||!group.children.length)continue;
    const buckets=new Map();
    group.traverse(mesh=>{
      if(!proxyCandidate(mesh))return;
      const side=mesh.material.side;
      if(!buckets.has(side))buckets.set(side,[]);
      buckets.get(side).push(mesh);
    });
    inverse.copy(group.matrixWorld).invert();
    for(const [side,meshes] of buckets){
      if(meshes.length<minParts)continue;
      if(performance.now()-batchStart>=4){yield;batchStart=performance.now();}
      proxies.push(new GroupShadowProxy(group,side,meshes,inverse));
    }
  }
  return new GroupShadowProxies(proxies);
}
