// Bake the supplied hairstyle for the cabin: parse the JSON geometries, apply
// the nape trim once, and write one GLB with the same float32 vertices (no
// quantisation or compression), so the page downloads a single binary
// instead of 3.2 MB of JSON and no longer trims the cards at startup.
// Run: node studies/head/pack-supplied-hair.mjs
import fs from 'node:fs';
import {BufferGeometryLoader} from 'three';
import {trimSuppliedNape} from '../../src/obs/supplied-hair.js';

const dir=new URL('../../public/assets/obs/head/supplied-hair/',import.meta.url);
const read=name=>JSON.parse(fs.readFileSync(new URL(name,dir),'utf8'));
const loader=new BufferGeometryLoader();
export const SUPPLIED_HAIR_MESHES=[['hair-cards','hair-solid.json'],['scalp','scalp.json']];

export function packSuppliedHair(){
  const chunks=[],bufferViews=[],accessors=[],meshes=[],nodes=[];let byteLength=0;
  const push=(array,target)=>{
    const bytes=new Uint8Array(array.buffer,array.byteOffset,array.byteLength);
    bufferViews.push({buffer:0,byteOffset:byteLength,byteLength:bytes.byteLength,...(target?{target}:{})});
    chunks.push(bytes);byteLength+=bytes.byteLength;
    const pad=(4-bytes.byteLength%4)%4;if(pad){chunks.push(new Uint8Array(pad));byteLength+=pad;}
    return bufferViews.length-1;
  };
  for(const [name,file] of SUPPLIED_HAIR_MESHES){
    const geometry=trimSuppliedNape(loader.parse(read(file))),attributes={};
    for(const [attribute,type,semantic] of [['position','VEC3','POSITION'],['normal','VEC3','NORMAL'],['uv','VEC2','TEXCOORD_0']]){
      const a=geometry.attributes[attribute],array=a.array instanceof Float32Array?a.array:Float32Array.from(a.array);
      const accessor={bufferView:push(array,34962),componentType:5126,count:a.count,type};
      if(attribute==='position'){geometry.computeBoundingBox();accessor.min=geometry.boundingBox.min.toArray();accessor.max=geometry.boundingBox.max.toArray();}
      accessors.push(accessor);attributes[semantic]=accessors.length-1;
    }
    const index=geometry.index.array,wide=index.some(i=>i>65535),indices=wide?Uint32Array.from(index):Uint16Array.from(index);
    accessors.push({bufferView:push(indices,34963),componentType:wide?5125:5123,count:indices.length,type:'SCALAR'});
    meshes.push({name,primitives:[{attributes,indices:accessors.length-1,mode:4}]});
    nodes.push({name,mesh:meshes.length-1});
  }
  const json={asset:{version:'2.0',generator:'moonlander pack-supplied-hair'},scene:0,scenes:[{nodes:nodes.map((_,i)=>i)}],nodes,meshes,accessors,bufferViews,buffers:[{byteLength}]};
  let text=JSON.stringify(json);while(text.length%4)text+=' ';
  const jsonBytes=new TextEncoder().encode(text),bin=new Uint8Array(byteLength);let offset=0;for(const chunk of chunks){bin.set(chunk,offset);offset+=chunk.byteLength;}
  const glb=new Uint8Array(12+8+jsonBytes.byteLength+8+bin.byteLength),view=new DataView(glb.buffer);
  view.setUint32(0,0x46546C67,true);view.setUint32(4,2,true);view.setUint32(8,glb.byteLength,true);
  view.setUint32(12,jsonBytes.byteLength,true);view.setUint32(16,0x4E4F534A,true);glb.set(jsonBytes,20);
  const binStart=20+jsonBytes.byteLength;view.setUint32(binStart,bin.byteLength,true);view.setUint32(binStart+4,0x004E4942,true);glb.set(bin,binStart+8);
  return glb;
}

if(process.argv[1]&&import.meta.url===new URL(process.argv[1],'file://').href){
  const glb=packSuppliedHair();fs.writeFileSync(new URL('supplied-hair.glb',dir),glb);
  console.log('wrote supplied-hair.glb',glb.byteLength,'bytes');
}
