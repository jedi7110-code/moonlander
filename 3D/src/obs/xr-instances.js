import {DynamicDrawUsage,InstancedMesh} from 'three';

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

// Repeated leaves, stems and fixture hardware share a draw even while their
// parents grow, sway or move. Exact geometry checks avoid conflating bent parts.
export function createXRInstances(root,scene){
  if(!root)return [];
  const groups=new Map(),cylinders=new Map();
  root.traverse(mesh=>{
    if(!mesh.isMesh||mesh.isSkinnedMesh||mesh.isInstancedMesh||Array.isArray(mesh.material)||mesh.material.transparent||mesh.morphTargetInfluences?.length||/toon outline$/.test(mesh.name))return;
    let geometry=mesh.geometry;
    if(geometry.type==='CylinderGeometry'){
      const key=JSON.stringify(geometry.parameters),candidates=cylinders.get(key)??[];
      const match=candidates.find(other=>sameGeometry(geometry,other));
      if(match)geometry=match;else{candidates.push(geometry);cylinders.set(key,candidates);}
    }
    const key=geometry.uuid+'/'+mesh.material.uuid+'/'+mesh.renderOrder;
    if(!groups.has(key))groups.set(key,{geometry,material:mesh.material,renderOrder:mesh.renderOrder,sources:[]});
    groups.get(key).sources.push(mesh);
  });
  const batches=[];
  for(const {geometry,material,renderOrder,sources} of groups.values()){
    if(sources.length<3)continue;
    const mesh=new InstancedMesh(geometry,material,sources.length);
    mesh.name='XR repeated fixtures';mesh.visible=false;mesh.frustumCulled=false;mesh.renderOrder=renderOrder;
    mesh.instanceMatrix.setUsage(DynamicDrawUsage);mesh.raycast=()=>{};
    scene.add(mesh);batches.push({mesh,sources});
  }
  return batches;
}

export function isWorldVisible(object){
  for(let node=object;node;node=node.parent)if(!node.visible)return false;
  return true;
}
