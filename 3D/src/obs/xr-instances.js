import {DynamicDrawUsage,InstancedMesh,Object3D} from 'three';

function sameGeometry(a,b){
  if(Object.keys(a.attributes).join(',')!==Object.keys(b.attributes).join(','))return false;
  for(const key of ['index',...Object.keys(a.attributes)]){
    const x=key==='index'?a.index:a.attributes[key],y=key==='index'?b.index:b.attributes[key];
    if(!x||!y){if(x!==y)return false;continue;}
    if(x.itemSize!==y.itemSize||x.normalized!==y.normalized||x.array.length!==y.array.length)return false;
    for(let i=0;i<x.array.length;i++)if(x.array[i]!==y.array[i])return false;
  }
  return true;
}
const hooks=Object3D.prototype;

// Repeated leaves, stems and fixture hardware share a draw even while their
// parents grow, sway or move. Exact geometry checks avoid conflating bent parts.
// With `shadows`, batches also split by receiver flag and layers and copy
// them, so the shared draw is exact for the shadowed desktop render too.
export function createXRInstances(root,scene,{shadows=false,name='XR repeated fixtures'}={}){
  if(!root)return [];
  const groups=new Map(),cylinders=new Map();
  root.traverse(mesh=>{
    if(!mesh.isMesh||mesh.isSkinnedMesh||mesh.isInstancedMesh||Array.isArray(mesh.material)||mesh.material.transparent||mesh.morphTargetInfluences?.length||/toon outline$/.test(mesh.name))return;
    if(mesh.onBeforeRender!==hooks.onBeforeRender||mesh.onAfterRender!==hooks.onAfterRender||mesh.customDepthMaterial)return;
    if(shadows&&(mesh.material.clippingPlanes?.length||mesh.geometry.drawRange.start||mesh.geometry.drawRange.count!==Infinity))return;
    let geometry=mesh.geometry;
    if(geometry.type==='CylinderGeometry'){
      const key=JSON.stringify(geometry.parameters),candidates=cylinders.get(key)??[];
      const match=candidates.find(other=>sameGeometry(geometry,other));
      if(match)geometry=match;else{candidates.push(geometry);cylinders.set(key,candidates);}
    }
    const key=geometry.uuid+'/'+mesh.material.uuid+'/'+mesh.renderOrder+(shadows?`/${mesh.receiveShadow}/${mesh.layers.mask}`:'');
    if(!groups.has(key))groups.set(key,{geometry,material:mesh.material,renderOrder:mesh.renderOrder,sources:[]});
    groups.get(key).sources.push(mesh);
  });
  const batches=[];
  for(const {geometry,material,renderOrder,sources} of groups.values()){
    if(sources.length<3)continue;
    const mesh=new InstancedMesh(geometry,material,sources.length);mesh.count=0;
    mesh.name=name;mesh.visible=false;mesh.frustumCulled=false;mesh.renderOrder=renderOrder;
    mesh.instanceMatrix.setUsage(DynamicDrawUsage);mesh.raycast=()=>{};
    if(shadows){
      const [first]=sources;mesh.receiveShadow=first.receiveShadow;mesh.layers.mask=first.layers.mask;
      // Caster flags follow the sources per frame; the startup compile still
      // prepares the instanced depth program whenever any source may cast.
      mesh.castShadow=sources.some(source=>source.castShadow);mesh.userData.mayCastShadow=true;
    }
    // Equal cylinders share the batch geometry; remember each source's own.
    scene.add(mesh);batches.push({mesh,sources,geometries:sources.map(source=>source.geometry)});
  }
  return batches;
}

export function isWorldVisible(object){
  for(let node=object;node;node=node.parent)if(!node.visible)return false;
  return true;
}
