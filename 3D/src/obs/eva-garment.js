import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';

let geometry=null;

export async function loadEVAGarment(url=`${import.meta.env?.BASE_URL??'/3D/'}assets/obs/eva/pressure-garment.glb`){
  if(geometry)return geometry;
  const gltf=await new GLTFLoader().loadAsync(url);
  gltf.scene.updateMatrixWorld(true);
  const source=gltf.scene.getObjectByProperty('isMesh',true);
  if(!source)throw new Error('EVA pressure garment mesh is missing');
  geometry=source.geometry.clone().applyMatrix4(source.matrixWorld);
  geometry.computeBoundingBox();geometry.computeBoundingSphere();
  gltf.scene.traverse(object=>{
    object.geometry?.dispose();
    if(object.material)(Array.isArray(object.material)?object.material:[object.material]).forEach(material=>material.dispose());
  });
  return geometry;
}

// Keep the authored lofts available to the Blender build script and non-browser checks.
// In the cabin, replace the authored panels with the joined cloth mesh.
export function finishEVAGarment(suit,material){
  if(!geometry)return;
  const panels=[];
  suit.traverse(mesh=>{if(mesh.name==='Tailored pressure garment'&&mesh.parent.parent===suit)panels.push(mesh.parent);});
  for(const panel of panels){suit.remove(panel);panel.traverse(mesh=>mesh.geometry?.dispose());}
  const cloth=new THREE.Mesh(geometry,material);cloth.name='Tailored pressure garment';
  cloth.castShadow=true;cloth.receiveShadow=true;suit.add(cloth);
  suit.userData.garmentSource='Blender';
}
