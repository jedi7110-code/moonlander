import {BufferGeometry,Mesh} from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {limitShadowCasters} from './lighting.js';

const details=new Set(['Combat boot sole lug','Metal boot eyelet','Crossed boot lace',
  'Tightened top lace','Tied boot lace loop','Boot lace end']);

// These details never move relative to their boot. Preserve every triangle,
// material, UV and shadow flag, but submit matching surfaces together.
export function batchCurtisBootDetails(root){
  limitShadowCasters(root);
  for(const boot of root.getObjectsByProperty('name','Laced combat boot')){
    const batches=new Map();
    for(const mesh of boot.children){
      if(!mesh.isMesh||!details.has(mesh.name))continue;
      const key=`${mesh.material.uuid}/${mesh.castShadow}/${mesh.receiveShadow}`;
      if(!batches.has(key))batches.set(key,[]);
      batches.get(key).push(mesh);
    }
    for(const meshes of batches.values()){
      if(meshes.length<2)continue;
      const parts=meshes.map(mesh=>{
        mesh.updateMatrix();
        const geometry=mesh.geometry.index?mesh.geometry.toNonIndexed():mesh.geometry.clone();
        return geometry.applyMatrix4(mesh.matrix);
      });
      const geometry=mergeGeometries(parts,false);parts.forEach(part=>part.dispose());
      const first=meshes[0],batch=new Mesh(geometry,first.material);
      batch.name=meshes.every(mesh=>mesh.name===first.name)?first.name:'Curtis boot lace details';
      batch.castShadow=first.castShadow;batch.receiveShadow=first.receiveShadow;
      boot.add(batch);meshes.forEach(mesh=>mesh.removeFromParent());
      // Original helper geometry is shared with Milo and must stay alive.
    }
  }
}

// The shirt shader discards the lower body, hands and the open front. Exclude
// only triangles wholly inside those discarded regions, retaining the exact
// surviving surface and the live skin attributes underneath it.
export function createCurtisShirtGeometry(source){
  const {position,armRegion}=source.attributes,sourceIndex=source.index.array,index=[];
  for(let i=0;i<sourceIndex.length;i+=3){
    const face=[sourceIndex[i],sourceIndex[i+1],sourceIndex[i+2]];
    const ys=face.map(j=>position.getY(j));
    if(Math.max(...ys)<1.135||Math.min(...ys)>1.584)continue;
    if(face.every(j=>armRegion.getX(j)>=.5)&&Math.max(...ys)<1.205)continue;
    if(face.every(j=>position.getZ(j)>.025&&Math.abs(position.getX(j))<.039))continue;
    index.push(...face);
  }
  const geometry=new BufferGeometry();
  for(const [name,attribute]of Object.entries(source.attributes))geometry.setAttribute(name,attribute);
  geometry.setIndex(index);
  geometry.boundingBox=source.boundingBox?.clone()??null;
  geometry.boundingSphere=source.boundingSphere?.clone()??null;
  return geometry;
}
