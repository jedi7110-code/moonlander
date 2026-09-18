import {MeshStandardMaterial} from 'three';
import {buildShip} from '../../src/obs/ship.js';

export function buildSurfaceFixture(){
  const ctx=new Proxy({measureText:t=>({width:t.length*8}),createLinearGradient:()=>({addColorStop(){}})},{get:(o,k)=>k in o?o[k]:()=>{}});
  const materials=new Map(),source=new Proxy({},{get:(_,key)=>{if(!materials.has(key))materials.set(key,new MeshStandardMaterial({name:String(key)}));return materials.get(key);}});
  const original=globalThis.document;
  globalThis.document={createElement:()=>({getContext:()=>ctx})};
  try{return buildShip(source,{mergeStatic:false});}
  finally{if(original===undefined)delete globalThis.document;else globalThis.document=original;}
}

export function disposeSurfaceFixture(ship){
  const geometries=new Set(),materials=new Set(),textures=new Set();
  for(const root of [ship.staticMesh,ship.animated])root.traverse(mesh=>{
    if(mesh.geometry)geometries.add(mesh.geometry);
    if(mesh.material)for(const material of Array.isArray(mesh.material)?mesh.material:[mesh.material])materials.add(material);
  });
  for(const material of materials)for(const value of Object.values(material))if(value?.isTexture)textures.add(value);
  for(const resource of [...geometries,...materials,...textures])resource.dispose();
}
