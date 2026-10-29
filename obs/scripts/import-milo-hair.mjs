// Extract only the supplied hair and scalp, preserving authored UVs/normals.
// node scripts/import-milo-hair.mjs <obj> <textures/maya file.fbm>
import {readFile,writeFile,mkdir,copyFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {OBJLoader} from 'three/addons/loaders/OBJLoader.js';
import {mergeVertices} from 'three/addons/utils/BufferGeometryUtils.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {fitSuppliedHair,hairFitField} from '../src/obs/supplied-hair.js';
const [objPath,texturePath]=process.argv.slice(2);
if(!objPath||!texturePath)throw new Error('Supply OBJ and texture directory');
const output=resolve('public/assets/obs/head/supplied-hair');
await mkdir(output,{recursive:true});
const obj=new OBJLoader().parse(await readFile(objPath,'utf8'));
const scanBytes=await readFile(resolve('public/assets/obs/head/LeePerrySmith.glb'));
const scan=await new GLTFLoader().parseAsync(scanBytes.buffer.slice(scanBytes.byteOffset,scanBytes.byteOffset+scanBytes.byteLength),'');
const fit=hairFitField(fitSuppliedHair(obj.getObjectByName('Body').geometry),scan.scene.getObjectByName('LeePerrySmith').geometry);
for(const [name,file] of [['Hair_S_','hair'],['Scalp_Male','scalp']]){
  const mesh=obj.getObjectByName(name);if(!mesh?.isMesh)throw new Error(`Missing ${name}`);
  const geometry=fit(fitSuppliedHair(mergeVertices(mesh.geometry,1e-5)));
  await writeFile(join(output,file+'.json'),JSON.stringify(geometry.toJSON()));
  console.log(file,geometry.attributes.position.count,'vertices');
}
for(const [source,target] of [
  ['MI_Jacob_Hair_Transparency_Diffuse.png','hair-color.png'],
  ['MI_Jacob_Hair_Transparency_Opacity.jpg','hair-opacity.jpg'],
  ['MI_Jacob_Hair_Transparency_Normal.png','hair-normal.png'],
  ['Scalp1_Transparency_Diffuse.jpg','scalp-color.jpg'],
  ['Scalp1_Transparency_Opacity.jpg','scalp-opacity.jpg'],
])await copyFile(join(texturePath,source),join(output,target));
